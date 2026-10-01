(function (root) {
  'use strict';

  const FIELD = 208;
  const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const EAGLE = { x: 96, y: 192, w: 16, h: 16 };
  const PLAYER_SPAWN = { x: 64, y: 192 };
  const ENEMY_SPAWN_X = [0, 96, 192];
  const RING = [[11, 23], [11, 24], [11, 25], [12, 23], [13, 23], [14, 23], [14, 24], [14, 25]];
  const ENEMY_TYPES = ['basic', 'fast', 'power', 'armor'];
  const STATS = {
    basic: { speed: 0.5, bullet: 2.5, hp: 1, points: 100 },
    fast: { speed: 1, bullet: 2.5, hp: 1, points: 200 },
    power: { speed: 0.75, bullet: 4.5, hp: 1, points: 300 },
    armor: { speed: 0.5, bullet: 2.5, hp: 4, points: 400 }
  };
  const POWERUPS = ['star', 'grenade', 'helmet', 'shovel', 'clock', 'tank'];
  const BONUS_INDEXES = [3, 10, 17];
  const TIMINGS = {
    curtain: 120, clear: 180, tally: 330, gameover: 210, spawn: 60, respawn: 60,
    spawnShield: 180, helmet: 600, clock: 600, shovel: 1200, shovelWarn: 180, powerupLife: 1200
  };
  const PLAYER_SPEED = 0.75;
  const EXTRA_LIFE_EVERY = 20000;
  const MAX_ENEMIES = 4;
  const FULL = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const HALVES = { L: [[0, 0], [0, 1]], R: [[1, 0], [1, 1]], U: [[0, 0], [1, 0]], D: [[0, 1], [1, 1]] };
  const NO_INPUT = { dir: -1, fire: false };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function create(options) {
    const opts = options || {};
    const stages = opts.stages || root.BattleCityStages;
    const rand = mulberry32(opts.seed != null ? opts.seed : Math.floor(Math.random() * 4294967296));

    const bricks = new Uint8Array(52 * 52);
    const steel = new Uint8Array(26 * 26);
    const water = new Uint8Array(26 * 26);
    const trees = new Uint8Array(26 * 26);
    const ice = new Uint8Array(26 * 26);

    const s = {
      phase: 'idle', timer: 0, frame: 0, stageTime: 0,
      stage: 0, stageName: '', score: 0, lives: 3, nextLifeAt: EXTRA_LIFE_EVERY,
      eagleAlive: true, player: null, enemies: [], bullets: [], powerup: null,
      reserve: [], spawned: 0, spawnTimer: 0, spawnSlot: 0,
      freeze: 0, shovel: 0,
      kills: { basic: 0, fast: 0, power: 0, armor: 0 },
      events: [],
      bricks, steel, water, trees, ice
    };

    function emit(type, data) {
      s.events.push(Object.assign({}, data, { type }));
    }

    function setPhase(phase, timer) {
      s.phase = phase;
      s.timer = timer;
    }

    function setBrickBlock(bx, by, on) {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) bricks[(by * 2 + j) * 52 + bx * 2 + i] = on ? 1 : 0;
    }

    function setRing(kind) {
      for (const [bx, by] of RING) {
        const k = by * 26 + bx;
        steel[k] = kind === 'steel' ? 1 : 0;
        water[k] = trees[k] = ice[k] = 0;
        setBrickBlock(bx, by, kind === 'brick');
      }
    }

    function loadMap(map) {
      bricks.fill(0); steel.fill(0); water.fill(0); trees.fill(0); ice.fill(0);
      for (let ty = 0; ty < 13; ty++) {
        for (let tx = 0; tx < 13; tx++) {
          const c = map[ty][tx];
          if (c === '.') continue;
          let kind = c;
          let cells = FULL;
          if (HALVES[c]) { kind = 'B'; cells = HALVES[c]; }
          else if (HALVES[c.toUpperCase()]) { kind = 'S'; cells = HALVES[c.toUpperCase()]; }
          for (const [i, j] of cells) {
            const bx = tx * 2 + i, by = ty * 2 + j, k = by * 26 + bx;
            if (kind === 'B') setBrickBlock(bx, by, true);
            else if (kind === 'S') steel[k] = 1;
            else if (kind === 'W') water[k] = 1;
            else if (kind === 'T') trees[k] = 1;
            else if (kind === 'I') ice[k] = 1;
          }
        }
      }
      setRing('brick');
    }

    function tanks() {
      return s.player ? [s.player].concat(s.enemies) : s.enemies;
    }

    function terrainBlocksTank(x, y) {
      if (x < 0 || y < 0 || x > FIELD - 16 || y > FIELD - 16) return true;
      for (let by = y >> 2; by <= (y + 15) >> 2; by++) {
        for (let bx = x >> 2; bx <= (x + 15) >> 2; bx++) if (bricks[by * 52 + bx]) return true;
      }
      for (let cy = y >> 3; cy <= (y + 15) >> 3; cy++) {
        for (let cx = x >> 3; cx <= (x + 15) >> 3; cx++) {
          const k = cy * 26 + cx;
          if (steel[k] || water[k]) return true;
        }
      }
      return overlaps(x, y, 16, 16, EAGLE.x, EAGLE.y, EAGLE.w, EAGLE.h);
    }

    function tankBlocked(t, x, y) {
      if (terrainBlocksTank(x, y)) return true;
      for (const o of tanks()) {
        if (o === t || !o.alive) continue;
        if (overlaps(x, y, 16, 16, o.x, o.y, 16, 16) && !overlaps(t.x, t.y, 16, 16, o.x, o.y, 16, 16)) return true;
      }
      return false;
    }

    function stepTank(t) {
      const nx = t.x + DX[t.dir], ny = t.y + DY[t.dir];
      if (tankBlocked(t, nx, ny)) return false;
      t.x = nx;
      t.y = ny;
      return true;
    }

    function advance(t, speed) {
      t.acc += speed;
      let moved = 0;
      while (t.acc >= 1) {
        t.acc -= 1;
        if (!stepTank(t)) {
          t.acc = 0;
          return { moved, blocked: true };
        }
        moved++;
      }
      return { moved, blocked: false };
    }

    function turn(t, dir) {
      if (dir === t.dir) return;
      if ((dir & 1) !== (t.dir & 1)) {
        const horizontal = (t.dir & 1) === 1;
        const v = horizontal ? t.x : t.y;
        const options = [Math.round(v / 8) * 8, Math.floor(v / 8) * 8, Math.ceil(v / 8) * 8];
        for (const snapped of options) {
          const nx = horizontal ? snapped : t.x;
          const ny = horizontal ? t.y : snapped;
          if (snapped === v || !tankBlocked(t, nx, ny)) {
            t.x = nx;
            t.y = ny;
            break;
          }
        }
      }
      t.dir = dir;
      t.acc = 0;
    }

    function onIce(t) {
      return !!ice[((t.y + 8) >> 3) * 26 + ((t.x + 8) >> 3)];
    }

    function spawnPlayer() {
      const star = s.player ? s.player.star : 0;
      s.player = {
        kind: 'player', x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, dir: UP, acc: 0, alive: true,
        spawning: TIMINGS.spawn, shield: 0, bullets: 0, cooldown: 0, slide: 0, moving: false,
        tread: 0, dead: 0, star
      };
    }

    function shuffledReserve(mix) {
      const list = [];
      mix.forEach((count, i) => { for (let n = 0; n < count; n++) list.push(ENEMY_TYPES[i]); });
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
      }
      return list;
    }

    function spawnInterval() {
      return Math.max(60, 190 - s.stage * 8);
    }

    function fireChance() {
      return Math.min(0.03, 0.005 + s.stage * 0.0015);
    }

    function startStage(n) {
      const def = stages[(n - 1) % stages.length];
      s.stage = n;
      s.stageName = def.name;
      loadMap(def.map);
      s.reserve = shuffledReserve(n > stages.length && stages.loopMix ? stages.loopMix : def.mix);
      s.spawned = 0;
      s.spawnSlot = 0;
      s.spawnTimer = 20;
      s.enemies = [];
      s.bullets = [];
      s.powerup = null;
      s.freeze = 0;
      s.shovel = 0;
      s.kills = { basic: 0, fast: 0, power: 0, armor: 0 };
      s.eagleAlive = true;
      s.stageTime = 0;
      spawnPlayer();
      setPhase('curtain', TIMINGS.curtain);
      emit('stage', { stage: n });
    }

    function startGame() {
      s.score = 0;
      s.lives = 3;
      s.nextLifeAt = EXTRA_LIFE_EVERY;
      s.player = null;
      startStage(1);
    }

    function addScore(points, x, y) {
      s.score += points;
      emit('points', { value: points, x, y });
      while (s.score >= s.nextLifeAt) {
        s.lives++;
        s.nextLifeAt += EXTRA_LIFE_EVERY;
        emit('extraLife', {});
      }
    }

    function gameOver(reason) {
      if (s.phase === 'gameover' || s.phase === 'over') return;
      setPhase('gameover', TIMINGS.gameover);
      emit('gameOver', { reason });
    }

    function fire(t) {
      const isPlayer = t.kind === 'player';
      const max = isPlayer && t.star >= 2 ? 2 : 1;
      if (t.bullets >= max || t.cooldown > 0) return false;
      const b = {
        owner: t, player: isPlayer, dir: t.dir, acc: 0, alive: true,
        x: t.x + 8 + DX[t.dir] * 6, y: t.y + 8 + DY[t.dir] * 6,
        speed: isPlayer ? (t.star >= 1 ? 5 : 3) : t.bulletSpeed,
        power: isPlayer && t.star >= 3 ? 2 : 1
      };
      s.bullets.push(b);
      t.bullets++;
      t.cooldown = isPlayer ? 8 : 20;
      emit(isPlayer ? 'fire' : 'enemyFire', { x: b.x, y: b.y });
      collideBullet(b);
      return true;
    }

    function killBullet(b) {
      if (!b.alive) return;
      b.alive = false;
      b.owner.bullets = Math.max(0, b.owner.bullets - 1);
    }

    function blast(b, grid, size, cells, depth) {
      const vertical = b.dir === UP || b.dir === DOWN;
      const across = vertical ? b.x : b.y;
      const lead = (b.dir === UP ? b.y - 2 : b.dir === DOWN ? b.y + 1 : b.dir === LEFT ? b.x - 2 : b.x + 1);
      const from = Math.max(0, Math.floor((across - 8) / size));
      const to = Math.min(cells - 1, Math.floor((across + 7) / size));
      const step = vertical ? DY[b.dir] : DX[b.dir];
      let line = Math.floor(lead / size);
      for (let n = 0; n < depth; n++, line += step) {
        if (line < 0 || line >= cells) continue;
        for (let k = from; k <= to; k++) {
          if (vertical) grid[line * cells + k] = 0;
          else grid[k * cells + line] = 0;
        }
      }
    }

    function collideBullet(b) {
      const x0 = b.x - 2, y0 = b.y - 2;
      if (x0 < 0 || y0 < 0 || x0 + 4 > FIELD || y0 + 4 > FIELD) {
        killBullet(b);
        emit('wall', { x: Math.max(0, Math.min(FIELD, b.x)), y: Math.max(0, Math.min(FIELD, b.y)), player: b.player });
        return;
      }
      let hitBrick = false, hitSteel = false;
      for (let by = y0 >> 2; by <= (y0 + 3) >> 2; by++) {
        for (let bx = x0 >> 2; bx <= (x0 + 3) >> 2; bx++) if (bricks[by * 52 + bx]) hitBrick = true;
      }
      for (let cy = y0 >> 3; cy <= (y0 + 3) >> 3; cy++) {
        for (let cx = x0 >> 3; cx <= (x0 + 3) >> 3; cx++) if (steel[cy * 26 + cx]) hitSteel = true;
      }
      if (hitBrick || hitSteel) {
        if (hitBrick) blast(b, bricks, 4, 52, 2);
        if (hitSteel && b.power >= 2) blast(b, steel, 8, 26, 1);
        killBullet(b);
        emit(hitSteel && b.power < 2 ? 'steel' : 'brick', { x: b.x, y: b.y, player: b.player });
        return;
      }
      if (s.eagleAlive && overlaps(x0, y0, 4, 4, EAGLE.x, EAGLE.y, EAGLE.w, EAGLE.h)) {
        killBullet(b);
        s.eagleAlive = false;
        emit('eagle', { x: EAGLE.x + 8, y: EAGLE.y + 8 });
        gameOver('eagle');
        return;
      }
      if (b.player) {
        for (const e of s.enemies) {
          if (!e.alive || e.spawning) continue;
          if (overlaps(x0, y0, 4, 4, e.x + 1, e.y + 1, 14, 14)) {
            killBullet(b);
            hitEnemy(e);
            return;
          }
        }
      } else {
        const p = s.player;
        if (p && p.alive && !p.spawning && overlaps(x0, y0, 4, 4, p.x + 1, p.y + 1, 14, 14)) {
          killBullet(b);
          if (p.shield > 0) emit('shieldHit', { x: b.x, y: b.y });
          else killPlayer();
          return;
        }
      }
      for (const o of s.bullets) {
        if (o === b || !o.alive || o.player === b.player) continue;
        if (overlaps(x0, y0, 4, 4, o.x - 2, o.y - 2, 4, 4)) {
          killBullet(b);
          killBullet(o);
          emit('clash', { x: b.x, y: b.y });
          return;
        }
      }
    }

    function updateBullet(b) {
      b.acc += b.speed;
      while (b.acc >= 1 && b.alive) {
        b.acc -= 1;
        b.x += DX[b.dir];
        b.y += DY[b.dir];
        collideBullet(b);
      }
    }

    function hitEnemy(e) {
      if (e.bonus) {
        e.bonus = false;
        spawnPowerup();
      }
      e.hp--;
      if (e.hp > 0) {
        emit('armorHit', { x: e.x + 8, y: e.y + 8 });
        return;
      }
      destroyEnemy(e, true);
    }

    function destroyEnemy(e, scored) {
      e.alive = false;
      if (scored) {
        s.kills[e.type]++;
        addScore(STATS[e.type].points, e.x + 8, e.y + 8);
      }
      emit('enemyDown', { x: e.x + 8, y: e.y + 8, enemy: e.type, scored });
    }

    function killPlayer() {
      const p = s.player;
      p.alive = false;
      p.star = 0;
      p.dead = TIMINGS.respawn;
      s.lives--;
      emit('playerDown', { x: p.x + 8, y: p.y + 8 });
      if (s.lives <= 0) gameOver('lives');
    }

    function spawnPowerup() {
      const type = POWERUPS[Math.floor(rand() * POWERUPS.length)];
      let x = 0, y = 0;
      for (let tries = 0; tries < 40; tries++) {
        x = Math.floor(rand() * 13) * 16;
        y = Math.floor(rand() * 12) * 16;
        if (overlaps(x, y, 16, 16, EAGLE.x - 16, EAGLE.y - 16, 48, 32)) continue;
        let solid = false;
        for (const [i, j] of FULL) {
          const k = ((y >> 3) + j) * 26 + (x >> 3) + i;
          if (steel[k] || water[k]) solid = true;
        }
        if (!solid) break;
      }
      s.powerup = { type, x, y, life: TIMINGS.powerupLife };
      emit('powerupSpawn', { powerup: type, x: x + 8, y: y + 8 });
    }

    function applyPowerup() {
      const p = s.player;
      const pu = s.powerup;
      s.powerup = null;
      if (pu.type === 'star') p.star = Math.min(3, p.star + 1);
      else if (pu.type === 'helmet') p.shield = TIMINGS.helmet;
      else if (pu.type === 'clock') s.freeze = TIMINGS.clock;
      else if (pu.type === 'tank') { s.lives++; emit('extraLife', {}); }
      else if (pu.type === 'shovel') { s.shovel = TIMINGS.shovel; setRing('steel'); }
      else if (pu.type === 'grenade') {
        for (const e of s.enemies) if (e.alive && !e.spawning) destroyEnemy(e, false);
      }
      emit('powerup', { powerup: pu.type, x: pu.x + 8, y: pu.y + 8 });
      addScore(500, pu.x + 8, pu.y + 8);
    }

    function updatePlayer(input) {
      const p = s.player;
      if (!p) return;
      if (!p.alive) {
        if (p.dead > 0 && --p.dead === 0 && s.lives > 0 && s.phase !== 'gameover' && s.phase !== 'over') spawnPlayer();
        return;
      }
      if (p.spawning > 0) {
        if (--p.spawning === 0) p.shield = Math.max(p.shield, TIMINGS.spawnShield);
        return;
      }
      if (p.shield > 0) p.shield--;
      if (p.cooldown > 0) p.cooldown--;
      let moving = false;
      if (input.dir >= 0) {
        turn(p, input.dir);
        advance(p, PLAYER_SPEED);
        moving = true;
        p.slide = onIce(p) ? 16 : 0;
      } else if (p.slide > 0) {
        const r = advance(p, PLAYER_SPEED);
        p.slide = r.blocked ? 0 : p.slide - r.moved;
        moving = r.moved > 0;
      }
      p.moving = moving;
      if (moving && (s.frame & 3) === 0) p.tread ^= 1;
      if (input.fire) fire(p);
      const pu = s.powerup;
      if (pu && overlaps(p.x, p.y, 16, 16, pu.x, pu.y, 16, 16)) applyPowerup();
    }

    function pickDir(e, blocked) {
      const r = rand();
      let dir;
      const rush = Math.min(0.4, 0.03 + s.stage * 0.01 + s.stageTime / 3600 * 0.2);
      if (r < rush) {
        const dx = EAGLE.x - e.x, dy = EAGLE.y - e.y;
        dir = Math.abs(dx) > 8 && rand() < 0.4 ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP);
      } else if (r < rush + 0.06 && s.player && s.player.alive) {
        const dx = s.player.x - e.x, dy = s.player.y - e.y;
        dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP);
      } else {
        dir = Math.floor(rand() * 4);
      }
      if (blocked && dir === e.dir) dir = (e.dir + 1 + Math.floor(rand() * 3)) % 4;
      return dir;
    }

    function updateEnemy(e) {
      if (e.spawning > 0) {
        e.spawning--;
        return;
      }
      if (e.cooldown > 0) e.cooldown--;
      if (s.freeze > 0) return;
      if (e.bullets === 0 && rand() < fireChance()) fire(e);
      e.turnTimer--;
      e.acc += e.speed;
      while (e.acc >= 1) {
        e.acc -= 1;
        if (e.turnTimer <= 0 && e.x % 8 === 0 && e.y % 8 === 0) {
          turn(e, pickDir(e, false));
          e.turnTimer = 90 + Math.floor(rand() * 210);
        }
        if (!stepTank(e)) {
          if (e.bullets === 0 && rand() < 0.12) fire(e);
          turn(e, pickDir(e, true));
          break;
        }
        if ((s.frame & 3) === 0) e.tread ^= 1;
      }
    }

    function spotTaken(x, y) {
      return tanks().some(t => t.alive && overlaps(x, y, 16, 16, t.x, t.y, 16, 16));
    }

    function spawnEnemies() {
      if (!s.reserve.length) return;
      if (s.spawnTimer > 0) {
        s.spawnTimer--;
        return;
      }
      if (s.enemies.length >= MAX_ENEMIES) return;
      for (let tries = 0; tries < 3; tries++) {
        const x = ENEMY_SPAWN_X[s.spawnSlot % 3];
        s.spawnSlot++;
        if (spotTaken(x, 0)) continue;
        const type = s.reserve.shift();
        const st = STATS[type];
        s.enemies.push({
          kind: 'enemy', type, x, y: 0, dir: DOWN, acc: 0, alive: true, spawning: TIMINGS.spawn,
          hp: st.hp, speed: st.speed, bulletSpeed: st.bullet, bullets: 0, cooldown: 0,
          bonus: BONUS_INDEXES.includes(s.spawned), turnTimer: 30 + Math.floor(rand() * 90), tread: 0
        });
        s.spawned++;
        s.spawnTimer = spawnInterval();
        emit('enemySpawn', { x: x + 8, y: 8 });
        return;
      }
    }

    function updateWorld(input) {
      if (s.phase === 'play') s.stageTime++;
      updatePlayer(s.phase === 'gameover' ? NO_INPUT : input);
      if (s.phase === 'play') spawnEnemies();
      for (const e of s.enemies) if (e.alive) updateEnemy(e);
      for (const b of s.bullets) if (b.alive) updateBullet(b);
      s.bullets = s.bullets.filter(b => b.alive);
      s.enemies = s.enemies.filter(e => e.alive);
      if (s.powerup && --s.powerup.life <= 0) s.powerup = null;
      if (s.freeze > 0) s.freeze--;
      if (s.shovel > 0 && --s.shovel === 0) {
        setRing('brick');
        emit('shovelEnd', {});
      }
      if (s.phase === 'play') {
        if (!s.reserve.length && !s.enemies.length) setPhase('clear', TIMINGS.clear);
      } else if (s.phase === 'clear') {
        if (--s.timer <= 0) {
          setPhase('tally', TIMINGS.tally);
          emit('tally', {});
        }
      } else if (s.phase === 'gameover') {
        if (--s.timer <= 0) {
          setPhase('over', 0);
          emit('over', {});
        }
      }
    }

    function step(input) {
      s.events.length = 0;
      s.frame++;
      if (s.phase === 'curtain') {
        if (--s.timer <= 0) setPhase('play', 0);
      } else if (s.phase === 'tally') {
        if (--s.timer <= 0) startStage(s.stage + 1);
      } else if (s.phase === 'play' || s.phase === 'clear' || s.phase === 'gameover') {
        updateWorld(input || NO_INPUT);
      }
      return s.events;
    }

    return {
      state: s,
      startGame,
      startStage,
      step,
      isRingWarning: () => s.shovel > 0 && s.shovel < TIMINGS.shovelWarn,
      ringCells: RING
    };
  }

  root.BattleCityCore = {
    create, STATS, TIMINGS, FIELD, EAGLE, ENEMY_TYPES, UP, RIGHT, DOWN, LEFT, DX, DY
  };
})(typeof window !== 'undefined' ? window : globalThis);
