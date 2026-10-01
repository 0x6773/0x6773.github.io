(function (root) {
  'use strict';

  const MUSIC_KEY = 'battlecity_music';
  const NOTE = {
    E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0,
    A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, Gs5: 830.61, A5: 880.0
  };
  const CHORDS = ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'G2', 'E2'];
  const LEAD = [
    'E5', '', 'A5', 'G5', 'E5', '', 'D5', 'E5',
    'C5', '', 'F5', 'E5', 'C5', '', 'A4', 'C5',
    'E5', '', 'G5', 'E5', 'C5', 'D5', 'E5', '',
    'D5', '', 'B4', 'D5', 'G5', '', 'D5', '',
    'A5', '', 'G5', 'A5', 'E5', '', 'G5', 'E5',
    'F5', '', 'E5', 'C5', 'A4', '', 'C5', 'E5',
    'D5', '', 'G5', 'D5', 'B4', '', 'D5', 'G5',
    'E5', '', 'B4', 'E5', 'Gs5', '', 'E5', ''
  ];
  const BASS_SHAPE = [0, -1, 0, 12, 0, -1, 12, 7];
  const EIGHTH = 60 / 132 / 2;

  let context = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;
  let engineNodes = null;
  let musicEnabled = readMusicSetting();
  let musicPlaying = false;
  let musicStep = 0;
  let musicTime = 0;

  function readMusicSetting() {
    try { return localStorage.getItem(MUSIC_KEY) !== '0'; } catch (e) { return true; }
  }

  function muted() {
    return !!(root.GamePlatform && root.GamePlatform.isMuted());
  }

  function paused() {
    return !!(root.GameEngine && root.GameEngine.isPaused());
  }

  function ready() {
    const c = root.GameEngine && root.GameEngine.audio();
    if (!c) return null;
    if (c !== context) {
      context = c;
      master = c.createGain();
      master.connect(c.destination);
      sfxBus = c.createGain();
      sfxBus.connect(master);
      musicBus = c.createGain();
      musicBus.gain.value = 0.5;
      musicBus.connect(master);
      const length = Math.floor(c.sampleRate * 2);
      noiseBuffer = c.createBuffer(1, length, c.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      engineNodes = null;
    }
    master.gain.setTargetAtTime(muted() ? 0 : 1, c.currentTime, 0.02);
    return c;
  }

  function tone(c, type, freq, at, dur, vol, opts) {
    const o = opts || {};
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), at + dur);
    if (o.detune) osc.detune.setValueAtTime(o.detune, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + (o.attack || 0.004));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(o.dest || sfxBus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  function noise(c, at, dur, vol, opts) {
    const o = opts || {};
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = c.createBiquadFilter();
    filter.type = o.filter || 'lowpass';
    filter.frequency.setValueAtTime(o.freq || 2000, at);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    filter.Q.value = o.q || 0.8;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + (o.attack || 0.004));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(o.dest || sfxBus);
    src.start(at, Math.random() * 1.5, dur + 0.05);
  }

  function arpeggio(c, type, notes, step, vol, at, dur) {
    notes.forEach((f, i) => tone(c, type, f, at + i * step, dur || step * 1.6, vol));
  }

  const SOUNDS = {
    fire(c, t) {
      tone(c, 'square', 900, t, 0.07, 0.045, { to: 240 });
      tone(c, 'sine', 140, t, 0.09, 0.09, { to: 55 });
      noise(c, t, 0.05, 0.045, { filter: 'highpass', freq: 2500 });
    },
    enemyFire(c, t) {
      tone(c, 'square', 520, t, 0.05, 0.012, { to: 200 });
    },
    brick(c, t) {
      noise(c, t, 0.14, 0.11, { filter: 'bandpass', freq: 1800, to: 700, q: 1.2 });
      tone(c, 'sine', 95, t, 0.07, 0.08, { to: 50 });
    },
    steel(c, t) {
      tone(c, 'triangle', 1600, t, 0.16, 0.05);
      tone(c, 'square', 2390, t, 0.08, 0.02);
      noise(c, t, 0.03, 0.04, { filter: 'highpass', freq: 5000 });
    },
    armor(c, t) {
      tone(c, 'triangle', 230, t, 0.12, 0.08, { to: 150 });
      tone(c, 'square', 680, t, 0.06, 0.035);
      noise(c, t, 0.06, 0.06, { filter: 'bandpass', freq: 3000, q: 2 });
    },
    shield(c, t) {
      tone(c, 'sine', 700, t, 0.14, 0.05, { to: 1150 });
      noise(c, t, 0.04, 0.03, { filter: 'highpass', freq: 4000 });
    },
    clash(c, t) {
      tone(c, 'square', 1200, t, 0.05, 0.03, { to: 500 });
    },
    explode(c, t) {
      noise(c, t, 0.55, 0.17, { filter: 'lowpass', freq: 2400, to: 260 });
      tone(c, 'sine', 115, t, 0.5, 0.2, { to: 34 });
      noise(c, t + 0.05, 0.12, 0.06, { filter: 'highpass', freq: 3000 });
    },
    bigExplode(c, t) {
      noise(c, t, 1.0, 0.2, { filter: 'lowpass', freq: 2000, to: 150 });
      tone(c, 'sine', 90, t, 0.9, 0.24, { to: 24 });
      tone(c, 'sine', 70, t + 0.18, 0.7, 0.14, { to: 22 });
      noise(c, t + 0.1, 0.2, 0.07, { filter: 'highpass', freq: 2500 });
    },
    spawn(c, t) {
      noise(c, t, 0.45, 0.03, { filter: 'bandpass', freq: 300, to: 1600, q: 3, attack: 0.15 });
    },
    powerupSpawn(c, t) {
      arpeggio(c, 'triangle', [1319, 1760, 2093, 2637], 0.045, 0.05, t);
      arpeggio(c, 'triangle', [1319, 1760, 2093, 2637], 0.045, 0.02, t + 0.2);
    },
    pickup(c, t) {
      arpeggio(c, 'square', [523, 659, 784, 1047], 0.05, 0.045, t);
      [1047, 1319, 1568].forEach(f => tone(c, 'triangle', f, t + 0.22, 0.35, 0.03));
    },
    grenade(c, t) {
      noise(c, t, 0.4, 0.12, { filter: 'lowpass', freq: 500, to: 4000, attack: 0.3 });
      tone(c, 'sine', 80, t + 0.32, 0.6, 0.22, { to: 26 });
    },
    clock(c, t) {
      for (let i = 0; i < 4; i++) tone(c, 'square', i % 2 ? 1400 : 1000, t + i * 0.12, 0.04, 0.035);
    },
    shovel(c, t) {
      tone(c, 'triangle', 300, t, 0.12, 0.08, { to: 200 });
      tone(c, 'triangle', 450, t + 0.12, 0.16, 0.08, { to: 300 });
      noise(c, t, 0.1, 0.05, { filter: 'bandpass', freq: 2500, q: 2 });
    },
    life(c, t) {
      arpeggio(c, 'square', [784, 988, 1175, 1568], 0.085, 0.045, t);
      tone(c, 'triangle', 1568, t + 0.34, 0.4, 0.04);
    },
    stage(c, t) {
      const lead = [[392, 0.12], [523, 0.12], [659, 0.12], [784, 0.24], [659, 0.12], [784, 0.4]];
      let at = t;
      lead.forEach(([f, d]) => { tone(c, 'square', f, at, d * 0.95, 0.045); at += d; });
      [[130.81, 0.36], [196, 0.36], [261.63, 0.4]].reduce((a, [f, d]) => { tone(c, 'triangle', f, a, d, 0.08); return a + d; }, t);
    },
    clear(c, t) {
      const lead = [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.22], [988, 0.1], [1047, 0.45]];
      let at = t;
      lead.forEach(([f, d]) => { tone(c, 'square', f, at, d * 0.95, 0.045); tone(c, 'triangle', f / 2, at, d * 0.95, 0.06); at += d; });
    },
    tick(c, t) {
      tone(c, 'square', 1250, t, 0.03, 0.025);
    },
    gameover(c, t) {
      const notes = [[392, 0.2], [349, 0.2], [311, 0.2], [262, 0.5]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'square', f, at, d * 0.95, 0.04); tone(c, 'triangle', f / 2, at, d * 0.95, 0.07); at += d; });
      tone(c, 'sawtooth', 65, t, 1.4, 0.04, { attack: 0.2 });
    }
  };

  function sfx(name) {
    if (paused() || muted()) return;
    const c = ready();
    if (!c || !SOUNDS[name]) return;
    try { SOUNDS[name](c, c.currentTime + 0.005); } catch (e) { }
  }

  function engine(mode) {
    const c = context && ready();
    if (!c) return;
    const now = c.currentTime;
    if (mode === 'off') {
      if (engineNodes) {
        const n = engineNodes;
        engineNodes = null;
        n.gain.gain.setTargetAtTime(0.0001, now, 0.05);
        setTimeout(() => { try { n.osc.stop(); n.lfo.stop(); } catch (e) { } }, 400);
      }
      return;
    }
    if (!engineNodes) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 46;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      const lfo = c.createOscillator();
      lfo.frequency.value = 9;
      const depth = c.createGain();
      depth.gain.value = 0.01;
      lfo.connect(depth);
      depth.connect(gain.gain);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(sfxBus);
      osc.start();
      lfo.start();
      engineNodes = { osc, gain, lfo };
    }
    const moving = mode === 'move';
    engineNodes.osc.frequency.setTargetAtTime(moving ? 66 : 46, now, 0.08);
    engineNodes.gain.gain.setTargetAtTime(moving ? 0.05 : 0.022, now, 0.1);
    engineNodes.lfo.frequency.setTargetAtTime(moving ? 16 : 9, now, 0.1);
  }

  function scheduleStep(c, step, at) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    const root = NOTE[CHORDS[bar]];
    const shape = BASS_SHAPE[beat];
    if (shape >= 0) tone(c, 'triangle', root * Math.pow(2, shape / 12), at, EIGHTH * 0.9, 0.09, { dest: musicBus });
    const lead = LEAD[(bar * 8 + beat) % LEAD.length];
    if (lead) {
      tone(c, 'square', NOTE[lead], at, EIGHTH * 0.8, 0.03, { dest: musicBus });
      tone(c, 'square', NOTE[lead], at, EIGHTH * 0.8, 0.012, { dest: musicBus, detune: 8 });
    }
    if (beat === 0 || beat === 4) tone(c, 'sine', 120, at, 0.12, 0.12, { to: 45, dest: musicBus });
    if (beat === 2 || beat === 6) noise(c, at, 0.1, 0.05, { filter: 'bandpass', freq: 1800, q: 0.9, dest: musicBus });
    if (beat % 2 === 1) noise(c, at, 0.035, 0.025, { filter: 'highpass', freq: 7000, dest: musicBus });
  }

  function update() {
    const c = context && ready();
    if (!c || !musicPlaying) return;
    if (!musicEnabled || muted()) return;
    if (musicTime < c.currentTime - 0.1) musicTime = c.currentTime + 0.05;
    while (musicTime < c.currentTime + 0.25) {
      scheduleStep(c, musicStep, musicTime);
      musicTime += EIGHTH;
      musicStep = (musicStep + 1) % 64;
    }
  }

  function startMusic() {
    const c = ready();
    if (!c || musicPlaying) return;
    musicPlaying = true;
    musicStep = 0;
    musicTime = c.currentTime + 0.1;
    musicBus.gain.cancelScheduledValues(c.currentTime);
    musicBus.gain.setValueAtTime(musicEnabled ? 0.5 : 0.0001, c.currentTime);
  }

  function stopMusic() {
    if (!musicPlaying) return;
    musicPlaying = false;
    if (context) {
      const now = context.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(musicBus.gain.value, now);
      musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    }
  }

  function setMusicEnabled(on) {
    musicEnabled = !!on;
    try { localStorage.setItem(MUSIC_KEY, musicEnabled ? '1' : '0'); } catch (e) { }
    if (context && musicBus) {
      const now = context.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setTargetAtTime(musicEnabled && musicPlaying ? 0.5 : 0.0001, now, 0.05);
    }
  }

  root.BattleCityAudio = {
    sfx,
    engine,
    update,
    music: {
      start: startMusic,
      stop: stopMusic,
      setEnabled: setMusicEnabled,
      isEnabled: () => musicEnabled,
      isPlaying: () => musicPlaying
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
