(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'flappy_music', musicVolume: 0.36 });
  const { tone, noise, arpeggio } = synth;
  const NOTE = {
    C3: 130.81, F2: 87.31, G2: 98.0, A2: 110.0, E3: 164.81,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51
  };
  const CHORDS = ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'F2', 'G2'];
  const LEAD = [
    'E5', '', 'G5', 'C6', '', 'G5', 'E5', 'G5',
    'A5', '', 'E5', 'C5', '', 'E5', 'A5', 'C6',
    'F5', '', 'A5', 'C6', '', 'A5', 'F5', 'A5',
    'G5', 'B5', 'D6', '', 'B5', 'G5', 'D5', '',
    'E6', '', 'D6', 'C6', '', 'G5', 'E5', 'G5',
    'C6', '', 'A5', 'E5', '', 'C5', 'E5', 'A5',
    'F5', 'A5', 'C6', 'A5', 'F5', 'A5', 'D6', 'C6',
    'B5', '', 'G5', '', 'D6', '', 'B5', ''
  ];
  const EIGHTH = 60 / 132 / 2;

  const SOUNDS = {
    flap(c, t) {
      const k = 0.92 + Math.random() * 0.16;
      noise(c, t, 0.09, 0.07, { filter: 'bandpass', freq: 900 * k, to: 2600 * k, q: 1.2 });
      tone(c, 'sine', 420 * k, t, 0.08, 0.05, { to: 680 * k });
    },
    score(c, t) {
      tone(c, 'triangle', 1047, t, 0.08, 0.07);
      tone(c, 'triangle', 1568, t + 0.06, 0.16, 0.07);
    },
    coin(c, t) {
      tone(c, 'square', 1319, t, 0.05, 0.035);
      tone(c, 'square', 1976, t + 0.05, 0.16, 0.035);
      tone(c, 'sine', 2637, t + 0.05, 0.2, 0.02);
    },
    hit(c, t) {
      noise(c, t, 0.18, 0.15, { filter: 'lowpass', freq: 1800, to: 200 });
      tone(c, 'sine', 160, t, 0.22, 0.18, { to: 55 });
    },
    fall(c, t) {
      tone(c, 'sine', 1200, t + 0.12, 0.7, 0.05, { to: 260 });
    },
    milestone(c, t) {
      arpeggio(c, 'triangle', [784, 988, 1175, 1568], 0.07, 0.06, t);
      tone(c, 'sine', 2093, t + 0.3, 0.4, 0.03);
    },
    record(c, t) {
      arpeggio(c, 'triangle', [1047, 1319, 1568, 2093], 0.06, 0.05, t);
      noise(c, t, 0.4, 0.03, { filter: 'highpass', freq: 6000 });
    },
    medal(c, t) {
      const notes = [[784, 0.1], [988, 0.1], [1175, 0.1], [1568, 0.35]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'triangle', f, at, d * 0.95, 0.06); tone(c, 'square', f / 2, at, d * 0.9, 0.015); at += d; });
    },
    start(c, t) {
      tone(c, 'sine', 500, t, 0.25, 0.05, { to: 1100 });
      noise(c, t, 0.2, 0.03, { filter: 'bandpass', freq: 1200, to: 3000, q: 1 });
    },
    unlock(c, t) {
      arpeggio(c, 'triangle', [659, 880, 1109, 1319, 1760], 0.05, 0.05, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    const rootNote = NOTE[CHORDS[bar]];
    if (beat % 2 === 0) tone(c, 'triangle', rootNote * (beat === 4 ? 1.5 : 1), at, dur * 1.6, 0.08, { dest: 'music' });
    else tone(c, 'square', rootNote * 4 * (beat === 3 || beat === 7 ? 1.26 : 1.5), at, dur * 0.4, 0.012, { dest: 'music' });
    const lead = LEAD[(bar * 8 + beat) % LEAD.length];
    if (lead) {
      tone(c, 'triangle', NOTE[lead], at, dur * 0.9, 0.045, { dest: 'music' });
      tone(c, 'sine', NOTE[lead] * 2, at, dur * 0.5, 0.01, { dest: 'music' });
    }
    if (beat === 0 || beat === 4) tone(c, 'sine', 150, at, 0.1, 0.09, { to: 55, dest: 'music' });
    if (beat === 2 || beat === 6) noise(c, at, 0.07, 0.03, { filter: 'bandpass', freq: 2400, q: 0.8, dest: 'music' });
    if (beat % 2 === 1) noise(c, at, 0.025, 0.014, { filter: 'highpass', freq: 8000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, EIGHTH, 64);

  root.FlappyAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
