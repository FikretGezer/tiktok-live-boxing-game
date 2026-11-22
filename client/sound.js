// Synthesized sound effects (Web Audio). No audio files, no licences needed.
// Browsers start audio only after a click; OBS browser sources allow it automatically.
let ctx = null, master = null, muted = false, lastJoin = 0;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
addEventListener('pointerdown', ensure, { once: true });
addEventListener('keydown', ensure, { once: true });

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }
export function setVolume(v) { ensure(); master.gain.value = Math.max(0, Math.min(1, v)); }
export function ready() { return ctx?.state === 'running'; }

function tone(freq, start, dur, type = 'sine', vol = 0.5, slideTo) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}

function noise(start, dur, vol = 0.3, freq = 1200) {
  const t = ctx.currentTime + start;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}


// ---------- crowd voices ----------
// A crowd = many people shouting/singing at slightly different pitches.
// Built from detuned sawtooth "voices" through vowel formant filters (no hissy noise, no deep rumble).
// Vowels: oo, oh, ah, ey (formant pairs).
const VOWEL = { oo: [400, 900], oh: [550, 950], ah: [800, 1250], ey: [550, 1900] };
function voices(start, dur, vol, pitch, vowel = 'ah', { n = 14, spread = 0.12, bend = 1, attack = 0.06, jitter = 0.06 } = {}) {
  const t0 = ctx.currentTime + start;
  const out = ctx.createGain(); out.gain.value = vol / Math.sqrt(n);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
  const [f1, f2] = VOWEL[vowel] ?? VOWEL.ah;
  const sum = ctx.createGain();
  for (const [f, q, g] of [[f1, 5, 1], [f2, 7, 0.7]]) {
    const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
    const bg = ctx.createGain(); bg.gain.value = g * 3; sum.connect(b); b.connect(bg); bg.connect(hp);
  }
  hp.connect(lp); lp.connect(out); out.connect(master);
  for (let i = 0; i < n; i++) {
    const t = t0 + Math.random() * jitter, d = dur * (0.85 + Math.random() * 0.3);
    const f = pitch * (1 + (Math.random() * 2 - 1) * spread) * (i % 3 === 0 ? 1.5 : 1); // some higher voices
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t); if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, t + d);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4 + Math.random() * 2; vg.gain.value = f * 0.012; vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + attack); g.gain.setValueAtTime(1, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(sum); o.start(t); vib.start(t); o.stop(t + d + 0.05); vib.stop(t + d + 0.05);
  }
}
function clap(start, n = 6, vol = 0.18) { for (let k = 0; k < n; k++) noise(start + Math.random() * 0.025, 0.05, vol, 1500 + Math.random() * 1500); }
export function setCrowd() {} // old ambience hook (removed: it sounded like hiss)

const SOUNDS = {
  join() { tone(660, 0, 0.12, 'triangle', 0.25); tone(990, 0.06, 0.12, 'triangle', 0.2); },
  gift() { [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.35, 'sine', 0.35)); },
  bigGift() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.6, 'triangle', 0.4)); tone(1568, 0.5, 0.9, 'sine', 0.3); },
  follow() { tone(523, 0, 0.15, 'square', 0.15); tone(784, 0.12, 0.25, 'square', 0.15); noise(0.05, 0.4, 0.15, 3000); },
  // crowd chant: sung "O-LÉ, O-LÉ, O-LÉ" with claps
  chant() {
    const notes = [[330, 0, 0.3], [392, 0.32, 0.5], [330, 0.9, 0.3], [392, 1.22, 0.5], [330, 1.8, 0.3], [440, 2.12, 0.7]];
    notes.forEach(([f, t, d], i) => voices(t, d, 0.5, f / 1.5, i % 2 ? 'ey' : 'oh', { attack: 0.04 }));
    [0, 0.9, 1.8].forEach((t) => { clap(t - 0.02); clap(t + 0.3); });
  },
  // short "o-LEY!" shouted by a group of fans
  oley() { const p = 250 + Math.random() * 40; voices(0, 0.28, 0.4, p, 'oh', { n: 12, attack: 0.03, jitter: 0.04 }); voices(0.26, 0.55, 0.5, p * 1.2, 'ey', { n: 12, attack: 0.03, jitter: 0.04, bend: 0.95 }); },
  // crowd reactions in fights
  ooh() { voices(0, 0.8, 0.35, 230, 'oo', { bend: 1.25, attack: 0.08 }); },
  ohh() { voices(0, 1.3, 0.55, 260, 'oh', { bend: 1.35, attack: 0.05, n: 18 }); },
  aww() { voices(0, 0.9, 0.3, 300, 'ah', { bend: 0.7, attack: 0.1 }); },
  roar() { voices(0, 2.4, 0.6, 280, 'ah', { n: 20, spread: 0.2, bend: 1.15, attack: 0.12 }); voices(0.2, 2.0, 0.35, 380, 'ey', { spread: 0.2 }); for (let i = 0; i < 12; i++) clap(0.3 + i * 0.15, 4, 0.12); },
  // support rhythm: clap clap + "HEY!"
  support() { clap(0); clap(0.3); voices(0.6, 0.35, 0.55, 260, 'ey', { attack: 0.02, jitter: 0.03, bend: 1.1 }); },
  cheer() { voices(0, 1.4, 0.5, 300, 'ey', { n: 16, spread: 0.2, bend: 1.1 }); for (let i = 0; i < 6; i++) clap(0.1 + i * 0.14, 5, 0.12); },
  firework() { tone(300, 0, 0.5, 'sawtooth', 0.08, 1400); noise(0.5, 0.6, 0.4, 600); },
  pop() { tone(880, 0, 0.08, 'sine', 0.25, 1320); },
  punch() { tone(160, 0, 0.12, 'sine', 0.6, 60); noise(0, 0.08, 0.35, 900); },
  bigPunch() { tone(120, 0, 0.2, 'sine', 0.8, 45); noise(0, 0.15, 0.5, 700); },
  whoosh() { noise(0, 0.18, 0.2, 2500); },
  bell() { [0, 0.35, 0.7].forEach((t) => { tone(1046, t, 0.6, 'triangle', 0.35); tone(1568, t, 0.5, 'sine', 0.15); }); },
  ko() { tone(220, 0, 0.6, 'sawtooth', 0.15, 55); noise(0.05, 0.6, 0.4, 500); [0.7, 0.85, 1.0].forEach((t) => tone(1046, t, 0.5, 'triangle', 0.3)); },
};

export function play(name) {
  if (muted || !SOUNDS[name]) return;
  ensure();
  if (ctx.state !== 'running') return;
  if (name === 'join') { const now = performance.now(); if (now - lastJoin < 120) return; lastJoin = now; } // no machine-gun joins
  SOUNDS[name]();
}
