// 剪紙風：每個形狀是一張剪下來的色紙，邊緣不規則、底下有投影，一秒 12 張的定格動畫感，最後疊上紙張纖維。
import { RNG, W, H, mix, polyBBox } from '../engine/core.js';
import { FONT } from '../engine/painter.js';

/** 剪刀剪出來的邊：在每段邊上加點並稍微偏移（形狀固定，不會每格跳動） */
function cutEdge(P, key, boil) {
  const R = RNG('cut', key), J = RNG('boil', key, boil);
  const out = [];
  const b = polyBBox(P);
  const amp = Math.min(3.2, Math.max(0.8, Math.min(b.w, b.h) * 0.03));
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.min(6, Math.floor(len / 26)));
    for (let k = 0; k < n; k++) {
      const u = k / n;
      out.push([x0 + (x1 - x0) * u + R.r(-amp, amp) + J.r(-0.6, 0.6), y0 + (y1 - y0) * u + R.r(-amp, amp) + J.r(-0.6, 0.6)]);
    }
  }
  return out;
}

let grain = null;
function grainPattern(ctx) {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d'), R = RNG('paper');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = 200 + R.r(-40, 40); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(120,100,80,0.18)'; g.lineWidth = 1;
  for (let i = 0; i < 70; i++) { g.beginPath(); const x = R.r(0, 256), y = R.r(0, 256); g.moveTo(x, y); g.lineTo(x + R.r(-30, 30), y + R.r(-6, 6)); g.stroke(); }
  grain = ctx.createPattern(c, 'repeat');
  return grain;
}

const paper = (c) => mix(c, '#efe6d6', 0.12);

export default {
  id: 'papercut',
  name: '剪紙風',
  blurb: '色紙剪貼、投影、定格動畫',
  font: FONT,
  ink: '#3a2a24',
  onTwos: true,

  sky(ctx, top, bottom) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = paper(mix(top, bottom, i / 3));
      ctx.fillRect(0, (i / 4) * H - 2, W, H / 4 + 4);
    }
  },

  fillShape(ctx, P, color, o, env) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    const Q = o.noJitter || P.length > 60 ? P : cutEdge(P, o.key ?? '', env.boil);
    ctx.beginPath();
    ctx.moveTo(Q[0][0], Q[0][1]);
    for (let i = 1; i < Q.length; i++) ctx.lineTo(Q[i][0], Q[i][1]);
    ctx.closePath();
    if (!o.flat) { ctx.shadowColor = 'rgba(50,30,20,0.32)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5; }
    if (o.glow) { ctx.shadowColor = 'rgba(255,230,150,0.8)'; ctx.shadowBlur = 30; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    ctx.fillStyle = paper(color);
    ctx.fill();
    ctx.restore();
  },

  strokeLine(ctx, P, color, w, o) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w * 1.1; ctx.strokeStyle = paper(color);
    if (!o.noJitter) { ctx.shadowColor = 'rgba(50,30,20,0.25)'; ctx.shadowBlur = 3; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3; }
    ctx.stroke();
    ctx.restore();
  },

  shadow(ctx, x, y, r, lift) {
    ctx.save();
    const k = Math.max(0.4, 1 - lift / 220);
    ctx.fillStyle = 'rgba(60,40,30,0.2)';
    ctx.beginPath(); ctx.ellipse(x + 6, y + 4, r * k, r * 0.16 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  caption(ctx, text, c) {
    ctx.font = `900 80px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 80, R = RNG('strip', text);
    ctx.rotate(R.r(-0.03, 0.03));
    ctx.shadowColor = 'rgba(50,30,20,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#f7f0e2';
    ctx.beginPath(); ctx.moveTo(-w / 2, -62);
    for (let x = -w / 2; x <= w / 2; x += 24) ctx.lineTo(x, -62 + R.r(-4, 4));
    for (let x = w / 2; x >= -w / 2; x -= 24) ctx.lineTo(x, 62 + R.r(-4, 4));
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#c8402e'; ctx.fillText(text, 0, 4);
  },

  bubble(ctx, x, y, w, h, tail) {
    ctx.save();
    ctx.shadowColor = 'rgba(50,30,20,0.3)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#fbf6ec';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.moveTo(...tail[0]); ctx.lineTo(...tail[2]); ctx.lineTo(...tail[1]); ctx.fill();
    ctx.restore();
  },

  post(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
