// 配音：從劇本取出台詞、依語音長度調整時間軸、把 base64 PCM 解成音訊。
// 語音由 Claude Flow 的 /api/animate/voice 一次產生整部動畫的台詞（見 ai.js 的 speak）；
// 額度用完或失敗時，網頁預覽改用瀏覽器內建的語音（main.js 的 browserSpeech），匯出的 MP4 則沒有語音。

/** 一次最多配音幾句（和伺服器一致） */
export const MAX_VOICE_LINES = 12;
/** 語音開始比說話動作晚一點點，嘴巴先動、聲音再出來比較自然 */
export const VOICE_DELAY = 0.08;
/** 配音後動畫最長幾秒 */
const MAX_DURATION = 30;

/** 劇本裡要配音的台詞（依時間排序）：{ index（actions 的位置）, t, text, speaker, voice } */
export function voiceLines(script) {
  const byId = Object.fromEntries(script.characters.map((c) => [c.id, c]));
  return script.actions
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.do === 'talk' && a.text && byId[a.who])
    .sort((x, y) => x.a.t - y.a.t)
    .slice(0, MAX_VOICE_LINES)
    .map(({ a, index }) => ({ index, t: a.t, text: a.text, speaker: byId[a.who].name, voice: byId[a.who].voice ?? 'boy' }));
}

/**
 * 依每句語音的秒數調整時間軸：說話動作比語音短時拉長，並把「這句原本說完之後」才開始的
 * 動作、字幕、鏡頭、特效一起往後移，整部動畫跟著變長。不改動原本的 script，回傳新的。
 * @param {object} script normalizeScript 之後的劇本
 * @param {{index:number}[]} lines voiceLines(script) 的結果
 * @param {(number|null)[]} seconds 每句語音的秒數（沒配到音的是 null）
 */
export function retimeForVoices(script, lines, seconds) {
  const s = structuredClone(script);
  const order = lines.map((l, i) => ({ l, sec: seconds[i] })).filter((x) => x.sec != null).sort((x, y) => s.actions[x.l.index].t - s.actions[y.l.index].t);
  for (const { l, sec } of order) {
    const talk = s.actions[l.index];
    const need = sec + VOICE_DELAY + 0.2;
    const extra = Math.max(0, need - talk.dur);
    if (!extra) continue;
    const end = talk.t + talk.dur - 0.01;
    for (const list of [s.actions, s.captions, s.camera, s.effects]) for (const x of list) if (x !== talk && x.t >= end) x.t += extra;
    talk.dur = need;
    s.duration = Math.min(MAX_DURATION, s.duration + extra);
  }
  s.actions.sort((a, b) => a.t - b.t);
  return s;
}

/** base64 的 16 位元 PCM → Float32Array（-1～1） */
export function decodePcm(b64) {
  const bin = atob(b64), n = bin.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
    if (v >= 32768) v -= 65536;
    out[i] = v / 32768;
  }
  return out;
}

/**
 * 把伺服器回傳的語音接到調整後的劇本上：回傳 [{ t, data, rate }]，給配樂混音用。
 * 調整時間軸後說話動作的位置會變，所以用台詞文字與說話者重新對回去。
 */
export function attachVoices(script, lines, clips) {
  const out = [];
  lines.forEach((l, i) => {
    const c = clips[i];
    if (!c) return;
    const talk = script.actions.find((a) => a.do === 'talk' && a.text === l.text && script.characters.find((ch) => ch.id === a.who)?.name === l.speaker && !out.some((o) => o.action === a));
    if (talk) out.push({ action: talk, t: talk.t + VOICE_DELAY, data: decodePcm(c.pcm), rate: c.sampleRate });
  });
  return out.map(({ t, data, rate }) => ({ t, data, rate }));
}
