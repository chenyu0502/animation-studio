// 角色骨架：動作 → 姿勢（關節角度），姿勢 → 形狀（交給畫風去畫）。
//
// 角度以「朝下」為 0，正值往角色面向的方向轉。人物的四肢分成前（靠鏡頭）與後；動物有四隻腳、頭、尾巴。
import { CHAR_SCALE, GROUND, TAU, capsulePts, circlePts, clamp, ellipsePts, lerp, seg, EZ, shade } from './core.js';
import { SIZES } from './script.js';

const dir = (a) => [Math.sin(a), Math.cos(a)];
const SKIN = '#ffd9bf';

// ======================================================================
//  姿勢
// ======================================================================
/** 人物的站立姿勢 */
export function idlePose(time = 0) {
  return {
    bodyY: Math.sin(time * 2.2) * 2, lean: 0, rot: 0, head: Math.sin(time * 1.3) * 0.03,
    armF: [0.14, 0.2], armB: [-0.12, 0.2], legF: [0.06, 0], legB: [-0.06, 0],
    expr: 'neutral', mouth: 0, sx: 1,
  };
}

/** 依動作與經過時間算出人物姿勢。tau：動作開始後的秒數；u：0..1；dist：移動距離（走路週期用） */
export function personPose(act, tau, u, ctx) {
  const p = idlePose(ctx.time);
  const s = Math.sin, c = Math.cos;
  const walkCycle = (amp, bounce, stride) => {
    const ph = (ctx.dist / stride) * TAU;
    p.legF = [amp * s(ph), Math.max(0, -s(ph)) * amp * 1.4];
    p.legB = [-amp * s(ph), Math.max(0, s(ph)) * amp * 1.4];
    p.armF = [-amp * 0.9 * s(ph), 0.4];
    p.armB = [amp * 0.9 * s(ph), 0.4];
    p.bodyY = Math.abs(s(ph)) * bounce;
  };
  switch (act) {
    case 'walk':
      if (ctx.moving) walkCycle(0.42, 6, 150); p.expr = 'neutral'; break;
    case 'run': case 'chase': case 'flee':
      if (ctx.moving) { walkCycle(0.8, 14, 190); p.lean = 0.22; p.armF[1] = p.armB[1] = 1.3; }
      p.expr = act === 'flee' ? 'scared' : act === 'chase' ? 'focus' : 'happy'; break;
    case 'sneak':
      if (ctx.moving) walkCycle(0.32, 3, 120);
      p.lean = 0.32; p.bodyY -= 14; p.legF[1] += 0.5; p.legB[1] += 0.5;
      p.armF = [1.5, 1.2]; p.armB = [1.2, 1.4]; p.expr = 'sly'; break;
    case 'jump': {
      const crouch = u < 0.22 ? EZ.io(u / 0.22) : u > 0.85 ? EZ.io((1 - u) / 0.15) : 0;
      const air = u >= 0.22 && u <= 0.88 ? s(((u - 0.22) / 0.66) * Math.PI) : 0;
      p.bodyY = air * 130 - crouch * 18;
      p.legF = [0.5 * crouch + 0.6 * air, 0.9 * crouch + 1.0 * air]; p.legB = [-0.2 * crouch + 0.2 * air, 0.9 * crouch + 0.9 * air];
      p.armF = [lerp(0.3, 2.8, air), 0.2]; p.armB = [lerp(-0.3, 2.6, air), 0.2]; p.expr = 'happy'; break;
    }
    case 'wave':
      p.armF = [2.6, 0.5 + 0.45 * s(tau * 14)]; p.head = 0.06; p.expr = 'happy'; p.mouth = 0.4; break;
    case 'cheer': {
      const hop = Math.max(0, s(tau * 9));
      p.armF = [2.9, 0.15 * s(tau * 18)]; p.armB = [2.7, 0.15 * c(tau * 18)]; p.bodyY = hop * 26;
      p.legF = [0.1 + hop * 0.2, hop * 0.5]; p.legB = [-0.1, hop * 0.5]; p.expr = 'happy'; p.mouth = 0.8; break;
    }
    case 'dance': {
      const b = s(tau * 7);
      p.lean = 0.16 * b; p.armF = [b > 0 ? 2.7 : 0.6, 0.6]; p.armB = [b > 0 ? 0.6 : 2.7, 0.6];
      p.bodyY = Math.abs(b) * 16; p.legF = [0.25 * b, Math.max(0, b) * 0.6]; p.legB = [-0.25 * b, Math.max(0, -b) * 0.6];
      p.head = 0.12 * b; p.expr = 'happy'; p.mouth = 0.5; break;
    }
    case 'talk':
      p.armF = [0.9 + 0.25 * s(tau * 5), 1.1]; p.mouth = Math.max(0, s(tau * 16)) * 0.9; p.head = 0.05 * s(tau * 3); p.expr = 'neutral'; break;
    case 'laugh':
      p.lean = -0.12 + 0.04 * s(tau * 22); p.armF = [0.5, 2.0]; p.armB = [0.4, 2.0]; p.bodyY = Math.abs(s(tau * 22)) * 4;
      p.expr = 'laugh'; p.mouth = 1; break;
    case 'cry':
      p.head = 0.22; p.lean = 0.08; p.armF = [2.3, 1.9]; p.armB = [2.1, 2.0]; p.bodyY = Math.abs(s(tau * 12)) * 3;
      p.expr = 'cry'; p.mouth = 0.5; break;
    case 'angry': {
      const st = s(tau * 12);
      p.lean = 0.1; p.armF = [0.25, 0.9]; p.armB = [-0.25, 0.9]; p.legF = [0.15, Math.max(0, st) * 0.9]; p.legB = [-0.1, Math.max(0, -st) * 0.9];
      p.bodyY = Math.max(0, st) * 8; p.expr = 'angry'; p.mouth = 0.4; break;
    }
    case 'surprised': {
      const k = EZ.back(seg(u, 0, 0.35));
      p.bodyY = s(seg(u, 0, 0.5) * Math.PI) * 40; p.lean = -0.18 * k; p.armF = [2.2 * k, 0.4]; p.armB = [2.0 * k, 0.4];
      p.expr = 'wow'; p.mouth = 1; break;
    }
    case 'think':
      p.armF = [1.0, 2.5]; p.armB = [0.6, 1.6]; p.head = -0.12; p.expr = 'think'; break;
    case 'point':
      p.armF = [Math.PI / 2 - 0.05, 0]; p.lean = 0.05; p.expr = 'focus'; p.mouth = 0.3; break;
    case 'sit': case 'sleep': {
      const k = EZ.io(seg(u, 0, 0.25)) * (act === 'sit' ? 1 : 1) * (u > 0.92 ? 1 - seg(u, 0.92, 1) : 1);
      p.legF = [lerp(0.06, 1.5, k), lerp(0, 1.5, k)]; p.legB = [lerp(-0.06, 1.4, k), lerp(0, 1.4, k)];
      p.bodyY = -k * 0.62; p.sitK = k;
      p.armF = [0.5, 0.6]; p.armB = [0.4, 0.6];
      if (act === 'sleep') { p.head = 0.35 * k; p.lean = 0.12 * k; p.expr = 'sleep'; } else p.expr = 'happy';
      break;
    }
    case 'fall': {
      const down = EZ.o(seg(u, 0, 0.3)), up = EZ.io(seg(u, 0.78, 1));
      p.rot = -Math.PI / 2 * (down - up) * 0.95; p.armF = [2.4, 0.5]; p.armB = [2.0, 0.5]; p.legF = [0.5, 0.3];
      p.expr = u < 0.3 ? 'wow' : 'dizzy'; p.mouth = 0.6; break;
    }
    case 'spin':
      p.sx = c(u * TAU * 2); p.armF = [Math.PI / 2, 0]; p.armB = [Math.PI / 2, 0]; p.expr = 'happy'; p.bodyY = s(u * Math.PI) * 20; break;
    case 'throw': {
      const wind = EZ.io(seg(u, 0, 0.42)), rel = EZ.o(seg(u, 0.42, 0.6));
      p.armF = [lerp(lerp(0.2, -2.4, wind), 1.7, rel), lerp(0.8, 0.1, rel)];
      p.armB = [lerp(0.2, 1.0, wind) - rel * 0.8, 0.5]; p.lean = lerp(-0.12 * wind, 0.22, rel);
      p.legF = [0.35 * wind, 0.1]; p.legB = [-0.3, 0.1]; p.expr = 'focus'; break;
    }
    case 'pickup': {
      const k = s(seg(u, 0.1, 0.9) * Math.PI);
      p.lean = 0.85 * k; p.armF = [lerp(0.14, 0.25, k), 0]; p.legF = [0.3 * k, 0.5 * k]; p.legB = [-0.1, 0.5 * k]; p.bodyY = -16 * k; p.expr = 'neutral'; break;
    }
    case 'give':
      p.armF = [lerp(0.2, 1.35, EZ.o(seg(u, 0, 0.4))), 0.15]; p.lean = 0.06; p.expr = 'happy'; p.mouth = 0.4; break;
    case 'eat':
      p.armF = [lerp(0.8, 1.9, Math.max(0, s(tau * 6))), 2.2]; p.mouth = Math.max(0, s(tau * 12)) * 0.6; p.expr = 'yum'; break;
    case 'hug':
      p.armF = [1.45, 1.0]; p.armB = [1.35, 1.1]; p.lean = 0.12; p.expr = 'laugh'; break;
    case 'look':
      p.head = -0.05; p.expr = 'neutral'; break;
    default: break;
  }
  return p;
}

/** 動物（貓、狗）的姿勢 */
export function animalPose(act, tau, u, ctx) {
  const s = Math.sin;
  const p = { bodyY: Math.sin(ctx.time * 2.4) * 1.5, tilt: 0, rot: 0, head: 0, legs: [0, 0, 0, 0], tail: 0.4 + 0.1 * s(ctx.time * 2), wag: 0, sit: 0, lie: 0, expr: 'neutral', mouth: 0, sx: 1, headDown: 0 };
  const gait = (amp, bounce, stride) => {
    const ph = (ctx.dist / stride) * TAU;
    p.legs = [amp * s(ph), -amp * s(ph), -amp * s(ph + 0.6), amp * s(ph + 0.6)];
    p.bodyY = Math.abs(s(ph)) * bounce; p.tail = 0.6;
  };
  switch (act) {
    case 'walk': if (ctx.moving) gait(0.4, 3, 110); break;
    case 'run': case 'chase': case 'flee':
      if (ctx.moving) { gait(0.85, 10, 150); p.tilt = 0.06; }
      p.expr = act === 'flee' ? 'scared' : act === 'chase' ? 'focus' : 'happy'; p.tail = 1.2; break;
    case 'sneak': if (ctx.moving) gait(0.3, 1, 90); p.bodyY -= 12; p.tail = -0.1; p.expr = 'sly'; break;
    case 'jump': {
      const air = u >= 0.2 && u <= 0.88 ? s(((u - 0.2) / 0.68) * Math.PI) : 0;
      p.bodyY = air * 120; p.legs = [0.8 * air, 0.8 * air, -0.8 * air, -0.8 * air]; p.tilt = -0.25 * s(u * TAU); p.expr = 'happy'; p.tail = 1.3; break;
    }
    case 'wave': case 'cheer': case 'dance': case 'laugh':
      p.wag = 1; p.bodyY = Math.max(0, s(tau * (act === 'dance' ? 7 : 9))) * (act === 'wave' ? 6 : 20); p.expr = 'happy'; p.mouth = act === 'laugh' ? 1 : 0.6;
      if (act === 'dance') p.tilt = 0.12 * s(tau * 7); break;
    case 'talk': p.mouth = Math.max(0, s(tau * 14)) * 0.9; p.head = -0.15; p.wag = 0.4; break;
    case 'cry': p.head = 0.35; p.tail = -0.4; p.expr = 'cry'; p.mouth = 0.4; break;
    case 'angry': p.tilt = -0.08; p.bodyY -= 6; p.tail = 1.5; p.expr = 'angry'; p.mouth = 0.7; break;
    case 'surprised': p.bodyY = s(seg(u, 0, 0.5) * Math.PI) * 50; p.tail = 1.6; p.expr = 'wow'; p.mouth = 0.8; break;
    case 'think': p.head = -0.3; p.expr = 'think'; break;
    case 'point': case 'look': case 'give': p.head = -0.1; p.expr = 'focus'; p.wag = 0.3; break;
    case 'sit': p.sit = EZ.io(seg(u, 0, 0.3)); p.wag = 0.3; p.expr = 'happy'; break;
    case 'sleep': p.lie = EZ.io(seg(u, 0, 0.3)); p.expr = 'sleep'; p.tail = -0.2; break;
    case 'fall': p.rot = (EZ.o(seg(u, 0, 0.3)) - EZ.io(seg(u, 0.78, 1))) * 1.4; p.expr = 'dizzy'; break;
    case 'spin': p.sx = Math.cos(u * TAU * 2); p.wag = 1; p.expr = 'happy'; break;
    case 'throw': { const k = seg(u, 0.2, 0.5); p.head = -0.5 * s(k * Math.PI); p.tilt = -0.1 * s(k * Math.PI); p.expr = 'focus'; break; }
    case 'pickup': case 'eat': { const k = s(seg(u, 0.1, 0.9) * Math.PI); p.headDown = act === 'eat' ? 0.8 + 0.2 * s(tau * 12) : k; p.wag = 0.6; p.expr = act === 'eat' ? 'yum' : 'neutral'; break; }
    case 'hug': p.tilt = 0.08; p.wag = 1; p.expr = 'laugh'; break;
    default: break;
  }
  if (p.wag) p.tail = 0.9 + 0.5 * s(ctx.time * 22) * p.wag;
  return p;
}

/** 兩個姿勢之間的混合（換動作時用，避免瞬間跳動） */
export function blendPose(a, b, k) {
  if (k >= 1) return b;
  const out = { ...b };
  for (const key of Object.keys(b)) {
    const va = a[key], vb = b[key];
    if (typeof vb === 'number' && typeof va === 'number') out[key] = lerp(va, vb, k);
    else if (Array.isArray(vb) && Array.isArray(va)) out[key] = vb.map((v, i) => lerp(va[i] ?? v, v, k));
  }
  return out;
}

// ======================================================================
//  畫出角色（透過畫風提供的 painter）
// ======================================================================
/**
 * @param {object} pt painter：pt.fill(points, color, opts)、pt.line(points, color, width, opts)、pt.face(...)
 * @param {object} ch 劇本角色
 * @param {{x:number, facing:number, pose:object, hold?:object, t:number}} st
 * @returns {{head:[number,number], hand:[number,number], top:number}} 錨點（道具、對話框、特效用）
 */
export function drawCharacter(pt, ch, st, drawProp) {
  return ch.kind === 'person' ? drawPerson(pt, ch, st, drawProp) : drawAnimal(pt, ch, st, drawProp);
}

function drawPerson(pt, ch, st, drawProp) {
  const S = (SIZES[ch.size] ?? 1) * CHAR_SCALE, f = st.facing, p = st.pose, key = ch.id;
  const thigh = 54 * S, shin = 52 * S, torso = 92 * S, R = 60 * S, upper = 46 * S, fore = 44 * S;
  const legEnd = (l) => { const k = dir(l[0]), kn = dir(l[0] - l[1]); return k[1] * thigh + kn[1] * shin; };
  const reach = Math.max(legEnd(p.legF), legEnd(p.legB));
  const sitDrop = (p.sitK ?? 0) * 0;
  let hipY = GROUND - reach - p.bodyY * S - sitDrop;
  if (p.sitK) hipY = GROUND - lerp(reach, 36 * S, p.sitK) - p.bodyY * 0;
  const X = st.x;
  // 局部座標（面向右），最後依 facing 鏡射、依 rot 繞腳底旋轉
  const pivot = [X, GROUND];
  const tr = ([x, y]) => {
    let lx = (x - X) * f * p.sx, ly = y;
    if (p.rot) {
      const c = Math.cos(p.rot * f), s = Math.sin(p.rot * f), dx = lx, dy = ly - pivot[1];
      lx = dx * c - dy * s; ly = pivot[1] + dx * s + dy * c;
    }
    return [X + lx, ly];
  };
  const T = (P) => P.map(tr);
  const hip = [X, hipY];
  const neck = [X + Math.sin(p.lean) * torso, hipY - Math.cos(p.lean) * torso];
  const sh = [lerp(hip[0], neck[0], 0.86), lerp(hip[1], neck[1], 0.86)];
  const limb = (o, a, l1, l2, bendSign) => {
    const d1 = dir(a[0]), e = [o[0] + d1[0] * l1, o[1] + d1[1] * l1];
    const d2 = dir(a[0] + bendSign * a[1]), h = [e[0] + d2[0] * l2, e[1] + d2[1] * l2];
    return [e, h];
  };
  const hipF = [hip[0] + 6 * S, hip[1]], hipB = [hip[0] - 8 * S, hip[1]];
  const [kneeF, footF] = limb(hipF, p.legF, thigh, shin, -1);
  const [kneeB, footB] = limb(hipB, p.legB, thigh, shin, -1);
  const shF = [sh[0] + 4 * S, sh[1]], shB = [sh[0] - 10 * S, sh[1] + 4 * S];
  const [elF, handF] = limb(shF, p.armF, upper, fore, 1);
  const [elB, handB] = limb(shB, p.armB, upper, fore, 1);
  const outfit = ch.color, sleeve = shade(outfit, -0.12), pants = ch.pants, shoe = '#3a2f38';
  const legW = 15 * S, armW = 13 * S;

  // 後方四肢
  pt.fill(T(capsulePts(...shB, ...elB, armW)), sleeve, { key: key + 'aB1', z: 'back' });
  pt.fill(T(capsulePts(...elB, ...handB, armW * 0.92)), sleeve, { key: key + 'aB2', z: 'back' });
  pt.fill(T(circlePts(...handB, 11 * S, 14)), shade(SKIN, -0.08), { key: key + 'hB' });
  pt.fill(T(capsulePts(...hipB, ...kneeB, legW)), shade(pants, -0.15), { key: key + 'lB1' });
  pt.fill(T(capsulePts(...kneeB, ...footB, legW * 0.92)), shade(pants, -0.15), { key: key + 'lB2' });
  pt.fill(T(ellipsePts(footB[0] + 8 * S, footB[1] - 4 * S, 18 * S, 10 * S, 0, 16)), shoe, { key: key + 'sB' });
  if (ch.hair === 'long') pt.fill(T(ellipsePts(neck[0] - 12 * S, neck[1] - R * 0.6, R * 0.95, R * 1.25, -p.lean, 28)), ch.hairColor, { key: key + 'hl', role: 'hair' });
  // 身體
  pt.fill(T(capsulePts(...hip, ...[lerp(hip[0], neck[0], 0.82), lerp(hip[1], neck[1], 0.82)], 34 * S, 30 * S, 12)), outfit, { key: key + 'torso', role: 'outfit' });
  pt.fill(T(ellipsePts(neck[0], neck[1] + 6 * S, 18 * S, 9 * S, p.lean, 14)), shade(outfit, 0.25), { key: key + 'collar' });
  // 前方腿
  pt.fill(T(capsulePts(...hipF, ...kneeF, legW)), pants, { key: key + 'lF1' });
  pt.fill(T(capsulePts(...kneeF, ...footF, legW * 0.92)), pants, { key: key + 'lF2' });
  pt.fill(T(ellipsePts(footF[0] + 8 * S, footF[1] - 4 * S, 19 * S, 10 * S, 0, 16)), shoe, { key: key + 'sF' });
  // 頭
  const hc = [neck[0] + Math.sin(p.lean + p.head) * R * 0.86, neck[1] - Math.cos(p.lean + p.head) * R * 0.86];
  drawHair(pt, ch, T, hc, R, p, 'back');
  pt.fill(T(circlePts(hc[0], hc[1], R, 40)), SKIN, { key: key + 'head', role: 'skin' });
  const eyeC = tr([hc[0] + R * 0.2, hc[1] + R * 0.12]);
  pt.face(eyeC[0], eyeC[1], R / 60, f * Math.sign(p.sx || 1), p.expr, p.mouth, { key, t: st.t, kind: 'person', rot: (p.rot || 0) * f });
  drawHair(pt, ch, T, hc, R, p, 'front');
  // 前方手臂與手上的東西
  pt.fill(T(capsulePts(...shF, ...elF, armW)), outfit, { key: key + 'aF1' });
  pt.fill(T(capsulePts(...elF, ...handF, armW * 0.92)), outfit, { key: key + 'aF2' });
  const hand = tr(handF);
  if (st.hold && drawProp) drawProp(st.hold, hand[0], hand[1], S, f);
  pt.fill(T(circlePts(...handF, 12 * S, 14)), SKIN, { key: key + 'hF' });
  const head = tr(hc);
  return { head, hand, top: head[1] - R * 1.1, scale: S, mouth: tr([hc[0] + R * 0.25, hc[1] + R * 0.5]) };
}

function drawHair(pt, ch, T, hc, R, p, layer) {
  const c = ch.hairColor, k = ch.id + 'hair', a = p.lean + p.head;
  const rot = (P) => P.map(([x, y]) => { const dx = x - hc[0], dy = y - hc[1], cs = Math.cos(a), sn = Math.sin(a); return [hc[0] + dx * cs - dy * sn, hc[1] + dx * sn + dy * cs]; });
  if (ch.hair === 'bald') return;
  if (layer === 'back') {
    if (ch.hair === 'bun') pt.fill(T(rot(circlePts(hc[0] - R * 0.35, hc[1] - R * 1.0, R * 0.38, 18))), c, { key: k + 'bun', role: 'hair' });
    if (ch.hair === 'pigtails') for (const sx of [-1, 1]) pt.fill(T(rot(ellipsePts(hc[0] + sx * R * 0.95, hc[1] + R * 0.2, R * 0.28, R * 0.5, sx * 0.3, 18))), c, { key: k + 'pt' + sx, role: 'hair' });
    return;
  }
  // 前層：頭頂與瀏海
  const cap = [];
  for (let i = 0; i <= 20; i++) { const t = Math.PI + (i / 20) * Math.PI; cap.push([hc[0] + Math.cos(t) * R * 1.04, hc[1] + Math.sin(t) * R * 1.04]); }
  if (ch.hair === 'spiky') {
    const spikes = [];
    for (let i = 0; i <= 8; i++) { const t = Math.PI * 1.05 + (i / 8) * Math.PI * 0.9, rr = R * (i % 2 ? 1.08 : 1.38); spikes.push([hc[0] + Math.cos(t) * rr, hc[1] + Math.sin(t) * rr]); }
    pt.fill(T(rot([...spikes, [hc[0] + R * 0.9, hc[1] - R * 0.05], [hc[0] - R * 0.95, hc[1] + R * 0.1]])), c, { key: k + 'sp', role: 'hair' });
  } else {
    const fringe = [[hc[0] + R * 1.02, hc[1] - R * 0.05], [hc[0] + R * 0.6, hc[1] - R * 0.32], [hc[0] + R * 0.15, hc[1] - R * 0.18], [hc[0] - R * 0.3, hc[1] - R * 0.36], [hc[0] - R * 0.98, hc[1] + (ch.hair === 'long' ? R * 0.5 : R * 0.15)]];
    pt.fill(T(rot([...cap, ...fringe])), c, { key: k + 'cap', role: 'hair' });
  }
}

function drawAnimal(pt, ch, st, drawProp) {
  const S = (SIZES[ch.size] ?? 1) * 1.25 * CHAR_SCALE, f = st.facing, p = st.pose, key = ch.id, X = st.x;
  const isCat = ch.kind === 'cat';
  const legH = (isCat ? 40 : 46) * S, bodyRx = (isCat ? 66 : 72) * S, bodyRy = (isCat ? 34 : 38) * S;
  const lie = p.lie, sit = p.sit;
  const by = GROUND - legH * (1 - lie * 0.75) - bodyRy - p.bodyY * S + sit * 10 * S;
  const tilt = p.tilt - sit * 0.45;
  const pivot = [X, GROUND];
  const tr = ([x, y]) => {
    let lx = (x - X) * f * p.sx, ly = y;
    if (p.rot) { const c = Math.cos(p.rot * f), s = Math.sin(p.rot * f), dy = ly - pivot[1]; [lx, ly] = [lx * c - dy * s, pivot[1] + lx * s + dy * c]; }
    return [X + lx, ly];
  };
  const T = (P) => P.map(tr);
  const body = (dx, dy) => [X + dx * Math.cos(tilt) - dy * Math.sin(tilt), by + dx * Math.sin(tilt) + dy * Math.cos(tilt)];
  const main = ch.color, dark = shade(main, -0.18), belly = shade(main, 0.35);
  const legW = 11 * S;
  const leg = (dx, a, col, k) => {
    const top = body(dx, bodyRy * 0.4);
    const len = Math.max(8, GROUND - top[1]) * (1 - lie * 0.6);
    const d = dir(a * (1 - lie));
    const foot = [top[0] + d[0] * len, Math.min(GROUND, top[1] + d[1] * len)];
    pt.fill(T(capsulePts(...top, ...foot, legW)), col, { key: key + k });
    pt.fill(T(ellipsePts(foot[0] + 5 * S, foot[1] - 4 * S, 12 * S, 7 * S, 0, 12)), shade(col, -0.05), { key: key + k + 'p' });
  };
  // 後面的腳
  leg(bodyRx * 0.62, p.legs[1], dark, 'l1');
  leg(-bodyRx * 0.55, p.legs[3] - sit * 1.2, dark, 'l3');
  // 尾巴
  const tailBase = body(-bodyRx * 0.92, -bodyRy * 0.2), tail = [];
  const segs = 7, tl = (isCat ? 80 : 42) * S;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, a = -Math.PI * 0.5 - p.tail * u * 1.2 + (isCat ? Math.sin(u * 3 + st.t * 2) * 0.25 : 0);
    tail.push([tailBase[0] - Math.cos(a) * tl * u * 0.6 - tl * u * 0.5, tailBase[1] + Math.sin(a) * tl * u]);
  }
  for (let i = 0; i < segs; i++) pt.fill(T(capsulePts(...tail[i], ...tail[i + 1], (isCat ? 9 : 10) * S * (1 - i / segs * 0.4))), main, { key: key + 'tail' + i, outline: i === 0 });
  // 身體
  pt.fill(T(ellipsePts(X, by, bodyRx, bodyRy, tilt, 32)), main, { key: key + 'body', role: 'fur' });
  pt.fill(T(ellipsePts(X + bodyRx * 0.15, by + bodyRy * 0.45, bodyRx * 0.6, bodyRy * 0.4, tilt, 20)), belly, { key: key + 'belly', outline: false });
  // 前面的腳
  leg(bodyRx * 0.5, p.legs[0], main, 'l0');
  leg(-bodyRx * 0.68, p.legs[2] - sit * 1.2, main, 'l2');
  // 頭
  const HR = (isCat ? 40 : 42) * S;
  const hd = body(bodyRx * 0.95, -bodyRy * 0.55 - (1 - p.headDown) * 18 * S + p.headDown * 40 * S);
  const ha = p.head + tilt;
  const H = (dx, dy) => [hd[0] + dx * Math.cos(ha) - dy * Math.sin(ha), hd[1] + dx * Math.sin(ha) + dy * Math.cos(ha)];
  if (isCat) {
    for (const ex of [-0.55, 0.45]) pt.fill(T([H(ex * HR - 0.3 * HR, -0.55 * HR), H(ex * HR, -1.25 * HR), H(ex * HR + 0.35 * HR, -0.6 * HR)]), ex < 0 ? dark : main, { key: key + 'ear' + ex });
  } else {
    pt.fill(T(ellipsePts(...H(-0.55 * HR, -0.2 * HR), HR * 0.3, HR * 0.62, ha + 0.35, 16)), dark, { key: key + 'earB' });
  }
  pt.fill(T(circlePts(hd[0], hd[1], HR, 32)), main, { key: key + 'head', role: 'fur' });
  if (!isCat) {
    pt.fill(T(ellipsePts(...H(0.7 * HR, 0.32 * HR), HR * 0.5, HR * 0.36, ha, 18)), belly, { key: key + 'snout' });
    pt.fill(T(ellipsePts(...H(1.08 * HR, 0.18 * HR), HR * 0.16, HR * 0.12, ha, 10)), '#2b2730', { key: key + 'nose', outline: false });
    pt.fill(T(ellipsePts(...H(0.05 * HR, -0.15 * HR), HR * 0.3, HR * 0.62, ha - 0.25, 16)), dark, { key: key + 'earF' });
  } else {
    pt.fill(T(ellipsePts(...H(0.72 * HR, 0.3 * HR), HR * 0.32, HR * 0.24, ha, 16)), belly, { key: key + 'muzzle', outline: false });
    pt.fill(T([H(0.86 * HR, 0.14 * HR), H(1.0 * HR, 0.14 * HR), H(0.93 * HR, 0.24 * HR)]), '#e47a8a', { key: key + 'nose', outline: false });
    for (const wy of [0.25, 0.4]) pt.line(T([H(1.05 * HR, wy * HR), H(1.45 * HR, (wy - 0.12) * HR)]), shade(main, -0.45), 2.2 * S, { key: key + 'wh' + wy });
  }
  const eyeC = tr(H(0.35 * HR, -0.1 * HR));
  pt.face(eyeC[0], eyeC[1], HR / 62, f * Math.sign(p.sx || 1), p.expr, p.mouth, { key, t: st.t, kind: ch.kind, rot: ha * f + (p.rot || 0) * f, mouthAt: tr(H(0.78 * HR, 0.55 * HR)) });
  const mouth = tr(H(1.0 * HR, 0.45 * HR));
  if (st.hold && drawProp) drawProp(st.hold, mouth[0], mouth[1] + 6 * S, S * 0.85, f);
  const head = tr(hd);
  return { head, hand: mouth, top: head[1] - HR * 1.3, scale: S, mouth };
}

export { SKIN };
