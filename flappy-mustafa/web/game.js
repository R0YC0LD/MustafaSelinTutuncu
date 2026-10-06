/* Flappy Mustafa — bira şişeleri, sigara molası ve bol nazar boncuğu. */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const wrap = $('wrap');
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  // ───────────────────────── yardımcılar ─────────────────────────
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const smooth = (t) => t * t * (3 - 2 * t);
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    return 'rgb(' + ((a[0] + (b[0] - a[0]) * t) | 0) + ',' + ((a[1] + (b[1] - a[1]) * t) | 0) + ',' + ((a[2] + (b[2] - a[2]) * t) | 0) + ')';
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ───────────────────────── kayıt & titreşim ─────────────────────────
  const hasBridge = typeof window.Android === 'object' && window.Android !== null;
  const store = {
    get(k, d) {
      try {
        const v = hasBridge ? window.Android.load(k) : localStorage.getItem(k);
        return v === null || v === undefined || v === '' ? d : v;
      } catch (e) { return d; }
    },
    set(k, v) {
      try { if (hasBridge) window.Android.save(k, String(v)); else localStorage.setItem(k, String(v)); } catch (e) { /* yok say */ }
    },
  };
  function vibrate(ms) {
    try {
      if (hasBridge) window.Android.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* yok say */ }
  }

  // ───────────────────────── ses (WebAudio sentezi) ─────────────────────────
  const Sfx = (function () {
    let ac = null, master = null, noiseBuf = null;
    let muted = store.get('fm_mute', '0') === '1';
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.6;
        master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    function env(g, t, vol, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    function tone(type, f0, f1, dur, vol, delay) {
      const t = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, vol, dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.03);
    }
    function noise(dur, vol, ftype, f0, f1, q, delay) {
      const t = ac.currentTime + (delay || 0);
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf;
      f.type = ftype; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, vol, dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03);
    }
    const sounds = {
      flap() { noise(0.12, 0.32, 'bandpass', 500, 1700, 1.3); },
      point() { tone('sine', 880, 0, 0.09, 0.22); tone('sine', 1318, 0, 0.16, 0.2, 0.07); },
      coin() { tone('square', 988, 0, 0.07, 0.09); tone('square', 1319, 0, 0.2, 0.09, 0.065); },
      power() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, 0, 0.14, 0.2, i * 0.055)); },
      lighter() {
        noise(0.025, 0.7, 'highpass', 3500, 0, 0.7);
        noise(0.06, 0.4, 'highpass', 2500, 0, 0.7, 0.09);
        noise(0.55, 0.22, 'bandpass', 2600, 900, 0.9, 0.16);
        tone('sine', 140, 70, 0.5, 0.06, 0.16);
      },
      glass() {
        noise(0.22, 0.45, 'highpass', 2500, 7000, 0.6);
        for (let i = 0; i < 6; i++) tone('sine', 2400 + Math.random() * 4200, 0, 0.12 + Math.random() * 0.25, 0.05, Math.random() * 0.09);
      },
      hit() { noise(0.25, 0.7, 'lowpass', 900, 90, 0.8); tone('square', 210, 55, 0.28, 0.18); },
      die() { tone('sawtooth', 520, 110, 0.7, 0.1, 0.18); },
      shield() { tone('sine', 1500, 500, 0.35, 0.25); tone('triangle', 2200, 900, 0.3, 0.1); noise(0.15, 0.3, 'highpass', 3000, 0, 0.7); },
      near() { tone('triangle', 1200, 2100, 0.1, 0.14); },
      bounce() { tone('sine', 300, 600, 0.12, 0.2); },
      click() { tone('triangle', 660, 0, 0.05, 0.15); },
      slow() { tone('sine', 600, 200, 0.6, 0.18); },
      kebap() { [392, 523, 659].forEach((f, i) => tone('square', f, 0, 0.12, 0.08, i * 0.07)); },
      record() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.16, 0.18, i * 0.09)); },
    };
    const api = { init, get muted() { return muted; } };
    Object.keys(sounds).forEach((k) => {
      api[k] = function () { if (!ac || muted) return; try { sounds[k](); } catch (e) { /* yok say */ } };
    });
    api.toggle = function () {
      muted = !muted;
      store.set('fm_mute', muted ? '1' : '0');
      if (master) master.gain.value = muted ? 0 : 0.6;
      return muted;
    };
    api.suspend = function () { if (ac && ac.state === 'running') ac.suspend(); };
    api.resume = function () { if (ac && ac.state === 'suspended') ac.resume(); };
    return api;
  })();

  // ───────────────────────── sabitler ─────────────────────────
  const LH = 640;                       // mantıksal yükseklik
  const GROUND_H = 92, GROUND_Y = LH - GROUND_H;
  const GRAVITY = 1500, FLAP_V = -435, MAX_FALL = 660;
  const BW = 66, BSW = 74, BL = 560;    // şişe gövde genişliği, sprite genişliği, sprite boyu
  // şişe çarpışma bölümleri: [kapaktan uzaklık başı, sonu, yarı genişlik]
  const SEGS = [[0, 17, 16], [17, 58, 12.5], [58, 72, 19], [72, 86, 28], [86, 9999, 33]];
  const SPACING = 236;
  const HEAD_H = 62;
  let HEAD_W = 34;
  const HIT_RX = 14.5, HIT_RY = 23.5;
  const MOUTH = [0.75, 0.722];          // kafa görselindeki ağız köşesi (oran)

  const VARIANTS = [
    { dark: '#2e1505', mid: '#6e3510', light: '#b5651d', outline: '#1b0b02', cap: ['#fbe58c', '#b8871a'], foil: '#c9a23a',
      label: '#f6e9c8', band: '#b3261e', text: '#7a1410', sub: '#fff3d6', word: 'BİRA', small: 'BUZ GİBİ', seed: 11, shard: '#b5651d' },
    { dark: '#08300f', mid: '#1c7330', light: '#5cc66a', outline: '#04190a', cap: ['#f2f5f7', '#8a96a3'], foil: '#e0c45a',
      label: '#fbfbef', band: '#1e6b2f', text: '#0d4a1d', sub: '#f7e7a6', word: 'LAGER', small: 'PREMIUM', seed: 23, shard: '#5cc66a' },
    { dark: '#4a2400', mid: '#a95c06', light: '#f1a83a', outline: '#261200', cap: ['#ef6a5a', '#8a1c1c'], foil: '#c43030',
      label: '#1d2b5a', band: '#f2c14e', text: '#f7f0dc', sub: '#1d2b5a', word: 'BİRA', small: 'MALT', seed: 37, shard: '#f1a83a' },
  ];

  const ITEM_INFO = {
    coin: { name: 'Lira', desc: '+1 puan. Topla topla!', color: '#f2c032' },
    sigara: { name: 'Sigara', desc: '10 saniye dokunulmazlık! Şişeleri kırarak geç.', color: '#ff8a3d', dur: 10, banner: ['SİGARA MOLASI!', '10 saniye dokunulmaz'] },
    nazar: { name: 'Nazar Boncuğu', desc: 'Bir çarpmayı affeder. Nazar değmesin!', color: '#2f6fe0', banner: ['NAZAR BONCUĞU', 'Bir çarpma hakkın var'] },
    cay: { name: 'Çay', desc: '6 saniye ağır çekim. Keyfine bak.', color: '#d0451b', dur: 6, banner: ['ÇAY KEYFİ', 'Ağır çekim'] },
    miknatis: { name: 'Mıknatıs', desc: '8 saniye boyunca liraları kendine çeker.', color: '#e53935', dur: 8, banner: ['MIKNATIS', 'Liralar sana gelsin'] },
    ayran: { name: 'Ayran', desc: '7 saniye küçülürsün, aralardan rahat geçersin.', color: '#5bc0eb', dur: 7, banner: ['AYRAN!', 'Küçüldün'] },
    kebap: { name: 'Şiş Kebap', desc: '+5 puan. Afiyet olsun!', color: '#a0522d', banner: ['ŞİŞ KEBAP', '+5 puan'] },
  };
  const POWER_WEIGHTS = [['sigara', 20], ['nazar', 22], ['cay', 18], ['miknatis', 18], ['ayran', 14], ['kebap', 8]];

  // gökyüzü evreleri: gündüz, gün batımı, gece, şafak
  const PHASES = [
    { sky: ['#3aa9e6', '#7ccdf0', '#c9eef8'], far: '#b2dcea', mid: '#8cc3d4', bush: '#5fb34a' },
    { sky: ['#2d2a6b', '#c75b7a', '#ffb067'], far: '#9a5a86', mid: '#6b3a66', bush: '#3f6b3a' },
    { sky: ['#060a24', '#142050', '#2d3f7a'], far: '#1f2b58', mid: '#141c3e', bush: '#1b3524' },
    { sky: ['#4d6fc4', '#c99ad0', '#ffd5b0'], far: '#9d93c6', mid: '#7570a3', bush: '#4f8a4a' },
  ].map((p) => ({ sky: p.sky.map(rgb), far: rgb(p.far), mid: rgb(p.mid), bush: rgb(p.bush) }));

  // ───────────────────────── ekran ölçüsü ─────────────────────────
  let W = 360, scale = 1, cssW = 360, cssH = 640;
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const g = c.getContext('2d');
    g.scale(scale, scale);
    return [c, g];
  }

  // ───────────────────────── sprite üretimi ─────────────────────────
  const headImg = new Image();
  let headSpr = null, headPad = 2;
  let bottleSpr = [], groundSpr = null, groundW = 0, cloudSpr = [], coinSpr = null;
  let itemSpr = {}, glowGold = null, glowEmber = null, glowSun = null, glowSunset = null, puffSpr = null;
  let skyFar = null, skyMid = null, skyBush = null, skyWindows = null, stars = null;

  function buildHead() {
    const pad = headPad;
    const [t, tg] = mk(HEAD_W, HEAD_H);
    tg.drawImage(headImg, 0, 0, HEAD_W, HEAD_H);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = '#2a1608';
    tg.fillRect(0, 0, HEAD_W, HEAD_H);
    const [c, g] = mk(HEAD_W + pad * 2, HEAD_H + pad * 2);
    for (let a = 0; a < 8; a++) {
      g.drawImage(t, pad + Math.cos(a * TAU / 8) * 1.5, pad + Math.sin(a * TAU / 8) * 1.5, HEAD_W, HEAD_H);
    }
    g.imageSmoothingQuality = 'high';
    g.drawImage(headImg, pad, pad, HEAD_W, HEAD_H);
    headSpr = c;
  }

  function buildBottle(v) {
    const [c, g] = mk(BSW, BL);
    const cx = BSW / 2, hb = BW / 2;
    const path = () => {
      g.beginPath();
      g.moveTo(cx - 12.5, 15);
      g.lineTo(cx - 12.5, 54);
      g.bezierCurveTo(cx - 12.5, 70, cx - hb, 68, cx - hb, 90);
      g.lineTo(cx - hb, BL + 4);
      g.lineTo(cx + hb, BL + 4);
      g.lineTo(cx + hb, 90);
      g.bezierCurveTo(cx + hb, 68, cx + 12.5, 70, cx + 12.5, 54);
      g.lineTo(cx + 12.5, 15);
      g.closePath();
    };
    const lg = g.createLinearGradient(cx - hb, 0, cx + hb, 0);
    lg.addColorStop(0, v.dark); lg.addColorStop(0.2, v.mid); lg.addColorStop(0.4, v.light);
    lg.addColorStop(0.68, v.mid); lg.addColorStop(1, v.dark);
    path(); g.fillStyle = lg; g.fill();

    g.save(); path(); g.clip();
    const r = rng(v.seed);
    g.fillStyle = 'rgba(255,240,200,0.22)';
    for (let i = 0; i < 46; i++) {
      const y = 96 + r() * (BL - 100), x = cx - hb + 6 + r() * (BW - 12);
      g.beginPath(); g.arc(x, y, 0.8 + r() * 1.8, 0, TAU); g.fill();
    }
    // boyun folyosu
    g.fillStyle = v.foil; g.fillRect(cx - 14, 20, 28, 26);
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(cx - 14, 20, 28, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 14, 43, 28, 3);
    // etiket
    const ly = 112, lh = 86;
    g.fillStyle = v.label; g.fillRect(cx - hb, ly, BW, lh);
    g.fillStyle = v.band; g.fillRect(cx - hb, ly, BW, 4); g.fillRect(cx - hb, ly + lh - 4, BW, 4);
    g.fillRect(cx - hb, ly + 47, BW, 15);
    // amblem (yıldız)
    g.beginPath(); g.arc(cx, ly + 17, 9.5, 0, TAU); g.fill();
    g.fillStyle = v.label; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 2.8 : 6.5;
      g.lineTo(cx + Math.cos(a) * rad, ly + 17 + Math.sin(a) * rad);
    }
    g.closePath(); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = v.text; g.font = '900 16px system-ui, Roboto, sans-serif'; g.fillText(v.word, cx, ly + 37);
    g.fillStyle = v.sub; g.font = '800 8px system-ui, Roboto, sans-serif'; g.fillText(v.small, cx, ly + 55);
    g.fillStyle = v.text; g.font = '700 6.5px system-ui, Roboto, sans-serif'; g.fillText('%5 ALK · 50 cl', cx, ly + 73);
    // silindirik gölge
    const sh = g.createLinearGradient(cx - hb, 0, cx + hb, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.38)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)');
    sh.addColorStop(0.75, 'rgba(0,0,0,0.05)'); sh.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = sh; g.fillRect(cx - hb, 0, BW, BL + 4);
    // parlamalar
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(cx - hb + 9, 86, 6, BL);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - hb + 18, 92, 3, BL);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(cx - 8, 16, 3, 40);
    g.restore();

    path(); g.lineJoin = 'round'; g.lineWidth = 2.4; g.strokeStyle = v.outline; g.stroke();
    // ağız halkası
    rr(g, cx - 15.5, 10, 31, 8, 3); g.fillStyle = v.light; g.fill(); g.lineWidth = 2; g.stroke();
    // taç kapak
    g.beginPath();
    g.moveTo(cx - 14, 1); g.lineTo(cx + 14, 1); g.lineTo(cx + 17, 4); g.lineTo(cx + 17, 9);
    for (let i = 0; i <= 12; i++) g.lineTo(cx + 17 - i * (34 / 12), i % 2 ? 12 : 9.5);
    g.lineTo(cx - 17, 4); g.closePath();
    const cg = g.createLinearGradient(0, 0, 0, 12);
    cg.addColorStop(0, v.cap[0]); cg.addColorStop(1, v.cap[1]);
    g.fillStyle = cg; g.fill(); g.lineWidth = 1.8; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(cx - 11, 2.5, 14, 1.6);
    return c;
  }

  function buildGround() {
    const tiles = Math.ceil(W / 48) + 2;
    groundW = tiles * 48;
    const [c, g] = mk(groundW, GROUND_H);
    g.fillStyle = '#6f655a'; g.fillRect(0, 0, groundW, GROUND_H);
    const cols = ['#a39685', '#958877', '#ab9f8f', '#9c8f80'];
    for (let t = 0; t < tiles; t++) {
      const ox = t * 48, r = rng(77);
      for (let row = 0; row < 7; row++) {
        const y = 24 + row * 10.3, off = (row % 2) * 8;
        for (let k = -1; k < 3; k++) {
          g.fillStyle = cols[(r() * cols.length) | 0];
          rr(g, ox + off + k * 16 + 1, y + 1, 14, 8.3, 3.4); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.12)';
          g.fillRect(ox + off + k * 16 + 4, y + 2, 7, 1.4);
        }
      }
      // kaldırım taşı
      g.fillStyle = '#ddd6c6'; g.fillRect(ox, 12, 48, 10);
      g.fillStyle = '#b3ab99'; g.fillRect(ox, 20, 48, 2); g.fillRect(ox + 23, 12, 2, 10); g.fillRect(ox + 47, 12, 1, 10);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(ox, 22, 48, 3);
      // çimen
      g.fillStyle = '#74c442'; g.fillRect(ox, 0, 48, 13);
      g.fillStyle = '#5aa52f'; g.fillRect(ox, 10, 48, 3);
      g.fillStyle = '#9be15d';
      for (let i = 0; i < 6; i++) {
        const x = ox + i * 8 + 2;
        g.beginPath(); g.moveTo(x, 9); g.lineTo(x + 2, 2.5); g.lineTo(x + 4, 9); g.fill();
      }
      g.fillStyle = '#3c6d1f'; g.fillRect(ox, 0, 48, 2.2);
    }
    groundSpr = c;
  }

  function buildCloud(seed, w) {
    const h = w * 0.5;
    const [c, g] = mk(w, h);
    const r = rng(seed);
    g.fillStyle = '#ffffff';
    rr(g, w * 0.08, h * 0.5, w * 0.84, h * 0.38, h * 0.19); g.fill();
    for (let i = 0; i < 5; i++) {
      const x = w * (0.2 + i * 0.15), y = h * (0.55 - r() * 0.15), rad = h * (0.22 + r() * 0.16);
      g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, h * 0.4, 0, h);
    gr.addColorStop(0, 'rgba(200,225,240,0)'); gr.addColorStop(1, 'rgba(170,205,230,0.85)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    return c;
  }

  function buildGlow(r, stops) {
    const [c, g] = mk(r * 2, r * 2);
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    stops.forEach((s) => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  function buildCoin() {
    const R = 11;
    const [c, g] = mk(R * 2 + 2, R * 2 + 2);
    const cx = R + 1;
    const gr = g.createRadialGradient(cx - 4, cx - 4, 1, cx, cx, R);
    gr.addColorStop(0, '#fff6b0'); gr.addColorStop(0.55, '#f5c63a'); gr.addColorStop(1, '#c58a12');
    g.beginPath(); g.arc(cx, cx, R, 0, TAU); g.fillStyle = gr; g.fill();
    g.lineWidth = 1.6; g.strokeStyle = '#7a4d05'; g.stroke();
    g.beginPath(); g.arc(cx, cx, R - 3, 0, TAU); g.lineWidth = 1.1; g.strokeStyle = 'rgba(122,77,5,0.55)'; g.stroke();
    g.fillStyle = '#8a5a07'; g.font = '900 13px system-ui, Roboto, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₺', cx, cx + 0.5);
    return c;
  }

  // simgeler: (0,0) merkezli, ~32 birimlik kutuya sığar
  function drawIcon(g, type) {
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    switch (type) {
      case 'sigara': {
        g.rotate(-0.5);
        rr(g, -15, -3.6, 25, 7.2, 2); g.fillStyle = '#f8f8f2'; g.fill();
        g.lineWidth = 1.2; g.strokeStyle = '#555'; g.stroke();
        rr(g, -15, -3.6, 8.5, 7.2, 2); g.fillStyle = '#e39a3b'; g.fill(); g.stroke();
        g.fillStyle = '#b86d1c';
        for (let i = 0; i < 4; i++) g.fillRect(-13.5 + i * 1.9, -2.2 + (i % 2) * 2.6, 1, 1);
        g.fillStyle = '#8a8a8a'; g.fillRect(8, -3.6, 2.6, 7.2);
        g.beginPath(); g.arc(11.6, 0, 3.1, -Math.PI / 2, Math.PI / 2); g.fillStyle = '#ff4d1a'; g.fill();
        g.fillStyle = 'rgba(255,200,80,0.9)'; g.beginPath(); g.arc(11.4, 0, 1.4, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(235,235,235,0.95)'; g.lineWidth = 1.7;
        g.beginPath(); g.moveTo(13, -3); g.bezierCurveTo(18, -8, 9, -11, 14, -17); g.stroke();
        break;
      }
      case 'nazar': {
        const cs = ['#1b47b8', '#ffffff', '#64b5f6', '#111111'], rs = [15, 10.5, 7, 3.6];
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, rs[i], 0, TAU); g.fillStyle = cs[i]; g.fill(); }
        g.lineWidth = 1.4; g.strokeStyle = '#0d2a6e'; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(-5, -6, 2.6, 0, TAU); g.fill();
        break;
      }
      case 'cay': {
        g.beginPath(); g.ellipse(0, 12, 14, 3.8, 0, 0, TAU); g.fillStyle = '#c62828'; g.fill();
        g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke();
        const glass = () => {
          g.beginPath(); g.moveTo(-8.5, -13); g.bezierCurveTo(-8.5, -4, -4.2, -3, -4.6, 1);
          g.bezierCurveTo(-5, 5, -7.5, 7, -6.5, 11); g.lineTo(6.5, 11);
          g.bezierCurveTo(7.5, 7, 5, 5, 4.6, 1); g.bezierCurveTo(4.2, -3, 8.5, -4, 8.5, -13); g.closePath();
        };
        g.save(); glass(); g.clip();
        const tg = g.createLinearGradient(0, -10, 0, 11);
        tg.addColorStop(0, '#e2671f'); tg.addColorStop(1, '#8e1e08');
        g.fillStyle = tg; g.fillRect(-10, -9, 20, 21);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-10, -13, 20, 4);
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-6.5, -11, 2, 20);
        g.restore();
        glass(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(-2, -15); g.bezierCurveTo(-5, -18, 1, -19, -2, -23); g.stroke();
        g.beginPath(); g.moveTo(3, -15); g.bezierCurveTo(0, -18, 6, -19, 3, -22); g.stroke();
        break;
      }
      case 'miknatis': {
        g.rotate(0.5);
        g.lineCap = 'butt';
        g.beginPath(); g.arc(0, -2, 9, Math.PI, 0); g.lineTo(9, 9); g.moveTo(-9, -2); g.lineTo(-9, 9);
        g.lineWidth = 8.5; g.strokeStyle = '#4a0d0d'; g.stroke();
        g.lineWidth = 6; g.strokeStyle = '#e53935'; g.stroke();
        g.fillStyle = '#e8edf2'; g.strokeStyle = '#4a0d0d'; g.lineWidth = 1.3;
        g.fillRect(-13, 6, 8, 6); g.strokeRect(-13, 6, 8, 6);
        g.fillRect(5, 6, 8, 6); g.strokeRect(5, 6, 8, 6);
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(0, -2, 9, Math.PI * 1.15, Math.PI * 1.55); g.stroke();
        break;
      }
      case 'ayran': {
        g.beginPath(); g.moveTo(-9, -9); g.lineTo(9, -9); g.lineTo(7, 13); g.lineTo(-7, 13); g.closePath();
        g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#2a6fb0'; g.stroke();
        g.fillStyle = '#2a6fb0'; g.fillRect(-8.2, 0, 16.2, 5);
        g.fillStyle = '#fff'; g.font = '900 4.4px system-ui, Roboto, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AYRAN', 0, 2.7);
        g.fillStyle = '#ffffff';
        [[-6, -10, 3.6], [-1, -12, 4.2], [4.5, -10.5, 3.8], [8, -9, 2.4]].forEach((b) => { g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill(); });
        g.strokeStyle = 'rgba(42,111,176,0.5)'; g.lineWidth = 1;
        g.beginPath(); g.arc(-1, -12, 4.2, Math.PI, TAU); g.stroke();
        break;
      }
      case 'kebap': {
        g.rotate(-0.6);
        g.strokeStyle = '#9aa3ab'; g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(-17, 0); g.lineTo(17, 0); g.stroke();
        g.fillStyle = '#5d4037'; g.fillRect(-19, -2, 4, 4);
        const parts = [['#7b3f1d', 4.5], ['#d32f2f', 3.6], ['#8b4a22', 4.5], ['#43a047', 3.4], ['#7b3f1d', 4.5]];
        parts.forEach((p, i) => {
          g.beginPath(); g.ellipse(-10 + i * 5.6, 0, 3, p[1], 0, 0, TAU);
          g.fillStyle = p[0]; g.fill(); g.lineWidth = 0.9; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.stroke();
        });
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(-11, -3, 1.4, 2.4); g.fillRect(0, -3, 1.4, 2.4);
        break;
      }
      case 'coin': {
        g.drawImage(coinSpr, -12, -12, 24, 24);
        break;
      }
    }
    g.restore();
  }

  function buildItem(type) {
    const R = 21;
    const [c, g] = mk(R * 2, R * 2);
    g.translate(R, R);
    const col = ITEM_INFO[type].color;
    const gr = g.createRadialGradient(-5, -6, 2, 0, 0, R - 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0.12)');
    g.beginPath(); g.arc(0, 0, R - 2, 0, TAU); g.fillStyle = gr; g.fill();
    g.lineWidth = 2.6; g.strokeStyle = col; g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(0, 0, R - 4.5, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
    g.scale(0.92, 0.92);
    drawIcon(g, type);
    return c;
  }

  function buildSkyline() {
    // uzak katman: İstanbul siluetine selam — camiler, minareler, Galata
    const tw = 480;
    const far = new Path2D();
    const base = GROUND_Y + 2;
    const r = rng(5);
    for (let x = 0; x < tw; ) {
      const w = 18 + r() * 26, h = 22 + r() * 40;
      far.rect(x, base - h, w + 1, h);
      x += w;
    }
    const mosque = (mx, s) => {
      far.rect(mx - 44 * s, base - 62 * s, 88 * s, 62 * s);
      far.moveTo(mx + 34 * s, base - 62 * s); far.arc(mx, base - 62 * s, 34 * s, 0, Math.PI, true);
      far.moveTo(mx + 54 * s, base - 50 * s); far.arc(mx + 38 * s, base - 50 * s, 16 * s, 0, Math.PI, true);
      far.moveTo(mx - 22 * s, base - 50 * s); far.arc(mx - 38 * s, base - 50 * s, 16 * s, 0, Math.PI, true);
      far.rect(mx - 1.2 * s, base - 108 * s, 2.4 * s, 14 * s);
      [-62, 62, -78, 78].forEach((dx, i) => {
        const hh = (i < 2 ? 150 : 120) * s, mw = 5.5 * s, x = mx + dx * s;
        far.rect(x - mw / 2, base - hh, mw, hh);
        far.rect(x - mw, base - hh * 0.72, mw * 2, 3 * s);
        far.rect(x - mw, base - hh * 0.86, mw * 2, 3 * s);
        far.moveTo(x - mw / 2 - 0.5, base - hh); far.lineTo(x, base - hh - 24 * s); far.lineTo(x + mw / 2 + 0.5, base - hh); far.closePath();
      });
    };
    mosque(120, 1);
    mosque(330, 0.55);
    // Galata kulesi
    const gx = 420;
    far.rect(gx - 11, base - 112, 22, 112);
    far.rect(gx - 14, base - 124, 28, 14);
    far.moveTo(gx - 15, base - 124); far.lineTo(gx, base - 156); far.lineTo(gx + 15, base - 124); far.closePath();
    skyFar = { path: far, w: tw };

    // orta katman: apartmanlar ve pencereler
    const mw = 400, mid = new Path2D(), win = new Path2D();
    const r2 = rng(9);
    for (let x = 0; x < mw; ) {
      const w = 26 + r2() * 30, h = 26 + r2() * 52;
      mid.rect(x, base - h, w + 0.5, h);
      if (r2() < 0.5) { mid.moveTo(x, base - h); mid.lineTo(x + w / 2, base - h - 10); mid.lineTo(x + w + 0.5, base - h); mid.closePath(); }
      for (let wy = base - h + 7; wy < base - 8; wy += 10) {
        for (let wx = x + 5; wx < x + w - 6; wx += 8) if (r2() < 0.45) win.rect(wx, wy, 3.5, 4.5);
      }
      x += w + 3 + r2() * 10;
    }
    skyMid = { path: mid, w: mw };
    skyWindows = win;

    // çalılar
    const bw = 300, bush = new Path2D(), r3 = rng(3);
    for (let x = -10; x < bw + 30; x += 22 + r3() * 14) {
      const rad = 14 + r3() * 12;
      bush.moveTo(x + rad, base); bush.arc(x, base, rad, 0, Math.PI, true);
    }
    skyBush = { path: bush, w: bw };
  }

  function buildStars() {
    const p1 = new Path2D(), p2 = new Path2D(), r = rng(99);
    for (let i = 0; i < 80; i++) {
      const x = r() * W, y = r() * (GROUND_Y - 160), s = 0.8 + r() * 1.6;
      (i % 2 ? p1 : p2).rect(x, y, s, s);
    }
    stars = [p1, p2];
  }

  function buildAll() {
    if (headImg.naturalWidth) {
      HEAD_W = HEAD_H * headImg.naturalWidth / headImg.naturalHeight;
      buildHead();
    }
    bottleSpr = VARIANTS.map(buildBottle);
    buildGround();
    cloudSpr = [buildCloud(1, 90), buildCloud(2, 120), buildCloud(3, 70)];
    coinSpr = buildCoin();
    itemSpr = {};
    Object.keys(ITEM_INFO).forEach((k) => { if (k !== 'coin') itemSpr[k] = buildItem(k); });
    glowGold = buildGlow(60, [[0, 'rgba(255,225,120,0.75)'], [0.45, 'rgba(255,170,40,0.3)'], [1, 'rgba(255,140,0,0)']]);
    glowEmber = buildGlow(10, [[0, 'rgba(255,230,140,1)'], [0.4, 'rgba(255,110,30,0.7)'], [1, 'rgba(255,60,0,0)']]);
    glowSun = buildGlow(70, [[0, 'rgba(255,255,220,1)'], [0.32, 'rgba(255,240,150,1)'], [0.36, 'rgba(255,230,120,0.45)'], [1, 'rgba(255,230,120,0)']]);
    glowSunset = buildGlow(80, [[0, 'rgba(255,240,200,1)'], [0.3, 'rgba(255,150,70,1)'], [0.34, 'rgba(255,120,60,0.45)'], [1, 'rgba(255,90,60,0)']]);
    puffSpr = buildGlow(16, [[0, 'rgba(235,235,235,0.95)'], [0.55, 'rgba(220,220,220,0.55)'], [1, 'rgba(210,210,210,0)']]);
    buildSkyline();
    buildStars();
  }

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    cssH = vh;
    cssW = Math.min(vw, Math.round(vh * 0.72));   // masaüstünde dikey oran
    if (vw - cssW < 40) cssW = vw;
    wrap.style.width = cssW + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2.25);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = canvas.height / LH;
    W = canvas.width / scale;
    buildAll();
    bird.x = Math.max(84, W * 0.3);
    if (state === 'menu') bird.x = W / 2;
    needRender = true;
  }

  // ───────────────────────── oyun durumu ─────────────────────────
  let state = 'loading';        // loading | menu | ready | play | dying | over
  let paused = false, needRender = true;
  const bird = { x: 100, y: 300, vy: 0, rot: 0, flapT: 0, scale: 1, dead: false, onGround: false };
  const fx = { inv: 0, slow: 0, magnet: 0, mini: 0, shield: 0, grace: 0 };
  let pipes = [], items = [], parts = [], pops = [], banner = null;
  let score = 0, passed = 0, smashed = 0, coins = 0, nears = 0;
  let best = parseInt(store.get('fm_best', '0'), 10) || 0;
  let worldT = 0, realT = 0, timeScale = 1, groundX = 0, bgX = 0;
  let phaseV = 0, lastC = null, spawned = 0, sincePower = 0, deadT = 0;
  let shakeT = 0, shakeMag = 0, flashA = 0, smokeT = 0;
  let autopilot = false;

  function diff() { return Math.min(1, passed / 60); }
  function speed() { return 150 + 72 * diff(); }

  function resetRun() {
    pipes = []; items = []; parts = []; pops = []; banner = null;
    score = 0; passed = 0; smashed = 0; coins = 0; nears = 0;
    worldT = 0; timeScale = 1; lastC = null; spawned = 0; sincePower = 0; deadT = 0;
    fx.inv = fx.slow = fx.magnet = fx.mini = fx.shield = fx.grace = 0;
    bird.x = Math.max(84, W * 0.3); bird.y = 280; bird.vy = 0; bird.rot = 0; bird.scale = 1;
    bird.dead = false; bird.onGround = false; bird.onGroundT = 0;
    phaseV = 0;
  }

  function pipeCenter(p) {
    return p.amp ? p.c + p.amp * Math.sin(p.ph + worldT * p.freq) : p.c;
  }

  function pickPower() {
    let total = 0;
    const list = POWER_WEIGHTS.filter((w) => {
      if (w[0] === 'sigara' && fx.inv > 0) return false;
      if (w[0] === 'nazar' && fx.shield >= 2) return false;
      if (w[0] === 'cay' && fx.slow > 0) return false;
      if (w[0] === 'miknatis' && fx.magnet > 0) return false;
      if (w[0] === 'ayran' && fx.mini > 0) return false;
      return true;
    });
    list.forEach((w) => { total += w[1]; });
    let r = Math.random() * total;
    for (const w of list) { r -= w[1]; if (r <= 0) return w[0]; }
    return 'nazar';
  }

  function spawnPipe(x) {
    const d = diff();
    const gap = 202 - 48 * d;
    const minC = 66 + gap / 2, maxC = GROUND_Y - 58 - gap / 2;
    let c = lastC === null ? (minC + maxC) / 2 + rand(-40, 40) : lastC + rand(-165, 165);
    c = clamp(c, minC, maxC);
    let amp = 0;
    if (spawned >= 14 && Math.random() < 0.2 + 0.35 * d) {
      amp = 20 + 28 * d;
      c = clamp(c, minC + amp, maxC - amp);
    }
    const p = {
      x, c, gap, amp, ph: Math.random() * TAU, freq: 1.4 + Math.random() * 0.8,
      vt: (Math.random() * VARIANTS.length) | 0, vb: (Math.random() * VARIANTS.length) | 0,
      passed: false, brokenT: 0, brokenB: 0, bonus: false, minClr: 999, hit: false,
    };
    pipes.push(p);
    spawned++;

    // içerik: güç, lira veya hiçbir şey
    sincePower++;
    const powerChance = spawned < 4 ? 0 : 0.08 + 0.035 * sincePower;
    if (spawned === 4 || Math.random() < powerChance) {
      const type = spawned === 4 ? 'sigara' : pickPower();
      items.push({ type, x, y: 0, pipe: p, dy: 0, t: Math.random() * 5, free: false });
      sincePower = 0;
    } else if (Math.random() < 0.36) {
      items.push({ type: 'coin', x, y: 0, pipe: p, dy: 0, t: Math.random() * 5, free: false });
    }
    // borular arasında lira yayı
    if (lastC !== null && spawned > 2 && Math.random() < 0.2) {
      const mx = x - SPACING / 2, my = (lastC + c) / 2;
      for (let i = -1; i <= 1; i++) items.push({ type: 'coin', x: mx + i * 28, y: my - (1 - Math.abs(i)) * 16, pipe: null, dy: 0, t: i, free: false });
    }
    lastC = c;
  }

  // ───────────────────────── parçacıklar ─────────────────────────
  const MAX_PARTS = 260;
  function addPart(p) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push(p);
  }
  function burst(x, y, n, color, kind, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = (spd || 160) * (0.4 + Math.random() * 0.8);
      addPart({ k: kind || 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.5,
        s: 2 + Math.random() * 3, rot: Math.random() * TAU, vr: rand(-10, 10), c: color, g: kind === 'shard' ? 900 : 200 });
    }
  }
  function popup(text, x, y, color, size) {
    pops.push({ text, x, y, life: 0, max: 0.9, color: color || '#fff', size: size || 20 });
  }
  function showBanner(title, sub, color) {
    banner = { title, sub, color: color || '#ffe66d', t: 0, max: 1.9 };
  }
  function shake(mag, t) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, t); }

  // ───────────────────────── eylemler ─────────────────────────
  function flap() {
    if (state !== 'play' || paused) return;
    bird.vy = FLAP_V;
    bird.flapT = 1;
    Sfx.flap();
    for (let i = 0; i < 3; i++) {
      addPart({ k: 'puff', x: bird.x - 10 * bird.scale, y: bird.y + 14 * bird.scale, vx: rand(-90, -40), vy: rand(30, 90),
        life: 0, max: 0.35, s: 5 + Math.random() * 4, c: null, g: 0, rot: 0, vr: 0 });
    }
  }

  function smash(p, top) {
    if (top) p.brokenT = 1; else p.brokenB = 1;
    const c = pipeCenter(p), v = VARIANTS[top ? p.vt : p.vb];
    const y0 = top ? c - p.gap / 2 : c + p.gap / 2;
    for (let i = 0; i < 26; i++) {
      const y = top ? y0 - Math.random() * Math.min(y0, 200) : y0 + Math.random() * Math.min(GROUND_Y - y0, 200);
      addPart({ k: 'shard', x: p.x + rand(-28, 28), y, vx: rand(80, 320), vy: rand(-320, 60), life: 0, max: 0.9 + Math.random() * 0.6,
        s: 3 + Math.random() * 6, rot: Math.random() * TAU, vr: rand(-14, 14), c: Math.random() < 0.7 ? v.shard : v.light, g: 1100 });
    }
    for (let i = 0; i < 14; i++) {
      addPart({ k: 'foam', x: p.x + rand(-20, 20), y: y0 + (top ? -10 : 10), vx: rand(-60, 220), vy: rand(-260, 40), life: 0, max: 0.8,
        s: 2 + Math.random() * 3.5, c: '#fff8e1', g: 900, rot: 0, vr: 0 });
    }
    Sfx.glass();
    vibrate(25);
    shake(5, 0.18);
    if (!p.bonus) {
      p.bonus = true;
      score++; smashed++;
      popup('KIRDIN! +1', p.x, y0 + (top ? -26 : 26), '#ffd54f', 18);
    }
  }

  function die(ground) {
    if (state !== 'play') return;
    state = 'dying';
    bird.dead = true;
    deadT = 0;
    Sfx.hit();
    vibrate(ground ? 90 : 60);
    shake(9, 0.35);
    flashA = 0.85;
    $('pauseBtn').classList.add('hidden');
    if (!ground) { bird.vy = -220; Sfx.die(); } else { bird.onGround = true; bird.vy = 0; }
  }

  function hitBottle(p, top) {
    if (fx.inv > 0) { smash(p, top); return; }
    if (fx.grace > 0) return;
    if (fx.shield > 0) {
      fx.shield--;
      fx.grace = 1.2;
      smash(p, top);
      Sfx.shield();
      popup('NAZAR KORUDU!', bird.x, bird.y - 46, '#90caf9', 18);
      burst(bird.x, bird.y, 18, '#64b5f6', 'spark', 220);
      return;
    }
    p.hit = true;
    die(false);
  }

  function collect(it) {
    const info = ITEM_INFO[it.type];
    it.dead = true;
    if (it.type === 'coin') {
      score++; coins++;
      Sfx.coin();
      popup('+1', it.x, it.y - 18, '#ffe082', 16);
      burst(it.x, it.y, 6, '#ffd54f', 'spark', 120);
      return;
    }
    burst(it.x, it.y, 16, info.color, 'spark', 200);
    switch (it.type) {
      case 'sigara':
        fx.inv = 10; Sfx.lighter(); vibrate(30);
        for (let i = 0; i < 10; i++) addPart({ k: 'smoke', x: bird.x + 16, y: bird.y + 10, vx: rand(-80, 20), vy: rand(-60, 10), life: 0, max: 1.2, s: 4 + Math.random() * 4, c: null, g: -20, rot: 0, vr: 0 });
        break;
      case 'nazar': fx.shield = Math.min(2, fx.shield + 1); Sfx.power(); break;
      case 'cay': fx.slow = 6; Sfx.slow(); break;
      case 'miknatis': fx.magnet = 8; Sfx.power(); break;
      case 'ayran': fx.mini = 7; Sfx.power(); break;
      case 'kebap': score += 5; Sfx.kebap(); popup('+5', it.x, it.y - 20, '#ffcc80', 24); break;
    }
    showBanner(info.banner[0], info.banner[1], info.color);
  }

  function birdHit() {
    const s = bird.scale, rx = HIT_RX * s, ry = HIT_RY * s;
    const cs = Math.abs(Math.cos(bird.rot)), sn = Math.abs(Math.sin(bird.rot));
    return [Math.sqrt(rx * rx * cs * cs + ry * ry * sn * sn) * 0.97, Math.sqrt(ry * ry * cs * cs + rx * rx * sn * sn) * 0.97];
  }
  function ellRect(cx, cy, rx, ry, x0, y0, x1, y1) {
    const nx = cx < x0 ? x0 : cx > x1 ? x1 : cx;
    const ny = cy < y0 ? y0 : cy > y1 ? y1 : cy;
    const dx = cx - nx, dy = (cy - ny) * (rx / ry);
    return dx * dx + dy * dy < rx * rx;
  }
  function pipeOverlap(p, rx, ry, top) {
    const c = pipeCenter(p);
    const edge = top ? c - p.gap / 2 : c + p.gap / 2;
    for (let i = 0; i < SEGS.length; i++) {
      const sg = SEGS[i], hw = sg[2];
      let y0, y1;
      if (top) { y0 = edge - sg[1]; y1 = edge - sg[0]; } else { y0 = edge + sg[0]; y1 = edge + sg[1]; }
      if (ellRect(bird.x, bird.y, rx, ry, p.x - hw, y0, p.x + hw, y1)) return true;
    }
    return false;
  }
  function overlappingAny() {
    const h = birdHit();
    for (const p of pipes) {
      if (Math.abs(p.x - bird.x) > 60) continue;
      if (!p.brokenT && pipeOverlap(p, h[0], h[1], true)) return true;
      if (!p.brokenB && pipeOverlap(p, h[0], h[1], false)) return true;
    }
    return false;
  }

  // ───────────────────────── güncelleme ─────────────────────────
  function update(dt) {
    realT += dt;
    if (state === 'menu') {
      worldT += dt;
      groundX += 60 * dt; bgX += 60 * dt;
      bird.x = W / 2;
      bird.scale = 1.7;
      bird.y = 318 + Math.sin(realT * 2.4) * 10;
      bird.rot = Math.sin(realT * 1.7) * 0.12;
      updateParts(dt);
      return;
    }
    if (state === 'ready') {
      worldT += dt;
      groundX += speed() * dt; bgX += speed() * dt;
      bird.y = 280 + Math.sin(realT * 3) * 8;
      bird.rot = 0;
      updateParts(dt);
      return;
    }
    if (state === 'over') { updateParts(dt); updatePops(dt); return; }

    if (state === 'dying') {
      deadT += dt;
      if (!bird.onGround) {
        bird.vy = Math.min(MAX_FALL * 1.2, bird.vy + GRAVITY * dt);
        bird.y += bird.vy * dt;
        bird.rot = Math.min(Math.PI / 2, bird.rot + dt * 5);
        const ry = HIT_RY * bird.scale;
        if (bird.y + ry * 0.7 >= GROUND_Y) { bird.y = GROUND_Y - ry * 0.7; bird.onGround = true; shake(4, 0.15); Sfx.bounce(); }
      }
      if (bird.onGround) {
        bird.onGroundT = (bird.onGroundT || 0) + dt;
        if (bird.onGroundT > 0.55) gameOver();
      }
      updateParts(dt); updatePops(dt);
      if (banner) { banner.t += dt; if (banner.t > banner.max) banner = null; }
      return;
    }
    if (state !== 'play') return;

    // zaman ölçeği (çay)
    if (fx.slow > 0) fx.slow = Math.max(0, fx.slow - dt);
    const tsTarget = fx.slow > 0 ? 0.6 : 1;
    timeScale += (tsTarget - timeScale) * Math.min(1, dt * 5);
    const g = dt * timeScale;
    worldT += g;

    // güç zamanlayıcıları
    if (fx.inv > 0) {
      fx.inv -= g;
      if (fx.inv <= 0) {
        if (overlappingAny()) fx.inv = 0.05;   // şişenin içinde bitmesin
        else { fx.inv = 0; fx.grace = 0.6; popup('Sigara bitti!', bird.x, bird.y - 44, '#ffccbc', 15); }
      }
    }
    if (fx.magnet > 0) fx.magnet = Math.max(0, fx.magnet - g);
    if (fx.mini > 0) {
      fx.mini -= g;
      if (fx.mini <= 0) { fx.mini = 0; fx.grace = Math.max(fx.grace, 0.7); }
    }
    if (fx.grace > 0) fx.grace = Math.max(0, fx.grace - g);
    const targetScale = fx.mini > 0 ? 0.62 : 1;
    bird.scale += (targetScale - bird.scale) * Math.min(1, g * 6);

    // dünya
    const spd = speed();
    groundX += spd * g; bgX += spd * g;
    for (const p of pipes) p.x -= spd * g;
    const last = pipes[pipes.length - 1];
    if (!last) spawnPipe(W + 110);
    else if (last.x < W + 40) spawnPipe(last.x + SPACING);
    while (pipes.length && pipes[0].x < -BSW) pipes.shift();

    // kuş
    if (autopilot) autoFly();
    bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * g);
    bird.y += bird.vy * g;
    bird.flapT = Math.max(0, bird.flapT - g * 5);
    const targetRot = bird.vy < 0 ? -0.42 : Math.min(1.25, -0.42 + (bird.vy / MAX_FALL) * 2.1);
    bird.rot += (targetRot - bird.rot) * Math.min(1, g * (bird.vy < 0 ? 18 : 6));

    const h = birdHit();
    if (bird.y - h[1] < -24) { bird.y = -24 + h[1]; if (bird.vy < 0) bird.vy = 0; }
    if (bird.y + h[1] >= GROUND_Y) {
      if (fx.inv > 0 || fx.grace > 0 || fx.shield > 0) {
        if (!(fx.inv > 0 || fx.grace > 0)) { fx.shield--; fx.grace = 1.2; Sfx.shield(); popup('NAZAR KORUDU!', bird.x, bird.y - 46, '#90caf9', 18); }
        bird.y = GROUND_Y - h[1];
        bird.vy = FLAP_V * 0.95;
        Sfx.bounce();
        burst(bird.x, GROUND_Y, 8, '#c8b89a', 'spark', 120);
      } else {
        bird.y = GROUND_Y - h[1] * 0.7;
        die(true);
        return;
      }
    }

    // şişeler
    for (const p of pipes) {
      if (Math.abs(p.x - bird.x) < 60) {
        if (!p.brokenT && pipeOverlap(p, h[0], h[1], true)) { hitBottle(p, true); if (state !== 'play') return; }
        if (!p.brokenB && pipeOverlap(p, h[0], h[1], false)) { hitBottle(p, false); if (state !== 'play') return; }
        if (Math.abs(p.x - bird.x) < 17 + h[0]) {
          const c = pipeCenter(p);
          const clr = Math.min(bird.y - h[1] - (c - p.gap / 2), (c + p.gap / 2) - (bird.y + h[1]));
          if (clr < p.minClr) p.minClr = clr;
        }
      }
      if (!p.passed && p.x + BW / 2 < bird.x - h[0]) {
        p.passed = true;
        passed++; score++;
        Sfx.point();
        if (p.minClr < 7 && fx.inv <= 0 && fx.grace <= 0 && !p.bonus) {
          score++; nears++;
          popup('KIL PAYI! +1', bird.x, bird.y - 40, '#b9f6ca', 17);
          Sfx.near();
        }
        if (passed === 10 || passed === 25 || passed === 50 || passed === 100) {
          const names = { 10: 'BRONZ', 25: 'GÜMÜŞ', 50: 'ALTIN', 100: 'PLATİN' };
          showBanner(passed + ' ŞİŞE!', names[passed] + ' madalya yolda', '#ffe66d');
        }
      }
    }

    // nesneler
    for (const it of items) {
      it.t += g;
      if (it.free) {
        const k = Math.min(1, g * 9);
        it.x += (bird.x - it.x) * k;
        it.y += (bird.y - it.y) * k;
      } else {
        it.x -= spd * g;
        if (it.pipe) it.y = pipeCenter(it.pipe) + it.dy;
        if (it.type === 'coin' && fx.magnet > 0) {
          const dx = bird.x - it.x, dy = bird.y - it.y;
          if (dx * dx + dy * dy < 230 * 230 && it.x > bird.x - 60) it.free = true;
        }
      }
      const by = it.y + (it.free ? 0 : Math.sin(it.t * 3) * 3);
      const dx = bird.x - it.x, dy = bird.y - by;
      const rr2 = (it.type === 'coin' ? 12 : 18) + h[0] + 2;
      if (dx * dx + dy * dy * 0.7 < rr2 * rr2) collect(it);
    }
    items = items.filter((it) => !it.dead && it.x > -40);

    // sigara dumanı
    if (fx.inv > 0) {
      smokeT -= dt;
      if (smokeT <= 0) {
        smokeT = 0.04;
        const tip = cigTip();
        addPart({ k: 'smoke', x: tip[0], y: tip[1], vx: -spd * 0.55 + rand(-15, 15), vy: rand(-45, -15), life: 0, max: 0.9 + Math.random() * 0.4,
          s: 2.5 + Math.random() * 2, c: null, g: -30, rot: 0, vr: 0 });
      }
    }

    // gökyüzü evresi
    const phaseTarget = Math.floor(passed / 15);
    if (phaseV < phaseTarget) phaseV = Math.min(phaseTarget, phaseV + dt * 0.35);

    updateParts(g);
    updatePops(dt);
    if (banner) { banner.t += dt; if (banner.t > banner.max) banner = null; }
  }

  function updateParts(dt) {
    let j = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.k === 'smoke') { p.vx *= 1 - dt * 1.5; p.s += dt * 14; }
      if (p.k === 'puff') { p.s += dt * 20; }
      parts[j++] = p;
    }
    parts.length = j;
  }
  function updatePops(dt) {
    let j = 0;
    for (let i = 0; i < pops.length; i++) {
      const p = pops[i];
      p.life += dt; p.y -= 38 * dt;
      if (p.life < p.max) pops[j++] = p;
    }
    pops.length = j;
  }

  function autoFly() {
    let next = null;
    for (const p of pipes) if (p.x + BW / 2 > bird.x - 20) { next = p; break; }
    const target = next ? pipeCenter(next) + 18 : 300;
    if (bird.y > target && bird.vy > -40) { bird.vy = FLAP_V; bird.flapT = 1; }
  }

  function cigTip() {
    const s = bird.scale;
    const lx = (MOUTH[0] - 0.5) * HEAD_W + 20, ly = (MOUTH[1] - 0.5) * HEAD_H + 4;
    const c = Math.cos(bird.rot), sn = Math.sin(bird.rot);
    return [bird.x + (lx * c - ly * sn) * s, bird.y + (lx * sn + ly * c) * s];
  }

  // ───────────────────────── çizim ─────────────────────────
  function phaseInfo() {
    const i = Math.floor(phaseV) % 4, j = (i + 1) % 4, f = smooth(phaseV - Math.floor(phaseV));
    const w = [0, 0, 0, 0];
    w[i] += 1 - f; w[j] += f;
    return { a: PHASES[i], b: PHASES[j], f, w };
  }

  function drawBackground(ph) {
    const a = ph.a, b = ph.b, f = ph.f, w = ph.w;
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, mix(a.sky[0], b.sky[0], f));
    sky.addColorStop(0.55, mix(a.sky[1], b.sky[1], f));
    sky.addColorStop(1, mix(a.sky[2], b.sky[2], f));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);

    const night = w[2], dusk = w[1] + w[3] * 0.6;
    if (night > 0.01) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = night * (0.65 + 0.35 * Math.sin(realT * 2));
      ctx.fill(stars[0]);
      ctx.globalAlpha = night * (0.65 + 0.35 * Math.cos(realT * 1.6));
      ctx.fill(stars[1]);
      // ay
      ctx.globalAlpha = night;
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(W * 0.78, 150, 20, 0, TAU); ctx.fill();
      ctx.fillStyle = mix(a.sky[0], b.sky[0], f);
      ctx.beginPath(); ctx.arc(W * 0.78 + 9, 144, 18, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (w[0] > 0.01) {
      ctx.globalAlpha = w[0];
      ctx.drawImage(glowSun, W * 0.78 - 70, 100 - 70, 140, 140);
      ctx.globalAlpha = 1;
    }
    if (dusk > 0.01) {
      ctx.globalAlpha = Math.min(1, dusk);
      ctx.drawImage(glowSunset, W * 0.72 - 80, 400 - 80, 160, 160);
      ctx.globalAlpha = 1;
    }

    // bulutlar
    ctx.globalAlpha = 1 - night * 0.65;
    const cw = W + 260;
    for (let i = 0; i < 5; i++) {
      const spr = cloudSpr[i % 3], sw = [90, 120, 70][i % 3];
      const x = ((i * 157 + 40 - bgX * (0.08 + i * 0.015)) % cw + cw) % cw - 130;
      const y = 40 + ((i * 71) % 190);
      ctx.drawImage(spr, x, y, sw, sw * 0.5);
    }
    ctx.globalAlpha = 1;

    // martılar (gündüz)
    const dayish = w[0] + w[3] + w[1] * 0.5;
    if (dayish > 0.05) {
      ctx.strokeStyle = 'rgba(40,50,70,' + (0.55 * dayish).toFixed(3) + ')';
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const span = W + 120;
        const x = ((i * 190 + realT * (22 + i * 6)) % span) - 60;
        const y = 150 + i * 38 + Math.sin(realT * 0.8 + i) * 10;
        const wing = Math.sin(realT * 7 + i * 2) * 4;
        ctx.moveTo(x - 7, y - wing); ctx.quadraticCurveTo(x - 3, y - 4 - wing, x, y); ctx.quadraticCurveTo(x + 3, y - 4 - wing, x + 7, y - wing);
      }
      ctx.stroke();
    }

    // siluetler
    drawLayer(skyFar, mix(a.far, b.far, f), 0.18);
    drawLayer(skyMid, mix(a.mid, b.mid, f), 0.32);
    if (night > 0.01) {
      ctx.globalAlpha = night;
      ctx.fillStyle = '#ffd56b';
      const off = ((bgX * 0.32) % skyMid.w);
      for (let x = -off; x < W; x += skyMid.w) { ctx.translate(x, 0); ctx.fill(skyWindows); ctx.translate(-x, 0); }
      ctx.globalAlpha = 1;
    }
    drawLayer(skyBush, mix(a.bush, b.bush, f), 0.55);
  }

  function drawLayer(layer, color, k) {
    ctx.fillStyle = color;
    const off = (bgX * k) % layer.w;
    for (let x = -off; x < W; x += layer.w) {
      ctx.translate(x, 0); ctx.fill(layer.path); ctx.translate(-x, 0);
    }
  }

  function drawPipe(p) {
    const c = pipeCenter(p), top = c - p.gap / 2, bot = c + p.gap / 2;
    const x = p.x - BSW / 2;
    const pxs = scale;
    // alt şişe (kapak yukarıda)
    {
      const len = Math.min(BL, GROUND_Y - bot + 4);
      const spr = bottleSpr[p.vb];
      if (!p.brokenB) {
        ctx.drawImage(spr, 0, 0, spr.width, len * pxs, x, bot, BSW, len);
      } else {
        const cut = Math.max(70, len * 0.45);
        if (len > cut + 4) brokenPart(spr, x, bot + cut, len - cut, cut, false, p.vb);
      }
    }
    // üst şişe (ters)
    {
      const len = Math.min(BL, top + 4);
      const spr = bottleSpr[p.vt];
      if (!p.brokenT) {
        ctx.save(); ctx.translate(0, top); ctx.scale(1, -1);
        ctx.drawImage(spr, 0, 0, spr.width, len * pxs, x, 0, BSW, len);
        ctx.restore();
      } else {
        const cut = Math.max(70, len * 0.45);
        if (len > cut + 4) {
          ctx.save(); ctx.translate(0, top); ctx.scale(1, -1);
          brokenPart(spr, x, cut, len - cut, cut, true, p.vt);
          ctx.restore();
        }
      }
    }
  }

  function brokenPart(spr, x, y, len, srcOff, flipped, vi) {
    // kırık uç: zikzak kırpma
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + len + 2);
    ctx.lineTo(x, y + 10);
    const teeth = [12, 2, 15, 5, 18, 0, 13, 6, 16];
    for (let i = 0; i < teeth.length; i++) ctx.lineTo(x + 4 + i * (BW / (teeth.length - 1)), y + teeth[i]);
    ctx.lineTo(x + BSW, y + 10);
    ctx.lineTo(x + BSW, y + len + 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(spr, 0, srcOff * scale, spr.width, len * scale, x, y, BSW, len);
    ctx.restore();
    ctx.strokeStyle = VARIANTS[vi].outline; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < teeth.length; i++) ctx.lineTo(x + 4 + i * (BW / (teeth.length - 1)), y + teeth[i]);
    ctx.stroke();
  }

  function drawItems() {
    for (const it of items) {
      const y = it.y + (it.free ? 0 : Math.sin(it.t * 3) * 3);
      if (it.type === 'coin') {
        const sx = Math.abs(Math.cos(it.t * 3.2)) * 0.85 + 0.15;
        ctx.drawImage(coinSpr, it.x - 12 * sx, y - 12, 24 * sx, 24);
      } else {
        const pulse = 1 + Math.sin(it.t * 5) * 0.05;
        ctx.globalAlpha = 0.5 + Math.sin(it.t * 5) * 0.15;
        ctx.drawImage(glowGold, it.x - 30, y - 30, 60, 60);
        ctx.globalAlpha = 1;
        ctx.drawImage(itemSpr[it.type], it.x - 21 * pulse, y - 21 * pulse, 42 * pulse, 42 * pulse);
      }
    }
  }

  function drawParts(front) {
    for (const p of parts) {
      const t = p.life / p.max, a = 1 - t;
      switch (p.k) {
        case 'smoke':
        case 'puff':
          if (front) continue;
          ctx.globalAlpha = (p.k === 'smoke' ? 0.55 : 0.5) * a;
          ctx.drawImage(puffSpr, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
          break;
        case 'shard':
          if (!front) continue;
          ctx.globalAlpha = Math.min(1, a * 1.5);
          ctx.fillStyle = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.moveTo(-p.s, -p.s * 0.4); ctx.lineTo(p.s * 0.8, -p.s * 0.6); ctx.lineTo(p.s * 0.2, p.s * 0.7); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-p.s * 0.4, -p.s * 0.3, p.s * 0.6, p.s * 0.15);
          ctx.restore();
          break;
        case 'foam':
        case 'spark':
          if (!front) continue;
          ctx.globalAlpha = a;
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (p.k === 'spark' ? a : 1), 0, TAU); ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBird() {
    if (!headSpr) return;
    const s = bird.scale;
    const blink = (fx.grace > 0 && Math.floor(realT * 14) % 2 === 0) ||
      (fx.inv > 0 && fx.inv < 2 && Math.floor(realT * 10) % 2 === 0);

    if (fx.inv > 0) {
      const pr = 1 + Math.sin(realT * 10) * 0.08;
      ctx.globalAlpha = fx.inv < 2 ? 0.5 : 0.85;
      ctx.drawImage(glowGold, bird.x - 52 * pr * s, bird.y - 52 * pr * s, 104 * pr * s, 104 * pr * s);
      ctx.globalAlpha = 1;
    }
    if (fx.shield > 0) {
      ctx.strokeStyle = 'rgba(100,181,246,' + (0.45 + Math.sin(realT * 6) * 0.15).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(bird.x, bird.y, 30 * s, 38 * s, 0, 0, TAU); ctx.stroke();
    }

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);
    const st = 1 + bird.flapT * 0.1;
    ctx.scale(s / Math.sqrt(st), s * st);
    if (blink) ctx.globalAlpha = 0.35;
    const pw = HEAD_W + headPad * 2, ph = HEAD_H + headPad * 2;
    ctx.drawImage(headSpr, -pw / 2, -ph / 2, pw, ph);

    const mx = (MOUTH[0] - 0.5) * HEAD_W, my = (MOUTH[1] - 0.5) * HEAD_H;
    if (fx.mini > 0) {
      // ayran bıyığı
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const bx = (0.58 - 0.5) * HEAD_W, by = (0.67 - 0.5) * HEAD_H, ex = (0.92 - 0.5) * HEAD_W;
      for (let i = 0; i <= 5; i++) {
        const x = lerp(bx, ex, i / 5);
        ctx.beginPath(); ctx.arc(x, by + Math.sin(i * 1.7) * 0.6, 2.4 - Math.abs(i - 2.5) * 0.25, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(lerp(bx, ex, 0.3), by + 3.2, 1.2, 0, TAU); ctx.fill();
    }
    if (fx.inv > 0) {
      // ağızda sigara
      ctx.save();
      ctx.translate(mx - 1, my);
      ctx.rotate(0.22);
      ctx.fillStyle = '#e39a3b'; ctx.fillRect(0, -1.6, 6, 3.2);
      ctx.fillStyle = '#f7f7f2'; ctx.fillRect(6, -1.6, 13, 3.2);
      ctx.fillStyle = '#9e9e9e'; ctx.fillRect(18, -1.6, 1.6, 3.2);
      ctx.strokeStyle = 'rgba(60,40,30,0.7)'; ctx.lineWidth = 0.6; ctx.strokeRect(0, -1.6, 19.6, 3.2);
      const fl = 0.8 + Math.sin(realT * 25) * 0.2;
      ctx.drawImage(glowEmber, 20 - 6 * fl, -6 * fl, 12 * fl, 12 * fl);
      ctx.fillStyle = '#ff5722'; ctx.fillRect(19.4, -1.6, 1.5, 3.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // nazar boncukları yörüngede
    if (fx.shield > 0) {
      for (let i = 0; i < fx.shield; i++) {
        const a = realT * 2.4 + i * Math.PI;
        const ox = Math.cos(a) * 34 * s, oy = Math.sin(a) * 40 * s;
        ctx.save(); ctx.translate(bird.x + ox, bird.y + oy); ctx.scale(0.42, 0.42);
        ctx.drawImage(itemSpr.nazar, -21, -21, 42, 42);
        ctx.restore();
      }
    }

    // ölünce baş dönmesi yıldızları
    if (state === 'dying' || state === 'over') {
      if (bird.onGround) {
        ctx.fillStyle = '#ffe66d';
        for (let i = 0; i < 3; i++) {
          const a = realT * 4 + i * TAU / 3;
          drawStar(bird.x + Math.cos(a) * 22, bird.y - 30 + Math.sin(a) * 6, 4.5);
        }
      }
    }
  }

  function drawStar(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  }

  const FONT = 'system-ui, Roboto, "Segoe UI", Arial, sans-serif';
  function outlinedText(text, x, y, size, fill, stroke, lw) {
    ctx.font = '900 ' + size + 'px ' + FONT;
    ctx.lineWidth = lw || size * 0.16;
    ctx.strokeStyle = stroke || '#3b2105';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function drawHUD() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (state === 'play' || state === 'dying') {
      outlinedText(String(score), W / 2, 66, 52, '#ffffff', '#3b2105', 8);
    }
    // güç zamanlayıcıları
    if (state === 'play') {
      const list = [];
      if (fx.inv > 0) list.push(['sigara', fx.inv / 10, fx.inv]);
      if (fx.slow > 0) list.push(['cay', fx.slow / 6, fx.slow]);
      if (fx.magnet > 0) list.push(['miknatis', fx.magnet / 8, fx.magnet]);
      if (fx.mini > 0) list.push(['ayran', fx.mini / 7, fx.mini]);
      if (fx.shield > 0) list.push(['nazar', 1, -fx.shield]);
      let x = 24;
      const y = 118;
      for (const e of list) {
        const col = ITEM_INFO[e[0]].color;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
        ctx.drawImage(itemSpr[e[0]], x - 13, y - 13, 26, 26);
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(e[1], 0, 1)); ctx.stroke();
        const label = e[2] < 0 ? 'x' + (-e[2]) : Math.ceil(e[2]) + '';
        outlinedText(label, x + 11, y + 12, 11, '#fff', '#222', 3);
        x += 38;
      }
    }
    // açılır yazılar
    for (const p of pops) {
      const t = p.life / p.max;
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const sz = p.size * (t < 0.15 ? 0.6 + t / 0.15 * 0.4 : 1);
      outlinedText(p.text, p.x, p.y, sz, p.color, '#2b1503', sz * 0.2);
    }
    ctx.globalAlpha = 1;
    // afiş
    if (banner) {
      const t = banner.t, m = banner.max;
      const a = t < 0.2 ? t / 0.2 : t > m - 0.35 ? (m - t) / 0.35 : 1;
      const sc = t < 0.2 ? 0.6 + 0.4 * smooth(t / 0.2) + Math.sin(t / 0.2 * Math.PI) * 0.12 : 1;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(W / 2, 190); ctx.scale(sc, sc);
      outlinedText(banner.title, 0, 0, Math.min(34, W / banner.title.length * 1.55), banner.color, '#2b1503', 7);
      outlinedText(banner.sub, 0, 32, 16, '#ffffff', '#2b1503', 4);
      ctx.restore();
    }
  }

  function render() {
    const ph = phaseInfo();
    let sx = 0, sy = 0;
    if (shakeT > 0) { sx = rand(-shakeMag, shakeMag); sy = rand(-shakeMag, shakeMag); }
    ctx.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);
    ctx.imageSmoothingEnabled = true;

    drawBackground(ph);
    for (const p of pipes) drawPipe(p);

    // zemin
    const gx = -(groundX % 48);
    ctx.drawImage(groundSpr, gx, GROUND_Y, groundW, GROUND_H);
    ctx.fillStyle = '#5e5448';
    ctx.fillRect(-10, LH, W + 20, 20);

    // gece/akşam tonu
    const night = ph.w[2], dusk = ph.w[1];
    if (night > 0.01) { ctx.fillStyle = 'rgba(10,16,48,' + (night * 0.3).toFixed(3) + ')'; ctx.fillRect(-10, -10, W + 20, LH + 20); }
    if (dusk > 0.01) { ctx.fillStyle = 'rgba(255,110,60,' + (dusk * 0.08).toFixed(3) + ')'; ctx.fillRect(-10, -10, W + 20, LH + 20); }
    // çay: sıcak ton
    if (timeScale < 0.98) {
      ctx.fillStyle = 'rgba(255,170,90,' + ((1 - timeScale) * 0.22).toFixed(3) + ')';
      ctx.fillRect(-10, -10, W + 20, LH + 20);
    }

    drawItems();
    drawParts(false);
    if (state !== 'loading') drawBird();
    drawParts(true);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawHUD();
    if (flashA > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + flashA.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, LH);
    }
  }

  // ───────────────────────── döngü ─────────────────────────
  let lastTs = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    let dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1;
    if (paused) {
      if (needRender) { render(); needRender = false; }
      return;
    }
    if (dt > 0) {
      const steps = Math.ceil(dt / (1 / 120));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) update(h);
      if (shakeT > 0) shakeT -= dt; else shakeMag = 0;
      if (flashA > 0) flashA = Math.max(0, flashA - dt * 3);
    }
    render();
  }

  // ───────────────────────── ekranlar ─────────────────────────
  const screens = ['menu', 'help', 'ready', 'pause', 'over'];
  function show(id) {
    screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
  }

  function goMenu() {
    state = 'menu';
    paused = false;
    resetRun();
    bird.x = W / 2;
    $('menuBest').textContent = best;
    $('pauseBtn').classList.add('hidden');
    show('menu');
  }

  function startReady() {
    Sfx.init();
    resetRun();
    state = 'ready';
    paused = false;
    show('ready');
    $('pauseBtn').classList.add('hidden');
  }

  function startPlay() {
    state = 'play';
    show(null);
    $('pauseBtn').classList.remove('hidden');
    flap();
  }

  let overShownAt = 0;
  function gameOver() {
    if (state === 'over') return;
    state = 'over';
    bird.onGroundT = 0;
    const isRecord = score > best;
    if (isRecord) { best = score; store.set('fm_best', best); }
    $('ovScore').textContent = score;
    $('ovBest').textContent = best;
    $('newRec').classList.toggle('hidden', !isRecord);
    const medal = $('medal'), mn = $('medalName');
    medal.className = 'medal';
    let m = null;
    if (score >= 100) m = ['plat', 'PLATİN', '★'];
    else if (score >= 50) m = ['gold', 'ALTIN', '★'];
    else if (score >= 25) m = ['silver', 'GÜMÜŞ', '★'];
    else if (score >= 10) m = ['bronze', 'BRONZ', '★'];
    if (m) { medal.classList.add(m[0]); medal.textContent = m[2]; mn.textContent = m[1]; }
    else { medal.textContent = '?'; mn.textContent = (10 - score) + ' PUAN KALDI'; }
    $('ovStats').innerHTML =
      '<span><b>' + passed + '</b>şişe</span><span><b>' + smashed + '</b>kırılan</span><span><b>' + coins + '</b>lira</span><span><b>' + nears + '</b>kıl payı</span>';
    overShownAt = performance.now();
    show('over');
    if (isRecord && score > 0) Sfx.record();
  }

  function pauseGame() {
    if (state !== 'play' || paused) return;
    paused = true;
    needRender = true;
    show('pause');
    $('pauseBtn').classList.add('hidden');
    Sfx.suspend();
  }
  function resumeGame() {
    if (!paused) return;
    paused = false;
    lastTs = 0;
    show(null);
    $('pauseBtn').classList.remove('hidden');
    Sfx.resume();
  }

  // ───────────────────────── girdi ─────────────────────────
  function onTap() {
    Sfx.init();
    if (state === 'ready') startPlay();
    else if (state === 'play' && !paused) flap();
  }
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button, .panel')) return;
    e.preventDefault();
    onTap();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (state === 'menu') startReady();
      else if (state === 'over' && performance.now() - overShownAt > 600) startReady();
      else onTap();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (paused) resumeGame(); else pauseGame();
    }
  });

  function bind(id, fn) {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); Sfx.init(); Sfx.click(); fn(); });
  }
  bind('playBtn', startReady);
  bind('helpBtn', () => show('help'));
  bind('helpClose', () => show('menu'));
  bind('soundBtn', () => { Sfx.toggle(); updateSoundBtn(); });
  bind('pauseBtn', pauseGame);
  bind('resumeBtn', resumeGame);
  bind('pauseMenuBtn', goMenu);
  bind('againBtn', () => { if (performance.now() - overShownAt > 450) startReady(); });
  bind('overMenuBtn', () => { if (performance.now() - overShownAt > 450) goMenu(); });
  function updateSoundBtn() { $('soundBtn').textContent = Sfx.muted ? 'SES: KAPALI' : 'SES: AÇIK'; }
  updateSoundBtn();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseGame(); Sfx.suspend(); }
  });
  // Android köprüsü: geri tuşu ve uygulama arka plana alınınca
  window.__back = function () {
    if (state === 'play') { if (paused) { resumeGame(); } else pauseGame(); return 'ok'; }
    if (!$('help').classList.contains('hidden')) { show('menu'); return 'ok'; }
    if (state === 'ready' || state === 'over' || state === 'dying') { goMenu(); return 'ok'; }
    return 'exit';
  };
  window.__onAndroidPause = function () { pauseGame(); Sfx.suspend(); };

  // yardım listesi
  function fillHelp() {
    const ul = $('helpList');
    ul.innerHTML = '';
    ['sigara', 'nazar', 'cay', 'miknatis', 'ayran', 'kebap', 'coin'].forEach((k) => {
      const li = document.createElement('li');
      const cv = document.createElement('canvas');
      const d = Math.min(window.devicePixelRatio || 1, 3);
      cv.width = cv.height = Math.round(40 * d);
      const g = cv.getContext('2d');
      g.scale(d, d);
      g.translate(20, 20);
      if (k === 'coin') { g.scale(1.3, 1.3); drawIcon(g, 'coin'); }
      else { g.drawImage(itemSpr[k], -20, -20, 40, 40); }
      const tx = document.createElement('div');
      tx.innerHTML = '<b>' + ITEM_INFO[k].name + '</b><span>' + ITEM_INFO[k].desc + '</span>';
      li.appendChild(cv); li.appendChild(tx);
      ul.appendChild(li);
    });
    const li = document.createElement('li');
    li.innerHTML = '<div><b>Kıl payı</b><span>Şişeye çok yakın geçersen +1 bonus. Kırdığın her şişe de +1!</span></div>';
    ul.appendChild(li);
  }

  // test ve hata ayıklama için küçük bir kapı
  window.__fm = {
    get state() { return state; }, get score() { return score; }, get passed() { return passed; },
    get fx() { return fx; }, get bird() { return bird; }, get pipes() { return pipes; }, get items() { return items; },
    set autopilot(v) { autopilot = !!v; }, give(type) { collect({ type, x: bird.x, y: bird.y }); },
    setPassed(n) { passed = n; phaseV = Math.floor(n / 15); },
  };

  // ───────────────────────── başlat ─────────────────────────
  window.addEventListener('resize', resize);
  function boot() {
    resize();
    fillHelp();
    goMenu();
    requestAnimationFrame(frame);
  }
  headImg.onload = boot;
  headImg.onerror = boot;
  headImg.src = 'head.png';
})();
