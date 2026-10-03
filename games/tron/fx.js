(function (root) {
  'use strict';

  function create(canvas, ctx, opts) {
    const W = canvas.width, H = canvas.height, CELL = opts.cell, TICK = opts.tickMs;
    const colors = opts.colors;
    const clock = opts.now || (() => performance.now());
    let trails = [[], []];
    let heads = [null, null];
    let lastStep = 0;
    let particles = [];
    let rings = [];
    let shakeTime = 0, shakeAmp = 0;
    let flash = null;
    let bg = null;
    let lastFrame = 0;

    const center = v => v * CELL + CELL / 2;

    function background(k) {
      if (bg && bg.k === k) return bg.canvas;
      const c = document.createElement('canvas');
      c.width = Math.round(W * k);
      c.height = Math.round(H * k);
      const g = c.getContext('2d');
      g.scale(k, k);
      const sky = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.75);
      sky.addColorStop(0, '#0d1230');
      sky.addColorStop(1, '#04050f');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(80, 140, 255, 0.07)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= W; x += CELL * 5) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
      for (let y = 0; y <= H; y += CELL * 5) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();
      g.strokeStyle = 'rgba(120, 180, 255, 0.12)';
      g.beginPath();
      for (let x = 0; x <= W; x += CELL * 25) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
      for (let y = 0; y <= H; y += CELL * 25) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();
      const vig = g.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.75);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = vig;
      g.fillRect(0, 0, W, H);
      bg = { k, canvas: c };
      return c;
    }

    function reset(players) {
      trails = players.map(p => [{ x: p.x, y: p.y }]);
      heads = players.map(p => ({ x: p.x, y: p.y, px: p.x, py: p.y, dir: p.dir, alive: p.alive !== false }));
      lastStep = clock();
      particles = [];
      rings = [];
      flash = null;
    }

    function step(players) {
      players.forEach((p, i) => {
        const h = heads[i];
        if (!h) return;
        h.px = h.x;
        h.py = h.y;
        if (p.x !== h.x || p.y !== h.y) trails[i].push({ x: p.x, y: p.y });
        h.x = p.x;
        h.y = p.y;
        h.dir = p.dir;
        h.alive = p.alive;
      });
      lastStep = clock();
    }

    function explode(x, y, pi) {
      const cx = center(Math.max(0, Math.min(W / CELL - 1, x)));
      const cy = center(Math.max(0, Math.min(H / CELL - 1, y)));
      const color = colors[pi];
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 320;
        particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.6, max: 1.2, color: i % 4 ? color : '#ffffff', len: 4 + Math.random() * 8 });
      }
      rings.push({ x: cx, y: cy, life: 0.7, max: 0.7, color, r: 90 });
      rings.push({ x: cx, y: cy, life: 0.45, max: 0.45, color: '#ffffff', r: 40 });
      shakeTime = 0.45;
      shakeAmp = 9;
      flash = { color, life: 0.25, max: 0.25 };
    }

    function strokeGlow(path, color, width) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = width * 4.5;
      ctx.stroke(path);
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = width * 2;
      ctx.stroke(path);
      ctx.globalAlpha = 1;
      ctx.lineWidth = width;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = width * 0.4;
      ctx.stroke(path);
    }

    function draw(now, interpolate) {
      const k = ctx.getTransform().a || 1;
      const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
      lastFrame = now;
      const a = interpolate ? Math.max(0, Math.min(1, (now - lastStep) / TICK)) : 1;
      ctx.save();
      if (shakeTime > 0) {
        shakeTime = Math.max(0, shakeTime - dt);
        const m = shakeAmp * (shakeTime / 0.45);
        ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
      }
      ctx.drawImage(background(k), -10, -10, W + 20, H + 20);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      trails.forEach((pts, i) => {
        if (!pts.length || !heads[i]) return;
        const h = heads[i];
        const path = new Path2D();
        path.moveTo(center(pts[0].x), center(pts[0].y));
        const last = pts.length - 1;
        for (let j = 1; j < last; j++) path.lineTo(center(pts[j].x), center(pts[j].y));
        let hx = center(pts[last].x), hy = center(pts[last].y);
        if (last > 0) {
          const px = center(pts[last - 1].x), py = center(pts[last - 1].y);
          if (h.alive) { hx = px + (hx - px) * a; hy = py + (hy - py) * a; }
          path.lineTo(hx, hy);
        }
        strokeGlow(path, colors[i], CELL * 0.62);
        if (h.alive) {
          ctx.save();
          ctx.translate(hx, hy);
          const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[h.dir] || 0;
          ctx.rotate(ang);
          const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, CELL * 3.2);
          glow.addColorStop(0, 'rgba(255,255,255,0.9)');
          glow.addColorStop(0.25, colors[i]);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(0, 0, CELL * 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(CELL * 1.3, 0);
          ctx.lineTo(-CELL * 0.6, -CELL * 0.75);
          ctx.lineTo(-CELL * 0.25, 0);
          ctx.lineTo(-CELL * 0.6, CELL * 0.75);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      });
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx / sp * p.len, p.y - p.vy / sp * p.len);
        ctx.stroke();
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life -= dt;
        if (r.life <= 0) { rings.splice(i, 1); continue; }
        const t = r.life / r.max;
        ctx.globalAlpha = t;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 4 * t + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * (1 - t) + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (flash) {
        flash.life -= dt;
        if (flash.life <= 0) flash = null;
        else {
          ctx.globalAlpha = 0.22 * (flash.life / flash.max);
          ctx.fillStyle = flash.color;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.restore();
    }

    return {
      reset, step, explode, draw,
      busy: () => particles.length > 0 || rings.length > 0 || shakeTime > 0 || !!flash
    };
  }

  root.TronFX = { create };
})(typeof window !== 'undefined' ? window : globalThis);
