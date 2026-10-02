(function () {
  'use strict';

  const { setTimeout, clearTimeout, requestAnimationFrame, performance } = GameEngine.clock;
  const Core = window.ChainCore;
  const AI = window.ChainAI;
  const Sound = window.ChainAudio;

  const CELL = 64;
  const ORB_R = CELL * 0.17;
  const PLAYERS = [
    { color: '#ff3d6e', rgb: '255,61,110', name: 'Red' },
    { color: '#2ee6ff', rgb: '46,230,255', name: 'Cyan' },
    { color: '#8dff3d', rgb: '141,255,61', name: 'Lime' },
    { color: '#ffc23d', rgb: '255,194,61', name: 'Amber' }
  ];
  const ORDINALS = ['1st', '2nd', '3rd', '4th'];
  const SETTINGS_KEY = 'chainreaction_settings';
  const CPU_DELAY = { easy: 450, medium: 600, hard: 750 };
  const LAYOUTS = [
    [],
    [[0, 0]],
    [[-0.72, 0], [0.72, 0]],
    [[0, -0.8], [-0.72, 0.42], [0.72, 0.42]],
    [[-0.58, -0.58], [0.58, -0.58], [0.58, 0.58], [-0.58, 0.58]]
  ];

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  GameEngine.sharpCanvas(canvas);

  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMessage = document.getElementById('overlay-message');
  const resultStats = document.getElementById('result-stats');
  const startBtn = document.getElementById('start-btn');
  const undoBtn = document.getElementById('undo-btn');
  const newBtn = document.getElementById('new-btn');
  const turnText = document.getElementById('turn-text');
  const levelPicker = document.getElementById('level-picker');
  const hudEl = document.getElementById('hud');
  const playersEl = document.getElementById('players');
  let chipEls = [];

  let settings = loadSettings();
  let game = null;
  let view = null;
  let phase = 'menu';
  let anim = null;
  let cpuTimer = null;
  let overlayTimer = null;
  let hover = -1;
  let cursor = -1;
  let lastMove = -1;
  let fx = [];
  let shakeTime = 0, shakeMax = 1, shakeAmp = 0;
  let gridFrom = 0, gridTo = 0, gridT = 1;
  let longestChain = 0;
  let chainBanner = null;
  let lastTime = performance.now();
  const spriteCache = new Map();
  const gridCache = new Map();

  function loadSettings() {
    const defaults = { mode: 'cpu', level: 'medium', size: 'small', players: 2 };
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      return {
        mode: s.mode === 'pvp' ? 'pvp' : 'cpu',
        level: ['easy', 'medium', 'hard'].indexOf(s.level) >= 0 ? s.level : defaults.level,
        size: s.size === 'large' ? 'large' : 'small',
        players: [2, 3, 4].indexOf(s.players) >= 0 ? s.players : defaults.players
      };
    } catch (e) { return defaults; }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { }
  }

  function syncPickers() {
    document.querySelectorAll('#mode-picker .chip').forEach(b => b.classList.toggle('selected', b.dataset.mode === settings.mode));
    document.querySelectorAll('#level-picker .chip').forEach(b => b.classList.toggle('selected', b.dataset.level === settings.level));
    document.querySelectorAll('#size-picker .chip').forEach(b => b.classList.toggle('selected', b.dataset.size === settings.size));
    document.querySelectorAll('#count-picker .chip').forEach(b => {
      const n = Number(b.dataset.count);
      b.classList.toggle('selected', n === settings.players);
      b.textContent = settings.mode === 'cpu' ? (n - 1) + (n === 2 ? ' CPU' : ' CPUs') : n + ' Players';
    });
    levelPicker.classList.toggle('hidden', settings.mode !== 'cpu');
  }

  function isCpu(p) {
    return settings.mode === 'cpu' && p !== 0;
  }

  function playerName(p) {
    if (settings.mode === 'cpu') return p === 0 ? 'You' : (game && game.players > 2 ? 'CPU ' + p : 'CPU');
    return PLAYERS[p].name;
  }

  function buildChips() {
    playersEl.innerHTML = '';
    chipEls = [];
    for (let p = 0; p < game.players; p++) {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.style.setProperty('--pc', PLAYERS[p].color);
      chip.innerHTML = '<span class="chip-dot"></span><span class="chip-name"></span><strong class="chip-orbs">0</strong>';
      chip.querySelector('.chip-name').textContent = playerName(p);
      playersEl.appendChild(chip);
      chipEls.push(chip);
    }
    hudEl.classList.toggle('duo', game.players === 2);
  }

  function demoBoard() {
    const [cols, rows] = Core.SIZES[settings.size];
    const s = Core.create(cols, rows, settings.players);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < 11 * settings.players && s.winner < 0; k++) {
      const moves = Core.legalMoves(s);
      Core.place(s, moves[Math.floor(rnd() * moves.length)], false);
    }
    return s;
  }

  function setBoardSize(cols, rows) {
    if (canvas.width !== cols * CELL) canvas.width = cols * CELL;
    if (canvas.height !== rows * CELL) canvas.height = rows * CELL;
  }

  function showMenu() {
    phase = 'menu';
    game = demoBoard();
    view = { owner: game.owner.slice(), count: game.count.slice(), out: game.out.slice() };
    setBoardSize(game.geo.cols, game.geo.rows);
    buildChips();
    gridFrom = gridTo = 0;
    gridT = 1;
    overlayTitle.textContent = 'CHAIN REACTION';
    overlayMessage.textContent = 'Fill a cell to bursting and set off a chain reaction';
    resultStats.classList.add('hidden');
    startBtn.textContent = 'Start Game';
    overlay.classList.remove('hidden');
    syncPickers();
    updateHud();
  }

  function startGame() {
    clearTimeout(cpuTimer);
    clearTimeout(overlayTimer);
    cpuTimer = overlayTimer = null;
    const [cols, rows] = Core.SIZES[settings.size];
    game = Core.create(cols, rows, settings.players);
    view = { owner: game.owner.slice(), count: game.count.slice(), out: game.out.slice() };
    setBoardSize(cols, rows);
    anim = null;
    fx = [];
    chainBanner = null;
    lastMove = -1;
    hover = -1;
    cursor = -1;
    longestChain = 0;
    gridFrom = gridTo = 0;
    gridT = 1;
    phase = 'play';
    overlay.classList.add('hidden');
    buildChips();
    updateHud();
    if (window.GamePlatform) { GamePlatform.resetTimer(); GamePlatform.startTimer(); }
    Sound.sfx('start');
    Sound.music.start();
  }

  function humanTurn() {
    return phase === 'play' && !anim && game.winner < 0 && !isCpu(game.turn);
  }

  function cellAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const { cols, rows } = game.geo;
    const x = Math.floor((clientX - r.left) / r.width * cols);
    const y = Math.floor((clientY - r.top) / r.height * rows);
    return x >= 0 && y >= 0 && x < cols && y < rows ? y * cols + x : -1;
  }

  function tryMove(i) {
    if (i < 0 || !humanTurn()) return;
    if (!Core.legal(game, i)) {
      Sound.sfx('invalid');
      fx.push({ k: 'deny', cell: i, life: 320, max: 320 });
      return;
    }
    makeMove(i);
  }

  function makeMove(i) {
    const res = Core.place(game, i, true);
    if (!res) return;
    lastMove = i;
    view.owner[i] = res.player;
    view.count[i]++;
    Sound.sfx('place', res.player);
    fx.push({ k: 'pop', cell: i, color: res.player, life: 260, max: 260 });
    if (settings.mode === 'pvp' || res.player === 0) longestChain = Math.max(longestChain, res.chain);
    anim = { waves: res.waves, index: 0, t: 0, player: res.player, speed: 1, exploded: 0 };
    chainBanner = null;
    updateHud();
    if (!res.waves.length) finishMove();
  }

  function waveDuration(index) {
    return Math.max(70, 250 * Math.pow(0.9, index));
  }

  function applyWave(w) {
    const { neighbors } = game.geo;
    view.owner.set(w.owner);
    view.count.set(w.count);
    for (let q = 0; q < w.out.length; q++) {
      if (w.out[q] && !view.out[q]) {
        view.out[q] = true;
        fx.push({ k: 'banner', text: playerName(q).toUpperCase() + (settings.mode === 'cpu' && q === 0 ? '\u2019RE OUT' : ' IS OUT'), color: q, life: 1500, max: 1500 });
        Sound.sfx('out');
      }
    }
    anim.exploded += w.cells.length;
    for (const i of w.cells) {
      const [cx, cy] = center(i);
      fx.push({ k: 'ring', x: cx, y: cy, color: anim.player, life: 380, max: 380 });
      for (let n = 0; n < 9; n++) {
        const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.5;
        fx.push({ k: 'spark', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: Math.random() < 0.3 ? '#ffffff' : PLAYERS[anim.player].color, size: 1.5 + Math.random() * 2.5, life: 380 + Math.random() * 300, max: 680 });
      }
      for (const j of neighbors[i]) fx.push({ k: 'pop', cell: j, color: anim.player, life: 200, max: 200 });
    }
    Sound.sfx('burst', anim.index);
    if (w.cells.length >= 3) shake(140 + w.cells.length * 12, Math.min(7, 1.5 + w.cells.length * 0.5));
    if (anim.exploded >= 6) {
      if (!chainBanner || chainBanner.life < 400) Sound.sfx(anim.exploded >= 12 && (!chainBanner || chainBanner.n < 12) ? 'bigchain' : 'turn');
      chainBanner = { n: anim.exploded, color: anim.player, life: 1400, max: 1400, pop: 1 };
    }
    updateHud();
  }

  function finishMove() {
    anim = null;
    view.owner.set(game.owner);
    view.count.set(game.count);
    view.out = game.out.slice();
    if (game.winner >= 0) { endGame(); return; }
    gridFrom = gridTo;
    gridTo = game.turn;
    gridT = 0;
    updateHud();
    if (isCpu(game.turn)) scheduleCpu();
  }

  function scheduleCpu() {
    clearTimeout(cpuTimer);
    cpuTimer = setTimeout(() => {
      cpuTimer = null;
      if (phase !== 'play' || anim || !isCpu(game.turn) || game.winner >= 0) return;
      makeMove(AI.choose(game, settings.level));
    }, CPU_DELAY[settings.level]);
    updateHud();
  }

  function undoAllowed() {
    if (phase !== 'play' || anim || !game || game.winner >= 0 || !game.history.length) return false;
    return settings.mode === 'pvp' || game.moves[0] > 0;
  }

  function undo() {
    if (!undoAllowed()) return;
    clearTimeout(cpuTimer);
    cpuTimer = null;
    Core.undo(game);
    while (isCpu(game.turn) && game.history.length) Core.undo(game);
    view.owner.set(game.owner);
    view.count.set(game.count);
    view.out = game.out.slice();
    lastMove = -1;
    chainBanner = null;
    gridFrom = gridTo;
    gridTo = game.turn;
    gridT = 0;
    Sound.sfx('undo');
    updateHud();
    if (isCpu(game.turn)) scheduleCpu();
  }

  function endGame() {
    phase = 'over';
    clearTimeout(cpuTimer);
    cpuTimer = null;
    const w = game.winner;
    const youWon = w === 0;
    const vsCpu = settings.mode === 'cpu';
    gridFrom = gridTo;
    gridTo = w;
    gridT = 0;
    for (let i = 0; i < game.geo.n; i++) {
      if (game.owner[i] !== w) continue;
      const [cx, cy] = center(i);
      for (let n = 0; n < 4; n++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
        fx.push({ k: 'spark', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, color: Math.random() < 0.3 ? '#ffffff' : PLAYERS[w].color, size: 2 + Math.random() * 2.5, life: 700 + Math.random() * 600, max: 1300 });
      }
    }
    shake(380, 6);
    Sound.sfx(vsCpu && !youWon ? 'lose' : 'win');
    Sound.music.stop();
    updateHud();
    const rivals = game.players > 2 ? 'computers' : 'computer';
    const title = vsCpu ? (youWon ? 'You Win!' : playerName(w) + ' Wins') : PLAYERS[w].name + ' Wins!';
    const message = vsCpu
      ? (youWon ? 'You took over the board from the ' + settings.level + ' ' + rivals : playerName(w) + ' (' + settings.level + ') took over the board')
      : PLAYERS[w].name + ' took over the board';
    const finish = [w].concat(game.order.slice().reverse());
    let recorded = 0;
    if (window.GamePlatform) {
      const t = GamePlatform.stopTimer();
      recorded = t;
      GamePlatform.recordGame('chain-reaction', game.total[0], t * 1000, { win: youWon, mode: vsCpu ? 'cpu-' + settings.level : 'pvp', maxCombo: longestChain, players: game.players });
      GamePlatform.updateScore(game.total[0]);
    }
    const mins = Math.floor(recorded / 60), secs = Math.round(recorded % 60);
    overlayTimer = setTimeout(() => {
      overlayTimer = null;
      overlayTitle.textContent = title;
      overlayMessage.textContent = message;
      resultStats.innerHTML =
        '<div class="result-stat"><strong>' + (game.moves[0] + game.moves[1]) + '</strong><span>Moves</span></div>' +
        '<div class="result-stat"><strong>' + longestChain + '</strong><span>Longest chain</span></div>' +
        (recorded ? '<div class="result-stat"><strong>' + mins + ':' + String(secs).padStart(2, '0') + '</strong><span>Time</span></div>' : '') +
        (game.players > 2 ? '<div class="finish-order">' + finish.map((q, k) => '<span style="--pc:' + PLAYERS[q].color + '"><i></i>' + ORDINALS[k] + ' ' + playerName(q) + '</span>').join('') + '</div>' : '');
      resultStats.classList.remove('hidden');
      startBtn.textContent = 'Play Again';
      syncPickers();
      overlay.classList.remove('hidden');
    }, 1400);
  }

  function updateHud() {
    if (!game) return;
    const totals = new Array(game.players).fill(0);
    for (let i = 0; i < game.geo.n; i++) if (view.owner[i] >= 0) totals[view.owner[i]] += view.count[i];
    const active = phase === 'over' ? game.winner : anim ? anim.player : game.turn;
    chipEls.forEach((chip, q) => {
      chip.querySelector('.chip-orbs').textContent = totals[q];
      chip.classList.toggle('active', phase !== 'menu' && active === q);
      chip.classList.toggle('out', phase !== 'menu' && !!view.out[q]);
    });
    let text = '';
    let thinking = false;
    if (phase === 'play') {
      if (anim) text = 'Chain reaction!';
      else if (settings.mode === 'cpu') {
        thinking = isCpu(game.turn);
        text = thinking ? playerName(game.turn) + ' thinking' : 'Your turn';
      } else {
        text = PLAYERS[game.turn].name + '\u2019s turn';
      }
    } else if (phase === 'over') {
      text = game.winner === 0 && settings.mode === 'cpu' ? 'You win!' : playerName(game.winner) + ' wins!';
    } else {
      text = 'Choose a mode';
    }
    turnText.textContent = text;
    turnText.classList.toggle('thinking', thinking);
    undoBtn.disabled = !undoAllowed();
    const p = PLAYERS[active];
    document.body.style.setProperty('--turn', p.color);
    document.body.style.setProperty('--turn-glow', 'rgba(' + p.rgb + ',0.28)');
    if (window.GamePlatform && phase !== 'menu') GamePlatform.updateScore(totals[0]);
  }

  function shake(ms, amp) {
    if (ms >= shakeTime) { shakeTime = ms; shakeMax = ms; }
    shakeAmp = Math.max(amp, shakeTime > 0 ? shakeAmp : 0);
  }

  function center(i) {
    const cols = game.geo.cols;
    return [(i % cols) * CELL + CELL / 2, Math.floor(i / cols) * CELL + CELL / 2];
  }

  function orbSprite(p, k) {
    const key = p + '|' + k;
    let sp = spriteCache.get(key);
    if (sp) return sp;
    const pad = Math.ceil(ORB_R * 1.1);
    const size = Math.ceil((ORB_R + pad) * 2 * k);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.scale(k, k);
    const cx = ORB_R + pad, cy = ORB_R + pad;
    g.shadowColor = 'rgba(' + PLAYERS[p].rgb + ',0.9)';
    g.shadowBlur = ORB_R * 1.1 * k;
    g.fillStyle = PLAYERS[p].color;
    g.beginPath();
    g.arc(cx, cy, ORB_R, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    const grad = g.createRadialGradient(cx - ORB_R * 0.38, cy - ORB_R * 0.42, ORB_R * 0.08, cx, cy, ORB_R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.22, 'rgba(' + PLAYERS[p].rgb + ',0.75)');
    grad.addColorStop(0.62, PLAYERS[p].color);
    grad.addColorStop(1, 'rgba(10,10,30,0.85)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, ORB_R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.ellipse(cx - ORB_R * 0.35, cy - ORB_R * 0.45, ORB_R * 0.26, ORB_R * 0.15, -0.6, 0, Math.PI * 2);
    g.fill();
    sp = { canvas: c, half: ORB_R + pad };
    spriteCache.set(key, sp);
    return sp;
  }

  function drawOrb(p, x, y, k, scale) {
    const sp = orbSprite(p, k);
    const s = scale || 1;
    ctx.drawImage(sp.canvas, x - sp.half * s, y - sp.half * s, sp.half * 2 * s, sp.half * 2 * s);
  }

  function gridLayer(p, k) {
    const { cols, rows } = game.geo;
    const key = p + '|' + cols + 'x' + rows + '|' + k;
    let layer = gridCache.get(key);
    if (layer) return layer;
    const W = cols * CELL, H = rows * CELL;
    layer = document.createElement('canvas');
    layer.width = Math.round(W * k);
    layer.height = Math.round(H * k);
    const g = layer.getContext('2d');
    g.scale(k, k);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c1024');
    bg.addColorStop(1, '#06070f');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7);
    glow.addColorStop(0, 'rgba(' + PLAYERS[p].rgb + ',0.10)');
    glow.addColorStop(1, 'rgba(' + PLAYERS[p].rgb + ',0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(' + PLAYERS[p].rgb + ',0.55)';
    g.lineWidth = 1.4;
    g.shadowColor = 'rgba(' + PLAYERS[p].rgb + ',0.9)';
    g.shadowBlur = 7 * k;
    g.beginPath();
    for (let x = 0; x <= cols; x++) {
      const px = Math.min(W - 0.7, Math.max(0.7, x * CELL));
      g.moveTo(px, 0);
      g.lineTo(px, H);
    }
    for (let y = 0; y <= rows; y++) {
      const py = Math.min(H - 0.7, Math.max(0.7, y * CELL));
      g.moveTo(0, py);
      g.lineTo(W, py);
    }
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(' + PLAYERS[p].rgb + ',0.9)';
    for (let y = 1; y < rows; y++) for (let x = 1; x < cols; x++) g.fillRect(x * CELL - 1.5, y * CELL - 1.5, 3, 3);
    gridCache.set(key, layer);
    return layer;
  }

  function drawCellOrbs(i, count, owner, now, k, skip) {
    if (count <= skip || owner < 0) return;
    const shown = Math.min(4, count - skip);
    const crit = game.geo.critical[i];
    const primed = count >= crit - 1 && phase !== 'menu';
    const [cx, cy] = center(i);
    const speed = count >= crit ? 7 : primed ? 2.8 : 0.7;
    const angle = now * 0.001 * speed + i * 1.7;
    const jitter = count >= crit ? 2.2 : primed ? 1.1 : 0;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const [ox, oy] of LAYOUTS[shown]) {
      const rx = (ox * cos - oy * sin) * ORB_R, ry = (ox * sin + oy * cos) * ORB_R;
      const jx = jitter ? (Math.random() - 0.5) * jitter * 2 : 0, jy = jitter ? (Math.random() - 0.5) * jitter * 2 : 0;
      drawOrb(owner, cx + rx + jx, cy + ry + jy, k);
    }
  }

  function render(now) {
    if (!game) return;
    const k = ctx.getTransform().a || 1;
    const { cols, rows, n, critical, neighbors } = game.geo;
    const W = cols * CELL, H = rows * CELL;
    ctx.save();
    if (shakeTime > 0) {
      const m = shakeAmp * (shakeTime / shakeMax);
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
    }
    if (gridT < 1 && gridFrom !== gridTo) {
      ctx.drawImage(gridLayer(gridFrom, k), 0, 0, W, H);
      ctx.globalAlpha = gridT;
      ctx.drawImage(gridLayer(gridTo, k), 0, 0, W, H);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(gridLayer(gridTo, k), 0, 0, W, H);
    }
    const focus = cursor >= 0 ? cursor : hover;
    if (focus >= 0 && humanTurn()) {
      const ok = Core.legal(game, focus);
      const fx0 = (focus % cols) * CELL, fy0 = Math.floor(focus / cols) * CELL;
      ctx.fillStyle = ok ? 'rgba(' + PLAYERS[game.turn].rgb + ',0.14)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(fx0 + 2, fy0 + 2, CELL - 4, CELL - 4);
      if (ok || cursor >= 0) {
        ctx.strokeStyle = ok ? 'rgba(' + PLAYERS[game.turn].rgb + ',0.8)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(fx0 + 3, fy0 + 3, CELL - 6, CELL - 6);
      }
    }
    if (lastMove >= 0 && phase !== 'menu') {
      const [lx, ly] = center(lastMove);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(lx, ly, CELL * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }
    const wave = anim && anim.waves[anim.index];
    const exploding = wave ? new Set(wave.cells) : null;
    for (let i = 0; i < n; i++) {
      const skip = exploding && exploding.has(i) ? critical[i] : 0;
      drawCellOrbs(i, view.count[i], view.owner[i], now, k, skip);
    }
    if (wave) {
      const t = Math.min(1, anim.t / waveDuration(anim.index));
      const e = 1 - Math.pow(1 - t, 3);
      for (const i of wave.cells) {
        const [sx, sy] = center(i);
        for (const j of neighbors[i]) {
          const [tx, ty] = center(j);
          const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e;
          ctx.globalAlpha = 0.35;
          drawOrb(anim.player, sx + (tx - sx) * e * 0.6, sy + (ty - sy) * e * 0.6, k, 0.8);
          ctx.globalAlpha = 1;
          drawOrb(anim.player, x, y, k);
        }
      }
    }
    drawFx(k);
    if (chainBanner) {
      const a = Math.min(1, chainBanner.life / 300);
      const s = 1 + chainBanner.pop * 0.25;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, H * 0.12);
      ctx.scale(s, s);
      ctx.font = '900 30px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = PLAYERS[chainBanner.color].color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(5,6,16,0.85)';
      const label = 'CHAIN \u00D7' + chainBanner.n;
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = PLAYERS[chainBanner.color].color;
      ctx.fillText(label, 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(label, 0, -1);
      ctx.restore();
    }
    if (phase === 'over' && game.winner >= 0) {
      const pulse = 0.08 + 0.05 * Math.sin(now * 0.006);
      ctx.fillStyle = 'rgba(' + PLAYERS[game.winner].rgb + ',' + pulse + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function drawFx(k) {
    for (const f of fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.k === 'ring') {
        const r = CELL * (0.15 + (1 - a) * 0.75);
        ctx.strokeStyle = 'rgba(' + PLAYERS[f.color].rgb + ',' + a + ')';
        ctx.lineWidth = 3 * a + 0.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + 0.35 * a * a + ')';
        ctx.beginPath();
        ctx.arc(f.x, f.y, CELL * 0.3 * a, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.k === 'pop') {
        const [cx, cy] = center(f.cell);
        ctx.strokeStyle = 'rgba(' + PLAYERS[f.color].rgb + ',' + 0.7 * a + ')';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - CELL / 2 + 3 + (1 - a) * 4, cy - CELL / 2 + 3 + (1 - a) * 4, CELL - 6 - (1 - a) * 8, CELL - 6 - (1 - a) * 8);
      } else if (f.k === 'banner') {
        const age = f.max - f.life;
        const s = age < 160 ? 0.6 + 0.4 * (age / 160) : 1;
        const { cols, rows } = game.geo;
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life / 300);
        ctx.translate(cols * CELL / 2, rows * CELL / 2);
        ctx.scale(s, s);
        ctx.font = '900 28px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = PLAYERS[f.color].color;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(5,6,16,0.9)';
        ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = PLAYERS[f.color].color;
        ctx.fillText(f.text, 0, 0);
        ctx.restore();
      } else if (f.k === 'deny') {
        const [cx, cy] = center(f.cell);
        const dx = Math.sin((1 - a) * Math.PI * 6) * 4 * a;
        ctx.strokeStyle = 'rgba(255,255,255,' + 0.6 * a + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 9 + dx, cy - 9);
        ctx.lineTo(cx + 9 + dx, cy + 9);
        ctx.moveTo(cx + 9 + dx, cy - 9);
        ctx.lineTo(cx - 9 + dx, cy + 9);
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fx) {
      if (f.k !== 'spark') continue;
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.5);
      ctx.fillStyle = f.color;
      ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    }
    ctx.restore();
  }

  function update(dt) {
    const step = dt / 16.67;
    for (const f of fx) {
      f.life -= dt;
      if (f.k === 'spark') {
        f.x += f.vx * step;
        f.y += f.vy * step;
        f.vy += 0.08 * step;
        f.vx *= Math.pow(0.96, step);
      }
    }
    fx = fx.filter(f => f.life > 0);
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    if (gridT < 1) gridT = Math.min(1, gridT + dt / 260);
    if (chainBanner) {
      chainBanner.pop = Math.max(0, chainBanner.pop - dt / 200);
      if (!anim) chainBanner.life -= dt;
      if (chainBanner.life <= 0) chainBanner = null;
    }
    if (anim) {
      anim.t += dt * anim.speed;
      while (anim && anim.index < anim.waves.length && anim.t >= waveDuration(anim.index)) {
        anim.t -= waveDuration(anim.index);
        applyWave(anim.waves[anim.index]);
        anim.index++;
        if (anim.index >= anim.waves.length) finishMove();
      }
    }
  }

  function frame(now) {
    const dt = Math.min(now - lastTime, 100);
    lastTime = now;
    update(dt);
    render(now);
    Sound.update();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (anim) { anim.speed = 4; return; }
    cursor = -1;
    tryMove(cellAt(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !game) return;
    const c = cellAt(e.clientX, e.clientY);
    if (c !== hover) { hover = c; cursor = -1; }
  });
  canvas.addEventListener('pointerleave', () => { hover = -1; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  document.querySelectorAll('#mode-picker .chip').forEach(b => b.addEventListener('click', () => {
    settings.mode = b.dataset.mode;
    saveSettings();
    syncPickers();
    if (phase === 'menu') showMenu();
  }));
  document.querySelectorAll('#level-picker .chip').forEach(b => b.addEventListener('click', () => { settings.level = b.dataset.level; saveSettings(); syncPickers(); }));
  document.querySelectorAll('#count-picker .chip').forEach(b => b.addEventListener('click', () => {
    settings.players = Number(b.dataset.count);
    saveSettings();
    syncPickers();
    if (phase === 'menu') showMenu();
  }));
  document.querySelectorAll('#size-picker .chip').forEach(b => b.addEventListener('click', () => {
    settings.size = b.dataset.size;
    saveSettings();
    syncPickers();
    if (phase === 'menu') showMenu();
  }));
  startBtn.addEventListener('click', () => { GameEngine.audio(); startGame(); });
  undoBtn.addEventListener('click', undo);
  newBtn.addEventListener('click', () => {
    clearTimeout(cpuTimer);
    clearTimeout(overlayTimer);
    cpuTimer = overlayTimer = null;
    anim = null;
    if (phase === 'play' && window.GamePlatform) GamePlatform.stopTimer();
    Sound.music.stop();
    showMenu();
  });

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

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'm' || e.key === 'M') {
      if (!e.repeat) toggleMusic();
      return;
    }
    if (phase !== 'play') {
      if ((e.key === 'Enter' || e.key === ' ') && !overlay.classList.contains('hidden') && !(e.target && e.target.closest && e.target.closest('button'))) {
        e.preventDefault();
        GameEngine.audio();
        startGame();
      }
      return;
    }
    if (anim && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); anim.speed = 4; return; }
    const { cols, rows } = game.geo;
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      if (cursor < 0) cursor = hover >= 0 ? hover : Math.floor(rows / 2) * cols + Math.floor(cols / 2);
      else {
        const x = Math.max(0, Math.min(cols - 1, cursor % cols + moves[e.key][0]));
        const y = Math.max(0, Math.min(rows - 1, Math.floor(cursor / cols) + moves[e.key][1]));
        cursor = y * cols + x;
      }
    } else if ((e.key === 'Enter' || e.key === ' ') && cursor >= 0) {
      e.preventDefault();
      tryMove(cursor);
    } else if (e.key === 'u' || e.key === 'U') {
      undo();
    }
  });

  if (window.GamePlatform) {
    GamePlatform.initHeader('Chain Reaction');
  }
  addMusicButton();
  showMenu();
  lastTime = performance.now();
  requestAnimationFrame(frame);
  GameEngine.pausable({ isActive: () => phase === 'play', container: '#game-wrap' });
})();
