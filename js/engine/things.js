// 道具與特效的形狀。
import { RNG, TAU, circlePts, ellipsePts, rectPts, roundRectPts, seg, shade, EZ, xform } from './core.js';

/** 畫一個道具，(x, y) 是拿著的位置（手或嘴）或地上的位置 */
export function drawProp(pt, p, x, y, s = 1, facing = 1, spin = 0) {
  const k = p.id ?? p.kind, c = p.color;
  const eat = p.eatK ?? 0;
  const sz = s * (1 - eat * 0.6);
  const R = (P) => (spin ? xform(P, x, y, spin) : P);
  switch (p.kind) {
    case 'ball': {
      const col = c ?? '#e0473c';
      pt.fill(R(circlePts(x, y - 2, 22 * sz, 24)), col, { key: k });
      pt.fill(R(ellipsePts(x, y - 2, 22 * sz, 7 * sz, 0.3, 18)), '#ffffff', { key: k + 's', outline: false });
      break;
    }
    case 'snowball': pt.fill(R(circlePts(x, y, 20 * sz, 20)), '#ffffff', { key: k }); break;
    case 'fish': {
      const col = c ?? '#7fb6d8', f = facing;
      pt.fill(R(ellipsePts(x + 6 * f * sz, y, 34 * sz, 15 * sz, 0, 22)), col, { key: k });
      pt.fill(R([[x - 24 * f * sz, y], [x - 46 * f * sz, y - 16 * sz], [x - 46 * f * sz, y + 16 * sz]]), shade(col, -0.15), { key: k + 't' });
      pt.fill(R(circlePts(x + 26 * f * sz, y - 4 * sz, 3.5 * sz, 8)), '#2b2730', { key: k + 'e', outline: false });
      break;
    }
    case 'bone':
      pt.fill(R(roundRectPts(x - 26 * sz, y - 6 * sz, 52 * sz, 12 * sz, 6 * sz)), '#f4f1ea', { key: k });
      for (const dx of [-26, 26]) for (const dy of [-7, 7]) pt.fill(R(circlePts(x + dx * sz, y + dy * sz, 9 * sz, 12)), '#f4f1ea', { key: k + dx + dy });
      break;
    case 'gift': {
      const col = c ?? '#e0473c';
      pt.fill(R(rectPts(x - 26 * sz, y - 40 * sz, 52 * sz, 42 * sz)), col, { key: k });
      pt.fill(R(rectPts(x - 5 * sz, y - 40 * sz, 10 * sz, 42 * sz)), '#f2c230', { key: k + 'r', outline: false });
      pt.fill(R(ellipsePts(x - 10 * sz, y - 46 * sz, 12 * sz, 7 * sz, -0.5, 12)), '#f2c230', { key: k + 'b1' });
      pt.fill(R(ellipsePts(x + 10 * sz, y - 46 * sz, 12 * sz, 7 * sz, 0.5, 12)), '#f2c230', { key: k + 'b2' });
      break;
    }
    case 'cake':
      pt.fill(R(roundRectPts(x - 34 * sz, y - 36 * sz, 68 * sz, 38 * sz, 8 * sz)), '#f6d0a8', { key: k });
      pt.fill(R(roundRectPts(x - 34 * sz, y - 40 * sz, 68 * sz, 14 * sz, 7 * sz)), '#ffffff', { key: k + 'c' });
      pt.fill(R(circlePts(x, y - 48 * sz, 8 * sz, 12)), '#e0473c', { key: k + 's' });
      break;
    case 'flower':
      pt.line(R([[x, y + 4 * sz], [x, y - 40 * sz]]), '#4fa35a', 5 * sz, { key: k + 'st' });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; pt.fill(R(circlePts(x + Math.cos(a) * 11 * sz, y - 44 * sz + Math.sin(a) * 11 * sz, 9 * sz, 12)), c ?? '#f08bb0', { key: k + i }); }
      pt.fill(R(circlePts(x, y - 44 * sz, 7 * sz, 10)), '#f2c230', { key: k + 'c' });
      break;
    case 'balloon':
      pt.line([[x, y], [x + 4, y - 90 * sz]], '#5a5a5a', 2.5, { key: k + 'str' });
      pt.fill(ellipsePts(x + 4, y - 130 * sz, 32 * sz, 40 * sz, 0, 24), c ?? '#e0473c', { key: k });
      break;
    case 'star': {
      const P = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, r = (i % 2 ? 11 : 26) * sz; P.push([x + Math.cos(a) * r, y - 20 * sz + Math.sin(a) * r]); }
      pt.fill(R(P), c ?? '#f2c230', { key: k });
      break;
    }
    case 'heart': pt.fill(R(heartPts(x, y - 20 * sz, 26 * sz)), c ?? '#e8506a', { key: k }); break;
    case 'book':
      pt.fill(R(rectPts(x - 28 * sz, y - 36 * sz, 56 * sz, 40 * sz)), c ?? '#3b6fd4', { key: k });
      pt.fill(R(rectPts(x - 22 * sz, y - 30 * sz, 44 * sz, 6 * sz)), '#ffffff', { key: k + 'l', outline: false });
      break;
    case 'apple':
      pt.fill(R(circlePts(x, y - 16 * sz, 20 * sz, 20)), c ?? '#e0473c', { key: k });
      pt.fill(R(ellipsePts(x + 8 * sz, y - 40 * sz, 9 * sz, 5 * sz, -0.6, 10)), '#4fa35a', { key: k + 'l' });
      break;
    case 'icecream':
      pt.fill(R([[x - 16 * sz, y - 30 * sz], [x + 16 * sz, y - 30 * sz], [x, y + 10 * sz]]), '#d9a35a', { key: k + 'cone' });
      pt.fill(R(circlePts(x, y - 40 * sz, 20 * sz, 18)), c ?? '#f8c8d8', { key: k });
      break;
    case 'umbrella':
      pt.line([[x, y + 10], [x, y - 120 * sz]], '#4a4a4a', 5, { key: k + 'h' });
      pt.fill([[x - 90 * sz, y - 110 * sz], [x, y - 170 * sz], [x + 90 * sz, y - 110 * sz]], c ?? '#3b6fd4', { key: k });
      break;
    default: pt.fill(circlePts(x, y, 18 * sz, 16), c ?? '#f2c230', { key: k });
  }
}

export function heartPts(x, y, r) {
  const P = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU, hx = 16 * Math.sin(a) ** 3, hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    P.push([x + (hx / 16) * r, y + (hy / 16) * r]);
  }
  return P;
}

const FX_DUR = { impact: 0.45, sparkle: 1.2, hearts: 1.6, confetti: 2.4, question: 1.4, exclaim: 0.9, zzz: 2.5, sweat: 1.2, smoke: 0.8 };
export const fxDuration = (e) => e.dur ?? FX_DUR[e.kind] ?? 1;

/** 特效（世界座標，at = 錨點 {x, y}，u = 0..1 的進度） */
export function drawEffect(pt, e, at, u, t) {
  const R = RNG('fx', e.kind, e.t);
  const k = 'fx' + e.kind + e.t;
  switch (e.kind) {
    case 'impact': {
      const g = EZ.o(u), a = 1 - u;
      const P = [];
      for (let i = 0; i < 16; i++) { const ang = (i / 16) * TAU + 0.2, r = (i % 2 ? 26 : 70) * (0.6 + g * 0.8); P.push([at.x + Math.cos(ang) * r, at.y + Math.sin(ang) * r]); }
      pt.fill(P, '#fff4a8', { key: k, alpha: a });
      for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU, r0 = 60 + g * 60, r1 = r0 + 40; pt.line([[at.x + Math.cos(ang) * r0, at.y + Math.sin(ang) * r0], [at.x + Math.cos(ang) * r1, at.y + Math.sin(ang) * r1]], '#ffffff', 7, { key: k + i, alpha: a }); }
      break;
    }
    case 'sparkle':
      for (let i = 0; i < 6; i++) {
        const ph = seg(u, i * 0.08, i * 0.08 + 0.5), s = Math.sin(ph * Math.PI) * 22;
        if (s <= 0) continue;
        const x = at.x + R.r(-120, 120), y = at.y + R.r(-130, 40);
        pt.fill([[x, y - s], [x + s * 0.28, y - s * 0.28], [x + s, y], [x + s * 0.28, y + s * 0.28], [x, y + s], [x - s * 0.28, y + s * 0.28], [x - s, y], [x - s * 0.28, y - s * 0.28]], '#fff4a8', { key: k + i, outline: false, glow: true });
      }
      break;
    case 'hearts':
      for (let i = 0; i < 5; i++) {
        const ph = seg(u, i * 0.1, i * 0.1 + 0.6);
        if (ph <= 0 || ph >= 1) continue;
        pt.fill(heartPts(at.x + R.r(-80, 80) + Math.sin(ph * 6) * 12, at.y - 20 - ph * 160, 18 * (1 - ph * 0.3)), '#e8506a', { key: k + i, alpha: 1 - ph * 0.6 });
      }
      break;
    case 'confetti':
      for (let i = 0; i < 70; i++) {
        const x = at.x + R.r(-700, 700) + Math.sin(t * 3 + i) * 20, y = -40 + (u * 1.3 + R.r(-0.3, 0)) * 1200;
        pt.fill(xform(rectPts(x - 7, y - 4, 14, 8), x, y, t * 4 + i), R.pick(['#e0473c', '#f2c230', '#3b6fd4', '#4fa35a', '#f08bb0', '#8a5cc7']), { key: k + i, outline: false });
      }
      break;
    case 'question': case 'exclaim': {
      const s = EZ.back(seg(u, 0, 0.25)) * (1 - seg(u, 0.8, 1));
      pt.text(e.kind === 'question' ? '?' : '!', at.x + 50, at.y - 70 + Math.sin(t * 8) * 4, 90 * s, { key: k, color: e.kind === 'question' ? '#3b6fd4' : '#e0473c', world: true });
      break;
    }
    case 'zzz':
      for (let i = 0; i < 3; i++) {
        const ph = (u * 3 + i / 3) % 1;
        pt.text('Z', at.x + 40 + ph * 70, at.y - 40 - ph * 120, (26 + i * 10) * (1 - ph * 0.3), { key: k + i, color: '#5a6ac4', world: true, alpha: 1 - ph });
      }
      break;
    case 'sweat':
      pt.fill(ellipsePts(at.x - 55, at.y - 30 + u * 30, 9, 14, 0.2, 14), '#8fd0f4', { key: k, alpha: 1 - u });
      break;
    case 'smoke':
      for (let i = 0; i < 7; i++) { const g = EZ.o(u); pt.fill(circlePts(at.x + (i - 3) * 30 * (1 + g), at.y + 40 - g * 40 - Math.abs(i - 3) * 6, (24 + R.r(0, 16)) * (0.6 + g * 0.6), 16), '#f4f1ea', { key: k + i, alpha: 1 - u, outline: false }); }
      break;
    default: break;
  }
}
