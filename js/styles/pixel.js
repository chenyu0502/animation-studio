// 像素風：整個畫面先畫在 384×216 的小畫布上，色彩減到少數色階，再用最近鄰放大 5 倍，加上掃描線。
import { W, H, mix, shade } from '../engine/core.js';
import { tracePath } from '../engine/painter.js';

const LW = 384, LH = 216, K = LW / W;
const PIXEL_FONT = '"Press Start 2P","Cubic 11","Zpix","Microsoft JhengHei",monospace';
let buf = null;

function lowres() {
  if (!buf) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(LW, LH) : Object.assign(document.createElement('canvas'), { width: LW, height: LH });
    buf = { c, g: c.getContext('2d', { willReadFrequently: true }) };
  }
  return buf;
}

/** 把每個色版減到 12 階（16 位元遊戲機的感覺），同時去掉反鋸齒造成的過渡色 */
function posterize(g) {
  const img = g.getImageData(0, 0, LW, LH), d = img.data, q = 255 / 11;
  for (let i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / q) * q; d[i + 1] = Math.round(d[i + 1] / q) * q; d[i + 2] = Math.round(d[i + 2] / q) * q; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
}

export default {
  id: 'pixel',
  name: '像素風',
  blurb: '16 位元遊戲機畫面',
  font: PIXEL_FONT,
  ink: '#1e1a2a',
  onTwos: true,
  hiResText: true,

  begin(ctx) {
    const { c, g } = lowres();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, LW, LH);
    return {
      ctx: g,
      scale: K,
      finish() {
        posterize(g);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(c, 0, 0, W, H);
        ctx.restore();
      },
    };
  },

  sky(ctx, top, bottom) {
    for (let i = 0; i < 8; i++) { ctx.fillStyle = mix(top, bottom, i / 7); ctx.fillRect(0, (i / 8) * H, W, H / 8 + 6); }
  },

  fillShape(ctx, P, color, o) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    tracePath(ctx, P);
    ctx.fillStyle = color;
    ctx.fill();
    if (o.outline !== false && !o.flat) { ctx.lineWidth = 1 / K; ctx.strokeStyle = shade(color, -0.55); ctx.stroke(); }
    ctx.restore();
  },

  strokeLine(ctx, P, color, w, o) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    tracePath(ctx, P, false);
    ctx.lineWidth = Math.max(w, 1 / K); ctx.strokeStyle = color; ctx.lineCap = 'square';
    ctx.stroke();
    ctx.restore();
  },

  shadow(ctx, x, y, r, lift) {
    ctx.save();
    ctx.fillStyle = 'rgba(30,20,40,0.25)';
    const k = Math.max(0.4, 1 - lift / 220);
    ctx.fillRect(x - r * k, y - 6, r * 2 * k, 14);
    ctx.restore();
  },

  caption(ctx, text) {
    ctx.font = `90px ${PIXEL_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 80;
    ctx.fillStyle = '#1e1a2a'; ctx.fillRect(-w / 2 - 10, -70, w + 20, 140);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(-w / 2, -60, w, 120);
    ctx.fillStyle = '#3b6fd4'; ctx.fillRect(-w / 2, -60, w, 14);
    ctx.fillStyle = '#1e1a2a'; ctx.fillText(text, 0, 10);
  },

  bubble(ctx, x, y, w, h, tail) {
    ctx.save();
    ctx.fillStyle = '#1e1a2a'; ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1e1a2a'; ctx.beginPath(); ctx.moveTo(tail[0][0] - 10, tail[0][1] + 8); ctx.lineTo(tail[2][0], tail[2][1] + 10); ctx.lineTo(tail[1][0] + 10, tail[1][1] + 8); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(...tail[0]); ctx.lineTo(...tail[2]); ctx.lineTo(...tail[1]); ctx.fill();
    ctx.restore();
  },

  post(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < H; y += 5) ctx.fillRect(0, y + 3, W, 2);
    ctx.restore();
  },
};
