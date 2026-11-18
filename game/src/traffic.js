// traffic.js — Coral Bay drives itself: a dozen cars working the grid on
// planned routes, thirty more parked at the kerb waiting to be borrowed.
// Drivers brake for each other and for people, mostly.

import { makeCar, randomTrafficCar, stepCarPhysics } from './vehicles.js';
import { planRoute, randomIntersection, nearestIntersection, laneOffset, blockOrigin, COLS, ROWS } from './roads.js';
import { randRange } from './rng.js';

export const MOVING_TRAFFIC = 13;
export const PARKED_CARS = 30;

/**
 * Shared driving brain: steer a car toward a point with arcade inputs.
 * Handles the classic Coral Bay manoeuvre — reverse out when wedged.
 * Returns the remaining distance to the target.
 */
export function driveCarToward(G, car, tx, ty, dt, speedFactor, brakeForTraffic) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const desired = Math.atan2(dy, dx);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  let steer = Math.max(-1, Math.min(1, diff * 2.4));
  let throttle = speedFactor;
  if (Math.abs(diff) > 1.25) throttle = speedFactor * 0.3;

  // Wedged? Reverse with opposite lock for a moment.
  if (car.reverseT > 0) {
    car.reverseT -= dt;
    throttle = -0.7;
    steer = -steer;
  } else if (Math.abs(car.speed) < 9 && throttle > 0.2) {
    car.stuckT += dt;
    if (car.stuckT > 0.85) {
      car.reverseT = 0.55;
      car.stuckT = 0;
    }
  } else {
    car.stuckT = Math.max(0, car.stuckT - dt * 2);
  }

  if (brakeForTraffic && car.reverseT <= 0) {
    const fx = car.x + Math.cos(car.angle) * 44;
    const fy = car.y + Math.sin(car.angle) * 44;
    for (const other of G.cars) {
      if (other === car) continue;
      const ox = other.x - fx;
      const oy = other.y - fy;
      if (ox * ox + oy * oy < 30 * 30) {
        throttle = car.speed > 40 ? -0.55 : 0;
        break;
      }
    }
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      const ox = ped.x - fx;
      const oy = ped.y - fy;
      if (ox * ox + oy * oy < 24 * 24) {
        throttle = car.speed > 30 ? -0.6 : 0;
        break;
      }
    }
  }

  stepCarPhysics(G, car, throttle, steer, dt);
  return dist;
}

/** Lane-corrected copy of a centreline route. */
function laneRoute(x0, y0, x1, y1, acrossFirst) {
  const raw = planRoute(x0, y0, x1, y1, acrossFirst);
  const out = [];
  let px = x0;
  let py = y0;
  for (const p of raw) {
    const hx = Math.sign(p.x - px);
    const hy = Math.sign(p.y - py);
    if (hx !== 0 || hy !== 0) {
      const o = laneOffset(hx, hy);
      out.push({ x: p.x + o.x, y: p.y + o.y });
    } else {
      out.push({ x: p.x, y: p.y });
    }
    px = p.x;
    py = p.y;
  }
  return out;
}

function giveRoute(G, car) {
  const target = randomIntersection(G.rng);
  car.route = laneRoute(car.x, car.y, target.x, target.y, G.rng() < 0.5);
  car.routeIndex = 0;
}

export function initTraffic(G) {
  for (let i = 0; i < MOVING_TRAFFIC; i += 1) {
    const spot = randomIntersection(G.rng);
    const car = randomTrafficCar(G.rng, spot.x, spot.y, 0);
    car.driver = 'traffic';
    // Settle the car onto a lane beside the intersection.
    const east = G.rng() < 0.5;
    const o = east ? laneOffset(1, 0) : laneOffset(0, 1);
    car.x += o.x;
    car.y += o.y;
    car.angle = east ? 0 : Math.PI / 2;
    giveRoute(G, car);
    G.cars.push(car);
  }
  for (let i = 0; i < PARKED_CARS; i += 1) {
    const c = Math.floor(G.rng() * COLS);
    const r = Math.floor(G.rng() * ROWS);
    const { x, y } = blockOrigin(c, r);
    const side = Math.floor(G.rng() * 4);
    let px = x;
    let py = y;
    let angle = 0;
    const along = randRange(G.rng, 20, 140);
    if (side === 0) { px = x + along; py = y - 13; angle = 0; }
    if (side === 1) { px = x + along; py = y + 160 + 13; angle = Math.PI; }
    if (side === 2) { px = x - 13; py = y + along; angle = Math.PI / 2; }
    if (side === 3) { px = x + 160 + 13; py = y + along; angle = -Math.PI / 2; }
    const car = randomTrafficCar(G.rng, px, py, angle);
    car.driver = null;
    car.parked = true;
    G.cars.push(car);
  }
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    if (car.dead) continue;
    if (!car.route || car.routeIndex >= car.route.length) giveRoute(G, car);
    const wp = car.route[car.routeIndex];
    const dist = driveCarToward(G, car, wp.x, wp.y, dt, 0.52, true);
    if (dist < 20) car.routeIndex += 1;
    if (car.routeIndex >= car.route.length) {
      const near = nearestIntersection(car.x, car.y);
      if (Math.abs(car.x - near.x) + Math.abs(car.y - near.y) > 30) giveRoute(G, car);
    }
  }
}
