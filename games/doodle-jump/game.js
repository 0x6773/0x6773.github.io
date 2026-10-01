(function () {
  'use strict';

  const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame, performance } = GameEngine.clock;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('canvas-container');
  const hudScore = document.getElementById('hud-score');
  const hudMilestone = document.getElementById('hud-milestone');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const highscoreList = document.getElementById('highscore-list');
  const playAgainBtn = document.getElementById('play-again-btn');
  const tiltToggle = document.getElementById('tilt-toggle');

  const Core = window.DoodleCore;
  const Sound = window.DoodleAudio;
  const { W, H, PLAYER, PLAT, ITEM } = Core;
  const STEP_MS = 1000 / 60;
  const LS_KEY = 'doodlejump_highscores';
  const TILT_KEY = 'doodlejump_tilt';
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  const START_Y = H - 70;
  const MILESTONE_COLORS = ['#2fbf5f', '#00a8c8', '#9b59ff', '#ffb000', '#ff3b5c', '#ff5fc8'];
  const BANNERS = { jetpack: ['JETPACK!', '255,150,60'], propeller: ['PROPELLER!', '255,95,95'], shoes: ['SPRING SHOES', '80,210,120'], shield: ['SHIELD', '80,180,255'] };
  const SKY = [
    [0, '#5fb6ff', '#d6f2ff'],
    [1200, '#78aefc', '#ffe9c6'],
    [2600, '#ff8c6b', '#ffd593'],
    [4200, '#3a2f72', '#b26b8f'],
    [6000, '#141c4b', '#2f2d6d'],
    [9000, '#07061b', '#1c1339'],
    [14000, '#020109', '#0d0921']
  ];

  let game = null;
  let mode = 'idle';
  let animationId = null;
  let lastTime = 0;
  let accumulator = 0;
  let endedAt = 0;
  let camPrev = 0;
  let particles = [];
  let decor = null;
  let shake = 0;
  let shakeAmp = 0;
  let squash = 0;
  let spin = 0;
  let flash = 0;
  let lastScore = -1;
  let bestScore = 0;
  let blink = 0;
  let nextBlink = 120;
  let keys = {};
  let touch = null;
  const tilt = { enabled: false, gamma: 0, neutral: null, samples: [] };

  GameEngine.sharpCanvas(canvas, { redraw: () => render(1) });

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')';
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  function linear(x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }

  function text(str, x, y, size, color, opts) {
    const o = opts || {};
    ctx.font = (o.weight || 800) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.spacing || 0) + 'px';
    if (o.outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.outline;
      ctx.strokeStyle = o.outlineColor || 'rgba(0,0,0,0.45)';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function starPath(r, inner) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? inner : r;
      if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function loadHighScores() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveHighScore(value) {
    if (value <= 0) return loadHighScores();
    const scores = loadHighScores();
    scores.push(value);
    scores.sort((a, b) => b - a);
    const top = scores.slice(0, 5);
    try { localStorage.setItem(LS_KEY, JSON.stringify(top)); } catch (e) { }
    return top;
  }

  function renderHighScores(scores) {
    highscoreList.innerHTML = '';
    scores.forEach((value, index) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = (index + 1) + '.';
      li.appendChild(rank);
      li.appendChild(document.createTextNode(' ' + value.toLocaleString()));
      highscoreList.appendChild(li);
    });
  }

  function makeDecor() {
    return {
      stars: Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, H), size: rand(0.4, 1.8), tw: rand(0, 6), sp: rand(0.02, 0.06) })),
      clouds: [0.1, 0.25, 0.45].map((depth, layer) => Array.from({ length: 5 }, () => ({ x: rand(-40, W + 40), y: rand(0, H * 2), s: rand(0.6, 1.1) * (0.7 + layer * 0.25), depth, alpha: 0.4 + layer * 0.2, drift: rand(0.05, 0.2) }))),
      birds: Array.from({ length: 4 }, () => ({ x: rand(0, W), y: rand(70, 260), sp: rand(0.25, 0.6), flap: rand(0, 6) }))
    };
  }

  function skyColors(alt) {
    let i = 0;
    while (i < SKY.length - 2 && alt >= SKY[i + 1][0]) i++;
    const [a0, t0, b0] = SKY[i], [a1, t1, b1] = SKY[i + 1];
    const t = clamp((alt - a0) / (a1 - a0), 0, 1);
    return [mix(t0, t1, t), mix(b0, b1, t)];
  }

  function drawCloud(x, y, s, color, shade) {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(x, y + 10 * s, 34 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [dx, dy, r] of [[0, 0, 18], [-19, 6, 13], [19, 6, 14], [-7, -8, 14], [9, -6, 12]]) {
      ctx.moveTo(x + (dx + r) * s, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawSky(alt, cam, frame) {
    const [top, bottom] = skyColors(alt);
    ctx.fillStyle = linear(0, 0, 0, H, [top, bottom]);
    ctx.fillRect(0, 0, W, H);
    const night = clamp((alt - 3200) / 2800, 0, 1);
    if (night > 0) {
      for (const st of decor.stars) {
        const y = ((st.y - cam * 0.03) % H + H) % H;
        ctx.globalAlpha = night * (0.55 + 0.45 * Math.sin(frame * st.sp + st.tw));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(st.x, y, st.size, st.size);
      }
      ctx.globalAlpha = 1;
    }
    const sunA = 1 - clamp((alt - 3000) / 1500, 0, 1);
    if (sunA > 0) {
      const sx = 300, sy = 110 + alt * 0.05;
      const warm = clamp(alt / 3200, 0, 1);
      const core = mix('#fff4b8', '#ff9b52', warm);
      const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 90);
      glow.addColorStop(0, 'rgba(255,240,180,' + 0.55 * sunA + ')');
      glow.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = glow;
      circle(sx, sy, 90);
      ctx.fill();
      ctx.globalAlpha = sunA;
      ctx.fillStyle = core;
      circle(sx, sy, 26);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const moonA = clamp((alt - 3600) / 1400, 0, 1) * (1 - clamp((alt - 10500) / 1500, 0, 1));
    if (moonA > 0) {
      const mx = 312, my = 118;
      const glow = ctx.createRadialGradient(mx, my, 8, mx, my, 70);
      glow.addColorStop(0, 'rgba(220,230,255,' + 0.35 * moonA + ')');
      glow.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = glow;
      circle(mx, my, 70);
      ctx.fill();
      ctx.globalAlpha = moonA;
      ctx.fillStyle = '#eef1fb';
      circle(mx, my, 20);
      ctx.fill();
      ctx.fillStyle = '#cfd5ea';
      for (const [dx, dy, r] of [[-6, -4, 4], [5, 6, 3], [7, -7, 2.4]]) { circle(mx + dx, my + dy, r); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    const space = clamp((alt - 8500) / 2500, 0, 1);
    if (space > 0) {
      ctx.globalAlpha = space;
      const neb = ctx.createRadialGradient(110, 260, 10, 110, 260, 220);
      neb.addColorStop(0, 'rgba(160,80,255,0.22)');
      neb.addColorStop(1, 'rgba(60,20,120,0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);
      const py = 170 + ((-cam * 0.01) % 40);
      ctx.fillStyle = linear(60, py - 26, 110, py + 26, ['#ffb86b', '#c4542e']);
      circle(84, py, 24);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,180,0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(84, py, 40, 9, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = linear(320, 430, 350, 460, ['#7fd3ff', '#2d6fc4']);
      circle(334, 446, 11);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const hillsY = 470 - cam * 0.35;
    if (hillsY < H + 10) {
      ctx.fillStyle = 'rgba(120,175,215,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hillsY + Math.sin(x * 0.018) * 22 + Math.sin(x * 0.041) * 10);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      const nearY = 530 - cam * 0.6;
      ctx.fillStyle = '#5cab68';
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, nearY + Math.sin(x * 0.025 + 1) * 14);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3f8f4f';
      for (const tx of [40, 120, 270, 350]) {
        const ty = nearY + Math.sin(tx * 0.025 + 1) * 14;
        circle(tx, ty - 10, 11);
        ctx.fill();
        ctx.fillRect(tx - 1.5, ty - 2, 3, 8);
      }
    }
    const cloudA = 1 - clamp((alt - 7000) / 2500, 0, 1);
    if (cloudA > 0) {
      const color = mix('#ffffff', '#8c90c6', night);
      const shade = 'rgba(' + hexToRgb('#c8d8ec').join(',') + ',' + 0.35 * (1 - night) + ')';
      for (const layer of decor.clouds) {
        for (const c of layer) {
          const y = ((c.y - cam * c.depth) % (H * 2) + H * 2) % (H * 2) - H * 0.4;
          if (y < -60 || y > H + 60) continue;
          const x = ((c.x + frame * c.drift) % (W + 120) + W + 120) % (W + 120) - 60;
          ctx.globalAlpha = c.alpha * cloudA;
          drawCloud(x, y, c.s, color, shade);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (alt < 2500) {
      ctx.strokeStyle = 'rgba(40,60,90,' + 0.5 * (1 - alt / 2500) + ')';
      ctx.lineWidth = 1.5;
      for (const b of decor.birds) {
        const x = ((b.x + frame * b.sp) % (W + 40) + W + 40) % (W + 40) - 20;
        const y = b.y - cam * 0.2;
        if (y < -10 || y > H) continue;
        const f = Math.sin(frame * 0.2 + b.flap) * 3;
        ctx.beginPath();
        ctx.moveTo(x - 6, y - f);
        ctx.quadraticCurveTo(x - 3, y - 2, x, y);
        ctx.quadraticCurveTo(x + 3, y - 2, x + 6, y - f);
        ctx.stroke();
      }
    }
  }

  function drawMarkers(cam) {
    const top = Math.floor((START_Y - cam) / 5);
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 1;
    for (let h = Math.max(1000, Math.floor((top - 120) / 1000) * 1000); h <= top + 1000; h += 1000) {
      const sy = -h * 5 + H * 0.42 + 34 - cam;
      if (sy < -10 || sy > H + 10) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();
      text(h.toLocaleString(), W - 8, sy - 8, 10, 'rgba(255,255,255,0.55)', { align: 'right', weight: 700 });
    }
    if (bestScore > 0) {
      const sy = -bestScore * 5 + H * 0.42 + 34 - cam;
      if (sy > -10 && sy < H + 10) {
        ctx.strokeStyle = 'rgba(255,214,90,0.75)';
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(W, sy);
        ctx.stroke();
        text('BEST', 8, sy - 8, 10, '#ffd65a', { align: 'left', weight: 800, outline: 3, spacing: 1 });
      }
    }
    ctx.setLineDash([]);
  }

  function drawGround(y) {
    ctx.fillStyle = linear(0, y, 0, y + 40, ['#7bd85b', '#3f9e3f']);
    ctx.fillRect(0, y, W, 12);
    ctx.fillStyle = linear(0, y + 10, 0, y + 60, ['#8a5a32', '#5d3a20']);
    ctx.fillRect(0, y + 10, W, 60);
    ctx.fillStyle = '#2f8d39';
    for (let x = 3; x < W; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x + 2, y - 3);
      ctx.lineTo(x + 4, y + 1);
      ctx.fill();
    }
  }

  function drawGrass(x, y, w) {
    ctx.fillStyle = linear(0, y + 3, 0, y + 14, ['#9a6a3c', '#664024']);
    roundRect(x + 1, y + 3, w - 2, 11, 5);
    ctx.fill();
    ctx.fillStyle = linear(0, y, 0, y + 7, ['#8fe56c', '#3fae3e']);
    roundRect(x - 1, y, w + 2, 7, 4);
    ctx.fill();
    ctx.fillStyle = '#2f9a38';
    ctx.beginPath();
    for (let i = 5; i < w - 3; i += 9) {
      ctx.moveTo(x + i, y + 1);
      ctx.lineTo(x + i + 2, y - 2.5);
      ctx.lineTo(x + i + 4, y + 1);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + 4, y + 1.2, w - 12, 1.4);
  }

  function drawHover(x, y, w, colors, frame, vertical) {
    const glow = ctx.createRadialGradient(x + w / 2, y + 12, 2, x + w / 2, y + 12, w * 0.6);
    glow.addColorStop(0, 'rgba(' + colors[2] + ',0.35)');
    glow.addColorStop(1, 'rgba(' + colors[2] + ',0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 10, y, w + 20, 30);
    ctx.fillStyle = linear(0, y, 0, y + 11, [colors[0], colors[1]]);
    roundRect(x, y, w, 11, 5.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x + 6, y + 1.5, w - 12, 1.5);
    const pulse = 0.6 + 0.4 * Math.sin(frame * 0.25);
    ctx.fillStyle = 'rgba(' + colors[2] + ',' + pulse + ')';
    for (const tx of [x + 12, x + w - 12]) { circle(tx, y + 11, 2.4); ctx.fill(); }
    if (vertical) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 4, y + 4.5); ctx.lineTo(x + w / 2, y + 2); ctx.lineTo(x + w / 2 + 4, y + 4.5);
      ctx.moveTo(x + w / 2 - 4, y + 7); ctx.lineTo(x + w / 2, y + 9.5); ctx.lineTo(x + w / 2 + 4, y + 7);
      ctx.stroke();
    }
  }

  function drawWood(x, y, w, rotten) {
    if (rotten) {
      const plank = (w - 8) / 3;
      for (let i = 0; i < 3; i++) {
        const px = x + i * (plank + 4);
        ctx.fillStyle = linear(0, y, 0, y + 12, ['#9a7552', '#5c4330']);
        roundRect(px, y + (i === 1 ? 1 : 0), plank, 11, 2.5);
        ctx.fill();
        ctx.fillStyle = '#3d2c1f';
        circle(px + 3, y + 5, 1);
        ctx.fill();
        circle(px + plank - 3, y + 5, 1);
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = linear(0, y, 0, y + 12, ['#f0c48a', '#b07a40']);
    roundRect(x, y, w, 12, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,64,26,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + w - 8, y + 4);
    ctx.moveTo(x + 10, y + 8); ctx.lineTo(x + w - 14, y + 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,30,10,0.7)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.42, y); ctx.lineTo(x + w * 0.48, y + 5); ctx.lineTo(x + w * 0.4, y + 8); ctx.lineTo(x + w * 0.47, y + 12);
    ctx.stroke();
  }

  function drawCloudPlatform(x, y, w, frame) {
    const bob = Math.sin(frame * 0.05 + x) * 1;
    ctx.fillStyle = 'rgba(160,190,225,0.55)';
    roundRect(x + 2, y + 6 + bob, w - 4, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const cx = x + 8 + i * (w - 16) / 4, r = i % 2 ? 8 : 9.5;
      ctx.moveTo(cx + r, y + 6 + bob);
      ctx.arc(cx, y + 6 + bob, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawBroken(p, x, y) {
    const k = (p.vy || 1) - 1;
    const angle = Math.min(1.3, k * 0.06);
    ctx.globalAlpha = clamp(1 - k / 16, 0, 1);
    for (const side of [-1, 1]) {
      ctx.save();
      const pivot = side < 0 ? x : x + p.w;
      ctx.translate(pivot, y);
      ctx.rotate(side * angle);
      ctx.translate(-pivot, -y);
      ctx.beginPath();
      ctx.rect(side < 0 ? x - 4 : x + p.w / 2, y - 6, p.w / 2 + 4, 24);
      ctx.clip();
      drawWood(x + side * k * 0.8, y, p.w, p.kind === 'trap');
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawPowerIcon(kind, cx, cy, frame) {
    ctx.save();
    ctx.translate(cx, cy);
    if (kind === 'jetpack') {
      for (const dx of [-5, 5]) {
        ctx.fillStyle = linear(dx - 4, 0, dx + 4, 0, ['#e9edf2', '#8e98a3']);
        roundRect(dx - 4, -9, 8, 16, 3.5);
        ctx.fill();
        ctx.fillStyle = '#ff5a4f';
        ctx.fillRect(dx - 4, -4, 8, 2.5);
        ctx.fillStyle = 'rgba(255,170,60,' + (0.6 + 0.4 * Math.sin(frame * 0.6 + dx)) + ')';
        ctx.beginPath();
        ctx.moveTo(dx - 2.5, 7); ctx.lineTo(dx, 12 + Math.sin(frame * 0.8 + dx) * 2); ctx.lineTo(dx + 2.5, 7);
        ctx.fill();
      }
    } else if (kind === 'propeller') {
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(0, 4, 10, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(-10, 2, 20, 3);
      ctx.fillStyle = '#5a5f66';
      ctx.fillRect(-1, -9, 2, 5);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.ellipse(0, -9, 3 + 11 * Math.abs(Math.sin(frame * 0.5)), 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'shoes') {
      ctx.strokeStyle = '#c9d0d8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { ctx.moveTo(-5, 4 + i * 2); ctx.lineTo(5, 5 + i * 2); }
      ctx.stroke();
      ctx.fillStyle = linear(-10, -8, 10, 4, ['#7ff09a', '#2fae57']);
      ctx.beginPath();
      ctx.moveTo(-8, 3); ctx.lineTo(-8, -6); ctx.quadraticCurveTo(-8, -9, -4, -9); ctx.lineTo(0, -9);
      ctx.quadraticCurveTo(2, -3, 9, -1); ctx.quadraticCurveTo(11, 0, 10, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, 1, 18, 2);
    } else if (kind === 'shield') {
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11);
      g.addColorStop(0, 'rgba(220,245,255,0.9)');
      g.addColorStop(0.6, 'rgba(90,180,255,0.55)');
      g.addColorStop(1, 'rgba(40,120,255,0.85)');
      ctx.fillStyle = g;
      circle(0, 0, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 7, Math.PI * 1.1, Math.PI * 1.45);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawItem(p, x, y, frame) {
    const it = p.item;
    const ix = x + it.dx;
    if (it.kind === 'spring') {
      const h = 14 - (it.anim || 0) * 7;
      ctx.strokeStyle = '#aeb6bf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const yy = y - (h * i) / 4;
        ctx.lineTo(i % 2 ? ix + 14 : ix + 2, yy);
      }
      ctx.stroke();
      ctx.fillStyle = linear(0, y - h - 3, 0, y - h + 2, ['#ff7a6b', '#d63a2b']);
      roundRect(ix - 1, y - h - 3, 18, 4.5, 2);
      ctx.fill();
    } else if (it.kind === 'trampoline') {
      const sag = (it.anim || 0) * 5;
      ctx.strokeStyle = '#4a525b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ix + 3, y); ctx.lineTo(ix + 6, y - 8);
      ctx.moveTo(ix + 27, y); ctx.lineTo(ix + 24, y - 8);
      ctx.stroke();
      ctx.fillStyle = '#3b4249';
      ctx.beginPath();
      ctx.moveTo(ix + 2, y - 9);
      ctx.quadraticCurveTo(ix + 15, y - 9 + sag * 2, ix + 28, y - 9);
      ctx.lineTo(ix + 28, y - 7);
      ctx.quadraticCurveTo(ix + 15, y - 7 + sag * 2, ix + 2, y - 7);
      ctx.fill();
      ctx.fillStyle = '#ff5a4f';
      for (let i = 0; i < 4; i++) ctx.fillRect(ix + 4 + i * 6, y - 10.5 + (i === 1 || i === 2 ? sag : sag * 0.5), 3, 2);
    } else {
      const bob = Math.sin(frame * 0.08 + p.id) * 2.5;
      const cx = ix + ITEM[it.kind] / 2, cy = y - 14 + bob;
      const rgb = BANNERS[it.kind][1];
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 20);
      glow.addColorStop(0, 'rgba(' + rgb + ',0.45)');
      glow.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = glow;
      circle(cx, cy, 20);
      ctx.fill();
      drawPowerIcon(it.kind, cx, cy, frame);
    }
  }

  function drawPlatform(p, cam, a, frame) {
    const x = p._px !== undefined ? p._px + (p.x - p._px) * a : p.x;
    const y = p.prevY + (p.y - p.prevY) * a - cam;
    if (y < -50 || y > H + 50) return;
    if (p.floor) { drawGround(y); return; }
    if (p.state === 'broken') { drawBroken(p, x, y); return; }
    if (p.kind === 'normal') drawGrass(x, y, p.w);
    else if (p.kind === 'moving') drawHover(x, y, p.w, ['#9ad9ff', '#3a8fd8', '90,200,255'], frame, false);
    else if (p.kind === 'vertical') drawHover(x, y, p.w, ['#d2b0ff', '#7b4fd6', '200,140,255'], frame, true);
    else if (p.kind === 'fragile') drawWood(x, y, p.w, false);
    else if (p.kind === 'trap') drawWood(x, y, p.w, true);
    else if (p.kind === 'cloud') drawCloudPlatform(x, y, p.w, frame);
    if (p.item && !p.item.used) drawItem(p, x, y, frame);
  }

  function drawEyes(px, py, facing, lookX, lookY, closed, angry) {
    for (const ex of [-5, 5]) {
      const x = px + ex + facing * 2.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, py, 4.2, closed ? 0.8 : 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (closed) continue;
      ctx.fillStyle = '#1b1f2a';
      circle(x + lookX, py + lookY, 2.2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      circle(x + lookX - 0.8, py + lookY - 0.9, 0.7);
      ctx.fill();
      if (angry) {
        ctx.strokeStyle = '#1b1f2a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x - 4, py - 6 + (ex < 0 ? -1.5 : 1.5));
        ctx.lineTo(x + 4, py - 6 + (ex < 0 ? 1.5 : -1.5));
        ctx.stroke();
      }
    }
  }

  function drawMonster(m, x, y, frame, player) {
    const cx = x + m.w / 2, cy = y + m.h / 2;
    const look = player ? clamp((player.x + 17 - cx) / 60, -1.5, 1.5) : 0;
    ctx.save();
    if (!m.alive) {
      ctx.globalAlpha = 0.85;
      ctx.translate(cx, cy);
      ctx.rotate(m.t * 0.2);
      ctx.translate(-cx, -cy);
    }
    if (m.kind === 'blob') {
      const wob = Math.sin(m.t * 0.12) * 0.07;
      ctx.translate(cx, y + m.h);
      ctx.scale(1 + wob, 1 - wob);
      ctx.translate(-cx, -(y + m.h));
      ctx.fillStyle = linear(0, y, 0, y + m.h, ['#c497ff', '#6b3fd3']);
      ctx.beginPath();
      ctx.moveTo(x + 2, y + m.h);
      ctx.bezierCurveTo(x - 2, y + 8, x + 10, y, cx, y);
      ctx.bezierCurveTo(x + m.w - 10, y, x + m.w + 2, y + 8, x + m.w - 2, y + m.h);
      for (let i = 4; i >= 0; i--) ctx.quadraticCurveTo(x + (i + 0.5) * m.w / 5, y + m.h + 5, x + i * m.w / 5, y + m.h);
      ctx.fill();
      drawEyes(cx - 2.5, y + 14, 0, look, 1, false, true);
      ctx.fillStyle = '#2a124f';
      roundRect(cx - 9, y + 23, 18, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (const tx of [-6, -1, 4]) { ctx.beginPath(); ctx.moveTo(cx + tx, y + 23); ctx.lineTo(cx + tx + 2, y + 26); ctx.lineTo(cx + tx + 4, y + 23); ctx.fill(); }
    } else if (m.kind === 'flyer') {
      const flap = Math.sin(m.t * 0.45) * 0.7;
      ctx.fillStyle = '#2f7d2a';
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + side * 9, cy - 2);
        ctx.rotate(side * flap);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * 16, -14, side * 22, -2);
        ctx.quadraticCurveTo(side * 14, 0, side * 16, 6);
        ctx.quadraticCurveTo(side * 8, 2, 0, 4);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = linear(0, cy - 13, 0, cy + 13, ['#9cf07a', '#3d9f33']);
      circle(cx, cy, 13);
      ctx.fill();
      drawEyes(cx - 2.5, cy - 3, 0, look, 0.5, false, true);
      ctx.strokeStyle = '#1e4f1a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy + 5, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      const beam = 0.12 + 0.08 * Math.sin(m.t * 0.15);
      ctx.fillStyle = linear(0, cy, 0, cy + 90, ['rgba(140,255,200,' + beam + ')', 'rgba(140,255,200,0)']);
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 6); ctx.lineTo(cx + 10, cy + 6); ctx.lineTo(cx + 26, cy + 90); ctx.lineTo(cx - 26, cy + 90);
      ctx.fill();
      ctx.fillStyle = 'rgba(140,230,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 4, 14, 12, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#7ee05a';
      circle(cx, cy - 6, 5);
      ctx.fill();
      ctx.fillStyle = '#1b1f2a';
      circle(cx - 2, cy - 7, 1.2); ctx.fill();
      circle(cx + 2, cy - 7, 1.2); ctx.fill();
      ctx.fillStyle = linear(0, cy - 6, 0, cy + 10, ['#eef2f6', '#7d8792']);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, m.w / 2, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = (Math.floor(m.t / 8) + i) % 2 ? '#ffd34d' : '#ff5a4f';
        circle(cx - 22 + i * 11, cy + 4, 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawHole(h, x, y, frame) {
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 48);
    glow.addColorStop(0, 'rgba(120,60,255,0.5)');
    glow.addColorStop(1, 'rgba(60,20,160,0)');
    ctx.fillStyle = glow;
    circle(x, y, 48);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(frame * 0.06);
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = 'rgba(190,140,255,' + (0.55 - i * 0.1) + ')';
      ctx.beginPath();
      ctx.arc(0, 0, 12 + i * 6, i * 1.6, i * 1.6 + 2.2);
      ctx.stroke();
    }
    ctx.restore();
    const core = ctx.createRadialGradient(x, y, 2, x, y, 20);
    core.addColorStop(0, '#000000');
    core.addColorStop(0.7, 'rgba(10,0,25,0.95)');
    core.addColorStop(1, 'rgba(40,10,90,0)');
    ctx.fillStyle = core;
    circle(x, y, 20);
    ctx.fill();
  }

  function drawPlayer(s, x, y, frame) {
    const p = s.player;
    const cx = x + PLAYER.w / 2, cy = y + PLAYER.h / 2;
    const facing = p.facing || 1;
    let sx = 1 + 0.22 * squash, sy = 1 - 0.26 * squash;
    if (p.vy < -6 && !p.power) {
      const k = Math.min(0.18, (-p.vy - 6) / 40);
      sy *= 1 + k;
      sx *= 1 - k * 0.6;
    }
    let scale = 1;
    let rot = (p.vx / 6) * 0.15;
    if (!p.alive) {
      rot += spin;
      if (s.cause === 'blackhole') scale = Math.max(0.05, s.timer / 60);
    }
    if (p.shield > 0 && !(p.shield < 90 && (frame >> 2) % 2 === 0)) {
      const pulse = 0.75 + 0.25 * Math.sin(frame * 0.2);
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 27);
      g.addColorStop(0, 'rgba(90,190,255,0)');
      g.addColorStop(0.75, 'rgba(90,190,255,' + 0.18 * pulse + ')');
      g.addColorStop(1, 'rgba(170,230,255,' + 0.55 * pulse + ')');
      ctx.fillStyle = g;
      circle(cx, cy, 27);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, cy + 15);
    ctx.rotate(rot);
    ctx.scale(sx * scale, sy * scale);
    ctx.translate(0, -15);
    if (p.power && p.power.kind === 'jetpack') {
      const bx = -facing * 14;
      for (const dx of [-3.5, 3.5]) {
        const len = 10 + Math.random() * 9;
        ctx.fillStyle = 'rgba(255,120,40,0.9)';
        ctx.beginPath();
        ctx.moveTo(bx + dx - 3, 9); ctx.lineTo(bx + dx, 9 + len); ctx.lineTo(bx + dx + 3, 9);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,235,140,0.95)';
        ctx.beginPath();
        ctx.moveTo(bx + dx - 1.5, 9); ctx.lineTo(bx + dx, 9 + len * 0.55); ctx.lineTo(bx + dx + 1.5, 9);
        ctx.fill();
        ctx.fillStyle = linear(bx + dx - 3.5, 0, bx + dx + 3.5, 0, ['#eef2f6', '#8e98a3']);
        roundRect(bx + dx - 3.5, -8, 7, 17, 3);
        ctx.fill();
      }
    }
    const footExt = p.vy > 0 ? 3 : 0;
    ctx.fillStyle = '#25945a';
    for (const fx of [-6, 6]) {
      ctx.beginPath();
      ctx.ellipse(fx, 14 + footExt, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.shoes > 0) {
      ctx.strokeStyle = '#c9d0d8';
      ctx.lineWidth = 1.5;
      for (const fx of [-6, 6]) {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) ctx.lineTo(fx + (i % 2 ? 3 : -3), 17 + footExt + i * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#3fcf6c';
      for (const fx of [-6, 6]) { roundRect(fx - 5, 11 + footExt, 10, 5, 2); ctx.fill(); }
    }
    const body = ctx.createRadialGradient(-4, -6, 2, 0, 0, 19);
    body.addColorStop(0, '#c2f8cf');
    body.addColorStop(0.55, '#52d283');
    body.addColorStop(1, '#22985a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.bezierCurveTo(10, -16, 15, -8, 15, 1);
    ctx.bezierCurveTo(15, 10, 10, 15, 0, 15);
    ctx.bezierCurveTo(-10, 15, -15, 10, -15, 1);
    ctx.bezierCurveTo(-15, -8, -10, -16, 0, -16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,70,40,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(230,255,236,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 8.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3cc26f';
    roundRect(facing > 0 ? 9 : -19, -3, 10, 6.5, 3);
    ctx.fill();
    ctx.fillStyle = '#26995a';
    circle(facing > 0 ? 18 : -18, 0.2, 3.3);
    ctx.fill();
    const lookX = clamp(p.vx / 3, -1.4, 1.4) + facing * 0.4;
    const lookY = clamp(p.vy / 8, -1.2, 1.4);
    const dead = !p.alive;
    if (dead) {
      ctx.strokeStyle = '#1b1f2a';
      ctx.lineWidth = 1.8;
      for (const ex of [-5, 5]) {
        const ex2 = ex + facing * 2.5;
        ctx.beginPath();
        ctx.moveTo(ex2 - 3, -8); ctx.lineTo(ex2 + 3, -2);
        ctx.moveTo(ex2 + 3, -8); ctx.lineTo(ex2 - 3, -2);
        ctx.stroke();
      }
    } else {
      drawEyes(0, -5, facing, lookX, lookY, blink > 0, false);
    }
    ctx.fillStyle = '#1b5e35';
    if (dead || p.vy > 9) {
      circle(facing * 2, 5, 2.4);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#1b5e35';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(facing * 2, 3, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    if (p.power && p.power.kind === 'propeller') {
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(0, -13, 9, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(-9, -14.5, 18, 2.5);
      ctx.fillStyle = '#5a5f66';
      ctx.fillRect(-1, -27, 2, 6);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.ellipse(0, -27, 3 + 13 * Math.abs(Math.sin(frame * 0.9)), 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function addParticle(p) {
    particles.push(p);
    if (particles.length > 600) particles.splice(0, particles.length - 600);
  }

  function burst(kind, x, y, n, opts) {
    const o = opts || {};
    for (let i = 0; i < n; i++) {
      const a = o.up ? -Math.PI / 2 + rand(-0.8, 0.8) : rand(0, Math.PI * 2);
      const sp = rand(o.min || 1, o.max || 3.5);
      const life = rand(o.lifeMin || 20, o.lifeMax || 40);
      addParticle({ k: kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: rand(o.sizeMin || 1.5, o.sizeMax || 3.5), rot: rand(0, 6), vr: rand(-0.3, 0.3), color: o.colors ? o.colors[i % o.colors.length] : o.color, g: o.g || 0 });
    }
  }

  function banner(label, rgb) {
    particles = particles.filter(p => p.k !== 'banner');
    addParticle({ k: 'banner', text: label, rgb, life: 85, max: 85 });
  }

  function popup(value, x, y) {
    addParticle({ k: 'text', text: '+' + value, x, y, life: 55, max: 55 });
  }

  function updateParticles() {
    for (const p of particles) {
      p.life--;
      if (p.vx !== undefined) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g || 0;
        if (!p.g) { p.vx *= 0.94; p.vy *= 0.94; }
      }
      if (p.vr) p.rot += p.vr;
      if (p.k === 'text') p.y -= 0.6;
    }
    particles = particles.filter(p => p.life > 0);
    if (squash > 0) squash = Math.max(0, squash - 0.1);
    if (shake > 0) shake--;
    if (flash > 0) flash -= 0.04;
    if (blink > 0) blink--;
    else if (--nextBlink <= 0) { blink = 7; nextBlink = 150 + Math.floor(Math.random() * 200); }
  }

  function drawParticles(cam, frame) {
    for (const p of particles) {
      const a = p.life / p.max;
      const y = p.y - cam;
      if (p.k === 'dust' || p.k === 'puff' || p.k === 'smoke') {
        const grow = p.k === 'puff' ? 2.4 : 1.8;
        ctx.fillStyle = p.color || 'rgba(255,255,255,1)';
        ctx.globalAlpha = (p.k === 'smoke' ? 0.35 : 0.6) * a;
        circle(p.x, y, p.size * (grow - a * (grow - 1)) * 2);
        ctx.fill();
      } else if (p.k === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x - p.vx * 2.4, y - p.vy * 2.4);
        ctx.stroke();
      } else if (p.k === 'chip' || p.k === 'confetti') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.translate(p.x, y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * (p.k === 'confetti' ? 0.5 : 1), p.size * 2, p.size * (p.k === 'confetti' ? 1 : 2));
        ctx.restore();
      } else if (p.k === 'star') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, y);
        ctx.rotate(p.rot);
        starPath(p.size * 2, p.size);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      } else if (p.k === 'flame') {
        ctx.globalAlpha = a;
        ctx.fillStyle = a > 0.6 ? '#ffe28a' : a > 0.3 ? '#ff9a3c' : '#e8502b';
        circle(p.x, y, p.size * (0.5 + a));
        ctx.fill();
      } else if (p.k === 'ring') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        circle(p.x, y, p.size * (1 - a) + 6);
        ctx.stroke();
      } else if (p.k === 'speed') {
        ctx.globalAlpha = 0.5 * a;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x, y + p.size * 10);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of particles) {
      const a = p.life / p.max;
      if (p.k === 'text') {
        const age = p.max - p.life;
        const pop = age < 6 ? 1 + (6 - age) / 10 : 1;
        ctx.globalAlpha = Math.min(1, a * 1.8);
        text(p.text, p.x, p.y - cam, 16 * pop, '#ffffff', { outline: 4, outlineColor: 'rgba(80,40,120,0.75)' });
        ctx.globalAlpha = 1;
      } else if (p.k === 'banner') {
        const e = p.max - p.life;
        const s = e < 8 ? 0.6 + 0.55 * (e / 8) : e < 12 ? 1.15 - 0.15 * ((e - 8) / 4) : 1;
        ctx.save();
        ctx.globalAlpha = p.life < 20 ? p.life / 20 : 1;
        ctx.translate(W / 2, 150 - Math.min(e, 12) * 0.6);
        ctx.scale(s, s);
        ctx.shadowColor = 'rgba(' + p.rgb + ',0.9)';
        ctx.shadowBlur = 18;
        text(p.text, 0, 0, 30, 'rgb(' + p.rgb + ')', { weight: 900, spacing: 2, outline: 5, outlineColor: 'rgba(255,255,255,0.95)' });
        ctx.restore();
      }
    }
  }

  function interp(o, a) {
    if (o._px === undefined) return [o.x, o.y];
    let dx = o.x - o._px;
    if (Math.abs(dx) > W / 2) dx = 0;
    return [o._px + dx * a, o._py + (o.y - o._py) * a];
  }

  function render(alpha) {
    if (!game) return;
    const s = game.state;
    const a = clamp(alpha === undefined ? 1 : alpha, 0, 1);
    const frame = s.frame;
    const cam = camPrev + (s.cameraY - camPrev) * a;
    const alt = Math.max(0, -cam / 5);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-1, 1) * shakeAmp * (shake / 14), rand(-1, 1) * shakeAmp * (shake / 14));
    drawSky(alt, cam, frame);
    drawMarkers(cam);
    for (const h of s.holes) drawHole(h, h.x, h.y - cam, frame);
    for (const p of s.platforms) drawPlatform(p, cam, a, frame);
    for (const m of s.monsters) {
      const [mx, my] = interp(m, a);
      if (my - cam > -80 && my - cam < H + 40) drawMonster(m, mx, my - cam, frame, s.player);
    }
    if (s.player) {
      const [px, py] = interp(s.player, a);
      drawPlayer(s, px, py - cam, frame);
      if (px < 0) drawPlayer(s, px + W + PLAYER.w, py - cam, frame);
      else if (px + PLAYER.w > W) drawPlayer(s, px - W - PLAYER.w, py - cam, frame);
    }
    drawParticles(cam, frame);
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + clamp(flash, 0, 0.7) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function handleEvents(events) {
    const s = game.state;
    const live = mode === 'play';
    const sfx = name => { if (live) Sound.sfx(name); };
    for (const e of events) {
      if (e.type === 'bounce' || e.type === 'shoes' || e.type === 'spring' || e.type === 'trampoline') {
        squash = 1;
        sfx(e.type);
        burst('dust', e.x, e.y, 6, { min: 0.6, max: 2, lifeMin: 14, lifeMax: 24, sizeMin: 1.5, sizeMax: 2.8, color: '#ffffff' });
        if (e.type === 'shoes') burst('spark', e.x, e.y, 6, { up: true, color: '#7ff09a' });
        if (e.type === 'spring') burst('spark', e.x, e.y, 10, { up: true, min: 2, max: 5, color: '#ffd34d' });
        if (e.type === 'trampoline') {
          burst('confetti', e.x, e.y, 18, { up: true, min: 2, max: 6, g: 0.12, lifeMin: 40, lifeMax: 70, colors: ['#ff5a4f', '#ffd34d', '#5fb8ff', '#7ff09a', '#c497ff'] });
          shake = Math.max(shake, 6);
          shakeAmp = 1.5;
        }
      } else if (e.type === 'crack' || e.type === 'trap') {
        sfx(e.type);
        burst('chip', e.x, e.y + 6, e.type === 'trap' ? 10 : 7, { g: 0.25, min: 0.5, max: 2.5, lifeMin: 30, lifeMax: 50, colors: e.type === 'trap' ? ['#7a5a3c', '#5c4330'] : ['#d6a46a', '#a8743e'] });
      } else if (e.type === 'poof') {
        sfx('poof');
        burst('puff', e.x, e.y + 6, 8, { min: 0.6, max: 2.2, lifeMin: 22, lifeMax: 34, sizeMin: 3, sizeMax: 5, color: '#ffffff' });
      } else if (e.type === 'pickup') {
        sfx(e.item === 'jetpack' || e.item === 'propeller' || e.item === 'shield' ? e.item : 'pickup');
        const b = BANNERS[e.item];
        if (b) banner(b[0], b[1]);
        addParticle({ k: 'ring', x: e.x, y: e.y, size: 40, life: 20, max: 20, color: 'rgba(255,240,170,0.9)' });
        burst('star', e.x, e.y, 8, { min: 1.5, max: 3.5, lifeMin: 24, lifeMax: 36, sizeMin: 2, sizeMax: 3.2, color: '#ffe066' });
      } else if (e.type === 'powerEnd') {
        sfx('powerEnd');
        burst('smoke', s.player.x + 17, s.player.y + 24, 6, { min: 0.3, max: 1.2, lifeMin: 26, lifeMax: 40, sizeMin: 3, sizeMax: 5, color: '#9aa3ad' });
      } else if (e.type === 'stomp' || e.type === 'smash') {
        sfx(e.type);
        squash = 0.8;
        shake = Math.max(shake, 8);
        shakeAmp = 2.5;
        const color = e.monster === 'blob' ? '#a774ff' : e.monster === 'flyer' ? '#5ec74a' : '#c9d0d8';
        burst('star', e.x, e.y, 9, { min: 2, max: 4.5, lifeMin: 22, lifeMax: 34, sizeMin: 2.2, sizeMax: 3.6, color: '#ffe066' });
        burst('chip', e.x, e.y, 10, { g: 0.2, min: 1, max: 3.5, lifeMin: 26, lifeMax: 40, color });
      } else if (e.type === 'shieldHit') {
        sfx('shieldHit');
        addParticle({ k: 'ring', x: e.x, y: e.y, size: 46, life: 22, max: 22, color: 'rgba(120,200,255,0.95)' });
        burst('spark', e.x, e.y, 10, { color: '#a8dcff' });
      } else if (e.type === 'points') {
        popup(e.value, e.x, e.y - 18);
      } else if (e.type === 'death') {
        sfx(e.cause);
        Sound.loop(null);
        Sound.music.stop();
        if (e.cause === 'hit') { shake = 16; shakeAmp = 4; flash = 0.5; }
        if (e.cause === 'blackhole') burst('spark', e.x, e.y, 16, { color: '#c49bff' });
      } else if (e.type === 'milestone') {
        sfx('milestone');
        const color = MILESTONE_COLORS[e.index] || '#ffffff';
        banner(e.title.toUpperCase(), hexToRgb(color).join(','));
        burst('confetti', W / 2, s.cameraY + 120, 26, { min: 2, max: 6, g: 0.12, lifeMin: 50, lifeMax: 80, colors: ['#ff5a4f', '#ffd34d', '#5fb8ff', '#7ff09a', '#c497ff'] });
        hudMilestone.textContent = e.title;
        hudMilestone.style.color = color;
      } else if (e.type === 'over') {
        finishGame();
      }
    }
  }

  function inputDir() {
    let dir = 0;
    if (keys.ArrowLeft || keys.KeyA) dir -= 1;
    if (keys.ArrowRight || keys.KeyD) dir += 1;
    if (touch) {
      const rect = canvas.getBoundingClientRect();
      const dx = ((touch.x - touch.startX) / (rect.width || W)) * W;
      if (touch.dragged || Math.abs(dx) > 10) {
        touch.dragged = true;
        dir = clamp(dx / 50, -1, 1);
        if (Math.abs(dir) < 0.12) dir = 0;
      } else {
        dir = touch.x < rect.left + rect.width / 2 ? -1 : 1;
      }
    } else if (tilt.enabled && tilt.neutral !== null) {
      const d = tilt.gamma - tilt.neutral;
      if (Math.abs(d) > 3) dir = clamp(d / 22, -1, 1);
    }
    return dir;
  }

  function tick() {
    const s = game.state;
    camPrev = s.cameraY;
    for (const o of s.platforms) o._px = o.x;
    for (const o of s.monsters) { o._px = o.x; o._py = o.y; }
    if (s.player) { s.player._px = s.player.x; s.player._py = s.player.y; }
    const events = game.step({ dir: mode === 'play' ? inputDir() : 0 });
    handleEvents(events);
    if (mode === 'idle' && s.phase !== 'play') { newRun(true); return; }
    const p = s.player;
    if (p && !p.alive) spin += s.cause === 'blackhole' ? 0.35 : 0.22;
    if (p && p.power) {
      const back = p.x + 17 - (p.facing || 1) * 14;
      if (p.power.kind === 'jetpack') {
        for (let i = 0; i < 2; i++) addParticle({ k: 'flame', x: back + rand(-4, 4), y: p.y + 30, vx: rand(-0.4, 0.4), vy: rand(2, 4), life: 18, max: 18, size: rand(2, 3.5) });
        if (s.frame % 3 === 0) addParticle({ k: 'smoke', x: back, y: p.y + 40, vx: rand(-0.5, 0.5), vy: rand(1, 2), life: 34, max: 34, size: rand(3, 5), color: '#b8c0c8' });
      }
      if (s.frame % 4 === 0) addParticle({ k: 'speed', x: p.x + rand(-6, 40), y: p.y + rand(30, 60), vx: 0, vy: 0, life: 12, max: 12, size: rand(1.5, 3) });
    } else if (p && p.alive && p.vy < -15 && s.frame % 2 === 0) {
      addParticle({ k: 'speed', x: p.x + rand(-4, 38), y: p.y + rand(30, 50), vx: 0, vy: 0, life: 10, max: 10, size: rand(1.5, 3) });
    }
    updateParticles();
    if (mode === 'play') {
      Sound.loop(p && p.alive && p.power ? p.power.kind : null);
      Sound.update();
      if (s.score !== lastScore) {
        lastScore = s.score;
        hudScore.textContent = s.score.toLocaleString();
        if (window.GamePlatform) GamePlatform.updateScore(s.score);
      }
    }
  }

  function loop(now) {
    accumulator += Math.min(100, now - lastTime);
    lastTime = now;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < 6) {
      accumulator -= STEP_MS;
      tick();
      steps++;
    }
    if (steps === 6) accumulator = 0;
    render(accumulator / STEP_MS);
    animationId = requestAnimationFrame(loop);
  }

  function newRun(idle) {
    game = Core.create({});
    game.start();
    if (idle) {
      const s = game.state, px = s.player.x;
      s.platforms = s.platforms.filter(p => p.floor || p.kind !== 'moving' && (p.y < START_Y - 260 || p.x + p.w < px + 2 || p.x > px + PLAYER.w - 2));
    }
    camPrev = game.state.cameraY;
    particles = [];
    decor = makeDecor();
    squash = shake = flash = spin = 0;
  }

  function startGame() {
    if (mode === 'play' || performance.now() - endedAt < 700) return;
    GameEngine.audio();
    if (tilt.enabled) { tilt.neutral = null; tilt.samples = []; }
    newRun();
    mode = 'play';
    lastScore = -1;
    bestScore = loadHighScores()[0] || 0;
    hudMilestone.textContent = '';
    hudMilestone.style.color = '';
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    if (window.GamePlatform) { GamePlatform.resetTimer(); GamePlatform.startTimer(); }
    Sound.sfx('start');
    Sound.music.start();
  }

  function finishGame() {
    if (mode !== 'play') return;
    mode = 'over';
    endedAt = performance.now();
    Sound.loop(null);
    Sound.music.stop();
    const s = game.state;
    setTimeout(() => Sound.sfx('gameover'), 150);
    const top = saveHighScore(s.score);
    if (window.GamePlatform) {
      const elapsed = GamePlatform.stopTimer();
      GamePlatform.recordGame('doodle-jump', s.score, elapsed * 1000, { maxHeight: s.heightScore });
      GamePlatform.updateScore(s.score);
    }
    finalScoreEl.textContent = s.score.toLocaleString();
    renderHighScores(top);
    gameoverOverlay.classList.remove('hidden');
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

  function handleOrientation(event) {
    if (event.gamma === null) return;
    tilt.gamma = event.gamma;
    if (tilt.neutral === null && mode === 'play') {
      tilt.samples.push(event.gamma);
      if (tilt.samples.length >= 5) tilt.neutral = tilt.samples.reduce((x, y) => x + y, 0) / tilt.samples.length;
    }
  }

  function setTilt(on) {
    tilt.enabled = on;
    try { localStorage.setItem(TILT_KEY, on ? '1' : '0'); } catch (e) { }
    if (on) window.addEventListener('deviceorientation', handleOrientation);
    else window.removeEventListener('deviceorientation', handleOrientation);
    tiltToggle.textContent = 'Tilt controls: ' + (on ? 'On' : 'Off');
    tiltToggle.classList.toggle('on', on);
  }

  function setupTilt() {
    const supported = 'DeviceOrientationEvent' in window && window.matchMedia('(pointer: coarse)').matches;
    if (!supported) return;
    tiltToggle.classList.remove('hidden');
    let saved = false;
    try { saved = localStorage.getItem(TILT_KEY) === '1'; } catch (e) { }
    const needsPermission = typeof DeviceOrientationEvent.requestPermission === 'function';
    setTilt(saved && !needsPermission);
    tiltToggle.addEventListener('click', event => {
      event.stopPropagation();
      if (tilt.enabled) { setTilt(false); return; }
      if (needsPermission) {
        DeviceOrientationEvent.requestPermission().then(r => setTilt(r === 'granted')).catch(() => setTilt(false));
      } else setTilt(true);
    });
  }

  document.addEventListener('keydown', event => {
    if (event.code === 'KeyM' && !event.repeat && !event.metaKey && !event.ctrlKey) {
      toggleMusic();
      return;
    }
    keys[event.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) event.preventDefault();
    if ((event.code === 'Space' || event.code === 'Enter') && mode !== 'play') {
      event.preventDefault();
      startGame();
    }
  });
  document.addEventListener('keyup', event => { keys[event.code] = false; });
  window.addEventListener('blur', () => { keys = {}; touch = null; });

  container.addEventListener('touchstart', event => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    event.preventDefault();
    if (mode === 'idle') { startGame(); return; }
    if (mode !== 'play') return;
    const t = event.changedTouches[0];
    touch = { id: t.identifier, startX: t.clientX, x: t.clientX, dragged: false };
  }, { passive: false });
  container.addEventListener('touchmove', event => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    event.preventDefault();
    if (!touch) return;
    for (const t of event.changedTouches) if (t.identifier === touch.id) touch.x = t.clientX;
  }, { passive: false });
  const endTouch = event => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    event.preventDefault();
    if (!touch) return;
    for (const t of event.changedTouches) if (t.identifier === touch.id) touch = null;
  };
  container.addEventListener('touchend', endTouch, { passive: false });
  container.addEventListener('touchcancel', endTouch, { passive: false });
  container.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || event.target.closest('button, a, input, select, textarea')) return;
    if (mode === 'idle') { event.preventDefault(); startGame(); }
  });
  playAgainBtn.addEventListener('click', event => {
    event.stopPropagation();
    endedAt = 0;
    startGame();
  });

  newRun(true);
  bestScore = loadHighScores()[0] || 0;
  renderHighScores(loadHighScores());
  if (window.GamePlatform) GamePlatform.initHeader('Doodle Jump');
  addMusicButton();
  setupTilt();
  lastTime = performance.now();
  animationId = requestAnimationFrame(loop);
  GameEngine.pausable({ isActive: () => mode === 'play', container: '#canvas-container' });
})();
