# 動畫製作（animation-studio）

Claude Flow 的子網站（`/animate/`）：說幾句話，AI 寫劇本，程式畫出動畫；同一個故事可以切換畫風比較，最後在瀏覽器裡匯出 MP4 或 PNG。

## 怎麼運作

```
提示詞 ──Gemini（Claude Flow 的 /api/animate/script）──▶ 劇本 JSON
劇本 ──js/engine/script.js 檢查、替換不認得的東西──▶ compile.js 時間軸
時間軸 + 畫風（js/styles/*.js）──render.js──▶ 1920×1080 canvas，每秒 24 格
時間軸 ──music.js（Web Audio 合成）──▶ 配樂與音效
canvas + 配樂 ──exporter.js（WebCodecs + mp4-muxer）──▶ MP4
```

- **劇本與畫風分開**：劇本只描述「誰在哪裡做什麼」（角色、動作、道具、鏡頭、字幕、特效），不含任何畫法，所以換畫風是即時的，不用再呼叫 AI。
- **引擎會的東西**（第一期）：
  - 角色：人（小孩／大人）、貓、狗。
  - 場景：雪地公園、海邊、城市街道、森林、草地公園、家裡客廳，各有白天、黃昏、晚上。
  - 動作：27 個。
  - 道具：14 種。
  - 特效：9 種。
  - 鏡頭：全景、中景、特寫。
  - 完整清單在 `js/engine/script.js`；Claude Flow 的 `api/_lib/animate.js` 提示詞裡也有一份，**兩邊要一致**。
- **畫風**：Q 版小鎮風（`cozy`）、剪紙風（`papercut`）、像素風（`pixel`）。每個畫風只要實作 `fillShape`（點列 → 上色）、`strokeLine`、`sky`，可選 `begin`／`post`（整格前後處理）、`caption`、`bubble`、`face`。引擎把所有形狀都轉成點列交給畫風，畫風決定漸層、剪紙邊與投影、低解析度像素化等。
- **站位**（`compile.js`）：每個角色依實際身體寬度（`halfWidth`，貓狗身體橫躺比人寬）保持距離。一開始擠在一起的角色會被拉開；移動時在整個舞台上挑「和別人重疊最少、離劇本指定位置最近」的落腳點。走過去之後要互動（擁抱、給東西、說話）就站到碰得到對方的距離，要撿東西就站到道具旁邊。貓狗大小由 `core.js` 的 `ANIMAL_SCALE` 決定（狗約大人的 6 成高）。
- **固定種子**：所有隨機都來自 `RNG(...)`，同一份劇本每次畫出來都一樣。

## 和 Claude Flow 的關係

- Claude Flow 建置時用 `scripts/fetch-animate.mjs` 下載本 repo 的 `main`，只發布 `index.html`、`css/`、`js/`、`vendor/`，並在 `index.html` 插入登入檢查。
- 登入檢查通過後，Claude Flow 提供 `window.ClaudeFlowAnimate`（`uid`、`writeScript(prompt, { duration, geminiKey })`），本網站不碰登入。
- 使用者可以填自己的 Gemini 金鑰（只存在瀏覽器、依帳號分開），沒填時用網站的金鑰。
- 合併到 `main` 後，`.github/workflows/notify-claude-flow.yml` 透過 Deploy Hook（Secret `VERCEL_DEPLOY_HOOK`）通知 Claude Flow 重新部署；沒設定時要手動重新部署 Claude Flow。

## 本機開發

```bash
python -m http.server 8791      # 或任何靜態伺服器；直接開啟可玩範例，AI 生成需要從 Claude Flow 開啟
node --test tests/engine.test.mjs
node tools/stills.mjs 0 cozy,papercut,pixel 1,3,6 stills.jpg   # 拍範例的單格拼成一張圖（需要全域 Playwright 與 ffmpeg）
```

第三方：`vendor/mp4-muxer.mjs`（MIT，見 `vendor/mp4-muxer.LICENSE`）。
