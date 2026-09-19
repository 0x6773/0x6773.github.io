(function () {
  'use strict';

  // =====================================================================
  //  1. CONFIGURATION & CONSTANTS
  // =====================================================================

  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.relay.metered.ca:80' },
      { urls: 'turn:global.relay.metered.ca:80', username: '0571de5bc8f35b73b0fe8ec4', credential: 'mdERtNMft49guUrt' },
      { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '0571de5bc8f35b73b0fe8ec4', credential: 'mdERtNMft49guUrt' },
      { urls: 'turn:global.relay.metered.ca:443', username: '0571de5bc8f35b73b0fe8ec4', credential: 'mdERtNMft49guUrt' },
      { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '0571de5bc8f35b73b0fe8ec4', credential: 'mdERtNMft49guUrt' },
    ]
  };

  const CELL = 40;
  const BOARD = 600;
  const TOKEN_RADIUS = 14;
  const DICE_ANIM_MS = 800;
  const MOVE_ANIM_MS_PER_CELL = 100;
  const RECONNECT_HOLD_MS = 60000;

  const COLORS = {
    red:    { main: '#e74c3c', light: '#fadbd8', lighter: '#f9ebea', dark: '#c0392b', name: 'Red' },
    green:  { main: '#2ecc71', light: '#abebc6', lighter: '#e8f8f0', dark: '#27ae60', name: 'Green' },
    yellow: { main: '#f1c40f', light: '#f9e79f', lighter: '#fef9e7', dark: '#d4ac0f', name: 'Yellow' },
    blue:   { main: '#3498db', light: '#aed6f1', lighter: '#ebf5fb', dark: '#2980b9', name: 'Blue' }
  };

  const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'];
  const BOARD_BG = '#f5e6d3';

  // =====================================================================
  //  2. BOARD DEFINITIONS
  // =====================================================================

  // 52 shared cells going clockwise, starting from Red's entry
  const RING = [
    { r: 6, c: 1 }, { r: 6, c: 2 }, { r: 6, c: 3 }, { r: 6, c: 4 }, { r: 6, c: 5 },     // 0-4
    { r: 5, c: 6 }, { r: 4, c: 6 }, { r: 3, c: 6 }, { r: 2, c: 6 }, { r: 1, c: 6 },       // 5-9
    { r: 0, c: 6 },                                                                          // 10
    { r: 0, c: 7 },                                                                          // 11
    { r: 0, c: 8 }, { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 },       // 12-16
    { r: 5, c: 8 },                                                                          // 17
    { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 },   // 18-22
    { r: 6, c: 14 },                                                                         // 23
    { r: 7, c: 14 },                                                                         // 24
    { r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 }, { r: 8, c: 11 }, { r: 8, c: 10 },  // 25-29
    { r: 8, c: 9 },                                                                          // 30
    { r: 9, c: 8 }, { r: 10, c: 8 }, { r: 11, c: 8 }, { r: 12, c: 8 }, { r: 13, c: 8 },   // 31-35
    { r: 14, c: 8 },                                                                         // 36
    { r: 14, c: 7 },                                                                         // 37
    { r: 14, c: 6 }, { r: 13, c: 6 }, { r: 12, c: 6 }, { r: 11, c: 6 }, { r: 10, c: 6 },  // 38-42
    { r: 9, c: 6 },                                                                          // 43
    { r: 8, c: 5 }, { r: 8, c: 4 }, { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 },       // 44-48
    { r: 8, c: 0 },                                                                          // 49
    { r: 7, c: 0 },                                                                          // 50
    { r: 6, c: 0 }                                                                           // 51
  ];

  // Each player's start index on the ring
  const START_INDICES = { red: 0, green: 13, blue: 26, yellow: 39 };

  // Home columns (5 cells leading to center)
  const HOME_COLUMNS = {
    red:    [{ r: 7, c: 1 }, { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 }],
    green:  [{ r: 1, c: 7 }, { r: 2, c: 7 }, { r: 3, c: 7 }, { r: 4, c: 7 }, { r: 5, c: 7 }],
    blue:   [{ r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 }, { r: 7, c: 9 }],
    yellow: [{ r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 }, { r: 9, c: 7 }]
  };

  // Home base token starting positions (inside the colored corners)
  const HOME_BASES = {
    red:    [{ r: 1, c: 1 }, { r: 1, c: 4 }, { r: 4, c: 1 }, { r: 4, c: 4 }],
    green:  [{ r: 1, c: 10 }, { r: 1, c: 13 }, { r: 4, c: 10 }, { r: 4, c: 13 }],
    yellow: [{ r: 10, c: 1 }, { r: 10, c: 4 }, { r: 13, c: 1 }, { r: 13, c: 4 }],
    blue:   [{ r: 10, c: 10 }, { r: 10, c: 13 }, { r: 13, c: 10 }, { r: 13, c: 13 }]
  };

  // Safe zone ring indices (start cells + star cells)
  const SAFE_RING_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];
  const SAFE_CELLS = SAFE_RING_INDICES.map(function (i) { return RING[i]; });

  // Build full path for a color: 51 shared cells + 5 home column + center (57 total, indices 0-56)
  function buildPath(color) {
    var path = [];
    var start = START_INDICES[color];
    for (var i = 0; i <= 50; i++) {
      path.push(RING[(start + i) % 52]);
    }
    HOME_COLUMNS[color].forEach(function (cell) { path.push(cell); });
    path.push({ r: 7, c: 7 }); // center = done = index 56
    return path;
  }

  var PATHS = {};
  COLOR_ORDER.forEach(function (c) { PATHS[c] = buildPath(c); });

  // Map from ring index to which colors use it as their start
  var START_RING_SET = {};
  COLOR_ORDER.forEach(function (c) { START_RING_SET[START_INDICES[c]] = c; });

  // Determine home-column color for a cell {r,c} (or null)
  var homeColMap = {};
  COLOR_ORDER.forEach(function (c) {
    HOME_COLUMNS[c].forEach(function (cell) {
      homeColMap[cell.r + ',' + cell.c] = c;
    });
  });

  function isPathCell(r, c) {
    return (r >= 0 && r <= 14 && c >= 6 && c <= 8) ||
           (r >= 6 && r <= 8 && c >= 0 && c <= 14);
  }

  function isCenterCell(r, c) {
    return r >= 6 && r <= 8 && c >= 6 && c <= 8;
  }

  function isSafeCell(r, c) {
    if (!gameState.settings.safeZones) return false;
    return SAFE_CELLS.some(function (sc) { return sc.r === r && sc.c === c; });
  }

  function gridToPixel(r, c) {
    return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
  }

  // =====================================================================
  //  3. DOM REFERENCES
  // =====================================================================

  var DOM = {};
  function cacheDom() {
    DOM.lobby = document.getElementById('lobby');
    DOM.lobbyMain = document.getElementById('lobby-main');
    DOM.roomLobby = document.getElementById('room-lobby');
    DOM.btnCreate = document.getElementById('btn-create');
    DOM.btnJoin = document.getElementById('btn-join');
    DOM.joinCode = document.getElementById('join-code');
    DOM.lobbyError = document.getElementById('lobby-error');
    DOM.roomCode = document.getElementById('room-code');
    DOM.btnCopy = document.getElementById('btn-copy');
    DOM.playerName = document.getElementById('player-name');
    DOM.playerList = document.getElementById('player-list');
    DOM.colorPicker = document.getElementById('color-picker');
    DOM.hostSettings = document.getElementById('host-settings');
    DOM.btnStart = document.getElementById('btn-start');
    DOM.roomStatus = document.getElementById('room-status');

    DOM.gameScreen = document.getElementById('game-screen');
    DOM.gameHud = document.getElementById('game-hud');
    DOM.canvas = document.getElementById('boardCanvas');
    DOM.ctx = DOM.canvas.getContext('2d');
    DOM.diceFace = document.getElementById('dice-face');
    DOM.btnRoll = document.getElementById('btn-roll');
    DOM.toggleHints = document.getElementById('toggle-hints');
    DOM.gameLog = document.getElementById('game-log');
    DOM.chatMessages = document.getElementById('chat-messages');
    DOM.chatInput = document.getElementById('chat-input');
    DOM.btnChatSend = document.getElementById('btn-chat-send');
    DOM.emojiBar = document.getElementById('emoji-bar');
    DOM.gameOverlay = document.getElementById('game-overlay');
    DOM.overlayTitle = document.getElementById('overlay-title');
    DOM.overlayMsg = document.getElementById('overlay-msg');
    DOM.overlayActions = document.getElementById('overlay-actions');
    DOM.btnPause = document.getElementById('btn-pause');
    DOM.turnTimer = document.getElementById('turn-timer');
    DOM.timerText = document.getElementById('timer-text');
    DOM.reconnectBanner = document.getElementById('reconnect-banner');
    DOM.hudPlayers = document.getElementById('hud-players');
  }

  // =====================================================================
  //  4. GAME STATE
  // =====================================================================

  var gameState = {
    players: [],
    currentPlayer: 0,
    diceValue: null,
    rollsInTurn: 0,
    phase: 'waiting',
    settings: {
      numPlayers: 3,
      entryRule: '6only',
      captureBonus: true,
      tripleSix: false,
      tokensPerPlayer: 4,
      safeZones: true,
      turnTimer: 0,
      spectatorMode: false
    },
    winner: null
  };

  // Networking
  var isHost = false;
  var myId = '';
  var myColor = '';
  var roomCode = '';
  var peer = null;
  var connections = new Map();   // peerId -> { conn, playerId }
  var spectators = new Map();    // peerId -> conn
  var disconnectTimers = {};     // playerId -> timeout

  // UI
  var showHints = true;
  var gameStarted = false;

  // Animation
  var diceAnim = null;           // { startTime, finalValue, callback }
  var moveAnim = null;           // { playerIdx, tokenIdx, cells, startTime, duration, callback }
  var floatingEmojis = [];       // { emoji, x, y, startTime }
  var renderRAF = null;

  // Timer
  var timerInterval = null;
  var timerRemaining = 0;
  var timerStartedAt = 0;

  // =====================================================================
  //  5. UTILITY FUNCTIONS
  // =====================================================================

  function generateCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function generateId() {
    return 'p_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  function cloneState(s) {
    return JSON.parse(JSON.stringify(s));
  }

  function showError(msg) {
    DOM.lobbyError.textContent = msg;
    show(DOM.lobbyError);
    setTimeout(function () { hide(DOM.lobbyError); }, 5000);
  }

  function myPlayerIndex() {
    for (var i = 0; i < gameState.players.length; i++) {
      if (gameState.players[i].id === myId) return i;
    }
    return -1;
  }

  function isMyTurn() {
    var idx = myPlayerIndex();
    return idx >= 0 && idx === gameState.currentPlayer;
  }

  function currentPlayerObj() {
    return gameState.players[gameState.currentPlayer] || null;
  }

  function getPlayerByColor(color) {
    for (var i = 0; i < gameState.players.length; i++) {
      if (gameState.players[i].color === color) return gameState.players[i];
    }
    return null;
  }

  function getPlayerIdx(playerId) {
    for (var i = 0; i < gameState.players.length; i++) {
      if (gameState.players[i].id === playerId) return i;
    }
    return -1;
  }

  // =====================================================================
  //  6. AUDIO (Web Audio API)
  // =====================================================================

  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, dur, type, vol) {
    try {
      var ctx = ensureAudio();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) { /* audio not available */ }
  }

  function playNoise(dur, vol) {
    try {
      var ctx = ensureAudio();
      var bufSize = ctx.sampleRate * dur;
      var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (e) { /* audio not available */ }
  }

  var SFX = {
    diceRoll: function () {
      for (var i = 0; i < 5; i++) {
        setTimeout(function () { playTone(800 + Math.random() * 400, 0.05, 'square', 0.06); }, i * 60);
      }
    },
    diceResult: function () {
      playTone(660, 0.15, 'sine', 0.15);
    },
    tokenMove: function () {
      playTone(520, 0.08, 'sine', 0.08);
    },
    capture: function () {
      playTone(150, 0.4, 'sawtooth', 0.15);
      setTimeout(function () { playTone(100, 0.3, 'sawtooth', 0.1); }, 100);
    },
    tokenHome: function () {
      playTone(523, 0.15, 'sine', 0.12);
      setTimeout(function () { playTone(659, 0.15, 'sine', 0.12); }, 100);
      setTimeout(function () { playTone(784, 0.25, 'sine', 0.15); }, 200);
    },
    win: function () {
      var notes = [523, 587, 659, 784, 880, 1047];
      notes.forEach(function (n, i) {
        setTimeout(function () { playTone(n, 0.2, 'sine', 0.12); }, i * 120);
      });
    },
    chatMsg: function () {
      playTone(880, 0.1, 'sine', 0.08);
    },
    emojiPop: function () {
      playTone(1200, 0.08, 'sine', 0.1);
      playNoise(0.05, 0.05);
    },
    turnStart: function () {
      playTone(440, 0.1, 'triangle', 0.08);
      setTimeout(function () { playTone(550, 0.1, 'triangle', 0.08); }, 80);
    },
    timerTick: function () {
      playTone(1000, 0.05, 'square', 0.06);
    },
    error: function () {
      playTone(200, 0.2, 'sawtooth', 0.1);
    }
  };

  // =====================================================================
  //  7. CANVAS RENDERING
  // =====================================================================

  function drawBoard(ctx) {
    // Background
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, BOARD, BOARD);

    // Home bases (4 corners)
    drawHomeBase(ctx, 'red', 0, 0);
    drawHomeBase(ctx, 'green', 0, 9);
    drawHomeBase(ctx, 'yellow', 9, 0);
    drawHomeBase(ctx, 'blue', 9, 9);

    // Path cells (cross shape)
    for (var r = 0; r < 15; r++) {
      for (var c = 0; c < 15; c++) {
        if (!isPathCell(r, c)) continue;
        if (isCenterCell(r, c)) continue;
        var key = r + ',' + c;
        var hcColor = homeColMap[key];
        var x = c * CELL;
        var y = r * CELL;

        if (hcColor) {
          ctx.fillStyle = COLORS[hcColor].light;
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
      }
    }

    // Start position markers (colored cells)
    COLOR_ORDER.forEach(function (color) {
      var ri = START_INDICES[color];
      var cell = RING[ri];
      var x = cell.c * CELL;
      var y = cell.r * CELL;
      ctx.fillStyle = COLORS[color].light;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
      // Arrow marker
      ctx.fillStyle = COLORS[color].main;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var gp = gridToPixel(cell.r, cell.c);
      ctx.fillText('\u25B6', gp.x, gp.y);
    });

    // Center (4 colored triangles)
    drawCenter(ctx);

    // Safe zone stars
    if (gameState.settings.safeZones) {
      SAFE_CELLS.forEach(function (cell) {
        var gp = gridToPixel(cell.r, cell.c);
        drawStar(ctx, gp.x, gp.y, 5, 10, 5, 'rgba(0,0,0,0.15)');
      });
    }
  }

  function drawHomeBase(ctx, color, startRow, startCol) {
    var x = startCol * CELL;
    var y = startRow * CELL;
    var size = 6 * CELL;
    var colData = COLORS[color];

    // Outer colored area
    ctx.fillStyle = colData.lighter;
    ctx.beginPath();
    roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 12);
    ctx.fill();
    ctx.strokeStyle = colData.main;
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 12);
    ctx.stroke();

    // Inner white area
    var inset = CELL * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    roundRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, 8);
    ctx.fill();
    ctx.strokeStyle = colData.light;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, 8);
    ctx.stroke();

    // Token starting circles (empty slots)
    var bases = HOME_BASES[color];
    var numTokens = gameState.settings.tokensPerPlayer || 4;
    for (var i = 0; i < Math.min(numTokens, 4); i++) {
      var gp = gridToPixel(bases[i].r, bases[i].c);
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, TOKEN_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = colData.light;
      ctx.fill();
      ctx.strokeStyle = colData.main;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawCenter(ctx) {
    var cx = 7.5 * CELL;
    var cy = 7.5 * CELL;
    var left = 6 * CELL;
    var top = 6 * CELL;
    var right = 9 * CELL;
    var bottom = 9 * CELL;

    // Red triangle (left)
    ctx.fillStyle = COLORS.red.main;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(cx, cy);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();

    // Green triangle (top)
    ctx.fillStyle = COLORS.green.main;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(cx, cy);
    ctx.lineTo(right, top);
    ctx.closePath();
    ctx.fill();

    // Blue triangle (right)
    ctx.fillStyle = COLORS.blue.main;
    ctx.beginPath();
    ctx.moveTo(right, top);
    ctx.lineTo(cx, cy);
    ctx.lineTo(right, bottom);
    ctx.closePath();
    ctx.fill();

    // Yellow triangle (bottom)
    ctx.fillStyle = COLORS.yellow.main;
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(cx, cy);
    ctx.lineTo(right, bottom);
    ctx.closePath();
    ctx.fill();

    // Borders
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left, top, right - left, bottom - top);
    ctx.beginPath();
    ctx.moveTo(left, top); ctx.lineTo(right, bottom);
    ctx.moveTo(right, top); ctx.lineTo(left, bottom);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawStar(ctx, cx, cy, spikes, outerR, innerR, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    var rot = Math.PI / 2 * 3;
    var step = Math.PI / spikes;
    ctx.moveTo(cx, cy - outerR);
    for (var i = 0; i < spikes; i++) {
      var xo = cx + Math.cos(rot) * outerR;
      var yo = cy + Math.sin(rot) * outerR;
      ctx.lineTo(xo, yo);
      rot += step;
      xo = cx + Math.cos(rot) * innerR;
      yo = cy + Math.sin(rot) * innerR;
      ctx.lineTo(xo, yo);
      rot += step;
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }

  function drawTokens(ctx) {
    // Collect all token positions to handle stacking
    var cellTokens = {};

    gameState.players.forEach(function (player, pi) {
      player.tokens.forEach(function (token, ti) {
        var pos;
        // Skip tokens being animated
        if (moveAnim && moveAnim.playerIdx === pi && moveAnim.tokenIdx === ti) return;

        if (token.pathIndex === -1) {
          var base = HOME_BASES[player.color];
          if (ti < base.length) {
            pos = gridToPixel(base[ti].r, base[ti].c);
          }
        } else if (token.pathIndex >= 56) {
          pos = gridToPixel(7, 7);
        } else {
          var path = PATHS[player.color];
          if (path[token.pathIndex]) {
            var cell = path[token.pathIndex];
            pos = gridToPixel(cell.r, cell.c);
          }
        }

        if (pos) {
          var key = Math.round(pos.x) + ',' + Math.round(pos.y);
          if (!cellTokens[key]) cellTokens[key] = [];
          cellTokens[key].push({ pi: pi, ti: ti, color: player.color, pos: pos });
        }
      });
    });

    // Draw tokens with stacking offsets
    Object.keys(cellTokens).forEach(function (key) {
      var tokens = cellTokens[key];
      var offsets = getStackOffsets(tokens.length);
      tokens.forEach(function (tok, i) {
        var ox = tok.pos.x + offsets[i].dx;
        var oy = tok.pos.y + offsets[i].dy;
        drawToken(ctx, ox, oy, tok.color, tok.pi, tok.ti);
      });
    });

    // Draw animated token
    if (moveAnim) {
      var now = performance.now();
      var elapsed = now - moveAnim.startTime;
      var progress = Math.min(elapsed / moveAnim.duration, 1);
      var cellIdx = Math.min(Math.floor(progress * moveAnim.cells.length), moveAnim.cells.length - 1);
      var cell = moveAnim.cells[cellIdx];
      var pos = gridToPixel(cell.r, cell.c);
      var player = gameState.players[moveAnim.playerIdx];
      if (player) {
        drawToken(ctx, pos.x, pos.y, player.color, moveAnim.playerIdx, moveAnim.tokenIdx);
      }
      if (progress < 1) {
        if (cellIdx !== moveAnim._lastCell) {
          moveAnim._lastCell = cellIdx;
          SFX.tokenMove();
        }
      }
    }
  }

  function getStackOffsets(count) {
    if (count <= 1) return [{ dx: 0, dy: 0 }];
    if (count === 2) return [{ dx: -5, dy: -3 }, { dx: 5, dy: 3 }];
    if (count === 3) return [{ dx: -6, dy: -4 }, { dx: 6, dy: -4 }, { dx: 0, dy: 5 }];
    return [{ dx: -6, dy: -5 }, { dx: 6, dy: -5 }, { dx: -6, dy: 5 }, { dx: 6, dy: 5 }];
  }

  function drawToken(ctx, x, y, color, pi, ti) {
    var colData = COLORS[color];
    var isCurrentPlayer = pi === gameState.currentPlayer && gameState.phase !== 'waiting' && gameState.phase !== 'gameover';
    var radius = TOKEN_RADIUS;

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 1, y + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colData.main;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pulsing ring for current player's tokens (during moving phase)
    if (isCurrentPlayer && gameState.phase === 'moving' && isMyTurn()) {
      var validMoves = getValidMoves(gameState.currentPlayer, gameState.diceValue);
      var canMove = validMoves.some(function (m) { return m.tokenIdx === ti; });
      if (canMove) {
        var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.4 * pulse) + ')';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }

  function drawMoveHints(ctx) {
    if (!showHints || gameState.phase !== 'moving' || !isMyTurn()) return;
    var pi = myPlayerIndex();
    if (pi < 0) return;
    var player = gameState.players[pi];
    var moves = getValidMoves(pi, gameState.diceValue);
    var pulse = 0.3 + 0.3 * Math.sin(performance.now() / 300);

    moves.forEach(function (move) {
      var pos;
      if (move.action === 'enter') {
        var path = PATHS[player.color];
        pos = gridToPixel(path[0].r, path[0].c);
      } else {
        var path2 = PATHS[player.color];
        var cell = path2[move.newPathIndex];
        if (cell) pos = gridToPixel(cell.r, cell.c);
      }
      if (pos) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, CELL / 2 - 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(46, 204, 113, ' + pulse + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  function drawCurrentPlayerHighlight(ctx) {
    if (gameState.phase === 'waiting' || gameState.phase === 'gameover') return;
    var player = currentPlayerObj();
    if (!player) return;
    var color = player.color;
    var colData = COLORS[color];

    // Highlight the player's home base corner
    var corners = { red: [0, 0], green: [0, 9], yellow: [9, 0], blue: [9, 9] };
    var corner = corners[color];
    if (corner) {
      ctx.strokeStyle = colData.main;
      ctx.lineWidth = 3;
      var pulse = 0.6 + 0.4 * Math.sin(performance.now() / 400);
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      roundRect(ctx, corner[1] * CELL + 1, corner[0] * CELL + 1, 6 * CELL - 2, 6 * CELL - 2, 12);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawFloatingEmojis(ctx) {
    var now = performance.now();
    floatingEmojis = floatingEmojis.filter(function (fe) {
      var elapsed = now - fe.startTime;
      if (elapsed > 2000) return false;
      var progress = elapsed / 2000;
      var y = fe.y - progress * 80;
      var alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fe.emoji, fe.x, y);
      ctx.restore();
      return true;
    });
  }

  function render() {
    var ctx = DOM.ctx;
    if (!ctx) return;

    drawBoard(ctx);
    drawCurrentPlayerHighlight(ctx);
    drawMoveHints(ctx);
    drawTokens(ctx);
    drawFloatingEmojis(ctx);

    renderRAF = requestAnimationFrame(render);
  }

  function startRenderLoop() {
    if (renderRAF) cancelAnimationFrame(renderRAF);
    render();
  }

  function stopRenderLoop() {
    if (renderRAF) cancelAnimationFrame(renderRAF);
    renderRAF = null;
  }

  // =====================================================================
  //  8. GAME LOGIC
  // =====================================================================

  function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function getValidMoves(playerIdx, diceValue) {
    if (diceValue == null) return [];
    var player = gameState.players[playerIdx];
    if (!player) return [];
    var moves = [];
    var path = PATHS[player.color];

    for (var i = 0; i < player.tokens.length; i++) {
      var token = player.tokens[i];

      if (token.pathIndex === -1) {
        // Can enter with 6, or 1 if entry rule allows
        if (diceValue === 6 || (gameState.settings.entryRule === '1or6' && diceValue === 1)) {
          moves.push({ tokenIdx: i, action: 'enter', newPathIndex: 0 });
        }
      } else if (token.pathIndex < 56) {
        var newPos = token.pathIndex + diceValue;
        if (newPos <= 56) {
          moves.push({ tokenIdx: i, action: 'move', newPathIndex: newPos });
        }
      }
    }

    return moves;
  }

  function executeRoll(playerIdx) {
    if (gameState.phase !== 'rolling') return;
    var player = gameState.players[playerIdx];
    if (!player || playerIdx !== gameState.currentPlayer) return;

    var value = rollDice();
    gameState.diceValue = value;
    gameState.rollsInTurn++;

    // Triple-6 check
    if (gameState.settings.tripleSix && value === 6 && gameState.rollsInTurn >= 3) {
      addLog(player.name + ' rolled three 6s in a row! Turn lost.');
      gameState.phase = 'rolling';
      broadcastState({ type: 'roll', value: value });
      setTimeout(function () {
        advanceTurn();
      }, 1200);
      return;
    }

    var moves = getValidMoves(playerIdx, value);

    if (moves.length === 0) {
      gameState.phase = 'rolling'; // temporary for animation
      addLog(player.name + ' rolled ' + value + ' - no valid moves.');
      broadcastState({ type: 'roll', value: value });
      setTimeout(function () {
        advanceTurn();
      }, 1200);
      return;
    }

    if (moves.length === 1) {
      // Auto-select only move
      gameState.phase = 'moving';
      addLog(player.name + ' rolled ' + value + '.');
      broadcastState({ type: 'roll', value: value });
      setTimeout(function () {
        executeMove(playerIdx, moves[0].tokenIdx);
      }, DICE_ANIM_MS + 200);
      return;
    }

    gameState.phase = 'moving';
    addLog(player.name + ' rolled ' + value + '.');
    broadcastState({ type: 'roll', value: value });
    startTurnTimer();
  }

  function executeMove(playerIdx, tokenIdx) {
    if (gameState.phase !== 'moving' && gameState.phase !== 'rolling') return;
    var player = gameState.players[playerIdx];
    if (!player || playerIdx !== gameState.currentPlayer) return;

    var token = player.tokens[tokenIdx];
    if (!token) return;

    var diceValue = gameState.diceValue;
    var path = PATHS[player.color];
    var wasHome = token.pathIndex === -1;
    var oldPathIndex = token.pathIndex;
    var newPathIndex;
    var action;

    if (wasHome) {
      if (!(diceValue === 6 || (gameState.settings.entryRule === '1or6' && diceValue === 1))) return;
      newPathIndex = 0;
      action = 'enter';
    } else {
      newPathIndex = oldPathIndex + diceValue;
      if (newPathIndex > 56) return;
      action = 'move';
    }

    // Validate move
    var valid = getValidMoves(playerIdx, diceValue);
    if (!valid.some(function (m) { return m.tokenIdx === tokenIdx; })) return;

    // Build animation cells
    var animCells = [];
    if (wasHome) {
      var base = HOME_BASES[player.color][tokenIdx];
      if (base) animCells.push(base);
      animCells.push(path[0]);
    } else {
      for (var i = oldPathIndex; i <= newPathIndex && i < path.length; i++) {
        animCells.push(path[i]);
      }
    }

    // Apply move
    token.pathIndex = newPathIndex;
    gameState.phase = 'animating';

    var animDuration = animCells.length * MOVE_ANIM_MS_PER_CELL;

    // Start animation
    moveAnim = {
      playerIdx: playerIdx,
      tokenIdx: tokenIdx,
      cells: animCells,
      startTime: performance.now(),
      duration: Math.max(animDuration, 150),
      _lastCell: -1
    };

    broadcastState({ type: 'move', pi: playerIdx, ti: tokenIdx, from: oldPathIndex, to: newPathIndex, cells: animCells });

    setTimeout(function () {
      moveAnim = null;
      afterMove(playerIdx, tokenIdx, newPathIndex, wasHome, diceValue);
    }, animDuration + 50);
  }

  function afterMove(playerIdx, tokenIdx, newPathIndex, wasEntry, diceValue) {
    var player = gameState.players[playerIdx];
    if (!player) return;
    var path = PATHS[player.color];
    var gotExtraRoll = false;

    // Check for token reaching center (done)
    if (newPathIndex >= 56) {
      addLog(player.name + '\'s token reached home!');
      SFX.tokenHome();

      // Check for win
      var allDone = player.tokens.every(function (t) { return t.pathIndex >= 56; });
      if (allDone) {
        gameState.winner = playerIdx;
        gameState.phase = 'gameover';
        addLog(player.name + ' wins the game!');
        broadcastState({ type: 'win', pi: playerIdx });
        SFX.win();
        showWinOverlay(player);
        return;
      }
    }

    // Check for captures (only on shared path, indices 0-50)
    if (newPathIndex >= 0 && newPathIndex <= 50) {
      var landCell = path[newPathIndex];
      var isSafe = isSafeCell(landCell.r, landCell.c);

      if (!isSafe) {
        for (var oi = 0; oi < gameState.players.length; oi++) {
          if (oi === playerIdx) continue;
          var opp = gameState.players[oi];
          var oppPath = PATHS[opp.color];
          for (var oti = 0; oti < opp.tokens.length; oti++) {
            var oppToken = opp.tokens[oti];
            if (oppToken.pathIndex >= 0 && oppToken.pathIndex <= 50) {
              var oppCell = oppPath[oppToken.pathIndex];
              if (oppCell.r === landCell.r && oppCell.c === landCell.c) {
                oppToken.pathIndex = -1;
                addLog(player.name + ' captured ' + opp.name + '\'s token!');
                SFX.capture();
                if (gameState.settings.captureBonus) {
                  gotExtraRoll = true;
                }
              }
            }
          }
        }
      }
    }

    // Determine next action
    if (diceValue === 6 || gotExtraRoll) {
      // Extra roll (same player)
      gameState.phase = 'rolling';
      gameState.diceValue = null;
      broadcastState(null);
      startTurnTimer();
    } else {
      advanceTurn();
    }
  }

  function advanceTurn() {
    stopTurnTimer();
    var numPlayers = gameState.players.length;
    if (numPlayers === 0) return;

    var nextPlayer = (gameState.currentPlayer + 1) % numPlayers;
    var tries = 0;
    while (tries < numPlayers) {
      var p = gameState.players[nextPlayer];
      if (p && p.connected) break;
      nextPlayer = (nextPlayer + 1) % numPlayers;
      tries++;
    }

    gameState.currentPlayer = nextPlayer;
    gameState.diceValue = null;
    gameState.rollsInTurn = 0;
    gameState.phase = 'rolling';

    broadcastState(null);

    if (isMyTurn()) {
      SFX.turnStart();
    }
    startTurnTimer();
    updateUI();
  }

  function startTurnTimer() {
    stopTurnTimer();
    if (!isHost) return;
    var seconds = gameState.settings.turnTimer;
    if (!seconds || seconds <= 0) {
      hide(DOM.turnTimer);
      return;
    }
    timerRemaining = seconds;
    timerStartedAt = Date.now();
    show(DOM.turnTimer);
    updateTimerDisplay();
    timerInterval = setInterval(function () {
      timerRemaining = seconds - Math.floor((Date.now() - timerStartedAt) / 1000);
      if (timerRemaining < 0) timerRemaining = 0;
      updateTimerDisplay();
      if (timerRemaining <= 5 && timerRemaining > 0) SFX.timerTick();
      if (timerRemaining <= 0) {
        stopTurnTimer();
        if (isHost) {
          addLog(currentPlayerObj().name + '\'s turn timed out.');
          advanceTurn();
        }
      }
    }, 1000);
  }

  function stopTurnTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (DOM.timerText) DOM.timerText.textContent = timerRemaining;
    var total = gameState.settings.turnTimer || 30;
    var frac = timerRemaining / total;
    var fg = DOM.turnTimer ? DOM.turnTimer.querySelector('.timer-fg') : null;
    if (fg) {
      var circumference = 2 * Math.PI * 15.9;
      fg.style.strokeDasharray = circumference;
      fg.style.strokeDashoffset = circumference * (1 - frac);
      fg.style.stroke = timerRemaining <= 5 ? '#e74c3c' : '#00d4ff';
    }
    if (timerRemaining > 0) {
      show(DOM.turnTimer);
    }
  }

  // =====================================================================
  //  9. NETWORKING (PeerJS)
  // =====================================================================

  function initMyId() {
    myId = sessionStorage.getItem('ludo_myId');
    if (!myId) {
      myId = generateId();
      sessionStorage.setItem('ludo_myId', myId);
    }
  }

  function createRoom() {
    roomCode = generateCode();
    isHost = true;

    DOM.btnCreate.disabled = true;
    DOM.btnCreate.textContent = 'Creating...';

    var peerId = 'ludo-' + roomCode;
    peer = new Peer(peerId, { config: ICE_CONFIG });

    peer.on('open', function () {
      sessionStorage.setItem('ludo_room', roomCode);

      // Add host as first player
      var defaultColor = getNextAvailableColor();
      myColor = defaultColor;
      var hostName = DOM.playerName.value.trim() || 'Host';

      gameState.players = [{
        id: myId,
        name: hostName,
        color: defaultColor,
        tokens: createTokens(),
        connected: true,
        isHost: true
      }];

      showRoomLobby();
    });

    peer.on('connection', function (conn) {
      handleNewConnection(conn);
    });

    peer.on('error', function (err) {
      console.error('Peer error:', err);
      DOM.btnCreate.disabled = false;
      DOM.btnCreate.textContent = 'Create Game';
      showError('Failed to create room: ' + (err.type || err.message || 'unknown error'));
    });

    peer.on('disconnected', function () {
      if (gameStarted) {
        show(DOM.reconnectBanner);
        peer.reconnect();
      }
    });
  }

  function joinRoom(code) {
    roomCode = code.toUpperCase().trim();
    if (roomCode.length < 4) {
      showError('Please enter a valid room code.');
      return;
    }

    isHost = false;
    DOM.btnJoin.disabled = true;
    DOM.btnJoin.textContent = 'Joining...';

    var myPeerId = 'ludo-client-' + myId.substr(0, 8);
    peer = new Peer(myPeerId, { config: ICE_CONFIG });

    peer.on('open', function () {
      var hostId = 'ludo-' + roomCode;
      var conn = peer.connect(hostId, { reliable: true });

      conn.on('open', function () {
        connections.set('host', { conn: conn, playerId: null });
        sessionStorage.setItem('ludo_room', roomCode);

        var name = DOM.playerName.value.trim() || ('Player ' + (Math.floor(Math.random() * 900) + 100));
        conn.send({ t: 'join', name: name, id: myId });
      });

      conn.on('data', function (data) {
        handleClientMessage(data);
      });

      conn.on('close', function () {
        if (gameStarted) {
          show(DOM.reconnectBanner);
          setTimeout(function () { attemptReconnect(); }, 2000);
        }
      });

      conn.on('error', function (err) {
        console.error('Connection error:', err);
        showError('Connection error: ' + err.type);
      });

      // Timeout for connection
      setTimeout(function () {
        if (DOM.btnJoin.disabled && !gameState.players.length) {
          DOM.btnJoin.disabled = false;
          DOM.btnJoin.textContent = 'Join';
          showError('Could not connect. Check the room code.');
          if (peer) peer.destroy();
        }
      }, 10000);
    });

    peer.on('error', function (err) {
      console.error('Peer error:', err);
      DOM.btnJoin.disabled = false;
      DOM.btnJoin.textContent = 'Join';
      showError('Connection failed: ' + (err.type === 'peer-unavailable' ? 'Room not found' : err.type || 'unknown'));
    });

    peer.on('disconnected', function () {
      if (gameStarted) {
        show(DOM.reconnectBanner);
        setTimeout(function () { attemptReconnect(); }, 2000);
      }
    });
  }

  function handleNewConnection(conn) {
    conn.on('open', function () {
      conn.on('data', function (data) {
        handleHostMessage(data, conn);
      });

      conn.on('close', function () {
        handlePlayerDisconnect(conn);
      });
    });
  }

  function handleHostMessage(data, conn) {
    if (!data || !data.t) return;

    switch (data.t) {
      case 'join':
        handleJoinRequest(data, conn);
        break;
      case 'roll':
        var pi = getPlayerIdx(data.id);
        if (pi >= 0) executeRoll(pi);
        break;
      case 'move':
        var pi2 = getPlayerIdx(data.id);
        if (pi2 >= 0) executeMove(pi2, data.tokenIdx);
        break;
      case 'chat':
        var pi3 = getPlayerIdx(data.id);
        if (pi3 >= 0) {
          var player = gameState.players[pi3];
          addChatMessage(player.name, player.color, data.msg);
          broadcastToAll({ t: 'chat', name: player.name, color: player.color, msg: data.msg });
        }
        break;
      case 'emoji':
        var pi4 = getPlayerIdx(data.id);
        if (pi4 >= 0) {
          showEmojiReaction(data.e, pi4);
          broadcastToAll({ t: 'emoji', e: data.e, pi: pi4 });
        }
        break;
      case 'color':
        handleColorChange(data.id, data.c);
        break;
      case 'name':
        handleNameChange(data.id, data.n);
        break;
      case 'leave':
        handlePlayerLeave(data.id, conn);
        break;
    }
  }

  function handleClientMessage(data) {
    if (!data || !data.t) return;

    switch (data.t) {
      case 'state':
        applyState(data.s, data.action);
        break;
      case 'joined':
        myColor = data.color;
        showRoomLobby();
        break;
      case 'error':
        showError(data.msg);
        DOM.btnJoin.disabled = false;
        DOM.btnJoin.textContent = 'Join';
        break;
      case 'chat':
        addChatMessage(data.name, data.color, data.msg);
        SFX.chatMsg();
        break;
      case 'emoji':
        showEmojiReaction(data.e, data.pi);
        SFX.emojiPop();
        break;
      case 'log':
        appendLogEntry(data.msg);
        break;
      case 'kicked':
        showError('You have been kicked from the game.');
        resetToLobby();
        break;
      case 'start':
        gameStarted = true;
        showGameScreen();
        break;
    }
  }

  function handleJoinRequest(data, conn) {
    var maxPlayers = gameState.settings.numPlayers;
    var currentCount = gameState.players.length;

    // Check for reconnection
    var existingIdx = getPlayerIdx(data.id);
    if (existingIdx >= 0) {
      // Reconnecting player
      var existingPlayer = gameState.players[existingIdx];
      existingPlayer.connected = true;
      connections.set(data.id, { conn: conn, playerId: data.id });
      if (disconnectTimers[data.id]) {
        clearTimeout(disconnectTimers[data.id]);
        delete disconnectTimers[data.id];
      }
      addLog(existingPlayer.name + ' reconnected.');
      conn.send({ t: 'joined', color: existingPlayer.color });
      if (gameStarted) conn.send({ t: 'start' });
      broadcastState(null);
      return;
    }

    // New player
    if (currentCount >= maxPlayers) {
      if (gameState.settings.spectatorMode) {
        spectators.set(data.id, conn);
        conn.send({ t: 'joined', color: 'spectator' });
        conn.send({ t: 'state', s: cloneState(gameState), action: null });
        return;
      }
      conn.send({ t: 'error', msg: 'Room is full.' });
      return;
    }

    var desiredColor = getNextAvailableColor();
    var newPlayer = {
      id: data.id,
      name: data.name || ('Player ' + (currentCount + 1)),
      color: desiredColor,
      tokens: createTokens(),
      connected: true,
      isHost: false
    };

    gameState.players.push(newPlayer);
    connections.set(data.id, { conn: conn, playerId: data.id });

    addLog(newPlayer.name + ' joined.');
    conn.send({ t: 'joined', color: desiredColor });
    broadcastState(null);
    updateLobbyUI();
  }

  function handleColorChange(playerId, newColor) {
    // Check if color is available
    var taken = gameState.players.some(function (p) { return p.color === newColor && p.id !== playerId; });
    if (taken) return;

    var pi = getPlayerIdx(playerId);
    if (pi < 0) return;
    gameState.players[pi].color = newColor;
    gameState.players[pi].tokens = createTokens();
    broadcastState(null);
    updateLobbyUI();
  }

  function handleNameChange(playerId, newName) {
    var pi = getPlayerIdx(playerId);
    if (pi < 0) return;
    gameState.players[pi].name = (newName || '').trim().substring(0, 16) || gameState.players[pi].name;
    broadcastState(null);
    updateLobbyUI();
  }

  function handlePlayerDisconnect(conn) {
    var playerId = null;
    connections.forEach(function (val, key) {
      if (val.conn === conn) playerId = key;
    });
    if (!playerId) return;

    var pi = getPlayerIdx(playerId);
    if (pi < 0) {
      connections.delete(playerId);
      return;
    }

    gameState.players[pi].connected = false;
    addLog(gameState.players[pi].name + ' disconnected.');

    if (gameStarted) {
      // Hold spot for reconnection
      disconnectTimers[playerId] = setTimeout(function () {
        // Remove player after timeout
        handlePlayerLeave(playerId, conn);
      }, RECONNECT_HOLD_MS);
    } else {
      handlePlayerLeave(playerId, conn);
    }

    broadcastState(null);
    updateLobbyUI();
  }

  function handlePlayerLeave(playerId, conn) {
    var pi = getPlayerIdx(playerId);
    if (pi >= 0) {
      var name = gameState.players[pi].name;
      gameState.players.splice(pi, 1);
      addLog(name + ' left the game.');

      // Adjust current player index if needed
      if (gameStarted && gameState.currentPlayer >= gameState.players.length) {
        gameState.currentPlayer = 0;
      }
      if (gameStarted && pi <= gameState.currentPlayer && gameState.currentPlayer > 0) {
        gameState.currentPlayer--;
      }
    }
    connections.delete(playerId);
    if (disconnectTimers[playerId]) {
      clearTimeout(disconnectTimers[playerId]);
      delete disconnectTimers[playerId];
    }
    broadcastState(null);
    updateLobbyUI();
  }

  function kickPlayer(playerId) {
    if (!isHost) return;
    var entry = connections.get(playerId);
    if (entry && entry.conn) {
      entry.conn.send({ t: 'kicked' });
      setTimeout(function () {
        entry.conn.close();
        handlePlayerLeave(playerId);
      }, 200);
    }
  }

  function attemptReconnect() {
    if (!peer || peer.destroyed) {
      var myPeerId = 'ludo-client-' + myId.substr(0, 8);
      peer = new Peer(myPeerId, { config: ICE_CONFIG });
      peer.on('open', function () {
        connectToHost();
      });
      peer.on('error', function () {
        setTimeout(attemptReconnect, 3000);
      });
    } else if (peer.disconnected) {
      peer.reconnect();
      peer.on('open', function () {
        connectToHost();
      });
    } else {
      connectToHost();
    }
  }

  function connectToHost() {
    var hostId = 'ludo-' + roomCode;
    var conn = peer.connect(hostId, { reliable: true });

    conn.on('open', function () {
      connections.set('host', { conn: conn, playerId: null });
      conn.send({ t: 'join', name: gameState.players[myPlayerIndex()]?.name || 'Player', id: myId });
      hide(DOM.reconnectBanner);
    });

    conn.on('data', function (data) {
      handleClientMessage(data);
    });

    conn.on('close', function () {
      show(DOM.reconnectBanner);
      setTimeout(attemptReconnect, 3000);
    });
  }

  function broadcastState(action) {
    if (!isHost) return;
    var msg = { t: 'state', s: cloneState(gameState), action: action || null };
    connections.forEach(function (val) {
      if (val.conn && val.conn.open) {
        try { val.conn.send(msg); } catch (e) { /* ignore */ }
      }
    });
    spectators.forEach(function (conn) {
      if (conn && conn.open) {
        try { conn.send(msg); } catch (e) { /* ignore */ }
      }
    });
    updateUI();
  }

  function broadcastToAll(msg) {
    connections.forEach(function (val) {
      if (val.conn && val.conn.open) {
        try { val.conn.send(msg); } catch (e) { /* ignore */ }
      }
    });
    spectators.forEach(function (conn) {
      if (conn && conn.open) {
        try { conn.send(msg); } catch (e) { /* ignore */ }
      }
    });
  }

  function sendToHost(msg) {
    msg.id = myId;
    var host = connections.get('host');
    if (host && host.conn && host.conn.open) {
      host.conn.send(msg);
    }
  }

  function applyState(state, action) {
    if (!state) return;
    gameState = state;

    // Handle action-based animations
    if (action) {
      if (action.type === 'roll') {
        animateDice(action.value);
      }
      if (action.type === 'move' && action.cells) {
        moveAnim = {
          playerIdx: action.pi,
          tokenIdx: action.ti,
          cells: action.cells,
          startTime: performance.now(),
          duration: action.cells.length * MOVE_ANIM_MS_PER_CELL,
          _lastCell: -1
        };
        setTimeout(function () { moveAnim = null; }, action.cells.length * MOVE_ANIM_MS_PER_CELL + 50);
      }
      if (action.type === 'win') {
        SFX.win();
        showWinOverlay(gameState.players[action.pi]);
      }
    }

    // Update timer display
    if (gameState.settings.turnTimer > 0) {
      show(DOM.turnTimer);
    } else {
      hide(DOM.turnTimer);
    }

    updateUI();
  }

  function createTokens() {
    var tokens = [];
    var num = gameState.settings.tokensPerPlayer || 4;
    for (var i = 0; i < num; i++) {
      tokens.push({ pathIndex: -1 });
    }
    return tokens;
  }

  function getNextAvailableColor() {
    var taken = {};
    gameState.players.forEach(function (p) { taken[p.color] = true; });
    for (var i = 0; i < COLOR_ORDER.length; i++) {
      if (!taken[COLOR_ORDER[i]]) return COLOR_ORDER[i];
    }
    return COLOR_ORDER[0];
  }

  // =====================================================================
  //  10. DICE ANIMATION
  // =====================================================================

  function animateDice(finalValue) {
    SFX.diceRoll();
    diceAnim = {
      startTime: performance.now(),
      finalValue: finalValue
    };

    var interval = setInterval(function () {
      DOM.diceFace.textContent = Math.floor(Math.random() * 6) + 1;
      DOM.diceFace.classList.add('dice-rolling');
    }, 60);

    setTimeout(function () {
      clearInterval(interval);
      diceAnim = null;
      DOM.diceFace.textContent = finalValue;
      DOM.diceFace.classList.remove('dice-rolling');
      DOM.diceFace.classList.add('dice-landed');
      SFX.diceResult();
      setTimeout(function () { DOM.diceFace.classList.remove('dice-landed'); }, 300);
    }, DICE_ANIM_MS);
  }

  // =====================================================================
  //  11. LOBBY UI
  // =====================================================================

  function showRoomLobby() {
    hide(DOM.lobbyMain);
    show(DOM.roomLobby);
    DOM.roomCode.textContent = roomCode;
    DOM.btnCreate.disabled = false;
    DOM.btnCreate.textContent = 'Create Game';
    DOM.btnJoin.disabled = false;
    DOM.btnJoin.textContent = 'Join';

    if (isHost) {
      show(DOM.hostSettings);
      show(DOM.btnStart);
    } else {
      hide(DOM.hostSettings);
      hide(DOM.btnStart);
    }

    updateLobbyUI();
  }

  function updateLobbyUI() {
    // Update player list
    var slots = DOM.playerList.querySelectorAll('.player-slot');
    var numSlots = gameState.settings.numPlayers;

    slots.forEach(function (slot, idx) {
      var nameSpan = slot.querySelector('.player-slot-name');
      var swatch = slot.querySelector('.player-color-swatch');
      var hostBadge = slot.querySelector('.player-host-badge');
      var kickBtn = slot.querySelector('.btn-kick');

      if (idx >= numSlots) {
        hide(slot);
        return;
      }
      show(slot);

      if (idx < gameState.players.length) {
        var player = gameState.players[idx];
        nameSpan.textContent = player.name + (player.connected ? '' : ' (disconnected)');
        swatch.setAttribute('data-color', player.color);
        swatch.style.backgroundColor = COLORS[player.color].main;

        if (player.isHost) {
          show(hostBadge);
        } else {
          hide(hostBadge);
        }

        if (isHost && !player.isHost) {
          show(kickBtn);
          kickBtn.onclick = function () { kickPlayer(player.id); };
        } else {
          hide(kickBtn);
        }
      } else {
        nameSpan.textContent = 'Waiting...';
        swatch.style.backgroundColor = '#444';
        hide(hostBadge);
        hide(kickBtn);
      }
    });

    // Update color picker
    var colorBtns = DOM.colorPicker.querySelectorAll('.color-btn');
    var takenColors = {};
    gameState.players.forEach(function (p) { takenColors[p.color] = p.id; });

    colorBtns.forEach(function (btn) {
      var color = btn.getAttribute('data-color');
      var check = btn.querySelector('.color-check');
      var isMyColor = takenColors[color] === myId;
      var isTaken = takenColors[color] && takenColors[color] !== myId;

      btn.classList.toggle('selected', isMyColor);
      btn.classList.toggle('taken', isTaken);
      btn.disabled = isTaken;

      if (isMyColor) {
        show(check);
      } else {
        hide(check);
      }
    });

    // Update start button state
    if (isHost) {
      var canStart = gameState.players.length >= 2;
      DOM.btnStart.disabled = !canStart;
      DOM.roomStatus.textContent = canStart
        ? 'Ready to start! (' + gameState.players.length + '/' + gameState.settings.numPlayers + ' players)'
        : 'Waiting for players... (' + gameState.players.length + '/' + gameState.settings.numPlayers + ')';
    } else {
      DOM.roomStatus.textContent = 'Waiting for host to start... (' + gameState.players.length + '/' + gameState.settings.numPlayers + ')';
    }
  }

  function readSettings() {
    var settings = {};
    var groups = DOM.hostSettings.querySelectorAll('.btn-group');
    groups.forEach(function (group) {
      var settingName = group.getAttribute('data-setting');
      var activeBtn = group.querySelector('.btn-opt.active');
      if (!activeBtn || !settingName) return;
      var val = activeBtn.getAttribute('data-value');

      switch (settingName) {
        case 'numPlayers':
        case 'tokensPerPlayer':
        case 'turnTimer':
          settings[settingName] = parseInt(val, 10);
          break;
        case 'captureBonus':
        case 'tripleSix':
        case 'safeZones':
        case 'spectatorMode':
          settings[settingName] = val === 'on';
          break;
        case 'entryRule':
          settings[settingName] = val;
          break;
      }
    });
    return settings;
  }

  function applySettingsToUI() {
    var s = gameState.settings;
    var groups = DOM.hostSettings.querySelectorAll('.btn-group');
    groups.forEach(function (group) {
      var settingName = group.getAttribute('data-setting');
      if (!settingName) return;
      var val;
      switch (settingName) {
        case 'numPlayers': val = String(s.numPlayers); break;
        case 'tokensPerPlayer': val = String(s.tokensPerPlayer); break;
        case 'turnTimer': val = String(s.turnTimer); break;
        case 'captureBonus': val = s.captureBonus ? 'on' : 'off'; break;
        case 'tripleSix': val = s.tripleSix ? 'on' : 'off'; break;
        case 'safeZones': val = s.safeZones ? 'on' : 'off'; break;
        case 'spectatorMode': val = s.spectatorMode ? 'on' : 'off'; break;
        case 'entryRule': val = s.entryRule; break;
        default: return;
      }
      var btns = group.querySelectorAll('.btn-opt');
      btns.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-value') === val);
      });
    });
  }

  // =====================================================================
  //  12. GAME UI
  // =====================================================================

  function showGameScreen() {
    hide(DOM.lobby);
    show(DOM.gameScreen);
    gameStarted = true;
    startRenderLoop();
    updateUI();

    if (isHost) {
      show(DOM.btnPause);
    } else {
      hide(DOM.btnPause);
    }
  }

  function updateUI() {
    if (!gameStarted) {
      updateLobbyUI();
      return;
    }

    updateHUD();
    updateDiceUI();
  }

  function updateHUD() {
    var hudPlayers = DOM.hudPlayers.querySelectorAll('.hud-player');

    hudPlayers.forEach(function (hudEl, idx) {
      var color = hudEl.getAttribute('data-color');
      var player = getPlayerByColor(color);

      if (!player) {
        hudEl.style.display = 'none';
        return;
      }
      hudEl.style.display = '';

      var nameEl = hudEl.querySelector('.hud-name');
      var tokensEl = hudEl.querySelector('.hud-tokens');

      nameEl.textContent = player.name;

      var homeCount = 0, activeCount = 0, doneCount = 0;
      player.tokens.forEach(function (t) {
        if (t.pathIndex === -1) homeCount++;
        else if (t.pathIndex >= 56) doneCount++;
        else activeCount++;
      });
      tokensEl.textContent = 'H:' + homeCount + ' A:' + activeCount + ' D:' + doneCount;

      var pi = getPlayerIdx(player.id);
      hudEl.classList.toggle('active-turn', pi === gameState.currentPlayer && gameState.phase !== 'gameover');
      hudEl.classList.toggle('disconnected', !player.connected);
    });
  }

  function updateDiceUI() {
    var isMyRoll = isMyTurn() && gameState.phase === 'rolling';
    DOM.btnRoll.disabled = !isMyRoll;

    if (gameState.phase === 'gameover') {
      DOM.btnRoll.disabled = true;
    }

    if (!diceAnim && gameState.diceValue != null) {
      DOM.diceFace.textContent = gameState.diceValue;
    } else if (!diceAnim && gameState.diceValue == null) {
      DOM.diceFace.textContent = '?';
    }
  }

  function addLog(msg) {
    appendLogEntry(msg);
    if (isHost) {
      broadcastToAll({ t: 'log', msg: msg });
    }
  }

  function appendLogEntry(msg) {
    var el = document.createElement('div');
    el.className = 'log-entry';
    el.textContent = msg;
    DOM.gameLog.appendChild(el);
    DOM.gameLog.scrollTop = DOM.gameLog.scrollHeight;
  }

  function addChatMessage(name, color, msg) {
    var el = document.createElement('div');
    el.className = 'chat-msg';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    nameSpan.style.color = COLORS[color] ? COLORS[color].main : '#aaa';
    nameSpan.textContent = name + ': ';
    el.appendChild(nameSpan);
    el.appendChild(document.createTextNode(msg));
    DOM.chatMessages.appendChild(el);
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
  }

  function sendChat() {
    var msg = DOM.chatInput.value.trim();
    if (!msg) return;
    DOM.chatInput.value = '';

    var pi = myPlayerIndex();
    var player = pi >= 0 ? gameState.players[pi] : null;
    var name = player ? player.name : 'Spectator';
    var color = player ? player.color : 'red';

    addChatMessage(name, color, msg);

    if (isHost) {
      broadcastToAll({ t: 'chat', name: name, color: color, msg: msg });
    } else {
      sendToHost({ t: 'chat', msg: msg });
    }
  }

  function showEmojiReaction(emoji, playerIdx) {
    var emojiMap = {
      thumbsup: '\uD83D\uDC4D',
      clap: '\uD83D\uDC4F',
      laugh: '\uD83D\uDE02',
      cry: '\uD83D\uDE2D',
      angry: '\uD83D\uDE21',
      fire: '\uD83D\uDD25'
    };
    var char = emojiMap[emoji] || emoji;
    var x = 100 + Math.random() * 400;
    var y = 400 + Math.random() * 100;

    floatingEmojis.push({
      emoji: char,
      x: x,
      y: y,
      startTime: performance.now()
    });
  }

  function showWinOverlay(player) {
    if (window.GamePlatform) {
      var isWinner = gameState.winner === myPlayerIndex();
      GamePlatform.recordGame('ludo', 0, 0, { win: isWinner });
    }
    DOM.overlayTitle.textContent = player.name + ' Wins!';
    DOM.overlayMsg.textContent = 'All tokens have reached home. Congratulations!';
    DOM.overlayActions.innerHTML = '';

    if (isHost) {
      var rematchBtn = document.createElement('button');
      rematchBtn.className = 'btn btn-cyan';
      rematchBtn.textContent = 'Rematch';
      rematchBtn.onclick = function () {
        hideOverlay();
        startRematch();
      };
      DOM.overlayActions.appendChild(rematchBtn);
    }

    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-green';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = hideOverlay;
    DOM.overlayActions.appendChild(closeBtn);

    show(DOM.gameOverlay);
  }

  function showPauseOverlay() {
    DOM.overlayTitle.textContent = 'Game Paused';
    DOM.overlayMsg.textContent = isHost ? 'Click Resume to continue.' : 'Waiting for host to resume...';
    DOM.overlayActions.innerHTML = '';

    if (isHost) {
      var resumeBtn = document.createElement('button');
      resumeBtn.className = 'btn btn-cyan';
      resumeBtn.textContent = 'Resume';
      resumeBtn.onclick = function () {
        hideOverlay();
        togglePause();
      };
      DOM.overlayActions.appendChild(resumeBtn);
    }

    show(DOM.gameOverlay);
  }

  function hideOverlay() {
    hide(DOM.gameOverlay);
  }

  function togglePause() {
    if (!isHost) return;
    if (gameState.phase === 'paused') {
      gameState.phase = gameState._prePausePhase || 'rolling';
      delete gameState._prePausePhase;
      hideOverlay();
      broadcastState(null);
      startTurnTimer();
    } else {
      gameState._prePausePhase = gameState.phase;
      gameState.phase = 'paused';
      stopTurnTimer();
      broadcastState(null);
      showPauseOverlay();
    }
  }

  function startRematch() {
    if (!isHost) return;
    gameState.players.forEach(function (p) {
      p.tokens = createTokens();
    });
    gameState.currentPlayer = 0;
    gameState.diceValue = null;
    gameState.rollsInTurn = 0;
    gameState.phase = 'rolling';
    gameState.winner = null;
    addLog('--- Rematch started! ---');
    broadcastState(null);
  }

  function startGame() {
    if (!isHost) return;
    if (gameState.players.length < 2) {
      showError('Need at least 2 players to start.');
      return;
    }

    // Apply current settings
    gameState.settings = Object.assign({}, gameState.settings, readSettings());

    // Trim players to numPlayers setting
    while (gameState.players.length > gameState.settings.numPlayers) {
      var removed = gameState.players.pop();
      addLog(removed.name + ' was removed (too many players).');
    }

    // Ensure all players have correct number of tokens
    gameState.players.forEach(function (p) {
      p.tokens = createTokens();
    });

    gameState.phase = 'rolling';
    gameState.currentPlayer = 0;
    gameState.diceValue = null;
    gameState.rollsInTurn = 0;
    gameState.winner = null;

    addLog('Game started!');

    // Notify clients
    broadcastToAll({ t: 'start' });
    broadcastState(null);

    showGameScreen();
    startTurnTimer();
  }

  function resetToLobby() {
    gameStarted = false;
    stopRenderLoop();
    stopTurnTimer();
    hide(DOM.gameScreen);
    hide(DOM.gameOverlay);
    hide(DOM.reconnectBanner);
    show(DOM.lobby);
    show(DOM.lobbyMain);
    hide(DOM.roomLobby);
    gameState.players = [];
    gameState.phase = 'waiting';
    if (peer) {
      peer.destroy();
      peer = null;
    }
    connections.clear();
    spectators.clear();
  }

  // =====================================================================
  //  13. CANVAS INPUT HANDLING
  // =====================================================================

  function handleCanvasClick(e) {
    if (gameState.phase !== 'moving') return;
    if (!isMyTurn()) return;

    var rect = DOM.canvas.getBoundingClientRect();
    var scaleX = BOARD / rect.width;
    var scaleY = BOARD / rect.height;
    var clickX = (e.clientX - rect.left) * scaleX;
    var clickY = (e.clientY - rect.top) * scaleY;

    var pi = myPlayerIndex();
    if (pi < 0) return;
    var player = gameState.players[pi];
    var path = PATHS[player.color];
    var validMoves = getValidMoves(pi, gameState.diceValue);

    if (validMoves.length === 0) return;

    // Find closest token to click
    var bestDist = Infinity;
    var bestTokenIdx = -1;

    validMoves.forEach(function (move) {
      var token = player.tokens[move.tokenIdx];
      var pos;

      if (token.pathIndex === -1) {
        // Token is in home base
        var base = HOME_BASES[player.color][move.tokenIdx];
        if (base) pos = gridToPixel(base.r, base.c);
      } else {
        var cell = path[token.pathIndex];
        if (cell) pos = gridToPixel(cell.r, cell.c);
      }

      if (pos) {
        var dx = clickX - pos.x;
        var dy = clickY - pos.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist && dist < CELL) {
          bestDist = dist;
          bestTokenIdx = move.tokenIdx;
        }
      }
    });

    if (bestTokenIdx >= 0) {
      if (isHost) {
        executeMove(pi, bestTokenIdx);
      } else {
        sendToHost({ t: 'move', tokenIdx: bestTokenIdx });
      }
    }
  }

  // =====================================================================
  //  14. EVENT LISTENERS
  // =====================================================================

  function bindEvents() {
    // Lobby buttons
    DOM.btnCreate.addEventListener('click', function () {
      ensureAudio();
      createRoom();
    });

    DOM.btnJoin.addEventListener('click', function () {
      ensureAudio();
      var code = DOM.joinCode.value.trim();
      if (!code) {
        showError('Please enter a room code.');
        return;
      }
      joinRoom(code);
    });

    DOM.joinCode.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') DOM.btnJoin.click();
    });

    // Copy room code
    DOM.btnCopy.addEventListener('click', function () {
      navigator.clipboard.writeText(roomCode).then(function () {
        DOM.btnCopy.textContent = 'Copied!';
        setTimeout(function () { DOM.btnCopy.textContent = 'Copy'; }, 2000);
      }).catch(function () {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = roomCode;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        DOM.btnCopy.textContent = 'Copied!';
        setTimeout(function () { DOM.btnCopy.textContent = 'Copy'; }, 2000);
      });
    });

    // Player name change
    DOM.playerName.addEventListener('input', function () {
      var name = DOM.playerName.value.trim().substring(0, 16);
      if (!name) return;

      if (isHost) {
        var pi = myPlayerIndex();
        if (pi >= 0) {
          gameState.players[pi].name = name;
          broadcastState(null);
          updateLobbyUI();
        }
      } else {
        sendToHost({ t: 'name', n: name });
      }
    });

    // Color picker
    DOM.colorPicker.addEventListener('click', function (e) {
      var btn = e.target.closest('.color-btn');
      if (!btn || btn.disabled) return;
      var color = btn.getAttribute('data-color');
      if (!color) return;

      if (isHost) {
        handleColorChange(myId, color);
        myColor = color;
      } else {
        sendToHost({ t: 'color', c: color });
        myColor = color;
      }
    });

    // Settings buttons (host only)
    DOM.hostSettings.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-opt');
      if (!btn || !isHost) return;
      var group = btn.closest('.btn-group');
      if (!group) return;

      group.querySelectorAll('.btn-opt').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      gameState.settings = Object.assign({}, gameState.settings, readSettings());

      // If numPlayers changed, update lobby
      updateLobbyUI();
      broadcastState(null);
    });

    // Start game button
    DOM.btnStart.addEventListener('click', function () {
      startGame();
    });

    // Roll dice button
    DOM.btnRoll.addEventListener('click', function () {
      if (!isMyTurn() || gameState.phase !== 'rolling') return;

      if (isHost) {
        executeRoll(myPlayerIndex());
      } else {
        sendToHost({ t: 'roll' });
      }
    });

    // Canvas click
    DOM.canvas.addEventListener('click', handleCanvasClick);

    // Toggle hints
    DOM.toggleHints.addEventListener('change', function () {
      showHints = DOM.toggleHints.checked;
    });

    // Chat
    DOM.btnChatSend.addEventListener('click', sendChat);
    DOM.chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendChat();
    });

    // Emoji bar
    DOM.emojiBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.emoji-btn');
      if (!btn) return;
      var emoji = btn.getAttribute('data-emoji');
      if (!emoji) return;

      var pi = myPlayerIndex();
      showEmojiReaction(emoji, pi);
      SFX.emojiPop();

      if (isHost) {
        broadcastToAll({ t: 'emoji', e: emoji, pi: pi });
      } else {
        sendToHost({ t: 'emoji', e: emoji });
      }
    });

    // Pause button
    DOM.btnPause.addEventListener('click', function () {
      togglePause();
    });

    // Panel tabs (mobile)
    var panelTabs = document.querySelectorAll('.panel-tab');
    panelTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        panelTabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('[data-tab-content]').forEach(function (section) {
          if (section.getAttribute('data-tab-content') === target) {
            section.classList.add('active');
            section.style.display = '';
          } else {
            section.classList.remove('active');
            section.style.display = 'none';
          }
        });
      });
    });

    // Keyboard shortcut: Space to roll dice
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && gameStarted && isMyTurn() && gameState.phase === 'rolling') {
        e.preventDefault();
        DOM.btnRoll.click();
      }
    });

    // Prevent canvas context menu
    DOM.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Window unload
    window.addEventListener('beforeunload', function () {
      if (peer && !isHost) {
        sendToHost({ t: 'leave' });
      }
    });
  }

  // =====================================================================
  //  15. INITIALIZATION
  // =====================================================================

  function init() {
    cacheDom();
    initMyId();
    bindEvents();

    // Set default player name
    var savedName = sessionStorage.getItem('ludo_name');
    if (savedName) DOM.playerName.value = savedName;

    DOM.playerName.addEventListener('change', function () {
      sessionStorage.setItem('ludo_name', DOM.playerName.value);
    });

    // Read initial settings from HTML defaults
    gameState.settings = Object.assign({}, gameState.settings, readSettings());

    // Check for reconnection
    var savedRoom = sessionStorage.getItem('ludo_room');
    if (savedRoom && window.location.hash === '#rejoin') {
      roomCode = savedRoom;
      joinRoom(savedRoom);
    }

    // Ensure initial panel tab state
    var activeTab = document.querySelector('.panel-tab.active');
    if (activeTab) {
      var target = activeTab.getAttribute('data-tab');
      document.querySelectorAll('[data-tab-content]').forEach(function (section) {
        if (section.getAttribute('data-tab-content') === target) {
          section.style.display = '';
        } else {
          section.style.display = 'none';
        }
      });
    }
  }

  if (window.GamePlatform) {
    GamePlatform.initHeader('Ludo');
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
