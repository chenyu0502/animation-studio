// 劇本格式與檢查。AI（或範例）寫出的劇本先經過 normalizeScript，所有欄位都變成引擎看得懂的值：
// 不認得的動作、場景、顏色會換成最接近的，超出範圍的時間會被夾住，並把換掉的東西記在 notes 裡告訴使用者。
//
// 劇本與畫風無關：同一份劇本可以用任何畫風播放。

export const SCENES = {
  snow: '雪地公園',
  beach: '海邊',
  city: '城市街道',
  forest: '森林',
  park: '草地公園',
  room: '家裡客廳',
};
export const TIMES = { day: '白天', sunset: '黃昏', night: '晚上' };
export const WEATHERS = { none: '無', snow: '下雪', rain: '下雨', leaves: '落葉', petals: '花瓣', stars: '星星' };
export const MOODS = { happy: '歡樂', playful: '俏皮', epic: '熱血', calm: '溫馨', tense: '緊張', sad: '感傷' };
export const KINDS = { person: '人', cat: '貓', dog: '狗' };
export const SIZES = { small: 0.78, normal: 1, big: 1.18 };
export const HAIRS = ['short', 'long', 'spiky', 'bun', 'pigtails', 'bald'];

/** 動作：名稱 → [說明, 預設秒數, 是否移動位置] */
export const ACTIONS = {
  idle: ['站著', 1, false],
  walk: ['走到', 1.6, true],
  run: ['跑到', 1, true],
  sneak: ['躡手躡腳走到', 1.8, true],
  chase: ['追（to 填對象）', 1.4, true],
  flee: ['逃跑（to 填位置）', 1.2, true],
  jump: ['跳起來', 0.7, false],
  wave: ['揮手', 1.2, false],
  cheer: ['歡呼', 1.2, false],
  dance: ['跳舞', 2, false],
  talk: ['說話（text 填台詞）', 1.8, false],
  laugh: ['大笑', 1.2, false],
  cry: ['哭', 1.6, false],
  angry: ['生氣跺腳', 1.2, false],
  surprised: ['嚇一跳', 0.8, false],
  think: ['思考', 1.5, false],
  point: ['指向（target 填對象）', 1, false],
  sit: ['坐下', 2, false],
  sleep: ['睡覺', 2.5, false],
  fall: ['跌倒', 1.2, false],
  spin: ['轉圈', 1, false],
  throw: ['丟東西（prop 填道具，target 填對象）', 0.9, false],
  pickup: ['撿起（prop 填道具）', 0.8, false],
  give: ['給（prop 填道具，target 填對象）', 1.2, false],
  eat: ['吃（prop 填道具）', 1.6, false],
  hug: ['擁抱（target 填對象）', 1.6, false],
  look: ['看向（target 填對象）', 1, false],
};

export const PROPS = {
  ball: '球', snowball: '雪球', fish: '魚', bone: '骨頭', gift: '禮物', cake: '蛋糕', flower: '花',
  balloon: '氣球', star: '星星', heart: '愛心', book: '書', apple: '蘋果', icecream: '冰淇淋', umbrella: '雨傘',
};

export const EFFECTS = {
  impact: '撞擊', sparkle: '閃亮', hearts: '愛心', confetti: '彩帶', question: '問號', exclaim: '驚嘆號', zzz: '睡覺 Z', sweat: '汗滴', smoke: '一陣煙',
};

export const SHOTS = { wide: '全景', medium: '中景', close: '特寫' };

export const NAMED_COLORS = {
  red: '#e0473c', orange: '#f08a2c', yellow: '#f2c230', green: '#4fa35a', teal: '#2fb3a6', blue: '#3b6fd4',
  navy: '#273c75', purple: '#8a5cc7', pink: '#f08bb0', brown: '#8a5a3c', black: '#2b2730', white: '#f4f1ea',
  gray: '#8d8d96', grey: '#8d8d96', cream: '#f3e2c0', ginger: '#e8833a', tabby: '#b9865a',
  紅: '#e0473c', 橘: '#f08a2c', 黃: '#f2c230', 綠: '#4fa35a', 藍: '#3b6fd4', 紫: '#8a5cc7', 粉紅: '#f08bb0',
  咖啡: '#8a5a3c', 棕: '#8a5a3c', 黑: '#2b2730', 白: '#f4f1ea', 灰: '#8d8d96', 米: '#f3e2c0',
};
const OUTFIT_DEFAULTS = ['#3b6fd4', '#e0473c', '#4fa35a', '#f08bb0', '#f2c230', '#8a5cc7', '#2fb3a6', '#f08a2c'];
const HAIR_COLORS = ['#3a2a24', '#2b2730', '#7a4a2a', '#c98a3a', '#3a2a24', '#5a3a2a'];
const ANIMAL_COLORS = { cat: ['#e8833a', '#2b2730', '#f4f1ea', '#8d8d96', '#b9865a'], dog: ['#c98a4a', '#f4f1ea', '#5a3a2a', '#2b2730', '#e8c890'] };

export const LIMITS = { minDur: 5, maxDur: 20, maxChars: 5, maxProps: 8, maxActions: 60 };

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, max = 60) => String(v ?? '').trim().slice(0, max);
const pickKey = (v, table, d) => {
  const k = str(v, 30).toLowerCase();
  if (k in table) return k;
  // 中文說明也接受（例如「海邊」「跑到」）
  const hit = Object.entries(table).find(([, val]) => (Array.isArray(val) ? val[0] : val) === str(v, 30));
  return hit ? hit[0] : d;
};

export function colorOf(v, fallback) {
  const s = str(v, 20);
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('').toLowerCase();
  const k = s.toLowerCase();
  if (NAMED_COLORS[k]) return NAMED_COLORS[k];
  const zh = Object.keys(NAMED_COLORS).find((n) => s.includes(n) && /[一-鿿]/.test(n));
  return zh ? NAMED_COLORS[zh] : fallback;
}

/** 動作的近義詞（AI 常寫的別名） */
const ACTION_ALIASES = {
  stand: 'idle', wait: 'idle', move: 'walk', go: 'walk', approach: 'walk', dash: 'run', rush: 'run', hop: 'jump',
  say: 'talk', speak: 'talk', shout: 'talk', yell: 'talk', celebrate: 'cheer', clap: 'cheer', smile: 'laugh', giggle: 'laugh',
  weep: 'cry', sad: 'cry', mad: 'angry', stomp: 'angry', shock: 'surprised', scared: 'surprised', gasp: 'surprised',
  wonder: 'think', sitdown: 'sit', rest: 'sit', nap: 'sleep', trip: 'fall', slip: 'fall', twirl: 'spin', toss: 'throw',
  grab: 'pickup', take: 'pickup', hand: 'give', bite: 'eat', cuddle: 'hug', watch: 'look', follow: 'chase', escape: 'flee', runaway: 'flee',
  steal: 'pickup', catch: 'pickup', kick: 'throw', bark: 'talk', meow: 'talk',
};

const PROP_ALIASES = { snow: 'snowball', present: 'gift', 魚: 'fish', 球: 'ball', 雪球: 'snowball', 骨頭: 'bone', 禮物: 'gift', 蛋糕: 'cake', 花: 'flower', 氣球: 'balloon', 書: 'book', 蘋果: 'apple', 冰淇淋: 'icecream', 雨傘: 'umbrella', toy: 'ball', food: 'apple', cookie: 'apple', sausage: 'bone' };

/**
 * @param {any} raw AI 或使用者給的劇本
 * @returns {{ script: object, notes: string[] }}
 */
export function normalizeScript(raw) {
  const notes = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const duration = Math.round(Math.min(LIMITS.maxDur, Math.max(LIMITS.minDur, num(r.duration, 12))) * 2) / 2;
  const scene = pickKey(r.scene, SCENES, null) ?? (notes.push(`沒有「${str(r.scene)}」這個場景，改用草地公園`), 'park');
  const time = pickKey(r.time, TIMES, 'day');
  const defaultWeather = scene === 'snow' ? 'snow' : scene === 'forest' ? 'leaves' : time === 'night' ? 'stars' : 'none';
  const weather = pickKey(r.weather, WEATHERS, defaultWeather);
  const mood = pickKey(r.mood, MOODS, 'happy');

  // ---- 角色 ----
  const chars = [];
  const rawChars = Array.isArray(r.characters) ? r.characters : [];
  if (rawChars.length > LIMITS.maxChars) notes.push(`角色最多 ${LIMITS.maxChars} 個，其餘省略`);
  rawChars.slice(0, LIMITS.maxChars).forEach((c, i) => {
    let kind = pickKey(c?.kind, KINDS, null);
    if (!kind) {
      const k = str(c?.kind).toLowerCase();
      kind = /cat|kitten|貓|lion|tiger|fox/.test(k) ? 'cat' : /dog|puppy|狗|wolf|bear|rabbit|bunny|兔/.test(k) ? 'dog' : 'person';
      if (k && !/person|boy|girl|kid|child|man|woman|人|男|女|孩/.test(k)) notes.push(`「${str(c?.kind)}」用${KINDS[kind]}代替`);
    }
    const id = str(c?.id, 20) || `c${i + 1}`;
    const palette = kind === 'person' ? OUTFIT_DEFAULTS : ANIMAL_COLORS[kind];
    chars.push({
      id,
      kind,
      name: str(c?.name, 12) || id,
      color: colorOf(c?.color, palette[i % palette.length]),
      hair: HAIRS.includes(str(c?.hair).toLowerCase()) ? str(c?.hair).toLowerCase() : HAIRS[i % 3],
      hairColor: colorOf(c?.hairColor, HAIR_COLORS[i % HAIR_COLORS.length]),
      pants: colorOf(c?.pants, '#33405a'),
      size: SIZES[str(c?.size).toLowerCase()] ? str(c?.size).toLowerCase() : 'normal',
      x: Math.min(95, Math.max(5, num(c?.x, 20 + (60 / Math.max(1, rawChars.length - 1 || 1)) * i))),
      facing: str(c?.facing).toLowerCase() === 'left' ? -1 : 1,
    });
  });
  if (!chars.length) {
    notes.push('劇本沒有角色，加入一個小朋友');
    chars.push({ id: 'c1', kind: 'person', name: '小朋友', color: OUTFIT_DEFAULTS[0], hair: 'short', hairColor: HAIR_COLORS[0], pants: '#33405a', size: 'normal', x: 50, facing: 1 });
  }
  const ids = new Set(chars.map((c) => c.id));
  const nameToId = Object.fromEntries(chars.map((c) => [c.name, c.id]));
  const charRef = (v) => { const s = str(v, 20); return ids.has(s) ? s : nameToId[s] ?? null; };

  // ---- 道具 ----
  const props = [];
  const propOf = (v) => { const s = str(v, 20).toLowerCase(); return PROPS[s] ? s : PROP_ALIASES[s] ?? PROP_ALIASES[str(v, 20)] ?? null; };
  (Array.isArray(r.props) ? r.props : []).slice(0, LIMITS.maxProps).forEach((p, i) => {
    const kind = propOf(p?.kind) ?? propOf(p?.id);
    if (!kind) { notes.push(`沒有「${str(p?.kind)}」這個道具，省略`); return; }
    props.push({ id: str(p?.id, 20) || `p${i + 1}`, kind, x: Math.min(95, Math.max(5, num(p?.x, 50))), holder: charRef(p?.holder), color: colorOf(p?.color, null) });
  });
  const propIds = new Set(props.map((p) => p.id));
  /** 動作裡提到的道具：先找 id，再找種類；都沒有就自動建立（拿在做動作的角色手上） */
  const propRef = (v, who) => {
    const s = str(v, 20);
    if (!s) return null;
    if (propIds.has(s)) return s;
    const kind = propOf(s);
    if (!kind) return null;
    const same = props.find((p) => p.kind === kind);
    if (same) return same.id;
    if (props.length >= LIMITS.maxProps) return null;
    const id = `${kind}${props.length + 1}`;
    props.push({ id, kind, x: 50, holder: who, color: null });
    propIds.add(id);
    return id;
  };

  // ---- 動作 ----
  const actions = [];
  const rawActions = Array.isArray(r.actions) ? r.actions : [];
  const unknown = new Set();
  const thrown = new Set();
  rawActions.slice(0, LIMITS.maxActions).forEach((a) => {
    const who = charRef(a?.who);
    if (!who) return;
    let act = str(a?.do, 20).toLowerCase();
    if (!ACTIONS[act]) {
      const alias = ACTION_ALIASES[act] ?? Object.entries(ACTIONS).find(([, v]) => v[0].startsWith(str(a?.do, 6)))?.[0];
      if (!alias) unknown.add(str(a?.do, 20));
      act = alias ?? 'idle';
    }
    const t = Math.min(duration - 0.2, Math.max(0, num(a?.t, 0)));
    const dur = Math.min(duration - t, Math.max(0.3, num(a?.dur, ACTIONS[act][1])));
    const out = { t, who, do: act, dur };
    const target = charRef(a?.target) ?? charRef(a?.to);
    if (target && target !== who) out.target = target;
    if (ACTIONS[act][2]) {
      const to = a?.to;
      if (charRef(to) && charRef(to) !== who) out.to = charRef(to);
      else if (propIds.has(str(to, 20))) out.to = str(to, 20);
      else if (Number.isFinite(Number(to))) out.to = Math.min(95, Math.max(5, Number(to)));
      else if (out.target) out.to = out.target;
      else out.to = null;
    }
    if (a?.text) out.text = str(a.text, 40);
    if (['throw', 'pickup', 'give', 'eat'].includes(act)) {
      let p = propRef(a?.prop, act === 'pickup' ? null : who) ?? (act === 'throw' ? propRef('ball', who) : null);
      // 雪球丟出去就碎了：同一顆再丟一次時，改成新做一顆
      if (p && act === 'throw' && thrown.has(p) && props.find((x) => x.id === p)?.kind === 'snowball' && props.length < LIMITS.maxProps) {
        const id = `snowball${props.length + 1}`;
        props.push({ id, kind: 'snowball', x: 50, holder: who, color: null });
        propIds.add(id);
        p = id;
      }
      if (p && act === 'throw') thrown.add(p);
      if (!p) { out.do = act === 'eat' ? 'laugh' : 'wave'; } else out.prop = p;
    }
    actions.push(out);
  });
  if (unknown.size) notes.push(`這些動作還不會做，先用站著代替：${[...unknown].join('、')}`);
  actions.sort((a, b) => a.t - b.t);

  // ---- 鏡頭 ----
  const camera = (Array.isArray(r.camera) ? r.camera : [])
    .map((c) => ({ t: Math.min(duration - 0.5, Math.max(0, num(c?.t, 0))), shot: pickKey(c?.shot, SHOTS, 'wide'), on: charRef(c?.on) }))
    .filter((c) => c.shot === 'wide' || c.on)
    .sort((a, b) => a.t - b.t);
  if (!camera.length || camera[0].t > 0) camera.unshift({ t: 0, shot: 'wide', on: null });

  // ---- 字幕與特效 ----
  const captions = (Array.isArray(r.captions) ? r.captions : []).slice(0, 8)
    .map((c) => ({ t: Math.min(duration - 0.3, Math.max(0, num(c?.t, 0))), dur: Math.max(0.8, num(c?.dur, 2.2)), text: str(c?.text, 24), pos: ['top', 'bottom', 'center'].includes(c?.pos) ? c.pos : 'top' }))
    .filter((c) => c.text);
  const effects = (Array.isArray(r.effects) ? r.effects : []).slice(0, 30)
    .map((e) => ({ t: Math.min(duration - 0.2, Math.max(0, num(e?.t, 0))), kind: pickKey(e?.kind, EFFECTS, null), at: charRef(e?.at) ?? (Number.isFinite(Number(e?.at)) ? Number(e.at) : null) }))
    .filter((e) => e.kind);

  return {
    script: { title: str(r.title, 30) || '我的動畫', duration, mood, scene, time, weather, characters: chars, props, actions, camera, captions, effects },
    notes,
  };
}

/** 給 AI 看的詞彙表（伺服器端的提示詞也有一份，兩邊要一致） */
export function vocabularyText() {
  const list = (o) => Object.entries(o).map(([k, v]) => `${k}（${Array.isArray(v) ? v[0] : v}）`).join('、');
  return [
    `scene：${list(SCENES)}`, `time：${list(TIMES)}`, `weather：${list(WEATHERS)}`, `mood：${list(MOODS)}`,
    `characters.kind：${list(KINDS)}`, `actions.do：${list(ACTIONS)}`, `props.kind：${list(PROPS)}`,
    `effects.kind：${list(EFFECTS)}`, `camera.shot：${list(SHOTS)}`,
  ].join('\n');
}
