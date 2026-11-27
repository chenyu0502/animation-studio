// 手繪繪本風：形狀和其他畫風一樣，但每一筆都像手畫的——
// - 描邊用 Rough.js：線條微微抖動、有時畫兩次，像鉛筆勾勒
// - 填色：位置稍微偏一點，再疊一層蠟筆紋理，像用色筆塗上去
// - 細線（眼睛、嘴巴、雨絲）用 perfect-freehand：筆畫兩端收細，像毛筆或沾水筆
// - 每兩格重畫一次線條（line boil），一秒 12 張，是手繪動畫的晃動感；整張畫在米色畫紙上
// 同一個形狀用固定種子，每一格的抖動都一樣；只有每兩格換一次，畫面才不會亂跳。
// 授權：vendor/rough.LICENSE、vendor/perfect-freehand.LICENSE（MIT）。
import rough from '../../vendor/rough.esm.js';
import { getStroke } from '../../vendor/perfect-freehand.mjs';
import { RNG, W, H, hash, mix, polyBBox, shade } from '../engine/core.js';
import { FONT } from '../engine/painter.js';

const HAND = '"jf-openhuninn-2.0","Yuanti TC","Kaiti TC","DFKai-SB","BiauKai",' + FONT;
const PAPER = '#f6efe1';
const INK = '#3b302c';
/** 畫在畫紙上的顏色：稍微淡一點、偏暖 */
const tint = (c) => mix(c, PAPER, 0.12);

const roughOf = new WeakMap();
const rc = (ctx) => { let r = roughOf.get(ctx.canvas); if (!r) { r = rough.canvas(ctx.canvas); roughOf.set(ctx.canvas, r); } return r; };
const seedOf = (key, boil) => ((hash(String(key ?? ''), String(boil)) % 2147483646) + 1);

/** 點太多時抽樣：Rough.js 每條邊都會畫成曲線，圓形 40 個點抽成 20 個就夠，也比較像手畫 */
function sparse(P, max = 22) {
  if (P.length <= max) return P;
  const step = P.length / max, out = [];
  for (let i = 0; i < max; i++) out.push(P[Math.floor(i * step)]);
  return out;
}

/** 填色的位置稍微偏一點（像塗色沒對準線） */
function wobble(P, key, boil, amp) {
  const R = RNG('sk', key, boil), dx = R.r(-amp, amp), dy = R.r(-amp, amp);
  return P.map(([x, y]) => [x + dx, y + dy]);
}

let crayon = null, paperTex = null;
/** 蠟筆紋理：很多短斜線，疊在填色上（multiply）產生塗色的筆觸 */
function crayonPattern(ctx) {
  if (crayon) return crayon;
  const c = document.createElement('canvas'); c.width = c.height = 192;
  const g = c.getContext('2d'), R = RNG('crayon');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 192, 192);
  g.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const x = R.r(-20, 192), y = R.r(-20, 192), len = R.r(10, 34), v = Math.round(R.r(200, 248));
    g.strokeStyle = `rgba(${v},${v},${v},${R.r(0.4, 0.9)})`; g.lineWidth = R.r(1, 3);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y - len * 0.55); g.stroke();
  }
  crayon = ctx.createPattern(c, 'repeat');
  return crayon;
}
/** 畫紙紋理：細小雜點與纖維 */
function paperPattern(ctx) {
  if (paperTex) return paperTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), R = RNG('sketch-paper');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = 236 + R.r(-22, 14); img.data[i] = v; img.data[i + 1] = v - 3; img.data[i + 2] = v - 10; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(150,120,90,0.16)';
  for (let i = 0; i < 90; i++) { g.lineWidth = R.r(0.5, 1.2); g.beginPath(); const x = R.r(0, 256), y = R.r(0, 256); g.moveTo(x, y); g.quadraticCurveTo(x + R.r(-12, 12), y + R.r(-12, 12), x + R.r(-28, 28), y + R.r(-28, 28)); g.stroke(); }
  paperTex = ctx.createPattern(c, 'repeat');
  return paperTex;
}

/** perfect-freehand 的筆畫輪廓 → 填滿 */
function fillStroke(ctx, outline) {
  if (outline.length < 3) return;
  ctx.beginPath(); ctx.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
  ctx.closePath(); ctx.fill();
}

export default {
  id: 'sketch',
  name: '手繪繪本風',
  blurb: '鉛筆勾線、蠟筆塗色、畫紙質感',
  font: HAND,
  ink: INK,
  onTwos: true,
  boilEvery: 2,

  sky(ctx, top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix(top, PAPER, 0.3)); g.addColorStop(1, mix(bottom, PAPER, 0.3));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },

  fillShape(ctx, P, color, o, env) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    const b = polyBBox(P), size = Math.min(b.w, b.h);
    const key = o.key ?? '', fill = tint(color);
    const Q = o.noJitter || o.flat ? P : wobble(P, key, env.boil, Math.min(3, size * 0.04));
    ctx.beginPath(); ctx.moveTo(Q[0][0], Q[0][1]);
    for (let i = 1; i < Q.length; i++) ctx.lineTo(Q[i][0], Q[i][1]);
    ctx.closePath();
    if (o.glow) { ctx.shadowColor = color; ctx.shadowBlur = 34; }
    ctx.fillStyle = fill; ctx.fill();
    ctx.shadowBlur = 0;
    // 蠟筆紋理：小東西（眼睛、亮點）不加，看起來會髒
    if (!o.flat && size > 14) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = crayonPattern(ctx);
      ctx.fill();
      ctx.restore();
    }
    // 鉛筆描邊
    if (o.outline !== false && !o.flat && size > 6) {
      const big = size > 60;
      rc(ctx).polygon(sparse(P), {
        seed: seedOf(key, env.boil), roughness: big ? 1.1 : 0.7, bowing: big ? 1.2 : 0.6,
        stroke: mix(shade(color, -0.55), INK, 0.5), strokeWidth: big ? 2.4 : 1.8, disableMultiStroke: !big, fill: undefined,
      });
    }
    ctx.restore();
  },

  strokeLine(ctx, P, color, w, o, env) {
    if (P.length < 2) return;
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    const R = RNG('ln', o.key ?? '', env?.boil ?? 0), j = o.noJitter ? 0 : Math.min(1.2, w * 0.15);
    const pts = P.map(([x, y]) => [x + R.r(-j, j), y + R.r(-j, j)]);
    ctx.fillStyle = tint(color);
    fillStroke(ctx, getStroke(pts, { size: w * 1.15, thinning: 0.55, smoothing: 0.5, streamline: 0.35, simulatePressure: true, last: true }));
    ctx.restore();
  },

  shadow(ctx, x, y, r, lift) {
    ctx.save();
    const k = Math.max(0.4, 1 - lift / 220);
    ctx.fillStyle = 'rgba(80,60,50,0.16)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + 3, r * k, r * 0.17 * k, 0, 0, Math.PI * 2); ctx.fill();
    // 鉛筆斜線陰影
    ctx.clip();
    ctx.strokeStyle = 'rgba(70,55,45,0.28)'; ctx.lineWidth = 1.4;
    for (let i = -r; i < r; i += 9) { ctx.beginPath(); ctx.moveTo(x + i, y + r * 0.2); ctx.lineTo(x + i + r * 0.25, y - r * 0.2); ctx.stroke(); }
    ctx.restore();
  },

  caption(ctx, text) {
    ctx.font = `900 82px ${HAND}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(253,249,240,0.94)';
    ctx.beginPath(); ctx.roundRect(-w / 2, -64, w, 128, 26); ctx.fill();
    rc(ctx).rectangle(-w / 2, -64, w, 128, { seed: hash(text) % 9999 + 1, roughness: 1.3, bowing: 1.4, stroke: INK, strokeWidth: 2.6 });
    ctx.fillStyle = '#c4553a'; ctx.fillText(text, 0, 4);
  },

  bubble(ctx, x, y, w, h, tail, key) {
    ctx.save();
    ctx.fillStyle = '#fffdf6';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.moveTo(...tail[0]); ctx.lineTo(...tail[2]); ctx.lineTo(...tail[1]); ctx.fill();
    const seed = hash(String(key ?? '')) % 9999 + 1;
    rc(ctx).path(`M${x + h / 2},${y} H${x + w - h / 2} A${h / 2},${h / 2} 0 0 1 ${x + w - h / 2},${y + h} H${tail[1][0]} L${tail[2][0]},${tail[2][1]} L${tail[0][0]},${tail[0][1]} H${x + h / 2} A${h / 2},${h / 2} 0 0 1 ${x + h / 2},${y} Z`,
      { seed, roughness: 0.9, bowing: 0.8, stroke: INK, strokeWidth: 2.4 });
    ctx.restore();
  },

  post(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = paperPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
