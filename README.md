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
- **畫風**：Q 版小鎮風（`cozy`）、剪紙風（`papercut`）、像素風（`pixel`）、手繪繪本風（`sketch`：Rough.js 鉛筆描邊、蠟筆紋理填色、perfect-freehand 細線、畫紙紋理，每兩格重畫線條）。每個畫風只要實作 `fillShape`（點列 → 上色）、`strokeLine`、`sky`，可選 `begin`／`post`（整格前後處理）、`caption`、`bubble`、`face`。引擎把所有形狀都轉成點列交給畫風，畫風決定漸層、剪紙邊與投影、低解析度像素化等。
- **站位**（`compile.js`）：每個角色依實際身體寬度（`halfWidth`，貓狗身體橫躺比人寬）保持距離。一開始擠在一起的角色會被拉開；移動時在整個舞台上挑「和別人重疊最少、離劇本指定位置最近」的落腳點。走過去之後要互動（擁抱、給東西、說話）就站到碰得到對方的距離，要撿東西就站到道具旁邊。貓狗大小由 `core.js` 的 `ANIMAL_SCALE` 決定（狗約大人的 6 成高）。位置 `-10`／`110` 代表左／右邊畫面外：角色可以從畫面外走進來、走出去（`script.js` 的 `stagePos`），畫面外的角色不參與起始站位的拉開。
- **天氣**（`scene.js`）：下雨、下雪是陰天，不畫太陽與月亮、雲變多變灰；雨天整體色調壓暗。
- **對話框**（`painter.js` 的 `placeBubble`）：避開正在顯示的字幕與其他對話框；特寫時頭頂上放不下就放到頭的旁邊。
- **動畫原理**：轉身時身體先壓扁再翻面（`compile.js` 的 `TURN`）；起步前往後一縮（預備動作）、停步後往前晃一下（慣性）；跳躍與驚嚇有擠壓伸展（姿勢的 `sq`，`rig.js` 以腳底為基準縮放）。
- **配音**（`engine/voice.js`）：劇本寫好後，整部動畫的台詞一次送到 Claude Flow 的 `/api/animate/voice`（`ClaudeFlowAnimate.speak`），回傳每句的語音。語音比說話動作長時拉長說話時間，之後的動作、字幕、鏡頭一起往後移（`retimeForVoices`）；配樂混入語音並在說話時壓低音樂（`music.js`），匯出的 MP4 也有語音。角色的 `voice`（boy、girl、man、woman、old-man、old-woman、cat、dog）劇本沒寫時依外型推測（`script.js` 的 `guessVoice`）。AI 配音失敗或額度用完時，預覽改用瀏覽器內建語音念台詞（MP4 沒有）。
- **電影感特效**（`postfx.js`）：用 PixiJS（WebGL）把每一格再加上 pixi-filters 的濾鏡：調色（雨天降低飽和度）、晴天黃昏的太陽光束、剪紙風的老電影顆粒、像素風的 CRT 掃描線、丟中或跌倒時 0.25 秒的放射狀模糊。兩個函式庫約 1.1 MB，動畫畫出來之後才在背景載入；不支援 WebGL 或載入失敗時不加特效。畫風卡片上可以關掉，預覽、PNG、MP4 都跟著開關。沒有用光暈（bloom）：卡通畫面裡膚色、白雲、白雪和太陽一樣亮，會過曝。
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

第三方（都是 MIT）：`vendor/mp4-muxer.mjs`（`vendor/mp4-muxer.LICENSE`）、`vendor/pixi.min.mjs`（PixiJS 8.23.0，`vendor/pixi.js.LICENSE`）、`vendor/rough.esm.js`（Rough.js 4.6.6，`vendor/rough.LICENSE`）、`vendor/perfect-freehand.mjs`（perfect-freehand 1.2.3，`vendor/perfect-freehand.LICENSE`）、`vendor/pixi-filters.mjs`（pixi-filters 6.1.5，`vendor/pixi-filters.LICENSE`；檔案裡的 `from"pixi.js"` 改成 `from"./pixi.min.mjs"`，不需要 import map）。
