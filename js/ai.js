// 和 Claude Flow 的連接。
//
// 這個網站本身不登入、不碰金鑰以外的任何帳號資料：Claude Flow 插進 index.html 的登入檢查通過後，
// 會提供 window.ClaudeFlowAnimate，並發出 'claudeflow:animate-ready' 事件。
//   ClaudeFlowAnimate.uid                                    目前使用者（作品與金鑰依帳號分開存）
//   ClaudeFlowAnimate.writeScript(prompt, { duration, geminiKey }) → { available, script?, model?, reason? }
//   ClaudeFlowAnimate.speak(lines, { mood, geminiKey }) → { available, clips?, model?, reason? }
//     lines：[{ text, speaker, voice }]；clips 和 lines 一一對應，每個是 { sampleRate, pcm（16 位元 PCM 的 base64） }
// 直接打開這個資料夾（沒有 Claude Flow）時沒有這個物件，只能玩範例。

export function waitForBridge(timeoutMs = 8000) {
  if (window.ClaudeFlowAnimate) return Promise.resolve(window.ClaudeFlowAnimate);
  return new Promise((resolve) => {
    const done = (v) => { clearTimeout(timer); window.removeEventListener('claudeflow:animate-ready', on); resolve(v); };
    const on = (e) => done(e.detail ?? window.ClaudeFlowAnimate ?? null);
    const timer = setTimeout(() => done(window.ClaudeFlowAnimate ?? null), timeoutMs);
    window.addEventListener('claudeflow:animate-ready', on);
  });
}

const keyName = (uid) => `animate-gemini-key:${uid}`;
export function readKey(uid) {
  try { return localStorage.getItem(keyName(uid)) || ''; } catch { return ''; }
}
export function saveKey(uid, key) {
  try { if (key) localStorage.setItem(keyName(uid), key); else localStorage.removeItem(keyName(uid)); } catch { /* 無法儲存就只用這一次 */ }
}
