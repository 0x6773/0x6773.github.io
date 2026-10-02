(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'breakout_music', musicVolume: 0.36 });
  const { tone, noise, arpeggio } = synth;
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
  const STYLES = {
    1: { bpm: 124, root: 110, chords: [0, 0, 8, 8, 5, 5, 7, 7], lead: 'triangle', bass: 'square', arp: [0, 7, 12, 7] },
    2: { bpm: 132, root: 98, chords: [0, 0, 3, 3, 8, 8, 10, 10], lead: 'sawtooth', bass: 'sawtooth', arp: [0, 12, 7, 12, 3, 12, 7, 12] },
    3: { bpm: 112, root: 92.5, chords: [0, 0, 1, 1, 0, 0, 10, 10], lead: 'sine', bass: 'triangle', arp: [0, 3, 7, 10] }
  };
  let style = STYLES[1];
  const f = (base, semis) => base * Math.pow(2, semis / 12);

  const SOUNDS = {
    paddle(c, t, k) {
      const p = 1 + (k || 0) * 0.15;
      tone(c, 'triangle', 330 * p, t, 0.1, 0.09, { to: 520 * p });
      noise(c, t, 0.04, 0.03, { filter: 'bandpass', freq: 1800, q: 1 });
    },
    wall(c, t) {
      tone(c, 'sine', 620, t, 0.05, 0.035, { to: 480 });
    },
    brick(c, t, row) {
      const n = SCALE[(row || 0) % SCALE.length];
      tone(c, 'square', f(523, n), t, 0.07, 0.035);
      tone(c, 'triangle', f(1046, n), t, 0.12, 0.04);
      noise(c, t, 0.06, 0.035, { filter: 'highpass', freq: 3500 });
    },
    tough(c, t) {
      tone(c, 'square', 220, t, 0.06, 0.04, { to: 170 });
      tone(c, 'triangle', 1760, t, 0.1, 0.025, { to: 1500 });
      noise(c, t, 0.05, 0.04, { filter: 'bandpass', freq: 2600, q: 3 });
    },
    explode(c, t) {
      noise(c, t, 0.5, 0.16, { filter: 'lowpass', freq: 2600, to: 120 });
      tone(c, 'sine', 140, t, 0.45, 0.18, { to: 40 });
      tone(c, 'sawtooth', 300, t, 0.2, 0.04, { to: 80 });
    },
    gold(c, t) {
      arpeggio(c, 'triangle', [1319, 1568, 1976, 2637], 0.04, 0.05, t);
    },
    life(c, t) {
      tone(c, 'sawtooth', 330, t, 0.35, 0.07, { to: 110 });
      noise(c, t, 0.3, 0.06, { filter: 'lowpass', freq: 1200, to: 200 });
    },
    powerup(c, t) {
      arpeggio(c, 'triangle', [784, 988, 1175, 1568], 0.045, 0.055, t);
    },
    fireball(c, t) {
      noise(c, t, 0.4, 0.08, { filter: 'bandpass', freq: 600, to: 2400, q: 1 });
      tone(c, 'sawtooth', 160, t, 0.35, 0.05, { to: 420 });
    },
    laser(c, t) {
      tone(c, 'square', 1800, t, 0.07, 0.025, { to: 700 });
    },
    magnet(c, t) {
      tone(c, 'sine', 500, t, 0.18, 0.06, { to: 900, vibrato: 12 });
    },
    levelComplete(c, t) {
      arpeggio(c, 'triangle', [523, 659, 784, 1047, 1319], 0.08, 0.07, t);
      tone(c, 'sine', 2093, t + 0.42, 0.5, 0.03);
    },
    worldUnlock(c, t) {
      arpeggio(c, 'triangle', [523, 659, 784, 1047, 1319, 1568], 0.09, 0.07, t);
      arpeggio(c, 'square', [262, 330, 392, 523], 0.13, 0.02, t);
    },
    win(c, t) {
      const notes = [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.5]];
      let at = t;
      notes.forEach(([fr, d]) => { tone(c, 'triangle', fr, at, d * 0.95, 0.08); tone(c, 'square', fr / 2, at, d * 0.9, 0.02); at += d; });
      noise(c, t, 0.8, 0.03, { filter: 'highpass', freq: 6000 });
    },
    gameover(c, t) {
      const notes = [[392, 0.2], [330, 0.2], [262, 0.2], [196, 0.55]];
      let at = t;
      notes.forEach(([fr, d]) => { tone(c, 'sawtooth', fr, at, d * 0.95, 0.05); tone(c, 'triangle', fr / 2, at, d, 0.07); at += d; });
    },
    bossShot(c, t) {
      tone(c, 'sawtooth', 260, t, 0.14, 0.05, { to: 120 });
    },
    bossDrop(c, t) {
      tone(c, 'square', 200, t, 0.12, 0.04, { to: 140 });
      noise(c, t, 0.1, 0.03, { filter: 'lowpass', freq: 900 });
    },
    bossHit(c, t) {
      tone(c, 'square', 140, t, 0.12, 0.07, { to: 90 });
      noise(c, t, 0.12, 0.06, { filter: 'bandpass', freq: 1200, q: 1 });
    },
    start(c, t) {
      tone(c, 'sine', 420, t, 0.3, 0.05, { to: 1260 });
      noise(c, t, 0.25, 0.03, { filter: 'bandpass', freq: 900, to: 4000, q: 2 });
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    const chordRoot = f(style.root, style.chords[bar]);
    if (beat % 2 === 0) tone(c, style.bass, chordRoot * (beat === 6 ? 1.5 : 1), at, dur * 1.5, style.bass === 'square' ? 0.03 : 0.04, { dest: 'music' });
    tone(c, 'triangle', chordRoot / 2, at, dur * 0.9, 0.05, { dest: 'music' });
    const arp = style.arp[step % style.arp.length];
    tone(c, style.lead, chordRoot * 4 * Math.pow(2, arp / 12), at, dur * 0.7, style.lead === 'sawtooth' ? 0.01 : 0.022, { dest: 'music' });
    if (beat === 0 || beat === 4) tone(c, 'sine', 130, at, 0.11, 0.1, { to: 45, dest: 'music' });
    if (beat === 2 || beat === 6) noise(c, at, 0.08, 0.03, { filter: 'bandpass', freq: 2000, q: 0.8, dest: 'music' });
    if (beat % 2 === 1) noise(c, at, 0.025, 0.012, { filter: 'highpass', freq: 8000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 60 / style.bpm / 2, 64);

  root.BreakoutAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    setWorld(n) {
      style = STYLES[n] || STYLES[1];
      synth.music.setStepSeconds(60 / style.bpm / 2);
    },
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
