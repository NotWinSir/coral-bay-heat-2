// audio.js — every sound in Coral Bay is synthesised with WebAudio: there are
// no audio files in the game at all. A sawtooth engine note follows the car's
// speed, police sirens alternate two tones, gunshots are shaped noise bursts
// and a slow procedural bass-and-keys loop plays the part of the radio.
// Nothing sounds until the player's first click or keypress opens the context.

let ctx = null;
let master = null;
let engineNodes = null;
let sirenNodes = null;
let musicTimer = 0;
let musicStep = 0;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (err) {
    ctx = null;
  }
}

export function resumeAudio() {
  initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(value) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
}

function env(gain, t0, peak, decay) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
}

function tone(freq, type, peak, decay, slideTo) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + decay);
  env(gain, t0, peak, decay);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + decay + 0.05);
}

function noiseBurst(peak, decay, filterFreq, type) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const length = Math.max(1, Math.floor(ctx.sampleRate * decay));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type || 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export const sfx = {
  shot() { noiseBurst(0.5, 0.14, 3200, 'highpass'); tone(150, 'square', 0.18, 0.08, 60); },
  enemyShot() { noiseBurst(0.22, 0.11, 2400, 'highpass'); },
  dryFire() { tone(1200, 'square', 0.08, 0.04); },
  reload() { tone(500, 'square', 0.1, 0.05); setTimeout(() => tone(760, 'square', 0.1, 0.05), 90); },
  hitFlesh() { noiseBurst(0.3, 0.09, 700); },
  hitMetal() { tone(2200, 'triangle', 0.16, 0.12, 1400); noiseBurst(0.14, 0.06, 4000, 'highpass'); },
  crash(strength) { noiseBurst(Math.min(0.6, 0.2 + strength * 0.05), 0.25, 500); tone(90, 'sine', 0.3, 0.25, 40); },
  door() { tone(180, 'square', 0.14, 0.07, 120); },
  alarm() { tone(1180, 'square', 0.12, 0.16); setTimeout(() => tone(1180, 'square', 0.12, 0.16), 190); },
  pickup() { tone(880, 'sine', 0.16, 0.09); setTimeout(() => tone(1320, 'sine', 0.16, 0.12), 70); },
  cash() { tone(1560, 'triangle', 0.16, 0.08); setTimeout(() => tone(2090, 'triangle', 0.16, 0.14), 60); },
  heal() { tone(660, 'sine', 0.14, 0.12, 990); },
  uiMove() { tone(700, 'sine', 0.07, 0.05); },
  uiPick() { tone(990, 'sine', 0.12, 0.09, 1320); },
  missionDone() {
    tone(523, 'triangle', 0.2, 0.16);
    setTimeout(() => tone(659, 'triangle', 0.2, 0.16), 110);
    setTimeout(() => tone(784, 'triangle', 0.26, 0.3), 220);
  },
  missionStart() { tone(392, 'triangle', 0.18, 0.14); setTimeout(() => tone(587, 'triangle', 0.2, 0.22), 100); },
  busted() { tone(392, 'sawtooth', 0.2, 0.3, 196); setTimeout(() => tone(311, 'sawtooth', 0.2, 0.42, 155), 180); },
  wasted() { tone(330, 'sawtooth', 0.22, 0.5, 82); },
  wantedUp() { tone(1046, 'square', 0.1, 0.09); setTimeout(() => tone(1046, 'square', 0.1, 0.12), 120); },
  talk() { tone(840, 'sine', 0.08, 0.06, 920); },
  punch() { noiseBurst(0.28, 0.08, 900); },
};

/** Engine loop: pitch and growl follow the driven car's speed. Call per frame. */
export function updateEngine(speedRatio, running) {
  if (!ctx) return;
  if (!engineNodes) {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    sub.type = 'square';
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(master);
    osc.start();
    sub.start();
    engineNodes = { osc, sub, gain, filter };
  }
  const t = ctx.currentTime;
  const target = running && !muted ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
  engineNodes.gain.gain.setTargetAtTime(target, t, 0.09);
  const freq = 55 + Math.abs(speedRatio) * 165;
  engineNodes.osc.frequency.setTargetAtTime(freq, t, 0.06);
  engineNodes.sub.frequency.setTargetAtTime(freq * 0.5, t, 0.06);
  engineNodes.filter.frequency.setTargetAtTime(300 + Math.abs(speedRatio) * 900, t, 0.1);
}

/** Two-tone siren loop, on while any interceptor is close and hunting. */
export function updateSiren(active, volume) {
  if (!ctx) return;
  if (!sirenNodes && active) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 700;
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    osc.start();
    sirenNodes = { osc, gain, phase: 0 };
  }
  if (!sirenNodes) return;
  const t = ctx.currentTime;
  sirenNodes.phase += 0.016;
  const high = Math.sin(sirenNodes.phase * 6.2) > 0;
  sirenNodes.osc.frequency.setTargetAtTime(high ? 960 : 690, t, 0.03);
  const target = active && !muted ? Math.min(0.11, volume) : 0;
  sirenNodes.gain.gain.setTargetAtTime(target, t, 0.15);
}

// A lazy four-bar loop: minor-key bass walk with soft keys on top, the sound
// of a Coral Bay night drive. Steps advance on a timer inside updateAudio.
const BASS_LINE = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
const KEY_CHORDS = [
  [220, 261.6, 329.6], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7],
];

export function updateAudio(dt, inCar) {
  if (!ctx || muted) return;
  musicTimer -= dt;
  if (musicTimer <= 0) {
    musicTimer = 0.235;
    const bar = Math.floor(musicStep / 16) % 4;
    const bass = BASS_LINE[musicStep % 16];
    if (bass) tone(bass, 'triangle', inCar ? 0.16 : 0.1, 0.22);
    if (musicStep % 16 === 0) {
      const chord = KEY_CHORDS[bar];
      for (const f of chord) tone(f, 'sine', 0.045, 1.4);
    }
    if (musicStep % 8 === 4) noiseBurst(0.03, 0.03, 8000, 'highpass');
    musicStep += 1;
  }
}
