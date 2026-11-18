// input.js — keyboard and mouse for a wheelman: WASD/arrows to move and drive,
// E to talk, steal and collect, F or Enter to get in and out of cars, mouse to
// aim, click to shoot, R to reload, P or Esc for pause. Keys are tracked as
// held state plus an edge-triggered "pressed" set cleared every step.

export const input = {
  keys: new Set(),
  pressed: new Set(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  mouseClicked: false,
  wheel: 0,
};

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyR', 'KeyP',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Escape',
]);

export function initInput(canvas) {
  window.addEventListener('keydown', (ev) => {
    if (GAME_KEYS.has(ev.code)) ev.preventDefault();
    if (!ev.repeat) input.pressed.add(ev.code);
    input.keys.add(ev.code);
  });
  window.addEventListener('keyup', (ev) => {
    input.keys.delete(ev.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((ev.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
}

export function held(code) {
  return input.keys.has(code);
}

export function justPressed(code) {
  return input.pressed.has(code);
}

/** Read a press edge and eat it, so one tap cannot fire twice in a frame. */
export function consumePress(code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

/** Movement axes from the keyboard: x right, y down, each -1..1. */
export function moveAxes() {
  let x = 0;
  let y = 0;
  if (held('KeyA') || held('ArrowLeft')) x -= 1;
  if (held('KeyD') || held('ArrowRight')) x += 1;
  if (held('KeyW') || held('ArrowUp')) y -= 1;
  if (held('KeyS') || held('ArrowDown')) y += 1;
  return { x, y };
}

/** Called once per fixed step, after every system has read the edges. */
export function endStepInput() {
  input.pressed.clear();
  input.mouseClicked = false;
}
