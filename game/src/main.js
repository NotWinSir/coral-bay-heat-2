// main.js — Coral Bay Heat boots here: one canvas, a fixed 60 Hz heartbeat
// for the city, and the screen flow — title, the streets, pause, and the two
// ways a day ends early. Everything else lives in the modules beside this.

import { initInput, input, consumePress, endStepInput } from './input.js';
import { createWorld, stepWorld, applyBustedRecovery, applyWastedRecovery, VIEW_W, VIEW_H } from './world.js';
import { renderWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawBusted, drawWasted } from './hud.js';
import { loadSave, hasSave, clearSave } from './save.js';
import { stageShot, dressShot } from './shots.js';
import { resumeAudio, updateEngine, updateSiren, updateAudio, setMuted, sfx } from './audio.js';
import { nearestCopDist } from './police.js';

const STEP = 1 / 60;
const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

initInput(canvas);

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') || '7', 10) || 7;
const shotName = params.get('shot');

let G = createWorld(seed, shotName ? null : loadSave());
G.muted = false;

function newGame() {
  clearSave();
  G = createWorld(seed, null);
  G.muted = false;
  G.screen = 'play';
  sfx.uiPick();
}

function continueGame() {
  G = createWorld(seed, loadSave());
  G.muted = false;
  G.screen = 'play';
  sfx.uiPick();
}

// Screenshot staging: build the scene, play the real rules briefly, freeze.
let shotFrozen = false;
if (shotName) {
  G.screen = 'play';
  stageShot(G, shotName);
  for (let i = 0; i < 42; i += 1) {
    if (G.player.car && (shotName === 'cover' || shotName === 'chase')) {
      G.player.car.speed = Math.max(G.player.car.speed, shotName === 'cover' ? 225 : 272);
    }
    stepWorld(G, STEP);
  }
  dressShot(G, shotName);
  shotFrozen = true;
  window.__shotReady = true;
}

// A handle for automated playtests: the live world, honestly exposed.
window.__CBH = {
  get G() { return G; },
  newGame,
  continueGame,
  step: (n) => { for (let i = 0; i < (n || 1); i += 1) stepWorld(G, STEP); },
};

function toggleMute() {
  G.muted = !G.muted;
  setMuted(G.muted);
}

function advanceDialog() {
  if (!G.dialog) return;
  G.dialog.i += 1;
  sfx.talk();
  if (G.dialog.i >= G.dialog.lines.length) {
    const done = G.dialog.onDone;
    G.dialog = null;
    if (done) done();
  }
}

function clickRect(id) {
  const r = G.uiRects && G.uiRects[id];
  if (!r) return false;
  return input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h;
}

function handleFrameKeys() {
  if (consumePress('KeyM')) toggleMute();

  if (G.screen === 'title') {
    if (consumePress('Enter')) {
      if (hasSave()) continueGame();
      else newGame();
    } else if (consumePress('KeyN')) {
      newGame();
    } else if (input.mouseClicked) {
      if (clickRect('continue')) continueGame();
      else if (clickRect('new')) newGame();
      else if (clickRect('mute')) toggleMute();
    }
    return;
  }

  if (G.screen === 'busted' || G.screen === 'wasted') {
    if (consumePress('Enter')) {
      if (G.screen === 'busted') applyBustedRecovery(G);
      else applyWastedRecovery(G);
      G.screen = 'play';
    }
    return;
  }

  if (G.screen === 'pause') {
    if (consumePress('KeyP') || consumePress('Escape')) G.screen = 'play';
    if (consumePress('KeyS')) {
      G.saveGame();
      G.toast = { title: 'SAVED', text: 'Marco\u2019s story is on the shelf.', t: 1.6 };
      G.screen = 'play';
    }
    return;
  }

  // Play screen.
  if (G.dialog) {
    if (consumePress('KeyE') || consumePress('Enter') || input.mouseClicked) advanceDialog();
    return;
  }
  if (consumePress('KeyP') || consumePress('Escape')) {
    G.screen = 'pause';
    G.saveGame();
    return;
  }
  if (consumePress('KeyE') && G.interact) {
    const action = G.interact.action;
    G.interact = null;
    action();
  }
}

let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.12) dt = 0.12;
  acc += dt;

  G.aimWorld = { x: G.camera.x + input.mouseX, y: G.camera.y + input.mouseY };

  if (!shotFrozen) {
    handleFrameKeys();
    if (G.screen === 'play' && !G.dialog) {
      while (acc >= STEP) {
        stepWorld(G, STEP);
        acc -= STEP;
      }
    } else {
      acc = 0;
    }
  }

  renderWorld(ctx, G);
  if (G.screen === 'title') drawTitle(ctx, G, hasSave());
  else {
    drawHUD(ctx, G);
    if (G.screen === 'pause') drawPause(ctx, G);
    if (G.screen === 'busted') drawBusted(ctx, G);
    if (G.screen === 'wasted') drawWasted(ctx, G);
  }

  // Sound follows the street.
  const inCar = !!G.player.car;
  updateEngine(inCar ? G.player.car.speed / G.player.car.spec.maxSpeed : 0, inCar && G.screen === 'play');
  const copDist = nearestCopDist(G);
  updateSiren(G.wanted.stars > 0 && copDist < 560, Math.max(0, 0.11 - copDist / 560 * 0.08));
  updateAudio(dt, inCar);

  endStepInput();
}

window.addEventListener('pointerdown', resumeAudio, { once: false });
window.addEventListener('keydown', resumeAudio, { once: false });
requestAnimationFrame(frame);
