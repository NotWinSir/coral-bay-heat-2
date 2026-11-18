// world.js — Coral Bay as one living state: the city, Marco, every car,
// walker, officer, bullet and spark, plus the rules that bind them — who
// saw the crime, what a wreck costs, where a busted wheelman wakes up.

import { generateCity, districtAt, poiById } from './city.js';
import { makeRng } from './rng.js';
import { createPlayer, playerPos, updatePlayer } from './player.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPedestrians, updatePedestrians, scarePeds } from './pedestrians.js';
import { initWanted, reportCrime, clearHeat, updatePolice } from './police.js';
import { initMissions, initStory, updateMissions } from './missions.js';
import { updateCombat, hurtThug } from './combat.js';
import { collideCars, makeCar } from './vehicles.js';
import { snapshotOf, storeSave } from './save.js';
import { WORLD_W, WORLD_H } from './roads.js';
import { sfx } from './audio.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

function makeFx(G) {
  return {
    burst(x, y, n, color, speed, life) {
      for (let i = 0; i < n; i += 1) {
        const a = G.rng() * Math.PI * 2;
        const s = speed * (0.3 + G.rng() * 0.9);
        G.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: life * (0.5 + G.rng() * 0.8), maxLife: life,
          color, size: 1.4 + G.rng() * 2.2, drag: 3.2, rise: 0,
        });
      }
    },
    smoke(x, y) {
      G.particles.push({
        x: x + (G.rng() - 0.5) * 6, y: y + (G.rng() - 0.5) * 6,
        vx: (G.rng() - 0.5) * 8, vy: -14 - G.rng() * 12,
        life: 1.1, maxLife: 1.1, color: 'rgba(70, 74, 78, 0.5)', size: 5 + G.rng() * 5, drag: 0.4, rise: 1,
      });
    },
    floater(x, y, text, color) {
      G.floaters.push({ x, y, text, color, t: 0 });
    },
    muzzle(x, y, angle) {
      G.flashes.push({ x, y, angle, t: 0 });
    },
    update(dt) {
      for (const pt of G.particles) {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.rise) pt.y -= 6 * dt;
        pt.vx -= pt.vx * pt.drag * dt;
        pt.vy -= pt.vy * pt.drag * dt;
      }
      G.particles = G.particles.filter((pt) => pt.life > 0);
      for (const f of G.floaters) {
        f.t += dt;
        f.y -= 22 * dt;
      }
      G.floaters = G.floaters.filter((f) => f.t < 1.6);
      for (const fl of G.flashes) fl.t += dt;
      G.flashes = G.flashes.filter((fl) => fl.t < 0.05);
    },
  };
}

export function createWorld(seed, saved) {
  const rng = makeRng(seed);
  const city = generateCity(seed);
  const cafe = poiById(city, 'cafe');
  const G = {
    seed,
    rng,
    city,
    time: 0,
    screen: 'title',
    dialog: null,
    toast: null,
    banner: null,
    interact: null,
    shake: 0,
    aimWorld: { x: 0, y: 0 },
    camera: { x: 0, y: 0 },
    districtName: '',
    cars: [],
    peds: [],
    cops: [],
    thugs: [],
    bullets: [],
    pickups: [],
    particles: [],
    floaters: [],
    flashes: [],
    aggroGroups: new Set(),
    stats: { carsSold: 0, thugsDown: 0 },
    lastShotCrimeT: -9,
    deadCarT: new Map(),
  };
  G.fx = makeFx(G);
  G.wanted = initWanted();
  G.missions = initMissions(saved);
  G.player = createPlayer(cafe.markerX - 30, cafe.markerY + 16);
  if (saved) {
    const p = G.player;
    p.cash = saved.cash;
    p.respect = saved.respect;
    p.hp = saved.hp;
    p.ammoReserve = saved.ammoReserve;
    if (saved.playerX > 0 && saved.playerY > 0) {
      p.x = saved.playerX;
      p.y = saved.playerY;
    }
    G.stats.carsSold = saved.carsSold || 0;
    G.stats.thugsDown = saved.thugsDown || 0;
  }
  G.reportCrime = (kind, x, y) => reportCrime(G, kind, x, y);
  G.scare = (x, y, r) => scarePeds(G, x, y, r);
  G.clearHeat = () => clearHeat(G);
  G.saveGame = () => storeSave(snapshotOf(G));
  G.onBusted = () => {
    if (G.screen !== 'play') return;
    G.screen = 'busted';
    sfx.busted();
  };
  G.onWasted = () => {
    if (G.screen !== 'play') return;
    G.screen = 'wasted';
    sfx.wasted();
  };
  G.onBossDown = () => {};
  G.onCarDestroyed = (car) => {
    if (car.driver === 'police') {
      const pp = playerPos(G);
      if (Math.hypot(car.x - pp.x, car.y - pp.y) < 260) G.reportCrime('copkill', car.x, car.y);
    }
  };
  G.onCarsCollided = (a, b, relSpeed) => {
    if (relSpeed > 120 && (a.driver === 'player' || b.driver === 'player')) {
      const other = a.driver === 'player' ? b : a;
      G.scare(other.x, other.y, 150);
    }
  };

  initTraffic(G);
  initPedestrians(G);
  initStory(G);

  // Marco's own battered sedan waits by the cafe — his, so no alarm, no sale.
  const own = makeCar('sedan', cafe.markerX + 64, cafe.markerY + 30, Math.PI, '#7a4a8c');
  own.ownedByPlayer = true;
  own.parked = true;
  own.health = 82;
  G.cars.push(own);
  G.ownCar = own;

  const pp = playerPos(G);
  G.camera.x = clamp(pp.x - VIEW_W / 2, 0, Math.max(0, WORLD_W - VIEW_W));
  G.camera.y = clamp(pp.y - VIEW_H / 2, 0, Math.max(0, WORLD_H - VIEW_H));
  G.districtName = districtAt(pp.x, pp.y).name;
  return G;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function clearPolice(G) {
  G.cars = G.cars.filter((c) => c.driver !== 'police');
  G.cops = [];
}

export function applyBustedRecovery(G) {
  const p = G.player;
  const fine = Math.floor(p.cash * 0.15);
  p.cash -= fine;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  const station = poiById(G.city, 'police');
  p.x = station.markerX;
  p.y = station.markerY + 10;
  p.hp = Math.max(60, p.hp);
  clearHeat(G);
  clearPolice(G);
  G.fx.floater(p.x, p.y - 24, 'Fine paid: $' + fine, '#ffd76a');
  G.saveGame();
}

export function applyWastedRecovery(G) {
  const p = G.player;
  const bill = Math.floor(p.cash * 0.1);
  p.cash -= bill;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  const hospital = poiById(G.city, 'hospital');
  p.x = hospital.markerX;
  p.y = hospital.markerY + 10;
  p.hp = p.maxHp;
  p.dead = false;
  clearHeat(G);
  clearPolice(G);
  G.fx.floater(p.x, p.y - 24, 'Hospital bill: $' + bill, '#ff9d9d');
  G.saveGame();
}

/** Cars run people down; the city keeps score of who was driving. */
function checkCarPedHits(G) {
  for (const car of G.cars) {
    if (Math.abs(car.speed) < 95 || car.dead) continue;
    for (const ped of G.peds) {
      if (ped.state === 'down' || ped.role) continue;
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      if (dx * dx + dy * dy < 15 * 15) {
        ped.state = 'down';
        G.fx.burst(ped.x, ped.y, 8, '#c0392b', 70, 0.4);
        if (car.driver === 'player') {
          G.reportCrime('runover', ped.x, ped.y);
          G.shake = Math.min(8, G.shake + 3);
        }
        car.speed *= 0.72;
      }
    }
    for (const thug of G.thugs) {
      if (thug.dead) continue;
      const dx = thug.x - car.x;
      const dy = thug.y - car.y;
      if (dx * dx + dy * dy < 16 * 16) {
        hurtThug(G, thug, 75, car.angle);
        car.speed *= 0.8;
        if (car.driver === 'player') G.shake = Math.min(7, G.shake + 2);
      }
    }
  }
}

function cleanupWrecks(G, dt) {
  for (const car of G.cars) {
    if (!car.dead) continue;
    const t = (G.deadCarT.get(car.id) || 0) + dt;
    G.deadCarT.set(car.id, t);
  }
  G.cars = G.cars.filter((car) => {
    if (!car.dead) return true;
    if (car === G.player.car) return true;
    if (G.missions.active && G.missions.active.data.gt === car) return true;
    return (G.deadCarT.get(car.id) || 0) < 26;
  });
}

/** One fixed step of the living city. Only called in play, outside dialog. */
export function stepWorld(G, dt) {
  G.time += dt;
  updatePlayer(G, dt);
  if (G.player.car && G.player.car.dead) {
    // Thrown clear of his own wreck.
    const car = G.player.car;
    G.player.hp -= 8;
    G.player.car = null;
    car.driver = null;
    G.player.x = car.x + 26;
    G.player.y = car.y + 10;
    if (G.player.hp <= 0) G.onWasted();
  }
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updatePedestrians(G, dt);
  updateCombat(G, dt);
  collideCars(G, dt);
  checkCarPedHits(G);
  cleanupWrecks(G, dt);
  updateMissions(G, dt);
  G.fx.update(dt);

  if (G.toast) {
    G.toast.t -= dt;
    if (G.toast.t <= 0) G.toast = null;
  }
  if (G.banner) {
    G.banner.t -= dt;
    if (G.banner.t <= 0) G.banner = null;
  }
  G.shake = Math.max(0, G.shake - dt * 14);

  const pp = playerPos(G);
  const district = districtAt(pp.x, pp.y);
  if (district.name !== G.districtName) {
    G.districtName = district.name;
    G.banner = { text: district.name, t: 2.4 };
  }

  // Camera: follow with a lead toward motion, clamped to the bay.
  let tx = pp.x - VIEW_W / 2;
  let ty = pp.y - VIEW_H / 2;
  if (G.player.car) {
    tx += Math.cos(G.player.car.angle) * G.player.car.speed * 0.34;
    ty += Math.sin(G.player.car.angle) * G.player.car.speed * 0.34;
  }
  G.camera.x += (clamp(tx, 0, Math.max(0, WORLD_W - VIEW_W)) - G.camera.x) * Math.min(1, dt * 5.2);
  G.camera.y += (clamp(ty, 0, Math.max(0, WORLD_H - VIEW_H)) - G.camera.y) * Math.min(1, dt * 5.2);
}
