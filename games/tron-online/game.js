(function () {
  'use strict';

  // ── DOM ──
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  GameEngine.sharpCanvas(canvas);
  const lobby = document.getElementById('lobby');
  const gameScreen = document.getElementById('game-screen');
  const btnHost = document.getElementById('btn-host');
  const btnJoin = document.getElementById('btn-join');
  const joinCodeInput = document.getElementById('join-code');
  const lobbyActions = document.getElementById('lobby-actions');
  const lobbyStatus = document.getElementById('lobby-status');
  const statusMsg = document.getElementById('status-msg');
  const roomCodeBox = document.getElementById('room-code-box');
  const roomCodeSpan = document.getElementById('room-code');
  const btnCopy = document.getElementById('btn-copy');
  const lobbyError = document.getElementById('lobby-error');
  const p1ScoreEl = document.getElementById('p1-score');
  const p2ScoreEl = document.getElementById('p2-score');
  const roundInfoEl = document.getElementById('round-info');
  const gameOverlay = document.getElementById('game-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');

  // ── Constants ──
  const W = canvas.width, H = canvas.height;
  const CELL = 6, COLS = W / CELL, ROWS = H / CELL;
  const TICK_MS = 55;
  const ROUNDS_TO_WIN = 5;
  const COUNTDOWN_SECS = 3;

  const P1_COLOR = '#00f0ff', P1_TRAIL = 'rgba(0,240,255,0.55)';
  const P2_COLOR = '#e040fb', P2_TRAIL = 'rgba(224,64,251,0.55)';

  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.relay.metered.ca:80' },
      { urls: 'turn:global.relay.metered.ca:80', username: '0571de5bc8f35b73b0fe8ec4', credential: 'mdERtNMft49guUrt' },
      { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '0571de5bc8f35b73b0fe8ec4', credential: 'mdERtNMft49guUrt' },
      { urls: 'turn:global.relay.metered.ca:443', username: '0571de5bc8f35b73b0fe8ec4', credential: 'mdERtNMft49guUrt' },
      { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '0571de5bc8f35b73b0fe8ec4', credential: 'mdERtNMft49guUrt' },
    ]
  };

  // ── Audio ──
  function ensureAudio() {
    return GameEngine.audio();
  }
  const Sound = window.TronAudio;
  function sfxCountdown() { Sound.sfx('countdown'); }
  function sfxGo() { Sound.sfx('go'); }
  function sfxCrash() { Sound.sfx('crash'); }
  function sfxWinRound(lost) { Sound.sfx(lost ? 'roundLose' : 'roundWin'); }
  function sfxMatchWin() { Sound.sfx('matchWin'); }

  // ── Particles ──
  const fx = TronFX.create(canvas, ctx, { cell: CELL, tickMs: TICK_MS, colors: [P1_COLOR, P2_COLOR] });
  let roundActive = false;

  // ── State ──
  let isHost = false, myPlayer = 0, peer, conn;
  let grid, players, scores = [0, 0], round = 1;
  let tickInterval, gameRunning = false, inputQueues = [[], []];

  function queueDir(pi, dir) {
    if (!players || !players[pi] || !DIRS[dir]) return;
    const q = inputQueues[pi];
    const last = q.length ? q[q.length - 1] : players[pi].dir;
    if (dir === last || OPPOSITE[dir] === last || q.length >= 2) return;
    q.push(dir);
  }

  // ── Latency / Interpolation ──
  let interpBuffer = { p: [{}, {}] };
  let lastTickTime = 0;
  let latency = 0, lastPingTime = 0;

  // ── Networking ──
  function genCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
    for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }

  function showError(m) { lobbyError.textContent = m; lobbyError.classList.remove('hidden'); }
  function hideError() { lobbyError.classList.add('hidden'); }

  btnHost.addEventListener('click', () => {
    ensureAudio(); hideError();
    const code = genCode();
    lobbyActions.classList.add('hidden');
    lobbyStatus.classList.remove('hidden');
    statusMsg.textContent = 'Connecting to server...';

    peer = new Peer('tronmp-' + code, { debug: 1, config: ICE_CONFIG });

    peer.on('open', () => {
      statusMsg.textContent = 'Waiting for opponent...';
      roomCodeBox.classList.remove('hidden');
      roomCodeSpan.textContent = code;
    });

    peer.on('connection', c => {
      conn = c; isHost = true; myPlayer = 0;
      wireConnection();
    });

    peer.on('disconnected', () => { statusMsg.textContent = 'Reconnecting...'; peer.reconnect(); });

    peer.on('error', err => {
      if (err.type === 'unavailable-id') { showError('Code taken, try again.'); resetLobby(); }
      else showError('Error: ' + err.type);
    });
  });

  btnJoin.addEventListener('click', () => {
    ensureAudio(); hideError();
    const code = joinCodeInput.value.trim().toUpperCase();
    if (code.length < 4) { showError('Enter a valid room code'); return; }

    lobbyActions.classList.add('hidden');
    lobbyStatus.classList.remove('hidden');
    statusMsg.textContent = 'Connecting...';

    peer = new Peer(undefined, { debug: 1, config: ICE_CONFIG });

    peer.on('open', () => {
      statusMsg.textContent = 'Joining room...';
      conn = peer.connect('tronmp-' + code, { reliable: true, serialization: 'json' });
      isHost = false; myPlayer = 1;
      wireConnection();
    });

    peer.on('error', err => {
      const msg = err.type === 'peer-unavailable' ? 'Room not found. Check the code.' : 'Error: ' + err.type;
      showError(msg); resetLobby();
    });

    setTimeout(() => {
      if (!conn || !conn.open) { showError('Connection timed out.'); resetLobby(); if (peer) peer.destroy(); }
    }, 20000);
  });

  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCodeSpan.textContent).then(() => {
      btnCopy.textContent = 'Copied!'; setTimeout(() => btnCopy.textContent = 'Copy', 2000);
    });
  });

  function resetLobby() {
    lobbyActions.classList.remove('hidden');
    lobbyStatus.classList.add('hidden');
    roomCodeBox.classList.add('hidden');
  }

  function onConnected() {
    lobby.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    scores = [0, 0]; round = 1;
    latency = 0; lastPingTime = 0;
    updateHUD();

    // Create latency display element
    if (!document.getElementById('latency-display')) {
      var latDisplay = document.createElement('span');
      latDisplay.id = 'latency-display';
      var hint = document.getElementById('controls-hint');
      if (hint) hint.appendChild(latDisplay);
    }

    if (isHost) startRound();
    Sound.music.start();
    requestAnimationFrame(renderLoop);
  }

  function wireConnection() {
    if (conn.open) onConnected();
    else conn.on('open', () => onConnected());

    conn.on('data', d => {
      if (d.t === 'tick') {
        // Store targets in interpolation buffer & update trail immediately
        for (let i = 0; i < 2; i++) {
          interpBuffer.p[i].targetX = d.p[i].x;
          interpBuffer.p[i].targetY = d.p[i].y;
          interpBuffer.p[i].dir = d.p[i].d;
          interpBuffer.p[i].alive = d.p[i].a;
          if (d.p[i].a && d.p[i].x >= 0 && d.p[i].x < COLS && d.p[i].y >= 0 && d.p[i].y < ROWS) {
            grid[d.p[i].y][d.p[i].x] = i + 1;
          }
        }
        // Apply positions
        for (let i = 0; i < 2; i++) {
          players[i].x = d.p[i].x;
          players[i].y = d.p[i].y;
          players[i].dir = d.p[i].d;
          players[i].alive = d.p[i].a;
        }
        fx.step(players);
        lastTickTime = performance.now();
      }
      else if (d.t === 'init') {
        // Full state on round start
        initGrid(); scores = d.sc; round = d.r;
        players = [
          { x: d.p[0].x, y: d.p[0].y, dir: d.p[0].d, alive: true },
          { x: d.p[1].x, y: d.p[1].y, dir: d.p[1].d, alive: true }
        ];
        grid[players[0].y][players[0].x] = 1;
        grid[players[1].y][players[1].x] = 2;
        fx.reset(players);
        updateHUD();
      }
      else if (d.t === 'd' && isHost) {
        queueDir(1, d.dir);
      }
      else if (d.t === 'cd') showCountdown(d.n);
      else if (d.t === 'go') { hideOverlay(); sfxGo(); roundActive = true; Sound.engine(true); }
      else if (d.t === 're') {
        // Sync scores from host so joiner HUD stays current
        if (d.sc) { scores = d.sc; updateHUD(); }
        handleRoundEnd(d.w, d.cp);
      }
      else if (d.t === 'me') handleMatchEnd(d.w);
      // ── Ping / Pong ──
      else if (d.t === 'ping') { send({ t: 'pong', ts: d.ts }); }
      else if (d.t === 'pong') { latency = Math.round((performance.now() - d.ts) / 2); }
      // ── Rematch ──
      else if (d.t === 'rematch' && isHost) {
        scores = [0, 0]; round = 1; updateHUD(); startRound(); Sound.music.start();
      }
    });

    conn.on('close', () => {
      stopGame();
      roundActive = false;
      Sound.engine(false);
      Sound.music.stop();
      clearMatchEndBtns();
      showOverlay('Disconnected', 'Opponent left', '#ff4d6d');
    });
    conn.on('error', err => { console.warn('Connection error:', err); });
  }

  function send(d) { try { if (conn && conn.open) conn.send(d); } catch (e) { console.warn('Send error:', e); } }

  function sendTick() {
    send({
      t: 'tick',
      p: [
        { x: players[0].x, y: players[0].y, d: players[0].dir, a: players[0].alive },
        { x: players[1].x, y: players[1].y, d: players[1].dir, a: players[1].alive }
      ]
    });
  }

  function sendInit() {
    send({
      t: 'init',
      p: [
        { x: players[0].x, y: players[0].y, d: players[0].dir },
        { x: players[1].x, y: players[1].y, d: players[1].dir }
      ],
      sc: scores, r: round
    });
  }

  // ── Game Init ──
  function initGrid() { grid = []; for (let y = 0; y < ROWS; y++) { grid[y] = []; for (let x = 0; x < COLS; x++) grid[y][x] = 0; } }

  function initPlayers() {
    players = [
      { x: Math.floor(COLS * 0.25), y: Math.floor(ROWS / 2), dir: 'right', alive: true },
      { x: Math.floor(COLS * 0.75), y: Math.floor(ROWS / 2), dir: 'left', alive: true }
    ];
    grid[players[0].y][players[0].x] = 1;
    grid[players[1].y][players[1].x] = 2;
  }

  function startRound() {
    initGrid(); initPlayers(); fx.reset(players);
    gameRunning = false; inputQueues = [[], []];
    updateHUD(); sendInit();

    let count = COUNTDOWN_SECS;
    showCountdown(count); send({ t: 'cd', n: count });

    const cd = setInterval(() => {
      count--;
      if (count > 0) { showCountdown(count); send({ t: 'cd', n: count }); }
      else {
        clearInterval(cd);
        hideOverlay(); send({ t: 'go' });
        sfxGo(); roundActive = true; Sound.engine(true);
        gameRunning = true;
        startGameLoop();
      }
    }, 1000);
  }

  function showCountdown(n) { sfxCountdown(); showOverlay(n, ''); }

  // ── Game Loop (host) ──
  function startGameLoop() { if (tickInterval) clearInterval(tickInterval); tickInterval = setInterval(tick, TICK_MS); }
  function stopGame() { gameRunning = false; if (tickInterval) { clearInterval(tickInterval); tickInterval = null; } }

  function tick() {
    if (!gameRunning) return;

    // Periodic ping to measure latency (~every 2s)
    if (isHost && performance.now() - lastPingTime > 2000) {
      lastPingTime = performance.now();
      send({ t: 'ping', ts: performance.now() });
    }

    // Host input
    for (let i = 0; i < 2; i++) if (inputQueues[i].length) players[i].dir = inputQueues[i].shift();

    // Move
    for (const p of players) { if (!p.alive) continue; const d = DIRS[p.dir]; p.x += d.x; p.y += d.y; }

    // Collisions
    const crashes = [];
    for (let i = 0; i < 2; i++) {
      const p = players[i]; if (!p.alive) continue;
      if (p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS) { p.alive = false; crashes.push({ x: Math.max(0, Math.min(COLS - 1, p.x)), y: Math.max(0, Math.min(ROWS - 1, p.y)), pi: i }); continue; }
      if (grid[p.y][p.x] !== 0) { p.alive = false; crashes.push({ x: p.x, y: p.y, pi: i }); continue; }
    }

    // Head-on
    if (players[0].alive && players[1].alive && players[0].x === players[1].x && players[0].y === players[1].y) {
      players[0].alive = players[1].alive = false;
      crashes.push({ x: players[0].x, y: players[0].y, pi: 0 }, { x: players[1].x, y: players[1].y, pi: 1 });
    }

    for (let i = 0; i < 2; i++) if (players[i].alive) grid[players[i].y][players[i].x] = i + 1;
    fx.step(players);

    if (!players[0].alive || !players[1].alive) {
      stopGame();
      let w = -1;
      if (!players[0].alive && !players[1].alive) w = -1;
      else if (!players[1].alive) w = 0;
      else w = 1;
      if (w >= 0) scores[w]++;
      updateHUD(); sendTick();
      send({ t: 're', w, cp: crashes, sc: scores.slice() });
      handleRoundEnd(w, crashes);
      return;
    }

    sendTick();
  }

  // ── Round / Match End ──
  function handleRoundEnd(w, crashes) {
    stopGame(); sfxCrash();
    roundActive = false;
    Sound.engine(false);
    if (crashes) for (const c of crashes) fx.explode(c.x, c.y, c.pi);

    if (scores[0] >= ROUNDS_TO_WIN || scores[1] >= ROUNDS_TO_WIN) {
      const mw = scores[0] >= ROUNDS_TO_WIN ? 0 : 1;
      setTimeout(() => { if (isHost) send({ t: 'me', w: mw }); handleMatchEnd(mw); }, 1500);
      return;
    }

    const isMe = w === myPlayer;
    let msg = w === -1 ? 'Draw!' : (isMe ? 'You won the round!' : 'You lost the round');
    if (w >= 0) sfxWinRound(!isMe);
    const color = w === -1 ? '#ffd700' : (w === 0 ? P1_COLOR : P2_COLOR);

    setTimeout(() => {
      showOverlay(msg, 'Next round in 3s...', color);
      setTimeout(() => { round++; updateHUD(); if (isHost) startRound(); }, 3000);
    }, 800);
  }

  function clearMatchEndBtns() {
    var old = document.getElementById('match-end-btns');
    if (old) old.remove();
  }

  function handleMatchEnd(w) {
    const isMe = w === myPlayer;
    if (isMe) sfxMatchWin(); else Sound.sfx('matchLose');
    Sound.music.stop();
    if (window.GamePlatform) {
      GamePlatform.recordGame('tron-online', scores[myPlayer], 0, { win: isMe });
    }

    showOverlay(
      isMe ? 'You Win!' : 'You Lose',
      scores[0] + ' - ' + scores[1] + '  (First to ' + ROUNDS_TO_WIN + ')',
      isMe ? '#ffd700' : '#ff4d6d'
    );

    // Remove any stale buttons
    clearMatchEndBtns();

    var btnContainer = document.createElement('div');
    btnContainer.id = 'match-end-btns';

    var rematchBtn = document.createElement('button');
    rematchBtn.textContent = 'Rematch';
    rematchBtn.className = 'btn btn-cyan';
    rematchBtn.onclick = function () {
      clearMatchEndBtns();
      scores = [0, 0]; round = 1;
      updateHUD();
      if (isHost) {
        startRound();
        Sound.music.start();
      } else {
        send({ t: 'rematch' });
        showOverlay('Waiting...', 'Waiting for host to start', '#888');
      }
    };

    var leaveBtn = document.createElement('button');
    leaveBtn.textContent = 'Leave';
    leaveBtn.className = 'btn btn-ghost';
    leaveBtn.onclick = function () {
      if (conn && conn.open) conn.close();
      if (peer) peer.destroy();
      location.reload();
    };

    btnContainer.appendChild(rematchBtn);
    btnContainer.appendChild(leaveBtn);
    gameOverlay.appendChild(btnContainer);
  }

  // ── HUD & Overlays ──
  function updateHUD() {
    p1ScoreEl.textContent = (myPlayer === 0 ? 'YOU' : 'OPP') + ': ' + scores[0];
    p2ScoreEl.textContent = (myPlayer === 1 ? 'YOU' : 'OPP') + ': ' + scores[1];
    roundInfoEl.textContent = 'Round ' + round;
  }

  function showOverlay(title, msg, color) {
    overlayTitle.textContent = title; overlayTitle.style.color = color || '';
    overlayMsg.textContent = msg || '';
    gameOverlay.classList.remove('hidden');
  }
  function hideOverlay() { gameOverlay.classList.add('hidden'); }

  // ── Input ──
  const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };

  document.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { toggleMusic(); return; }
    const dir = keyMap[e.key]; if (!dir) return;
    e.preventDefault();
    if (isHost) queueDir(0, dir);
    else send({ t: 'd', dir });
  });

  // Touch swipe
  let ts = null;
  canvas.addEventListener('touchstart', e => { e.preventDefault(); ts = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: false });
  canvas.addEventListener('touchend', e => {
    if (!ts) return;
    const dx = e.changedTouches[0].clientX - ts.x, dy = e.changedTouches[0].clientY - ts.y;
    ts = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (isHost) queueDir(0, dir); else send({ t: 'd', dir });
  }, { passive: false });

  // ── Render ──
  function renderLoop() {
    render(); updateLatencyDisplay();
    if (!gameScreen.classList.contains('hidden')) requestAnimationFrame(renderLoop);
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

  function audioLoop() {
    Sound.update();
    requestAnimationFrame(audioLoop);
  }

  function updateLatencyDisplay() {
    var latEl = document.getElementById('latency-display');
    if (!latEl) return;
    if (latency > 0) {
      latEl.className = latency < 50 ? 'lat-good' : latency < 100 ? 'lat-ok' : 'lat-bad';
      latEl.textContent = '\u25CF ' + latency + 'ms';
    } else {
      latEl.textContent = '';
    }
  }

  function render() {
    fx.draw(performance.now(), roundActive);
  }

  if (window.GamePlatform) {
    GamePlatform.initHeader('Tron Online');
  }
  addMusicButton();
  requestAnimationFrame(audioLoop);
})();
