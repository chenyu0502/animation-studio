// 共用的小工具：亂數（固定種子，同一份劇本每次畫出來都一樣）、緩動、幾何。
export const TAU = Math.PI * 2;
export const W = 1920;
export const H = 1080;
export const FPS = 24;
/** 地面的世界座標 y */
export const GROUND = 900;
/** 角色整體放大倍數（1 = 骨架原始尺寸） */
export const CHAR_SCALE = 1.7;
/** 貓狗在 CHAR_SCALE 之外的倍數。原本 1.25 會讓一般大小的狗比小孩還高；0.9 時狗約大人的 6 成高。 */
export const ANIMAL_SCALE = 0.9;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, u) => a + (b - a) * u;
export const seg = (t, a, b) => clamp((t - a) / (b - a || 1e-6));
export const EZ = {
  io: (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
  o: (u) => 1 - (1 - u) ** 3,
  i: (u) => u * u * u,
  back: (u) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2,
};

/** 字串雜湊 → 32 位元種子 */
export function hash(...parts) {
  let h = 2166136261;
  for (const p of parts.join('|')) h = Math.imul(h ^ p.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** mulberry32；RNG('樹', 3).f() 回傳 0..1 */
export function RNG(...key) {
  let a = hash(...key.map(String));
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { f, r: (lo, hi) => lo + (hi - lo) * f(), i: (lo, hi) => Math.floor(lo + (hi - lo + 1) * f()), pick: (arr) => arr[Math.floor(f() * arr.length)] };
}

// ---------- 幾何：所有形狀都轉成點列，畫風可以自由處理（抖動、像素化、陰影） ----------
export function ellipsePts(cx, cy, rx, ry, rot = 0, n = 40) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}
export const circlePts = (cx, cy, r, n = 36) => ellipsePts(cx, cy, r, r, 0, n);

/** 兩端圓頭的粗線（四肢、身體） */
export function capsulePts(x1, y1, x2, y2, r1, r2 = r1, n = 10) {
  const a = Math.atan2(y2 - y1, x2 - x1), out = [];
  for (let i = 0; i <= n; i++) {
    const t = a + Math.PI / 2 + (i / n) * Math.PI;
    out.push([x1 + Math.cos(t) * r1, y1 + Math.sin(t) * r1]);
  }
  for (let i = 0; i <= n; i++) {
    const t = a - Math.PI / 2 + (i / n) * Math.PI;
    out.push([x2 + Math.cos(t) * r2, y2 + Math.sin(t) * r2]);
  }
  return out;
}

export function roundRectPts(x, y, w, h, r, n = 6) {
  r = Math.min(r, w / 2, h / 2);
  const out = [], corners = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI / 2);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

export const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

export function polyBBox(P) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of P) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** 以 (cx, cy) 為中心旋轉、縮放點列 */
export function xform(P, cx, cy, rot = 0, sx = 1, sy = sx, dx = 0, dy = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return P.map(([x, y]) => {
    const u = (x - cx) * sx, v = (y - cy) * sy;
    return [cx + u * c - v * s + dx, cy + u * s + v * c + dy];
  });
}

// ---------- 顏色 ----------
export function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, u) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => lerp(v, B[i], u))); };
export const shade = (c, k) => (k >= 0 ? mix(c, '#ffffff', k) : mix(c, '#1a1020', -k));
