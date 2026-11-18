// save.js — Marco's story persists in localStorage: cash, respect, the mission
// chain position, health and where he woke up. Saving is best-effort: a
// browser that refuses storage simply starts him fresh each visit.

const SAVE_KEY = 'coral-bay-heat.save.v1';

export function defaultSave() {
  return {
    version: 1,
    cash: 60,
    respect: 0,
    missionIndex: 0,
    missionsDone: false,
    hp: 100,
    ammoReserve: 24,
    playerX: 0,
    playerY: 0,
    playSeconds: 0,
    carsSold: 0,
    thugsDown: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return Object.assign(defaultSave(), data);
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function storeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    /* storage unavailable: nothing to clear */
  }
}

/** Snapshot the parts of the live game the save file promises to keep. */
export function snapshotOf(G) {
  const p = G.player;
  return {
    version: 1,
    cash: Math.round(p.cash),
    respect: p.respect,
    missionIndex: G.missions.index,
    missionsDone: G.missions.done,
    hp: Math.max(10, Math.round(p.hp)),
    ammoReserve: p.ammoReserve,
    playerX: Math.round(p.x),
    playerY: Math.round(p.y),
    playSeconds: Math.round(G.time),
    carsSold: G.stats.carsSold,
    thugsDown: G.stats.thugsDown,
  };
}
