// 配樂與音效：全部用 Web Audio 合成（OfflineAudioContext），依劇本的情緒選曲風，
// 角色丟東西、撞到、跳起來、說話時自動加上音效。同一份劇本每次合成的結果都一樣。
import { RNG } from './core.js';

const MOODS = {
  happy: { bpm: 120, root: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], drums: 'pop', lead: 'triangle', pad: 0.05 },
  playful: { bpm: 132, root: 65, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], drums: 'tick', lead: 'square', pad: 0.03 },
  epic: { bpm: 100, root: 50, scale: [0, 2, 3, 7, 10], prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], drums: 'toms', lead: 'sawtooth', pad: 0.08 },
  calm: { bpm: 84, root: 55, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [4, 7, 11], [5, 9, 12], [7, 11, 14]], drums: 'none', lead: 'sine', pad: 0.09 },
  tense: { bpm: 112, root: 57, scale: [0, 2, 3, 7, 8], prog: [[0, 3, 7], [0, 3, 7], [8, 12, 15], [7, 11, 14]], drums: 'pulse', lead: 'square', pad: 0.06 },
  sad: { bpm: 72, root: 57, scale: [0, 2, 3, 7, 10], prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], drums: 'none', lead: 'triangle', pad: 0.09 },
};

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

/**
 * @param {object} model compile() 的結果
 * @param {number} sampleRate
 * @returns {Promise<{left: Float32Array, right: Float32Array, sampleRate: number}>}
 */
export async function buildScore(model, sampleRate = 48000) {
  const s = model.script, M = MOODS[s.mood] ?? MOODS.happy;
  const dur = model.duration, len = Math.ceil((dur + 0.05) * sampleRate);
  const ac = new OfflineAudioContext(2, len, sampleRate);
  const master = ac.createGain(); master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;
  master.connect(comp); comp.connect(ac.destination);
  const music = ac.createGain(); music.gain.value = 0.55; music.connect(master);
  const sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  const R = RNG('score', s.title, s.mood);
  const noise = (() => { const b = ac.createBuffer(1, sampleRate, sampleRate), d = b.getChannelData(0), r = RNG('noise'); for (let i = 0; i < d.length; i++) d[i] = r.f() * 2 - 1; return b; })();

  const tone = (t, f, d, { type = 'triangle', vol = 0.2, a = 0.01, rel = 0.15, bus = music, pan = 0, slideTo = null } = {}) => {
    if (t >= dur) return;
    const o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, d - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + rel);
    p.pan.value = pan;
    o.connect(g); g.connect(p); p.connect(bus);
    o.start(t); o.stop(Math.min(dur + 0.05, t + d + rel + 0.05));
  };
  const hiss = (t, d, { vol = 0.2, type = 'highpass', f = 6000, f2 = null, q = 1, bus = music } = {}) => {
    if (t >= dur) return;
    const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = q;
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(flt); flt.connect(g); g.connect(bus);
    src.start(t, R.r(0, 0.5)); src.stop(Math.min(dur + 0.05, t + d + 0.02));
  };

  // ---- 音樂 ----
  const beat = 60 / M.bpm, bar = beat * 4;
  const bars = Math.ceil(dur / bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, chord = M.prog[b % M.prog.length], last = b === bars - 1;
    // 和弦墊底
    for (const n of chord) tone(t0, hz(M.root + n), bar * 0.95, { type: 'sine', vol: M.pad, a: 0.3, rel: 0.4, pan: (n % 2) * 0.3 - 0.15 });
    // 低音
    for (let k = 0; k < (M.drums === 'none' ? 2 : 4); k++) tone(t0 + k * (M.drums === 'none' ? bar / 2 : beat), hz(M.root - 24 + chord[0]), beat * 0.8, { type: 'triangle', vol: 0.22, rel: 0.1 });
    // 旋律：八分音符，從和弦音與五聲音階挑
    if (!last) for (let k = 0; k < 8; k++) {
      if (R.f() < (M.bpm < 90 ? 0.45 : 0.3)) continue;
      const pool = R.f() < 0.6 ? chord : M.scale;
      const n = M.root + 12 + R.pick(pool) + (R.f() < 0.2 ? 12 : 0);
      tone(t0 + k * beat / 2, hz(n), beat * (R.f() < 0.3 ? 0.9 : 0.4), { type: M.lead, vol: M.lead === 'square' || M.lead === 'sawtooth' ? 0.06 : 0.13, rel: 0.12, pan: 0.15 });
    } else tone(t0, hz(M.root + 12), bar, { type: M.lead, vol: 0.12, rel: 0.6 });
    // 鼓
    for (let k = 0; k < 8; k++) {
      const t = t0 + k * beat / 2;
      if (M.drums === 'pop') {
        if (k % 4 === 0) tone(t, 120, 0.12, { type: 'sine', vol: 0.5, slideTo: 45, rel: 0.05 });
        if (k % 4 === 2) hiss(t, 0.14, { vol: 0.28, type: 'bandpass', f: 1800 });
        hiss(t, 0.04, { vol: 0.08 });
      } else if (M.drums === 'tick') {
        if (k % 2 === 0) tone(t, 900, 0.03, { type: 'square', vol: 0.05, rel: 0.02 });
        if (k % 4 === 0) tone(t, 110, 0.1, { type: 'sine', vol: 0.4, slideTo: 50, rel: 0.05 });
      } else if (M.drums === 'toms') {
        if (k % 4 === 0) tone(t, 90, 0.3, { type: 'sine', vol: 0.55, slideTo: 40, rel: 0.1 });
        if (k === 6 || k === 7) tone(t, 140, 0.15, { type: 'sine', vol: 0.3, slideTo: 70, rel: 0.05 });
      } else if (M.drums === 'pulse') {
        tone(t, hz(M.root - 12 + chord[0]), beat * 0.35, { type: 'sawtooth', vol: 0.05, rel: 0.03 });
        if (k % 2 === 1) hiss(t, 0.03, { vol: 0.07 });
      }
    }
  }

  // ---- 音效 ----
  for (const e of model.sfx) {
    const t = e.t, bus = sfxBus;
    switch (e.kind) {
      case 'whoosh': hiss(t, 0.3, { vol: 0.35, type: 'bandpass', f: 600, f2: 3000, q: 2, bus }); break;
      case 'hit': hiss(t, 0.18, { vol: 0.6, type: 'lowpass', f: 2500, bus }); tone(t, 160, 0.15, { type: 'sine', vol: 0.6, slideTo: 50, rel: 0.05, bus }); break;
      case 'thud': tone(t, 110, 0.2, { type: 'sine', vol: 0.6, slideTo: 40, rel: 0.05, bus }); hiss(t, 0.1, { vol: 0.2, type: 'lowpass', f: 900, bus }); break;
      case 'boing': tone(t, 220, 0.22, { type: 'sine', vol: 0.3, slideTo: 660, rel: 0.05, bus }); break;
      case 'pop': tone(t, 500, 0.08, { type: 'sine', vol: 0.35, slideTo: 1100, rel: 0.04, bus }); break;
      case 'chime': [0, 4, 7, 12].forEach((n, i) => tone(t + i * 0.07, hz(M.root + 24 + n), 0.25, { type: 'sine', vol: 0.12, rel: 0.3, bus })); break;
      case 'caption': tone(t, hz(M.root + 24), 0.3, { type: 'sine', vol: 0.1, rel: 0.4, bus }); tone(t + 0.05, hz(M.root + 31), 0.3, { type: 'sine', vol: 0.08, rel: 0.4, bus }); break;
      case 'munch': for (let i = 0; i < 4; i++) hiss(t + i * 0.22, 0.07, { vol: 0.25, type: 'bandpass', f: 1200, bus }); break;
      case 'blip': {
        const n = Math.max(2, Math.floor((e.dur ?? 1) / 0.12 * 0.6));
        const r = RNG('blip', t);
        for (let i = 0; i < n; i++) tone(t + i * 0.12, hz(72 + r.pick([0, 2, 4, 7, 9])), 0.05, { type: 'square', vol: 0.035, rel: 0.02, bus });
        break;
      }
      default: break;
    }
  }

  const buf = await ac.startRendering();
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
  // 音量：RMS 拉到約 -16 dBFS，再用 tanh 軟限幅；最後 0.5 秒淡出
  let sum = 0;
  for (let i = 0; i < L.length; i++) sum += (L[i] * L[i] + Rr[i] * Rr[i]) / 2;
  const k = 10 ** (-16 / 20) / Math.sqrt(sum / L.length || 1e-9);
  const fade = Math.floor(0.5 * sampleRate);
  const left = new Float32Array(L.length), right = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) {
    const f = i > L.length - fade ? (L.length - i) / fade : 1;
    left[i] = Math.tanh(L[i] * k) * 0.95 * f;
    right[i] = Math.tanh(Rr[i] * k) * 0.95 * f;
  }
  return { left, right, sampleRate };
}

export { MOODS };
