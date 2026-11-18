// roads.js — Coral Bay's street grid: sixteen avenues west to east, twelve
// streets north to south, right-hand traffic on offset lanes. Every driver in
// the city — traffic, police, Marco — steers by the centrelines defined here.

export const COLS = 16;
export const ROWS = 12;
export const PITCH = 224;
export const ROAD_W = 64;
export const BLOCK = 160;
export const LANE = 15;
export const WORLD_W = ROAD_W + COLS * PITCH;
export const WORLD_H = ROAD_W + ROWS * PITCH;

/** Centreline x of vertical avenue i (0..COLS). */
export function vRoadX(i) {
  return ROAD_W / 2 + i * PITCH;
}

/** Centreline y of horizontal street j (0..ROWS). */
export function hRoadY(j) {
  return ROAD_W / 2 + j * PITCH;
}

/** Top-left corner of the city block in column c, row r. */
export function blockOrigin(c, r) {
  return { x: ROAD_W + c * PITCH, y: ROAD_W + r * PITCH };
}

/** Which block column/row a world point falls in (clamped to the grid). */
export function blockAt(x, y) {
  const c = Math.min(COLS - 1, Math.max(0, Math.floor((x - ROAD_W) / PITCH)));
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor((y - ROAD_W) / PITCH)));
  return { c, r };
}

/** True when the point sits on asphalt (within a road strip). */
export function isOnRoad(x, y) {
  const lx = ((x % PITCH) + PITCH) % PITCH;
  const ly = ((y % PITCH) + PITCH) % PITCH;
  return lx < ROAD_W || ly < ROAD_W;
}

/** The intersection nearest a point, as grid indices and world position. */
export function nearestIntersection(x, y) {
  const i = Math.min(COLS, Math.max(0, Math.round((x - ROAD_W / 2) / PITCH)));
  const j = Math.min(ROWS, Math.max(0, Math.round((y - ROAD_W / 2) / PITCH)));
  return { i, j, x: vRoadX(i), y: hRoadY(j) };
}

export function randomIntersection(rng) {
  const i = Math.floor(rng() * (COLS + 1));
  const j = Math.floor(rng() * (ROWS + 1));
  return { i, j, x: vRoadX(i), y: hRoadY(j) };
}

/**
 * The lane offset for a heading: right-hand traffic means a driver keeps to
 * the right of the centreline. On screen (y down), the right of heading
 * (hx, hy) is (-hy, hx): eastbound drives south of the centreline, westbound
 * north, southbound west and northbound east.
 */
export function laneOffset(hx, hy) {
  return { x: -hy * LANE, y: hx * LANE };
}

/** Point on the correct lane of the road through (cx, cy) for a heading. */
export function lanePoint(cx, cy, hx, hy) {
  const o = laneOffset(hx, hy);
  return { x: cx + o.x, y: cy + o.y };
}

/**
 * A Manhattan route between two points along the centrelines: across to the
 * target avenue, then along to the target street (or the other order, chosen
 * by the caller). Returns waypoints excluding the start.
 */
export function planRoute(x0, y0, x1, y1, acrossFirst) {
  const a = nearestIntersection(x0, y0);
  const b = nearestIntersection(x1, y1);
  const points = [];
  if (acrossFirst) {
    points.push({ x: b.x, y: a.y });
    points.push({ x: b.x, y: b.y });
  } else {
    points.push({ x: a.x, y: b.y });
    points.push({ x: b.x, y: b.y });
  }
  points.push({ x: x1, y: y1 });
  return points;
}
