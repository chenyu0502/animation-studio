// node --test tests/：劇本檢查與時間軸（不需要瀏覽器）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScript } from '../js/engine/script.js';
import { compile, charState, flying, groundProps } from '../js/engine/compile.js';
import { cameraAt } from '../js/engine/render.js';
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
