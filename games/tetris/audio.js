(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'tetris_music', musicVolume: 0.4 });
  const { tone, noise, arpeggio } = synth;
  const NOTE = {
    E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, C3: 130.81,
    B4: 493.88, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, Gs5: 830.61,
    A5: 880.0, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51
  };
  const CHORDS = ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'E2', 'E2'];
  const LEAD = [
    'A4', 'C5', 'E5', 'A5', 'G5', 'E5', 'C5', 'E5',
    'F5', 'E5', 'C5', 'A4', 'C5', 'E5', 'F5', 'E5',
    'E5', 'G5', 'C6', 'B5', 'G5', 'E5', 'G5', 'C6',
    'D6', 'B5', 'G5', 'D5', 'G5', 'B5', 'D6', 'B5',
    'C6', 'B5', 'A5', 'E5', 'A5', 'C6', 'E6', 'C6',
    'A5', 'G5', 'F5', 'C5', 'F5', 'A5', 'C6', 'A5',
    'B5', 'Gs5', 'E5', 'B4', 'E5', 'Gs5', 'B5', 'Gs5',
    'E6', '', 'B5', '', 'Gs5', '', 'E5', ''
  ];
  const BASS_SHAPE = [0, 7, 12, 7, 0, 7, 12, 7];
  let level = 1;

  const bpm = lv => Math.min(172, 112 + (lv - 1) * 6);

  const SOUNDS = {
    move(c, t) {
      tone(c, 'triangle', 1150, t, 0.025, 0.025);
    },
    rotate(c, t) {
      tone(c, 'sine', 700, t, 0.06, 0.045, { to: 950 });
      tone(c, 'triangle', 1400, t, 0.035, 0.015);
    },
    softdrop(c, t) {
      tone(c, 'triangle', 480, t, 0.02, 0.014);
    },
    harddrop(c, t) {
      noise(c, t, 0.14, 0.1, { filter: 'lowpass', freq: 1200, to: 200 });
      tone(c, 'sine', 170, t, 0.16, 0.14, { to: 55 });
    },
    lock(c, t) {
      tone(c, 'square', 320, t, 0.045, 0.03, { to: 200 });
      noise(c, t, 0.025, 0.025, { filter: 'highpass', freq: 3500 });
    },
    hold(c, t) {
      noise(c, t, 0.16, 0.045, { filter: 'bandpass', freq: 600, to: 2400, q: 1.5 });
      tone(c, 'sine', 520, t, 0.09, 0.035, { to: 820 });
    },
    line1(c, t) {
      arpeggio(c, 'triangle', [784, 988], 0.05, 0.06, t);
      noise(c, t, 0.12, 0.03, { filter: 'highpass', freq: 5000 });
    },
    line2(c, t) {
      arpeggio(c, 'triangle', [784, 988, 1175], 0.05, 0.06, t);
      noise(c, t, 0.16, 0.035, { filter: 'highpass', freq: 5000 });
    },
    line3(c, t) {
      arpeggio(c, 'triangle', [784, 988, 1175, 1397], 0.05, 0.065, t);
      noise(c, t, 0.2, 0.04, { filter: 'highpass', freq: 4500 });
    },
    tetris(c, t) {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, 'triangle', f, t + i * 0.04, 0.6, 0.05));
      tone(c, 'square', 1047, t + 0.2, 0.3, 0.02);
      tone(c, 'sine', 110, t, 0.45, 0.16, { to: 55 });
      noise(c, t, 0.5, 0.05, { filter: 'highpass', freq: 3500, to: 9000 });
    },
    tspin(c, t) {
      tone(c, 'sawtooth', 300, t, 0.18, 0.03, { to: 1300 });
      [659, 831, 988].forEach((f, i) => tone(c, 'triangle', f, t + 0.08 + i * 0.03, 0.4, 0.04));
    },
    combo(c, t, n) {
      const f = 600 * Math.pow(2, Math.min(12, n || 1) / 12);
      tone(c, 'triangle', f, t, 0.1, 0.05);
      tone(c, 'sine', f * 1.5, t + 0.05, 0.12, 0.03);
    },
    b2b(c, t) {
      tone(c, 'triangle', 1568, t, 0.3, 0.03);
      tone(c, 'triangle', 2093, t + 0.05, 0.3, 0.025);
    },
    levelup(c, t) {
      const notes = [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.25]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'square', f, at, d * 0.95, 0.035); tone(c, 'triangle', f / 2, at, d * 0.95, 0.05); at += d; });
    },
    gameover(c, t) {
      const notes = [[392, 0.2], [330, 0.2], [262, 0.2], [196, 0.5]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'triangle', f, at, d * 0.95, 0.07); at += d; });
      tone(c, 'sawtooth', 55, t, 1.4, 0.035, { attack: 0.2 });
    },
    win(c, t) {
      arpeggio(c, 'triangle', [523, 659, 784, 1047, 1319], 0.08, 0.07, t);
      [1047, 1319, 1568].forEach(f => tone(c, 'triangle', f, t + 0.45, 0.8, 0.035));
    },
    powerup(c, t) {
      arpeggio(c, 'triangle', [880, 1109, 1319, 1760], 0.045, 0.05, t);
    },
    bomb(c, t) {
      noise(c, t, 0.6, 0.18, { filter: 'lowpass', freq: 1800, to: 150 });
      tone(c, 'sine', 90, t, 0.6, 0.2, { to: 28 });
    },
    nuke(c, t) {
      for (let i = 0; i < 3; i++) {
        noise(c, t + i * 0.12, 0.5, 0.15, { filter: 'lowpass', freq: 1500, to: 120 });
        tone(c, 'sine', 80 - i * 10, t + i * 0.12, 0.5, 0.16, { to: 25 });
      }
    },
    slow(c, t) {
      tone(c, 'sine', 900, t, 0.6, 0.05, { to: 300, vibrato: 6 });
      arpeggio(c, 'triangle', [1319, 1047, 880], 0.08, 0.035, t + 0.1);
    },
    flat(c, t) {
      arpeggio(c, 'triangle', [659, 988, 1319], 0.05, 0.05, t);
    },
    colorbomb(c, t) {
      arpeggio(c, 'square', [1568, 1319, 1047, 784, 523], 0.05, 0.03, t);
      noise(c, t, 0.4, 0.06, { filter: 'bandpass', freq: 3000, to: 600, q: 2 });
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    const rootNote = NOTE[CHORDS[bar]];
    tone(c, 'triangle', rootNote * Math.pow(2, BASS_SHAPE[beat] / 12), at, dur * 0.85, 0.085, { dest: 'music' });
    const lead = LEAD[(bar * 8 + beat) % LEAD.length];
    if (lead) {
      tone(c, 'square', NOTE[lead], at, dur * 0.7, 0.018, { dest: 'music' });
      tone(c, 'triangle', NOTE[lead], at, dur * 0.9, 0.035, { dest: 'music' });
    }
    if (beat === 0 || beat === 4) tone(c, 'sine', 130, at, 0.12, 0.11, { to: 45, dest: 'music' });
    if (beat === 2 || beat === 6) noise(c, at, 0.09, 0.04, { filter: 'bandpass', freq: 1900, q: 0.8, dest: 'music' });
    if (beat % 2 === 1 || level >= 8) noise(c, at, 0.03, 0.016, { filter: 'highpass', freq: 8000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 60 / bpm(1) / 2, 64);

  root.TetrisAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    setLevel(lv) {
      level = lv;
      synth.music.setStepSeconds(60 / bpm(lv) / 2);
    },
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
