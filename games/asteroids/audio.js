(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'asteroids_music', musicVolume: 0.45 });
  const { tone, noise, arpeggio } = synth;
  const PAD = [[110, 130.81, 164.81], [98, 123.47, 146.83], [87.31, 110, 130.81], [98, 116.54, 146.83]];
  let pace = 1;
  const loops = { thrust: null, ufo: null };
  synth.onReset(() => { loops.thrust = null; loops.ufo = null; });

  const SOUNDS = {
    fire(c, t, pierce) {
      tone(c, 'square', pierce ? 1500 : 1250, t, 0.09, 0.03, { to: pierce ? 520 : 360 });
      tone(c, 'sine', 2200, t, 0.05, 0.015, { to: 900 });
    },
    bang(c, t, size) {
      const s = size === 'large' ? 1 : size === 'medium' ? 0.7 : 0.45;
      noise(c, t, 0.25 + s * 0.45, 0.1 + s * 0.08, { filter: 'lowpass', freq: 2600 - s * 1400, to: 90 });
      tone(c, 'sine', 120 / s, t, 0.2 + s * 0.3, 0.12 * s + 0.03, { to: 40 / s });
    },
    clank(c, t) {
      tone(c, 'square', 300, t, 0.07, 0.04, { to: 220 });
      tone(c, 'triangle', 2300, t, 0.14, 0.03, { to: 1900 });
      noise(c, t, 0.05, 0.04, { filter: 'bandpass', freq: 3200, q: 4 });
    },
    crystal(c, t) {
      arpeggio(c, 'triangle', [1568, 2093, 2637], 0.04, 0.05, t);
    },
    ufoDown(c, t) {
      noise(c, t, 0.6, 0.15, { filter: 'lowpass', freq: 3000, to: 120 });
      arpeggio(c, 'square', [880, 660, 440, 220], 0.05, 0.035, t);
    },
    shipDown(c, t) {
      noise(c, t, 1.1, 0.2, { filter: 'lowpass', freq: 2000, to: 60 });
      tone(c, 'sawtooth', 220, t, 0.9, 0.06, { to: 30 });
      tone(c, 'sine', 90, t, 0.9, 0.16, { to: 25 });
    },
    hyperspace(c, t) {
      tone(c, 'sine', 200, t, 0.35, 0.07, { to: 1800 });
      tone(c, 'triangle', 1800, t + 0.3, 0.3, 0.05, { to: 300 });
      noise(c, t, 0.4, 0.03, { filter: 'bandpass', freq: 800, to: 5000, q: 3 });
    },
    powerup(c, t) {
      arpeggio(c, 'triangle', [659, 880, 1109, 1319], 0.05, 0.055, t);
    },
    shield(c, t) {
      tone(c, 'sine', 600, t, 0.25, 0.07, { to: 240, vibrato: 18 });
      noise(c, t, 0.15, 0.04, { filter: 'highpass', freq: 2500 });
    },
    extraLife(c, t) {
      arpeggio(c, 'square', [523, 659, 784, 1047, 1319], 0.07, 0.035, t);
      arpeggio(c, 'triangle', [523, 659, 784, 1047, 1319], 0.07, 0.05, t);
    },
    wave(c, t) {
      arpeggio(c, 'triangle', [330, 440, 554, 659], 0.07, 0.06, t);
    },
    gameover(c, t) {
      const notes = [[294, 0.22], [247, 0.22], [196, 0.22], [147, 0.6]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'sawtooth', f, at, d * 0.95, 0.05); tone(c, 'triangle', f / 2, at, d, 0.07); at += d; });
    },
    start(c, t) {
      tone(c, 'sine', 180, t, 0.4, 0.07, { to: 900 });
      noise(c, t, 0.35, 0.03, { filter: 'bandpass', freq: 500, to: 3500, q: 2 });
    }
  };

  function scheduleStep(c, step, at, dur) {
    const beat = step % 2;
    tone(c, 'triangle', beat ? 46.25 : 49, at, Math.min(0.2, dur * 0.7), 0.22, { dest: 'music' });
    tone(c, 'square', beat ? 92.5 : 98, at, Math.min(0.08, dur * 0.4), 0.02, { dest: 'music' });
    if (step % 16 === 0) PAD[Math.floor(step / 16) % 4].forEach(f => tone(c, 'sine', f * 2, at, dur * 15, 0.01, { dest: 'music', attack: 0.5 }));
    if (pace > 1.8 && step % 2 === 1) noise(c, at, 0.03, 0.012, { filter: 'highpass', freq: 7000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 0.7, 64);

  function startLoop(kind, small) {
    const c = synth.context && synth.ready();
    if (!c || loops[kind] || (root.GamePlatform && root.GamePlatform.isMuted())) return;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.connect(synth.sfxBus);
    const nodes = [];
    if (kind === 'thrust') {
      const len = Math.floor(c.sampleRate * 1);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      src.connect(filter);
      filter.connect(gain);
      src.start();
      nodes.push(src);
      gain.gain.setTargetAtTime(0.09, c.currentTime, 0.04);
    } else {
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = small ? 820 : 430;
      const lfo = c.createOscillator();
      lfo.frequency.value = small ? 11 : 6;
      const depth = c.createGain();
      depth.gain.value = small ? 160 : 110;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1700;
      osc.connect(filter);
      filter.connect(gain);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
      gain.gain.setTargetAtTime(0.028, c.currentTime, 0.08);
    }
    loops[kind] = { gain, nodes };
  }

  function stopLoop(kind) {
    const v = loops[kind];
    if (!v) return;
    loops[kind] = null;
    const c = synth.context;
    if (c) v.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.05);
    setTimeout(() => v.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 400);
  }

  root.AsteroidsAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    setPace(p) {
      pace = p;
      synth.music.setStepSeconds(Math.max(0.16, 0.7 / p));
    },
    thrust(on) { if (on) startLoop('thrust'); else stopLoop('thrust'); },
    ufo(on, small) { if (on) startLoop('ufo', small); else stopLoop('ufo'); },
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
