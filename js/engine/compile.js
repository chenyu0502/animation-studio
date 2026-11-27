// 把劇本整理成「任何時間點都查得到狀態」的時間軸：角色位置與動作、道具在誰手上或飛在空中、
// 自動加上的特效與音效（丟中時的撞擊、跳躍、說話），以及鏡頭。
import { ACTIONS, SIZES } from './script.js';
import { animalPose, blendPose, idlePose, personPose } from './rig.js';
import { ANIMAL_SCALE, CHAR_SCALE, EZ, GROUND, clamp, lerp, seg } from './core.js';

/** 劇本的 0..100 → 世界座標 x */
export const stageX = (x) => (x < 0 ? OFF_LEFT_X : x > 100 ? OFF_RIGHT_X : 170 + x * 15.8);
/** 畫面外的世界座標：離邊緣夠遠，連最大的狗都完全看不到 */
const OFF_LEFT_X = -300, OFF_RIGHT_X = 2220;
const isOff = (wx) => wx < 0 || wx > 1920;
const BLEND = 0.18;
/** 舞台上角色中心能到的範圍（世界座標） */
const MIN_X = 90, MAX_X = 1830;

/**
 * 角色身體的半寬（世界座標）。貓狗身體橫躺、頭在前面，比人寬很多；
 * 站位都用它算，角色才不會疊成一團。
 */
export function halfWidth(ch) {
  const s = (SIZES[ch.size] ?? 1) * CHAR_SCALE;
  if (ch.kind === 'person') return 52 * s;
  return (ch.kind === 'cat' ? 98 : 105) * ANIMAL_SCALE * s;
}
/** 撿東西時，手（人）或嘴（貓狗，頭在身體最前面）離身體中心多遠 */
export const reach = (ch) => (ch.kind === 'person' ? 40 : halfWidth(ch) * 0.95);

/** 兩個角色站著時至少要隔多遠（各自半寬相加再留一點空隙） */
export const minGap = (a, b) => halfWidth(a) + halfWidth(b) + 24;
/** 互動（擁抱、給東西、說話）時站多近：身體剛好碰到 */
export const touchGap = (a, b) => (halfWidth(a) + halfWidth(b)) * 0.82;

/**
 * 把一開始的站位拉開：依位置排序，太近的往右推，超出舞台再整體往左推回來。
 * 角色太多、舞台放不下時，平均分配整個舞台。
 */
export function spreadStart(chars, xs) {
  const order = chars.map((c, i) => i).sort((i, j) => xs[i] - xs[j]);
  const out = xs.slice();
  const need = order.slice(1).reduce((sum, k, n) => sum + minGap(chars[order[n]], chars[k]), 0);
  if (need > MAX_X - MIN_X) {
    order.forEach((k, n) => { out[k] = MIN_X + ((MAX_X - MIN_X) * n) / Math.max(1, order.length - 1); });
    return out;
  }
  for (let n = 1; n < order.length; n++) {
    const a = order[n - 1], b = order[n];
    out[b] = Math.max(out[b], out[a] + minGap(chars[a], chars[b]));
  }
  for (let n = order.length - 1; n >= 0; n--) {
    const b = order[n], next = order[n + 1];
    const limit = next === undefined ? MAX_X : out[next] - minGap(chars[b], chars[next]);
    out[b] = Math.min(out[b], limit);
  }
  for (const k of order) out[k] = Math.max(MIN_X, out[k]);
  return out;
}

export function compile(script) {
  const chars = script.characters;
  const byId = Object.fromEntries(chars.map((c) => [c.id, c]));
  const segs = Object.fromEntries(chars.map((c) => [c.id, []]));
  // 一開始在畫面外的角色不參與拉開（它們等一下才會走進來）
  const onIdx = chars.map((c, i) => i).filter((i) => !isOff(stageX(chars[i].x)));
  const spread = spreadStart(onIdx.map((i) => chars[i]), onIdx.map((i) => stageX(chars[i].x)));
  const startX = chars.map((c) => stageX(c.x));
  onIdx.forEach((i, n) => { startX[i] = spread[n]; });
  const start = Object.fromEntries(chars.map((c, i) => [c.id, { x: startX[i], facing: c.facing }]));
  const sfx = [];
  const autoFx = [];
  const projectiles = [];
  const propEvents = Object.fromEntries(script.props.map((p) => [p.id, []]));
  const propById = Object.fromEntries(script.props.map((p) => [p.id, p]));

  /** 角色在 t 秒的位置與面向（只看已經排好的片段） */
  const placeAt = (id, t) => {
    let { x, facing } = start[id];
    for (const s of segs[id]) {
      if (t < s.t0) break;
      if (s.overlay) continue;
      const u = s.move ? EZ.io(seg(t, s.t0, s.t1)) : 1;
      x = s.move ? lerp(s.x0, s.x1, u) : s.x1;
      facing = s.facing;
    }
    return { x, facing };
  };
  const propPlaceAt = (id, t) => {
    const p = propById[id];
    let x = stageX(p.x), holder = p.holder;
    const evs = propEvents[id];
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (t < e.t) break;
      if (e.type === 'hold') holder = e.who;
      // 丟出去、還在空中：當成已經在落點。角色這時跑去撿，會跑向球要落下的地方（像狗預判落點），
      // 不會以為球還在丟的人手上而跑反方向。
      if (e.type === 'fly') {
        holder = null;
        const end = evs.slice(i + 1).find((n) => n.type === 'land' || n.type === 'drop' || n.type === 'gone');
        if (end?.x !== undefined) x = end.x;
        if (end?.type === 'gone') holder = '__gone';
      }
      if (e.type === 'land' || e.type === 'drop') { holder = null; x = e.x; }
      if (e.type === 'gone') holder = '__gone';
    }
    return { x: holder && holder !== '__gone' ? placeAt(holder, t).x : x, holder };
  };

  /**
   * 為移動挑一個落腳點：在整個舞台上找「和別人重疊最少、離原本目的地最近」的位置。
   * partner 是走過去之後要互動的對象：要站在碰得到他的距離（左右兩側都試）。
   * 用打分數而不是一個推一個，角色很多時才不會被推回原地或推到舞台邊。
   */
  const placeFor = (dest, who, t, partner, fromX, propX = null) => {
    const me = byId[who];
    const others = chars.filter((c) => c.id !== who && c.id !== partner).map((c) => ({ x: placeAt(c.id, t).x, gap: minGap(me, c) }));
    const px = partner ? placeAt(partner, t).x : null, touch = partner ? touchGap(me, byId[partner]) : 0;
    const cost = (x) => {
      let c = 0;
      for (const o of others) c += Math.max(0, o.gap - Math.abs(x - o.x)) * 4;
      if (partner) c += Math.abs(Math.abs(x - px) - touch) * 6 + Math.max(0, touch * 0.8 - Math.abs(x - px)) * 20;
      // 走過去要撿的道具：手（人）或嘴（貓狗）要碰得到道具（誤差 60px 內），比避開別人重要
      if (propX !== null) c += Math.max(0, Math.abs(Math.abs(x - propX) - reach(me)) - 60) * 30;
      // 劇本要角色走去遠處，卻停在原地（看起來像在原地跑步）：扣分
      if (Math.abs(dest - fromX) > 150) c += Math.max(0, 120 - Math.abs(x - fromX)) * 8;
      return c + Math.abs(x - dest);
    };
    let best = clamp(dest, MIN_X, MAX_X), bestCost = cost(best);
    for (let x = MIN_X; x <= MAX_X; x += 10) {
      const c = cost(x);
      if (c < bestCost - 1e-6) { best = x; bestCost = c; }
    }
    return best;
  };

  for (const a of script.actions) {
    const ch = byId[a.who];
    if (!ch) continue;
    const t0 = a.t, t1 = a.t + a.dur;
    const here = placeAt(a.who, t0);
    let facing = here.facing, x1 = here.x;
    // 移動
    if (ACTIONS[a.do][2]) {
      let dest = null;
      // 走過去之後馬上要和誰互動（擁抱、給東西、說話…）：站到碰得到對方的距離
      const soon = (b) => b !== a && b.t >= t1 - 0.05 && b.t <= t1 + 1.5;
      const next = script.actions.find((b) => soon(b) && b.who === a.who && b.target && byId[b.target]);
      // 反過來：別人等一下要來找我互動（例如把東西給我），我也要停在對方碰得到的地方
      const comer = script.actions.find((b) => soon(b) && b.target === a.who && byId[b.who]);
      const pick = script.actions.find((b) => soon(b) && b.who === a.who && b.do === 'pickup' && b.prop && propById[b.prop]);
      let partner = null, propX = null;
      if (typeof a.to === 'number') {
        dest = stageX(a.to);
        const cand = next?.target ?? comer?.who;
        if (cand && Math.abs(dest - placeAt(cand, t1).x) < minGap(ch, byId[cand]) * 2.5) partner = cand;
        if (pick) {
          const g = propPlaceAt(pick.prop, t1);
          if (!g.holder) { propX = g.x; dest = g.x + (here.x < g.x ? -1 : 1) * reach(ch); }
        }
      } else if (a.to && byId[a.to]) {
        partner = a.to;
        const other = placeAt(a.to, a.do === 'chase' ? t1 : t0).x;
        const side = here.x < other ? -1 : 1;
        dest = a.do === 'flee' ? other - side * 3 * minGap(ch, byId[a.to]) : other + side * touchGap(ch, byId[a.to]);
      } else if (a.to && propById[a.to]) { propX = propPlaceAt(a.to, t0).x; dest = propX + (here.x < propX ? -1 : 1) * reach(ch); }
      else dest = here.x + facing * (a.do === 'flee' ? 500 : 320);
      // 走到畫面外（離場）：直接走出去，不用找落腳點
      x1 = typeof a.to === 'number' && isOff(dest) ? dest : placeFor(clamp(dest, MIN_X, MAX_X), a.who, t1, a.do === 'flee' ? null : partner, here.x, propX);
      if (Math.abs(x1 - here.x) > 4) facing = x1 > here.x ? 1 : -1;
    } else if (a.target && byId[a.target]) {
      const ox = placeAt(a.target, t0).x;
      if (Math.abs(ox - here.x) > 10) facing = ox > here.x ? 1 : -1;
    }
    const move = Math.abs(x1 - here.x) > 4;
    segs[a.who].push({ t0, t1, act: a.do, x0: here.x, x1, move, facing, text: a.text ?? null, target: a.target ?? null, dist0: 0 });
    // 道具
    if (a.prop && propById[a.prop]) {
      const pid = a.prop;
      if (a.do === 'pickup') propEvents[pid].push({ t: t0 + a.dur * 0.5, type: 'hold', who: a.who });
      if (a.do === 'give' && a.target) {
        propEvents[pid].push({ t: t0, type: 'hold', who: a.who });
        propEvents[pid].push({ t: t0 + a.dur * 0.55, type: 'hold', who: a.target });
      }
      if (a.do === 'eat') {
        propEvents[pid].push({ t: t0, type: 'hold', who: a.who });
        propEvents[pid].push({ t: t1, type: 'gone' });
        sfx.push({ t: t0 + 0.2, kind: 'munch' });
      }
      if (a.do === 'throw') {
        const rel = t0 + a.dur * 0.5;
        const hold = propPlaceAt(pid, t0).holder;
        if (hold !== a.who) propEvents[pid].push({ t: t0, type: 'hold', who: a.who });
        const from = placeAt(a.who, rel);
        let toX, hitId = null;
        if (a.target && byId[a.target]) { hitId = a.target; toX = placeAt(a.target, rel + 0.5).x; }
        else toX = from.x + facing * 520;
        const flight = clamp(Math.abs(toX - from.x) / 1300, 0.35, 0.85);
        projectiles.push({ prop: pid, from: a.who, t0: rel, t1: rel + flight, x0: from.x, x1: toX, hit: hitId, facing });
        propEvents[pid].push({ t: rel, type: 'fly' });
        const kind = propById[pid].kind;
        propEvents[pid].push({ t: rel + flight, type: kind === 'snowball' ? 'gone' : 'land', x: toX + facing * 60 });
        sfx.push({ t: rel, kind: 'whoosh' });
        sfx.push({ t: rel + flight, kind: hitId ? 'hit' : 'thud' });
        if (hitId) autoFx.push({ t: rel + flight, kind: 'impact', at: hitId, auto: true, shake: 1 });
        if (hitId) segs[hitId].push({ t0: rel + flight, t1: rel + flight + 0.45, act: '_hit', overlay: true, from: facing });
      }
    }
    if (a.do === 'jump') sfx.push({ t: t0 + a.dur * 0.22, kind: 'boing' });
    if (a.do === 'fall') { sfx.push({ t: t0 + a.dur * 0.25, kind: 'thud' }); autoFx.push({ t: t0 + a.dur * 0.28, kind: 'smoke', at: a.who, auto: true, shake: 0.6 }); }
    if (a.do === 'talk') sfx.push({ t: t0, kind: 'blip', dur: a.dur });
    if (a.do === 'cheer' || a.do === 'dance') sfx.push({ t: t0, kind: 'chime' });
    if (a.do === 'surprised') { sfx.push({ t: t0, kind: 'pop' }); autoFx.push({ t: t0, kind: 'exclaim', at: a.who, auto: true }); }
    if (a.do === 'sleep') autoFx.push({ t: t0 + 0.5, kind: 'zzz', at: a.who, auto: true, dur: a.dur - 0.5 });
    if (a.do === 'think') autoFx.push({ t: t0 + 0.2, kind: 'question', at: a.who, auto: true });
    if (a.do === 'hug') autoFx.push({ t: t0 + 0.3, kind: 'hearts', at: a.who, auto: true });
    if (a.do === 'cry') autoFx.push({ t: t0, kind: 'sweat', at: a.who, auto: true });
  }
  for (const id of Object.keys(segs)) {
    // 片段依開始時間排序（被打中的反應是後來加的）；主要片段與疊加片段分開
    const all = segs[id].sort((a, b) => a.t0 - b.t0);
    segs[id] = all.filter((s) => !s.overlay);
    segs[id].overlays = all.filter((s) => s.overlay);
    // 走路週期要用累積距離：記下每段開始時已經走了多遠
    let dist = 0;
    for (const s of segs[id]) { s.dist0 = dist; if (s.move) dist += Math.abs(s.x1 - s.x0); }
  }
  for (const id of Object.keys(propEvents)) propEvents[id].sort((a, b) => a.t - b.t);
  const effects = [...script.effects.map((e) => ({ ...e })), ...autoFx].sort((a, b) => a.t - b.t);
  for (const e of script.effects) if (e.kind === 'impact') sfx.push({ t: e.t, kind: 'hit' });
  for (const c of script.captions) sfx.push({ t: c.t, kind: 'caption' });

  return {
    script, byId, segs, start, projectiles, propEvents, propById, effects, sfx: sfx.sort((a, b) => a.t - b.t),
    duration: script.duration, placeAt, propPlaceAt,
  };
}

/** 角色在 t 秒的完整狀態：位置、面向、姿勢、手上的道具、正在說的話 */
export function charState(model, id, t) {
  const ch = model.byId[id];
  const list = model.segs[id];
  const isPerson = ch.kind === 'person';
  const poseFn = isPerson ? personPose : animalPose;
  const idle = (time) => (isPerson ? idlePose(time) : animalPose('idle', 0, 0, { time, dist: 0, moving: false }));
  let { x, facing } = model.start[id];
  let cur = null, prev = null, dist = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (t < s.t0) break;
    if (t < s.t1) { cur = s; prev = list[i - 1] ?? null; }
    else if (cur && cur.t1 <= t) cur = null;
    const u = s.move ? EZ.io(seg(t, s.t0, s.t1)) : 1;
    x = s.move ? lerp(s.x0, s.x1, u) : s.x1;
    facing = s.facing;
    dist = s.dist0 + (s.move ? Math.abs(x - s.x0) : 0);
  }
  let pose;
  if (cur) {
    const tau = t - cur.t0, u = seg(t, cur.t0, cur.t1);
    pose = poseFn(cur.act, tau, u, { time: t, dist, moving: cur.move });
    // 剛開始的 0.18 秒從前一個姿勢（或站姿）過渡
    if (tau < BLEND) {
      const before = prev && prev.t1 > cur.t0 - 0.05
        ? poseFn(prev.act, prev.t1 - prev.t0, 1, { time: cur.t0, dist, moving: false })
        : idle(cur.t0);
      pose = blendPose(before, pose, EZ.io(tau / BLEND));
    }
  } else {
    pose = idle(t);
    const last = list.filter((s) => s.t1 <= t).pop();
    if (last && t - last.t1 < BLEND) {
      const end = poseFn(last.act, last.t1 - last.t0, 1, { time: last.t1, dist, moving: false });
      pose = blendPose(end, pose, EZ.io((t - last.t1) / BLEND));
    }
  }
  // 被打中：往後仰一下
  for (const o of list.overlays ?? []) {
    if (t >= o.t0 && t < o.t1) {
      const k = Math.sin(seg(t, o.t0, o.t1) * Math.PI);
      if (isPerson) { pose = { ...pose, lean: (pose.lean ?? 0) - 0.35 * k * (o.from === facing ? -1 : 1), expr: 'wow', mouth: 0.8 }; }
      else pose = { ...pose, tilt: (pose.tilt ?? 0) - 0.3 * k, expr: 'wow' };
    }
  }
  // 手上的道具
  let hold = null;
  for (const [pid, evs] of Object.entries(model.propEvents)) {
    let holder = model.propById[pid].holder;
    for (const e of evs) { if (t < e.t) break; if (e.type === 'hold') holder = e.who; if (['land', 'drop', 'gone', 'fly'].includes(e.type)) holder = null; }
    if (holder === id) { hold = { id: pid, kind: model.propById[pid].kind, color: model.propById[pid].color, eatK: eatProgress(model, pid, id, t) }; break; }
  }
  const talking = cur && cur.act === 'talk' && cur.text ? { text: cur.text, u: seg(t, cur.t0, cur.t1), t0: cur.t0 } : null;
  return { x, facing, pose, hold, talking, act: cur?.act ?? 'idle' };
}

function eatProgress(model, pid, who, t) {
  const a = model.script.actions.find((a) => a.do === 'eat' && a.prop === pid && a.who === who && t >= a.t && t < a.t + a.dur);
  return a ? seg(t, a.t, a.t + a.dur) : 0;
}

/** 落在地上的道具（沒人拿、沒在飛、沒消失） */
export function groundProps(model, t) {
  const out = [];
  for (const p of model.script.props) {
    let holder = p.holder, x = stageX(p.x), state = holder ? 'held' : 'ground';
    for (const e of model.propEvents[p.id]) {
      if (t < e.t) break;
      if (e.type === 'hold') { holder = e.who; state = 'held'; }
      if (e.type === 'fly') state = 'fly';
      if (e.type === 'land' || e.type === 'drop') { state = 'ground'; x = e.x; holder = null; }
      if (e.type === 'gone') state = 'gone';
    }
    if (state === 'ground') out.push({ ...p, wx: x });
  }
  return out;
}

/** 飛行中的道具 */
export function flying(model, t) {
  return model.projectiles.filter((p) => t >= p.t0 && t < p.t1).map((p) => {
    const u = seg(t, p.t0, p.t1);
    const dx = Math.abs(p.x1 - p.x0);
    const y0 = GROUND - 170 * CHAR_SCALE, y1 = p.hit ? GROUND - 160 * CHAR_SCALE : GROUND - 20;
    return { ...p, kind: model.propById[p.prop].kind, color: model.propById[p.prop].color, wx: lerp(p.x0 + p.facing * 40 * CHAR_SCALE, p.x1, u), wy: lerp(y0, y1, u) - Math.sin(u * Math.PI) * (120 + dx * 0.12), spin: u * 9 };
  });
}

export { idlePose };
