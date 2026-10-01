(function () {
  'use strict';

  const realNow = () => performance.now();
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCaf = window.cancelAnimationFrame.bind(window);
  const realSetTimeout = window.setTimeout.bind(window);
  const realClearTimeout = window.clearTimeout.bind(window);
  const realSetInterval = window.setInterval.bind(window);

  let paused = false;
  let pausedAt = 0;
  let pausedTotal = 0;
  let seq = 0;
  const frames = new Map();
  const timers = new Map();

  function now() {
    return (paused ? pausedAt : realNow()) - pausedTotal;
  }

  function armFrame(id, entry) {
    entry.raf = realRaf(t => {
      entry.raf = 0;
      if (paused || !frames.has(id)) return;
      frames.delete(id);
      entry.cb(t - pausedTotal);
    });
  }

  function requestFrame(cb) {
    const id = ++seq;
    const entry = { cb, raf: 0 };
    frames.set(id, entry);
    if (!paused) armFrame(id, entry);
    return id;
  }

  function cancelFrame(id) {
    const entry = frames.get(id);
    if (!entry) return;
    if (entry.raf) realCaf(entry.raf);
    frames.delete(id);
  }

  function armTimer(id, timer) {
    timer.handle = realSetTimeout(() => fireTimer(id), Math.max(0, timer.due - now()));
  }

  function fireTimer(id) {
    const timer = timers.get(id);
    if (!timer || paused) return;
    if (timer.every) {
      timer.due += timer.every;
      if (timer.due < now()) timer.due = now() + timer.every;
      armTimer(id, timer);
    } else {
      timers.delete(id);
    }
    timer.fn.apply(null, timer.args);
  }

  function addTimer(fn, ms, args, repeat) {
    const id = ++seq;
    const delay = Math.max(0, Number(ms) || 0);
    const timer = { fn, args, due: now() + delay, every: repeat ? Math.max(1, delay) : 0, handle: 0 };
    timers.set(id, timer);
    if (!paused) armTimer(id, timer);
    return id;
  }

  function clearTimer(id) {
    const timer = timers.get(id);
    if (!timer) return;
    realClearTimeout(timer.handle);
    timers.delete(id);
  }

  const clock = {
    setTimeout: (fn, ms, ...args) => addTimer(fn, ms, args, false),
    setInterval: (fn, ms, ...args) => addTimer(fn, ms, args, true),
    clearTimeout: clearTimer,
    clearInterval: clearTimer,
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame,
    performance: { now }
  };

  let actx = null;

  function audio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended' && !paused) actx.resume();
    return actx;
  }

  function isMuted() {
    return !!(window.GamePlatform && GamePlatform.isMuted());
  }

  function playable() {
    if (paused || isMuted()) return null;
    const ctx = audio();
    const activation = navigator.userActivation;
    if (!ctx || (ctx.state === 'suspended' && activation && !activation.hasBeenActive)) return null;
    return ctx;
  }

  function tone(freq, duration, options) {
    const opts = options || {};
    const ctx = playable();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (opts.slideTo) osc.frequency.linearRampToValueAtTime(opts.slideTo, t + duration);
      gain.gain.setValueAtTime(opts.volume || 0.1, t);
      if (opts.decay !== false) gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    } catch (e) { /* audio unavailable */ }
  }

  function noise(duration, options) {
    const opts = options || {};
    const ctx = playable();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      const level = opts.level || 1;
      for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * level * (opts.fade ? 1 - i / size : 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(opts.volume || 0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(t);
    } catch (e) { /* audio unavailable */ }
  }

  ['pointerdown', 'keydown', 'touchend'].forEach(type => {
    window.addEventListener(type, () => {
      if (actx && actx.state === 'suspended' && !paused) actx.resume();
    }, true);
  });

  let config = null;
  let overlay = null;
  let pauseButton = null;

  function setPausedUi(show) {
    if (show && !overlay && config && config.container) {
      overlay = document.createElement('div');
      overlay.className = 'gp-pause';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Paused');
      overlay.innerHTML =
        '<div class="gp-pause-title">Paused</div>' +
        '<button type="button" class="gp-pause-resume">Resume</button>' +
        '<div class="gp-pause-hint">Press P or Esc, or tap to resume</div>';
      config.container.appendChild(overlay);
    }
    if (overlay) overlay.hidden = !show;
    if (pauseButton) {
      pauseButton.textContent = show ? '\u25B6\uFE0F' : '\u23F8\uFE0F';
      pauseButton.title = show ? 'Resume (P)' : 'Pause (P)';
      pauseButton.setAttribute('aria-label', show ? 'Resume' : 'Pause');
    }
  }

  function pause() {
    if (paused || !config || !config.isActive()) return false;
    paused = true;
    pausedAt = realNow();
    frames.forEach(entry => {
      if (entry.raf) { realCaf(entry.raf); entry.raf = 0; }
    });
    timers.forEach(timer => { realClearTimeout(timer.handle); timer.handle = 0; });
    if (actx && actx.state === 'running') actx.suspend();
    setPausedUi(true);
    if (window.GamePlatform && GamePlatform.setPaused) GamePlatform.setPaused(true);
    return true;
  }

  function resume() {
    if (!paused) return false;
    pausedTotal += realNow() - pausedAt;
    paused = false;
    setPausedUi(false);
    timers.forEach((timer, id) => armTimer(id, timer));
    frames.forEach((entry, id) => armFrame(id, entry));
    if (actx && actx.state === 'suspended') actx.resume();
    if (window.GamePlatform && GamePlatform.setPaused) GamePlatform.setPaused(false);
    return true;
  }

  function isTyping(el) {
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }

  function onKeyDown(e) {
    if (!config || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    const toggle = e.key === 'p' || e.key === 'P' || e.key === 'Escape';
    if (paused) {
      if (toggle && !e.repeat) resume();
      if (e.key !== 'Tab') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    } else if (toggle && !e.repeat && pause()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function onPointer(e) {
    if (!paused) return;
    const target = e.target;
    if (target && target.closest && target.closest('#gp-header')) return;
    e.stopImmediatePropagation();
    if (e.type === 'click' && overlay && overlay.contains(target)) resume();
  }

  function addHeaderButton(attempt) {
    const actions = document.querySelector('#gp-header .gp-header-actions');
    if (!actions) {
      if ((attempt || 0) < 50) realSetTimeout(() => addHeaderButton((attempt || 0) + 1), 100);
      return;
    }
    if (pauseButton) return;
    pauseButton = document.createElement('button');
    pauseButton.type = 'button';
    pauseButton.className = 'gp-btn-pause';
    pauseButton.addEventListener('click', e => {
      e.preventDefault();
      pauseButton.blur();
      if (paused) resume(); else pause();
    });
    actions.prepend(pauseButton);
    setPausedUi(paused);
    const refresh = () => { pauseButton.disabled = !paused && !config.isActive(); };
    refresh();
    realSetInterval(refresh, 300);
    ['keyup', 'pointerup', 'click'].forEach(type => {
      window.addEventListener(type, () => realSetTimeout(refresh, 30), true);
    });
  }

  function pausable(options) {
    if (config) return;
    const container = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
    config = { isActive: options.isActive, container };
    if (container && getComputedStyle(container).position === 'static') container.style.position = 'relative';
    window.addEventListener('keydown', onKeyDown, true);
    ['pointerdown', 'pointermove', 'mousedown', 'mousemove', 'touchstart', 'touchmove', 'click', 'contextmenu'].forEach(type => {
      window.addEventListener(type, onPointer, true);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('blur', () => pause());
    realSetTimeout(() => addHeaderButton(0), 0);
  }

  const scaleListeners = [];
  let scaleQuery = null;

  function listenScale() {
    if (!window.matchMedia) return;
    scaleQuery = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    const query = scaleQuery;
    const onChange = () => {
      if (query.removeEventListener) query.removeEventListener('change', onChange); else query.removeListener(onChange);
      scaleListeners.forEach(fn => fn());
      listenScale();
    };
    if (query.addEventListener) query.addEventListener('change', onChange); else query.addListener(onChange);
  }

  let sharpSeq = 0;
  let sharpStyle = null;
  const sharpRules = {};

  function setSharpRule(id, width) {
    if (!sharpStyle) {
      sharpStyle = document.createElement('style');
      document.head.appendChild(sharpStyle);
    }
    sharpRules[id] = ':where(canvas[data-ge-sharp="' + id + '"]){width:' + width + 'px}';
    sharpStyle.textContent = Object.keys(sharpRules).map(k => sharpRules[k]).join('\n');
  }

  function sharpCanvas(canvas, options) {
    const opts = options || {};
    if (!canvas || canvas.dataset.geSharp) return canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const widthProp = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
    const heightProp = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
    const blurProp = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    const maxScale = opts.maxScale || 2;
    let logicalWidth = widthProp.get.call(canvas);
    let logicalHeight = heightProp.get.call(canvas);
    let scale = 1;
    const id = String(++sharpSeq);
    canvas.dataset.geSharp = id;
    const style = getComputedStyle(canvas);
    const boxExtra = style.boxSizing === 'border-box'
      ? ['borderLeftWidth', 'borderRightWidth', 'paddingLeft', 'paddingRight'].reduce((sum, k) => sum + (parseFloat(style[k]) || 0), 0)
      : 0;

    function apply() {
      scale = Math.max(1, Math.min(maxScale, window.devicePixelRatio || 1));
      widthProp.set.call(canvas, Math.round(logicalWidth * scale));
      heightProp.set.call(canvas, Math.round(logicalHeight * scale));
      if (logicalWidth && logicalHeight) {
        ctx.setTransform(widthProp.get.call(canvas) / logicalWidth, 0, 0, heightProp.get.call(canvas) / logicalHeight, 0, 0);
      }
      setSharpRule(id, logicalWidth + boxExtra);
    }

    Object.defineProperty(canvas, 'width', {
      configurable: true,
      get: () => logicalWidth,
      set: v => { logicalWidth = Math.max(0, Math.floor(Number(v) || 0)); apply(); }
    });
    Object.defineProperty(canvas, 'height', {
      configurable: true,
      get: () => logicalHeight,
      set: v => { logicalHeight = Math.max(0, Math.floor(Number(v) || 0)); apply(); }
    });
    Object.defineProperty(ctx, 'shadowBlur', {
      configurable: true,
      get: () => blurProp.get.call(ctx) / scale,
      set: v => blurProp.set.call(ctx, (Number(v) || 0) * scale)
    });

    apply();
    scaleListeners.push(() => {
      apply();
      if (opts.redraw) opts.redraw();
    });
    if (!scaleQuery) listenScale();
    return canvas;
  }

  window.GameEngine = {
    clock,
    now,
    pausable,
    pause,
    resume,
    isPaused: () => paused,
    sharpCanvas,
    audio,
    isMuted,
    tone,
    noise
  };
})();
