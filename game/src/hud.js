// hud.js — everything the player reads: cash and respect, health and heat,
// the job and how far it is, the speedometer, prompts, dialogs, district
// banners, and the full-screen faces of the game — title, pause, BUSTED,
// WASTED.

import { input } from './input.js';
import { playerPos, nearestEnterableCar } from './player.js';
import { rankFor, MISSION_DEFS } from './missions.js';
import { drawMinimap, MAP_W, MAP_H } from './minimap.js';
import { VIEW_W, VIEW_H } from './world.js';

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(10, 14, 18, ' + (alpha || 0.55) + ')';
  ctx.fillRect(x, y, w, h);
}

function stars(ctx, G, x, y) {
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < G.wanted.stars ? '#ffd76a' : 'rgba(255, 255, 255, 0.22)';
    ctx.fillText('★', x - (4 - i) * 22, y);
  }
  if (G.wanted.stars > 0 && G.wanted.lastSeenT > 3) {
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText('LOSING THEM…', x, y + 14);
  }
}

function healthBar(ctx, G, x, y, w) {
  const p = G.player;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x, y, w, 11);
  const frac = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = frac > 0.35 ? '#57c256' : '#e2574c';
  ctx.fillRect(x + 1.5, y + 1.5, (w - 3) * frac, 8);
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.fillText('HEALTH', x, y - 3);
}

function objectivePanel(ctx, G) {
  const M = G.missions;
  const pp = playerPos(G);
  let title = null;
  let text = null;
  let dist = null;
  if (M.active) {
    title = M.active.def.name.toUpperCase();
    if (M.objective) {
      text = M.objective.text;
      if (M.objective.radius > 1) dist = Math.hypot(pp.x - M.objective.x, pp.y - M.objective.y);
    }
  } else if (!M.done) {
    title = 'FREE ROAM';
    text = 'See Vera at Cafe Castellan — ' + MISSION_DEFS[M.index].name;
    if (M.vera) dist = Math.hypot(pp.x - M.vera.x, pp.y - M.vera.y);
  } else {
    title = 'FREE ROAM';
    text = 'The ledger is closed. Reyes Auto still buys hot cars.';
  }
  if (!text) return;
  ctx.font = 'bold 12px sans-serif';
  const w = Math.max(230, ctx.measureText(text).width + 26);
  panel(ctx, 16, 64, w, 44, 0.5);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText(title, 26, 80);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(text + (dist !== null ? '  ·  ' + Math.round(dist / 10) + 'm' : ''), 26, 99);
}

function drawEdgeBeacon(ctx, G) {
  const obj = G.missions.objective;
  if (!obj || obj.radius <= 1 || G.screen !== 'play') return;
  const pp = playerPos(G);
  const sx = pp.x - G.camera.x;
  const sy = pp.y - G.camera.y;
  const dx = obj.x - pp.x;
  const dy = obj.y - pp.y;
  if (Math.hypot(dx, dy) < 240) return;
  const angle = Math.atan2(dy, dx);
  const bx = Math.min(VIEW_W - 30, Math.max(30, sx + Math.cos(angle) * 300));
  const by = Math.min(VIEW_H - 30, Math.max(30, sy + Math.sin(angle) * 300));
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(255, 215, 106, 0.9)';
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHUD(ctx, G) {
  const p = G.player;
  // Cash and respect, top-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 25px sans-serif';
  ctx.fillText('$' + Math.round(p.cash).toLocaleString('en-US'), 18, 34);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('RESPECT ' + p.respect + '  ·  ' + rankFor(p.respect).toUpperCase(), 18, 53);

  // Heat and health, top-right.
  stars(ctx, G, VIEW_W - 18, 32);
  healthBar(ctx, G, VIEW_W - 190, 52, 172);

  objectivePanel(ctx, G);
  drawEdgeBeacon(ctx, G);

  // Minimap, bottom-right.
  drawMinimap(ctx, G, VIEW_W - MAP_W - 14, VIEW_H - MAP_H - 14);

  // Bottom-left: the wheel or the gun.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    panel(ctx, 14, VIEW_H - 84, 168, 70, 0.5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(kmh + '', 26, VIEW_H - 44);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('km/h', 26 + ctx.measureText(kmh + '').width + 34, VIEW_H - 44);
    ctx.font = '11px sans-serif';
    ctx.fillText(p.car.spec.label, 26, VIEW_H - 26);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(110, VIEW_H - 34, 58, 6);
    ctx.fillStyle = p.car.health > 35 ? '#57c256' : '#e2574c';
    ctx.fillRect(111, VIEW_H - 33, 56 * Math.max(0, p.car.health / 100), 4);
  } else {
    panel(ctx, 14, VIEW_H - 64, 168, 50, 0.5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('PISTOL', 26, VIEW_H - 40);
    ctx.font = 'bold 19px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = p.mag === 0 ? '#e2574c' : '#ffd76a';
    ctx.fillText(p.mag + ' / ' + p.ammoReserve, 170, VIEW_H - 40);
    ctx.textAlign = 'left';
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(p.reloadT > 0 ? 'RELOADING…' : 'R — reload', 26, VIEW_H - 24);
  }

  // District banner.
  if (G.banner) {
    const a = Math.min(1, G.banner.t / 0.8);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(G.banner.text, VIEW_W / 2, 92);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('C O R A L   B A Y', VIEW_W / 2, 112);
    ctx.restore();
  }

  // Toast (mission news).
  if (G.toast) {
    const a = Math.min(1, G.toast.t / 0.6);
    ctx.save();
    ctx.globalAlpha = a;
    const w = 430;
    panel(ctx, VIEW_W / 2 - w / 2, 128, w, 52, 0.62);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(G.toast.title, VIEW_W / 2, 148);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(G.toast.text, VIEW_W / 2, 168);
    ctx.restore();
  }

  // Bust meter.
  if (G.wanted.bust > 0.02) {
    const w = 260;
    panel(ctx, VIEW_W / 2 - w / 2, VIEW_H - 130, w, 30, 0.6);
    ctx.fillStyle = '#e2574c';
    ctx.fillRect(VIEW_W / 2 - w / 2 + 4, VIEW_H - 126, (w - 8) * Math.min(1, G.wanted.bust), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED METER — MOVE!', VIEW_W / 2, VIEW_H - 104);
  }

  // Prompts.
  if (G.screen === 'play' && !G.dialog) {
    let prompt = null;
    if (G.interact) prompt = '[E]  ' + G.interact.label;
    else if (!p.car) {
      const car = nearestEnterableCar(G, 38);
      if (car) prompt = '[F]  Drive the ' + car.spec.label;
      else if (G.missions.vera && Math.hypot(p.x - G.missions.vera.x, p.y - G.missions.vera.y) < 36 && G.missions.done) prompt = 'Vera: "The bay is yours, legend."';
    }
    if (prompt) {
      ctx.font = 'bold 14px sans-serif';
      const w = ctx.measureText(prompt).width + 30;
      panel(ctx, VIEW_W / 2 - w / 2, VIEW_H - 108, w, 30, 0.65);
      ctx.fillStyle = '#ffd76a';
      ctx.textAlign = 'center';
      ctx.fillText(prompt, VIEW_W / 2, VIEW_H - 88);
    }
  }

  // Dialog.
  if (G.dialog) {
    const line = G.dialog.lines[G.dialog.i];
    panel(ctx, 90, VIEW_H - 148, VIEW_W - 180, 92, 0.82);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(line.who.toUpperCase(), 112, VIEW_H - 122);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    wrapText(ctx, line.text, 112, VIEW_H - 98, VIEW_W - 224, 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('E ▸', VIEW_W - 112, VIEW_H - 66);
  }

  // Hurt vignette.
  if (p.hurtT > 0 || p.hp < 32) {
    const a = p.hurtT > 0 ? 0.28 : 0.16 + Math.sin(G.time * 4) * 0.05;
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    grad.addColorStop(0, 'rgba(180, 20, 20, 0)');
    grad.addColorStop(1, 'rgba(180, 20, 20, ' + a + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Crosshair.
  if (G.screen === 'play' && !p.car && !G.dialog) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(input.mouseX, input.mouseY, 7, 0, Math.PI * 2);
    ctx.moveTo(input.mouseX - 11, input.mouseY);
    ctx.lineTo(input.mouseX - 4, input.mouseY);
    ctx.moveTo(input.mouseX + 4, input.mouseY);
    ctx.lineTo(input.mouseX + 11, input.mouseY);
    ctx.moveTo(input.mouseX, input.mouseY - 11);
    ctx.lineTo(input.mouseX, input.mouseY - 4);
    ctx.moveTo(input.mouseX, input.mouseY + 4);
    ctx.lineTo(input.mouseX, input.mouseY + 11);
    ctx.stroke();
  }
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function bigOverlay(ctx, alpha) {
  ctx.fillStyle = 'rgba(8, 12, 16, ' + alpha + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function drawTitle(ctx, G, hasSaveFile) {
  bigOverlay(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText('W E L C O M E   T O', VIEW_W / 2, 196);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 74px sans-serif';
  ctx.fillText('CORAL BAY', VIEW_W / 2, 268);
  ctx.fillStyle = '#e2725b';
  ctx.font = 'bold 74px sans-serif';
  ctx.fillText('HEAT', VIEW_W / 2, 338);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '15px sans-serif';
  ctx.fillText('Marco Reyes owes the bay a debt. Five jobs stand between him and freedom.', VIEW_W / 2, 384);
  const opts = [];
  if (hasSaveFile) opts.push({ id: 'continue', label: 'CONTINUE  —  [Enter]' });
  opts.push({ id: 'new', label: hasSaveFile ? 'NEW GAME  —  [N]' : 'START  —  [Enter]' });
  opts.push({ id: 'mute', label: 'SOUND: ' + (G.muted ? 'OFF' : 'ON') + '  —  [M]' });
  G.uiRects = {};
  let y = 448;
  for (const opt of opts) {
    const w = 340;
    const x = VIEW_W / 2 - w / 2;
    panel(ctx, x, y - 24, w, 40, 0.7);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(opt.label, VIEW_W / 2, y + 3);
    G.uiRects[opt.id] = { x, y: y - 24, w, h: 40 };
    y += 54;
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD drive & walk · E talk and take · F enter cars · mouse aim, click shoot · R reload · Shift run · P pause', VIEW_W / 2, VIEW_H - 34);
}

export function drawPause(ctx, G) {
  bigOverlay(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 300);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('P — resume      M — sound ' + (G.muted ? 'off' : 'on') + '      S — save now', VIEW_W / 2, 344);
  ctx.fillText('Cash $' + Math.round(G.player.cash) + '  ·  Respect ' + G.player.respect + '  ·  Cars sold ' + G.stats.carsSold + '  ·  Vultures down ' + G.stats.thugsDown, VIEW_W / 2, 376);
}

export function drawBusted(ctx, G) {
  bigOverlay(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6db3ff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('BUSTED', VIEW_W / 2, 320);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('The CBPD take Marco in. The fine is 15% of his cash — Vera will hear about this.', VIEW_W / 2, 362);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Press ENTER', VIEW_W / 2, 404);
}

export function drawWasted(ctx, G) {
  bigOverlay(ctx, 0.66);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2574c';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('WASTED', VIEW_W / 2, 320);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Marco wakes at Coral Heights Hospital, 10% lighter and thoroughly lectured.', VIEW_W / 2, 362);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Press ENTER', VIEW_W / 2, 404);
}
