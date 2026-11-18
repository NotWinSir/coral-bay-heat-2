// city.js — Coral Bay itself: 16 by 12 blocks grown from a seed, pastel
// towers and low shops around eight named districts, seven landmarks that
// matter to Marco's story, palms on the corners and the bay along the south
// edge. Buildings are the city's colliders; everything solid lives here.

import { makeRng, pick, randInt, randRange, chance } from './rng.js';
import { COLS, ROWS, BLOCK, WORLD_W, WORLD_H, blockOrigin } from './roads.js';

export const WATER_Y = WORLD_H - 92;

export const DISTRICTS = [
  { name: 'Old Town', c0: 0, r0: 0, c1: 3, r1: 5 },
  { name: 'Downtown', c0: 4, r0: 0, c1: 7, r1: 5 },
  { name: 'Coral Heights', c0: 8, r0: 0, c1: 11, r1: 5 },
  { name: 'The Hills', c0: 12, r0: 0, c1: 15, r1: 5 },
  { name: 'Portside', c0: 0, r0: 6, c1: 3, r1: 11 },
  { name: 'Palm Row', c0: 4, r0: 6, c1: 7, r1: 11 },
  { name: 'Marina District', c0: 8, r0: 6, c1: 11, r1: 11 },
  { name: 'Midtown', c0: 12, r0: 6, c1: 15, r1: 11 },
];

// The seven places the story turns on. Block coordinates are fixed so the
// city always tells the same story; the door is where markers and prompts sit.
export const POI_DEFS = [
  { id: 'cafe', name: 'Cafe Castellan', kind: 'cafe', c: 5, r: 3, color: '#e2725b', roof: '#a34a3a' },
  { id: 'police', name: 'CBPD Central', kind: 'police', c: 8, r: 5, color: '#7f96ad', roof: '#4d6379' },
  { id: 'hospital', name: 'Coral Heights Hospital', kind: 'hospital', c: 10, r: 1, color: '#eef1f2', roof: '#b9c6cc' },
  { id: 'marina', name: 'Marina Cash Office', kind: 'marina', c: 9, r: 10, color: '#5b8e7d', roof: '#38604f' },
  { id: 'chopshop', name: 'Reyes Auto', kind: 'chopshop', c: 2, r: 8, color: '#c96f2e', roof: '#8a4a1d' },
  { id: 'motel', name: 'Motel Brisa', kind: 'hideout', c: 13, r: 9, color: '#d9a441', roof: '#9c7327' },
  { id: 'villa', name: 'Hillside Villa', kind: 'hideout', c: 14, r: 1, color: '#e8e3d8', roof: '#7d7466' },
];

const WALL_COLORS = ['#f2d5a0', '#f4b183', '#e88ca0', '#a8d5ba', '#9fc2e8', '#f7e8a4', '#d5a8e0', '#f0f0e6', '#ffb59e', '#bfe3dd'];
const ROOF_COLORS = ['#b5654d', '#8a6d4f', '#7d8590', '#a34a3a', '#5f7d95', '#94795d', '#6e5a7e', '#707a68'];

export function districtAt(x, y) {
  const c = Math.min(COLS - 1, Math.max(0, Math.floor((x - 64) / 224)));
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor((y - 64) / 224)));
  for (const d of DISTRICTS) {
    if (c >= d.c0 && c <= d.c1 && r >= d.r0 && r <= d.r1) return d;
  }
  return DISTRICTS[0];
}

function addBuilding(city, b) {
  b.id = city.buildings.length;
  city.buildings.push(b);
  const key = b.bc + ',' + b.br;
  if (!city.blockIndex.has(key)) city.blockIndex.set(key, []);
  city.blockIndex.get(key).push(b);
  return b;
}

function poiBlockKey(c, r) {
  return c + ',' + r;
}

export function generateCity(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const city = {
    seed,
    buildings: [],
    blockIndex: new Map(),
    parks: [],
    palms: [],
    lamps: [],
    pois: [],
    docks: [],
  };
  const poiBlocks = new Map();
  for (const def of POI_DEFS) poiBlocks.set(poiBlockKey(def.c, def.r), def);

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const { x, y } = blockOrigin(c, r);
      const def = poiBlocks.get(poiBlockKey(c, r));
      if (def) {
        const b = addBuilding(city, {
          x: x + 22, y: y + 26, w: BLOCK - 44, h: BLOCK - 62,
          hgt: def.kind === 'police' || def.kind === 'hospital' ? 54 : 30,
          color: def.color, roof: def.roof, bc: c, br: r, poi: def.id, name: def.name,
        });
        city.pois.push({
          ...def,
          building: b,
          doorX: x + BLOCK / 2,
          doorY: y + BLOCK - 14,
          markerX: x + BLOCK / 2,
          markerY: y + BLOCK + 26,
        });
        continue;
      }
      const roll = rng();
      if (roll < 0.1) {
        city.parks.push({ x, y, w: BLOCK, h: BLOCK, bc: c, br: r });
        for (let i = 0; i < 4; i += 1) {
          city.palms.push({ x: x + 24 + rng() * (BLOCK - 48), y: y + 24 + rng() * (BLOCK - 48), s: randRange(rng, 0.8, 1.25) });
        }
        continue;
      }
      if (roll < 0.42) {
        addBuilding(city, {
          x: x + 18, y: y + 18, w: BLOCK - 36, h: BLOCK - 36,
          hgt: randRange(rng, 46, 120), color: pick(rng, WALL_COLORS), roof: pick(rng, ROOF_COLORS), bc: c, br: r,
        });
      } else if (roll < 0.72) {
        addBuilding(city, {
          x: x + 14, y: y + 14, w: 66, h: 66, hgt: randRange(rng, 20, 44),
          color: pick(rng, WALL_COLORS), roof: pick(rng, ROOF_COLORS), bc: c, br: r,
        });
        addBuilding(city, {
          x: x + BLOCK - 80, y: y + BLOCK - 80, w: 66, h: 66, hgt: randRange(rng, 20, 44),
          color: pick(rng, WALL_COLORS), roof: pick(rng, ROOF_COLORS), bc: c, br: r,
        });
      } else {
        const spots = [
          { x: x + 12, y: y + 12 }, { x: x + BLOCK - 68, y: y + 12 },
          { x: x + 12, y: y + BLOCK - 68 }, { x: x + BLOCK - 68, y: y + BLOCK - 68 },
        ];
        for (const s of spots) {
          addBuilding(city, {
            x: s.x, y: s.y, w: 56, h: 56, hgt: randRange(rng, 14, 34),
            color: pick(rng, WALL_COLORS), roof: pick(rng, ROOF_COLORS), bc: c, br: r,
          });
        }
      }
      // Palms and lamps dress the sidewalks of ordinary blocks.
      if (chance(rng, 0.75)) city.palms.push({ x: x + 10, y: y + 10, s: randRange(rng, 0.75, 1.1) });
      if (chance(rng, 0.6)) city.palms.push({ x: x + BLOCK - 10, y: y + BLOCK - 10, s: randRange(rng, 0.75, 1.1) });
      if (chance(rng, 0.8)) city.lamps.push({ x: x + BLOCK - 8, y: y + 8 });
      if (chance(rng, 0.8)) city.lamps.push({ x: x + 8, y: y + BLOCK - 8 });
    }
  }

  // Marina docks reach into the bay along the south edge.
  for (let i = 0; i < 5; i += 1) {
    city.docks.push({ x: 1750 + i * 330, y: WATER_Y + 6, w: 130, h: 16 });
  }
  return city;
}

export function poiById(city, id) {
  return city.pois.find((p) => p.id === id) || null;
}

/** Buildings in the block under a point and its eight neighbours. */
export function buildingsNear(city, x, y) {
  const c = Math.floor((x - 64) / 224);
  const r = Math.floor((y - 64) / 224);
  const out = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const list = city.blockIndex.get((c + dc) + ',' + (r + dr));
      if (list) out.push(...list);
    }
  }
  return out;
}

/**
 * Push a circle out of every building it overlaps and out of the world edge.
 * Returns true when a push happened (a hit), with the hardest push in `hit`.
 */
export function resolveCircle(city, pos, radius, hit) {
  let collided = false;
  const list = buildingsNear(city, pos.x, pos.y);
  for (const b of list) {
    const nx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - nx;
    const dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    collided = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = radius - d;
      pos.x += (dx / d) * push;
      pos.y += (dy / d) * push;
      if (hit && push > hit.depth) { hit.depth = push; hit.nx = dx / d; hit.ny = dy / d; }
    } else {
      // Centre inside the box: leave by the shortest side.
      const left = pos.x - b.x;
      const right = b.x + b.w - pos.x;
      const top = pos.y - b.y;
      const bottom = b.y + b.h - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x - radius;
      else if (m === right) pos.x = b.x + b.w + radius;
      else if (m === top) pos.y = b.y - radius;
      else pos.y = b.y + b.h + radius;
      if (hit) hit.depth = radius;
    }
  }
  if (pos.x < radius) pos.x = radius;
  if (pos.y < radius) pos.y = radius;
  if (pos.x > WORLD_W - radius) pos.x = WORLD_W - radius;
  if (pos.y > WORLD_H - radius) pos.y = WORLD_H - radius;
  return collided;
}

/** True when a circle at (x, y) would overlap any building. */
export function circleHitsBuilding(city, x, y, radius) {
  const probe = { x, y };
  const list = buildingsNear(city, x, y);
  for (const b of list) {
    const nx = Math.max(b.x, Math.min(probe.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(probe.y, b.y + b.h));
    const dx = probe.x - nx;
    const dy = probe.y - ny;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/** Segment vs buildings, for sight lines and bullet travel. */
export function segmentBlocked(city, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (circleHitsBuilding(city, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3)) return true;
  }
  return false;
}
