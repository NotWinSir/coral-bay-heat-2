// render.js — Coral Bay on canvas: sun-bleached blocks and pastel towers,
// asphalt with worn centrelines, palms, the teal bay along the south edge,
// and everything alive in it. Pure top-down with fake-height shadows so the
// towers lean their shade across the street.

import { WATER_Y } from './city.js';
import { COLS, ROWS, PITCH, ROAD_W, WORLD_W, WORLD_H, vRoadX, hRoadY, blockOrigin } from './roads.js';
import { drawCar } from './vehicles.js';
import { drawPed } from './pedestrians.js';
import { drawPlayer } from './player.js';
import { drawThug, drawPickup } from './combat.js';

const ASPHALT = '#43484e';
const ASPHALT_DARK = '#3a3f45';
const SIDEWALK = '#c9c2b2';
const BLOCK_GROUND = '#b3ab97';
const PARK_GREEN = '#79a85b';

function visibleRect(G) {
  return {
    x0: G.camera.x - 40, y0: G.camera.y - 40,
    x1: G.camera.x + 1320, y1: G.camera.y + 760,
  };
}

function drawGround(ctx, G, v) {
  ctx.fillStyle = BLOCK_GROUND;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  // Block pavements.
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const { x, y } = blockOrigin(c, r);
      if (x > v.x1 || y > v.y1 || x + 160 < v.x0 || y + 160 < v.y0) continue;
      ctx.fillStyle = SIDEWALK;
      ctx.fillRect(x - 5, y - 5, 170, 170);
      ctx.fillStyle = BLOCK_GROUND;
      ctx.fillRect(x, y, 160, 160);
    }
  }
  for (const park of G.city.parks) {
    if (park.x > v.x1 || park.y > v.y1 || park.x + 160 < v.x0 || park.y + 160 < v.y0) continue;
    ctx.fillStyle = PARK_GREEN;
    ctx.fillRect(park.x, park.y, 160, 160);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.fillRect(park.x + 14, park.y + 66, 132, 26);
    ctx.fillRect(park.x + 66, park.y + 14, 26, 132);
  }
}

function drawRoads(ctx, G, v) {
  ctx.fillStyle = ASPHALT;
  for (let i = 0; i <= COLS; i += 1) {
    const x = vRoadX(i) - ROAD_W / 2;
    if (x + ROAD_W < v.x0 || x > v.x1) continue;
    ctx.fillRect(x, Math.max(0, v.y0), ROAD_W, Math.min(WORLD_H, v.y1) - Math.max(0, v.y0));
  }
  for (let j = 0; j <= ROWS; j += 1) {
    const y = hRoadY(j) - ROAD_W / 2;
    if (y + ROAD_W < v.y0 || y > v.y1) continue;
    ctx.fillRect(Math.max(0, v.x0), y, Math.min(WORLD_W, v.x1) - Math.max(0, v.x0), ROAD_W);
  }
  // Worn centreline dashes.
  ctx.fillStyle = 'rgba(240, 225, 160, 0.55)';
  for (let i = 0; i <= COLS; i += 1) {
    const x = vRoadX(i);
    if (x < v.x0 || x > v.x1) continue;
    for (let y = 10; y < WORLD_H; y += 46) {
      if (y > v.y0 - 30 && y < v.y1) ctx.fillRect(x - 1.4, y, 2.8, 24);
    }
  }
  for (let j = 0; j <= ROWS; j += 1) {
    const y = hRoadY(j);
    if (y < v.y0 || y > v.y1) continue;
    for (let x = 10; x < WORLD_W; x += 46) {
      if (x > v.x0 - 30 && x < v.x1) ctx.fillRect(x, y - 1.4, 24, 2.8);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(235, 238, 240, 0.5)';
  for (let i = 0; i <= COLS; i += 1) {
    for (let j = 0; j <= ROWS; j += 1) {
      const x = vRoadX(i);
      const y = hRoadY(j);
      if (x < v.x0 - 40 || x > v.x1 + 40 || y < v.y0 - 40 || y > v.y1 + 40) continue;
      for (let s = -24; s <= 24; s += 12) {
        ctx.fillRect(x + s - 3, y - ROAD_W / 2 + 3, 6, 9);
        ctx.fillRect(x + s - 3, y + ROAD_W / 2 - 12, 6, 9);
      }
    }
  }
}

function drawWater(ctx, G, v) {
  if (v.y1 < WATER_Y) return;
  const grad = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_H);
  grad.addColorStop(0, '#3fa7a0');
  grad.addColorStop(1, '#1f6f8b');
  ctx.fillStyle = grad;
  ctx.fillRect(Math.max(0, v.x0), WATER_Y, Math.min(WORLD_W, v.x1) - Math.max(0, v.x0), WORLD_H - WATER_Y);
  ctx.fillStyle = '#e8d9a8';
  ctx.fillRect(Math.max(0, v.x0), WATER_Y - 7, Math.min(WORLD_W, v.x1) - Math.max(0, v.x0), 8);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const off = (G.time * 22) % 64;
  for (let x = Math.floor(v.x0 / 64) * 64 - 64; x < v.x1; x += 64) {
    for (let y = WATER_Y + 16; y < WORLD_H - 8; y += 26) {
      ctx.moveTo(x + off * ((y / 26) % 2 ? 1 : -1) * 0.4, y);
      ctx.lineTo(x + 20 + off * ((y / 26) % 2 ? 1 : -1) * 0.4, y);
    }
  }
  ctx.stroke();
  ctx.fillStyle = '#8a6d4f';
  for (const dock of G.city.docks) ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
}

function drawBuilding(ctx, b, time) {
  const shX = b.hgt * 0.16;
  const shY = b.hgt * 0.12;
  ctx.fillStyle = 'rgba(24, 26, 30, 0.28)';
  ctx.fillRect(b.x + shX, b.y + shY, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const inset = Math.min(9, b.w * 0.14, b.h * 0.14);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
  // Roof clutter, stable per building.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  const n = (b.id % 3) + 1;
  for (let i = 0; i < n; i += 1) {
    const rx = b.x + inset + 6 + ((b.id * 37 + i * 53) % Math.max(10, b.w - inset * 2 - 26));
    const ry = b.y + inset + 6 + ((b.id * 61 + i * 29) % Math.max(10, b.h - inset * 2 - 20));
    ctx.fillRect(rx, ry, 13, 9);
  }
  // Lit windows along the top edge.
  ctx.fillStyle = 'rgba(255, 244, 190, 0.75)';
  const cols = Math.floor(b.w / 17);
  for (let i = 0; i < cols; i += 1) {
    if ((b.id * 7 + i * 13) % 5 === 0) continue;
    ctx.fillRect(b.x + 6 + i * 17, b.y + 3.4, 7, 3);
  }
  if (b.poi) {
    ctx.fillStyle = 'rgba(16, 20, 24, 0.82)';
    const label = b.name.toUpperCase();
    ctx.font = 'bold 10px sans-serif';
    const w = ctx.measureText(label).width + 14;
    ctx.fillRect(b.x + b.w / 2 - w / 2, b.y - 15, w, 14);
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2, b.y - 4.4);
  }
}

function drawPalmsAndLamps(ctx, G, v) {
  for (const palm of G.city.palms) {
    if (palm.x < v.x0 || palm.x > v.x1 || palm.y < v.y0 || palm.y > v.y1) continue;
    ctx.strokeStyle = '#7a5a36';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 2, palm.y - 4);
    ctx.stroke();
    ctx.strokeStyle = '#3e7d3a';
    ctx.lineWidth = 1.8;
    const sway = Math.sin(G.time * 1.3 + palm.x) * 0.06;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + sway;
      ctx.beginPath();
      ctx.moveTo(palm.x + 2, palm.y - 4);
      ctx.quadraticCurveTo(
        palm.x + 2 + Math.cos(a) * 7 * palm.s,
        palm.y - 4 + Math.sin(a) * 7 * palm.s - 2,
        palm.x + 2 + Math.cos(a) * 11 * palm.s,
        palm.y - 4 + Math.sin(a) * 11 * palm.s + 2.4,
      );
      ctx.stroke();
    }
  }
  for (const lamp of G.city.lamps) {
    if (lamp.x < v.x0 || lamp.x > v.x1 || lamp.y < v.y0 || lamp.y > v.y1) continue;
    ctx.fillStyle = '#3c4145';
    ctx.fillRect(lamp.x - 1, lamp.y - 1, 2.4, 2.4);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawObjectiveMarker(ctx, G) {
  const obj = G.missions.objective;
  if (!obj || obj.radius <= 1) return;
  const pulse = 1 + Math.sin(G.time * 5) * 0.16;
  ctx.save();
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, obj.radius * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 215, 106, 0.9)';
  ctx.beginPath();
  ctx.moveTo(obj.x, obj.y - 52 - Math.sin(G.time * 5) * 4);
  ctx.lineTo(obj.x - 8, obj.y - 66 - Math.sin(G.time * 5) * 4);
  ctx.lineTo(obj.x + 8, obj.y - 66 - Math.sin(G.time * 5) * 4);
  ctx.closePath();
  ctx.fill();
  const grad = ctx.createLinearGradient(0, obj.y - 190, 0, obj.y);
  grad.addColorStop(0, 'rgba(255, 215, 106, 0)');
  grad.addColorStop(1, 'rgba(255, 215, 106, 0.20)');
  ctx.fillStyle = grad;
  ctx.fillRect(obj.x - 5, obj.y - 190, 10, 190);
  ctx.restore();
}

function drawPoiMarkers(ctx, G) {
  for (const poi of G.city.pois) {
    let color = null;
    if (poi.kind === 'hideout') color = '#8fe388';
    else if (poi.kind === 'chopshop') color = '#ffb35c';
    else if (poi.kind === 'cafe') color = '#ffd76a';
    if (!color) continue;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.65 + Math.sin(G.time * 3) * 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(poi.markerX, poi.markerY, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function renderWorld(ctx, G) {
  const v = visibleRect(G);
  const shX = G.shake ? (G.rng() - 0.5) * G.shake : 0;
  const shY = G.shake ? (G.rng() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.translate(-G.camera.x + shX, -G.camera.y + shY);

  drawGround(ctx, G, v);
  drawRoads(ctx, G, v);
  drawWater(ctx, G, v);
  drawPalmsAndLamps(ctx, G, v);

  const buildings = G.city.buildings.filter((b) => b.x < v.x1 && b.y < v.y1 && b.x + b.w > v.x0 && b.y + b.h > v.y0);
  buildings.sort((a, b) => a.y - b.y);
  for (const b of buildings) drawBuilding(ctx, b, G.time);

  drawPoiMarkers(ctx, G);
  drawObjectiveMarker(ctx, G);

  for (const pk of G.pickups) drawPickup(ctx, pk);
  for (const ped of G.peds) {
    if (ped.x > v.x0 - 30 && ped.x < v.x1 + 30 && ped.y > v.y0 - 30 && ped.y < v.y1 + 30) drawPed(ctx, ped);
  }
  for (const thug of G.thugs) drawThug(ctx, thug);

  const sortedCars = [...G.cars].sort((a, b) => a.y - b.y);
  for (const car of sortedCars) drawCar(ctx, G, car);
  drawPlayer(ctx, G);

  // Bullets and flashes.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const b of G.bullets) {
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  for (const fl of G.flashes) {
    ctx.save();
    ctx.translate(fl.x, fl.y);
    ctx.rotate(fl.angle);
    ctx.fillStyle = 'rgba(255, 205, 80, 0.95)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(13, -3.4);
    ctx.lineTo(9, 0);
    ctx.lineTo(13, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Particles and floaters.
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.6);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
