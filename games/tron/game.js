(function() {
  'use strict';

  const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame, performance } = GameEngine.clock;

  // ── DOM ──
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  GameEngine.sharpCanvas(canvas);
  const p1ScoreEl = document.getElementById('p1-score');
  const p2ScoreEl = document.getElementById('p2-score');
  const roundInfoEl = document.getElementById('round-info');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start-btn');
  const overlaySub = document.getElementById('overlay-sub');
  const roundOverlay = document.getElementById('round-overlay');
  const roundTitle = document.getElementById('round-title');
  const roundMsg = document.getElementById('round-msg');
  const modeChips = overlay.querySelectorAll('.mode-chip[data-mode]');
  const levelChips = overlay.querySelectorAll('.mode-chip[data-level]');
  const levelRow = document.getElementById('level-row');
  const p1Label = document.getElementById('p1-label');
  const p1Keys = document.getElementById('p1-keys');
  const p2Label = document.getElementById('p2-label');
  const p2Keys = document.getElementById('p2-keys');

  // ── Constants ──
  const W = canvas.width;
  const H = canvas.height;
  const CELL = 6;
  const COLS = W / CELL;
  const ROWS = H / CELL;
  const TICK_MS = 55;
  const ROUNDS_TO_WIN = 5;
  const COUNTDOWN_SECS = 3;

  const P1_COLOR = '#00f0ff';
  const P1_TRAIL = 'rgba(0, 240, 255, 0.55)';
  const P2_COLOR = '#e040fb';
  const P2_TRAIL = 'rgba(224, 64, 251, 0.55)';

  const DIRS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  const OPPOSITE = { up:'down', down:'up', left:'right', right:'left' };
  const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  const ai = window.TronAI ? TronAI.create(COLS, ROWS) : null;
  let vsCpu = !!ai && localStorage.getItem('tron_mode') !== 'pvp';
  let cpuLevel = LEVEL_NAMES[localStorage.getItem('tron_level')] ? localStorage.getItem('tron_level') : 'medium';

  // ── Audio ──
  function ensureAudio() {
    return GameEngine.audio();
  }
  const Sound = window.TronAudio;
  function sfxCountdown() { Sound.sfx('countdown'); }
  function sfxGo()        { Sound.sfx('go'); }
  function sfxCrash()     { Sound.sfx('crash'); }
  function sfxWinRound(lost) { Sound.sfx(lost ? 'roundLose' : 'roundWin'); }
  function sfxMatchWin()  { Sound.sfx('matchWin'); }
  function sfxMatchLose() { Sound.sfx('matchLose'); }

  // ── Particles ──
  const fx = TronFX.create(canvas, ctx, { cell: CELL, tickMs: TICK_MS, colors: [P1_COLOR, P2_COLOR], now: () => performance.now() });

  // ── Game State ──
  let grid, players, scores, round, tickInterval, gameRunning, animId;
  let p1NextDir = null, p2NextDir = null;

  // ── Input ──
  document.addEventListener('keydown', e => {
    // Player 1: WASD
    const p1Map = { w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right' };
    // Player 2: Arrow keys
    const p2Map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };

    if (p1Map[e.key]) {
      e.preventDefault();
      const dir = p1Map[e.key];
      if (players && players[0] && OPPOSITE[dir] !== players[0].dir) p1NextDir = dir;
    }
    if (p2Map[e.key]) {
      e.preventDefault();
      const dir = p2Map[e.key];
      if (vsCpu) {
        if (players && players[0] && OPPOSITE[dir] !== players[0].dir) p1NextDir = dir;
      } else if (players && players[1] && OPPOSITE[dir] !== players[1].dir) {
        p2NextDir = dir;
      }
    }
  });

  // ── Start ──
  let startDebounce = false;
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (startDebounce) return;
    startDebounce = true;
    setTimeout(() => { startDebounce = false; }, 500);
    ensureAudio();
    scores = [0, 0];
    round = 1;
    updateHUD();
    overlay.classList.add('hidden');
    document.getElementById('controls-info').style.display = '';
    Sound.music.start();
    startRound();
  });

  // ── Touch Controls (swipe-based, split screen for 2 players) ──
  let touchStarts = {}; // track per-identifier

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      touchStarts[t.identifier] = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const threshold = 20;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const start = touchStarts[t.identifier];
      if (!start) continue;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) continue;

      let dir;
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx > 0 ? 'right' : 'left';
      } else {
        dir = dy > 0 ? 'down' : 'up';
      }

      // Determine which player based on touch position (left half = P1, right half = P2)
      if (vsCpu || start.x < midX) {
        // Player 1
        if (players && players[0] && OPPOSITE[dir] !== players[0].dir) p1NextDir = dir;
      } else {
        // Player 2
        if (players && players[1] && OPPOSITE[dir] !== players[1].dir) p2NextDir = dir;
      }

      // Reset start position for continuous swipe
      touchStarts[t.identifier] = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      delete touchStarts[e.changedTouches[i].identifier];
    }
  });

  canvas.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      delete touchStarts[e.changedTouches[i].identifier];
    }
  });

  // ── Game Init ──
  function initGrid() {
    grid = [];
    for (let y = 0; y < ROWS; y++) {
      grid[y] = [];
      for (let x = 0; x < COLS; x++) grid[y][x] = 0;
    }
  }

  function initPlayers() {
    players = [
      { x: Math.floor(COLS * 0.25), y: Math.floor(ROWS / 2), dir: 'right', alive: true },
      { x: Math.floor(COLS * 0.75), y: Math.floor(ROWS / 2), dir: 'left', alive: true }
    ];
    grid[players[0].y][players[0].x] = 1;
    grid[players[1].y][players[1].x] = 2;
    p1NextDir = null;
    p2NextDir = null;
  }

  function startRound() {
    initGrid();
    initPlayers();
    fx.reset(players);
    gameRunning = false;
    updateHUD();
    render();

    // Countdown
    let count = COUNTDOWN_SECS;
    showRoundOverlay(count, '');
    sfxCountdown();

    const cdInterval = setInterval(() => {
      count--;
      if (count > 0) {
        showRoundOverlay(count, '');
        sfxCountdown();
      } else {
        clearInterval(cdInterval);
        sfxGo();
        Sound.engine(true);
        hideRoundOverlay();
        gameRunning = true;
        startGameLoop();
        requestAnimationFrame(renderLoop);
      }
    }, 1000);
  }

  // ── Game Loop ──
  function startGameLoop() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(tick, TICK_MS);
  }

  function stopGame() {
    gameRunning = false;
    Sound.engine(false);
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
  }

  function tick() {
    if (!gameRunning) return;

    if (vsCpu && ai && players[1].alive) {
      const dir = ai.choose(grid, players[1], players[0], cpuLevel);
      p2NextDir = OPPOSITE[dir] !== players[1].dir ? dir : null;
    }

    // Apply buffered inputs
    if (p1NextDir) { players[0].dir = p1NextDir; p1NextDir = null; }
    if (p2NextDir) { players[1].dir = p2NextDir; p2NextDir = null; }

    // Move players
    for (let i = 0; i < 2; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const d = DIRS[p.dir];
      p.x += d.x;
      p.y += d.y;
    }

    // Check collisions
    let crashPositions = [];

    for (let i = 0; i < 2; i++) {
      const p = players[i];
      if (!p.alive) continue;
      if (p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS) {
        p.alive = false;
        crashPositions.push({ x: Math.max(0, Math.min(COLS - 1, p.x)), y: Math.max(0, Math.min(ROWS - 1, p.y)), player: i });
        continue;
      }
      if (grid[p.y][p.x] !== 0) {
        p.alive = false;
        crashPositions.push({ x: p.x, y: p.y, player: i });
        continue;
      }
    }

    // Head-on collision
    if (players[0].alive && players[1].alive && players[0].x === players[1].x && players[0].y === players[1].y) {
      players[0].alive = false;
      players[1].alive = false;
      crashPositions.push({ x: players[0].x, y: players[0].y, player: 0 });
      crashPositions.push({ x: players[1].x, y: players[1].y, player: 1 });
    }

    for (let i = 0; i < 2; i++) {
      if (players[i].alive) grid[players[i].y][players[i].x] = i + 1;
    }
    fx.step(players);

    const p1Dead = !players[0].alive;
    const p2Dead = !players[1].alive;

    if (p1Dead || p2Dead) {
      stopGame();

      let roundWinner = -1;
      if (p1Dead && p2Dead) roundWinner = -1;
      else if (p2Dead) roundWinner = 0;
      else roundWinner = 1;

      if (roundWinner >= 0) scores[roundWinner]++;
      updateHUD();

      // Explosions
      for (const cp of crashPositions) {
        fx.explode(cp.x, cp.y, cp.player);
      }
      sfxCrash();

      // Check match win
      if (scores[0] >= ROUNDS_TO_WIN || scores[1] >= ROUNDS_TO_WIN) {
        const matchWinner = scores[0] >= ROUNDS_TO_WIN ? 0 : 1;
        setTimeout(() => handleMatchEnd(matchWinner), 1500);
        return;
      }

      // Next round
      let msg;
      if (roundWinner === -1) msg = 'Draw!';
      else if (vsCpu) msg = roundWinner === 0 ? 'You win the round!' : 'CPU wins the round!';
      else msg = 'Player ' + (roundWinner + 1) + ' wins!';
      const color = roundWinner === -1 ? '#ffd700' : (roundWinner === 0 ? P1_COLOR : P2_COLOR);

      setTimeout(() => {
        if (roundWinner >= 0) sfxWinRound(vsCpu && roundWinner === 1);
        showRoundOverlay(msg, 'Next round in 2s...', color);
        setTimeout(() => {
          round++;
          updateHUD();
          startRound();
        }, 2000);
      }, 800);
    }
  }

  function handleMatchEnd(winner) {
    if (vsCpu && winner === 1) sfxMatchLose(); else sfxMatchWin();
    Sound.music.stop();
    if (window.GamePlatform) {
      GamePlatform.recordGame('tron', scores[0], 0, { win: winner === 0, mode: vsCpu ? 'cpu-' + cpuLevel : 'pvp' });
    }
    const title = vsCpu ? (winner === 0 ? 'You Win!' : 'CPU Wins!') : 'Player ' + (winner + 1) + ' Wins!';
    const sub = 'Final: ' + scores[0] + ' - ' + scores[1] + (vsCpu ? '  vs ' + LEVEL_NAMES[cpuLevel] + ' CPU' : '  (First to ' + ROUNDS_TO_WIN + ')');
    const color = winner === 0 ? P1_COLOR : P2_COLOR;

    // Show on main overlay with replay button
    overlay.querySelector('h1').textContent = title;
    overlay.querySelector('h1').style.background = color;
    overlay.querySelector('h1').style['-webkit-background-clip'] = 'text';
    overlay.querySelector('.tagline').textContent = sub;
    startBtn.textContent = 'Play Again';
    overlaySub.textContent = '';
    document.getElementById('controls-info').style.display = 'none';
    overlay.classList.remove('hidden');
    hideRoundOverlay();
  }

  // ── HUD ──
  function updateHUD() {
    p1ScoreEl.textContent = (vsCpu ? 'You: ' : 'P1: ') + (scores ? scores[0] : 0);
    p2ScoreEl.textContent = (vsCpu ? 'CPU: ' : 'P2: ') + (scores ? scores[1] : 0);
    roundInfoEl.textContent = 'Round ' + (round || 1);
  }

  function applyMode() {
    modeChips.forEach(c => c.classList.toggle('selected', (c.dataset.mode === 'cpu') === vsCpu));
    levelChips.forEach(c => c.classList.toggle('selected', c.dataset.level === cpuLevel));
    levelRow.hidden = !vsCpu;
    p1Label.textContent = vsCpu ? 'You' : 'Player 1';
    p1Keys.textContent = vsCpu ? 'WASD / Arrows' : 'W A S D';
    p2Label.textContent = vsCpu ? 'Computer' : 'Player 2';
    p2Keys.textContent = vsCpu ? LEVEL_NAMES[cpuLevel] : 'Arrow Keys';
    updateHUD();
  }

  modeChips.forEach(chip => chip.addEventListener('click', () => {
    if (chip.dataset.mode === 'cpu' && !ai) return;
    vsCpu = chip.dataset.mode === 'cpu';
    localStorage.setItem('tron_mode', vsCpu ? 'cpu' : 'pvp');
    applyMode();
  }));
  levelChips.forEach(chip => chip.addEventListener('click', () => {
    cpuLevel = chip.dataset.level;
    localStorage.setItem('tron_level', cpuLevel);
    applyMode();
  }));

  // ── Overlays ──
  function showRoundOverlay(title, msg, color) {
    roundTitle.textContent = title;
    roundTitle.style.color = color || '';
    roundMsg.textContent = msg || '';
    roundOverlay.classList.remove('hidden');
  }
  function hideRoundOverlay() { roundOverlay.classList.add('hidden'); }

  // ── Rendering ──
  function renderLoop() {
    render();
    if (gameRunning || fx.busy()) {
      requestAnimationFrame(renderLoop);
    }
  }

  function render() {
    fx.draw(performance.now(), gameRunning);
  }

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
    if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggleMusic();
  });

  function audioLoop() {
    Sound.update();
    requestAnimationFrame(audioLoop);
  }

  // Initial render
  applyMode();
  render();

  if (window.GamePlatform) {
    GamePlatform.initHeader('Tron');
  }
  addMusicButton();
  requestAnimationFrame(audioLoop);
  GameEngine.pausable({ isActive: () => overlay.classList.contains('hidden'), container: '#game-container' });
})();
