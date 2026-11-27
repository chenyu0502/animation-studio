// 畫風的共同基礎：把「點列 + 顏色」交給畫風的 fillShape 去畫，並提供共用的臉部、文字、對話框。
// 每個畫風只要實作 fillShape / strokeLine（以及想要的話 face、caption、post）。
import { TAU, circlePts, ellipsePts, shade, clamp, EZ, seg, W, H } from './core.js';

export const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","Heiti TC",sans-serif';

export function tracePath(ctx, P, close = true) {
  ctx.beginPath();
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  if (close) ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} style 畫風（styles/*.js）
 * @param {{t:number, frame:number}} env
 */
const reported = new Set();
function badShape(key) {
  if (reported.has(key)) return;
  reported.add(key);
  console.error('[動畫] 形狀座標不是數字，已略過：', key);
}

export function makePainter(ctx, style, env) {
  const pt = {
    ctx, env, style,
    fill(P, color, o = {}) {
      if (P.length < 3) return;
      // 有任何座標不是數字就略過這個形狀（並記錄一次），一個壞掉的形狀不應該讓整格畫不出來
      if (!P.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) { badShape(o.key); return; }
      style.fillShape(ctx, P, color, o, env);
    },
    line(P, color, w, o = {}) { style.strokeLine(ctx, P, color, w, o, env); },
    face(x, y, s, f, expr, mouth, o) { (style.face ?? defaultFace)(pt, x, y, s, f, expr, mouth, o); },
    /** 世界座標的小字（特效的 ?、!、Z） */
    text(str, x, y, size, o = {}) {
      if (size <= 1) return;
      ctx.save();
      ctx.globalAlpha *= o.alpha ?? 1;
      ctx.font = `900 ${size}px ${style.font ?? FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = style.ink ?? '#2b2730'; ctx.strokeText(str, x, y);
      ctx.fillStyle = o.color ?? '#ffffff'; ctx.fillText(str, x, y);
      ctx.restore();
    },
  };
  return pt;
}

/** 預設的臉：眼睛、眉毛、嘴巴、腮紅。s = 臉的縮放，f = 面向，rot = 頭的旋轉 */
export function defaultFace(pt, x, y, s, f, expr, mouth, o = {}) {
  const { ctx } = pt, ink = pt.style.ink ?? '#2b2730';
  const blink = (o.t * 1.0 + (o.key?.length ?? 0) * 0.37) % 3.6 < 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rot || 0);
  const gap = 22 * s;
  const ex = [-gap, gap].map((d) => d + 6 * s * f);
  const line = (P, w, c = ink) => pt.line(P, c, w, { key: o.key + 'fl', noJitter: true });
  const arc = (cx, cy, r, a0, a1, w) => { const P = []; for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * (i / 10); P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } line(P, w); };
  for (const [i, cx] of ex.entries()) {
    if (expr === 'happy' || expr === 'laugh' || expr === 'yum' || blink && expr !== 'wow' && expr !== 'sleep' && expr !== 'dizzy') {
      if (expr === 'happy' || expr === 'laugh' || expr === 'yum') arc(cx, 2 * s, 8 * s, Math.PI * 1.15, Math.PI * 1.85, 4 * s);
      else line([[cx - 7 * s, 0], [cx + 7 * s, 0]], 4 * s);
    } else if (expr === 'sleep') arc(cx, -2 * s, 7 * s, Math.PI * 0.15, Math.PI * 0.85, 3.5 * s);
    else if (expr === 'dizzy') { line([[cx - 6 * s, -6 * s], [cx + 6 * s, 6 * s]], 3.5 * s); line([[cx + 6 * s, -6 * s], [cx - 6 * s, 6 * s]], 3.5 * s); }
    else {
      const ry = (expr === 'wow' || expr === 'scared' ? 11 : expr === 'sly' || expr === 'focus' ? 6 : 9) * s;
      pt.fill(ellipsePts(cx, 0, (expr === 'wow' ? 8 : 6.5) * s, ry, 0, 16), ink, { key: o.key + 'eye' + i, outline: false, flat: true });
      pt.fill(circlePts(cx + 2.2 * s * f, -ry * 0.4, 2.4 * s, 8), '#ffffff', { key: o.key + 'hi' + i, outline: false, flat: true });
    }
    // 眉毛
    if (expr === 'angry' || expr === 'focus') line([[cx - 9 * s, -16 * s - (i === 0 ? 0 : 6 * s) * (f > 0 ? 1 : -1)], [cx + 9 * s, -16 * s - (i === 0 ? 6 * s : 0) * (f > 0 ? 1 : -1)]].map(([a, b]) => [a, b]), 3.5 * s);
    else if (expr === 'cry' || expr === 'scared') line([[cx - 9 * s, -18 * s + (i === 0 ? 5 : -5) * s * f * 0], [cx + 9 * s, -14 * s - (i ? 4 : -4) * s]], 3 * s);
    else if (expr === 'think') line([[cx - 8 * s, -18 * s - (i ? 5 : 0) * s], [cx + 8 * s, -18 * s - (i ? 0 : 0) * s]], 3 * s);
  }
  // 嘴巴
  const mx = 6 * s * f, my = 24 * s;
  if (mouth > 0.15 || expr === 'laugh' || expr === 'wow') {
    const h = (6 + 12 * Math.max(mouth, expr === 'laugh' ? 0.8 : 0.5)) * s;
    pt.fill(ellipsePts(mx, my + 2 * s, (expr === 'wow' ? 8 : 11) * s, h * 0.6, 0, 16), '#7a2a32', { key: o.key + 'm', flat: true });
  } else if (expr === 'cry' || expr === 'angry' || expr === 'scared') arc(mx, my + 10 * s, 9 * s, Math.PI * 1.2, Math.PI * 1.8, 3.5 * s);
  else if (expr === 'think' || expr === 'sly') line([[mx - 7 * s, my + 2 * s], [mx + 7 * s, my - 1 * s]], 3.5 * s);
  else arc(mx, my - 4 * s, 9 * s, Math.PI * 0.2, Math.PI * 0.8, 3.5 * s);
  // 腮紅與眼淚
  if (o.kind === 'person' && expr !== 'angry') for (const cx of ex) pt.fill(ellipsePts(cx - 2 * s * f, 18 * s, 9 * s, 5 * s, 0, 12), '#ff8f8f', { key: o.key + 'bl' + cx, outline: false, flat: true, alpha: 0.45 });
  if (expr === 'cry') for (const cx of ex) { const d = ((o.t * 1.6) % 1) * 30 * s; pt.fill(ellipsePts(cx, 10 * s + d, 4 * s, 7 * s, 0, 10), '#8fd0f4', { key: o.key + 'tear' + cx, outline: false, flat: true }); }
  ctx.restore();
}

/** 對話框（螢幕座標）。text 會逐字出現 */

const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * 為對話框挑位置（x, y 是說話者頭頂的螢幕座標）。
 * 候選：頭頂上（預設）、頭的左右兩側、頭的下方，以及每個要避開的區域（字幕、別人的對話框）的左、右、下。
 * 以「和要避開的區域重疊的面積」為主、「離預設位置多遠」為輔打分數，挑最小的；
 * 特寫時頭頂貼近畫面上緣，上面放不下，就會改放到旁邊。
 */
export function placeBubble(w, h, x, y, avoid = []) {
  const fit = (bx, by) => ({ x: clamp(bx, 30, W - w - 30), y: clamp(by, 30, H - h - 30), w, h });
  const base = fit(x - w / 2, y - h - 40);
  const cands = [base, fit(x + 90, y + 10), fit(x - 90 - w, y + 10), fit(x - w / 2, y + 140)];
  for (const r of avoid) cands.push(fit(r.x - w - 16, base.y), fit(r.x + r.w + 16, base.y), fit(base.x, r.y + r.h + 14), fit(r.x - w - 16, r.y), fit(r.x + r.w + 16, r.y));
  const head = { x: x - 70, y: y - 10, w: 140, h: 160 };
  const cost = (b) => {
    let c = 0;
    for (const r of avoid) c += area(b, r) * 0.5;
    c += area(b, head) * 0.3; // 不要蓋住說話者的臉
    if (b.y + b.h > y - 12) c += 300; // 不在頭頂上方：尾巴會斜著指，稍微扣分
    return c + Math.abs(b.x - base.x) + Math.abs(b.y - base.y) * 1.5;
  };
  let best = base, bestC = cost(base);
  for (const b of cands) { const c = cost(b); if (c < bestC) { best = b; bestC = c; } }
  return best;
}

/** 字幕佔的區域（螢幕座標，比實際畫的框略大）；不在顯示時間內回傳 null */
export function captionRect(ctx, c, t) {
  if (t < c.t || t >= c.t + c.dur) return null;
  ctx.save();
  ctx.font = `900 90px ${FONT}`;
  const w = ctx.measureText(c.text).width + 120;
  ctx.restore();
  const y = c.pos === 'bottom' ? H - 120 : c.pos === 'center' ? H / 2 : 120;
  return { x: W / 2 - w / 2, y: y - 78, w, h: 156 };
}

/** 畫對話框；回傳它佔的區域，讓下一個對話框避開 */
export function drawBubble(ctx, style, text, x, y, u, key, avoid = []) {
  const shown = text.slice(0, Math.max(1, Math.ceil([...text].length * clamp(u * 3.2)))) ;
  const size = 46, pad = 22;
  ctx.save();
  ctx.font = `800 ${size}px ${style.font ?? FONT}`;
  const w = Math.min(760, ctx.measureText(text).width) + pad * 2, h = size + pad * 1.6;
  const box = placeBubble(w, h, x, y, avoid);
  const bx = box.x, by = box.y;
  const pop = EZ.back(seg(u, 0, 0.12)), out = 1 - seg(u, 0.93, 1);
  ctx.translate(x, by + h);
  ctx.scale(pop * out, pop * out);
  ctx.translate(-x, -(by + h));
  // 尾巴從底邊伸出：對話框在頭頂上時指向頭頂；放到頭的旁邊或下方時，改從靠近說話者的那一側斜斜指向臉。
  // 橫向最多偏 90px，避免拉成一條細長的線。
  const above = by + h <= y - 12;
  const baseX = clamp(x, bx + 30, bx + w - 30);
  const tipX = clamp(x, baseX - 90, baseX + 90);
  const tipY = above ? Math.min(y - 10, by + h + 34) : by + h + 34;
  const tail = [[baseX - 16, by + h - 2], [baseX + 16, by + h - 2], [tipX, tipY]];
  (style.bubble ?? defaultBubble)(ctx, bx, by, w, h, tail, key);
  ctx.fillStyle = style.ink ?? '#2b2730';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText([...shown].join(''), bx + pad, by + h / 2 + 2, w - pad * 2);
  ctx.restore();
  return box;
}

function defaultBubble(ctx, x, y, w, h, tail) {
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2b2730'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); ctx.stroke();
  tracePath(ctx, tail); ctx.fill(); ctx.stroke();
  ctx.fillRect(tail[0][0] + 3, tail[0][1] - 6, tail[1][0] - tail[0][0] - 6, 9);
}

/** 標題字幕（螢幕座標） */
export function drawCaption(ctx, style, c, t) {
  const u = seg(t, c.t, c.t + c.dur);
  if (u <= 0 || u >= 1) return;
  const pop = EZ.back(seg(t, c.t, c.t + 0.3)), out = 1 - EZ.io(seg(t, c.t + c.dur - 0.25, c.t + c.dur));
  const y = c.pos === 'bottom' ? H - 120 : c.pos === 'center' ? H / 2 : 120;
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.scale(pop * out, pop * out);
  (style.caption ?? defaultCaption)(ctx, c.text, c);
  ctx.restore();
}

function defaultCaption(ctx, text) {
  ctx.font = `900 84px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 16; ctx.strokeStyle = '#2b2730'; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#ffffff'; ctx.fillText(text, 0, 0);
}

export { shade, TAU };
