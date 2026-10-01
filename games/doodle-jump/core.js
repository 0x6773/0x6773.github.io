(function (root) {
  'use strict';

  const W = 400;
  const H = 600;
  const PHYS = { gravity: 0.38, jump: -10.8, spring: -17.5, trampoline: -22, shoes: -14.5, stomp: -12, maxVx: 6, accel: 0.75, friction: 0.82 };
  const PLAYER = { w: 34, h: 34, feet: 7 };
  const PLAT = { w: 64, h: 14 };
  const POWER = { jetpack: { frames: 200, vy: -13.5 }, propeller: { frames: 160, vy: -10 }, shield: 600, shoes: 6 };
  const MONSTER = { blob: { w: 44, h: 36, r: 17 }, flyer: { w: 46, h: 30, r: 15 }, ufo: { w: 64, h: 34, r: 21 } };
  const ITEM = { spring: 16, trampoline: 30, jetpack: 24, propeller: 24, shoes: 24, shield: 24 };
  const HOLE_R = 22;
  const MILESTONES = [
    { score: 500, title: 'Rookie' }, { score: 1000, title: 'Climber' }, { score: 2500, title: 'Skilled' },
    { score: 5000, title: 'Expert' }, { score: 10000, title: 'Legendary' }, { score: 20000, title: 'Mythic' }
  ];
  const START_Y = H - 70;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(options) {
    const opts = options || {};
    const rand = mulberry32(opts.seed != null ? opts.seed : Math.floor(Math.random() * 4294967296));
    const s = {
      phase: 'ready', frame: 0, player: null, platforms: [], monsters: [], holes: [],
      cameraY: 0, score: 0, heightScore: 0, bonus: 0, milestone: -1, events: [],
      cause: null, timer: 0, topY: 0, lastPowerY: 0, lastDangerY: 0, nextId: 1
    };

    function emit(type, data) {
      s.events.push(Object.assign({}, data, { type }));
    }

    const between = (a, b) => a + rand() * (b - a);
    const altScore = y => Math.max(0, Math.floor((START_Y - y) / 5));

    function makePlatform(kind, x, y, sc) {
      const p = { id: s.nextId++, kind, x, y, prevY: y, w: PLAT.w, h: PLAT.h, state: 'ok', item: null, t: 0, vx: 0, baseY: y, range: 0, phase: 0, speed: 0 };
      if (kind === 'moving') p.vx = (rand() < 0.5 ? -1 : 1) * between(0.8, Math.min(3.2, 1.4 + sc / 4000));
      if (kind === 'vertical') { p.range = between(30, 60); p.speed = between(0.015, Math.min(0.04, 0.02 + sc / 400000)); p.phase = rand() * Math.PI * 2; }
      return p;
    }

    function pickKind(sc) {
      const r = rand();
      if (sc < 300) return r < 0.85 ? 'normal' : 'moving';
      if (sc < 1500) return r < 0.6 ? 'normal' : r < 0.8 ? 'moving' : r < 0.9 ? 'fragile' : 'cloud';
      if (sc < 4000) return r < 0.4 ? 'normal' : r < 0.65 ? 'moving' : r < 0.75 ? 'vertical' : r < 0.87 ? 'fragile' : 'cloud';
      if (sc < 8000) return r < 0.28 ? 'normal' : r < 0.58 ? 'moving' : r < 0.72 ? 'vertical' : r < 0.86 ? 'fragile' : 'cloud';
      return r < 0.18 ? 'normal' : r < 0.52 ? 'moving' : r < 0.7 ? 'vertical' : r < 0.85 ? 'fragile' : 'cloud';
    }

    function maybeItem(p, sc) {
      if (p.kind === 'fragile' || p.kind === 'cloud') return;
      const r = rand();
      const powerOk = p.y < s.lastPowerY - 700;
      let kind = null;
      if (powerOk && sc >= 1000 && r < 0.008 && p.kind !== 'vertical') kind = 'jetpack';
      else if (powerOk && sc >= 600 && r < 0.02 && p.kind !== 'vertical') kind = 'propeller';
      else if (powerOk && sc >= 1500 && r < 0.03) kind = 'shoes';
      else if (powerOk && sc >= 2000 && r < 0.04) kind = 'shield';
      else if (sc >= 800 && r < 0.06 && p.kind === 'normal') kind = 'trampoline';
      else if (sc >= 100 && r < 0.15) kind = 'spring';
      if (!kind) return;
      const size = ITEM[kind];
      p.item = { kind, dx: Math.floor(between(4, p.w - size - 4)), used: false };
      if (kind !== 'spring' && kind !== 'trampoline') s.lastPowerY = p.y;
    }

    function maybeDanger(y, sc) {
      if (sc < 1200 || y > s.lastDangerY - Math.max(200, 340 - sc / 100)) return;
      const holeChance = sc >= 3500 ? Math.min(0.05, 0.015 + (sc - 3500) / 400000) : 0;
      const monsterChance = Math.min(0.2, 0.04 + (sc - 1200) / 90000);
      const r = rand();
      if (r < holeChance) {
        s.holes.push({ id: s.nextId++, x: between(40, W - 40), y: y - 70, r: HOLE_R, t: 0 });
        s.lastDangerY = y;
      } else if (r < holeChance + monsterChance) {
        const kind = sc >= 5000 && rand() < 0.3 ? 'ufo' : sc >= 2500 && rand() < 0.5 ? 'flyer' : 'blob';
        const m = MONSTER[kind];
        const x = between(10, W - m.w - 10);
        s.monsters.push({
          id: s.nextId++, kind, x, baseX: x, y: y - 64, w: m.w, h: m.h, r: m.r, alive: true, t: rand() * 6,
          vx: kind === 'flyer' ? (rand() < 0.5 ? -1 : 1) * between(1, 2.4) : 0
        });
        s.lastDangerY = y;
      }
    }

    function clearOfDanger(x, y) {
      for (const m of s.monsters) {
        if (Math.abs(m.y + m.h / 2 - y) < 70 && x < m.x + m.w + 12 && x + PLAT.w > m.x - 12) return false;
      }
      for (const h of s.holes) {
        if (Math.abs(h.y - y) < 80 && Math.abs(h.x - (x + PLAT.w / 2)) < h.r + PLAT.w / 2 + 16) return false;
      }
      return true;
    }

    function generateRow() {
      const sc = altScore(s.topY);
      const gap = between(46, Math.min(118, 62 + sc / 60));
      const y = s.topY - gap;
      let x = between(0, W - PLAT.w);
      for (let tries = 0; tries < 8 && !clearOfDanger(x, y); tries++) x = between(0, W - PLAT.w);
      const p = makePlatform(pickKind(sc), x, y, sc);
      maybeItem(p, sc);
      s.platforms.push(p);
      if (sc >= 300 && rand() < Math.min(0.25, 0.08 + sc / 40000)) {
        let tx = between(0, W - PLAT.w);
        if (Math.abs(tx - x) < PLAT.w + 10) tx = (x + W / 2) % (W - PLAT.w);
        const ty = y + between(-18, 18);
        if (clearOfDanger(tx, ty)) s.platforms.push(makePlatform('trap', tx, ty, sc));
      }
      maybeDanger(y, sc);
      s.topY = y;
    }

    function fillAbove() {
      while (s.topY > s.cameraY - H) generateRow();
    }

    function start() {
      s.phase = 'play';
      s.frame = 0;
      s.platforms = [];
      s.monsters = [];
      s.holes = [];
      s.cameraY = 0;
      s.score = s.heightScore = s.bonus = 0;
      s.milestone = -1;
      s.cause = null;
      s.timer = 0;
      s.nextId = 1;
      s.lastPowerY = START_Y;
      s.lastDangerY = START_Y;
      const floor = makePlatform('normal', 0, H - 30, 0);
      floor.w = W;
      floor.floor = true;
      s.platforms.push(floor);
      s.topY = H - 30;
      while (s.topY > H - 300) {
        const y = s.topY - between(50, 70);
        s.platforms.push(makePlatform('normal', between(0, W - PLAT.w), y, 0));
        s.topY = y;
      }
      fillAbove();
      s.player = { x: W / 2 - PLAYER.w / 2, y: START_Y, prevY: START_Y, vx: 0, vy: PHYS.jump, facing: 1, power: null, shoes: 0, shield: 0, alive: true };
      emit('start', {});
    }

    function feetOverlap(p, x0, x1) {
      return p.x + PLAYER.feet < x1 && p.x + PLAYER.w - PLAYER.feet > x0;
    }

    function overlapsBox(p, x, y, w, h) {
      return p.x < x + w && p.x + PLAYER.w > x && p.y < y + h && p.y + PLAYER.h > y;
    }

    function itemBox(plat) {
      const size = ITEM[plat.item.kind];
      const tall = plat.item.kind === 'spring' ? 14 : plat.item.kind === 'trampoline' ? 10 : 24;
      return { x: plat.x + plat.item.dx, y: plat.y - tall, w: size, h: tall };
    }

    function springLift(plat, p) {
      if (!plat.item || plat.item.used || (plat.item.kind !== 'spring' && plat.item.kind !== 'trampoline')) return 0;
      const b = itemBox(plat);
      return feetOverlap(p, b.x, b.x + b.w) ? plat.y - b.y : 0;
    }

    function addBonus(points, x, y) {
      s.bonus += points;
      emit('points', { value: points, x, y });
    }

    function die(cause, data) {
      if (s.phase !== 'play') return;
      s.phase = 'dying';
      s.cause = cause;
      s.timer = cause === 'fall' ? 80 : cause === 'blackhole' ? 60 : 90;
      s.player.alive = false;
      s.player.power = null;
      if (cause === 'hit') { s.player.vy = -6; s.player.vx *= 0.3; }
      emit('death', Object.assign({ cause, x: s.player.x + PLAYER.w / 2, y: s.player.y + PLAYER.h / 2 }, data || {}));
    }

    function land(plat) {
      const p = s.player;
      if (plat.kind === 'trap') {
        plat.state = 'broken';
        plat.vy = 1;
        emit('trap', { x: plat.x + plat.w / 2, y: plat.y });
        return;
      }
      p.y = plat.y - PLAYER.h;
      let kind = 'bounce';
      if (plat.item && !plat.item.used && (plat.item.kind === 'spring' || plat.item.kind === 'trampoline')) {
        const b = itemBox(plat);
        if (feetOverlap(p, b.x, b.x + b.w)) {
          kind = plat.item.kind;
          p.y = b.y - PLAYER.h;
          plat.item.anim = 1;
        }
      }
      if (kind === 'spring') p.vy = PHYS.spring;
      else if (kind === 'trampoline') p.vy = PHYS.trampoline;
      else if (p.shoes > 0) { p.vy = PHYS.shoes; p.shoes--; kind = 'shoes'; }
      else p.vy = PHYS.jump;
      emit(kind, { x: p.x + PLAYER.w / 2, y: plat.y, platform: plat.kind });
      if (plat.kind === 'fragile') {
        plat.state = 'broken';
        plat.vy = 1;
        emit('crack', { x: plat.x + plat.w / 2, y: plat.y });
      } else if (plat.kind === 'cloud') {
        plat.state = 'gone';
        emit('poof', { x: plat.x + plat.w / 2, y: plat.y });
      }
    }

    function pickUp(plat) {
      const p = s.player;
      const kind = plat.item.kind;
      plat.item.used = true;
      if (kind === 'jetpack' || kind === 'propeller') {
        p.power = { kind, frames: POWER[kind].frames };
        p.vy = POWER[kind].vy;
      } else if (kind === 'shoes') p.shoes = POWER.shoes;
      else if (kind === 'shield') p.shield = POWER.shield;
      emit('pickup', { item: kind, x: plat.x + plat.item.dx + ITEM[kind] / 2, y: plat.y - 12 });
    }

    function updatePlatforms() {
      for (const plat of s.platforms) {
        plat.prevY = plat.y;
        plat.t++;
        if (plat.state === 'broken') {
          plat.vy = (plat.vy || 1) + 0.5;
          plat.y += plat.vy;
          continue;
        }
        if (plat.state !== 'ok') continue;
        if (plat.kind === 'moving') {
          plat.x += plat.vx;
          if (plat.x < 0 || plat.x + plat.w > W) {
            plat.vx = -plat.vx;
            plat.x = Math.max(0, Math.min(W - plat.w, plat.x));
          }
        } else if (plat.kind === 'vertical') {
          plat.phase += plat.speed;
          plat.y = plat.baseY + Math.sin(plat.phase) * plat.range;
        }
        if (plat.item && plat.item.anim > 0) plat.item.anim = Math.max(0, plat.item.anim - 0.06);
      }
    }

    function updateMonsters() {
      for (const m of s.monsters) {
        m.t += 1;
        if (!m.alive) { m.y += 6; continue; }
        if (m.kind === 'flyer') {
          m.x += m.vx;
          if (m.x < 0 || m.x + m.w > W) { m.vx = -m.vx; m.x = Math.max(0, Math.min(W - m.w, m.x)); }
        } else if (m.kind === 'ufo') {
          m.x = m.baseX + Math.sin(m.t * 0.03) * 24;
        }
      }
      for (const hole of s.holes) hole.t++;
    }

    function checkDangers() {
      const p = s.player;
      const cx = p.x + PLAYER.w / 2, cy = p.y + PLAYER.h / 2;
      for (const m of s.monsters) {
        if (!m.alive) continue;
        const mx = m.x + m.w / 2, my = m.y + m.h / 2;
        const dx = cx - mx, dy = cy - my;
        if (dx * dx + dy * dy > (m.r + 13) * (m.r + 13)) continue;
        if (p.power) {
          m.alive = false;
          emit('smash', { x: mx, y: my, monster: m.kind });
          addBonus(150, mx, my);
        } else if (p.vy > 0 && p.y + PLAYER.h <= my + 6) {
          m.alive = false;
          p.vy = PHYS.stomp;
          emit('stomp', { x: mx, y: my, monster: m.kind });
          addBonus(100, mx, my);
        } else if (p.shield > 0) {
          p.shield = 0;
          m.alive = false;
          emit('shieldHit', { x: mx, y: my, monster: m.kind });
        } else {
          die('hit', { monster: m.kind });
          return;
        }
      }
      for (const hole of s.holes) {
        const dx = cx - hole.x, dy = cy - hole.y;
        if (dx * dx + dy * dy > hole.r * hole.r) continue;
        if (p.shield > 0) {
          p.shield = 0;
          hole.gone = true;
          emit('shieldHit', { x: hole.x, y: hole.y, hole: true });
        } else if (!hole.gone) {
          p.hole = { x: hole.x, y: hole.y };
          die('blackhole', { x: hole.x, y: hole.y });
          return;
        }
      }
    }

    function updatePlayer(input) {
      const p = s.player;
      const dir = Math.max(-1, Math.min(1, input && input.dir ? input.dir : 0));
      if (dir) {
        p.vx = Math.max(-PHYS.maxVx, Math.min(PHYS.maxVx, p.vx + dir * PHYS.accel));
        p.facing = dir > 0 ? 1 : -1;
      } else {
        p.vx *= PHYS.friction;
        if (Math.abs(p.vx) < 0.05) p.vx = 0;
      }
      p.prevY = p.y;
      if (p.power) {
        p.vy = POWER[p.power.kind].vy;
        if (--p.power.frames <= 0) {
          emit('powerEnd', { item: p.power.kind });
          p.power = null;
        }
      } else {
        p.vy += PHYS.gravity;
      }
      p.y += p.vy;
      p.x += p.vx;
      if (p.x + PLAYER.w < 0) p.x += W + PLAYER.w;
      else if (p.x > W) p.x -= W + PLAYER.w;
      if (p.shield > 0) p.shield--;
      if (!p.power && p.vy > 0) {
        let best = null, bestTop = 0;
        for (const plat of s.platforms) {
          if (plat.state !== 'ok' || !feetOverlap(p, plat.x, plat.x + plat.w)) continue;
          const lift = springLift(plat, p);
          const top = plat.y - lift;
          if (p.prevY + PLAYER.h <= plat.prevY - lift + 1 && p.y + PLAYER.h >= top && (!best || top < bestTop)) {
            best = plat;
            bestTop = top;
          }
        }
        if (best) land(best);
      }
      for (const plat of s.platforms) {
        if (p.power || plat.state !== 'ok' || !plat.item || plat.item.used || plat.item.kind === 'spring' || plat.item.kind === 'trampoline') continue;
        const b = itemBox(plat);
        if (overlapsBox(p, b.x, b.y, b.w, b.h)) pickUp(plat);
      }
      checkDangers();
    }

    function updateCamera() {
      const target = s.player.y - H * 0.42;
      if (target < s.cameraY) s.cameraY += (target - s.cameraY) * 0.35;
    }

    function updateScore() {
      const h = Math.max(0, Math.floor(-s.cameraY / 5));
      if (h > s.heightScore) s.heightScore = h;
      s.score = s.heightScore + s.bonus;
      while (s.milestone + 1 < MILESTONES.length && s.score >= MILESTONES[s.milestone + 1].score) {
        s.milestone++;
        emit('milestone', { title: MILESTONES[s.milestone].title, index: s.milestone });
      }
    }

    function cull() {
      const limit = s.cameraY + H + 140;
      s.platforms = s.platforms.filter(p => p.y < limit && p.state !== 'gone');
      s.monsters = s.monsters.filter(m => m.y < limit);
      s.holes = s.holes.filter(h => h.y < limit && !h.gone);
    }

    function step(input) {
      s.events.length = 0;
      s.frame++;
      if (s.phase === 'play') {
        updatePlatforms();
        updateMonsters();
        updatePlayer(input);
        if (s.phase === 'play') {
          updateCamera();
          updateScore();
          fillAbove();
          if (s.player.y - s.cameraY > H + 40) die('fall');
          cull();
        }
      } else if (s.phase === 'dying') {
        updatePlatforms();
        updateMonsters();
        const p = s.player;
        if (s.cause === 'blackhole') {
          p.x += (p.hole.x - PLAYER.w / 2 - p.x) * 0.15;
          p.y += (p.hole.y - PLAYER.h / 2 - p.y) * 0.15;
        } else {
          p.vy = Math.min(p.vy + PHYS.gravity, 14);
          p.y += p.vy;
          if (s.cause === 'fall') s.cameraY += Math.max(0, p.y - H * 0.55 - s.cameraY) * 0.12;
        }
        if (--s.timer <= 0) {
          s.phase = 'over';
          emit('over', { score: s.score });
        }
      }
      return s.events;
    }

    return { state: s, start, step };
  }

  root.DoodleCore = { create, W, H, PHYS, PLAYER, PLAT, POWER, MONSTER, ITEM, HOLE_R, MILESTONES };
})(typeof window !== 'undefined' ? window : globalThis);
