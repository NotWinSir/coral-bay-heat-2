// minimap.js — the whole of Coral Bay in the corner of the screen: streets,
// the bay, and the blips that matter — gold for the job, blue for the law,
// green for a safe bed, white for Marco himself.

import { WORLD_W, WORLD_H, vRoadX, hRoadY, COLS, ROWS } from './roads.js';
import { WATER_Y } from './city.js';
import { playerPos } from './player.js';

export const MAP_W = 218;
export const MAP_H = 164;

export function drawMinimap(ctx, G, x, y) {
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 18, 22, 0.78)';
  ctx.fillRect(x, y, MAP_W, MAP_H);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, MAP_W, MAP_H);

  // Streets.
  ctx.strokeStyle = 'rgba(200, 205, 210, 0.4)';
  ctx.beginPath();
  for (let i = 0; i <= COLS; i += 1) {
    ctx.moveTo(x + vRoadX(i) * sx, y);
    ctx.lineTo(x + vRoadX(i) * sx, y + MAP_H);
  }
  for (let j = 0; j <= ROWS; j += 1) {
    ctx.moveTo(x, y + hRoadY(j) * sy);
    ctx.lineTo(x + MAP_W, y + hRoadY(j) * sy);
  }
  ctx.stroke();
  // The bay.
  ctx.fillStyle = 'rgba(63, 167, 160, 0.55)';
  ctx.fillRect(x, y + WATER_Y * sy, MAP_W, MAP_H - WATER_Y * sy);

  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Places.
  for (const poi of G.city.pois) {
    if (poi.kind === 'cafe') dot(poi.markerX, poi.markerY, '#ffd76a', 3);
    else if (poi.kind === 'police') dot(poi.markerX, poi.markerY, '#6db3ff', 3);
    else if (poi.kind === 'hospital') dot(poi.markerX, poi.markerY, '#ffffff', 3);
    else if (poi.kind === 'chopshop') dot(poi.markerX, poi.markerY, '#ffb35c', 3);
    else if (poi.kind === 'hideout') dot(poi.markerX, poi.markerY, '#8fe388', 3);
    else if (poi.kind === 'marina') dot(poi.markerX, poi.markerY, '#7fe0d4', 3);
  }
  // The law.
  for (const cop of G.cops) {
    if (!cop.dead) dot(cop.x, cop.y, '#3d7bd9', 2.4);
  }
  // The job.
  const obj = G.missions.objective;
  if (obj && obj.radius > 1) {
    const pulse = 3 + Math.sin(G.time * 5) * 0.9;
    dot(obj.x, obj.y, '#ffd76a', pulse);
    ctx.strokeStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(x + obj.x * sx, y + obj.y * sy, pulse + 3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (!G.missions.active && !G.missions.done && G.missions.vera) {
    dot(G.missions.vera.x, G.missions.vera.y, '#ffd76a', 3 + Math.sin(G.time * 5) * 0.8);
  }
  // Marco.
  const pp = playerPos(G);
  ctx.save();
  ctx.translate(x + pp.x * sx, y + pp.y * sy);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-3.6, -3.2);
  ctx.lineTo(-3.6, 3.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
