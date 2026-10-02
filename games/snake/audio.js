(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'snake_music', musicVolume: 0.38 });
  const { tone, noise, arpeggio } = synth;
  const NOTE = {
    E2: 82.41, G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, D3: 146.83,
    E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, B5: 987.77
  };
  const BASS = ['E2', 'E2', 'C3', 'C3', 'A2', 'A2', 'B2', 'B2'];
  const BASS_SHAPE = [0, 0, 12, 0, 7, 0, 12, 7];
  const LEAD = {
    0: 'E5', 3: 'G5', 6: 'A5', 10: 'G5', 12: 'E5', 14: 'D5',
    16: 'C5', 19: 'E5', 22: 'G5', 26: 'E5', 28: 'D5', 30: 'C5',
    32: 'A4', 35: 'C5', 38: 'E5', 42: 'D5', 44: 'C5', 46: 'B4',
    48: 'B4', 51: 'D5', 54: 'G5', 57: 'A5', 59: 'B5', 62: 'G5'
  };
  let speedMs = 130;
  const bpm = () => 100 + (130 - Math.max(55, Math.min(130, speedMs))) / 75 * 50;

  const SOUNDS = {
    eat(c, t, streak) {
      const k = Math.pow(2, Math.min(streak || 0, 7) / 12);
      tone(c, 'square', 660 * k, t, 0.07, 0.05);
      tone(c, 'triangle', 990 * k, t + 0.045, 0.1, 0.07);
      noise(c, t, 0.05, 0.03, { filter: 'highpass', freq: 4000 });
    },
    gold(c, t) {
      arpeggio(c, 'triangle', [988, 1319, 1568, 1976], 0.05, 0.06, t);
      tone(c, 'sine', 2637, t + 0.2, 0.3, 0.025);
    },
    slow(c, t) {
      tone(c, 'sine', 900, t, 0.6, 0.06, { to: 220, vibrato: 7 });
      noise(c, t, 0.5, 0.03, { filter: 'bandpass', freq: 1500, to: 300, q: 2 });
    },
    ghost(c, t) {
      tone(c, 'sine', 520, t, 0.7, 0.05, { to: 780, vibrato: 5, attack: 0.08 });
      tone(c, 'triangle', 1040, t + 0.05, 0.6, 0.02, { vibrato: 6, attack: 0.1 });
    },
    shrink(c, t) {
      tone(c, 'sawtooth', 1400, t, 0.22, 0.03, { to: 300 });
      noise(c, t, 0.2, 0.03, { filter: 'highpass', freq: 3000, to: 800 });
    },
    powerSpawn(c, t) {
      tone(c, 'sine', 1568, t, 0.12, 0.03);
      tone(c, 'sine', 2093, t + 0.07, 0.14, 0.025);
    },
    expire(c, t) {
      tone(c, 'sine', 700, t, 0.12, 0.03, { to: 400 });
    },
    near(c, t) {
      tone(c, 'sine', 1400, t, 0.06, 0.06);
      tone(c, 'sine', 1900, t + 0.04, 0.08, 0.05);
    },
    wrap(c, t) {
      tone(c, 'sine', 300, t, 0.18, 0.06, { to: 1200 });
      noise(c, t, 0.15, 0.025, { filter: 'bandpass', freq: 800, to: 4000, q: 3 });
    },
    obstacles(c, t) {
      tone(c, 'sine', 70, t, 0.35, 0.12, { to: 45 });
      noise(c, t, 0.25, 0.05, { filter: 'lowpass', freq: 600, to: 150 });
    },
    die(c, t) {
      noise(c, t, 0.4, 0.14, { filter: 'lowpass', freq: 2500, to: 200 });
      tone(c, 'sawtooth', 330, t, 0.5, 0.06, { to: 70 });
      const notes = [[392, 0.16], [330, 0.16], [262, 0.16], [196, 0.45]];
      let at = t + 0.25;
      notes.forEach(([f, d]) => { tone(c, 'triangle', f, at, d * 0.95, 0.06); at += d; });
    },
    start(c, t) {
      arpeggio(c, 'triangle', [659, 784, 988, 1319], 0.06, 0.05, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    tone(c, 'sawtooth', NOTE[BASS[bar]] * Math.pow(2, BASS_SHAPE[beat] / 12), at, dur * 0.7, 0.03, { dest: 'music' });
    tone(c, 'triangle', NOTE[BASS[bar]] * Math.pow(2, BASS_SHAPE[beat] / 12), at, dur * 0.85, 0.06, { dest: 'music' });
    const lead = LEAD[step % 64];
    if (lead) {
      tone(c, 'square', NOTE[lead], at, dur * 1.6, 0.016, { dest: 'music' });
      tone(c, 'triangle', NOTE[lead], at, dur * 1.8, 0.03, { dest: 'music' });
    }
    if (beat === 0 || beat === 4) tone(c, 'sine', 125, at, 0.12, 0.1, { to: 45, dest: 'music' });
    if (beat === 2 || beat === 6) noise(c, at, 0.09, 0.035, { filter: 'bandpass', freq: 1800, q: 0.8, dest: 'music' });
    noise(c, at, 0.025, beat % 2 ? 0.014 : 0.008, { filter: 'highpass', freq: 8000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 60 / bpm() / 2, 64);

  root.SnakeAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    setSpeed(ms) {
      speedMs = ms;
      synth.music.setStepSeconds(60 / bpm() / 2);
    },
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
