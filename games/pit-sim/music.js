// Your Pit: background music. Original country and southern rock tunes played on a chiptune, made
// with WebAudio at run time: a boom-chicka bass on the triangle, a train beat on noise, a picked lead
// on a pulse wave with slides into notes, and banjo-style rolls on a second square. No audio files,
// no samples. Every melody below is hand written for this game, one hook per theme in AABA form.
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
  const SQUARE_LP_HZ = 2600;    // lowpass on the square voices so the highs stay soft

  // Chords by name: root in semitones above the key and the triad shape.
  const CH = {
    I: [0, 'M'], ii: [2, 'm'], IV: [5, 'M'], V: [7, 'M'], vi: [9, 'm'],
    i: [0, 'm'], iv: [5, 'm'], bVI: [8, 'M'], bVII: [10, 'M']
  };
  const SHAPE = { M: [0, 4, 7], m: [0, 3, 7] };

  // Each theme: tempo, key (MIDI of the tonic, lead plays an octave up), eighth-note swing, steps per
  // bar (16 is 4/4 in sixteenths, 12 is a 3/4 waltz), whether the hub version has banjo rolls, the
  // form and the sections. A section is four bars of [chord, melody]. Melody tokens are
  // <offset>.<sixteenths> with the offset in semitones from the lead tonic, r for a rest, and an
  // optional lead mark: ~ a slide up a whole step into the note (a bend), _ a half step slide, h a
  // quick hammer-on from a whole step under.
  const THEMES = {
    // Monday, Tuesday: a lazy front-porch shuffle in F.
    easy: {
      bpm: 84, key: 53, swing: 0.33, steps: 16, rolls: false,
      form: ['A', 'A2', 'B', 'A2'],
      sec: {
        A:  [['I', 'r.2 ~4.2 7.4 9.2 7.2 4.4'], ['IV', '5.4 ~9.4 7.2 5.2 2.4'],
             ['I', 'r.2 ~4.2 7.4 9.2 7.2 12.4'], ['V', '~11.4 9.2 7.2 ~2.6 r.2']],
        A2: [['I', 'r.2 ~4.2 7.4 9.2 7.2 4.4'], ['IV', '5.4 ~9.4 7.2 5.2 2.4'],
             ['I', 'r.2 ~4.2 7.4 9.2 7.2 12.4'], ['I', '9.2 7.2 4.2 2.2 ~0.6 r.2']],
        B:  [['IV', '12.4 ~14.4 12.2 9.2 5.4'], ['IV', 'r.2 9.2 12.2 9.2 ~5.8'],
             ['I', '4.2 7.2 9.2 12.2 ~9.4 7.4'], ['V', '~7.6 4.2 2.4 r.4']]
      }
    },
    // Wednesday to Friday: a mid-tempo two-step in G, I vi IV V.
    bright: {
      bpm: 104, key: 55, swing: 0.15, steps: 16, rolls: false,
      form: ['A', 'A2', 'B', 'A2'],
      sec: {
        A:  [['I', '7.2 7.2 ~9.2 7.2 4.4 r.2 2.2'], ['vi', '4.2 4.2 h7.2 4.2 ~2.4 0.4'],
             ['IV', 'r.2 4.2 7.2 9.2 ~12.4 9.2 7.2'], ['V', '9.4 ~11.2 9.2 7.6 r.2']],
        A2: [['I', '7.2 7.2 ~9.2 7.2 4.4 r.2 2.2'], ['vi', '4.2 4.2 h7.2 4.2 ~2.4 0.4'],
             ['IV', 'r.2 4.2 7.2 9.2 ~12.4 9.2 7.2'], ['I', '9.2 7.2 4.2 2.2 ~4.2 0.6']],
        B:  [['IV', '12.2 12.2 ~14.2 12.2 9.4 7.4'], ['IV', 'r.2 9.2 12.2 14.2 ~16.4 14.4'],
             ['I', '12.2 9.2 7.2 4.2 ~7.4 4.2 2.2'], ['V', '~2.4 r.2 2.2 h4.2 2.2 -1.4']]
      }
    },
    // Saturday: a fast hoedown in A with banjo rolls.
    party: {
      bpm: 138, key: 57, swing: 0, steps: 16, rolls: true,
      form: ['A', 'A2', 'B', 'A2'],
      sec: {
        A:  [['I', '~4.2 4.1 7.1 9.2 7.2 12.2 9.1 7.1 4.2 r.2'], ['IV', '~9.2 9.1 12.1 14.2 12.2 9.4 r.4'],
             ['I', '~4.2 4.1 7.1 9.2 7.2 12.2 14.1 12.1 9.2 7.2'], ['V', '~11.4 9.2 7.2 4.1 2.1 4.2 7.4']],
        A2: [['I', '~4.2 4.1 7.1 9.2 7.2 12.2 9.1 7.1 4.2 r.2'], ['IV', '~9.2 9.1 12.1 14.2 12.2 9.4 r.4'],
             ['I', '~4.2 4.1 7.1 9.2 7.2 12.2 14.1 12.1 9.2 7.2'], ['I', '9.2 7.1 4.1 2.2 4.2 ~0.6 r.2']],
        B:  [['vi', 'r.2 9.2 12.2 9.2 ~16.4 12.2 9.2'], ['IV', '14.2 12.2 9.2 12.2 ~14.6 r.2'],
             ['I', '12.2 16.2 12.2 9.2 7.2 9.2 ~4.4'], ['V', '7.1 9.1 7.1 4.1 2.2 4.2 ~7.6 r.2']]
      }
    },
    // Sunday: a gentle gospel-picnic waltz in C.
    picnic: {
      bpm: 92, key: 48, swing: 0.2, steps: 12, rolls: false,
      form: ['A', 'A2', 'B', 'A2'],
      sec: {
        A:  [['I', '4.4 ~7.4 9.2 7.2'], ['IV', '~9.4 12.4 9.2 7.2'],
             ['I', '4.4 ~7.4 12.2 9.2'], ['V', '~7.6 4.2 2.4']],
        A2: [['I', '4.4 ~7.4 9.2 7.2'], ['IV', '~9.4 12.4 9.2 7.2'],
             ['I', '4.4 ~7.4 12.2 9.2'], ['I', '4.4 2.2 ~0.6']],
        B:  [['IV', '~12.4 14.4 12.2 9.2'], ['I', '7.6 4.2 ~7.4'],
             ['IV', '9.4 12.4 ~14.4'], ['V', '~11.6 9.2 7.4']]
      }
    },
    // Week 9: an outlaw competition stomp in D minor.
    comp: {
      bpm: 112, key: 50, swing: 0, steps: 16, rolls: false,
      form: ['A', 'A2', 'B', 'A2'],
      sec: {
        A:  [['i', '0.2 0.2 ~3.2 0.2 _5.2 3.2 0.4'], ['bVII', 'r.2 -2.2 0.2 3.2 ~7.4 3.2 0.2'],
             ['bVI', '0.2 0.2 ~3.2 0.2 _5.2 3.2 ~10.4'], ['V', '~7.6 4.2 r.2 _1.2 -3.4']],
        A2: [['i', '0.2 0.2 ~3.2 0.2 _5.2 3.2 0.4'], ['bVII', 'r.2 -2.2 0.2 3.2 ~7.4 3.2 0.2'],
             ['bVI', '0.2 0.2 ~3.2 0.2 _5.2 3.2 ~10.4'], ['i', '7.2 5.2 3.2 _0.6 r.4']],
        B:  [['iv', '~12.2 10.2 7.2 10.2 12.4 r.4'], ['iv', '~15.2 12.2 10.2 7.2 ~10.6 r.2'],
             ['i', '12.2 12.2 10.2 7.2 _5.2 3.2 0.4'], ['V', '~4.4 7.2 4.2 1.4 ~4.4']]
      }
    }
  };
  // Monday 0 to Sunday 6.
  const DAY_THEME = ['easy', 'easy', 'bright', 'bright', 'bright', 'party', 'picnic'];
  // A forward banjo roll over [root, third, fifth, octave], one note per sixteenth.
  const ROLL = [1, 2, 3, 1, 2, 3, 1, 3];

  let AC = null;
  try { AC = root.AudioContext || root.webkitAudioContext || null; } catch (e) { AC = null; }

  let ctx = null, master = null, env = null;
  let muted = false, started = false, timer = null, created = 0;
  let want = { day: 0, week: 1, comp: false, cook: false, waiting: 0 };
  let cur = null;               // the playing voice: { key, theme, mode, bus, sq, step, next, bpm, pat }
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

  function parseBar(str, S) {
    const notes = [];
    let pos = 0;
    for (const tok of String(str).trim().split(/\s+/)) {
      const m = /^([~_h]?)(r|-?\d+)\.(\d+)$/.exec(tok);
      if (!m) continue;
      const len = +m[3];
      if (m[2] !== 'r' && pos < S) notes.push({ at: pos, off: +m[2], len: Math.min(len, S - pos), mark: m[1] });
      pos += len;
    }
    return notes;
  }

  // Build one loop: per step, an optional lead note, bass note, chord stab or roll note, and drums.
  function compile(name, mode) {
    const k = name + ':' + mode;
    if (compiled[k]) return compiled[k];
    const th = THEMES[name];
    const S = th.steps, B = S / 4;
    const cook = mode === 'cook';
    const rolls = cook || th.rolls;
    const bars = [];
    for (const s of th.form) for (const b of th.sec[s]) bars.push(b);
    const out = [];
    for (let bi = 0; bi < bars.length; bi++) {
      const ch = CH[bars[bi][0]] || CH.I;
      const nx = CH[bars[(bi + 1) % bars.length][0]] || CH.I;
      const rootOff = ch[0] > 6 ? ch[0] - 12 : ch[0];
      const bassRoot = th.key - 12 + rootOff;
      const bassFifth = rootOff - 5 >= -7 ? bassRoot - 5 : bassRoot + 7;
      const nxRoot = th.key - 12 + (nx[0] > 6 ? nx[0] - 12 : nx[0]);
      const walk = bi % 4 === 3 && nx[0] !== ch[0];
      const tri = SHAPE[ch[1]].map(function (x) { return th.key + ch[0] % 12 + x; });
      const tones4 = [tri[0], tri[1], tri[2], tri[0] + 12];
      const lead = parseBar(bars[bi][1], S);
      const bar = [];
      for (let i = 0; i < S; i++) bar.push({ lead: null, len: 0, mark: '', bass: null, blen: 3, stab: null, roll: null, kick: 0, snare: 0, hat: 0 });
      for (const n of lead) { const st = bar[n.at]; st.lead = th.key + 12 + n.off; st.len = n.len; st.mark = n.mark; }
      // Boom: root on beat one, the fifth on the middle beat (alternate bars in a waltz).
      bar[0].bass = (B === 3 && bi % 2 === 1) ? bassFifth : bassRoot;
      if (B === 4) bar[8].bass = bassFifth;
      if (walk) {
        const ws = B === 4 ? [8, 12, 14] : [4, 8, 10];
        const wn = [-5, -3, -1];
        for (let j = 0; j < 3; j++) { bar[ws[j]].bass = nxRoot + wn[j]; bar[ws[j]].blen = 1.8; }
      }
      // Chicka: a short chord on the back beats, or a banjo roll in its place.
      for (let i = 0; i < S; i++) {
        const st = bar[i];
        const beat = i % 4 === 0 ? i / 4 : -1;
        if (rolls) st.roll = tones4[ROLL[i % 8]];
        else if (beat > 0 && (B === 3 || beat % 2 === 1)) st.stab = tri;
        // Train beat: soft kick on one and three, a snare burst on two and four, chugging eighths.
        if (beat === 0 || (B === 4 && beat === 2)) st.kick = cook ? 1 : 0.8;
        if (B === 4 && (beat === 1 || beat === 3)) st.snare = cook ? 1 : 0.6;
        if (B === 3 && beat > 0) st.snare = cook ? 0.5 : 0.3;
        if (i % 2 === 0) {
          if (cook) st.hat = i % 4 === 2 ? 1 : 0.55;
          else if (i % 4 === 2) st.hat = 0.6;
        } else if (cook && name === 'party' && i % 4 === 3) st.hat = 0.35;
      }
      for (const st of bar) out.push(st);
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

  // The sound sources. E is { c: context, noise: buffer, pulse: periodic wave }.
  function makeEnv(c) {
    const n = Math.floor(c.sampleRate * 0.25);
    const noise = c.createBuffer(1, n, c.sampleRate);
    const d = noise.getChannelData(0);
    const r = rng(7);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    // A 25 percent pulse with 24 harmonics: the twangy lead, without the top end of a true square.
    const H = 24, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (let h = 1; h <= H; h++) im[h] = (2 / (h * Math.PI)) * Math.sin(h * Math.PI * 0.25) * (1 - h / (H + 2));
    let pulse = null;
    try { pulse = c.createPeriodicWave(re, im); } catch (e) { pulse = null; }
    return { c, noise, pulse };
  }

  function note(E, kind, hz, t, dur, vol, out, mark) {
    const c = E.c;
    const o = c.createOscillator();
    const g = c.createGain();
    if (kind === 'pulse' && E.pulse) o.setPeriodicWave(E.pulse);
    else o.type = kind === 'pulse' ? 'square' : kind;
    if (mark === '~' || mark === '_') {
      o.frequency.setValueAtTime(hz * Math.pow(2, (mark === '~' ? -2 : -1) / 12), t);
      o.frequency.exponentialRampToValueAtTime(hz, t + Math.min(0.07, dur * 0.4));
    } else if (mark === 'h') {
      o.frequency.setValueAtTime(hz * Math.pow(2, -2 / 12), t);
      o.frequency.setValueAtTime(hz, t + Math.min(0.035, dur * 0.3));
    } else {
      o.frequency.setValueAtTime(hz, t);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseHit(E, t, type, freq, q, decay, vol, out) {
    if (!E.noise) return;
    const c = E.c;
    const s = c.createBufferSource();
    s.buffer = E.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t); s.stop(t + decay + 0.02);
  }
  function kick(E, t, vol, out) {
    const c = E.c;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.16);
  }

  function playStep(E, v, t, sd) {
    const st = v.pat[v.step % v.pat.length];
    if (st.bass !== null) note(E, 'triangle', midiHz(st.bass), t, sd * st.blen, 0.8, v.bus, '');
    if (st.lead !== null) {
      const len = st.len || 1;
      const gate = len <= 2 ? 0.5 : (len <= 4 ? 0.7 : 0.85);   // short picked notes, longer ones ring
      note(E, 'pulse', midiHz(st.lead), t, sd * len * gate, 0.30, v.sq, st.mark);
    }
    if (st.roll !== null) note(E, 'square', midiHz(st.roll), t, sd * 0.85, 0.055, v.sq, '');
    if (st.stab) for (const m of st.stab) note(E, 'square', midiHz(m), t, sd * 1.1, 0.04, v.sq, '');
    if (st.kick) kick(E, t, 0.7 * st.kick, v.bus);
    if (st.snare) noiseHit(E, t, 'bandpass', 1600, 0.8, 0.09, 0.45 * st.snare, v.bus);
    if (st.hat) noiseHit(E, t, 'highpass', 6000, 0.7, 0.03, 0.12 * st.hat, v.bus);
  }
  function stepLen(th, v) {
    const base = 60 / v.bpm / 4;
    return base * ((v.step % 4) < 2 ? 1 + th.swing : 1 - th.swing);   // swing on the eighth pairs
  }

  function tick() {
    if (!ctx || !cur) return;
    try {
      const v = cur;
      const th = THEMES[v.theme];
      const horizon = ctx.currentTime + LOOKAHEAD_S;
      if (v.next < ctx.currentTime - 0.5) v.next = ctx.currentTime + 0.05;   // after a suspend, catch up
      while (v.next < horizon) {
        playStep(env, v, v.next, 60 / v.bpm / 4);
        v.next += stepLen(th, v);
        v.step++;
      }
    } catch (e) { /* never let the music break the game */ }
  }

  function makeBus(c, dest, fadeIn) {
    const bus = c.createGain();
    if (fadeIn) {
      bus.gain.setValueAtTime(0.0001, c.currentTime);
      bus.gain.linearRampToValueAtTime(1, c.currentTime + FADE_S);
    }
    bus.connect(dest);
    const sq = c.createBiquadFilter();
    sq.type = 'lowpass'; sq.frequency.value = SQUARE_LP_HZ; sq.Q.value = 0.5;
    sq.connect(bus);
    return { bus, sq };
  }
  function voice(name, mode) {
    const b = makeBus(ctx, master, true);
    return { key: name + ':' + mode, theme: name, mode, bus: b.bus, sq: b.sq, step: 0, next: ctx.currentTime + 0.08, bpm: bpmFor(name, want), pat: compile(name, mode) };
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
      env = makeEnv(ctx);
    } catch (e) { ctx = null; master = null; env = null; }
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

  // Dev only: render a theme into an OfflineAudioContext and report the peak. Not used by the game.
  function renderTest(name, mode, seconds, waiting) {
    const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC || !THEMES[name]) return Promise.resolve(null);
    const sr = 44100, secs = seconds || 6;
    const c = new OAC(1, Math.ceil(sr * secs), sr);
    const m = c.createGain();
    m.gain.value = VOLUME;
    m.connect(c.destination);
    const E = makeEnv(c);
    const b = makeBus(c, m, false);
    const w = { cook: mode === 'cook', waiting: waiting || 0 };
    const v = { theme: name, bus: b.bus, sq: b.sq, step: 0, next: 0.02, bpm: bpmFor(name, w), pat: compile(name, mode) };
    const th = THEMES[name];
    while (v.next < secs - 0.3) { playStep(E, v, v.next, 60 / v.bpm / 4); v.next += stepLen(th, v); v.step++; }
    return c.startRendering().then(function (buf) {
      const d = buf.getChannelData(0);
      let peak = 0, sum = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
      return { name, mode, bpm: Math.round(v.bpm), steps: v.step, peak, rms: Math.sqrt(sum / d.length) };
    });
  }

  PitSim.music = { init, update, setMuted, isMuted: function () { return muted; }, state, themes: Object.keys(THEMES), _renderTest: renderTest };
})();
