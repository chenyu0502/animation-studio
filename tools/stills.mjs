// 開發用：拍範例劇本的單格並拼成一張圖，檢查畫面。
// node tools/stills.mjs <範例編號> <畫風,畫風> <秒,秒> <輸出.jpg>
// 需要全域安裝的 Playwright 與 ffmpeg。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [sample = '0', styles = 'cozy', times = '1', out = 'stills.jpg'] = process.argv.slice(2);
const pw = await import(pathToFileURL(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright', 'index.mjs')).href);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(f));
}).listen(0);
const port = server.address().port;
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('頁面錯誤', e.message));
page.on('console', (m) => m.type() === 'error' && console.error(m.text()));
await page.goto(`http://localhost:${port}/tools/stills.html`);
await page.waitForFunction(() => window.ready, null, { timeout: 15000 });
console.log('notes', JSON.stringify(await page.evaluate(() => window.notes)));
const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'st-'));
const files = [];
for (const st of styles.split(',')) for (const t of times.split(',')) {
  const b64 = await page.evaluate(([i, s, t]) => window.still(i, s, t), [Number(sample), st, Number(t)]);
  const f = path.join(tmp, `${st}_${t}.jpg`);
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  files.push(f);
}
await browser.close();
server.close();
const cols = times.split(',').length, n = files.length;
const layout = files.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|');
const filter = files.map((_, i) => `[${i}]scale=640:360[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${n}:layout=${layout}`;
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', n > 1 ? filter : '[0]scale=960:540', out]);
console.log('寫入', out);
