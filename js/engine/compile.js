// 把劇本整理成「任何時間點都查得到狀態」的時間軸：角色位置與動作、道具在誰手上或飛在空中、
// 自動加上的特效與音效（丟中時的撞擊、跳躍、說話），以及鏡頭。
import { ACTIONS, SIZES } from './script.js';
import { animalPose, blendPose, idlePose, personPose } from './rig.js';
import { CHAR_SCALE, EZ, GROUND, clamp, lerp, seg } from './core.js';

/** 劇本的 0..100 → 世界座標 x */
export const stageX = (x) => 170 + x * 15.8;
const BLEND = 0.18;

export function compile(script) {
  const chars = script.characters;
  const byId = Object.fromEntries(chars.map((c) => [c.id, c]));
  const segs = Object.fromEntries(chars.map((c) => [c.id, []]));
  const start = Object.fromEntries(chars.map((c) => [c.id, { x: stageX(c.x), facing: c.facing }]));
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
    for (const e of propEvents[id]) {
      if (t < e.t) break;
      if (e.type === 'hold') holder = e.who;
      if (e.type === 'land' || e.type === 'drop') { holder = null; x = e.x; }
      if (e.type === 'gone') holder = '__gone';
    }
    return { x: holder && holder !== '__gone' ? placeAt(holder, t).x : x, holder };
  };

  for (const a of script.actions) {
    const ch = byId[a.who];
    if (!ch) continue;
    const t0 = a.t, t1 = a.t + a.dur;
    const here = placeAt(a.who, t0);
    let facing = here.facing, x1 = here.x;
    const S = (SIZES[ch.size] ?? 1) * CHAR_SCALE;
    const gap = (ch.kind === 'person' ? 150 : 150) * S;
    // 移動
    if (ACTIONS[a.do][2]) {
      let dest = null;
      if (typeof a.to === 'number') dest = stageX(a.to);
      else if (a.to && byId[a.to]) {
        const other = placeAt(a.to, a.do === 'chase' ? t1 : t0).x;
        dest = other + (here.x < other ? -gap : gap) * (a.do === 'flee' ? -3 : 1);
      } else if (a.to && propById[a.to]) dest = propPlaceAt(a.to, t0).x + (here.x < propPlaceAt(a.to, t0).x ? -40 : 40);
      else dest = here.x + facing * (a.do === 'flee' ? 500 : 320);
      x1 = clamp(dest, 90, 1830);
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
