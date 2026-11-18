// combat.js — gunplay in Coral Bay: Marco's pistol against the Vultures.
// Mouse-aimed shots, muzzle flash, thugs who guard, strafe and fire in
// bursts, and the little envelopes of cash, health and ammunition the
// fallen leave behind.

import { input, justPressed } from './input.js';
import { circleHitsBuilding, resolveCircle, segmentBlocked } from './city.js';
import { playerPos } from './player.js';
import { damageCar } from './vehicles.js';
import { sfx } from './audio.js';
import { randRange } from './rng.js';

const BULLET_SPEED = 860;
const BULLET_RANGE = 560;

export function spawnThug(G, x, y, opts) {
  const boss = !!(opts && opts.boss);
  const thug = {
    x, y,
    postX: x, postY: y,
    angle: randRange(G.rng, 0, Math.PI * 2),
    hp: boss ? 240 : 45,
    maxHp: boss ? 240 : 45,
    boss,
    name: (opts && opts.name) || 'Vulture',
    group: (opts && opts.group) || 'ambient',
    state: 'guard',
    burstLeft: 0,
    shotT: randRange(G.rng, 0.4, 1.2),
    strafeDir: G.rng() < 0.5 ? -1 : 1,
    strafeT: randRange(G.rng, 0.8, 1.8),
    hurtT: 0,
    dead: false,
    bob: G.rng() * 6,
  };
  G.thugs.push(thug);
  return thug;
}

function fireBullet(G, x, y, angle, from, dmg) {
  G.bullets.push({
    x, y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: BULLET_RANGE / BULLET_SPEED,
    from,
    dmg,
  });
}

function tryPlayerShoot(G, dt) {
  const p = G.player;
  if (p.car || G.dialog) return;
  if (justPressed('KeyR') && p.mag < p.magSize && p.ammoReserve > 0 && p.reloadT <= 0) {
    p.reloadT = 0.9;
    sfx.reload();
  }
  if (!input.mouseDown) return;
  if (p.reloadT > 0 || p.fireCd > 0) return;
  if (p.mag <= 0) {
    p.fireCd = 0.3;
    sfx.dryFire();
    if (p.ammoReserve > 0) {
      p.reloadT = 0.9;
      sfx.reload();
    }
    return;
  }
  p.fireCd = 0.16;
  p.mag -= 1;
  const aim = G.aimWorld;
  const angle = Math.atan2(aim.y - p.y, aim.x - p.x) + randRange(G.rng, -0.012, 0.012);
  const mx = p.x + Math.cos(angle) * 13;
  const my = p.y + Math.sin(angle) * 13;
  fireBullet(G, mx, my, angle, 'player', 16);
  G.fx.muzzle(mx, my, angle);
  G.fx.burst(p.x + Math.cos(angle) * 8, p.y + Math.sin(angle) * 8, 1, '#ffe9a8', 30, 0.1);
  sfx.shot();
  G.shake = Math.min(3.5, G.shake + 0.7);
  if (G.time - (G.lastShotCrimeT || -9) > 1.1) {
    G.lastShotCrimeT = G.time;
    G.reportCrime('gunshot', p.x, p.y);
  }
}

function hurtPlayer(G, dmg, fromX, fromY) {
  const p = G.player;
  p.hp -= dmg;
  p.hurtT = 0.25;
  G.shake = Math.min(6, G.shake + 1.4);
  G.fx.burst(p.x, p.y, 4, '#c0392b', 60, 0.3);
  if (p.hp <= 0 && !p.dead) {
    p.hp = 0;
    G.onWasted();
  }
}

export function hurtThug(G, thug, dmg, angle) {
  thug.hp -= dmg;
  thug.hurtT = 0.18;
  thug.state = 'combat';
  G.fx.burst(thug.x, thug.y, 4, '#c0392b', 55, 0.3);
  thug.x += Math.cos(angle) * 2.4;
  thug.y += Math.sin(angle) * 2.4;
  sfx.hitFlesh();
  if (thug.hp <= 0 && !thug.dead) {
    thug.dead = true;
    G.stats.thugsDown += 1;
    G.reportCrime('murder', thug.x, thug.y);
    const roll = G.rng();
    if (thug.boss || roll < 0.5) dropPickup(G, thug.x, thug.y, 'cash', thug.boss ? 120 : 20 + Math.floor(G.rng() * 40));
    else if (roll < 0.75) dropPickup(G, thug.x, thug.y, 'ammo', 12);
    else dropPickup(G, thug.x, thug.y, 'health', 25);
    if (thug.boss) G.onBossDown(thug);
  }
}

export function dropPickup(G, x, y, kind, amount) {
  G.pickups.push({ x, y, kind, amount, t: 0 });
}

function updateBullets(G, dt) {
  const p = G.player;
  const pp = playerPos(G);
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (circleHitsBuilding(G.city, b.x, b.y, 3)) {
      G.fx.burst(b.x, b.y, 3, '#ffd76a', 50, 0.18);
      b.dead = true;
      continue;
    }
    if (b.from === 'player') {
      let consumed = false;
      for (const thug of G.thugs) {
        if (thug.dead) continue;
        const dx = thug.x - b.x;
        const dy = thug.y - b.y;
        if (dx * dx + dy * dy < 12 * 12) {
          hurtThug(G, thug, b.dmg, Math.atan2(b.vy, b.vx));
          consumed = true;
          break;
        }
      }
      if (!consumed) {
        for (const car of G.cars) {
          if (car.driver === 'player') continue;
          const dx = car.x - b.x;
          const dy = car.y - b.y;
          const rr = car.spec.wid + 6;
          if (dx * dx + dy * dy < rr * rr) {
            const wasAlive = !car.dead;
            damageCar(G, car, 7, 'shot');
            sfx.hitMetal();
            if (wasAlive && car.dead && car.driver === 'police') G.reportCrime('copkill', car.x, car.y);
            else if (wasAlive && car.dead) G.reportCrime('cardestroyed', car.x, car.y);
            consumed = true;
            break;
          }
        }
      }
      if (consumed) b.dead = true;
    } else {
      // Thug fire: it can chew the car Marco hides in, or Marco himself.
      if (p.car) {
        const dx = p.car.x - b.x;
        const dy = p.car.y - b.y;
        const rr = p.car.spec.wid + 7;
        if (dx * dx + dy * dy < rr * rr) {
          damageCar(G, p.car, 3.5, 'shot');
          if (G.rng() < 0.3) hurtPlayer(G, 3, b.x, b.y);
          b.dead = true;
        }
      } else {
        const dx = pp.x - b.x;
        const dy = pp.y - b.y;
        if (dx * dx + dy * dy < 11 * 11) {
          hurtPlayer(G, b.dmg, b.x, b.y);
          b.dead = true;
        }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
}

function updateThug(G, thug, dt) {
  if (thug.dead) return;
  const p = G.player;
  const pp = playerPos(G);
  thug.hurtT = Math.max(0, thug.hurtT - dt);
  const dx = pp.x - thug.x;
  const dy = pp.y - thug.y;
  const dist = Math.hypot(dx, dy);
  const canSee = dist < 300 && !segmentBlocked(G.city, thug.x, thug.y, pp.x, pp.y);

  if (thug.state === 'guard') {
    thug.angle = Math.atan2(Math.sin(thug.angle + dt * 0.3), Math.cos(thug.angle + dt * 0.3));
    if ((canSee && dist < 215) || G.aggroGroups.has(thug.group)) thug.state = 'combat';
    return;
  }

  // Combat: keep a firing distance, strafe, shoot in bursts.
  thug.angle = Math.atan2(dy, dx);
  let mx = 0;
  let my = 0;
  if (canSee || dist < 320) {
    thug.strafeT -= dt;
    if (thug.strafeT <= 0) {
      thug.strafeT = randRange(G.rng, 0.8, 1.9);
      thug.strafeDir *= -1;
    }
    const radial = dist > 195 ? 1 : dist < 115 ? -1 : 0;
    mx = (dx / (dist || 1)) * radial + (-dy / (dist || 1)) * thug.strafeDir * 0.7;
    my = (dy / (dist || 1)) * radial + (dx / (dist || 1)) * thug.strafeDir * 0.7;
    const ml = Math.hypot(mx, my) || 1;
    thug.x += (mx / ml) * 74 * dt;
    thug.y += (my / ml) * 74 * dt;
    thug.bob += dt * 7;
  }
  resolveCircle(G.city, thug, 9, null);

  thug.shotT -= dt;
  if (canSee && dist < 330 && thug.shotT <= 0) {
    if (thug.burstLeft <= 0) {
      thug.burstLeft = thug.boss ? 5 : 3;
      thug.shotT = randRange(G.rng, 0.85, 1.5);
    } else {
      thug.burstLeft -= 1;
      thug.shotT = 0.15;
      const spread = randRange(G.rng, -0.07, 0.07);
      const angle = Math.atan2(dy, dx) + spread;
      fireBullet(G, thug.x + Math.cos(angle) * 12, thug.y + Math.sin(angle) * 12, angle, 'thug', thug.boss ? 8 : 6.5);
      G.fx.muzzle(thug.x + Math.cos(angle) * 12, thug.y + Math.sin(angle) * 12, angle);
      sfx.enemyShot();
      if (G.rng() < 0.5) G.reportCrime('gunshot', thug.x, thug.y);
    }
  }
}

function updatePickups(G, dt) {
  const pp = playerPos(G);
  const p = G.player;
  for (const pk of G.pickups) {
    pk.t += dt;
    const dx = pp.x - pk.x;
    const dy = pp.y - pk.y;
    if (dx * dx + dy * dy < 20 * 20) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        p.cash += pk.amount;
        sfx.cash();
        G.fx.floater(pk.x, pk.y - 14, '+$' + pk.amount, '#8fe388');
      } else if (pk.kind === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + pk.amount);
        sfx.heal();
        G.fx.floater(pk.x, pk.y - 14, '+' + pk.amount + ' HP', '#ff9d9d');
      } else {
        p.ammoReserve += pk.amount;
        sfx.pickup();
        G.fx.floater(pk.x, pk.y - 14, '+' + pk.amount + ' ammo', '#ffd76a');
      }
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken && pk.t < 90);
}

export function updateCombat(G, dt) {
  tryPlayerShoot(G, dt);
  for (const thug of G.thugs) updateThug(G, thug, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
}

export function drawThug(ctx, thug) {
  ctx.save();
  ctx.translate(thug.x, thug.y);
  if (thug.dead) {
    ctx.rotate(1.35);
    ctx.fillStyle = '#4a2326';
    ctx.fillRect(-3, -2, 11, 4.6);
    ctx.fillStyle = '#33191d';
    ctx.fillRect(-9, -2.8, 6.4, 5.6);
    ctx.fillStyle = '#c68863';
    ctx.beginPath();
    ctx.arc(-11.5, 0, 2.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(20, 24, 28, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 3.6, 5.2, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(thug.angle + Math.PI / 2);
  const s = thug.boss ? 1.3 : 1;
  ctx.scale(s, s);
  const bobY = Math.sin(thug.bob * 2) * 0.7;
  ctx.fillStyle = '#1d1d22';
  ctx.fillRect(-3, -1 + bobY * 0.4, 2.4, 5.6);
  ctx.fillRect(0.8, -1 - bobY * 0.4, 2.4, 5.6);
  ctx.fillStyle = thug.hurtT > 0 ? '#e2574c' : (thug.boss ? '#6e1423' : '#8c1d2f');
  ctx.fillRect(-3.8, -5.6, 7.6, 5.8);
  ctx.fillStyle = '#c68863';
  ctx.beginPath();
  ctx.arc(0, -7.8, 3.1, 0, Math.PI * 2);
  ctx.fill();
  if (thug.boss) {
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(-2.6, -4.6, 5.2, 1.4);
  }
  ctx.fillStyle = '#15181c';
  ctx.fillRect(3.4, -8.6, 2, 6.4);
  ctx.restore();
  if (thug.boss && !thug.dead) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(thug.name.toUpperCase(), thug.x, thug.y - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(thug.x - 16, thug.y - 17, 32, 3.4);
    ctx.fillStyle = '#e2574c';
    ctx.fillRect(thug.x - 16, thug.y - 17, 32 * (thug.hp / thug.maxHp), 3.4);
  }
}

export function drawPickup(ctx, pk) {
  const bob = Math.sin(pk.t * 4) * 2;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  ctx.fillStyle = 'rgba(20, 24, 28, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 5 - bob, 6, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (pk.kind === 'cash') {
    ctx.fillStyle = '#2e7d46';
    ctx.fillRect(-6, -3.4, 12, 6.8);
    ctx.fillStyle = '#8fe388';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 2.6);
  } else if (pk.kind === 'health') {
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(-5.4, -5.4, 10.8, 10.8);
    ctx.fillStyle = '#d23b3b';
    ctx.fillRect(-1.6, -3.8, 3.2, 7.6);
    ctx.fillRect(-3.8, -1.6, 7.6, 3.2);
  } else {
    ctx.fillStyle = '#3c4145';
    ctx.fillRect(-5.4, -3.6, 10.8, 7.2);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(-3.4, -1.4, 2, 2.8);
    ctx.fillRect(0, -1.4, 2, 2.8);
    ctx.fillRect(3.4 - 2, -1.4, 2, 2.8);
  }
  ctx.restore();
}
