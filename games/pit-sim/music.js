// Your Pit: background music. Original chiptune loops made with WebAudio at run time (square and
// triangle oscillators, a noise hat, short envelopes). No audio files, no samples. The melodies are
// written note by note from chord tones by a seeded generator, so every theme is our own.
//
// PitSim.music.update({ day, week, comp, cook, waiting }) is called by game.js as the game runs; the
// module picks a theme from the weekday (or the week 9 competition), a hub or cook version, and a
// tempo that rises a little with the guests waiting. Nothing makes a sound, and no AudioContext is
// made, until the first pointerdown or keydown. A missing WebAudio leaves every call a quiet no-op.
(function () {
  'use strict';
  const root = (typeof window !== 'undefined' ? window : globalThis);
  const PitSim = root.PitSim = root.PitSim || {};

  const VOLUME = 0.05;          // master level, kept low under the game
  const FADE_S = 1.2;           // crossfade on a theme or screen change
  const LOOKAHEAD_S = 0.15;     // schedule this far ahead of audio time
  const TICK_MS = 30;
  const RISE_PER_GUEST = 0.02;  // cook tempo rise per guest waiting
  const RISE_CAP = 0.14;        // at most 14 percent faster

  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const MINOR = [0, 2, 3, 5, 7, 8, 10];

  // Each theme: tempo, key, scale, chord roots (scale degrees, one per bar), steps per bar, swing,
  // a seed for the melody and the hat and lead density for the hub and the cook versions.
  const THEMES = {
    easy:   { bpm: 82,  key: 53, scale: MAJOR, prog: [0, 5, 3, 4], steps: 16, swing: 0.18, seed: 11, hub: { lead: 0.30, hat: 0.25 }, cook: { lead: 0.50, hat: 0.5 } },
    bright: { bpm: 98,  key: 55, scale: MAJOR, prog: [0, 3, 1, 4], steps: 16, swing: 0.10, seed: 23, hub: { lead: 0.40, hat: 0.4 },  cook: { lead: 0.60, hat: 0.75 } },
    party:  { bpm: 118, key: 57, scale: MAJOR, prog: [0, 3, 0, 4, 5, 3, 1, 4], steps: 16, swing: 0.0, seed: 37, hub: { lead: 0.50, hat: 0.6 }, cook: { lead: 0.70, hat: 1 } },
    picnic: { bpm: 88,  key: 60, scale: MAJOR, prog: [0, 3, 4, 0], steps: 12, swing: 0.0, seed: 41, hub: { lead: 0.40, hat: 0.3 },  cook: { lead: 0.55, hat: 0.6 } },
    comp:   { bpm: 110, key: 50, scale: MINOR, prog: [0, 6, 5, 6], steps: 16, swing: 0.0, seed: 59, hub: { lead: 0.45, hat: 0.5 },  cook: { lead: 0.65, hat: 0.9 } }
  };
  // Monday 0 to Sunday 6.
  const DAY_THEME = ['easy', 'easy', 'bright', 'bright', 'bright', 'party', 'picnic'];

  let AC = null;
  try { AC = root.AudioContext || root.webkitAudioContext || null; } catch (e) { AC = null; }

  let ctx = null, master = null, noiseBuf = null;
  let muted = false, started = false, timer = null, created = 0;
  let want = { day: 0, week: 1, comp: false, cook: false, waiting: 0 };
  let cur = null;               // the playing voice: { key, theme, mode, bus, step, next, bpm, pat }
  const compiled = {};

  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function deg(th, d, oct) {
    const n = th.scale.length;
    const o = Math.floor(d / n);
    const i = ((d % n) + n) % n;
    return th.key + th.scale[i] + 12 * (o + (oct || 0));
  }

  // Build one loop: per step, an optional lead note, bass note, arp note and hat.
  function compile(name, mode) {
    const k = name + ':' + mode;
    if (compiled[k]) return compiled[k];
    const th = THEMES[name];
    const dens = th[mode];
    const r = rng(th.seed);   // the same seed for both versions keeps the tune; density changes the fill
    const S = th.steps, beat = S === 12 ? 3 : 4;
    const out = [];
    let last = 4;             // melody position in scale degrees above the root
    for (let b = 0; b < th.prog.length; b++) {
      const c = th.prog[b];
      for (let i = 0; i < S; i++) {
        const st = { lead: null, bass: null, arp: null, hat: 0 };
        const onBeat = i % beat === 0;
        // bass: root on beat one, fifth on the middle beat, a passing note at the end of some bars
        if (i === 0) st.bass = deg(th, c, -2);
        else if (i === S / 2) st.bass = deg(th, c + 4, -2);
        else if (i === S - beat && r() < 0.4) st.bass = deg(th, c + 2, -2);
        // arp: chord tones on the off beats, quiet
        if (!onBeat && i % 2 === 0) st.arp = deg(th, c + [0, 2, 4][(i / 2) % 3], 0);
        // lead: walk by step or leap to a chord tone, rest by density
        const pr = r(), pr2 = r(), pr3 = r();
        const keep = onBeat ? 0.6 + dens.lead * 0.4 : dens.lead * 0.7;
        if (pr < keep) {
          if (onBeat) {
            const tones = [c, c + 2, c + 4, c + 7];
            let best = tones[0];
            for (const t of tones) if (Math.abs(t - last) < Math.abs(best - last)) best = t;
            last = pr2 < 0.25 ? tones[Math.floor(pr3 * tones.length)] : best;
          } else {
            last += pr2 < 0.5 ? -1 : 1;
          }
          if (last < -1) last += 2;
          if (last > 9) last -= 2;
          st.lead = deg(th, last, 1);
          st.len = onBeat && pr3 < 0.5 ? 2 : 1;
        }
        // hat: off beats always at full density, sixteenths by density
        const hp = r();
        if (!onBeat && (i % 2 === 0 ? hp < 0.3 + dens.hat * 0.7 : hp < dens.hat * 0.5)) st.hat = i % 2 === 0 ? 1 : 0.6;
        out.push(st);
      }
    }
    return (compiled[k] = out);
  }

  function themeFor(w) {
    if (w.comp) return 'comp';
    return DAY_THEME[((w.day | 0) % 7 + 7) % 7] || 'easy';
  }
  function bpmFor(name, w) {
    const th = THEMES[name];
    let b = th.bpm * (w.cook ? 1.06 : 1);
    if (w.cook) b *= 1 + Math.min(RISE_CAP, Math.max(0, w.waiting | 0) * RISE_PER_GUEST);
    return b;
  }

  function tone(type, hz, t, dur, vol, bus) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function hat(t, vol, bus) {
    if (!noiseBuf) return;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + 0.05);
  }

  function playStep(v, t, sd) {
    const st = v.pat[v.step % v.pat.length];
    if (st.bass !== null) tone('triangle', midiHz(st.bass), t, sd * 3.5, 0.9, v.bus);
    if (st.arp !== null) tone('square', midiHz(st.arp), t, sd * 0.8, 0.10, v.bus);
    if (st.lead !== null) tone('square', midiHz(st.lead), t, sd * (st.len || 1) * 0.9, 0.22, v.bus);
    if (st.hat) hat(t, 0.25 * st.hat, v.bus);
  }

  function tick() {
    if (!ctx || !cur) return;
    try {
      const v = cur;
      const th = THEMES[v.theme];
      const horizon = ctx.currentTime + LOOKAHEAD_S;
      if (v.next < ctx.currentTime - 0.5) v.next = ctx.currentTime + 0.05;   // after a suspend, catch up
      while (v.next < horizon) {
        const base = 60 / v.bpm / (th.steps === 12 ? 3 : 4);
        const sw = v.step % 2 === 0 ? 1 + th.swing : 1 - th.swing;
        playStep(v, v.next, base);
        v.next += base * sw;
        v.step++;
      }
    } catch (e) { /* never let the music break the game */ }
  }

  function voice(name, mode) {
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_S);
    bus.connect(master);
    return { key: name + ':' + mode, theme: name, mode, bus, step: 0, next: ctx.currentTime + 0.08, bpm: bpmFor(name, want), pat: compile(name, mode) };
  }
  function fadeOut(v) {
    try {
      const g = v.bus.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.linearRampToValueAtTime(0.0001, t + FADE_S);
      setTimeout(function () { try { v.bus.disconnect(); } catch (e) { /* gone */ } }, (FADE_S + 0.6) * 1000);
    } catch (e) { /* ignore */ }
  }

  function sync() {
    if (!ctx || muted) return;
    try {
      const name = themeFor(want);
      const mode = want.cook ? 'cook' : 'hub';
      const key = name + ':' + mode;
      if (!cur || cur.key !== key) {
        const prev = cur;
        cur = voice(name, mode);
        if (prev) fadeOut(prev);
      } else {
        cur.bpm = bpmFor(name, want);
      }
    } catch (e) { /* ignore */ }
  }

  function makeContext() {
    if (ctx || !AC) return;
    try {
      ctx = new AC();
      created++;
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(ctx.destination);
      const n = Math.floor(ctx.sampleRate * 0.06);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      const r = rng(7);
      for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    } catch (e) { ctx = null; master = null; }
  }

  function startTimer() {
    if (timer === null) timer = setInterval(tick, TICK_MS);
  }
  function stopTimer() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }

  function wake() {
    if (muted || !ctx) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    try { const p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
    sync();
    startTimer();
  }
  function sleep() {
    stopTimer();
    if (!ctx) return;
    try { const p = ctx.suspend(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
  }

  function onGesture() {
    started = true;
    if (muted) return;
    makeContext();
    wake();
  }

  function setMuted(m) {
    muted = !!m;
    try {
      if (muted) {
        if (cur) { fadeOut(cur); cur = null; }
        sleep();
      } else if (started) {
        makeContext();   // the toggle itself is a tap
        wake();
      }
    } catch (e) { /* ignore */ }
    return muted;
  }

  function update(w) {
    if (!w || typeof w !== 'object') return;
    want = {
      day: Number.isFinite(w.day) ? w.day : 0,
      week: Number.isFinite(w.week) ? w.week : 1,
      comp: w.comp === true,
      cook: w.cook === true,
      waiting: Number.isFinite(w.waiting) ? w.waiting : 0
    };
    if (ctx && !muted && timer !== null) sync();
  }

  function init(opts) {
    muted = !!(opts && opts.muted);
    try {
      root.addEventListener('pointerdown', onGesture, true);
      root.addEventListener('keydown', onGesture, true);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', function () {
          if (document.hidden) sleep(); else if (started) wake();
        });
      }
    } catch (e) { /* ignore */ }
  }

  function state() {
    return {
      supported: !!AC, started, muted, context: !!ctx, created,
      running: !!ctx && ctx.state === 'running', theme: cur ? cur.theme : null, mode: cur ? cur.mode : null,
      bpm: cur ? Math.round(cur.bpm * 10) / 10 : null
    };
  }

  PitSim.music = { init, update, setMuted, isMuted: function () { return muted; }, state, themes: Object.keys(THEMES) };
})();
