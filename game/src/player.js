// player.js — Marco Reyes himself: an ex-wheelman on foot or behind a wheel.
// Walking, running, stealing cars (the driver usually gets out and runs),
// and the small business of getting back out again without clipping a wall.

import { moveAxes, held, consumePress, input } from './input.js';
import { resolveCircle, circleHitsBuilding } from './city.js';
import { stepCarPhysics } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { sfx } from './audio.js';

export function createPlayer(x, y) {
  return {
    name: 'Marco Reyes',
    x, y,
    angle: -Math.PI / 2,
    radius: 10,
    hp: 100,
    maxHp: 100,
    cash: 60,
    respect: 0,
    car: null,
    speedNow: 0,
    bob: 0,
    mag: 12,
    magSize: 12,
    ammoReserve: 24,
    reloadT: 0,
    fireCd: 0,
    hurtT: 0,
    stepT: 0,
  };
}

export function playerPos(G) {
  const p = G.player;
  if (p.car) return { x: p.car.x, y: p.car.y };
  return { x: p.x, y: p.y };
}

/** The car Marco could get into right now, if any. */
export function nearestEnterableCar(G, maxDist) {
  const p = G.player;
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of G.cars) {
    if (car.dead || car.driver === 'player' || car.driver === 'police') continue;
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // The driver bails out and runs for it.
    const driver = makePed(G.rng, car.x + 14, car.y + 10);
    driver.state = 'panic';
    driver.panicT = 3;
    driver.fleeX = p.x;
    driver.fleeY = p.y;
    G.peds.push(driver);
    G.reportCrime('cartheft', car.x, car.y);
  } else if (car.parked) {
    if (G.rng() < 0.55) {
      car.alarmT = 3.2;
      sfx.alarm();
      G.reportCrime('cartheft', car.x, car.y);
    }
  }
  car.driver = 'player';
  car.parked = false;
  car.route = null;
  p.car = car;
  sfx.door();
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  p.car = null;
  const sideA = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 24, y: car.y + Math.sin(car.angle + Math.PI / 2) * 24 };
  const sideB = { x: car.x - Math.cos(car.angle + Math.PI / 2) * 24, y: car.y - Math.sin(car.angle + Math.PI / 2) * 24 };
  const spot = !circleHitsBuilding(G.city, sideA.x, sideA.y, 11) ? sideA : sideB;
  p.x = spot.x;
  p.y = spot.y;
  sfx.door();
}

export function updatePlayer(G, dt) {
  const p = G.player;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const need = p.magSize - p.mag;
      const take = Math.min(need, p.ammoReserve);
      p.mag += take;
      p.ammoReserve -= take;
    }
  }

  if (p.car) {
    const car = p.car;
    let throttle = 0;
    let steer = 0;
    if (held('KeyW') || held('ArrowUp')) throttle = 1;
    if (held('KeyS') || held('ArrowDown')) throttle = -1;
    if (held('KeyA') || held('ArrowLeft')) steer = -1;
    if (held('KeyD') || held('ArrowRight')) steer = 1;
    if (held('Space')) {
      car.speed -= car.speed * 4.2 * dt;
      steer = steer * 1.4;
    }
    const impact = stepCarPhysics(G, car, throttle, steer, dt);
    if (impact > 130) {
      G.reportCrime('crash', car.x, car.y);
      G.scare(car.x, car.y, 190);
      sfx.crash(impact / 60);
      G.shake = Math.min(9, impact / 45);
    } else if (impact > 30) {
      sfx.crash(0.4);
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speedNow = Math.abs(car.speed);
    if (consumePress('KeyF') || consumePress('Enter')) exitCar(G);
    return;
  }

  // On foot.
  const axes = moveAxes();
  const running = held('ShiftLeft') || held('ShiftRight');
  const maxSpeed = running ? 216 : 148;
  let mx = axes.x;
  let my = axes.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.x += mx * maxSpeed * dt;
    p.y += my * maxSpeed * dt;
    p.speedNow = maxSpeed;
    p.bob += dt * (running ? 11 : 8.5);
    p.stepT -= dt;
    if (p.stepT <= 0) {
      p.stepT = running ? 0.3 : 0.38;
    }
  } else {
    p.speedNow = 0;
  }
  resolveCircle(G.city, p, p.radius, null);

  // Face the mouse when shooting or aiming; otherwise face the walk.
  const aim = G.aimWorld;
  if (input.mouseDown || p.reloadT > 0) {
    p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  } else if (len > 0) {
    p.angle = Math.atan2(my, mx);
  }

  const nearCar = nearestEnterableCar(G, 38);
  if (nearCar && (consumePress('KeyF') || consumePress('Enter'))) {
    enterCar(G, nearCar);
  }
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.car) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(20, 24, 28, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 3.6, 5.4, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle + Math.PI / 2);
  const bobY = Math.sin(p.bob * 2) * (p.speedNow > 4 ? 0.9 : 0.15);
  ctx.fillStyle = '#26313b';
  ctx.fillRect(-3, -1 + bobY * 0.4, 2.4, 5.6);
  ctx.fillRect(0.8, -1 - bobY * 0.4, 2.4, 5.6);
  ctx.fillStyle = p.hurtT > 0 ? '#e2574c' : '#0e7c86';
  ctx.fillRect(-3.8, -5.6, 7.6, 5.8);
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(0, -7.8, 3.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242a';
  ctx.fillRect(-3.1, -10.6, 6.2, 2.4);
  // Pistol in the lead hand.
  ctx.fillStyle = '#15181c';
  ctx.fillRect(3.4, -8.6, 2, 6.4);
  ctx.restore();
  if (p.reloadT > 0) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RELOADING', p.x, p.y - 18);
  }
}
