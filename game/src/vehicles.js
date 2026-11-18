// vehicles.js — the seven shapes of Coral Bay traffic, from the humble Pico
// compact to the Vireo GT every wheelman dreams about, plus the CBPD
// Interceptor. One arcade physics step drives them all: throttle, steering
// that bites harder at speed, and bodywork that remembers every crash.

import { resolveCircle } from './city.js';

export const CAR_TYPES = {
  compact: { label: 'Pico Compact', maxSpeed: 305, accel: 215, grip: 2.1, len: 34, wid: 17, value: 90, toughness: 70 },
  sedan: { label: 'Meridian Sedan', maxSpeed: 345, accel: 235, grip: 2.0, len: 38, wid: 18, value: 140, toughness: 85 },
  taxi: { label: 'Coral Cab', maxSpeed: 340, accel: 230, grip: 2.0, len: 38, wid: 18, value: 130, toughness: 85 },
  suv: { label: 'Bison SUV', maxSpeed: 322, accel: 205, grip: 1.8, len: 40, wid: 20, value: 210, toughness: 120 },
  pickup: { label: 'Hauler Pickup', maxSpeed: 312, accel: 208, grip: 1.8, len: 40, wid: 19, value: 180, toughness: 115 },
  sport: { label: 'Vireo GT', maxSpeed: 478, accel: 335, grip: 2.3, len: 38, wid: 18, value: 420, toughness: 75 },
  interceptor: { label: 'CBPD Interceptor', maxSpeed: 438, accel: 322, grip: 2.25, len: 39, wid: 18, value: 0, toughness: 130 },
};

export const TRAFFIC_TYPES = ['compact', 'sedan', 'sedan', 'taxi', 'suv', 'pickup', 'compact'];
const TRAFFIC_COLORS = ['#d94f3d', '#3d7bd9', '#e8e4da', '#57a773', '#e0a81c', '#7a5fa0', '#4fb3bf', '#c0c6cc', '#8a4b2a', '#2e4a5a'];

let nextCarId = 1;

export function makeCar(type, x, y, angle, color) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId++,
    type,
    spec,
    x, y, angle,
    speed: 0,
    steer: 0,
    color: color || '#c0c6cc',
    health: 100,
    dead: false,
    driver: null, // null | 'traffic' | 'police' | 'player'
    route: null,
    stuckT: 0,
    reverseT: 0,
    alarmT: 0,
    ownedByPlayer: false,
    flashT: 0,
    smokeT: 0,
  };
}

export function randomTrafficCar(rng, x, y, angle) {
  const type = TRAFFIC_TYPES[Math.floor(rng() * TRAFFIC_TYPES.length) % TRAFFIC_TYPES.length];
  const color = type === 'taxi' ? '#f2b705' : TRAFFIC_COLORS[Math.floor(rng() * TRAFFIC_COLORS.length) % TRAFFIC_COLORS.length];
  return makeCar(type, x, y, angle, color);
}

/**
 * One arcade physics step. throttle -1..1 (negative reverses), steer -1..1.
 * Returns the impact speed when the car struck a building this step, else 0.
 */
export function stepCarPhysics(G, car, throttle, steer, dt) {
  const spec = car.spec;
  if (car.dead) {
    car.speed *= Math.max(0, 1 - 3 * dt);
    return 0;
  }
  const maxRev = -spec.maxSpeed * 0.34;
  if (throttle > 0) {
    car.speed += spec.accel * throttle * dt * (car.speed < 0 ? 2.2 : 1);
  } else if (throttle < 0) {
    car.speed += spec.accel * throttle * dt * (car.speed > 0 ? 2.4 : 0.8);
  } else {
    car.speed -= car.speed * 0.55 * dt;
  }
  car.speed -= car.speed * Math.abs(car.speed) * 0.00035 * dt * 60 * 0.016;
  if (car.speed > spec.maxSpeed) car.speed = spec.maxSpeed;
  if (car.speed < maxRev) car.speed = maxRev;
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;

  const speedRatio = car.speed / spec.maxSpeed;
  car.steer = steer;
  car.angle += steer * spec.grip * speedRatio * dt * 1.65 * (car.speed < 0 ? -1 : 1);

  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.x += vx * dt;
  car.y += vy * dt;

  const before = Math.abs(car.speed);
  const hit = { depth: 0, nx: 0, ny: 0 };
  const collided = resolveCircle(G.city, car, car.spec.wid * 0.92, hit);
  if (collided && before > 55) {
    const impact = before * Math.min(1, hit.depth / 8 + 0.35);
    damageCar(G, car, impact * 0.055, 'crash');
    car.speed = -car.speed * 0.28;
    return impact;
  }
  if (collided) car.speed *= 0.82;
  return 0;
}

export function damageCar(G, car, amount, cause) {
  if (car.dead) return;
  car.health -= amount;
  car.flashT = 0.08;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.speed = 0;
    G.fx.burst(car.x, car.y, 16, '#555c60', 90, 0.5);
    G.fx.burst(car.x, car.y, 10, '#e07b39', 70, 0.35);
    if (cause) G.onCarDestroyed(car, cause);
  }
}

/** Simple pairwise separation and damage for every car in the world. */
export function collideCars(G, dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minD = (a.spec.wid + b.spec.wid) * 0.95;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const relSpeed = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.2;
      if (relSpeed > 60) {
        damageCar(G, a, relSpeed * 0.03, 'crash');
        damageCar(G, b, relSpeed * 0.03, 'crash');
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        G.fx.burst(cx, cy, 6, '#ffd76a', 80, 0.25);
        G.onCarsCollided(a, b, relSpeed);
        const swap = (a.speed + b.speed) / 2;
        a.speed = swap * 0.6;
        b.speed = swap * 0.6;
      }
    }
  }
}

/** Draw one car: shadow, body, cabin, wheels, livery and damage smoke. */
export function drawCar(ctx, G, car) {
  const spec = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = spec.len;
  const W = spec.wid;
  ctx.fillStyle = 'rgba(20, 24, 28, 0.3)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  ctx.fillStyle = car.dead ? '#3c4145' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 5);
  ctx.fill();
  if (car.flashT > 0) {
    ctx.fillStyle = 'rgba(255, 240, 200, 0.55)';
    roundRect(ctx, -L / 2, -W / 2, L, W, 5);
    ctx.fill();
  }
  // Cabin and glass.
  ctx.fillStyle = car.dead ? '#24282b' : '#20303c';
  roundRect(ctx, -L * 0.16, -W / 2 + 3, L * 0.36, W - 6, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 210, 235, 0.5)';
  roundRect(ctx, L * 0.13, -W / 2 + 3.5, L * 0.07, W - 7, 2);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14161a';
  const ww = 6;
  const wh = 3.4;
  ctx.fillRect(-L / 2 + 4, -W / 2 - 1.6, ww, wh);
  ctx.fillRect(-L / 2 + 4, W / 2 - 1.8, ww, wh);
  ctx.fillRect(L / 2 - 10, -W / 2 - 1.6, ww, wh);
  ctx.fillRect(L / 2 - 10, W / 2 - 1.8, ww, wh);
  if (car.type === 'taxi') {
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-4, -3, 8, 6);
    ctx.fillStyle = '#f7f3e8';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2);
  }
  if (car.type === 'interceptor') {
    ctx.fillStyle = '#f4f6f8';
    roundRect(ctx, -L * 0.3, -W / 2, L * 0.24, W, 3);
    ctx.fill();
    ctx.fillStyle = '#20303c';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CBPD', -L * 0.18, 2.2);
    const phase = Math.floor(G.time * 6) % 2;
    ctx.fillStyle = phase === 0 ? '#ff4040' : '#ffd0d0';
    ctx.fillRect(-3, -W / 2 + 2, 5, 3.4);
    ctx.fillStyle = phase === 0 ? '#bcd6ff' : '#3d7bd9';
    ctx.fillRect(2.5, -W / 2 + 2, 5, 3.4);
    ctx.fillStyle = phase === 0 ? '#ff4040' : '#3d7bd9';
    ctx.fillRect(-3, W / 2 - 5.4, 5, 3.4);
    ctx.fillStyle = phase === 0 ? '#bcd6ff' : '#ff4040';
    ctx.fillRect(2.5, W / 2 - 5.4, 5, 3.4);
  }
  if (car.type === 'sport') {
    ctx.fillStyle = 'rgba(20, 20, 24, 0.85)';
    ctx.fillRect(-L / 2 + 1, -W / 2 + 2, 4, W - 4);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(L / 2 - 3, -W / 2 + 3, 2.4, 3);
    ctx.fillRect(L / 2 - 3, W / 2 - 6, 2.4, 3);
  }
  // Headlights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(L / 2 - 1.6, -W / 2 + 2, 1.8, 3);
  ctx.fillRect(L / 2 - 1.6, W / 2 - 5, 1.8, 3);
  ctx.restore();

  if (!car.dead && car.health < 45) {
    car.smokeT -= 0.016;
    if (car.smokeT <= 0) {
      car.smokeT = 0.14;
      G.fx.smoke(car.x + Math.cos(car.angle) * spec.len * 0.3, car.y + Math.sin(car.angle) * spec.len * 0.3);
    }
  }
  if (car.alarmT > 0 && Math.floor(G.time * 5) % 2 === 0) {
    ctx.save();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(car.x, car.y - 20, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
