(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'tron_music', musicVolume: 0.4 });
  const { tone, noise, arpeggio } = synth;
  const ROOT = 110;
  const f = semis => ROOT * Math.pow(2, semis / 12);
  const CHORDS = [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]];
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
  let engine = null;
  synth.onReset(() => { engine = null; });

  const SOUNDS = {
    countdown(c, t) {
      tone(c, 'square', 440, t, 0.12, 0.05);
      tone(c, 'sine', 880, t, 0.12, 0.03);
    },
    go(c, t) {
      tone(c, 'square', 880, t, 0.22, 0.05);
      tone(c, 'sawtooth', 220, t, 0.4, 0.04, { to: 880 });
      noise(c, t, 0.3, 0.04, { filter: 'highpass', freq: 3000 });
    },
    turn(c, t) {
      tone(c, 'sine', 1500, t, 0.03, 0.01);
    },
    crash(c, t) {
      noise(c, t, 0.9, 0.2, { filter: 'lowpass', freq: 3000, to: 70 });
      tone(c, 'sawtooth', 300, t, 0.5, 0.07, { to: 40 });
      tone(c, 'sine', 90, t, 0.7, 0.16, { to: 25 });
    },
    roundWin(c, t) {
      arpeggio(c, 'square', [f(24), f(28), f(31), f(36)], 0.07, 0.035, t);
    },
    roundLose(c, t) {
      arpeggio(c, 'triangle', [f(19), f(15), f(12)], 0.1, 0.05, t);
    },
    matchWin(c, t) {
      const notes = [[12, 0.12], [15, 0.12], [19, 0.12], [24, 0.24], [19, 0.12], [27, 0.6]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'square', f(n + 12), at, d * 0.9, 0.035); tone(c, 'sawtooth', f(n), at, d, 0.03); at += d; });
      noise(c, t + 0.4, 0.8, 0.03, { filter: 'highpass', freq: 6000 });
    },
    matchLose(c, t) {
      const notes = [[7, 0.22], [3, 0.22], [0, 0.22], [-5, 0.7]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'sawtooth', f(n + 12), at, d * 0.95, 0.04); at += d; });
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const beat = step % 16;
    const chord = CHORDS[bar];
    tone(c, 'sawtooth', f(chord[ARP[beat % 8]] - 12), at, dur * 0.8, 0.022, { dest: 'music' });
    if (beat % 2 === 0) tone(c, 'square', f(chord[0] - 24), at, dur * 0.9, 0.03, { dest: 'music' });
    if (beat % 4 === 0) tone(c, 'sine', 150, at, 0.14, 0.12, { to: 45, dest: 'music' });
    if (beat % 8 === 4) noise(c, at, 0.12, 0.05, { filter: 'bandpass', freq: 1800, q: 0.8, dest: 'music' });
    if (beat % 2 === 1) noise(c, at, 0.025, 0.012, { filter: 'highpass', freq: 8000, dest: 'music' });
    if (beat === 0) chord.forEach(n => tone(c, 'sawtooth', f(n + 12), at, dur * 15, 0.006, { dest: 'music', attack: 0.4 }));
  }

  synth.music.configure(scheduleStep, 60 / 122 / 4, 64);

  function engineOn(on) {
    const c = synth.context && synth.ready();
    if (!c) return;
    if (on && !engine && !(root.GamePlatform && root.GamePlatform.isMuted())) {
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      gain.connect(synth.sfxBus);
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 58;
      const lfo = c.createOscillator();
      lfo.frequency.value = 7;
      const depth = c.createGain();
      depth.gain.value = 3;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      osc.connect(filter);
      filter.connect(gain);
      osc.start();
      lfo.start();
      gain.gain.setTargetAtTime(0.03, c.currentTime, 0.2);
      engine = { gain, nodes: [osc, lfo] };
    } else if (!on && engine) {
      const e = engine;
      engine = null;
      e.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
      setTimeout(() => e.nodes.forEach(n => { try { n.stop(); } catch (err) { } }), 500);
    }
  }

  root.TronAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    engine: engineOn,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
