// Your Pit: background music and pit sounds. Original roadhouse blues, porch country and gospel
// tunes, played on synthesized instruments made with WebAudio at run time. No audio files and no
// samples: the strings are Karplus-Strong plucks (an acoustic rhythm guitar, a slide guitar lead
// that glides into its notes, a banjo on Saturday, an upright-style bass), the drums are a brushed
// kit made from filtered noise, and Sunday adds a soft organ. Every melody below is hand written
// for this game.
//
// PitSim.music.update({ day, week, comp, cook, waiting }) is called by game.js as the game runs; the
// module picks a theme from the weekday (or the week 9 competition), a hub or cook version, and a
// tempo that rises a little with the guests waiting. Nothing makes a sound, and no AudioContext is
// made, until the first pointerdown or keydown. A missing WebAudio leaves every call a quiet no-op.
//
// PitSim.sfx.play(name, opts) plays pit sounds on the same context: 'fire' and 'crowd' are loops
// whose level follows opts (near, waiting); the rest are one shots. The music mute silences both;
// setSfxMuted silences only the sounds.
(function () {
  'use strict';
  const root = (typeof window !== 'undefined' ? window : globalThis);
  const PitSim = root.PitSim = root.PitSim || {};

  const VOLUME = 0.1;           // music master level, kept low under the game
  const SFX_VOLUME = 0.5;       // sound effects bus
  const FADE_S = 1.2;           // crossfade on a theme or screen change
  const LOOKAHEAD_S = 0.15;     // schedule this far ahead of audio time
  const TICK_MS = 30;
  const RISE_PER_GUEST = 0.02;  // cook tempo rise per guest waiting
  const RISE_CAP = 0.14;        // at most 14 percent faster

  // Chords: root in semitones above the key and the quality (M major, m minor, 7 dominant).
  const CH = {
    I: [0, 'M'], I7: [0, '7'], ii: [2, 'm'], IV: [5, 'M'], IV7: [5, '7'], V: [7, 'M'], V7: [7, '7'],
    vi: [9, 'm'], i: [0, 'm'], iv: [5, 'm'], bVI: [8, 'M'], bVII: [10, 'M']
  };

  // Each theme: tempo, key (MIDI of the slide lead's tonic), eighth swing, steps per bar, steps per
  // beat (4 is 4/4 in sixteenths, 3 is a 12/8 in triplet eighths), groove, form and sections. A
  // section is a list of bars, [chord, melody]. Melody tokens are <offset>.<steps> with the offset in
  // semitones from the lead tonic, r for a rest, and an optional slide mark: / a long slide up from
  // a major third under, ~ a whole step slide, _ a half step slide, h a quick hammer-on.
  const THEMES = {
    // Monday, Tuesday: a slow porch blues in E, 12 bars.
    easy: {
      bpm: 66, key: 64, swing: 0.33, steps: 16, beat: 4, groove: 'porch', form: ['A', 'B'],
      sec: {
        A: [['I7', '/12.6 10.2 7.4 r.4'], ['IV7', '10.2 12.2 10.2 7.2 ~5.4 3.2 0.2'],
            ['I7', '0.8 r.8'], ['I7', 'r.8 3.2 _4.2 7.4'],
            ['IV7', '/12.6 10.2 9.4 r.4'], ['IV7', '10.2 9.2 7.2 5.2 ~3.4 0.4'],
            ['I7', '_4.6 0.2 r.8'], ['I7', 'r.12 7.2 10.2'],
            ['V7', '/11.6 10.2 7.4 r.4'], ['IV7', '9.4 ~7.4 5.2 3.2 0.4'],
            ['I7', '_4.4 0.4 -5.4 -2.4'], ['V7', '-1.8 r.4 ~2.4']],
        B: [['I7', '/15.4 12.2 15.2 ~17.4 15.2 12.2'], ['IV7', '/17.6 15.2 12.4 10.4'],
            ['I7', '12.2 10.2 7.2 3.2 _4.4 0.4'], ['I7', 'r.12 /12.4'],
            ['IV7', '/17.6 15.2 12.4 10.4'], ['IV7', '9.2 10.2 9.2 5.2 ~3.4 0.4'],
            ['I7', '/7.6 4.2 0.4 r.4'], ['I7', 'r.8 0.2 3.2 _4.2 7.2'],
            ['V7', '/11.4 14.4 11.2 7.2 11.4'], ['IV7', '/12.4 9.4 5.2 ~7.6'],
            ['I7', '4.2 7.2 12.4 _4.4 0.4'], ['V7', '7.4 5.4 2.4 -1.4']]
      }
    },
    // Wednesday to Friday: a juke-joint shuffle in A, 12 bars with the quick change.
    bright: {
      bpm: 96, key: 69, swing: 0.3, steps: 16, beat: 4, groove: 'shuffle', form: ['A', 'B'],
      sec: {
        A: [['I7', 'r.2 7.2 9.2 7.2 ~4.4 0.4'], ['IV7', 'r.2 9.2 10.2 9.2 ~5.4 r.4'],
            ['I7', '4.2 7.2 9.2 12.2 ~9.4 7.4'], ['I7', '4.2 3.2 0.4 r.8'],
            ['IV7', 'r.2 12.2 14.2 12.2 ~10.4 9.4'], ['IV7', '5.2 9.2 12.2 9.2 ~10.4 9.4'],
            ['I7', '7.2 3.2 _4.4 0.8'], ['I7', 'r.8 0.2 4.2 7.2 9.2'],
            ['V7', '/11.6 14.2 11.4 7.4'], ['IV7', '/12.6 9.2 5.4 r.4'],
            ['I7', '4.2 7.2 4.2 0.2 ~-3.4 0.4'], ['V7', 'r.4 -1.2 2.2 5.2 7.6']],
        B: [['I7', '/16.6 12.2 9.4 7.4'], ['IV7', '/17.6 14.2 12.4 9.4'],
            ['I7', '16.2 14.2 12.2 9.2 ~7.4 4.4'], ['I7', '0.4 r.8 7.4'],
            ['IV7', '/17.6 14.2 12.4 9.4'], ['IV7', '9.2 10.2 9.2 5.2 ~3.4 0.4'],
            ['I7', '/4.6 7.2 9.4 12.4'], ['I7', '_16.4 12.4 9.2 7.2 4.4'],
            ['V7', '/14.6 11.2 7.4 5.4'], ['IV7', '/12.6 9.2 5.4 ~7.4'],
            ['I7', '_4.4 0.4 7.2 4.2 0.4'], ['V7', '-1.4 2.4 5.4 /7.4']]
      }
    },
    // Saturday: a roadhouse boogie in A with banjo rolls over the top.
    party: {
      bpm: 132, key: 69, swing: 0.2, steps: 16, beat: 4, groove: 'boogie', form: ['A', 'B'],
      sec: {
        A: [['I7', '0.2 3.1 _4.1 7.2 9.2 10.2 9.2 7.4'], ['I7', 'r.8 /12.4 10.2 7.2'],
            ['I7', '0.2 3.1 _4.1 7.2 9.2 10.2 9.2 7.4'], ['I7', '12.2 10.2 7.2 4.2 _4.2 0.2 r.4'],
            ['IV7', '5.2 8.1 _9.1 12.2 14.2 15.2 14.2 12.4'], ['IV7', 'r.8 /17.4 15.2 12.2'],
            ['I7', '0.2 3.1 _4.1 7.2 9.2 10.2 9.2 7.4'], ['I7', 'r.8 /12.4 10.2 7.2'],
            ['V7', '/14.4 11.2 7.2 /14.4 11.2 7.2'], ['IV7', '/12.4 9.2 5.2 /12.4 9.2 5.2'],
            ['I7', '0.2 3.1 _4.1 7.2 4.2 0.4 r.4'], ['V7', '7.2 6.2 5.2 4.2 /7.8']],
        B: [['I7', '/12.6 12.2 /12.6 10.2'], ['I7', '12.2 10.2 7.2 9.2 7.2 4.2 _4.4'],
            ['I7', '/12.6 12.2 /12.6 15.2'], ['I7', '_16.4 12.2 9.2 7.8'],
            ['IV7', '/17.6 17.2 /17.6 15.2'], ['IV7', '14.2 12.2 9.2 12.2 ~10.4 9.4'],
            ['I7', '/12.6 12.2 /16.6 12.2'], ['I7', '10.2 9.2 7.2 4.2 ~3.2 0.2 r.4'],
            ['V7', '/14.4 11.2 7.2 /14.4 11.2 7.2'], ['IV7', '/12.4 9.2 5.2 /12.4 9.2 5.2'],
            ['I7', '0.2 3.1 _4.1 7.2 4.2 0.4 r.4'], ['V7', '7.2 6.2 5.2 4.2 /7.8']]
      }
    },
    // Sunday: a slow gospel 12/8 in G with organ under the guitar.
    picnic: {
      bpm: 54, key: 67, swing: 0, steps: 12, beat: 3, groove: 'gospel', form: ['A', 'A2', 'B', 'A2'],
      sec: {
        A:  [['I', '/4.6 7.3 9.3'], ['IV', '/12.6 9.3 7.3'], ['I', '4.3 2.3 0.3 /4.3'], ['V', '/2.9 r.3']],
        A2: [['I', '/4.6 7.3 9.3'], ['IV', '/12.6 9.3 7.3'], ['I', '/7.6 4.3 2.3'], ['I', '/0.9 r.3']],
        B:  [['IV', '/12.6 14.3 12.3'], ['I', '11.3 /12.6 7.3'], ['ii', '/9.6 12.3 9.3'], ['V7', '/7.9 2.3']]
      }
    },
    // Week 9: a minor outlaw groove in D on a brushed train beat.
    comp: {
      bpm: 108, key: 62, swing: 0.05, steps: 16, beat: 4, groove: 'outlaw', form: ['A', 'A2', 'B', 'A2'],
      sec: {
        A:  [['i', '0.2 0.2 ~3.2 0.2 _5.2 3.2 0.4'], ['bVII', 'r.2 -2.2 0.2 3.2 ~7.4 3.2 0.2'],
             ['bVI', '0.2 0.2 ~3.2 0.2 _5.2 3.2 /10.4'], ['V', '/7.6 4.2 r.2 _1.2 -3.4']],
        A2: [['i', '0.2 0.2 ~3.2 0.2 _5.2 3.2 0.4'], ['bVII', 'r.2 -2.2 0.2 3.2 ~7.4 3.2 0.2'],
             ['bVI', '0.2 0.2 ~3.2 0.2 _5.2 3.2 /10.4'], ['i', '7.2 5.2 3.2 _0.6 r.4']],
        B:  [['iv', '/12.2 10.2 7.2 10.2 12.4 r.4'], ['iv', '/15.2 12.2 10.2 7.2 ~10.6 r.2'],
             ['i', '12.2 12.2 10.2 7.2 _5.2 3.2 0.4'], ['V', '/4.4 7.2 4.2 1.4 ~4.4']]
      }
    }
  };
  // Monday 0 to Sunday 6.
  const DAY_THEME = ['easy', 'easy', 'bright', 'bright', 'bright', 'party', 'picnic'];
  // A forward banjo roll over [root, third, fifth, octave].
  const ROLL = [1, 2, 3, 1, 2, 3, 1, 3];
  // Slide marks: [semitones under, glide seconds].
  const GLIDE = { '/': [4, 0.14], '~': [2, 0.07], '_': [1, 0.05], 'h': [2, 0.025] };
  // Plucked string models: decay to -60 dB (s), loss filter weight, pick softness, pick position, buffer length.
  const INST = {
    gtr:   { t60: 2.0, a: 0.5, soft: 0.55, pick: 0.22, len: 1.8 },
    slide: { t60: 3.2, a: 0.62, soft: 0.8, pick: 0.13, len: 3.0 },
    bass:  { t60: 1.2, a: 0.5, soft: 0.22, pick: 0.35, len: 1.6 },
    banjo: { t60: 0.75, a: 0.78, soft: 1, pick: 0.09, len: 0.9 }
  };

  let AC = null;
  try { AC = root.AudioContext || root.webkitAudioContext || null; } catch (e) { AC = null; }

  let ctx = null, master = null, env = null, sfxOut = null;
  let muted = false, sfxMuted = false, started = false, timer = null, created = 0;
  let want = { day: 0, week: 1, comp: false, cook: false, waiting: 0 };
  let cur = null;               // the playing voice
  const compiled = {};

  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp01(x) { return x > 1 ? 1 : (x > 0 ? x : 0); }
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
      const m = /^([~_h/]?)(r|-?\d+)\.(\d+)$/.exec(tok);
      if (!m) continue;
      const len = +m[3];
      if (m[2] !== 'r' && pos < S) notes.push({ at: pos, off: +m[2], len: Math.min(len, S - pos), mark: m[1] });
      pos += len;
    }
    return notes;
  }
  // Rhythm guitar root for a chord, kept between E2 and D#3 like open chords.
  function rootOf(key, off) { return ((key + off - 40) % 12 + 12) % 12 + 40; }

  // Build one loop: per step, an optional lead note, bass note, strum, banjo note, organ chord, drums.
  function compile(name, mode) {
    const k = name + ':' + mode;
    if (compiled[k]) return compiled[k];
    const th = THEMES[name];
    const S = th.steps;
    const cook = mode === 'cook';
    const bars = [];
    for (const s of th.form) for (const b of th.sec[s]) bars.push(b);
    const out = [];
    for (let bi = 0; bi < bars.length; bi++) {
      const ch = CH[bars[bi][0]] || CH.I;
      const nx = CH[bars[(bi + 1) % bars.length][0]] || CH.I;
      const R = rootOf(th.key, ch[0]), Rn = rootOf(th.key, nx[0]);
      const third = ch[1] === 'm' ? 3 : 4, sev = ch[1] === '7';
      const full = (sev ? [0, 7, 10, 16, 19, 24] : [0, 7, 12, 12 + third, 19, 24]).map(function (x) { return R + x; });
      const B = R - 12, F = B - 5 >= 28 ? B - 5 : B + 7, Bn = Rn - 12;
      const change = Rn !== R;
      const bar = [];
      for (let i = 0; i < S; i++) bar.push({ lead: null, bass: null, gtr: null, banjo: null, organ: null, kick: 0, tap: 0, swish: 0 });
      for (const n of parseBar(bars[bi][1], S)) bar[n.at].lead = { m: th.key + n.off, len: n.len, mark: n.mark };
      const G = function (i, notes, dir, vol, len, mute) { bar[i].gtr = { notes, dir, vol, len, mute: !!mute }; };
      const BS = function (i, m, len) { bar[i].bass = { m, len }; };
      const D = function (i, kick, tap, swish) { const s = bar[i]; if (kick) s.kick = kick; if (tap) s.tap = tap; if (swish) s.swish = swish; };
      if (th.groove === 'porch') {
        BS(0, B, 7); BS(8, F, change ? 4 : 7); if (change) BS(12, Bn - 1, 4);
        G(0, full, 1, 0.42, 8); G(8, full, -1, 0.26, 6);
        if (cook) { G(4, full, 1, 0.3, 1.5, true); G(12, full, 1, 0.3, 1.5, true); }
        for (let b = 0; b < 4; b++) { D(b * 4, 0, 0, cook ? 0.45 : 0.3); if (cook) D(b * 4 + 2, 0, 0, 0.28); }
        D(0, cook ? 0.7 : 0.45); D(4, 0, cook ? 0.7 : 0.4); D(12, 0, cook ? 0.7 : 0.4); if (cook) D(8, 0.55);
      } else if (th.groove === 'shuffle' || th.groove === 'boogie') {
        const dy = [[R, R + 7], [R, R + 9], [R, R + 7], [R, cook && bi % 2 ? R + 10 : R + 9]];
        const eighths = cook || th.groove === 'shuffle';
        for (let b = 0; b < 4; b++) {
          G(b * 4, dy[b], 1, cook ? 0.4 : 0.3, 1.8, true);
          if (eighths) G(b * 4 + 2, dy[b], 1, cook ? 0.3 : 0.2, 1.5, true);
        }
        if (th.groove === 'boogie' && cook) {
          const bw = [0, 4, 7, 9, 10, 9, 7, 4];
          for (let j = 0; j < 8; j++) BS(j * 2, B + bw[j], 1.8);
          if (change) BS(14, Bn - 1, 1.8);
        } else if (cook || th.groove === 'boogie') {
          const wk = [B, B + 4, B + 7, change ? Bn - 1 : B + 9];
          for (let b = 0; b < 4; b++) BS(b * 4, wk[b], 3.6);
        } else { BS(0, B, 7); BS(8, F, 7); }
        if (th.groove === 'boogie') {
          const bt = [R + 12, R + 12 + third, R + 19, R + 24];
          const stride = cook ? 1 : 2;
          for (let i = 0; i < S; i += stride) bar[i].banjo = { m: bt[ROLL[(i / stride) % 8]], v: cook ? 0.3 : 0.26 };
        }
        for (let i = 0; i < S; i += 2) D(i, 0, 0, i % 4 === 0 ? (cook ? 0.4 : 0.28) : (cook ? 0.3 : 0.2));
        D(0, cook ? 0.7 : 0.5); D(8, cook ? 0.6 : 0.4); D(4, 0, cook ? 0.75 : 0.45); D(12, 0, cook ? 0.75 : 0.45);
        if (cook && th.groove === 'boogie') { D(4, 0.35); D(12, 0.35); }
      } else if (th.groove === 'gospel') {
        bar[0].organ = { notes: [R + 12, R + 12 + third, R + 19, sev ? R + 22 : R + 24], len: S, v: cook ? 0.13 : 0.11 };
        BS(0, B, 5.5); BS(6, F, change ? 3 : 5.5); if (change) BS(9, Bn - 1, 3);
        const ap = [0, 7, 12 + third, 12, 19, 12 + third];
        for (let i = 0; i < S; i++) G(i, [R + ap[i % 6]], 1, (i % 3 === 0 ? 0.34 : 0.24) * (cook ? 1.1 : 1), 3.5);
        for (let b = 0; b < 4; b++) { D(b * 3, 0, 0, cook ? 0.32 : 0.22); if (cook) D(b * 3 + 2, 0, 0, 0.26); }
        D(3, 0, cook ? 0.6 : 0.36); D(9, 0, cook ? 0.6 : 0.36); D(0, cook ? 0.55 : 0.35); if (cook) D(6, 0.45);
      } else {   // outlaw
        if (cook) for (let b = 0; b < 4; b++) BS(b * 4, b % 2 ? F : B, 3.4);
        else { BS(0, B, 7); BS(8, F, 7); }
        const pc = [R, R + 7, R + 12];
        for (let i = 0; i < S; i += cook ? 2 : 4) G(i, pc, 1, (i % 4 === 0 ? 0.4 : 0.28) * (cook ? 1 : 0.8), 1.3, true);
        if (cook) for (let i = 0; i < S; i++) D(i, 0, 0, [0.42, 0.14, 0.26, 0.14][i % 4]);
        else for (let i = 0; i < S; i += 2) D(i, 0, 0, i % 4 === 0 ? 0.26 : 0.16);
        D(4, 0, cook ? 0.8 : 0.5); D(12, 0, cook ? 0.8 : 0.5); D(0, cook ? 0.75 : 0.5); D(8, cook ? 0.65 : 0.4);
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

  // Shared sources for one context: noise, the organ wave, a small room reverb, string buffers.
  function makeEnv(c, dest) {
    const sr = c.sampleRate;
    const n = Math.floor(sr);
    const noise = c.createBuffer(1, n, sr);
    const d = noise.getChannelData(0);
    const r = rng(7);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    const H = 8, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    const bars = [0, 1, 0.55, 0.3, 0.22, 0, 0.1, 0, 0.06];
    for (let h = 1; h <= H; h++) im[h] = bars[h];
    let organWave = null;
    try { organWave = c.createPeriodicWave(re, im); } catch (e) { organWave = null; }
    let verbIn = null;
    try {
      const L = Math.floor(sr * 1.3);
      const ir = c.createBuffer(2, L, sr);
      for (let ch = 0; ch < 2; ch++) {
        const x = ir.getChannelData(ch);
        const rr = rng(101 + ch);
        let lp = 0;
        for (let i = 0; i < L; i++) {
          const k = 0.7 - 0.55 * (i / L);
          lp += k * ((rr() * 2 - 1) - lp);
          x[i] = lp * Math.pow(1 - i / L, 3);
        }
      }
      const conv = c.createConvolver();
      conv.buffer = ir;
      verbIn = c.createGain();
      verbIn.connect(conv); conv.connect(dest);
    } catch (e) { verbIn = null; }
    return { c, noise, organWave, verbIn, ks: {}, fx: {} };
  }

  // Karplus-Strong: a burst of shaped noise fed around a tuned delay with a gentle loss filter. The
  // delay is a whole number of samples, so playbackRate makes up the last bit of tuning.
  function ks(E, inst, midi) {
    const key = inst + midi;
    if (E.ks[key]) return E.ks[key];
    const P = INST[inst], c = E.c, sr = c.sampleRate, hz = midiHz(midi);
    const b = 1 - P.a;
    const N = Math.max(2, Math.floor(sr / hz - b));
    const f0 = sr / (N + b);
    const L = Math.floor(sr * P.len);
    const buf = c.createBuffer(1, L, sr);
    const y = buf.getChannelData(0);
    const r = rng(midi * 31 + inst.length * 977);
    const e = new Float32Array(N);
    let s = 0, mean = 0;
    for (let i = 0; i < N; i++) { s += P.soft * ((r() * 2 - 1) - s); e[i] = s; }
    const pk = Math.max(1, Math.round(N * P.pick));
    for (let i = N - 1; i >= pk; i--) e[i] -= e[i - pk];
    for (let i = 0; i < N; i++) mean += e[i];
    mean /= N;
    const rho = Math.pow(0.001, 1 / (f0 * P.t60));
    let peak = 0;
    for (let i = 0; i < L; i++) {
      y[i] = i < N ? e[i] - mean : rho * (P.a * y[i - N] + b * (i - N - 1 >= 0 ? y[i - N - 1] : 0));
      const v = Math.abs(y[i]);
      if (v > peak) peak = v;
    }
    const fade = Math.floor(sr * 0.03), g = peak > 0 ? 1 / peak : 1;
    for (let i = 0; i < L; i++) y[i] *= g * (i > L - fade ? (L - i) / fade : 1);
    return (E.ks[key] = { buf, rate: hz / f0 });
  }

  function pluck(E, inst, midi, t, dur, vol, out, mark, rel) {
    const p = ks(E, inst, midi), c = E.c;
    const src = c.createBufferSource();
    src.buffer = p.buf;
    const g = c.createGain();
    const len = Math.max(0.03, Math.min(dur, p.buf.duration * 0.95));
    const G = GLIDE[mark];
    if (G || (inst === 'slide' && len > 0.35)) {
      const n = Math.max(8, Math.ceil(len * 90));
      const cv = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const tt = len * i / (n - 1);
        const bend = G && tt < G[1] ? -G[0] * Math.pow(1 - tt / G[1], 2) : 0;
        const vib = inst === 'slide' ? 0.13 * clamp01((tt - 0.22) / 0.3) * Math.sin(2 * Math.PI * 5.3 * tt) : 0;
        cv[i] = p.rate * Math.pow(2, (bend + vib) / 12);
      }
      src.playbackRate.setValueCurveAtTime(cv, t, len);
    } else {
      src.playbackRate.value = p.rate;
    }
    g.gain.setValueAtTime(vol, t);
    g.gain.setTargetAtTime(0, t + len, rel || 0.05);
    src.connect(g); g.connect(out);
    src.start(t); src.stop(t + len + (rel || 0.05) * 6);
  }
  function strum(E, ev, t, sd, out, muteOut, r) {
    const notes = ev.dir > 0 ? ev.notes : ev.notes.slice(-3).reverse();
    const sp = notes.length === 1 ? 0 : (ev.dir > 0 ? 0.011 : 0.008);
    for (let j = 0; j < notes.length; j++) {
      pluck(E, 'gtr', notes[j], t + j * sp, sd * ev.len, ev.vol * (1 - j * 0.04) * (0.9 + 0.2 * r()),
        ev.mute ? muteOut : out, '', ev.mute ? 0.015 : 0.05);
    }
  }
  function organ(E, notes, t, dur, vol, out) {
    const c = E.c;
    for (const m of notes) {
      const o = c.createOscillator();
      if (E.organWave) o.setPeriodicWave(E.organWave); else o.type = 'sine';
      o.frequency.value = midiHz(m);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.14);
      g.gain.setTargetAtTime(0, t + dur, 0.12);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.9);
    }
  }
  function noiseHit(E, t, type, freq, q, att, decay, vol, out, r) {
    const c = E.c;
    const s = c.createBufferSource();
    s.buffer = E.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + decay);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, (r ? r() : Math.random()) * 0.6); s.stop(t + att + decay + 0.03);
  }
  function tone(c, t, f0, f1, glide, decay, vol, out, type) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + decay + 0.03);
  }
  function kick(E, t, vol, out, r) {
    tone(E.c, t, 78, 46, 0.1, 0.28, vol, out);
    noiseHit(E, t, 'lowpass', 600, 0.7, 0.002, 0.03, vol * 0.3, out, r);
  }
  function brushTap(E, t, vol, out, r) {
    noiseHit(E, t, 'bandpass', 2300, 0.6, 0.003, 0.12, vol * 0.5, out, r);
    noiseHit(E, t, 'highpass', 5200, 0.7, 0.002, 0.07, vol * 0.18, out, r);
  }
  function brushSwish(E, t, vol, out, r) {
    noiseHit(E, t, 'bandpass', 3800, 0.45, 0.035, 0.16, vol * 0.2, out, r);
  }

  function playStep(E, v, t, sd) {
    const st = v.pat[v.step % v.pat.length], C = v.ch, r = v.r;
    const hum = function () { return (r() - 0.5) * 0.008; };
    if (st.bass) pluck(E, 'bass', st.bass.m, t + hum() * 0.5, sd * st.bass.len, 0.9 * (0.92 + 0.16 * r()), C.bass, '', 0.06);
    if (st.lead) {
      const len = st.lead.len;
      const gate = len <= 2 ? 0.6 : (len <= 4 ? 0.8 : 0.92);
      pluck(E, 'slide', st.lead.m, t, sd * len * gate, 0.55, C.lead, st.lead.mark, 0.07);
    }
    if (st.gtr) strum(E, st.gtr, t + hum(), sd, C.gtr, C.gtrMute, r);
    if (st.banjo) pluck(E, 'banjo', st.banjo.m, t + hum(), sd * 1.6, st.banjo.v * (0.85 + 0.3 * r()), C.banjo, '', 0.04);
    if (st.organ) organ(E, st.organ.notes, t, sd * st.organ.len, st.organ.v, C.organ);
    if (st.kick) kick(E, t, 0.7 * st.kick, C.drums, r);
    if (st.tap) brushTap(E, t + hum(), st.tap, C.drums, r);
    if (st.swish) brushSwish(E, t + hum(), st.swish, C.drums, r);
  }
  function stepLen(th, v) {
    const base = 60 / v.bpm / th.beat;
    if (th.beat !== 4) return base;
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
        playStep(env, v, v.next, 60 / v.bpm / th.beat);
        v.next += stepLen(th, v);
        v.step++;
      }
    } catch (e) { /* never let the music break the game */ }
  }

  function filt(c, type, f, q, gain) {
    const n = c.createBiquadFilter();
    n.type = type; n.frequency.value = f; n.Q.value = q;
    if (gain) n.gain.value = gain;
    return n;
  }
  function chain(nodes, dest) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(dest);
    return nodes[0];
  }
  // One voice's mix: a fading bus with a body filter per instrument, a slapback on the slide, a
  // reverb send.
  function makeBus(c, E, dest, fadeIn) {
    const bus = c.createGain();
    if (fadeIn) {
      bus.gain.setValueAtTime(0.0001, c.currentTime);
      bus.gain.linearRampToValueAtTime(1, c.currentTime + FADE_S);
    }
    bus.connect(dest);
    if (E.verbIn) { const send = c.createGain(); send.gain.value = 0.16; bus.connect(send); send.connect(E.verbIn); }
    const gtr = chain([filt(c, 'peaking', 180, 0.9, 3), filt(c, 'highshelf', 4000, 0.7, -5)], bus);
    const gtrMute = chain([filt(c, 'lowpass', 1000, 0.6)], gtr);
    const leadOut = filt(c, 'lowpass', 5200, 0.6);
    leadOut.connect(bus);
    const lead = chain([filt(c, 'peaking', 850, 0.9, 4)], leadOut);
    const dl = c.createDelay(0.5), fb = c.createGain(), wet = c.createGain();
    dl.delayTime.value = 0.12; fb.gain.value = 0.22; wet.gain.value = 0.22;
    leadOut.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(bus);
    const bass = chain([filt(c, 'lowpass', 750, 0.7), filt(c, 'peaking', 100, 1, 4)], bus);
    const banjo = chain([filt(c, 'highpass', 220, 0.7), filt(c, 'peaking', 2600, 1.2, 4)], bus);
    const org = chain([filt(c, 'lowpass', 1900, 0.6)], bus);
    return { bus, gtr, gtrMute, lead, bass, banjo, organ: org, drums: bus };
  }
  function voice(name, mode) {
    const ch = makeBus(ctx, env, master, true);
    return { key: name + ':' + mode, theme: name, mode, bus: ch.bus, ch, r: rng(created * 97 + name.length), step: 0, next: ctx.currentTime + 0.08, bpm: bpmFor(name, want), pat: compile(name, mode) };
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
      sfxOut = ctx.createGain();
      sfxOut.gain.value = sfxMuted ? 0 : SFX_VOLUME;
      sfxOut.connect(ctx.destination);
      env = makeEnv(ctx, master);
    } catch (e) { ctx = null; master = null; env = null; sfxOut = null; }
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
    applyLoops();
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
    if (opts && opts.sfxMuted !== undefined) sfxMuted = !!opts.sfxMuted;
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
      supported: !!AC, started, muted, sfxMuted, context: !!ctx, created,
      running: !!ctx && ctx.state === 'running', theme: cur ? cur.theme : null, mode: cur ? cur.mode : null,
      bpm: cur ? Math.round(cur.bpm * 10) / 10 : null,
      loops: { fire: loopWant.fire, crowd: loopWant.crowd }
    };
  }

  // ---- Pit sounds ----------------------------------------------------------------------------
  const FIRE_MAX = 0.5, CROWD_MAX = 0.45, MIN_GAP_S = 0.06;
  const loopWant = { fire: 0, crowd: 0 };
  const loops = {};
  const lastAt = {};

  // A buffer filled once per context by fill(data, sampleRate, random).
  function fxBuf(E, name, secs, fill) {
    if (E.fx[name]) return E.fx[name];
    const c = E.c, sr = c.sampleRate, L = Math.floor(sr * secs);
    const buf = c.createBuffer(1, L, sr);
    const d = buf.getChannelData(0);
    fill(d, sr, rng(name.length * 131 + 5));
    let peak = 0;
    for (let i = 0; i < L; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
    if (peak > 0) for (let i = 0; i < L; i++) d[i] /= peak;
    return (E.fx[name] = buf);
  }
  // Eight seconds of fire that loops: a low roar, small crackles and the odd coal pop.
  function fillFire(d, sr, r) {
    const X = Math.floor(sr * 0.4), L = d.length - X;
    let br = 0, lp = 0;
    for (let i = 0; i < d.length; i++) {
      const w = r() * 2 - 1;
      br = br * 0.996 + w * 0.02;
      lp += 0.12 * (w - lp);
      const ts = i / sr;
      const flick = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.37 * ts) * Math.sin(2 * Math.PI * 0.13 * ts + 1);
      d[i] = (br * 0.9 + lp * 0.18) * flick;
    }
    const burst = function (p, amp, n, tau) {
      for (let j = 0; j < n && p + j < d.length; j++) d[p + j] += amp * (r() * 2 - 1) * Math.exp(-j / tau);
    };
    const crackles = Math.floor(L / sr * 16);
    for (let k = 0; k < crackles; k++) {
      const n = Math.floor(sr * (0.0008 + 0.004 * r()));
      burst(Math.floor(r() * L), 0.12 + 0.5 * r() * r(), n, n * 0.3);
    }
    const pops = Math.floor(L / sr * 0.6);
    for (let k = 0; k < pops; k++) {
      const p = Math.floor(r() * (L - sr * 0.2));
      burst(p, 1.1, Math.floor(sr * 0.006), sr * 0.0015);
      const f = 110 + 90 * r();
      for (let j = 0; j < sr * 0.04; j++) d[p + j] += 0.35 * Math.sin(2 * Math.PI * f * j / sr) * Math.exp(-j / (sr * 0.012));
      for (let q = 0; q < 4; q++) burst(p + Math.floor(sr * (0.02 + 0.15 * r())), 0.3 * r(), Math.floor(sr * 0.002), sr * 0.0006);
    }
    for (let i = 0; i < X; i++) { const a = i / X; d[i] = d[i] * a + d[L + i] * (1 - a); }
  }
  function fillSizzle(d, sr, r) {
    let lp = 0, am = 0.5, tgt = 0.5;
    for (let i = 0; i < d.length; i++) {
      const w = r() * 2 - 1;
      lp += 0.35 * (w - lp);
      if (i % Math.floor(sr * 0.012) === 0) tgt = 0.25 + 0.75 * r();
      am += 0.004 * (tgt - am);
      const ts = i / sr;
      const envl = Math.min(1, ts / 0.025) * Math.exp(-ts / 0.55);
      d[i] = (w - lp) * am * envl;
      if (r() < 0.0012) for (let j = 0; j < 50 && i + j < d.length; j++) d[i + j] += 0.6 * envl * (r() * 2 - 1) * Math.exp(-j / 12);
    }
  }

  function noiseSrc(E, t, dur) {
    const s = E.c.createBufferSource();
    s.buffer = E.noise; s.loop = true;
    s.start(t, Math.random() * 0.8); s.stop(t + dur);
    return s;
  }
  function envGain(c, t, att, peak, decay) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + decay);
    return g;
  }

  const FX = {
    sizzle: function (E, t, v, out) {
      const c = E.c, s = c.createBufferSource();
      s.buffer = fxBuf(E, 'sizzle', 1.6, fillSizzle);
      const g = c.createGain(); g.gain.value = 0.45 * v;
      chain([s, filt(c, 'bandpass', 5000, 0.4), g], out);
      s.start(t);
    },
    knife: function (E, t, v, out) {
      const c = E.c;
      const bp = filt(c, 'bandpass', 1500, 2);
      bp.frequency.setValueAtTime(1500, t);
      bp.frequency.exponentialRampToValueAtTime(5500, t + 0.13);
      chain([noiseSrc(E, t, 0.2), bp, envGain(c, t, 0.05, 0.45 * v, 0.1)], out);
      tone(c, t + 0.13, 240, 150, 0.05, 0.07, 0.3 * v, out);
      noiseHit(E, t + 0.13, 'lowpass', 1200, 0.7, 0.002, 0.04, 0.22 * v, out);
    },
    ding: function (E, t, v, out) {
      const c = E.c, f = 1318.5;
      tone(c, t, f, f, 0, 1.2, 0.2 * v, out);
      tone(c, t, f * 2.76, f * 2.76, 0, 0.5, 0.07 * v, out);
      tone(c, t, f * 5.4, f * 5.4, 0, 0.25, 0.025 * v, out);
    },
    pull: function (E, t, v, out) {
      const c = E.c;
      const bp = filt(c, 'bandpass', 1600, 0.8);
      bp.frequency.setValueAtTime(1600, t);
      bp.frequency.exponentialRampToValueAtTime(600, t + 0.7);
      chain([noiseSrc(E, t, 0.95), bp, envGain(c, t, 0.06, 0.4 * v, 0.8)], out);
      tone(c, t + 0.02, 95, 60, 0.12, 0.16, 0.35 * v, out);
    },
    burnwarn: function (E, t, v, out) {
      const c = E.c;
      [[880, 0], [698.46, 0.2]].forEach(function (n) {
        tone(c, t + n[1], n[0], n[0], 0, 0.36, 0.16 * v, out);
        tone(c, t + n[1], n[0] * 2, n[0] * 2, 0, 0.2, 0.03 * v, out);
      });
    }
  };
  const LOOP = {
    fire: function (E, out) {
      const c = E.c, s = c.createBufferSource();
      s.buffer = fxBuf(E, 'fire', 8.4, fillFire); s.loop = true;
      s.loopEnd = s.buffer.duration - 0.4;
      const g = c.createGain(); g.gain.value = 0;
      chain([s, filt(c, 'highpass', 70, 0.7), g], out);
      s.start(c.currentTime);
      return { g, max: FIRE_MAX, nodes: [s] };
    },
    crowd: function (E, out) {
      const c = E.c, t = c.currentTime;
      const g = c.createGain(); g.gain.value = 0;
      const lp = filt(c, 'lowpass', 3000, 0.6);
      lp.connect(g); g.connect(out);
      const nodes = [];
      [[420, 3, 3.1, 0.17], [700, 3.5, 4.4, 0.23], [1150, 4, 5.3, 0.13], [2300, 5, 3.7, 0.29]].forEach(function (L, i) {
        const s = c.createBufferSource();
        s.buffer = E.noise; s.loop = true;
        const bp = filt(c, 'bandpass', L[0], L[1]);
        const lg = c.createGain(); lg.gain.value = 0.5;
        const o = c.createOscillator(); o.frequency.value = L[2];
        const od = c.createGain(); od.gain.value = 0.45;
        o.connect(od); od.connect(lg.gain);
        const o2 = c.createOscillator(); o2.frequency.value = L[3];
        const od2 = c.createGain(); od2.gain.value = L[0] * 0.2;
        o2.connect(od2); od2.connect(bp.frequency);
        s.connect(bp); bp.connect(lg); lg.connect(lp);
        s.start(t, i * 0.21); o.start(t); o2.start(t);
        nodes.push(s, o, o2);
      });
      return { g, max: CROWD_MAX, nodes };
    }
  };
  function crowdLevel(w) {
    if (w === undefined || w === null) return 0.5;
    const n = Number(w);
    return Number.isFinite(n) && n > 0 ? Math.pow(clamp01(n / 10), 0.7) : 0;
  }
  function applyLoops() {
    if (!ctx || !env || !sfxOut) return;
    try {
      const t = ctx.currentTime;
      for (const name of ['fire', 'crowd']) {
        const lvl = loopWant[name];
        let L = loops[name];
        if (lvl > 0 && !L) L = loops[name] = LOOP[name](env, sfxOut);
        if (!L) continue;
        L.g.gain.setTargetAtTime(L.max * lvl, t, 0.25);
        if (lvl <= 0) {
          for (const n of L.nodes) { try { n.stop(t + 1.5); } catch (e) { /* ignore */ } }
          delete loops[name];
        }
      }
    } catch (e) { /* ignore */ }
  }
  function play(name, opts) {
    const o = opts || {};
    if (name === 'fire' || name === 'crowd') {
      loopWant[name] = name === 'fire' ? (o.near === undefined ? 1 : clamp01(+o.near || 0)) : crowdLevel(o.waiting);
      applyLoops();
      return true;
    }
    if (!FX[name] || !ctx || !env || muted || sfxMuted) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    try {
      const t = ctx.currentTime;
      if (lastAt[name] !== undefined && t - lastAt[name] < MIN_GAP_S) return false;
      lastAt[name] = t;
      FX[name](env, t + 0.005, o.vol === undefined ? 1 : clamp01(+o.vol || 0), sfxOut);
      return true;
    } catch (e) { return false; }
  }
  function stop(name) {
    if (name in loopWant) { loopWant[name] = 0; applyLoops(); }
  }
  function setSfxMuted(m) {
    sfxMuted = !!m;
    try { if (sfxOut) sfxOut.gain.setTargetAtTime(sfxMuted ? 0 : SFX_VOLUME, ctx.currentTime, 0.08); } catch (e) { /* ignore */ }
    return sfxMuted;
  }
  function isSfxMuted() { return sfxMuted; }

  function measure(c, extra) {
    return c.startRendering().then(function (buf) {
      const d = buf.getChannelData(0);
      let peak = 0, sum = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
      const res = { peak, rms: Math.sqrt(sum / d.length) };
      for (const k in extra) res[k] = extra[k];
      return res;
    });
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
    const E = makeEnv(c, m);
    const ch = makeBus(c, E, m, false);
    const w = { cook: mode === 'cook', waiting: waiting || 0 };
    const v = { theme: name, bus: ch.bus, ch, r: rng(3), step: 0, next: 0.02, bpm: bpmFor(name, w), pat: compile(name, mode) };
    const th = THEMES[name];
    while (v.next < secs - 0.3) { playStep(E, v, v.next, 60 / v.bpm / th.beat); v.next += stepLen(th, v); v.step++; }
    return measure(c, { name, mode, bpm: Math.round(v.bpm), steps: v.step });
  }
  // Dev only: render one sound (a loop at full level) and report the peak.
  function sfxRenderTest(name, opts, seconds) {
    const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC || !(FX[name] || LOOP[name])) return Promise.resolve(null);
    const sr = 44100, secs = seconds || 3;
    const c = new OAC(1, Math.ceil(sr * secs), sr);
    const out = c.createGain();
    out.gain.value = SFX_VOLUME;
    out.connect(c.destination);
    const E = makeEnv(c, out);
    const o = opts || {};
    if (LOOP[name]) {
      const L = LOOP[name](E, out);
      const lvl = name === 'fire' ? (o.near === undefined ? 1 : clamp01(+o.near)) : crowdLevel(o.waiting === undefined ? 10 : o.waiting);
      L.g.gain.setValueAtTime(L.max * lvl, 0);
    } else {
      FX[name](E, 0.05, 1, out);
    }
    return measure(c, { name });
  }

  PitSim.music = {
    init, update, setMuted, isMuted: function () { return muted; }, setSfxMuted, isSfxMuted, state,
    themes: Object.keys(THEMES), _renderTest: renderTest
  };
  PitSim.sfx = {
    play, stop, stopAll: function () { stop('fire'); stop('crowd'); }, setSfxMuted, isSfxMuted,
    isMuted: function () { return muted; }, names: Object.keys(FX).concat(Object.keys(LOOP)), _renderTest: sfxRenderTest
  };
})();
