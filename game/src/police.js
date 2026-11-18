// police.js — the CBPD: a wanted system built on witnesses, and Interceptors
// that mean it. Crimes only raise heat when someone sees them — a pedestrian
// close enough to testify or a patrol car in range. Stay unseen and the
// stars bleed away; get cornered and slow, and the bust meter fills.

import { makeCar } from './vehicles.js';
import { driveCarToward } from './traffic.js';
import { randomIntersection, laneOffset } from './roads.js';
import { playerPos } from './player.js';
import { scarePeds } from './pedestrians.js';
import { sfx } from './audio.js';

export const CRIME_HEAT = {
  cartheft: 1.0,
  crash: 0.55,
  assault: 1.0,
  gunshot: 1.0,
  runover: 1.6,
  murder: 2.0,
  copkill: 2.6,
  cardestroyed: 1.2,
};

const PED_WITNESS_R = 250;
const COP_WITNESS_R = 440;

export function initWanted() {
  return {
    points: 0,
    stars: 0,
    bust: 0,
    lastSeenT: 99,
    spawnT: 0,
    hideoutCd: 0,
  };
}

export function starsFor(points) {
  if (points <= 0.01) return 0;
  return Math.min(5, Math.ceil(points));
}

/** Would anyone testify to a crime at (x, y)? */
export function witnessed(G, x, y) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < PED_WITNESS_R * PED_WITNESS_R) return true;
  }
  for (const cop of G.cops) {
    if (cop.dead) continue;
    const dx = cop.x - x;
    const dy = cop.y - y;
    if (dx * dx + dy * dy < COP_WITNESS_R * COP_WITNESS_R) return true;
  }
  return false;
}

export function reportCrime(G, kind, x, y) {
  const heat = CRIME_HEAT[kind] || 0.5;
  if (kind === 'gunshot' || kind === 'murder' || kind === 'runover') scarePeds(G, x, y, 240);
  if (!witnessed(G, x, y)) return false;
  const before = G.wanted.stars;
  G.wanted.points = Math.min(5.6, G.wanted.points + heat);
  G.wanted.stars = starsFor(G.wanted.points);
  G.wanted.lastSeenT = 0;
  if (G.wanted.stars > before) {
    sfx.wantedUp();
    G.fx.floater(x, y - 30, 'WANTED ' + '★'.repeat(G.wanted.stars), '#ffd76a');
  }
  return true;
}

/** Add heat directly (mission scripts and staged scenes use this). */
export function addHeat(G, points) {
  const before = G.wanted.stars;
  G.wanted.points = Math.min(5.6, Math.max(0, G.wanted.points + points));
  G.wanted.stars = starsFor(G.wanted.points);
  if (points > 0) G.wanted.lastSeenT = 0;
  if (G.wanted.stars > before) sfx.wantedUp();
}

export function clearHeat(G) {
  G.wanted.points = 0;
  G.wanted.stars = 0;
  G.wanted.bust = 0;
  G.wanted.lastSeenT = 99;
}

function spawnCop(G) {
  const pp = playerPos(G);
  for (let tries = 0; tries < 12; tries += 1) {
    const spot = randomIntersection(G.rng);
    const d = Math.hypot(spot.x - pp.x, spot.y - pp.y);
    if (d < 480 || d > 980) continue;
    const east = G.rng() < 0.5;
    const o = east ? laneOffset(1, 0) : laneOffset(0, 1);
    const cop = makeCar('interceptor', spot.x + o.x, spot.y + o.y, east ? 0 : Math.PI / 2, '#eef1f4');
    cop.driver = 'police';
    G.cars.push(cop);
    G.cops.push(cop);
    return;
  }
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  const pp = playerPos(G);
  w.hideoutCd = Math.max(0, w.hideoutCd - dt);

  // Sight: any living patrol or nearby pedestrian refreshes the hunt.
  let seen = false;
  for (const cop of G.cops) {
    if (cop.dead) continue;
    const d = Math.hypot(cop.x - pp.x, cop.y - pp.y);
    if (d < 580) { seen = true; break; }
  }
  if (!seen) {
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - pp.x, ped.y - pp.y);
      if (d < 190 && w.stars > 0) { seen = true; break; }
    }
  }
  if (seen) w.lastSeenT = 0;
  else w.lastSeenT += dt;

  // Heat bleeds off while nobody watches.
  if (w.points > 0 && w.lastSeenT > 6) {
    w.points = Math.max(0, w.points - dt / 7.5);
    w.stars = starsFor(w.points);
    if (w.points === 0) w.bust = 0;
  }

  // Reinforcements roll in to match the stars.
  const alive = G.cops.filter((c) => !c.dead);
  w.spawnT -= dt;
  if (w.stars > 0 && alive.length < w.stars && w.spawnT <= 0) {
    spawnCop(G);
    w.spawnT = 2.4;
  }

  // The chase itself. A patrol closing on a slow or cornered suspect eases
  // off and pulls alongside instead of orbiting him forever — that is when
  // the bust meter does its work.
  const pSpeed = G.player.car ? Math.abs(G.player.car.speed) : G.player.speedNow;
  let nearest = Infinity;
  for (const cop of G.cops) {
    if (cop.dead) continue;
    if (w.stars === 0 && Math.hypot(cop.x - pp.x, cop.y - pp.y) > 700) cop.retreating = true;
    if (cop.retreating) {
      // Heat is gone: the patrol peels away and despawns in the distance.
      driveCarToward(G, cop, cop.x + Math.cos(cop.angle) * 300, cop.y + Math.sin(cop.angle) * 300, dt, 0.7, false);
      continue;
    }
    const before = Math.hypot(cop.x - pp.x, cop.y - pp.y);
    const sf = before < 120 && pSpeed < 70 ? 0.35 : 1.0;
    driveCarToward(G, cop, pp.x, pp.y, dt, sf, false);
    const dist = Math.hypot(cop.x - pp.x, cop.y - pp.y);
    if (dist < 42 && pSpeed < 40) cop.speed *= Math.max(0, 1 - 7 * dt);
    if (dist < nearest) nearest = dist;
  }
  G.cops = G.cops.filter((cop) => {
    if (cop.dead) return false;
    if (cop.retreating && Math.hypot(cop.x - pp.x, cop.y - pp.y) > 760) {
      G.cars = G.cars.filter((c) => c !== cop);
      return false;
    }
    return true;
  });

  // The bust meter: cornered and slow is caught.
  const p = G.player;
  const inCar = !!p.car;
  const speed = inCar ? Math.abs(p.car.speed) : p.speedNow;
  const range = inCar ? 74 : 98;
  if (w.stars > 0 && nearest < range && speed < 34) {
    w.bust += dt / (inCar ? 2.6 : 2.0);
    if (w.bust >= 1) {
      w.bust = 0;
      G.onBusted();
    }
  } else {
    w.bust = Math.max(0, w.bust - dt / 1.1);
  }
}

/** Nearest living interceptor distance, for sirens and HUD pressure. */
export function nearestCopDist(G) {
  const pp = playerPos(G);
  let best = Infinity;
  for (const cop of G.cops) {
    if (cop.dead) continue;
    const d = Math.hypot(cop.x - pp.x, cop.y - pp.y);
    if (d < best) best = d;
  }
  return best;
}
