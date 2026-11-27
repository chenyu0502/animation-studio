// Q 版小鎮風：圓潤玩具感。每個形狀用斜上方打光的漸層上色，柔和的深色描邊，整體加暖色光暈。
import { polyBBox, shade, W, H } from '../engine/core.js';
import { tracePath, FONT } from '../engine/painter.js';

const ROUND = '"Arial Rounded MT Bold","jf-openhuninn-2.0","Yuanti TC","Microsoft JhengHei",' + FONT;

export default {
  id: 'cozy',
  name: 'Q 版小鎮風',
  blurb: '圓潤玩具感、暖色光暈',
  font: ROUND,
  ink: '#4a3240',
  onTwos: false,

  sky(ctx, top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },

  fillShape(ctx, P, color, o) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    tracePath(ctx, P);
    if (o.flat || o.outline === false && P.length < 12) ctx.fillStyle = color;
    else {
      const b = polyBBox(P);
      const g = ctx.createRadialGradient(b.x0 + b.w * 0.32, b.y0 + b.h * 0.25, 0, b.cx, b.cy, Math.max(b.w, b.h) * 0.75);
      g.addColorStop(0, shade(color, 0.28)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.12));
      ctx.fillStyle = g;
    }
    if (o.glow) { ctx.shadowColor = color; ctx.shadowBlur = 40; }
    ctx.fill();
    if (o.outline !== false && !o.flat) {
      ctx.shadowBlur = 0;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = shade(color, -0.42);
      ctx.globalAlpha *= 0.75;
      ctx.stroke();
    }
    ctx.restore();
  },

  strokeLine(ctx, P, color, w, o) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    tracePath(ctx, P, false);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = w; ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  },

  shadow(ctx, x, y, r, lift) {
    ctx.save();
    const k = Math.max(0.4, 1 - lift / 220);
    ctx.fillStyle = 'rgba(70,50,90,0.16)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, r * k, r * 0.2 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  caption(ctx, text) {
    ctx.font = `900 88px ${ROUND}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(255,250,244,0.92)';
    ctx.shadowColor = 'rgba(90,50,80,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.beginPath(); ctx.roundRect(-w / 2, -70, w, 140, 70); ctx.fill();
    ctx.shadowColor = 'transparent';
    const g = ctx.createLinearGradient(0, -40, 0, 40);
    g.addColorStop(0, '#ff8fa8'); g.addColorStop(1, '#f0703a');
    ctx.fillStyle = g; ctx.fillText(text, 0, 4);
  },

  bubble(ctx, x, y, w, h, tail) {
    ctx.save();
    ctx.fillStyle = '#fffaf4'; ctx.strokeStyle = '#4a3240'; ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(90,50,80,0.2)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.stroke();
    tracePath(ctx, tail); ctx.fill(); ctx.stroke();
    ctx.fillRect(tail[0][0] + 3, tail[0][1] - 7, tail[1][0] - tail[0][0] - 6, 10);
    ctx.restore();
  },

  post(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,214,170,0.35)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, 'rgba(80,40,60,0)'); v.addColorStop(1, 'rgba(80,40,60,0.22)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
