// 動畫製作的頁面：提示詞 → 劇本（Gemini）→ 預覽 → 換畫風 → 下載。
import { normalizeScript } from './engine/script.js';
import { compile } from './engine/compile.js';
import { renderFrame } from './engine/render.js';
import { buildScore } from './engine/music.js';
import { FPS, W, H } from './engine/core.js';
import { SAMPLES } from './samples.js';
import { canExportMp4, downloadBlob, exportMp4 } from './exporter.js';
import { readKey, saveKey, waitForBridge } from './ai.js';
import cozy from './styles/cozy.js';
import papercut from './styles/papercut.js';
import pixel from './styles/pixel.js';

const STYLES = [cozy, papercut, pixel];
const $ = (id) => document.getElementById(id);
const view = $('view'), vctx = view.getContext('2d');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 無痕模式等：不記也能用 */ } },
};

const state = {
  model: null, script: null, style: STYLES.find((s) => s.id === store.get('animate-style', 'cozy')) ?? cozy,
  playing: true, frame: 0, start: performance.now(), offset: 0, lastDrawn: -1,
  sound: false, audio: null, audioSrc: null, buffers: new Map(), exporting: false, abort: null, bridge: null, uid: 'local',
};
const totalFrames = () => Math.round((state.model?.duration ?? 12) * FPS);

// ---------------------------------------------------------------- 載入劇本
function load(raw, { prompt = '', save = true } = {}) {
  const { script, notes } = normalizeScript(raw);
  state.script = script;
  state.model = compile(script);
  state.buffers.clear();
  stopAudio();
  $('scrub').max = String(totalFrames() - 1);
  seek(0);
  state.playing = true; syncPlay();
  showScript(script, notes);
  renderThumbs();
  if (save) saveWork(script, prompt);
  if (state.sound) startAudio();
}

function showScript(s, notes) {
  $('scriptCard').hidden = false;
  $('scriptTitle').textContent = s.title;
  const L = { snow: '雪地公園', beach: '海邊', city: '城市街道', forest: '森林', park: '草地公園', room: '家裡客廳' }[s.scene];
  const T = { day: '白天', sunset: '黃昏', night: '晚上' }[s.time];
  const M = { happy: '歡樂', playful: '俏皮', epic: '熱血', calm: '溫馨', tense: '緊張', sad: '感傷' }[s.mood];
  $('scriptMeta').textContent = `${L}・${T}・${M}・${s.duration} 秒`;
  $('cast').replaceChildren(...s.characters.map((c) => {
    const el = document.createElement('span');
    el.className = 'chip cast';
    el.textContent = `${{ person: '🧒', cat: '🐱', dog: '🐶' }[c.kind]} ${c.name}`;
    return el;
  }));
  $('notes').replaceChildren(...notes.map((n) => Object.assign(document.createElement('li'), { textContent: n })));
  $('json').value = JSON.stringify(s, null, 1);
  $('jsonMsg').textContent = '';
}

// ---------------------------------------------------------------- 播放
function seek(f) {
  state.frame = Math.max(0, Math.min(totalFrames() - 1, f));
  state.offset = state.frame; state.start = performance.now();
  draw(state.frame, true);
}
function draw(f, force = false) {
  if (!state.model || state.exporting) return;
  if (!force && f === state.lastDrawn) return;
  state.lastDrawn = f;
  try { renderFrame(vctx, state.model, state.style, f / FPS); }
  catch (e) { console.error('[動畫] 繪製失敗', e); }
  $('scrub').value = String(f);
  $('time').textContent = `${(f / FPS).toFixed(1)} / ${state.model.duration.toFixed(1)} 秒`;
}
function tick() {
  if (state.playing && state.model && !state.exporting) {
    const f = Math.floor(state.offset + ((performance.now() - state.start) / 1000) * FPS) % totalFrames();
    if (f < state.frame && state.sound) startAudio(0); // 迴圈回到開頭，聲音也重來
    state.frame = f;
    draw(f);
  }
  requestAnimationFrame(tick);
}
function syncPlay() {
  $('play').textContent = state.playing ? '❚❚' : '▶';
  $('play').setAttribute('aria-label', state.playing ? '暫停' : '播放');
}
$('play').onclick = () => {
  state.playing = !state.playing;
  if (state.playing) { state.offset = state.frame; state.start = performance.now(); if (state.sound) startAudio(); }
  else stopAudio();
  syncPlay();
};
$('scrub').oninput = (e) => { state.playing = false; syncPlay(); stopAudio(); seek(Number(e.target.value)); };
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName ?? '')) { e.preventDefault(); $('play').click(); }
});

// ---------------------------------------------------------------- 聲音
async function scoreBuffer(ac) {
  const key = state.script.title + JSON.stringify(state.script).length;
  if (state.buffers.has(key)) return state.buffers.get(key);
  const s = await buildScore(state.model, ac.sampleRate);
  const buf = ac.createBuffer(2, s.left.length, s.sampleRate);
  buf.copyToChannel(s.left, 0); buf.copyToChannel(s.right, 1);
  state.buffers.set(key, buf);
  return buf;
}
async function startAudio(fromFrame = state.frame) {
  if (!state.model) return;
  state.audio ??= new AudioContext();
  if (state.audio.state === 'suspended') await state.audio.resume();
  const buf = await scoreBuffer(state.audio);
  stopAudio();
  const src = state.audio.createBufferSource();
  src.buffer = buf; src.connect(state.audio.destination);
  src.start(0, fromFrame / FPS);
  state.audioSrc = src;
  state.offset = fromFrame; state.start = performance.now();
}
function stopAudio() { try { state.audioSrc?.stop(); } catch { /* 已停止 */ } state.audioSrc = null; }
$('sound').onclick = () => {
  state.sound = !state.sound;
  $('sound').textContent = state.sound ? '🔊' : '🔇';
  $('sound').setAttribute('aria-pressed', String(state.sound));
  $('sound').setAttribute('aria-label', state.sound ? '關閉聲音' : '開啟聲音');
  if (state.sound && state.playing) startAudio(); else stopAudio();
};

// ---------------------------------------------------------------- 畫風
const thumbCanvases = new Map();
function buildStylePicker() {
  $('styles').replaceChildren(...STYLES.map((s) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'style-opt'; b.setAttribute('role', 'radio');
    const c = document.createElement('canvas'); c.width = 384; c.height = 216;
    thumbCanvases.set(s.id, c);
    b.append(c, Object.assign(document.createElement('strong'), { textContent: s.name }), Object.assign(document.createElement('span'), { textContent: s.blurb }));
    b.onclick = () => { if (state.exporting) return; state.style = s; store.set('animate-style', s.id); markStyle(); draw(state.frame, true); };
    b.dataset.id = s.id;
    return b;
  }));
  markStyle();
}
function markStyle() { for (const b of $('styles').children) b.setAttribute('aria-checked', String(b.dataset.id === state.style.id)); }
/** 縮圖：每種畫風畫同一格（劇本 40% 的位置），先畫在全尺寸暫存畫布再縮小 */
function renderThumbs() {
  const tmp = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = tmp.getContext('2d');
  const t = Math.round(state.model.duration * 0.4 * FPS) / FPS;
  for (const s of STYLES) {
    try { renderFrame(g, state.model, s, t); } catch (e) { console.error(e); continue; }
    const c = thumbCanvases.get(s.id), cg = c.getContext('2d');
    cg.imageSmoothingQuality = 'high';
    cg.drawImage(tmp, 0, 0, c.width, c.height);
  }
}

// ---------------------------------------------------------------- 下載
const safeName = () => `${state.script.title}_${state.style.name}`.replace(/[\\/:*?"<>|\s]+/g, '');
$('png').onclick = () => {
  draw(state.frame, true);
  view.toBlob((b) => b && downloadBlob(b, `${safeName()}_${(state.frame / FPS).toFixed(1)}秒.png`), 'image/png');
};
$('mp4').onclick = async () => {
  if (!state.model || state.exporting) return;
  if (!canExportMp4()) { msg('exportMsg', '這個瀏覽器不支援在本機產生影片，請改用最新版 Chrome、Edge 或 Safari。', 'error'); return; }
  const wasPlaying = state.playing;
  state.playing = false; syncPlay(); stopAudio();
  state.exporting = true; setBusy(true);
  state.abort = new AbortController();
  $('progress').hidden = false; $('exportMsg').hidden = true;
  const t0 = performance.now();
  const [w, h] = $('res').value === '1080' ? [1920, 1080] : [1280, 720];
  try {
    const res = await exportMp4({
      draw: (t) => renderFrame(vctx, state.model, state.style, t),
      source: view, frames: totalFrames(), fps: FPS, width: w, height: h, signal: state.abort.signal,
      score: () => buildScore(state.model, 48000),
      onProgress: (pct, label) => { $('bar').style.width = pct + '%'; $('progressLabel').textContent = label; },
    });
    const name = `${safeName()}.mp4`;
    downloadBlob(res.blob, name);
    msg('exportMsg', `已下載 ${name}，${(res.blob.size / 1048576).toFixed(1)} MB，花了 ${((performance.now() - t0) / 1000).toFixed(0)} 秒${res.audio === 'none' ? '（這個瀏覽器無法編碼聲音，影片沒有配樂）' : ''}`, 'ok');
  } catch (e) {
    if (e?.name !== 'AbortError') { console.error(e); msg('exportMsg', e?.message ?? '匯出失敗', 'error'); }
  } finally {
    state.exporting = false; state.abort = null; setBusy(false);
    $('progress').hidden = true;
    draw(state.frame, true);
    if (wasPlaying) { state.playing = true; state.offset = state.frame; state.start = performance.now(); syncPlay(); }
  }
};
$('cancel').onclick = () => state.abort?.abort();
function setBusy(b) { for (const id of ['mp4', 'png', 'generate', 'applyJson', 'play', 'scrub']) $(id).disabled = b; }
function msg(id, text, kind) { const el = $(id); el.hidden = !text; el.textContent = text ?? ''; el.className = `alert ${kind ?? ''}`; }

// ---------------------------------------------------------------- 生成
$('generate').onclick = async () => {
  const prompt = $('prompt').value.trim();
  if (!prompt) { msg('genMsg', '先寫一兩句你想看的故事。', 'error'); $('prompt').focus(); return; }
  if (!state.bridge) { msg('genMsg', '要從 Claude Flow 登入後才能用 AI 生成；可以先試試下面的範例。', 'error'); return; }
  $('generate').disabled = true;
  msg('genMsg', '', '');
  screenMsg('<span class="spin"></span>正在寫劇本…（約 10～30 秒）');
  try {
    const res = await state.bridge.writeScript(prompt, { duration: Number($('dur').value), geminiKey: readKey(state.uid) });
    if (!res.available) { msg('genMsg', res.reason ?? '生成失敗，請再試一次。', 'error'); return; }
    load(res.script, { prompt });
    if (res.note) $('notes').prepend(Object.assign(document.createElement('li'), { textContent: res.note }));
    msg('genMsg', `完成！用的模型：${res.model ?? 'Gemini'}`, 'ok');
  } catch (e) {
    console.error(e);
    msg('genMsg', e?.message ?? '生成失敗，請再試一次。', 'error');
  } finally {
    $('generate').disabled = false;
    screenMsg(null);
  }
};
function screenMsg(html) { const el = $('screenMsg'); el.hidden = !html; el.innerHTML = html ?? ''; }

$('applyJson').onclick = () => {
  try { load(JSON.parse($('json').value), { prompt: '（手動編輯）' }); $('jsonMsg').textContent = '已套用'; }
  catch (e) { $('jsonMsg').textContent = `格式有誤：${e.message}`; }
};

// ---------------------------------------------------------------- 範例與作品
$('samples').replaceChildren(...SAMPLES.map((s) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'chip', textContent: s.prompt });
  b.onclick = () => { $('prompt').value = s.prompt; load(s.script, { prompt: s.prompt, save: false }); msg('genMsg', '這是事先寫好的範例劇本；按「生成動畫」會請 AI 重新寫一份。', 'ok'); };
  return b;
}));
const worksKey = () => `animate-works:${state.uid}`;
function saveWork(script, prompt) {
  const list = store.get(worksKey(), []).filter((w) => w.script.title !== script.title || w.prompt !== prompt);
  list.unshift({ at: Date.now(), prompt, script });
  store.set(worksKey(), list.slice(0, 12));
  renderWorks();
}
function renderWorks() {
  $('works').replaceChildren(...store.get(worksKey(), []).map((w, i) => {
    const li = document.createElement('li');
    const open = Object.assign(document.createElement('button'), { type: 'button', className: 'open', textContent: `${w.script.title}　${new Date(w.at).toLocaleDateString('zh-TW')}`, title: w.prompt });
    open.onclick = () => { $('prompt').value = w.prompt.startsWith('（') ? '' : w.prompt; load(w.script, { prompt: w.prompt, save: false }); };
    const del = Object.assign(document.createElement('button'), { type: 'button', className: 'btn ghost small', textContent: '刪除' });
    del.onclick = () => { const l = store.get(worksKey(), []); l.splice(i, 1); store.set(worksKey(), l); renderWorks(); };
    li.append(open, del);
    return li;
  }));
}

// ---------------------------------------------------------------- 金鑰
function syncKey() {
  const k = readKey(state.uid);
  $('keyState').textContent = k ? '（使用你自己的金鑰）' : '（使用網站的金鑰）';
  $('key').value = '';
  $('key').placeholder = k ? `已儲存（…${k.slice(-4)}）` : 'AIza…';
}
$('saveKey').onclick = () => { const v = $('key').value.trim(); if (!v) return; saveKey(state.uid, v); syncKey(); };
$('clearKey').onclick = () => { saveKey(state.uid, ''); syncKey(); };

// ---------------------------------------------------------------- 啟動
buildStylePicker();
load(SAMPLES[0].script, { prompt: SAMPLES[0].prompt, save: false });
requestAnimationFrame(tick);
renderWorks(); syncKey();
waitForBridge(8000).then((b) => {
  if (!b) return;
  state.bridge = b; state.uid = b.uid ?? 'local';
  renderWorks(); syncKey();
});
