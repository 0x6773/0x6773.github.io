(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'chainreaction_music', musicVolume: 0.38 });
  const { tone, noise, arpeggio } = synth;
  const NOTE = {
    D2: 73.42, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54, C3: 130.81,
    A4: 440.0, Bb4: 466.16, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, Bb5: 932.33, C6: 1046.5, D6: 1174.66
  };
  const CHORDS = ['D2', 'Bb2', 'F2', 'C3', 'D2', 'Bb2', 'G2', 'A2'];
  const ARP = [
    ['D5', 'F5', 'A5', 'F5'], ['Bb4', 'D5', 'F5', 'D5'], ['C5', 'F5', 'A5', 'F5'], ['C5', 'E5', 'G5', 'E5'],
    ['D5', 'F5', 'A5', 'D6'], ['Bb4', 'D5', 'F5', 'Bb5'], ['G5', 'Bb5', 'D6', 'Bb5'], ['A4', 'C5', 'E5', 'A5']
  ];
  const LEAD = {
    3: 'A5', 7: 'G5', 11: 'F5', 14: 'E5', 19: 'F5', 23: 'A5', 27: 'C6', 30: 'A5',
    35: 'D6', 39: 'C6', 43: 'Bb5', 46: 'A5', 51: 'G5', 55: 'Bb5', 59: 'A5', 62: 'E5'
  };
  const EIGHTH = 60 / 104 / 2;

  const SOUNDS = {
    place(c, t, player) {
      const base = player === 1 ? 430 : 540;
      tone(c, 'sine', base, t, 0.12, 0.09, { to: base * 1.6, slide: 0.07 });
      tone(c, 'triangle', base * 2, t, 0.05, 0.025);
    },
    burst(c, t, step) {
      const k = Math.pow(2, Math.min(step, 24) / 24);
      tone(c, 'sine', 240 * k, t, 0.2, 0.12, { to: 90 * k });
      noise(c, t, 0.12, 0.05, { filter: 'bandpass', freq: 1800 * k, q: 1.2 });
      tone(c, 'triangle', 660 * k, t + 0.01, 0.07, 0.03);
    },
    bigchain(c, t) {
      arpeggio(c, 'triangle', [880, 1109, 1319, 1760], 0.04, 0.045, t);
      noise(c, t, 0.35, 0.04, { filter: 'highpass', freq: 5000, to: 9000 });
    },
    invalid(c, t) {
      tone(c, 'square', 150, t, 0.12, 0.03, { to: 110 });
    },
    undo(c, t) {
      tone(c, 'sine', 900, t, 0.16, 0.05, { to: 380 });
      noise(c, t, 0.14, 0.025, { filter: 'bandpass', freq: 2400, to: 700, q: 1.5 });
    },
    turn(c, t) {
      tone(c, 'sine', 1320, t, 0.05, 0.02);
    },
    win(c, t) {
      arpeggio(c, 'triangle', [587, 740, 880, 1175, 1480], 0.08, 0.07, t);
      [1175, 1480, 1760].forEach(f => tone(c, 'triangle', f, t + 0.45, 0.9, 0.035));
    },
    lose(c, t) {
      const notes = [[440, 0.18], [392, 0.18], [349, 0.18], [294, 0.5]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'triangle', f, at, d * 0.95, 0.07); at += d; });
    },
    out(c, t) {
      tone(c, 'sawtooth', 520, t, 0.45, 0.035, { to: 140 });
      tone(c, 'triangle', 330, t + 0.05, 0.4, 0.05, { to: 110 });
      noise(c, t, 0.3, 0.04, { filter: 'lowpass', freq: 1400, to: 200 });
    },
    start(c, t) {
      arpeggio(c, 'triangle', [587, 698, 880, 1175], 0.06, 0.05, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    if (beat % 2 === 0) tone(c, 'triangle', NOTE[CHORDS[bar]], at, dur * 1.7, 0.08, { dest: 'music' });
    const arp = ARP[bar][beat % 4];
    tone(c, 'triangle', NOTE[arp], at, dur * 0.8, 0.025, { dest: 'music' });
    tone(c, 'sine', NOTE[arp] * 2, at, dur * 0.4, 0.008, { dest: 'music' });
    const lead = LEAD[step % 64];
    if (lead) tone(c, 'square', NOTE[lead], at, dur * 1.8, 0.014, { dest: 'music', vibrato: 5 });
    if (beat === 0 || beat === 4) tone(c, 'sine', 120, at, 0.12, 0.08, { to: 45, dest: 'music' });
    if (beat === 4) noise(c, at, 0.08, 0.03, { filter: 'bandpass', freq: 1700, q: 0.8, dest: 'music' });
    if (beat % 2 === 1) noise(c, at, 0.025, 0.012, { filter: 'highpass', freq: 8000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, EIGHTH, 64);

  root.ChainAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
