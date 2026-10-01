(function () {
  'use strict';

  const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame, performance } = GameEngine.clock;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayMessage = document.getElementById('overlay-message');
  const overlayButton = document.getElementById('overlay-button');
  const highscores = document.getElementById('highscores');

  const Core = window.BattleCityCore;
  const Sound = window.BattleCityAudio;
  const { UP, RIGHT, DOWN, LEFT, STATS, TIMINGS, FIELD, ENEMY_TYPES } = Core;
  const S = 2;
  const W = 512;
  const H = 448;
  const FX = 12;
  const FY = 16;
  const FS = FIELD * S;
  const PX = 440;
  const PW = 60;
  const STEP_MS = 1000 / 60;
  const SCORE_KEY = 'battlecity_highscores';
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

  const C = {
    bg0: '#181c24', bg1: '#0c0e12', field: '#11151b', grid: 'rgba(255,255,255,0.028)',
    panel: '#161b22', line: 'rgba(255,255,255,0.09)', label: '#7f8996', text: '#eef2f6',
    gold: '#f2c94c', red: '#ff5a4f', cyan: '54,214,255',
    bricks: ['#b5532a', '#ad4c25', '#bc5a2f'], brickHi: 'rgba(255,190,150,0.35)', brickLo: 'rgba(60,20,8,0.45)', mortar: '#2b1810'
  };

  const STYLE = {
    player: { w: 20, turret: 7.5, barrel: 17, bw: 4, hull: ['#ffe18a', '#c9921a'], top: ['#fff2bf', '#d9a628'], gun: '#76570f', track: '#3a3226' },
    basic: { w: 20, turret: 6.5, barrel: 15, bw: 4, hull: ['#e2e7ec', '#7d8792'], top: ['#f6f8fa', '#9aa4af'], gun: '#4a525b', track: '#262a30' },
    fast: { w: 16, turret: 5.5, barrel: 18, bw: 3, hull: ['#edf1f5', '#8a949f'], top: ['#ffffff', '#a8b1bb'], gun: '#4a525b', track: '#262a30' },
    power: { w: 20, turret: 7.5, barrel: 16, bw: 3, twin: true, hull: ['#d1d7de', '#6c7580'], top: ['#e8ecf0', '#89929c'], gun: '#3a4148', track: '#22262b' },
    armor: { w: 24, turret: 8.5, barrel: 15, bw: 5, plates: true, hull: ['#d1d7de', '#6c7580'], top: ['#e8ecf0', '#89929c'], gun: '#3a4148', track: '#1d2125' }
  };
  const ARMOR_COLORS = {
    4: [['#93e6a2', '#3c8e4c'], ['#c0f3c9', '#4fa760']],
    3: [['#ffd96e', '#b7851a'], ['#ffeab0', '#cf9c2a']],
    1: [['#c6cdd5', '#66707a'], ['#dfe4ea', '#7f8993']]
  };
  const BONUS_COLORS = [['#ff9d88', '#c2361f'], ['#ffc5b8', '#d64b33']];
  const POWERUP_COLORS = { star: '255,211,77', grenade: '255,122,92', helmet: '95,184,255', shovel: '214,165,106', clock: '205,214,224', tank: '242,201,76' };
  const TYPE_NAMES = { basic: 'Basic', fast: 'Fast', power: 'Power', armor: 'Armor' };
  const BANNERS = { star: ['STAR POWER', '255,211,77'], grenade: ['GRENADE!', '255,122,92'], helmet: ['SHIELD UP', '95,184,255'], shovel: ['FORTRESS', '214,165,106'], clock: ['FREEZE', '160,220,255'], tank: ['1-UP', '242,201,76'] };
  const POPUPS = { 100: [11, '#ffffff'], 200: [12, '#d9f2ff'], 300: [13, '#ffe08a'], 400: [14, '#ffb066'], 500: [15, '#7fe0ff'] };

  let game = null;
  let running = false;
  let animationId = null;
  let lastTime = 0;
  let accumulator = 0;
  let endedAt = 0;
  let lastScore = -1;
  let tallyShown = null;
  let tallyHiScore = 0;
  let gameOverReason = '';
  let particles = [];
  let decals = [];
  let shake = 0;
  let shakeAmp = 0;
  let terrainDirty = true;
  let terrainScale = 0;
  let terrainStage = -1;
  const terrainCanvas = document.createElement('canvas');
  const treesCanvas = document.createElement('canvas');
  let dirStack = [];
  let dirLatch = -1;
  let fireLatch = false;
  const fireSources = new Set();

  GameEngine.sharpCanvas(canvas, { redraw: () => { terrainDirty = true; render(1); } });

  function ensureAudio() {
    return GameEngine.audio();
  }

  function sfx(name) {
    Sound.sfx(name);
  }

  function safeLoadScores() {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveScore(value) {
    const scores = safeLoadScores();
    scores.push(value);
    scores.sort((a, b) => b - a);
    const top = scores.slice(0, 5);
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(top)); } catch (e) { }
    return top;
  }

  function renderScores(scores) {
    highscores.innerHTML = '';
    scores.forEach((value, index) => {
      const item = document.createElement('li');
      item.textContent = (index + 1) + '. ' + value.toLocaleString();
      highscores.appendChild(item);
    });
    highscores.classList.toggle('hidden', scores.length === 0);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function circle(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
  }

  function text(str, x, y, size, color, opts) {
    const o = opts || {};
    ctx.font = (o.weight || 700) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.spacing || 0) + 'px';
    if (o.outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.outline;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function drawBrick(c, bx, by, span) {
    const x = FX + bx * 8, y = FY + by * 8, w = span * 8;
    c.fillStyle = C.mortar;
    c.fillRect(x, y, w, 8);
    c.fillStyle = C.bricks[(bx * 7 + by * 13) % 3];
    c.fillRect(x + 0.75, y + 0.75, w - 1.5, 6.5);
    c.fillStyle = C.brickHi;
    c.fillRect(x + 0.75, y + 0.75, w - 1.5, 1.25);
    c.fillStyle = C.brickLo;
    c.fillRect(x + 0.75, y + 6, w - 1.5, 1.25);
  }

  function drawBrickRow(c, bits, by) {
    const row = by * 52;
    let bx = 0;
    if (by % 2 === 1) {
      if (bits[row]) drawBrick(c, 0, by, 1);
      bx = 1;
    }
    for (; bx < 52; bx += 2) {
      const a = bits[row + bx];
      const b = bx + 1 < 52 && bits[row + bx + 1];
      if (a && b) drawBrick(c, bx, by, 2);
      else {
        if (a) drawBrick(c, bx, by, 1);
        if (b) drawBrick(c, bx + 1, by, 1);
      }
    }
  }

  function drawSteel(c, x, y) {
    const g = c.createLinearGradient(x, y, x + 16, y + 16);
    g.addColorStop(0, '#e8edf2');
    g.addColorStop(1, '#838d98');
    c.fillStyle = '#3e454d';
    c.fillRect(x, y, 16, 16);
    c.fillStyle = g;
    c.fillRect(x + 1, y + 1, 14, 14);
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(x + 1, y + 1, 14, 1);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(x + 1, y + 14, 14, 1);
    c.fillStyle = '#59616a';
    for (const [rx, ry] of [[4, 4], [12, 4], [4, 12], [12, 12]]) { circle(c, x + rx, y + ry, 1.1); c.fill(); }
  }

  function drawIce(c, x, y, sheet) {
    c.fillStyle = sheet;
    c.fillRect(x, y, 16, 16);
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + 3, y + 11); c.lineTo(x + 9, y + 5);
    c.moveTo(x + 8, y + 14); c.lineTo(x + 13, y + 9);
    c.stroke();
  }

  function rebuildTerrain(scale) {
    const s = game.state;
    for (const c of [terrainCanvas, treesCanvas]) {
      c.width = Math.round(W * scale);
      c.height = Math.round(H * scale);
    }
    const t = terrainCanvas.getContext('2d');
    t.setTransform(scale, 0, 0, scale, 0, 0);
    for (let by = 0; by < 52; by++) drawBrickRow(t, s.bricks, by);
    const sheet = t.createLinearGradient(FX, FY, FX + FS, FY + FS);
    sheet.addColorStop(0, '#e6f3fc');
    sheet.addColorStop(0.5, '#c4dcec');
    sheet.addColorStop(1, '#a3c3d9');
    for (let cy = 0; cy < 26; cy++) {
      for (let cx = 0; cx < 26; cx++) {
        const k = cy * 26 + cx;
        if (s.steel[k]) drawSteel(t, FX + cx * 16, FY + cy * 16);
        else if (s.ice[k]) drawIce(t, FX + cx * 16, FY + cy * 16, sheet);
      }
    }
    const tr = treesCanvas.getContext('2d');
    tr.setTransform(scale, 0, 0, scale, 0, 0);
    tr.save();
    roundRect(tr, FX, FY, FS, FS, 6);
    tr.clip();
    const trees = [];
    for (let k = 0; k < 26 * 26; k++) if (s.trees[k]) trees.push([FX + (k % 26) * 16, FY + Math.floor(k / 26) * 16]);
    const layers = [
      ['#1d5427', [[8, 8, 9.5]]],
      ['#2c7a35', [[6, 7, 6], [11, 10, 5.5]]],
      ['#43a04a', [[5, 5, 3], [11, 8, 2.6], [8, 12, 2.2]]],
      ['rgba(255,255,255,0.13)', [[4, 4, 1.4], [10, 7, 1.2]]]
    ];
    for (const [color, blobs] of layers) {
      tr.fillStyle = color;
      tr.beginPath();
      for (const [x, y] of trees) for (const [dx, dy, r] of blobs) { tr.moveTo(x + dx + r, y + dy); tr.arc(x + dx, y + dy, r, 0, Math.PI * 2); }
      tr.fill();
    }
    tr.restore();
    terrainScale = scale;
    terrainStage = s.stage;
    terrainDirty = false;
  }

  function drawWater(s, frame) {
    const blocks = [];
    for (let k = 0; k < 26 * 26; k++) if (s.water[k]) blocks.push(k);
    if (!blocks.length) return;
    const g = ctx.createLinearGradient(0, FY, 0, FY + FS);
    g.addColorStop(0, '#2370cf');
    g.addColorStop(1, '#14478f');
    ctx.fillStyle = g;
    for (const k of blocks) ctx.fillRect(FX + (k % 26) * 16, FY + Math.floor(k / 26) * 16, 16, 16);
    ctx.strokeStyle = 'rgba(185,228,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const k of blocks) {
      const cx = k % 26, cy = Math.floor(k / 26);
      const x = FX + cx * 16, y = FY + cy * 16;
      const t = frame * 0.05 + cx * 0.7 + cy * 1.3;
      const y1 = y + 5 + Math.sin(t) * 1.6;
      const y2 = y + 11 + Math.cos(t * 1.1) * 1.6;
      ctx.moveTo(x + 2, y1); ctx.quadraticCurveTo(x + 6, y1 - 2, x + 10, y1);
      ctx.moveTo(x + 6, y2); ctx.quadraticCurveTo(x + 10, y2 - 2, x + 14, y2);
    }
    ctx.stroke();
  }

  function drawEagle(alive, frame) {
    const x = FX + Core.EAGLE.x * S, y = FY + Core.EAGLE.y * S;
    const g = ctx.createLinearGradient(x, y, x, y + 32);
    g.addColorStop(0, '#2f353e');
    g.addColorStop(1, '#191c22');
    if (alive) {
      const glow = ctx.createRadialGradient(x + 16, y + 16, 4, x + 16, y + 16, 22);
      glow.addColorStop(0, 'rgba(242,201,76,' + (0.18 + 0.08 * Math.sin(frame * 0.08)) + ')');
      glow.addColorStop(1, 'rgba(242,201,76,0)');
      ctx.fillStyle = glow;
      circle(ctx, x + 16, y + 16, 22);
      ctx.fill();
    }
    roundRect(ctx, x + 2, y + 2, 28, 28, 6);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = alive ? '#e7c45a' : '#4e555f';
    ctx.stroke();
    ctx.beginPath();
    const pts = [[16, 7], [19, 11], [27, 9], [22, 16], [25, 18], [18, 19], [19, 25], [16, 23], [13, 25], [14, 19], [7, 18], [10, 16], [5, 9], [13, 11]];
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py)));
    ctx.closePath();
    ctx.fillStyle = alive ? '#f2c94c' : '#5b626c';
    ctx.fill();
    if (!alive) {
      ctx.strokeStyle = '#0c0e12';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 9, y + 6); ctx.lineTo(x + 15, y + 15); ctx.lineTo(x + 12, y + 22);
      ctx.moveTo(x + 15, y + 15); ctx.lineTo(x + 24, y + 19);
      ctx.stroke();
    }
  }

  function tankLook(t, frame) {
    const st = STYLE[t.kind === 'player' ? 'player' : t.type];
    let hull = st.hull, top = st.top;
    if (t.kind !== 'player') {
      if (t.type === 'armor' && ARMOR_COLORS[t.hp]) [hull, top] = ARMOR_COLORS[t.hp];
      if (t.bonus && (frame >> 3) % 2 === 0) [hull, top] = BONUS_COLORS;
    }
    return { st, hull, top };
  }

  function drawTank(t, x, y, frame) {
    const { st, hull, top } = tankLook(t, frame);
    const half = st.w / 2;
    const trackW = st.plates ? 8 : st.w <= 16 ? 6 : 7;
    const phase = Math.floor(x + y) % 4;
    ctx.save();
    ctx.translate(x + 16, y + 16);
    if (t.kind === 'player') {
      const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 22);
      glow.addColorStop(0, 'rgba(242,201,76,0.16)');
      glow.addColorStop(1, 'rgba(242,201,76,0)');
      ctx.fillStyle = glow;
      circle(ctx, 0, 0, 22);
      ctx.fill();
    }
    if (t.bonus) {
      ctx.strokeStyle = 'rgba(255,110,90,' + (0.35 + 0.3 * Math.sin(frame * 0.3)) + ')';
      ctx.lineWidth = 2;
      circle(ctx, 0, 0, 18);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 15, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(t.dir * Math.PI / 2);
    for (const side of [-1, 1]) {
      const tx = side < 0 ? -15 : 15 - trackW;
      ctx.fillStyle = st.track;
      roundRect(ctx, tx, -15, trackW, 30, 2.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      for (let yy = -14 + phase; yy < 14; yy += 4) ctx.fillRect(tx + 1, yy, trackW - 2, 1.5);
    }
    let g = ctx.createLinearGradient(-half, -12, half, 13);
    g.addColorStop(0, hull[0]);
    g.addColorStop(1, hull[1]);
    ctx.fillStyle = g;
    roundRect(ctx, -half, -12, st.w, 25, 4);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    if (st.plates) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(-half + 2, -9, st.w - 4, 2);
      ctx.fillRect(-half + 2, 8, st.w - 4, 2);
    }
    for (const bx of st.twin ? [-3, 3] : [0]) {
      ctx.fillStyle = st.gun;
      ctx.fillRect(bx - st.bw / 2, -st.barrel, st.bw, st.barrel);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(bx - st.bw / 2, -st.barrel + 3, Math.max(1, st.bw / 3), st.barrel - 6);
      ctx.fillStyle = st.gun;
      ctx.fillRect(bx - st.bw / 2 - 0.75, -st.barrel, st.bw + 1.5, 3);
    }
    g = ctx.createRadialGradient(-2.5, -1, 1, 0, 2, st.turret + 2);
    g.addColorStop(0, top[0]);
    g.addColorStop(1, top[1]);
    ctx.fillStyle = g;
    circle(ctx, 0, 2, st.turret);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    circle(ctx, 0, 3.5, st.turret * 0.35);
    ctx.fill();
    if (t._flash > 0) {
      ctx.globalAlpha = Math.min(1, t._flash / 8) * 0.8;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, -half, -12, st.w, 25, 4);
      ctx.fill();
      circle(ctx, 0, 2, st.turret);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawSpawn(t, x, y, frame) {
    const cx = x + 16, cy = y + 16;
    const p = 1 - t.spawning / TIMINGS.spawn;
    const rgb = t.kind === 'player' ? C.cyan : '255,122,92';
    const r = 7 + 9 * Math.abs(Math.sin(p * Math.PI * 3));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 7);
    g.addColorStop(0, 'rgba(' + rgb + ',0.95)');
    g.addColorStop(0.4, 'rgba(' + rgb + ',0.35)');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, r + 7);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(frame * 0.12);
    ctx.strokeStyle = 'rgba(' + rgb + ',0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    circle(ctx, 0, 0, 13);
    ctx.stroke();
    ctx.restore();
  }

  function drawShield(cx, cy, frame, remaining, flash) {
    if (remaining < 90 && !flash && (frame >> 2) % 2 === 0) return;
    const pulse = Math.min(1.6, 0.75 + 0.25 * Math.sin(frame * 0.25) + flash / 10);
    const g = ctx.createRadialGradient(cx, cy, 9, cx, cy, 22);
    g.addColorStop(0, 'rgba(' + C.cyan + ',0)');
    g.addColorStop(0.8, 'rgba(' + C.cyan + ',' + 0.16 * pulse + ')');
    g.addColorStop(1, 'rgba(150,236,255,' + 0.45 * pulse + ')');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, 22);
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = 'rgba(175,240,255,' + 0.8 * pulse + ')';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -frame * 0.6;
    circle(ctx, cx, cy, 21.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawBullet(b, x, y) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
    g.addColorStop(0, b.player ? 'rgba(255,238,170,0.9)' : 'rgba(255,170,150,0.9)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    circle(ctx, x, y, 7);
    ctx.fill();
    const vertical = b.dir === UP || b.dir === DOWN;
    ctx.fillStyle = '#fffaf0';
    roundRect(ctx, x - (vertical ? 1.75 : 3), y - (vertical ? 3 : 1.75), vertical ? 3.5 : 6, vertical ? 6 : 3.5, 1.5);
    ctx.fill();
  }

  function starPath(c, r, inner) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? inner : r;
      if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  }

  function drawIcon(type, cx, cy, k) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    if (type === 'star') {
      starPath(ctx, 9.5, 4.2);
      ctx.fillStyle = '#ffd34d';
      ctx.fill();
      ctx.strokeStyle = '#b98a12';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (type === 'grenade') {
      ctx.fillStyle = '#5c6d48';
      ctx.beginPath();
      ctx.ellipse(0, 2, 6.5, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, 2); ctx.lineTo(6, 2); ctx.moveTo(0, -5); ctx.lineTo(0, 9);
      ctx.stroke();
      ctx.fillStyle = '#aab3bd';
      ctx.fillRect(-2.5, -8, 5, 3);
      ctx.strokeStyle = '#aab3bd';
      ctx.lineWidth = 1.4;
      circle(ctx, 4, -8, 2.2);
      ctx.stroke();
    } else if (type === 'helmet') {
      ctx.fillStyle = '#5fb8ff';
      ctx.beginPath();
      ctx.arc(0, 3, 8.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3d8fd6';
      ctx.fillRect(-10, 3, 20, 2.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 3, 5.5, Math.PI * 1.15, Math.PI * 1.5);
      ctx.stroke();
    } else if (type === 'shovel') {
      ctx.strokeStyle = '#b07a3e';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(7, -9); ctx.lineTo(-1, 1);
      ctx.moveTo(4, -10); ctx.lineTo(9, -6);
      ctx.stroke();
      ctx.fillStyle = '#c9d0d8';
      ctx.beginPath();
      ctx.moveTo(-1, 1); ctx.lineTo(-8, 3); ctx.lineTo(-9, 8); ctx.lineTo(-4, 9); ctx.lineTo(1, 4);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'clock') {
      ctx.fillStyle = '#f3f6f9';
      circle(ctx, 0, 1, 8.5);
      ctx.fill();
      ctx.strokeStyle = '#8c96a1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = '#2a3038';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 1); ctx.lineTo(0, -4.5); ctx.moveTo(0, 1); ctx.lineTo(4, 2);
      ctx.stroke();
      ctx.fillStyle = '#8c96a1';
      ctx.fillRect(-1.5, -10, 3, 2);
    } else if (type === 'tank') {
      ctx.fillStyle = '#3a3226';
      ctx.fillRect(-9, -7, 4, 15);
      ctx.fillRect(5, -7, 4, 15);
      ctx.fillStyle = '#e8b62c';
      roundRect(ctx, -6, -6, 12, 13, 2);
      ctx.fill();
      ctx.fillStyle = '#76570f';
      ctx.fillRect(-1, -11, 2, 7);
      ctx.fillStyle = '#ffe08a';
      circle(ctx, 0, 1, 3.5);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPowerup(s, frame) {
    const pu = s.powerup;
    if (!pu || (pu.life < 180 && (frame >> 2) % 2 === 0)) return;
    const x = FX + pu.x * S, y = FY + pu.y * S;
    const rgb = POWERUP_COLORS[pu.type];
    const pulse = 0.5 + 0.5 * Math.sin(frame * 0.15);
    const g = ctx.createRadialGradient(x + 16, y + 16, 6, x + 16, y + 16, 24);
    g.addColorStop(0, 'rgba(' + rgb + ',' + (0.2 + 0.25 * pulse) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    circle(ctx, x + 16, y + 16, 24);
    ctx.fill();
    roundRect(ctx, x + 3, y + 3, 26, 26, 6);
    ctx.fillStyle = 'rgba(22,27,35,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + rgb + ',0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawIcon(pu.type, x + 16, y + 16, 1);
  }

  function addParticle(p) {
    particles.push(p);
  }

  function sparks(x, y, n, rgb) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.2, life = 12 + Math.random() * 14;
      addParticle({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, rgb });
    }
  }

  function smoke(x, y, n) {
    for (let i = 0; i < n; i++) {
      const life = 40 + Math.random() * 30;
      addParticle({ k: 'smoke', x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: 4 + Math.random() * 5, life, max: life });
    }
  }

  function debris(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.6, life = 18 + Math.random() * 14;
      addParticle({ k: 'debris', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, size: 1.5 + Math.random() * 2, life, max: life, color });
    }
  }

  function burst(type, gx, gy) {
    const x = FX + gx * S, y = FY + gy * S;
    if (type === 'muzzle') addParticle({ k: 'flash', x, y, r: 7, life: 5, max: 5 });
    else if (type === 'brick') { addParticle({ k: 'flash', x, y, r: 10, life: 7, max: 7 }); debris(x, y, 6, '#c2602f'); sparks(x, y, 4, '255,190,110'); }
    else if (type === 'steel') { addParticle({ k: 'flash', x, y, r: 9, life: 6, max: 6 }); sparks(x, y, 7, '255,246,220'); }
    else if (type === 'small') { addParticle({ k: 'flash', x, y, r: 10, life: 7, max: 7 }); sparks(x, y, 5, '255,200,120'); }
    else if (type === 'pickup') { addParticle({ k: 'ring', x, y, r: 28, life: 16, max: 16, rgb: '255,230,140' }); sparks(x, y, 10, '255,230,140'); }
    else {
      const big = type === 'big';
      addParticle({ k: 'flash', x, y, r: big ? 36 : 28, life: 14, max: 14 });
      addParticle({ k: 'ring', x, y, r: big ? 44 : 32, life: 18, max: 18, rgb: '255,210,150' });
      sparks(x, y, big ? 26 : 18, '255,190,90');
      smoke(x, y, big ? 12 : 8);
      debris(x, y, big ? 12 : 8, '#8d97a2');
      shake = Math.max(shake, big ? 16 : 9);
      shakeAmp = big ? 4 : 2.5;
    }
  }

  function addDecal(d) {
    decals.push(d);
    if (decals.length > 700) decals.splice(0, decals.length - 700);
  }

  function stampTracks(t) {
    const cx = FX + (t.x + 8) * S, cy = FY + (t.y + 8) * S;
    const dx = Core.DX[t.dir], dy = Core.DY[t.dir];
    const vertical = dx === 0;
    for (const side of [-11, 11]) {
      addDecal({ k: 'track', x: cx - dx * 12 - dy * side, y: cy - dy * 12 + dx * side, vertical, life: 240, max: 240 });
    }
  }

  function trackMotion(s) {
    for (const t of s.enemies.concat(s.player ? [s.player] : [])) {
      if (!t.alive || t.spawning || t._px === undefined) continue;
      const moved = Math.abs(t.x - t._px) + Math.abs(t.y - t._py);
      if (!moved || moved > 4) continue;
      t._trail = (t._trail || 0) + moved;
      if (t._trail >= 3) {
        t._trail = 0;
        stampTracks(t);
      }
      if ((s.frame + t.x * 3 + t.y) % 14 === 0) {
        const dx = Core.DX[t.dir], dy = Core.DY[t.dir];
        const life = 22 + Math.random() * 10;
        addParticle({ k: 'dust', x: FX + (t.x + 8 - dx * 7) * S, y: FY + (t.y + 8 - dy * 7) * S, vx: -dx * 0.4 + (Math.random() - 0.5) * 0.5, vy: -dy * 0.4 + (Math.random() - 0.5) * 0.5, r: 2 + Math.random() * 2, life, max: life });
      }
    }
  }

  function drawDecals() {
    for (const d of decals) {
      const a = Math.min(1, d.life / d.max * 1.5);
      if (d.k === 'track') {
        ctx.fillStyle = 'rgba(0,0,0,' + 0.34 * a + ')';
        if (d.vertical) ctx.fillRect(d.x - 2.5, d.y - 1.25, 5, 2.5);
        else ctx.fillRect(d.x - 1.25, d.y - 2.5, 2.5, 5);
      } else if (d.k === 'scorch') {
        const g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, d.r);
        g.addColorStop(0, 'rgba(0,0,0,' + 0.45 * a + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        circle(ctx, d.x, d.y, d.r);
        ctx.fill();
      } else if (d.k === 'rubble') {
        ctx.globalAlpha = a;
        ctx.fillStyle = d.color;
        ctx.fillRect(d.x, d.y, d.size, d.size);
        ctx.globalAlpha = 1;
      }
    }
    for (const p of particles) {
      if (p.k !== 'dust') continue;
      const a = p.life / p.max;
      ctx.fillStyle = 'rgba(150,142,124,' + 0.28 * a + ')';
      circle(ctx, p.x, p.y, p.r * (1.8 - a * 0.8));
      ctx.fill();
    }
  }

  function rubble(gx, gy) {
    const x = FX + gx * S, y = FY + gy * S;
    for (let i = 0; i < 4; i++) {
      addDecal({ k: 'rubble', x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, size: 1 + Math.random() * 1.6, color: Math.random() < 0.6 ? '#7a3a1c' : '#4a2a1a', life: 1500, max: 1500 });
    }
  }

  function banner(label, rgb) {
    particles = particles.filter(p => p.k !== 'banner');
    addParticle({ k: 'banner', text: label, rgb, life: 80, max: 80 });
  }

  function updateParticles() {
    for (const d of decals) d.life--;
    decals = decals.filter(d => d.life > 0);
    for (const t of game.state.enemies) if (t._flash > 0) t._flash--;
    for (const p of particles) {
      p.life--;
      if (p.vx !== undefined) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      if (p.rot !== undefined) p.rot += p.vr;
      if (p.k === 'text') p.y -= 0.35;
    }
    particles = particles.filter(p => p.life > 0);
    if (particles.length > 500) particles.splice(0, particles.length - 500);
    if (shake > 0) shake--;
    const s = game.state;
    if (!s.eagleAlive && s.frame % 9 === 0) smoke(FX + Core.EAGLE.x * S + 16, FY + Core.EAGLE.y * S + 12, 1);
  }

  function drawParticles() {
    for (const p of particles) {
      if (p.k !== 'smoke') continue;
      const a = p.life / p.max;
      ctx.fillStyle = 'rgba(125,129,136,' + 0.28 * a + ')';
      circle(ctx, p.x, p.y, p.r * (1.6 - a * 0.6));
      ctx.fill();
    }
    for (const p of particles) {
      const a = p.life / p.max;
      if (p.k === 'flash') {
        const r = p.r * (1.2 - 0.4 * a);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, 'rgba(255,255,240,' + a + ')');
        g.addColorStop(0.35, 'rgba(255,190,90,' + 0.8 * a + ')');
        g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g;
        circle(ctx, p.x, p.y, r);
        ctx.fill();
      } else if (p.k === 'ring') {
        ctx.strokeStyle = 'rgba(' + p.rgb + ',' + 0.6 * a + ')';
        ctx.lineWidth = 2;
        circle(ctx, p.x, p.y, p.r * (1 - a) + 4);
        ctx.stroke();
      } else if (p.k === 'spark') {
        ctx.strokeStyle = 'rgba(' + p.rgb + ',' + a + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
      } else if (p.k === 'debris') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.k === 'text') {
        const style = POPUPS[p.text] || [11, '#ffffff'];
        const age = p.max - p.life;
        const pop = age < 6 ? 1 + (6 - age) / 12 : 1;
        ctx.globalAlpha = Math.min(1, a * 1.6);
        text(p.text, p.x, p.y, style[0] * pop, style[1], { weight: 800, outline: 3 });
        ctx.globalAlpha = 1;
      } else if (p.k === 'banner') {
        const e = p.max - p.life;
        const scale = e < 8 ? 0.6 + 0.55 * (e / 8) : e < 12 ? 1.15 - 0.15 * ((e - 8) / 4) : 1;
        ctx.save();
        ctx.globalAlpha = p.life < 20 ? p.life / 20 : 1;
        ctx.translate(FX + FS / 2, FY + 64 - Math.min(e, 12) * 0.5);
        ctx.scale(scale, scale);
        ctx.shadowColor = 'rgba(' + p.rgb + ',0.9)';
        ctx.shadowBlur = 16;
        text(p.text, 0, 0, 24, 'rgb(' + p.rgb + ')', { weight: 900, spacing: 3, outline: 4 });
        ctx.restore();
      }
    }
  }

  function miniTank(x, y, color) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y + 2, 12, 8, 2);
    ctx.fill();
    ctx.fillRect(x + 5.25, y - 1, 1.5, 5);
    circle(ctx, x + 6, y + 6, 2.6);
    ctx.fill();
  }

  function drawPanel(s, frame) {
    roundRect(ctx, PX, FY, PW, FS, 8);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    const mid = PX + PW / 2;
    const divider = y => { ctx.fillStyle = C.line; ctx.fillRect(PX + 8, y, PW - 16, 1); };
    text('ENEMY', mid, FY + 14, 8.5, C.label, { spacing: 1 });
    for (let i = 0; i < 20; i++) {
      miniTank(PX + 12 + (i % 2) * 24, FY + 26 + (i >> 1) * 14, i < s.reserve.length ? '#c6cdd5' : 'rgba(255,255,255,0.07)');
    }
    divider(FY + 172);
    text('LIVES', mid, FY + 186, 8.5, C.label, { spacing: 1 });
    miniTank(PX + 12, FY + 199, C.gold);
    text(String(Math.max(0, Math.min(99, s.lives))), PX + 41, FY + 204, 17, C.text, { weight: 800 });
    const star = s.player ? s.player.star : 0;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(PX + 16 + i * 14, FY + 226);
      starPath(ctx, 5, 2.2);
      ctx.fillStyle = i < star ? C.gold : 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.restore();
    }
    divider(FY + 240);
    text('STAGE', mid, FY + 254, 8.5, C.label, { spacing: 1 });
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(PX + 12, FY + 264, 1.5, 18);
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(PX + 13.5, FY + 264);
    ctx.quadraticCurveTo(PX + 19, FY + 262 + Math.sin(frame * 0.1) * 1.5, PX + 25, FY + 266);
    ctx.lineTo(PX + 13.5, FY + 272);
    ctx.closePath();
    ctx.fill();
    text(String(s.stage), PX + 41, FY + 274, 17, C.text, { weight: 800 });
    const timers = [];
    if (s.player && s.player.alive && s.player.shield > 0) timers.push(['helmet', s.player.shield / TIMINGS.helmet, '95,184,255']);
    if (s.freeze > 0) timers.push(['clock', s.freeze / TIMINGS.clock, '205,214,224']);
    if (s.shovel > 0) timers.push(['shovel', s.shovel / TIMINGS.shovel, '214,165,106']);
    if (timers.length) divider(FY + 292);
    timers.forEach(([type, ratio, rgb], i) => {
      const y = FY + 306 + i * 24;
      drawIcon(type, PX + 15, y, 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, PX + 26, y - 2.5, 26, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = 'rgb(' + rgb + ')';
      roundRect(ctx, PX + 26, y - 2.5, Math.max(2, 26 * Math.min(1, ratio)), 5, 2.5);
      ctx.fill();
    });
  }

  function fieldShade(alpha) {
    ctx.fillStyle = 'rgba(10,12,16,' + alpha + ')';
    ctx.fillRect(FX, FY, FS, FS);
  }

  function drawCurtain(s) {
    const e = TIMINGS.curtain - s.timer;
    fieldShade(e < 92 ? 1 : Math.max(0, 1 - (e - 92) / 28));
    const a = e < 12 ? e / 12 : e < 84 ? 1 : Math.max(0, 1 - (e - 84) / 18);
    if (a <= 0) return;
    const lift = (1 - Math.min(1, e / 20)) * 10;
    const cx = FX + FS / 2, cy = FY + FS / 2 + lift;
    ctx.globalAlpha = a;
    text('STAGE', cx, cy - 38, 13, C.label, { spacing: 6 });
    text(String(s.stage), cx, cy, 56, C.text, { weight: 800 });
    const name = (s.stageName || '').toUpperCase();
    text(name, cx, cy + 44, 12, C.gold, { spacing: 4 });
    ctx.fillStyle = 'rgba(242,201,76,0.45)';
    const half = name.length * 5 + 22;
    ctx.fillRect(cx - half - 36, cy + 44, 30, 1);
    ctx.fillRect(cx + half + 6, cy + 44, 30, 1);
    ctx.globalAlpha = 1;
  }

  function drawTally(s, frame) {
    const e = TIMINGS.tally - s.timer;
    fieldShade(Math.min(0.72, e / 20));
    const x = FX + 58, y = FY + 42, w = 300, h = 332;
    const rise = Math.max(0, 1 - e / 18) * 16;
    ctx.save();
    ctx.translate(0, rise);
    ctx.globalAlpha = Math.min(1, e / 14);
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = '#151a21';
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.stroke();
    text('STAGE ' + s.stage + ' CLEAR', x + w / 2, y + 30, 20, C.text, { weight: 800, spacing: 1 });
    text((s.stageName || '').toUpperCase(), x + w / 2, y + 52, 10, C.gold, { spacing: 3 });
    let totalKills = 0, totalPoints = 0;
    ENEMY_TYPES.forEach((type, i) => {
      const start = 24 + i * 40;
      if (e < start) return;
      const count = Math.min(s.kills[type], Math.floor((e - start) / 4));
      if (tallyShown[i] !== count) {
        tallyShown[i] = count;
        sfx('tick');
      }
      totalKills += count;
      totalPoints += count * STATS[type].points;
      const ry = y + 92 + i * 40;
      ctx.save();
      ctx.translate(x + 40, ry);
      ctx.scale(0.72, 0.72);
      drawTank({ kind: 'enemy', type, dir: UP, hp: STATS[type].hp, bonus: false }, -16, -16, 0);
      ctx.restore();
      text(TYPE_NAMES[type], x + 68, ry, 13, '#b8c1cb', { align: 'left', weight: 600 });
      text('\u00d7 ' + count, x + 176, ry, 14, C.text, { weight: 700 });
      text((count * STATS[type].points).toLocaleString() + ' pts', x + w - 26, ry, 14, C.gold, { align: 'right', weight: 700 });
    });
    if (e >= 24 + 4 * 40) {
      ctx.fillStyle = C.line;
      ctx.fillRect(x + 24, y + 252, w - 48, 1);
      text('TOTAL', x + 68, y + 272, 13, '#b8c1cb', { align: 'left', weight: 700, spacing: 1 });
      text('\u00d7 ' + totalKills, x + 176, y + 272, 14, C.text, { weight: 800 });
      text(totalPoints.toLocaleString() + ' pts', x + w - 26, y + 272, 14, C.gold, { align: 'right', weight: 800 });
    }
    text('SCORE ' + s.score.toLocaleString(), x + 80, y + h - 26, 11, C.label, { weight: 700, spacing: 1 });
    text('BEST ' + Math.max(tallyHiScore, s.score).toLocaleString(), x + w - 80, y + h - 26, 11, C.label, { weight: 700, spacing: 1 });
    ctx.restore();
  }

  function drawGameOver(s) {
    const e = s.phase === 'over' ? TIMINGS.gameover : TIMINGS.gameover - s.timer;
    const a = Math.min(1, e / 45);
    fieldShade(0.55 * a);
    const ease = 1 - Math.pow(1 - a, 3);
    const cy = FY + FS / 2 + (1 - ease) * 40;
    ctx.save();
    ctx.shadowColor = 'rgba(255,90,79,0.85)';
    ctx.shadowBlur = 18 * a;
    text('GAME OVER', FX + FS / 2, cy - 8, 42, 'rgba(255,90,79,' + a + ')', { weight: 900, spacing: 3 });
    ctx.restore();
    text(gameOverReason === 'eagle' ? 'THE EAGLE HAS FALLEN' : 'OUT OF TANKS', FX + FS / 2, cy + 26, 11, 'rgba(233,237,242,' + 0.8 * a + ')', { spacing: 3 });
  }

  function lerp(o, alpha) {
    if (o._px === undefined) return [o.x, o.y];
    return [o._px + (o.x - o._px) * alpha, o._py + (o.y - o._py) * alpha];
  }

  function render(alpha) {
    if (!game) return;
    const s = game.state;
    const frame = s.frame;
    const a = Math.max(0, Math.min(1, alpha === undefined ? 1 : alpha));
    const scale = ctx.getTransform().a || 1;
    if (terrainDirty || terrainStage !== s.stage || Math.abs(scale - terrainScale) > 0.001) rebuildTerrain(scale);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.bg0);
    bg.addColorStop(1, C.bg1);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 2 * shakeAmp * (shake / 16), (Math.random() - 0.5) * 2 * shakeAmp * (shake / 16));
    roundRect(ctx, FX, FY, FS, FS, 6);
    ctx.fillStyle = C.field;
    ctx.fill();
    ctx.save();
    roundRect(ctx, FX, FY, FS, FS, 6);
    ctx.clip();
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 13; i++) {
      ctx.moveTo(FX + i * 32 + 0.5, FY); ctx.lineTo(FX + i * 32 + 0.5, FY + FS);
      ctx.moveTo(FX, FY + i * 32 + 0.5); ctx.lineTo(FX + FS, FY + i * 32 + 0.5);
    }
    ctx.stroke();
    ctx.drawImage(terrainCanvas, 0, 0, W, H);
    drawWater(s, frame);
    if (game.isRingWarning() && (frame >> 4) % 2 === 0) {
      for (const [bx, by] of game.ringCells) for (let j = 0; j < 2; j++) drawBrick(ctx, bx * 2, by * 2 + j, 2);
    }
    drawDecals();
    drawEagle(s.eagleAlive, frame);
    for (const t of s.enemies.concat(s.player ? [s.player] : [])) {
      if (!t.alive) continue;
      const [gx, gy] = lerp(t, a);
      const x = FX + gx * S, y = FY + gy * S;
      if (t.spawning > 0) drawSpawn(t, x, y, frame);
      else {
        drawTank(t, x, y, frame);
        if (t.kind === 'player' && t.shield > 0) drawShield(x + 16, y + 16, frame, t.shield, t._flash || 0);
      }
    }
    for (const b of s.bullets) {
      const [gx, gy] = lerp(b, a);
      drawBullet(b, FX + gx * S, FY + gy * S);
    }
    ctx.drawImage(treesCanvas, 0, 0, W, H);
    drawPowerup(s, frame);
    drawParticles();
    if (s.phase === 'gameover' || s.phase === 'over') drawGameOver(s);
    if (s.phase === 'tally') drawTally(s, frame);
    if (s.phase === 'curtain') drawCurtain(s);
    ctx.restore();
    roundRect(ctx, FX + 0.5, FY + 0.5, FS - 1, FS - 1, 6);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    drawPanel(s, frame);
  }

  function nearestEnemy(gx, gy) {
    let best = null, bestD = 1e9;
    for (const t of game.state.enemies) {
      const d = Math.abs(t.x + 8 - gx) + Math.abs(t.y + 8 - gy);
      if (d < bestD) { best = t; bestD = d; }
    }
    return bestD < 20 ? best : null;
  }

  function handleEvents(events) {
    const tankPickup = events.some(e => e.type === 'powerup' && e.powerup === 'tank');
    for (const e of events) {
      if (e.type === 'fire') {
        sfx('fire');
        burst('muzzle', e.x, e.y);
        if (shake < 2) { shake = 2; shakeAmp = 0.8; }
      }
      else if (e.type === 'enemyFire') { burst('muzzle', e.x, e.y); sfx('enemyFire'); }
      else if (e.type === 'brick') { terrainDirty = true; burst('brick', e.x, e.y); rubble(e.x, e.y); if (e.player) sfx('brick'); }
      else if (e.type === 'steel' || e.type === 'wall') { burst('steel', e.x, e.y); if (e.player) sfx('steel'); }
      else if (e.type === 'clash') { burst('small', e.x, e.y); sfx('clash'); }
      else if (e.type === 'shieldHit') {
        burst('small', e.x, e.y);
        sfx('shield');
        if (game.state.player) game.state.player._flash = 10;
      }
      else if (e.type === 'armorHit') {
        sfx('armor');
        burst('steel', e.x, e.y);
        const t = nearestEnemy(e.x, e.y);
        if (t) t._flash = 8;
      }
      else if (e.type === 'enemyDown') {
        burst('tank', e.x, e.y);
        sfx('explode');
        addDecal({ k: 'scorch', x: FX + e.x * S, y: FY + e.y * S, r: 16, life: 1800, max: 1800 });
      }
      else if (e.type === 'playerDown' || e.type === 'eagle') {
        burst('big', e.x, e.y);
        sfx('bigExplode');
        addDecal({ k: 'scorch', x: FX + e.x * S, y: FY + e.y * S, r: 20, life: 2400, max: 2400 });
      }
      else if (e.type === 'points') addParticle({ k: 'text', text: String(e.value), x: FX + e.x * S, y: FY + e.y * S, life: 50, max: 50 });
      else if (e.type === 'enemySpawn') sfx('spawn');
      else if (e.type === 'powerupSpawn') sfx('powerupSpawn');
      else if (e.type === 'powerup') {
        sfx({ grenade: 'grenade', clock: 'clock', shovel: 'shovel', tank: 'life' }[e.powerup] || 'pickup');
        const maxed = e.powerup === 'star' && game.state.player && game.state.player.star >= 3;
        const label = maxed ? ['MAX POWER', BANNERS.star[1]] : BANNERS[e.powerup];
        if (label) banner(label[0], label[1]);
        burst('pickup', e.x, e.y);
        terrainDirty = true;
      }
      else if (e.type === 'shovelEnd') terrainDirty = true;
      else if (e.type === 'extraLife') { if (!tankPickup) { sfx('life'); banner('1-UP', BANNERS.tank[1]); } }
      else if (e.type === 'stage') {
        terrainDirty = true;
        particles = [];
        decals = [];
        Sound.music.stop();
        if (e.stage > 1) sfx('stage');
      }
      else if (e.type === 'tally') {
        tallyShown = [-1, -1, -1, -1];
        tallyHiScore = Math.max(game.state.score, safeLoadScores()[0] || 0);
        Sound.music.stop();
        sfx('clear');
      }
      else if (e.type === 'gameOver') {
        gameOverReason = e.reason;
        Sound.music.stop();
        Sound.engine('off');
        setTimeout(() => sfx('gameover'), 600);
      }
    }
  }

  function currentInput() {
    const input = { dir: dirStack.length ? dirStack[dirStack.length - 1] : dirLatch, fire: fireSources.size > 0 || fireLatch };
    dirLatch = -1;
    fireLatch = false;
    return input;
  }

  function tick() {
    const s = game.state;
    for (const o of s.enemies.concat(s.bullets, s.player ? [s.player] : [])) {
      o._px = o.x;
      o._py = o.y;
    }
    const events = game.step(currentInput());
    handleEvents(events);
    trackMotion(s);
    updateParticles();
    const p = s.player;
    if (p && p._flash > 0) p._flash--;
    const active = s.phase === 'play' || s.phase === 'clear';
    const moving = p && p._px !== undefined && (p.x !== p._px || p.y !== p._py);
    Sound.engine(active && p && p.alive && !p.spawning ? (moving ? 'move' : 'idle') : 'off');
    if (s.phase === 'play' && !Sound.music.isPlaying()) Sound.music.start();
    Sound.update();
    if (s.score !== lastScore) {
      lastScore = s.score;
      if (window.GamePlatform) GamePlatform.updateScore(s.score);
    }
    if (s.phase === 'over') finishGame();
  }

  function loop(now) {
    if (!running) return;
    accumulator += Math.min(100, now - lastTime);
    lastTime = now;
    let steps = 0;
    while (accumulator >= STEP_MS && running && steps < 6) {
      accumulator -= STEP_MS;
      tick();
      steps++;
    }
    if (steps === 6) accumulator = 0;
    render(accumulator / STEP_MS);
    if (running) animationId = requestAnimationFrame(loop);
  }

  function beginGame() {
    if (running || performance.now() - endedAt < 700) return;
    ensureAudio();
    game = Core.create({});
    game.startGame();
    running = true;
    particles = [];
    decals = [];
    shake = 0;
    gameOverReason = '';
    accumulator = 0;
    lastScore = -1;
    terrainDirty = true;
    dirStack = [];
    fireSources.clear();
    overlay.classList.add('hidden');
    highscores.classList.add('hidden');
    if (window.GamePlatform) { GamePlatform.resetTimer(); GamePlatform.startTimer(); }
    sfx('stage');
    lastTime = performance.now();
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
  }

  function finishGame() {
    if (!running) return;
    running = false;
    endedAt = performance.now();
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    Sound.engine('off');
    Sound.music.stop();
    const s = game.state;
    renderScores(saveScore(s.score));
    if (window.GamePlatform) {
      const elapsed = GamePlatform.stopTimer();
      GamePlatform.recordGame('battle-city', s.score, elapsed * 1000, { maxWave: s.stage });
    }
    overlayMessage.textContent = 'Game over · Score ' + s.score.toLocaleString() + ' · Stage ' + s.stage;
    overlayButton.textContent = 'Play Again';
    overlay.classList.remove('hidden');
    render(1);
  }

  const KEY_DIRS = { ArrowUp: UP, KeyW: UP, ArrowRight: RIGHT, KeyD: RIGHT, ArrowDown: DOWN, KeyS: DOWN, ArrowLeft: LEFT, KeyA: LEFT };
  const FIRE_KEYS = ['Space', 'KeyJ', 'KeyZ', 'KeyK'];
  const ACTION_DIRS = { up: UP, right: RIGHT, down: DOWN, left: LEFT };

  function pressDir(dir) {
    dirStack = dirStack.filter(d => d !== dir);
    dirStack.push(dir);
    dirLatch = dir;
  }

  function pressFire(source) {
    fireSources.add(source);
    fireLatch = true;
  }

  function releaseDir(dir) {
    dirStack = dirStack.filter(d => d !== dir);
  }

  function clearInput() {
    dirStack = [];
    dirLatch = -1;
    fireLatch = false;
    fireSources.clear();
  }

  overlayButton.addEventListener('click', event => { event.stopPropagation(); beginGame(); });
  overlay.addEventListener('click', event => { if (event.target === overlay) beginGame(); });
  function syncMusicButton() {
    const btn = document.querySelector('#gp-header .gp-btn-music');
    if (!btn) return;
    const on = Sound.music.isEnabled();
    btn.classList.toggle('off', !on);
    btn.title = on ? 'Music on (M)' : 'Music off (M)';
    btn.setAttribute('aria-pressed', String(on));
  }

  function toggleMusic() {
    Sound.music.setEnabled(!Sound.music.isEnabled());
    syncMusicButton();
  }

  function addMusicButton() {
    const actions = document.querySelector('#gp-header .gp-header-actions');
    if (!actions || actions.querySelector('.gp-btn-music')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gp-btn-music';
    btn.textContent = '\u{1F3B5}';
    btn.addEventListener('click', event => {
      event.preventDefault();
      btn.blur();
      toggleMusic();
    });
    actions.insertBefore(btn, actions.querySelector('.gp-btn-sound'));
    syncMusicButton();
  }

  document.addEventListener('keydown', event => {
    if (event.code === 'KeyM' && !event.repeat && !event.metaKey && !event.ctrlKey) {
      toggleMusic();
      if (!running) return;
    }
    if (!running) {
      if (event.key !== 'Tab' && !event.metaKey && !event.ctrlKey) { event.preventDefault(); beginGame(); }
      return;
    }
    if (KEY_DIRS[event.code] !== undefined) {
      event.preventDefault();
      if (!event.repeat) pressDir(KEY_DIRS[event.code]);
    } else if (FIRE_KEYS.includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) pressFire(event.code);
    }
  });
  document.addEventListener('keyup', event => {
    if (KEY_DIRS[event.code] !== undefined) releaseDir(KEY_DIRS[event.code]);
    else if (FIRE_KEYS.includes(event.code)) fireSources.delete(event.code);
  });
  window.addEventListener('blur', clearInput);
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!running) { beginGame(); return; }
    pressFire('pointer');
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => canvas.addEventListener(type, () => fireSources.delete('pointer')));
  document.querySelectorAll('[data-action]').forEach(button => {
    const action = button.dataset.action;
    const source = 'button-' + action;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (!running) { beginGame(); return; }
      if (action === 'fire') pressFire(source);
      else pressDir(ACTION_DIRS[action]);
      button.classList.add('pressed');
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    });
    const release = event => {
      event.preventDefault();
      if (action === 'fire') fireSources.delete(source);
      else releaseDir(ACTION_DIRS[action]);
      button.classList.remove('pressed');
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });

  game = Core.create({ seed: 1 });
  game.startStage(1);
  game.state.phase = 'idle';
  game.state.player.spawning = 0;
  renderScores(safeLoadScores());
  render(1);
  if (window.GamePlatform) GamePlatform.initHeader('Battle City');
  addMusicButton();
  GameEngine.pausable({ isActive: () => running, container: '#game-area' });
})();
