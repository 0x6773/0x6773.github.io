(function (root) {
  'use strict';

  function create(options) {
    const opts = options || {};
    const musicLevel = opts.musicVolume != null ? opts.musicVolume : 0.45;
    let context = null;
    let master = null;
    let sfxBus = null;
    let musicBus = null;
    let noiseBuffer = null;
    let musicEnabled = readSetting();
    let musicPlaying = false;
    let musicStep = 0;
    let musicTime = 0;
    let scheduler = null;
    let stepSeconds = 0.2;
    let totalSteps = 64;
    const resetHooks = [];

    function readSetting() {
      if (!opts.musicKey) return true;
      try { return localStorage.getItem(opts.musicKey) !== '0'; } catch (e) { return true; }
    }

    const muted = () => !!(root.GamePlatform && root.GamePlatform.isMuted());
    const paused = () => !!(root.GameEngine && root.GameEngine.isPaused());

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
        musicBus.gain.value = musicLevel;
        musicBus.connect(master);
        const length = Math.floor(c.sampleRate * 2);
        noiseBuffer = c.createBuffer(1, length, c.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        resetHooks.forEach(fn => fn());
      }
      master.gain.setTargetAtTime(muted() ? 0 : 1, c.currentTime, 0.02);
      return c;
    }

    const target = o => (o && o.dest === 'music' ? musicBus : (o && o.dest) || sfxBus);

    function tone(c, type, freq, at, dur, vol, o) {
      const p = o || {};
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      if (p.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, p.to), at + (p.slide || dur));
      if (p.detune) osc.detune.setValueAtTime(p.detune, at);
      if (p.vibrato) {
        const lfo = c.createOscillator();
        const depth = c.createGain();
        lfo.frequency.value = p.vibrato;
        depth.gain.value = freq * 0.06;
        lfo.connect(depth);
        depth.connect(osc.frequency);
        lfo.start(at);
        lfo.stop(at + dur + 0.02);
      }
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(vol, at + (p.attack || 0.004));
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(target(p));
      osc.start(at);
      osc.stop(at + dur + 0.02);
    }

    function noise(c, at, dur, vol, o) {
      const p = o || {};
      const src = c.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = c.createBiquadFilter();
      filter.type = p.filter || 'lowpass';
      filter.frequency.setValueAtTime(p.freq || 2000, at);
      if (p.to) filter.frequency.exponentialRampToValueAtTime(p.to, at + dur);
      filter.Q.value = p.q || 0.8;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(vol, at + (p.attack || 0.004));
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(target(p));
      src.start(at, Math.random() * 1.5, dur + 0.05);
    }

    function arpeggio(c, type, notes, step, vol, at, dur) {
      notes.forEach((f, i) => tone(c, type, f, at + i * step, dur || step * 1.8, vol));
    }

    function play(fn, arg) {
      if (paused() || muted() || !fn) return;
      const c = ready();
      if (!c) return;
      try { fn(c, c.currentTime + 0.005, arg); } catch (e) { }
    }

    function update() {
      const c = context && ready();
      if (!c || !musicPlaying || !musicEnabled || muted() || !scheduler) return;
      if (musicTime < c.currentTime - 0.1) musicTime = c.currentTime + 0.05;
      while (musicTime < c.currentTime + 0.25) {
        scheduler(c, musicStep, musicTime, stepSeconds);
        musicTime += stepSeconds;
        musicStep = (musicStep + 1) % totalSteps;
      }
    }

    const music = {
      configure(fn, seconds, steps) {
        scheduler = fn;
        stepSeconds = seconds;
        totalSteps = steps || 64;
      },
      setStepSeconds(seconds) {
        stepSeconds = seconds;
      },
      start() {
        const c = ready();
        if (!c || musicPlaying) return;
        musicPlaying = true;
        musicStep = 0;
        musicTime = c.currentTime + 0.1;
        musicBus.gain.cancelScheduledValues(c.currentTime);
        musicBus.gain.setValueAtTime(musicEnabled ? musicLevel : 0.0001, c.currentTime);
      },
      stop() {
        if (!musicPlaying) return;
        musicPlaying = false;
        if (context) {
          const now = context.currentTime;
          musicBus.gain.cancelScheduledValues(now);
          musicBus.gain.setValueAtTime(musicBus.gain.value, now);
          musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.4);
        }
      },
      setEnabled(on) {
        musicEnabled = !!on;
        if (opts.musicKey) {
          try { localStorage.setItem(opts.musicKey, musicEnabled ? '1' : '0'); } catch (e) { }
        }
        if (context && musicBus) {
          const now = context.currentTime;
          musicBus.gain.cancelScheduledValues(now);
          musicBus.gain.setTargetAtTime(musicEnabled && musicPlaying ? musicLevel : 0.0001, now, 0.05);
        }
      },
      isEnabled: () => musicEnabled,
      isPlaying: () => musicPlaying
    };

    return {
      ready, tone, noise, arpeggio, play, update, music,
      onReset(fn) { resetHooks.push(fn); },
      get context() { return context; },
      get sfxBus() { return sfxBus; },
      get noiseBuffer() { return noiseBuffer; }
    };
  }

  root.GameSynth = { create };
})(typeof window !== 'undefined' ? window : globalThis);
