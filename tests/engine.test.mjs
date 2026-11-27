// node --test tests/：劇本檢查與時間軸（不需要瀏覽器）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScript } from '../js/engine/script.js';
import { compile, charState, flying, groundProps, halfWidth, minGap, reach, touchGap } from '../js/engine/compile.js';
import { cameraAt } from '../js/engine/render.js';
import { placeBubble } from '../js/engine/painter.js';
import { sceneLayers, skyColors } from '../js/engine/scene.js';
import { SCENES, TIMES } from '../js/engine/script.js';
import { SAMPLES } from '../js/samples.js';

const finite = (v) => typeof v !== 'number' || Number.isFinite(v);
function sweep(model) {
  for (let f = 0; f < model.duration * 24; f++) {
    const t = f / 24;
    for (const c of model.script.characters) {
      const st = charState(model, c.id, t);
      assert.ok(Number.isFinite(st.x), `${c.id} x @${t}`);
      for (const [k, v] of Object.entries(st.pose)) assert.ok(Array.isArray(v) ? v.every(finite) : finite(v), `${c.id}.${k} @${t}`);
    }
    for (const p of flying(model, t)) assert.ok(Number.isFinite(p.wx) && Number.isFinite(p.wy));
    groundProps(model, t);
    const cam = cameraAt(model, t);
    assert.ok(Number.isFinite(cam.cx) && Number.isFinite(cam.cy) && cam.z >= 1);
  }
}

test('範例劇本全部時間點都算得出來', () => {
  for (const s of SAMPLES) { const { script, notes } = normalizeScript(s.script); assert.deepEqual(notes, []); sweep(compile(script)); }
});

test('AI 常見的寫法：中文名稱、別名、不認得的東西都能處理並說明', () => {
  const raw = {
    title: '兔子與烏龜', duration: '12', mood: '開心', scene: '海邊', time: 'night',
    characters: [
      { id: 'r', kind: 'rabbit', name: '小兔', color: '白' },
      { id: 't', kind: 'turtle', name: '阿龜', color: '#4fa35a' },
      { id: 'k', kind: 'boy', name: '小明', size: 'small', hair: 'curly' },
    ],
    props: [{ id: 'c', kind: 'carrot' }],
    actions: [
      { t: 0.5, who: '小兔', do: 'hop' }, { t: 1, who: 'r', do: '跑到', to: 80 }, { t: 2, who: 't', do: 'crawl', to: 70 },
      { t: 3, who: 'k', do: 'say', text: '加油！這是一句很長很長很長很長很長很長的台詞' }, { t: 4, who: 'k', do: 'toss', target: 'r' },
      { t: 5, who: 'nobody', do: 'jump' }, { t: 99, who: 'r', do: 'sleep' }, { t: 6, who: 'r', do: 'eat', prop: 'apple' },
    ],
    camera: [{ t: 1, shot: 'close', on: 'r' }, { t: 2, shot: 'close' }],
    captions: [{ t: 0, text: '' }, { t: 1, text: '比賽開始' }],
    effects: [{ t: 2, kind: 'boom' }, { t: 3, kind: 'sparkle', at: 't' }],
  };
  const { script, notes } = normalizeScript(raw);
  assert.equal(script.duration, 12);
  assert.equal(script.scene, 'beach');
  assert.deepEqual(script.characters.map((c) => c.kind), ['dog', 'person', 'person']);
  assert.equal(script.characters[0].color, '#f4f1ea');
  assert.ok(notes.some((n) => n.includes('rabbit')));
  assert.ok(notes.some((n) => n.includes('carrot')));
  assert.ok(notes.some((n) => n.includes('crawl')));
  assert.equal(script.actions.find((a) => a.who === 'r' && a.t === 0.5).do, 'jump');
  assert.ok(script.actions.every((a) => a.t <= 12));
  assert.equal(script.actions.filter((a) => a.who === 'nobody').length, 0);
  assert.equal(script.camera[0].t, 0);
  assert.equal(script.camera.length, 2, '沒有對象的特寫要被丟掉');
  assert.equal(script.captions.length, 1);
  assert.equal(script.effects.length, 1);
  sweep(compile(script));
});

test('空劇本也能播放', () => {
  const { script, notes } = normalizeScript({});
  assert.equal(script.characters.length, 1);
  assert.ok(notes.length > 0);
  sweep(compile(script));
});

test('同一顆雪球丟兩次會變成兩顆', () => {
  const { script } = normalizeScript({
    characters: [{ id: 'a', kind: 'person', x: 20 }, { id: 'b', kind: 'person', x: 80 }],
    actions: [{ t: 1, who: 'a', do: 'throw', prop: 'snowball', target: 'b' }, { t: 3, who: 'b', do: 'throw', prop: 'snowball', target: 'a' }],
  });
  assert.equal(script.props.filter((p) => p.kind === 'snowball').length, 2);
  const m = compile(script);
  assert.equal(m.projectiles.length, 2);
  assert.ok(m.projectiles.every((p) => Number.isFinite(p.t1) && Number.isFinite(p.x0)));
});

// ---- 站位：角色不能疊成一團（實測 AI 劇本常把角色擠在同一點） ----
const xAt = (m, id, t) => charState(m, id, t).x;
const build = (raw) => compile(normalizeScript({ duration: 12, scene: 'park', ...raw }).script);

test('貓狗的身體寬度合理：比人寬，但不會大到像馬', () => {
  const kid = { kind: 'person', size: 'small' }, adult = { kind: 'person', size: 'normal' }, dog = { kind: 'dog', size: 'normal' };
  assert.ok(halfWidth(dog) > halfWidth(kid), '狗身體橫躺，比人寬');
  assert.ok(halfWidth(dog) < halfWidth(adult) * 2.2, '狗不能大到像馬');
});

test('一開始擠在一起的角色會被拉開', () => {
  const m = build({ characters: [{ id: 'a', kind: 'dog', x: 50 }, { id: 'b', kind: 'cat', x: 52 }, { id: 'c', kind: 'person', x: 54 }], actions: [{ t: 0, who: 'a', do: 'idle' }] });
  const xs = ['a', 'b', 'c'].map((id) => xAt(m, id, 0)).sort((p, q) => p - q);
  assert.ok(xs[1] - xs[0] >= 200 && xs[2] - xs[1] >= 200, `間距不足：${xs.map(Math.round)}`);
});

test('走過去擁抱時站在碰得到的距離，不會疊在一起', () => {
  const m = build({
    characters: [{ id: 'kid', kind: 'person', size: 'small', x: 10 }, { id: 'dog', kind: 'dog', x: 80 }],
    actions: [{ t: 0.5, who: 'kid', do: 'run', to: 'dog', dur: 1.5 }, { t: 2.2, who: 'kid', do: 'hug', target: 'dog' }],
  });
  const d = Math.abs(xAt(m, 'kid', 2.5) - xAt(m, 'dog', 2.5));
  const { kid, dog } = m.byId;
  assert.ok(d >= touchGap(kid, dog) * 0.95 && d <= minGap(kid, dog), `擁抱距離 ${Math.round(d)}`);
});

test('走到數字位置後要互動：會停在對方旁邊，不會停在對方身上', () => {
  const m = build({
    characters: [{ id: 'a', kind: 'person', x: 10 }, { id: 'b', kind: 'cat', x: 60 }],
    actions: [{ t: 0.5, who: 'a', do: 'walk', to: 60, dur: 2 }, { t: 2.6, who: 'a', do: 'give', prop: 'flower', target: 'b' }],
  });
  const d = Math.abs(xAt(m, 'a', 2.6) - xAt(m, 'b', 2.6));
  assert.ok(d >= touchGap(m.byId.a, m.byId.b) * 0.95, `給東西時距離 ${Math.round(d)}`);
});

test('好幾個角色同時跑到同一點：大家都有移動，而且各自分開', () => {
  const ids = ['k1', 'k2', 'k3', 'c', 'd'];
  const m = build({
    characters: [...['k1', 'k2', 'k3'].map((id, i) => ({ id, kind: 'person', size: 'small', x: 30 + i * 10 })), { id: 'c', kind: 'cat', x: 20 }, { id: 'd', kind: 'dog', x: 70 }],
    actions: ids.map((who) => ({ t: 1, who, do: 'run', to: 80, dur: 2 })),
  });
  for (const id of ids) assert.ok(Math.abs(xAt(m, id, 3.5) - xAt(m, id, 0.5)) > 4 || xAt(m, id, 0.5) > 1300, `${id} 沒有移動`);
  const xs = ids.map((id) => [id, xAt(m, id, 3.5)]).sort((p, q) => p[1] - q[1]);
  for (let i = 1; i < xs.length; i++) {
    const need = (halfWidth(m.byId[xs[i - 1][0]]) + halfWidth(m.byId[xs[i][0]])) * 0.7;
    assert.ok(xs[i][1] - xs[i - 1][1] >= need, `${xs[i - 1][0]} 與 ${xs[i][0]} 疊在一起：${Math.round(xs[i][1] - xs[i - 1][1])}`);
  }
});

test('走過去撿東西：就算旁邊有人，也會站到道具旁邊', () => {
  const m = build({
    characters: [{ id: 'boy', kind: 'person', size: 'small', x: 30 }, { id: 'dog', kind: 'dog', x: 60 }],
    props: [{ id: 'bone', kind: 'bone', x: 32 }],
    actions: [{ t: 1, who: 'dog', do: 'run', to: 33, dur: 0.6 }, { t: 1.7, who: 'dog', do: 'pickup', prop: 'bone' }],
  });
  // 量狗嘴（頭在身體前面）到骨頭的距離，不是身體中心
  const bone = groundProps(m, 1.6).find((p) => p.id === 'bone');
  const st = charState(m, 'dog', 1.7), mouth = st.x + st.facing * reach(m.byId.dog);
  assert.ok(Math.abs(mouth - bone.wx) <= 70, `狗嘴離骨頭 ${Math.round(Math.abs(mouth - bone.wx))}`);
});

test('對方等一下要來找我：我移動時會停在對方碰得到的地方', () => {
  const m = build({
    characters: [{ id: 'dog', kind: 'dog', x: 80 }, { id: 'kid', kind: 'person', x: 60 }],
    actions: [{ t: 1, who: 'dog', do: 'run', to: 45, dur: 1.5 }, { t: 1.5, who: 'kid', do: 'run', to: 20, dur: 1.3 }, { t: 3, who: 'dog', do: 'give', prop: 'ball', target: 'kid' }],
  });
  const d = Math.abs(xAt(m, 'dog', 3) - xAt(m, 'kid', 3));
  assert.ok(d <= minGap(m.byId.dog, m.byId.kid) * 1.1, `給東西時相距 ${Math.round(d)}`);
});

// ---- 對話框與字幕 ----
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('對話框預設放在頭頂上', () => {
  const b = placeBubble(300, 120, 900, 600);
  assert.ok(b.y + b.h <= 600 - 12 && Math.abs(b.x + 150 - 900) < 1);
});

test('對話框避開上方字幕', () => {
  const cap = { x: 560, y: 42, w: 800, h: 156 };
  const b = placeBubble(300, 120, 960, 260, [cap]);
  assert.ok(!hit(b, cap), JSON.stringify(b));
});

test('特寫時頭頂貼近上緣：兩個對話框不互相重疊，也不壓到字幕', () => {
  const cap = { x: 460, y: 42, w: 1000, h: 156 };
  const a = placeBubble(500, 120, 1300, 60, [cap]);
  const b = placeBubble(500, 120, 1650, 150, [cap, a]);
  assert.ok(!hit(a, cap) && !hit(b, cap) && !hit(a, b), JSON.stringify({ a, b }));
});

// ---- 天氣 ----
test('下雨天的天空比晴天暗、偏灰', () => {
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; };
  const sunny = skyColors('city', 'day', 'none'), rainy = skyColors('city', 'day', 'rain');
  assert.ok(lum(rainy.top) < lum(sunny.top) && rainy.tint, JSON.stringify(rainy));
});

// ---- 畫面外進出場 ----
test('角色可以從畫面外走進來，也可以走出畫面', () => {
  const m = build({
    characters: [{ id: 'kid', kind: 'person', x: 40 }, { id: 'cat', kind: 'cat', x: 110, facing: 'left' }],
    actions: [{ t: 1, who: 'cat', do: 'walk', to: 60, dur: 2 }, { t: 5, who: 'kid', do: 'run', to: -10, dur: 1.5 }],
  });
  assert.ok(xAt(m, 'cat', 0.5) > 1920 + halfWidth(m.byId.cat), '一開始貓在右邊畫面外');
  assert.ok(xAt(m, 'cat', 3.5) < 1800, '貓走進畫面');
  assert.ok(xAt(m, 'kid', 7) < -halfWidth(m.byId.kid), '小孩跑出左邊畫面');
});

test('不合理的位置：小於 0 當左邊畫面外、大於 100 當右邊畫面外', () => {
  const { script } = normalizeScript({ characters: [{ id: 'a', kind: 'dog', x: -50 }, { id: 'b', kind: 'cat', x: 300 }], actions: [{ t: 0, who: 'a', do: 'walk', to: 999 }] });
  assert.deepEqual(script.characters.map((c) => c.x), [-10, 110]);
  assert.equal(script.actions[0].to, 110);
});

// ---- 場景每一格都要一樣（不能每格重新抽亂數） ----
const recorder = () => {
  const shapes = {};
  return { shapes, fill: (P, col, o = {}) => { shapes[o.key ?? Object.keys(shapes).length] = P.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]); }, line: () => {} };
};
test('場景同一個時間點畫兩次結果一樣，相鄰兩格的雲、大樓、樹不會跳位', () => {
  for (const scene of Object.keys(SCENES)) for (const time of Object.keys(TIMES)) for (const weather of ['none', 'rain']) {
    const layers = sceneLayers(scene, time, '測試', weather);
    for (const [li, L] of layers.entries()) {
      const a = recorder(), b = recorder(), c = recorder();
      L.draw(a, 3); L.draw(b, 3); L.draw(c, 3 + 1 / 24);
      assert.deepEqual(a.shapes, b.shapes, `${scene}/${time}/${weather} 第 ${li} 層兩次不同`);
      for (const [k, P] of Object.entries(a.shapes)) {
        const Q = c.shapes[k];
        if (!Q) continue;
        const move = Math.max(...P.map(([x, y], i) => Math.hypot(x - Q[i][0], y - Q[i][1])));
        // 雲每秒最多飄 32px，一格約 1.3px；雲從右邊繞回左邊時會跳整個畫面寬，排除
        assert.ok(move < 5 || move > 1900, `${scene}/${time}/${weather} 第 ${li} 層 ${k} 一格移動 ${move.toFixed(1)}px`);
      }
    }
  }
});

// ---- 撿東西：手或嘴要碰得到道具，不能隔空撿 ----
/** 每個 pickup 開始時，角色的手／嘴到道具的距離 */
const pickupGaps = (m) => m.script.actions.filter((a) => a.do === 'pickup' && a.prop).map((a) => {
  const g = groundProps(m, a.t + a.dur * 0.45).find((p) => p.id === a.prop);
  if (!g) return null;
  const st = charState(m, a.who, a.t + a.dur * 0.45);
  return { who: a.who, t: a.t, gap: Math.abs(st.x + st.facing * reach(m.byId[a.who]) - g.wx) };
}).filter(Boolean);

test('範例劇本撿東西時都碰得到道具', () => {
  for (const s of SAMPLES) for (const p of pickupGaps(compile(normalizeScript(s.script).script))) assert.ok(p.gap <= 120, `${s.title ?? ''} ${p.who}@${p.t} 隔空 ${Math.round(p.gap)}px`);
});

test('丟出去的球還在空中時跑去撿：跑向落點，不會跑向丟的人', () => {
  const m = build({
    characters: [{ id: 'kid', kind: 'person', x: 20, facing: 'right' }, { id: 'dog', kind: 'dog', x: 32, facing: 'right' }],
    props: [{ id: 'ball', kind: 'ball', holder: 'kid' }],
    actions: [{ t: 1, who: 'kid', do: 'throw', prop: 'ball' }, { t: 1.6, who: 'dog', do: 'run', to: 'ball', dur: 1.3 }, { t: 3, who: 'dog', do: 'pickup', prop: 'ball' }],
  });
  assert.ok(xAt(m, 'dog', 2.9) > xAt(m, 'dog', 1.5), '狗要往球飛去的方向跑');
  for (const p of pickupGaps(m)) assert.ok(p.gap <= 120, `狗嘴離球 ${Math.round(p.gap)}px`);
});
