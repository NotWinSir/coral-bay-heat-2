// pedestrians.js — forty-two Coral Bay locals walking the sidewalks: shoppers,
// joggers, a man who only ever walks his corner. They stroll between block
// corners, and they run — fast — from gunfire, crashes and speeding cars.

import { resolveCircle } from './city.js';
import { blockOrigin, COLS, ROWS } from './roads.js';
import { randRange, pick } from './rng.js';

export const PED_COUNT = 42;

const SKIN = ['#f2c79b', '#c68863', '#8a5a3b', '#f7d7b0', '#6e4530'];
const SHIRTS = ['#e2574c', '#4c8de2', '#57a773', '#e0a81c', '#e8e4da', '#7a5fa0', '#4fb3bf', '#ef8fb5'];
const PANTS = ['#2e3a46', '#5a4632', '#3c4145', '#704214', '#28418c'];

export function makePed(rng, x, y) {
  return {
    x, y,
    homeX: x, homeY: y,
    angle: rng() * Math.PI * 2,
    speed: 0,
    state: 'walk',
    tx: x, ty: y,
    waitT: randRange(rng, 0, 2),
    panicT: 0,
    fleeX: 0, fleeY: 0,
    hp: 20,
    skin: pick(rng, SKIN),
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    bob: rng() * 6,
    name: null,
    role: null,
  };
}

function sidewalkTarget(G, ped) {
  const c = Math.floor(G.rng() * COLS);
  const r = Math.floor(G.rng() * ROWS);
  const { x, y } = blockOrigin(c, r);
  const side = Math.floor(G.rng() * 4);
  const along = randRange(G.rng, 8, 152);
  if (side === 0) { ped.tx = x + along; ped.ty = y - 7; }
  if (side === 1) { ped.tx = x + along; ped.ty = y + 167; }
  if (side === 2) { ped.tx = x - 7; ped.ty = y + along; }
  if (side === 3) { ped.tx = x + 167; ped.ty = y + along; }
}

export function initPedestrians(G) {
  for (let i = 0; i < PED_COUNT; i += 1) {
    const c = Math.floor(G.rng() * COLS);
    const r = Math.floor(G.rng() * ROWS);
    const { x, y } = blockOrigin(c, r);
    const ped = makePed(G.rng, x + randRange(G.rng, -6, 166), y + randRange(G.rng, -6, 166));
    sidewalkTarget(G, ped);
    G.peds.push(ped);
  }
}

/** Something frightening happened at (x, y): nearby walkers run from it. */
export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      ped.state = 'panic';
      ped.panicT = randRange(G.rng, 1.6, 3.2);
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

export function updatePedestrians(G, dt) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    let targetSpeed = 0;
    let mx = 0;
    let my = 0;
    if (ped.state === 'panic') {
      ped.panicT -= dt;
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      mx = dx / d;
      my = dy / d;
      targetSpeed = 138;
      if (ped.panicT <= 0) {
        ped.state = ped.role ? 'stand' : 'walk';
        if (!ped.role) sidewalkTarget(G, ped);
      }
    } else if (ped.state === 'stand') {
      // Named locals keep their post; they only hurry home if scattered.
      const dx = ped.homeX - ped.x;
      const dy = ped.homeY - ped.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        mx = dx / d;
        my = dy / d;
        targetSpeed = 60;
      } else {
        ped.angle += Math.sin(G.time * 0.7 + ped.bob) * dt * 0.4;
      }
    } else {
      if (ped.waitT > 0) {
        ped.waitT -= dt;
      } else {
        const dx = ped.tx - ped.x;
        const dy = ped.ty - ped.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          ped.waitT = randRange(G.rng, 0.4, 3.4);
          sidewalkTarget(G, ped);
        } else {
          mx = dx / d;
          my = dy / d;
          targetSpeed = 52;
        }
      }
    }
    ped.speed += (targetSpeed - ped.speed) * Math.min(1, dt * 8);
    if (ped.speed > 1) ped.angle = Math.atan2(my, mx);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.bob += ped.speed * dt * 0.16;
    resolveCircle(G.city, ped, 7, null);
  }
}

export function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.pants;
    ctx.fillRect(-3, -2, 10, 4.4);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-8, -2.6, 6, 5.2);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(-10.5, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bobY = Math.sin(ped.bob * 2) * (ped.speed > 4 ? 0.8 : 0.2);
  ctx.fillStyle = 'rgba(20, 24, 28, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 3.4, 4.6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle + Math.PI / 2);
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-2.8, -1 + bobY * 0.4, 2.3, 5.4);
  ctx.fillRect(0.6, -1 - bobY * 0.4, 2.3, 5.4);
  ctx.fillStyle = ped.shirt;
  ctx.fillRect(-3.4, -5.4, 6.8, 5.6);
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -7.4, 2.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (ped.state === 'panic') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', ped.x, ped.y - 14);
  }
}
