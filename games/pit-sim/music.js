// Your Pit: background music and pit sounds.
//
// The music is eight licensed Pixabay tracks, given a heavy 8-bit treatment (mono, crushed and
// band limited), stored as MP3 files in tracks/ beside the page and loaded only when wanted:
//
//   highway-heat           Highway Heat, by danydory
//                          https://pixabay.com/music/rock-highway-heat-rock-sudiste-country-rock-507751/
//   burning-road           The Burning Road, by danydory
//                          https://pixabay.com/music/hard-rock-the-burning-road-rock-sudiste-southern-rock-473867/
//   rock-drive             Rock Drive, by Alex_Again
//                          https://pixabay.com/music/hard-rock-rock-drive-422405/
//   country-southern-rock  Country Southern Rock, by Echobrainz
//                          https://pixabay.com/music/american-roots-rock-country-southern-rock-553718/
//   freewheeling           Freewheeling, by danydory
//                          https://pixabay.com/music/rock-freewheeling-rock-sudiste-southern-rock-474674/
//   southern-sin           Southern Sin (Instrumental), by alanajordan
//                          https://pixabay.com/music/rock-southern-sin-instrumental-version-360833/
//   blues-rock-energetic   Blues Rock Energetic, by Emmraan
//                          https://pixabay.com/music/rock-blues-rock-energetic-203364/
//   cold-one               Modern Country Rock Instrumental: Cold One (artist as listed on the page)
//                          https://pixabay.com/music/rock-modern-country-rock-instrumental-cold-one-271175/
//
// License: Pixabay Content License (https://pixabay.com/service/license-summary/). Use inside a game
// or website is allowed, commercial use is allowed, no attribution is required. The tracks must
// never be distributed on their own (as standalone audio files or a sound pack); they ship only as
// part of this game. tracks/LICENSE.txt carries this note with the files.
//
// Which track plays:
//   hub screens (week, shop, crew, planner)     freewheeling
//   weekday Yard day cooks (Monday to Friday)   country-southern-rock and cold-one, by turns
//   Saturday bookings                           highway-heat and rock-drive, by turns
//   Sunday                                      southern-sin
//   the competition                             burning-road
//   results, trophy and season end screens      blues-rock-energetic
//
// PitSim.music.update({ day, week, comp, cook, waiting, screen }) is called by game.js as the game
// runs. screen is optional ('results' or 'hub'); without it the module reads the open panel and the
// sim loop from PitSim.game to spot the results screens. A track is loaded from tracks/ and decoded with decodeAudioData
// the first time it is wanted (one at a time, at most two kept), looped with a short crossfade baked in
// at the loop point, and swapped with a 1.2 s crossfade. During a cook the track speeds up gently
// with the guests waiting (playbackRate, at most 6 percent). Nothing makes a sound, and no
// AudioContext is made, until the first pointerdown or keydown. A missing WebAudio leaves every call
// a quiet no-op.
//
// PitSim.sfx.play(name, opts) plays pit sounds on the same context: 'fire' and 'crowd' are loops
// whose level follows opts (near, waiting); the rest are one shots. The music mute silences both;
// setSfxMuted silences only the sounds.
(function () {
  'use strict';
  const root = (typeof window !== 'undefined' ? window : globalThis);
  const PitSim = root.PitSim = root.PitSim || {};

  const VOLUME = 0.32;          // music master level, kept low under the game
  const SFX_VOLUME = 0.5;       // sound effects bus
  const FADE_S = 1.2;           // crossfade on a track or screen change
  const LOOP_XF_S = 0.25;       // crossfade baked in at each track's loop point
  const POLL_MS = 400;          // how often the screen is checked while music plays
  const RISE_PER_GUEST = 0.012; // cook playbackRate rise per guest waiting
  const RISE_CAP = 0.06;        // at most 6 percent faster
  const KEEP = 2;               // decoded tracks kept in memory
  const TRACK_DIR = './tracks/'; // the MP3s, beside the page
  const STALL_MS = 1500;        // no frame drawn this long: the page is out of sight, go quiet

  const TRACKS = ['highway-heat', 'burning-road', 'rock-drive', 'country-southern-rock',
    'freewheeling', 'southern-sin', 'blues-rock-energetic', 'cold-one'];
  // The old theme names, kept for state() and callers: Monday 0 to Sunday 6.
  const DAY_THEME = ['easy', 'easy', 'bright', 'bright', 'bright', 'party', 'picnic'];
  const THEME_NAMES = ['easy', 'bright', 'party', 'picnic', 'comp', 'results'];
  const RESULT_PANELS = { till: 1, daycard: 1, 'season-end': 1 };
  const RESULT_LOOPS = { report: 1, seasonEnd: 1, offseason: 1 };

  let AC = null;
  try { AC = root.AudioContext || root.webkitAudioContext || null; } catch (e) { AC = null; }

  let ctx = null, master = null, env = null, sfxOut = null;
  let muted = false, sfxMuted = false, started = false, timer = null, created = 0;
  let lastFrame = 0, stalled = false;   // the frame watchdog (see sync)
  // One copy plays at a time: an app can keep an older copy of the page alive beside a new one (a
  // republished preview). Whichever copy the player last touched plays; the others go quiet.
  // BroadcastChannel stays in this browser on this origin; nothing is stored or sent anywhere.
  const ME = Math.random().toString(36).slice(2);
  let chan = null, yielded = false;
  function claimAudio() {
    yielded = false;
    try { if (chan) chan.postMessage({ play: 1, id: ME }); } catch (e) { /* no channel */ }
  }
  let want = { day: 0, week: 1, comp: false, cook: false, waiting: 0, screen: null };
  let cur = null;               // the playing voice
  let pick = null;              // the last choice: { theme, mode, track, rate }
  let lastError = null;
  const bufs = {};              // track id to its loop buffer, for the live context
  const order = [];             // decode order, oldest first, for eviction
  let decoding = null;          // the track being decoded now
  let decodeChain = Promise.resolve();

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

  // ---- Choosing a track -----------------------------------------------------------------------
  function gameView() {
    const g = PitSim.game;
    let panel = null, loop = null, today = null;
    try { panel = g ? g.panel : null; } catch (e) { panel = null; }
    try { const s = g && g.sim && g.sim.state; loop = s ? s.loop : null; today = s ? s.today : null; } catch (e) { loop = null; }
    return { panel, loop, today };
  }
  function isResults(w, v) {
    if (w.screen === 'results') return true;
    if (w.screen === 'hub' || w.cook) return false;
    return !!(RESULT_PANELS[v.panel] || RESULT_LOOPS[v.loop]);
  }
  function isComp(w, v) {
    if (v.today && typeof v.today === 'object' && 'comp' in v.today) return !!v.today.comp;
    return w.comp;
  }
  function choose(w) {
    const v = gameView();
    const day = ((w.day | 0) % 7 + 7) % 7;
    const week = Math.max(0, w.week | 0);
    const comp = w.cook && isComp(w, v);
    let theme = comp ? 'comp' : (DAY_THEME[day] || 'easy');
    let mode = w.cook ? 'cook' : 'hub';
    let track = 'freewheeling';
    if (isResults(w, v)) { theme = 'results'; mode = 'hub'; track = 'blues-rock-energetic'; }
    else if (w.cook) {
      if (comp) track = 'burning-road';
      else if (day === 6) track = 'southern-sin';
      else if (day === 5) track = week % 2 ? 'rock-drive' : 'highway-heat';
      else track = (week * 5 + day) % 2 ? 'cold-one' : 'country-southern-rock';
    }
    const rate = w.cook ? 1 + Math.min(RISE_CAP, Math.max(0, w.waiting | 0) * RISE_PER_GUEST) : 1;
    return { theme, mode, track, rate };
  }

  // ---- Decoding -------------------------------------------------------------------------------
  // A track's MP3 comes from tracks/<id>.mp3 beside the page, same origin, only when it is first
  // wanted (after the first gesture turns music on). XHR, not fetch, so a file:// page loads it too.
  function bytesOf(id) {
    return new Promise(function (ok, bad) {
      if (TRACKS.indexOf(id) < 0) { bad(new Error('no track ' + id)); return; }
      const x = new root.XMLHttpRequest();
      x.open('GET', TRACK_DIR + id + '.mp3');
      x.responseType = 'arraybuffer';
      x.onload = function () {
        if ((x.status === 200 || x.status === 0) && x.response && x.response.byteLength) ok(x.response);
        else bad(new Error('track load failed: ' + id + ' ' + x.status));
      };
      x.onerror = function () { bad(new Error('track load failed: ' + id)); };
      x.send();
    });
  }
  function decodeOn(c, id) {
    return bytesOf(id).then(function (ab) {
      return new Promise(function (ok, bad) {
        try {
          const p = c.decodeAudioData(ab, ok, function (e) { bad(e || new Error('decode failed: ' + id)); });
          if (p && p.then) p.then(ok, bad);
        } catch (e) { bad(e); }
      });
    });
  }
  // Bake an equal power crossfade into the loop point: the last LOOP_XF_S seconds fade out over the
  // first LOOP_XF_S seconds, and the tail is cut, so loop = true wraps without a seam.
  function loopBuffer(c, src) {
    const sr = src.sampleRate, N = src.length;
    const X = Math.min(Math.floor(sr * LOOP_XF_S), Math.floor(N / 4));
    const L = N - X;
    const out = c.createBuffer(src.numberOfChannels, L, sr);
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      const d = src.getChannelData(ch), o = out.getChannelData(ch);
      o.set(d.subarray(0, L));
      for (let i = 0; i < X; i++) {
        const t = (i + 0.5) / X;
        o[i] = d[i] * Math.sin(t * Math.PI / 2) + d[L + i] * Math.cos(t * Math.PI / 2);
      }
    }
    return out;
  }
  function remember(id, buf) {
    bufs[id] = buf;
    const k = order.indexOf(id);
    if (k >= 0) order.splice(k, 1);
    order.push(id);
    while (order.length > KEEP) {
      const old = order.find(function (x) { return !(cur && cur.track === x) && x !== id; });
      if (!old) break;
      order.splice(order.indexOf(old), 1);
      delete bufs[old];
    }
  }
  // Decode one track for the live context, one decode at a time.
  function ensure(id) {
    if (bufs[id] || decoding === id) return;
    const c = ctx;
    decodeChain = decodeChain.then(function () {
      if (bufs[id] || c !== ctx || !pick || pick.track !== id) return null;
      decoding = id;
      return decodeOn(c, id).then(function (raw) {
        decoding = null;
        if (c !== ctx) return;
        remember(id, loopBuffer(c, raw));
        sync();
      }, function (e) { decoding = null; lastError = String(e && e.message || e); });
    });
  }

  // ---- Voices ---------------------------------------------------------------------------------
  function voice(p) {
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(1, t + FADE_S);
    bus.connect(master);
    const src = ctx.createBufferSource();
    src.buffer = bufs[p.track];
    src.loop = true;
    src.playbackRate.value = p.rate;
    src.connect(bus);
    src.start(t + 0.02);
    return { track: p.track, theme: p.theme, mode: p.mode, rate: p.rate, src, bus };
  }
  function fadeOut(v) {
    try {
      const g = v.bus.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.linearRampToValueAtTime(0.0001, t + FADE_S);
      v.src.stop(t + FADE_S + 0.1);
      setTimeout(function () { try { v.bus.disconnect(); } catch (e) { /* gone */ } }, (FADE_S + 0.6) * 1000);
    } catch (e) { /* ignore */ }
  }

  function sync() {
    if (!ctx || muted || yielded) return;
    // A page kept alive out of sight (an app's closed artifact view, a hidden frame) can still read
    // as visible but draws no frames. No frame for STALL_MS: go quiet until frames come back.
    if (outOfSight()) { stalled = true; sleep(); return; }
    try {
      pick = choose(want);
      if (cur && cur.track === pick.track) {
        cur.theme = pick.theme; cur.mode = pick.mode;
        if (Math.abs(cur.rate - pick.rate) > 1e-4) {
          cur.rate = pick.rate;
          cur.src.playbackRate.setTargetAtTime(pick.rate, ctx.currentTime, 1.5);
        }
        return;
      }
      if (!bufs[pick.track]) { ensure(pick.track); return; }   // the old track plays on until it is ready
      const prev = cur;
      cur = voice(pick);
      if (prev) fadeOut(prev);
    } catch (e) { lastError = String(e && e.message || e); }
  }

  // ---- Context and lifecycle ------------------------------------------------------------------
  // Shared sources for one context: noise and the sound effect buffers.
  function makeEnv(c) {
    const sr = c.sampleRate;
    const n = Math.floor(sr);
    const noise = c.createBuffer(1, n, sr);
    const d = noise.getChannelData(0);
    const r = rng(7);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return { c, noise, fx: {} };
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
      env = makeEnv(ctx);
    } catch (e) { ctx = null; master = null; env = null; sfxOut = null; }
  }

  function startTimer() {
    if (timer === null) timer = setInterval(sync, POLL_MS);
  }
  function stopTimer() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }

  function wake() {
    if (muted || !ctx || yielded) return;
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
    claimAudio();
    makeContext();
    wake();
  }

  function setMuted(m) {
    muted = !!m;
    try {
      if (muted) {
        // Stop it now: sleep() suspends the context, which would freeze a fade half way and leave
        // the old track sounding under the next one after unmute.
        if (cur) { try { cur.src.stop(); cur.bus.disconnect(); } catch (e) { /* gone */ } cur = null; }
        sleep();
      } else {
        // The toggle itself is a user gesture (a click, Enter or Space, or assistive tech that sends
        // no pointerdown), so the context is made and resumed right here, inside it.
        started = true;
        claimAudio();
        makeContext();
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
      waiting: Number.isFinite(w.waiting) ? w.waiting : 0,
      screen: typeof w.screen === 'string' ? w.screen : null
    };
    if (ctx && !muted && timer !== null) sync();
  }

  // Out of sight: no frame drawn for STALL_MS (a throttled frame), or a page of no size (a frame set
  // to display none).
  function outOfSight() {
    if (lastFrame && Date.now() - lastFrame > STALL_MS) return true;
    return onScreen === false || root.innerWidth === 0 || root.innerHeight === 0;
  }
  // The page's own body seen against the top window's viewport: false when the frame holding the
  // game is hidden or moved off screen.
  let onScreen = null;
  function watchScreen() {
    try {
      if (typeof root.IntersectionObserver !== 'function' || !document.body) return;
      new root.IntersectionObserver(function (es) {
        const e = es[es.length - 1];
        onScreen = !!(e && e.isIntersecting);
        if (onScreen && stalled && !outOfSight()) { stalled = false; if (started) wake(); }
        else if (!onScreen && ctx && !muted) { stalled = true; sleep(); }
      }).observe(document.body);
    } catch (e) { /* no observer: the frame watchdog still runs */ }
  }
  function frameTick() {
    lastFrame = Date.now();
    if (stalled && !outOfSight()) { stalled = false; if (started) wake(); }
    root.requestAnimationFrame(frameTick);
  }
  function init(opts) {
    muted = !!(opts && opts.muted);
    if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(frameTick);
    if (typeof document !== 'undefined') { if (document.body) watchScreen(); else document.addEventListener('DOMContentLoaded', watchScreen); }
    if (opts && opts.sfxMuted !== undefined) sfxMuted = !!opts.sfxMuted;
    try {
      if (typeof root.BroadcastChannel === 'function') {
        chan = new root.BroadcastChannel('hs.pitsim.audio');
        chan.onmessage = function (e) { if (e && e.data && e.data.play && e.data.id !== ME) { yielded = true; sleep(); } };
      }
    } catch (e) { chan = null; }
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
    const p = pick || choose(want);
    return {
      supported: !!AC, started, muted, sfxMuted, context: !!ctx, created,
      running: !!ctx && ctx.state === 'running', stalled, yielded, playing: !!cur && !!ctx && ctx.state === 'running' && !!cur.src.buffer, theme: cur ? cur.theme : null, mode: cur ? cur.mode : null,
      // bpm is kept as a tempo index: 100 is the track's own speed, up to 106 with a long line.
      bpm: cur ? Math.round(cur.rate * 1000) / 10 : null,
      track: cur ? cur.track : null, rate: cur ? Math.round(cur.rate * 1000) / 1000 : null,
      wantTrack: p.track, decoding, decoded: order.slice(), error: lastError,
      loops: { fire: loopWant.fire, crowd: loopWant.crowd },
      // The live loop gains on the context (0 when the loop is stopped), for the harness.
      gains: { fire: loops.fire ? loops.fire.g.gain.value : 0, crowd: loops.crowd ? loops.crowd.g.gain.value : 0 }
    };
  }

  // ---- Pit sounds ----------------------------------------------------------------------------
  const FIRE_MAX = 0.5, CROWD_MAX = 0.45, MIN_GAP_S = 0.06;
  const loopWant = { fire: 0, crowd: 0 };
  const loops = {};
  const lastAt = {};

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
  // Dev only: decode one track (by id) or the track a theme and mode map to, play it looped in an
  // OfflineAudioContext from just before its loop point, and report the peak. Not used by the game.
  function renderTest(name, mode, seconds, waiting) {
    const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    let p;
    if (TRACKS.indexOf(name) >= 0) p = { theme: null, mode: mode || 'hub', track: name, rate: 1 };
    else if (THEME_NAMES.indexOf(name) >= 0) {
      const day = { easy: 0, bright: 2, party: 5, picnic: 6, comp: 2, results: 0 }[name];
      const w = { day, week: 1, comp: name === 'comp', cook: mode === 'cook', waiting: waiting || 0, screen: name === 'results' ? 'results' : 'hub' };
      p = choose(w);
      if (name === 'comp') p.track = 'burning-road';
    } else return Promise.resolve(null);
    if (!OAC) return Promise.resolve(null);
    const sr = 44100, secs = seconds || 3;
    const c = new OAC(1, Math.ceil(sr * secs), sr);
    return decodeOn(c, p.track).then(function (raw) {
      const lb = loopBuffer(c, raw);
      const m = c.createGain();
      m.gain.value = VOLUME;
      m.connect(c.destination);
      const s = c.createBufferSource();
      s.buffer = lb; s.loop = true; s.playbackRate.value = p.rate;
      s.connect(m);
      const from = Math.max(0, lb.duration - secs / 2);   // straddle the loop point
      s.start(0, from);
      return measure(c, { name, mode: p.mode, track: p.track, rate: p.rate, seconds: Math.round(raw.duration * 100) / 100, loopSeconds: Math.round(lb.duration * 100) / 100 });
    });
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
    const E = makeEnv(c);
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
    themes: THEME_NAMES.slice(), tracks: TRACKS.slice(), _choose: choose, _renderTest: renderTest
  };
  PitSim.sfx = {
    play, stop, stopAll: function () { stop('fire'); stop('crowd'); }, setSfxMuted, isSfxMuted,
    isMuted: function () { return muted; }, names: Object.keys(FX).concat(Object.keys(LOOP)), _renderTest: sfxRenderTest
  };

})();
