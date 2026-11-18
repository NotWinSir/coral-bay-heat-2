// shots.js — the four screenshot scenes, staged deterministically from the
// ?shot= parameter: the same seed builds the same city, then each scene
// places Marco, his car, the law and the Vultures where the story needs
// them, plays the real rules forward a few steps and freezes on the frame.
// Nothing here is drawn by hand; every shot is the game itself, rendered.

import { poiById } from './city.js';
import { blockOrigin } from './roads.js';
import { makeCar } from './vehicles.js';
import { spawnThug } from './combat.js';
import { makePed } from './pedestrians.js';
import { addHeat } from './police.js';
import { MISSION_DEFS } from './missions.js';
import { vRoadX, hRoadY } from './roads.js';

function placeCamera(G, x, y) {
  G.camera.x = Math.min(Math.max(0, x - 640), 3648 - 1280);
  G.camera.y = Math.min(Math.max(0, y - 360), 2752 - 720);
}

function fakeActive(G, defIndex, objective) {
  G.missions.active = { def: MISSION_DEFS[defIndex], stage: 0, data: {} };
  G.missions.objective = objective;
}

/** Cover: Marco at speed downtown in a scarlet Vireo, first job on the HUD. */
function stageCover(G) {
  const cafe = poiById(G.city, 'cafe');
  const roadY = hRoadY(4);
  const car = makeCar('sport', vRoadX(4) + 60, roadY + 15, 0, '#d92338');
  car.driver = 'player';
  car.speed = 235;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
  const spot = blockOrigin(2, 2);
  fakeActive(G, 0, { x: spot.x + 80, y: spot.y + 178, text: 'Collect the debt from Nico in Old Town', radius: 34 });
  G.player.cash = 240;
  G.player.respect = 12;
  placeCamera(G, car.x + 120, car.y);
}

/** Chase: four stars, three Interceptors, one order — lose the heat. */
function stageChase(G) {
  const roadY = hRoadY(7);
  const car = makeCar('sedan', vRoadX(9) + 40, roadY + 15, 0, '#3d7bd9');
  car.driver = 'player';
  car.speed = 285;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
  for (let i = 0; i < 3; i += 1) {
    const cop = makeCar('interceptor', car.x - 120 - i * 105, roadY + (i % 2 === 0 ? 15 : -15), 0, '#eef1f4');
    cop.driver = 'police';
    cop.speed = 268 - i * 14;
    G.cars.push(cop);
    G.cops.push(cop);
  }
  addHeat(G, 3.4);
  const motel = poiById(G.city, 'motel');
  fakeActive(G, 3, { x: motel.markerX, y: motel.markerY, text: 'Lose the heat — reach Motel Brisa', radius: 34 });
  G.player.cash = 890;
  G.player.respect = 84;
  placeCamera(G, car.x + 60, car.y);
}

/** On foot: Marco on a busy Palm Row pavement, Vera waiting with work. */
function stageFoot(G) {
  const cafe = poiById(G.city, 'cafe');
  G.player.x = cafe.markerX - 2;
  G.player.y = cafe.markerY + 10;
  G.player.angle = 0.4;
  for (let i = 0; i < 6; i += 1) {
    const ped = makePed(G.rng, cafe.markerX - 90 + i * 34, cafe.markerY - 26 + (i % 3) * 22);
    ped.state = 'stand';
    G.peds.push(ped);
  }
  G.player.cash = 60;
  placeCamera(G, G.player.x, G.player.y);
}

/** Mission: the Marina Cash Office, mid-gunfight, bag still on the desk. */
function stageMission(G) {
  const marina = poiById(G.city, 'marina');
  G.player.x = marina.markerX - 44;
  G.player.y = marina.markerY + 34;
  const t1 = spawnThug(G, marina.markerX + 38, marina.markerY + 2, { group: 'm4' });
  const t2 = spawnThug(G, marina.markerX + 76, marina.markerY + 46, { group: 'm4' });
  const t3 = spawnThug(G, marina.markerX + 8, marina.markerY + 74, { group: 'm4' });
  t1.state = 'combat';
  t2.state = 'combat';
  t3.state = 'combat';
  t2.hp = 22;
  t2.hurtT = 0.2;
  G.aggroGroups.add('m4');
  G.player.angle = Math.atan2(t1.y - G.player.y, t1.x - G.player.x);
  G.bullets.push({
    x: G.player.x + Math.cos(G.player.angle) * 120,
    y: G.player.y + Math.sin(G.player.angle) * 120,
    vx: Math.cos(G.player.angle) * 860,
    vy: Math.sin(G.player.angle) * 860,
    life: 0.4, from: 'player', dmg: 16,
  });
  G.fx.muzzle(G.player.x + Math.cos(G.player.angle) * 13, G.player.y + Math.sin(G.player.angle) * 13, G.player.angle);
  addHeat(G, 1.6);
  fakeActive(G, 3, { x: marina.markerX, y: marina.markerY, text: 'Clear out the Marina Cash Office guards', radius: 46 });
  G.player.cash = 1240;
  G.player.respect = 118;
  G.player.mag = 9;
  placeCamera(G, G.player.x + 40, G.player.y);
}

export const SHOT_SCENES = {
  cover: stageCover,
  chase: stageChase,
  foot: stageFoot,
  mission: stageMission,
};

export function stageShot(G, name) {
  const scene = SHOT_SCENES[name] || stageCover;
  scene(G);
}

/**
 * Transient dressing applied after the warmup steps, in the frozen frame:
 * the mission scene gets its muzzle flashes and tracer rounds back, the
 * instants a live fight shows for a twentieth of a second.
 */
export function dressShot(G, name) {
  if (name !== 'mission') return;
  const p = G.player;
  const gx = p.x + Math.cos(p.angle) * 13;
  const gy = p.y + Math.sin(p.angle) * 13;
  G.fx.muzzle(gx, gy, p.angle);
  G.bullets.push({
    x: p.x + Math.cos(p.angle) * 64, y: p.y + Math.sin(p.angle) * 64,
    vx: Math.cos(p.angle) * 860, vy: Math.sin(p.angle) * 860,
    life: 0.4, from: 'player', dmg: 16,
  });
  let nearest = null;
  let best = Infinity;
  for (const thug of G.thugs) {
    if (thug.dead) continue;
    const d = Math.hypot(thug.x - p.x, thug.y - p.y);
    if (d < best) { best = d; nearest = thug; }
  }
  if (nearest) {
    const a = Math.atan2(p.y - nearest.y, p.x - nearest.x);
    G.fx.muzzle(nearest.x + Math.cos(a) * 12, nearest.y + Math.sin(a) * 12, a);
    G.bullets.push({
      x: nearest.x + Math.cos(a) * 44, y: nearest.y + Math.sin(a) * 44,
      vx: Math.cos(a) * 860, vy: Math.sin(a) * 860,
      life: 0.4, from: 'thug', dmg: 6,
    });
  }
}
