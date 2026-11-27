// 電影感後製：用 PixiJS（WebGL）把 renderFrame 畫好的一格再加上濾鏡（pixi-filters）。
//
// - 調色：顏色與對比稍微加強；雨天降低飽和度
// - 黃昏光束：晴天黃昏從太陽射出光束
// - 剪紙風：老電影顆粒；像素風：CRT 掃描線
// - 撞擊：丟中、跌倒的 0.25 秒內加放射狀模糊，增加打擊感
//
// 不使用光暈（bloom）：它依亮度決定哪裡發光，卡通畫面裡膚色、白雲、白雪、路面標線和太陽一樣亮，
// 實測白天臉會過曝、晚上臉和標線發光，而月亮與路燈本來就由引擎畫了光暈。
//
// 兩個函式庫約 1.1 MB，第一次畫完之後才在背景載入；不支援 WebGL 或載入失敗時回傳 null，動畫照常播放。
// 授權：vendor/pixi.js.LICENSE、vendor/pixi-filters.LICENSE（MIT）。

/** 太陽在畫面上的位置（黃昏，scene.js 的天空層幾乎不隨鏡頭移動） */
const SUNSET_SUN = [1380, 520];
const IMPACT = 0.25;

/**
 * @param {HTMLCanvasElement} source renderFrame 畫的 1920×1080 畫布
 * @returns {Promise<null | { canvas: HTMLCanvasElement, render(model: object, styleId: string, t: number): void }>}
 */
export async function createPostFx(source) {
  let PIXI, F;
  try {
    PIXI = await import('../vendor/pixi.min.mjs');
    F = await import('../vendor/pixi-filters.mjs');
  } catch (e) {
    console.warn('[特效] 函式庫載入失敗，不加特效', e);
    return null;
  }
  const app = new PIXI.Application();
  try {
    await app.init({
      width: source.width, height: source.height, preference: 'webgl', resolution: 1, autoDensity: false,
      antialias: false, autoStart: false, backgroundColor: 0x000000, preserveDrawingBuffer: true, // MP4 與 PNG 要讀得到畫面
    });
  } catch (e) {
    console.warn('[特效] 這個瀏覽器不能用 WebGL，不加特效', e);
    return null;
  }
  app.ticker.stop();
  const texture = PIXI.Texture.from(source);
  const sprite = new PIXI.Sprite(texture);
  app.stage.addChild(sprite);

  const grade = new F.AdjustmentFilter({ saturation: 1.1, contrast: 1.05 });
  const rays = new F.GodrayFilter({ angle: 30, gain: 0.3, lacunarity: 2.6, alpha: 0.22, parallel: false, center: SUNSET_SUN });
  const film = new F.OldFilmFilter({ sepia: 0, noise: 0.07, noiseSize: 1.2, scratch: 0, vignetting: 0.18, vignettingAlpha: 0.6 });
  const crt = new F.CRTFilter({ curvature: 0, lineWidth: 3, lineContrast: 0.18, noise: 0.06, noiseSize: 1, vignetting: 0.25, vignettingAlpha: 0.5 });
  // 撞擊的放射狀模糊：中間 300px 保持清楚，邊緣輕微拉長（實測 0.12 會整個畫面糊掉、看不清臉）
  const zoom = new F.ZoomBlurFilter({ strength: 0, center: [source.width / 2, source.height / 2], innerRadius: 300 });

  /** 撞擊強度：最近一次「會晃鏡頭」的特效（丟中、跌倒）後 0.25 秒內由 1 降到 0 */
  const impact = (model, t) => {
    let k = 0;
    for (const e of model.effects) if (e.shake && t >= e.t && t < e.t + IMPACT) k = Math.max(k, (1 - (t - e.t) / IMPACT) * Math.min(1, e.shake));
    return k;
  };

  return {
    canvas: app.canvas,
    render(model, styleId, t) {
      const s = model.script, overcast = s.weather === 'rain' || s.weather === 'snow';
      const sunset = s.time === 'sunset' && !overcast && s.scene !== 'room';
      grade.saturation = s.weather === 'rain' ? 0.85 : styleId === 'pixel' ? 1.15 : 1.1;
      grade.contrast = styleId === 'papercut' ? 1.08 : 1.05;
      rays.time = t * 0.25;
      // 雜訊的種子由時間決定：同一份劇本每次畫出來都一樣（和引擎的固定種子一致）
      const seed = (Math.round(t * 24) * 0.6180339887) % 1;
      film.seed = seed;
      crt.time = t * 2; crt.seed = seed;
      const k = impact(model, t);
      zoom.strength = 0.04 * k;
      const list = [grade];
      if (sunset) list.push(rays);
      if (styleId === 'papercut') list.push(film);
      if (styleId === 'pixel') list.push(crt);
      if (k > 0) list.push(zoom);
      sprite.filters = list;
      texture.source.update();
      app.render();
    },
  };
}
