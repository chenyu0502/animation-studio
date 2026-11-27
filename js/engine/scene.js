// 六個場景。每個場景分成遠景、中景、地面三層（鏡頭移動時遠景移得慢，有景深感）。
// 只描述「有什麼形狀、什麼顏色」，怎麼上色、要不要描邊交給畫風。
import { GROUND, RNG, W, H, circlePts, ellipsePts, rectPts, roundRectPts, mix, shade, TAU } from './core.js';

/** 天空與整體色調 */
export function skyColors(scene, time) {
  if (scene === 'room') return { top: '#f3e6d4', bottom: '#f3e6d4', tint: time === 'night' ? ['#1c2350', 0.28] : time === 'sunset' ? ['#ff9a5a', 0.1] : null };
  if (time === 'night') return { top: '#0f1a3d', bottom: '#33457a', tint: ['#1c2350', 0.32] };
  if (time === 'sunset') return { top: '#5b6fb4', bottom: '#ffb07a', tint: ['#ff8a4a', 0.14] };
  const day = { snow: ['#a9cff0', '#eaf4fb'], beach: ['#5fb4ee', '#d4efff'], city: ['#8cc4ee', '#e4f2fb'], forest: ['#8fd0e8', '#e8f6e8'], park: ['#78c2f0', '#e2f3fb'] }[scene] ?? ['#8cc4ee', '#e4f2fb'];
  return { top: day[0], bottom: day[1], tint: null };
}

const tree = (pt, x, y, s, col, key, snow) => {
  pt.fill(rectPts(x - 9 * s, y - 70 * s, 18 * s, 70 * s), '#7a5236', { key: key + 't' });
  for (let i = 0; i < 3; i++) {
    const w = (95 - i * 22) * s, top = y - 60 * s - i * 52 * s;
    pt.fill([[x - w, top + 8 * s], [x, top - 92 * s], [x + w, top + 8 * s]], shade(col, -i * 0.04), { key: key + 'l' + i });
    if (snow) pt.fill([[x - w * 0.55, top - 38 * s], [x, top - 92 * s], [x + w * 0.55, top - 38 * s], [x + w * 0.2, top - 30 * s], [x - w * 0.15, top - 36 * s]], '#ffffff', { key: key + 's' + i, outline: false });
  }
};
const roundTree = (pt, x, y, s, col, key) => {
  pt.fill(rectPts(x - 12 * s, y - 120 * s, 24 * s, 120 * s), '#7a5236', { key: key + 't' });
  for (const [dx, dy, r] of [[-48, -150, 70], [44, -158, 74], [0, -205, 86]]) pt.fill(circlePts(x + dx * s, y + dy * s, r * s, 30), shade(col, dy < -180 ? 0.06 : 0), { key: key + dx });
};
const cloud = (pt, x, y, s, key, col = '#ffffff') => {
  for (const [dx, dy, r] of [[-60, 8, 42], [0, -14, 58], [62, 6, 44], [20, 20, 40]]) pt.fill(circlePts(x + dx * s, y + dy * s, r * s, 24), col, { key: key + dx, outline: false });
};
const house = (pt, x, y, s, wall, roof, key, lit, snow) => {
  pt.fill(rectPts(x - 110 * s, y - 150 * s, 220 * s, 150 * s), wall, { key: key + 'w' });
  pt.fill([[x - 135 * s, y - 145 * s], [x, y - 250 * s], [x + 135 * s, y - 145 * s]], roof, { key: key + 'r' });
  if (snow) pt.fill([[x - 120 * s, y - 158 * s], [x, y - 250 * s], [x + 120 * s, y - 158 * s], [x + 60 * s, y - 175 * s], [x - 40 * s, y - 165 * s]], '#ffffff', { key: key + 'rs', outline: false });
  pt.fill(rectPts(x - 70 * s, y - 115 * s, 50 * s, 50 * s), lit ? '#ffd76a' : '#a9d4ee', { key: key + 'win' });
  pt.fill(roundRectPts(x + 25 * s, y - 95 * s, 46 * s, 95 * s, 6 * s), shade(roof, -0.1), { key: key + 'door' });
};
const fence = (pt, x0, x1, y, col, key) => {
  pt.fill(rectPts(x0, y - 52, x1 - x0, 11), col, { key: key + 'r1' });
  pt.fill(rectPts(x0, y - 28, x1 - x0, 11), col, { key: key + 'r2' });
  for (let x = x0 + 10; x < x1; x += 60) pt.fill([[x, y], [x, y - 66], [x + 9, y - 76], [x + 18, y - 66], [x + 18, y]], shade(col, 0.06), { key: key + x });
};

/** 回傳三層：{ factor, draw(pt, t) }。factor 越小移動越慢（越遠） */
export function sceneLayers(scene, time, title = '') {
  const night = time === 'night', sunset = time === 'sunset';
  const R = RNG('scene', scene, title);
  const layers = [];
  const far = (fn) => layers.push({ factor: 0.35, draw: fn });
  const mid = (fn) => layers.push({ factor: 0.7, draw: fn });
  const near = (fn) => layers.push({ factor: 1, draw: fn });
  const dim = (c, k = 0.35) => (night ? mix(c, '#1c2350', k) : sunset ? mix(c, '#c86a5a', k * 0.35) : c);

  // 天體與雲
  if (scene !== 'room') far((pt, t) => {
    if (night) { pt.fill(circlePts(1500, 190, 62, 36), '#fff4c8', { key: 'moon', outline: false, glow: true }); }
    else if (sunset) pt.fill(circlePts(1380, 520, 120, 40), '#ffd08a', { key: 'sun', outline: false, glow: true });
    else pt.fill(circlePts(1560, 170, 70, 36), '#fff1a8', { key: 'sun', outline: false, glow: true });
    for (let i = 0; i < 4; i++) {
      const x = ((R.r(0, W) + t * (14 + i * 6)) % (W + 400)) - 200;
      cloud(pt, x, 130 + i * 55 + R.r(-20, 20), 0.7 + R.r(0, 0.5), 'cl' + i, dim('#ffffff', 0.55));
    }
  });

  if (scene === 'snow') {
    far((pt) => {
      pt.fill([[-200, 700], [180, 360], [430, 560], [700, 330], [1050, 620], [1380, 380], [1700, 560], [2150, 420], [2150, 760], [-200, 760]], dim('#c9d9ea'), { key: 'mt' });
      pt.fill([[90, 470], [180, 360], [260, 440], [210, 430], [150, 470]], '#ffffff', { key: 'mts1', outline: false });
      pt.fill([[610, 430], [700, 330], [800, 420], [740, 410], [680, 440]], '#ffffff', { key: 'mts2', outline: false });
      pt.fill([[1290, 470], [1380, 380], [1470, 460], [1410, 450], [1350, 470]], '#ffffff', { key: 'mts3', outline: false });
    });
    mid((pt) => {
      pt.fill([[-300, 760], [W + 300, 760], [W + 300, GROUND + 10], [-300, GROUND + 10]], dim('#f3f8fd'), { key: 'snowbank', outline: false });
      tree(pt, 120, 780, 1.1, dim('#3f8f5e'), 'tA', true); tree(pt, 1740, 790, 1.25, dim('#3a8458'), 'tB', true); tree(pt, 1880, 770, 0.9, dim('#4a9a66'), 'tC', true);
      house(pt, 1450, 770, 0.9, dim('#d9634f'), dim('#7a3a32'), 'hs', night || sunset, true);
      fence(pt, 300, 1100, 790, dim('#b98a5a'), 'fn');
    });
  } else if (scene === 'beach') {
    far((pt, t) => {
      pt.fill([[-300, 600], [W + 300, 600], [W + 300, 790], [-300, 790]], dim('#2f8fd0'), { key: 'sea', outline: false });
      pt.fill([[1250, 600], [1330, 545], [1430, 560], [1500, 600]], dim('#5a9a6a'), { key: 'isle' });
      for (let i = 0; i < 6; i++) { const y = 640 + i * 24, x = ((i * 310 + t * 40) % 2400) - 300; pt.fill(rectPts(x, y, 120, 5), dim('#9fd4f4'), { key: 'wv' + i, outline: false }); }
    });
    mid((pt, t) => {
      pt.fill([[-300, 785], [W + 300, 785], [W + 300, 800 + Math.sin(t * 2) * 6], [-300, 800 + Math.sin(t * 2) * 6]], '#ffffff', { key: 'foam', outline: false });
      for (const [x, s] of [[180, 1.1], [1760, 1.2]]) {
        pt.fill([[x - 10, 830], [x + 20 * s, 830], [x + 50 * s, 520], [x + 30 * s, 520]], '#9a6a3a', { key: 'palm' + x });
        for (let k = 0; k < 5; k++) { const a = -2.6 + k * 0.55; pt.fill([[x + 40 * s, 520], [x + 40 * s + Math.cos(a) * 170 * s, 520 + Math.sin(a) * 60 * s + 60], [x + 40 * s + Math.cos(a) * 80 * s, 510 + Math.sin(a) * 30 * s]], dim('#3f9a52'), { key: 'pl' + x + k }); }
      }
      pt.fill([[1300, 840], [1306, 600], [1314, 600], [1320, 840]], '#efefef', { key: 'umbp' });
      pt.fill([[1180, 640], [1310, 560], [1440, 640]], dim('#ef5a4a'), { key: 'umb' });
    });
  } else if (scene === 'city') {
    far((pt) => {
      for (let i = 0; i < 11; i++) {
        const x = -150 + i * 210, h = 260 + R.r(0, 220), col = dim(['#9fb2c8', '#b4a8c4', '#a8bfb8', '#c4b4a0'][i % 4]);
        pt.fill(rectPts(x, 780 - h, 190, h), col, { key: 'bd' + i });
        for (let r = 0; r < Math.floor(h / 70); r++) for (let c = 0; c < 3; c++) pt.fill(rectPts(x + 24 + c * 55, 800 - h + r * 70, 30, 34), night ? (R.f() > 0.4 ? '#ffe08a' : '#3a4670') : dim('#dceaf6'), { key: `w${i}_${r}_${c}`, outline: false });
      }
    });
    mid((pt) => {
      pt.fill([[-300, 780], [W + 300, 780], [W + 300, GROUND + 10], [-300, GROUND + 10]], dim('#c8c2ba'), { key: 'walk', outline: false });
      for (const x of [260, 1000, 1700]) { pt.fill(rectPts(x - 7, 520, 14, 300), dim('#4a5060'), { key: 'lp' + x }); pt.fill(circlePts(x, 512, 24, 20), night ? '#fff0a0' : '#e8e8e8', { key: 'lpl' + x, glow: night }); }
      pt.fill(roundRectPts(560, 690, 190, 26, 10), dim('#a0643a'), { key: 'bench' });
      pt.fill(rectPts(575, 716, 12, 60), '#4a5060', { key: 'bl1' }); pt.fill(rectPts(723, 716, 12, 60), '#4a5060', { key: 'bl2' });
    });
  } else if (scene === 'forest') {
    far((pt) => {
      pt.fill([[-300, 720], [200, 520], [600, 640], [1000, 500], [1450, 620], [1900, 520], [2300, 700], [2300, 780], [-300, 780]], dim('#7fb27a'), { key: 'hill1' });
      for (let i = 0; i < 9; i++) tree(pt, -100 + i * 260 + R.r(-40, 40), 760, 0.8 + R.r(0, 0.3), dim('#4f8a5a', 0.45), 'ft' + i, false);
    });
    mid((pt) => {
      pt.fill([[-300, 790], [W + 300, 790], [W + 300, GROUND + 10], [-300, GROUND + 10]], dim('#5a9a4a'), { key: 'mg', outline: false });
      for (const [x, s] of [[90, 1.3], [1820, 1.4], [1560, 1.0]]) roundTree(pt, x, 820, s, dim('#3f8a4a'), 'rt' + x);
      for (let i = 0; i < 4; i++) { const x = 400 + i * 330; pt.fill(rectPts(x - 5, 800, 10, 22), '#f4ead8', { key: 'ms' + i }); pt.fill(ellipsePts(x, 800, 22, 14, 0, 16), '#e0473c', { key: 'mc' + i }); }
    });
  } else if (scene === 'park') {
    far((pt) => {
      pt.fill([[-300, 740], [300, 560], [800, 700], [1300, 580], [1900, 700], [2300, 620], [2300, 790], [-300, 790]], dim('#9fd08a'), { key: 'hill' });
    });
    mid((pt) => {
      pt.fill([[-300, 790], [W + 300, 790], [W + 300, GROUND + 10], [-300, GROUND + 10]], dim('#7cc46a'), { key: 'mg', outline: false });
      roundTree(pt, 150, 810, 1.2, dim('#4f9a4a'), 'pt1'); roundTree(pt, 1750, 800, 1.35, dim('#4a924a'), 'pt2');
      fence(pt, 380, 1300, 800, dim('#f0e6d2'), 'pf');
      pt.fill(roundRectPts(1380, 720, 210, 26, 10), dim('#a0643a'), { key: 'bench' });
      pt.fill(rectPts(1395, 746, 12, 50), '#5a4a3a', { key: 'bl1' }); pt.fill(rectPts(1563, 746, 12, 50), '#5a4a3a', { key: 'bl2' });
    });
  } else if (scene === 'room') {
    far((pt) => {
      pt.fill(rectPts(-300, -200, W + 600, GROUND + 210), dim('#f3e2c8', 0.4), { key: 'wall', outline: false });
      pt.fill(rectPts(-300, 760, W + 600, 30), dim('#d9c0a0', 0.4), { key: 'skirt', outline: false });
    });
    mid((pt) => {
      const sky = skyColors('park', time);
      pt.fill(roundRectPts(260, 220, 380, 300, 10), '#ffffff', { key: 'winF' });
      pt.fill(rectPts(280, 240, 340, 260), night ? '#1c2a5a' : sunset ? '#ffb07a' : sky.top, { key: 'winG', outline: false });
      pt.fill(rectPts(445, 240, 10, 260), '#ffffff', { key: 'winM', outline: false });
      pt.fill(roundRectPts(1150, 600, 520, 170, 40), dim('#5a7ac4', 0.4), { key: 'sofa' });
      pt.fill(roundRectPts(1130, 560, 70, 210, 30), dim('#4a68b0', 0.4), { key: 'sofaL' });
      pt.fill(roundRectPts(1620, 560, 70, 210, 30), dim('#4a68b0', 0.4), { key: 'sofaR' });
      pt.fill(roundRectPts(1250, 260, 220, 160, 8), '#c9a060', { key: 'pic' });
      pt.fill(rectPts(1266, 276, 188, 128), dim('#8fd0e8', 0.4), { key: 'picIn', outline: false });
      pt.fill([[1266, 404], [1330, 330], [1380, 380], [1410, 350], [1454, 404]], dim('#5a9a4a', 0.4), { key: 'picHill', outline: false });
      pt.fill(rectPts(820, 640, 16, 150), '#5a4a3a', { key: 'lampS' });
      pt.fill([[770, 650], [886, 650], [860, 560], [796, 560]], night ? '#ffe08a' : '#f4d9a0', { key: 'lampH', glow: night });
      pt.fill(roundRectPts(140, 690, 90, 100, 14), '#c9744a', { key: 'pot' });
      for (let k = 0; k < 5; k++) pt.fill(ellipsePts(185 + (k - 2) * 22, 640 - Math.abs(k - 2) * 10, 22, 54, (k - 2) * 0.3, 16), dim('#4f9a4a', 0.4), { key: 'leaf' + k });
    });
  }

  // 地面
  near((pt) => {
    const g = { snow: '#ffffff', beach: '#f1d9a0', city: '#7d7f8a', forest: '#4f8f42', park: '#6cb85a', room: '#c89464' }[scene];
    pt.fill([[-400, GROUND - 6], [W + 400, GROUND - 6], [W + 400, H + 300], [-400, H + 300]], dim(g, 0.3), { key: 'ground', outline: false, flat: true });
    if (scene === 'room') for (let i = 0; i < 12; i++) pt.fill(rectPts(-200 + i * 200, GROUND - 6, 3, 400), dim(shade(g, -0.15), 0.3), { key: 'board' + i, outline: false });
    if (scene === 'city') for (let i = 0; i < 9; i++) pt.fill(rectPts(-100 + i * 250, 990, 130, 16), '#f4f1ea', { key: 'lane' + i, outline: false });
    if (scene === 'park' || scene === 'forest') for (let i = 0; i < 22; i++) { const x = R.r(-100, W + 100), y = R.r(GROUND + 30, H - 20); pt.fill(circlePts(x, y, 7, 8), ['#ffffff', '#f2c230', '#f08bb0'][i % 3], { key: 'fl' + i, outline: false }); }
    if (scene === 'snow') for (let i = 0; i < 10; i++) pt.fill(ellipsePts(R.r(0, W), R.r(GROUND + 40, H - 30), R.r(60, 160), R.r(8, 16), 0, 18), '#e3eef8', { key: 'sd' + i, outline: false });
    if (scene === 'beach') for (let i = 0; i < 6; i++) pt.fill(ellipsePts(R.r(0, W), R.r(GROUND + 40, H - 30), 18, 10, R.r(0, 3), 10), '#f7f0e0', { key: 'shell' + i });
  });
  return layers;
}

/** 天氣粒子（螢幕座標，畫在最上層） */
export function weatherParticles(pt, weather, t, scene) {
  if (weather === 'none' || (scene === 'room' && weather !== 'stars')) return;
  const R = RNG('weather', weather);
  if (weather === 'snow') for (let i = 0; i < 90; i++) {
    const sp = R.r(40, 110), x = (R.r(0, W) + Math.sin(t * 0.8 + i) * 30 + 2000) % W, y = (R.r(0, H) + t * sp) % (H + 20) - 10;
    pt.fill(circlePts(x, y, R.r(3, 7), 8), '#ffffff', { key: 'sn' + i, outline: false, alpha: 0.9 });
  }
  if (weather === 'rain') for (let i = 0; i < 120; i++) {
    const x = (R.r(0, W) - t * 220 + 4000) % W, y = (R.r(0, H) + t * 1300) % (H + 60) - 30;
    pt.line([[x, y], [x - 8, y + 30]], '#a9c4e8', 3, { key: 'rn' + i, alpha: 0.7 });
  }
  if (weather === 'leaves' || weather === 'petals') for (let i = 0; i < 26; i++) {
    const x = (R.r(0, W) + Math.sin(t * 1.2 + i) * 60 - t * 40 + 4000) % W, y = (R.r(0, H) + t * R.r(40, 80)) % (H + 30) - 15;
    const c = weather === 'leaves' ? R.pick(['#e8833a', '#f2c230', '#c8543a']) : R.pick(['#ffc0d4', '#ffd8e4', '#ffffff']);
    pt.fill(ellipsePts(x, y, 12, 6, t * 2 + i, 10), c, { key: 'lf' + i, outline: false });
  }
  if (weather === 'stars') for (let i = 0; i < 40; i++) {
    const x = R.r(0, W), y = R.r(0, 520), k = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
    pt.fill(circlePts(x, y, 2 + 2 * k, 6), '#fff8d8', { key: 'st' + i, outline: false, alpha: 0.5 + 0.5 * k });
  }
}

export { TAU };
