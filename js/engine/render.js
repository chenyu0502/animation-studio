// 一格畫面：鏡頭 → 場景三層 → 地上的道具 → 角色 → 飛行的道具 → 特效 → 天氣 → 色調 → 對話框與字幕 → 畫風的後製。
import { ANIMAL_SCALE, CHAR_SCALE, FPS, GROUND, H, RNG, W, clamp, lerp, seg, EZ } from './core.js';
import { SIZES } from './script.js';
import { charState, flying, groundProps } from './compile.js';
import { drawCharacter } from './rig.js';
import { sceneLayers, skyColors, weatherParticles } from './scene.js';
import { drawEffect, drawProp, fxDuration } from './things.js';
import { captionRect, drawBubble, drawCaption, makePainter } from './painter.js';

const ZOOM = { wide: 1, medium: 1.45, close: 2.15 };

/** 鏡頭：位置（世界座標中心）與縮放 */
export function cameraAt(model, t) {
  const cams = model.script.camera;
  let i = 0;
  for (let k = 0; k < cams.length; k++) if (t >= cams[k].t) i = k;
  const shot = cams[i], next = cams[i + 1];
  const tEnd = next ? next.t : model.duration;
  const push = 1 + 0.05 * EZ.io(seg(t, shot.t, tEnd));
  let cx = W / 2, cy = H / 2, z = ZOOM[shot.shot] * push;
  if (shot.on && model.byId[shot.on]) {
    const ch = model.byId[shot.on];
    const S = (SIZES[ch.size] ?? 1) * CHAR_SCALE;
    const tall = (ch.kind === 'person' ? 270 : 125 * ANIMAL_SCALE) * S;
    /** 某個時間點鏡頭想對準的位置：身體位置，加上跌倒、躺下時頭偏離身體的補位 */
    const aim = (tt) => {
      const st = charState(model, shot.on, tt);
      const rot = Math.abs(st.pose.rot ?? 0);
      // 頭的高度：躺下（rot）時頭貼近地面
      const headY = GROUND - tall * Math.cos(rot) - (st.pose.bodyY ?? 0) * S - 20;
      const x = st.x + Math.sin(rot) * tall * 0.8 * -st.facing * EZ.io(clamp((rot - 0.1) / 0.4));
      return [x, shot.shot === 'close' ? headY + 40 : lerp(headY, GROUND - 60, 0.5)];
    };
    // 跟拍：取前後 0.35 秒的加權平均。跌倒動作約 0.15 秒就倒下去，特寫若緊盯頭部，
    // 整個畫面會在一兩格內甩動 300px 以上；平均之後鏡頭會平順地跟過去。
    let sx = 0, sy = 0, sw = 0;
    for (const d of [-0.35, -0.23, -0.12, 0, 0.12, 0.23, 0.35]) {
      const w = 1 - Math.abs(d) * 1.6;
      const [x, y] = aim(clamp(t + d, shot.t, tEnd));
      sx += x * w; sy += y * w; sw += w;
    }
    cx = sx / sw; cy = sy / sw;
  }
  const hw = W / 2 / z, hh = H / 2 / z;
  cx = clamp(cx, hw - 60, W - hw + 60);
  cy = clamp(cy, hh, H - hh);
  // 撞擊時晃動
  let shake = 0;
  for (const e of model.effects) if (e.shake && t >= e.t && t < e.t + 0.3) shake = Math.max(shake, e.shake * (1 - (t - e.t) / 0.3));
  if (shake) { const R = RNG('shake', Math.floor(t * FPS)); cx += R.r(-1, 1) * 16 * shake; cy += R.r(-1, 1) * 12 * shake; }
  return { cx, cy, z, shot: shot.shot, cut: i };
}

const camMatrix = (cam, factor) => {
  const z = 1 + (cam.z - 1) * factor;
  const cx = lerp(W / 2, cam.cx, factor), cy = lerp(H / 2, cam.cy, factor);
  return [z, 0, 0, z, W / 2 - cx * z, H / 2 - cy * z];
};
export const toScreen = (cam, [x, y]) => { const m = camMatrix(cam, 1); return [x * m[0] + m[4], y * m[3] + m[5]]; };

const layerCache = new Map();

/**
 * @param {CanvasRenderingContext2D} ctx 1920×1080 的畫布
 * @param {object} model compile() 的結果
 * @param {object} style 畫風
 * @param {number} tReal 秒
 */
export function renderFrame(ctx, model, style, tReal) {
  const frame = Math.round(tReal * FPS);
  // 畫風可以用「一拍二」（每秒 12 張）讓動作有定格動畫的感覺
  const t = style.onTwos ? Math.floor(frame / 2) * 2 / FPS : frame / FPS;
  const env = { t, frame, boil: Math.floor(frame / (style.boilEvery ?? 2)) };
  const s = model.script;
  const key = s.scene + s.time + s.weather + s.title;
  if (!layerCache.has(key)) { layerCache.clear(); layerCache.set(key, sceneLayers(s.scene, s.time, s.title, s.weather)); }
  const layers = layerCache.get(key);
  const cam = cameraAt(model, t);
  const { ctx: c, finish, scale: k = 1 } = style.begin ? style.begin(ctx, env) : { ctx, finish: null };
  const setM = (m) => c.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k);
  const pt = makePainter(c, style, env);

  c.save();
  c.setTransform(k, 0, 0, k, 0, 0);
  const sky = skyColors(s.scene, s.time, s.weather);
  style.sky(c, sky.top, sky.bottom, env);
  // 場景
  for (const L of layers) {
    setM(camMatrix(cam, L.factor));
    L.draw(pt, t);
  }
  setM(camMatrix(cam, 1));
  // 地上的道具
  for (const p of groundProps(model, t)) drawProp(pt, p, p.wx, GROUND - 6, 1, 1);
  // 角色（影子先畫）
  const anchors = {};
  const states = s.characters.map((ch) => ({ ch, st: charState(model, ch.id, t) }));
  for (const { ch, st } of states) style.shadow?.(c, st.x, GROUND, (ch.kind === 'person' ? 62 : 64 * ANIMAL_SCALE) * CHAR_SCALE * (SIZES[ch.size] ?? 1), (st.pose.bodyY ?? 0) * CHAR_SCALE, env);
  for (const { ch, st } of states) {
    anchors[ch.id] = drawCharacter(pt, ch, { ...st, t }, (hold, x, y, S, f) => drawProp(pt, hold, x, y, S, f));
  }
  // 飛行中的道具
  for (const f of flying(model, t)) drawProp(pt, f, f.wx, f.wy, 1, f.facing, f.spin);
  // 特效
  for (const e of model.effects) {
    const d = fxDuration(e);
    if (t < e.t || t >= e.t + d) continue;
    let at = { x: W / 2, y: GROUND - 260 };
    if (typeof e.at === 'string' && anchors[e.at]) at = { x: anchors[e.at].head[0], y: anchors[e.at].head[1] };
    else if (typeof e.at === 'number') at = { x: 170 + e.at * 15.8, y: GROUND - 200 * CHAR_SCALE };
    if (e.kind === 'confetti') { c.setTransform(k, 0, 0, k, 0, 0); at = { x: W / 2, y: 0 }; }
    drawEffect(pt, e, at, (t - e.t) / d, t);
    setM(camMatrix(cam, 1));
  }
  // 天氣與時間色調（螢幕座標）
  c.setTransform(k, 0, 0, k, 0, 0);
  weatherParticles(pt, s.weather, t, s.scene);
  if (sky.tint) { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = sky.tint[1]; c.fillStyle = sky.tint[0]; c.fillRect(0, 0, W, H); c.restore(); }
  // 對話框與字幕：低解析度的畫風（像素）在放大後才畫，文字才看得清楚
  const texts = (g) => {
    // 對話框避開正在顯示的字幕，以及先畫好的對話框
    const avoid = s.captions.map((cap) => captionRect(g, cap, t)).filter(Boolean);
    for (const { ch, st } of states) {
      if (!st.talking || !anchors[ch.id]) continue;
      const [x, y] = toScreen(cam, [anchors[ch.id].head[0], anchors[ch.id].top]);
      avoid.push(drawBubble(g, style, st.talking.text, x, y, st.talking.u, ch.id + st.talking.t0, avoid));
    }
    for (const cap of s.captions) drawCaption(g, style, cap, t);
  };
  if (!style.hiResText) texts(c);
  c.restore();
  if (finish) finish(env);
  if (style.hiResText) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); texts(ctx); ctx.restore(); }
  if (style.post) style.post(ctx, env);
}

export { W, H, FPS };
