/* Hold 225: the pit game at holysmokesbbqco.com/game.
   External file on purpose: the site's CSP script-src has no 'unsafe-inline'.
   Mounts into every [data-pit-game] (or #pit-game), injects one <style>,
   draws the gauge in canvas, makes no network request and keeps one integer
   in localStorage (hs.pitgame.best). The simulation (makeSim) is pure and
   runs headless in Node for tuning; every constant lives in C below.
   Spec: docs/superpowers/specs/2026-10-17-pit-game-design.md.
   Bump ?v= on the script tag in game.html on every change (Netlify caches
   *.js immutable for a year). */
(function () {
  'use strict';

  var C = {
    VERSION: '1.3.2',
    RUN_SECONDS: 75,
    TARGET: 225,
    RAIL_LO: 150, RAIL_HI: 300,
    T_MIN: 140, T_MAX: 310,
    T_START: 215, V_START: 0,
    GRAVITY: -24,
    DAMPING: 1.5,
    V_MAX: 60,
    PULSE: 30,
    PULSE_LEN: 0.28,
    LAG: 0.18,
    DT_MAX: 0.05,
    BAND_WIDE: 25, BAND_TIGHT: 12,
    BAND_SHRINK_START: 20, BAND_SHRINK_END: 60,
    TIGHT_ZONE: 4,
    QUIET_START: 5,
    FIRST_KNOCK_DELAY: [1.5, 3.0],
    GAP_EARLY: [3.0, 6.0],
    GAP_MID: [2.5, 5.0],
    GAP_LATE: [2.0, 4.0],
    GAP_MID_FROM: 30, GAP_LATE_FROM: 60,
    KICK_RAMP: [20, 60],
    KICK_SCALE_MAX: 1.15,
    WIND_WARN: 0.6, WIND_LEN: 1.2,
    WIND_GRAVITY_MULT: 1.8, WIND_KICK: -20,
    LID_WARN: 0.5, LID_OPEN_LEN: 1.6, LID_SHUT_LEN: 1.0,
    LID_OPEN_KICK: -28, LID_OPEN_GRAVITY_ADD: -10,
    LID_SHUT_GRAVITY: 18,
    FLARE_WARN: 0.9, FLARE_LEN: 0.9,
    FLARE_KICK: 10, FLARE_GRAVITY: 6,
    PAIR_AFTER: 60, PAIR_OFFSET: 1.2, PAIR_CHANCE: 0.5,
    GRACE: 1.5,
    SETTLE: 1.0,
    SCORE_BAND: 10, SCORE_TIGHT: 5,
    FINISH_BONUS: 250,
    STREAK_X2: 5, STREAK_X3: 10,
    LIVE_GAP: 0.3,
    DESCRIBE_EVERY: 1.0,
    TREMOR_LEN: 0.3, TREMOR_PX: 2,
    FED_LEN: 0.12,
    FEED_RELEASE_MS: 80,
    END_ARM_MS: 300,
    SMOKE_IN_BAND: 6, SMOKE_OUT_OF_BAND: 3,
    STORAGE_KEY: 'hs.pitgame.best',
    SHARE_SUFFIX: 'holysmokesbbqco.com/game'
  };

  var CREAM = '#E6D8B8', MUTED = '#bfb39a', ORANGE = '#D06129', PANEL = '#2a2015', HAIR = '#3a332c';
  var FALLBACK = 'This browser cannot draw the gauge, so the game will not run here.';
  var STYLE_ID = 'pit-game-style';

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function fmtTime(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' + r : r);
  }
  function fmtNum(n) {
    try { return n.toLocaleString('en-US'); } catch (e) { return String(n); }
  }
  function nowMs() {
    return (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') ? performance.now() : Date.now();
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Simulation: pure, no DOM, one object per run ---------- */

  function makeSim(seed, overrides) {
    var K = {}, key;
    for (key in C) K[key] = C[key];
    if (overrides) for (key in overrides) K[key] = overrides[key];
    var rng = mulberry32(typeof seed === 'number' && isFinite(seed) ? seed : (Date.now() >>> 0));
    var maxWarn = Math.max(K.WIND_WARN, K.LID_WARN, K.FLARE_WARN);
    var opensInBand = Math.abs(K.T_START - K.TARGET) <= K.BAND_WIDE;
    function U(range) { return range[0] + (range[1] - range[0]) * rng(); }

    var s = {
      t: 0, T: K.T_START, v: K.V_START, pulses: [],
      phase: 'ready', result: null, endedAt: null,
      knock: null, lastKind: null, nextKnockAt: K.QUIET_START + U(K.FIRST_KNOCK_DELAY),
      pairUsed: false, pairAt: null,
      streak: 0, mult: 1, scoreBand: 0, scoreTight: 0, scoreFinish: 0,
      /* A needle that opens inside the band has nothing to reach, so the
         in-band cue and the GET IT TO word wait for a run that starts out of
         band. It also keeps frame one from overwriting the start cue in the
         live region (say keeps only the latest pending message). */
      everInBand: opensInBand, inBandNow: opensInBand, tight: false,
      railSide: null, railSince: null, graceStart: null,
      log: { taps: [], knocks: [], exits: [] }
    };

    function hw(t) {
      if (t <= K.BAND_SHRINK_START) return K.BAND_WIDE;
      if (t >= K.BAND_SHRINK_END) return K.BAND_TIGHT;
      var f = (t - K.BAND_SHRINK_START) / (K.BAND_SHRINK_END - K.BAND_SHRINK_START);
      return K.BAND_WIDE + (K.BAND_TIGHT - K.BAND_WIDE) * f;
    }
    function ks(t) {
      var f = clamp((t - K.KICK_RAMP[0]) / (K.KICK_RAMP[1] - K.KICK_RAMP[0]), 0, 1);
      return 1 + (K.KICK_SCALE_MAX - 1) * f;
    }
    function gapRange(t) {
      return t < K.GAP_MID_FROM ? K.GAP_EARLY : t < K.GAP_LATE_FROM ? K.GAP_MID : K.GAP_LATE;
    }
    function pickKind() {
      var kinds = ['wind', 'lid', 'flare'];
      if (s.lastKind) kinds = kinds.filter(function (k) { return k !== s.lastKind; });
      return kinds[Math.min(kinds.length - 1, Math.floor(rng() * kinds.length))];
    }
    function startKnock(kind, t0, events) {
      var k = {
        kind: kind, phase: 'warn', warnStart: t0, onset: 0, shutStart: null, effectEnd: 0, windowEnd: 0,
        held: true, kicked: false, shutDone: false, tapsAfterWarn: 0, firstTapAfterWarn: null, tapsAfterShut: 0
      };
      if (kind === 'wind') { k.onset = t0 + K.WIND_WARN; k.effectEnd = k.onset + K.WIND_LEN; }
      else if (kind === 'lid') { k.onset = t0 + K.LID_WARN; k.shutStart = k.onset + K.LID_OPEN_LEN; k.effectEnd = k.shutStart + K.LID_SHUT_LEN; }
      else { k.onset = t0 + K.FLARE_WARN; k.effectEnd = k.onset + K.FLARE_LEN; }
      k.windowEnd = k.effectEnd + K.SETTLE;
      /* The paired lid is armed only when its own warning can reach onset
         before the cook ends; the rng draw stays in place so seeds that drew
         a pair before still draw it. */
      if (kind === 'wind' && t0 >= K.PAIR_AFTER && !s.pairUsed && rng() < K.PAIR_CHANCE &&
          k.onset + K.PAIR_OFFSET + K.LID_WARN < K.RUN_SECONDS) {
        s.pairUsed = true;
        s.pairAt = k.onset + K.PAIR_OFFSET;
      }
      s.knock = k;
      events.push(kind === 'lid' ? 'lid-open' : kind);
    }
    function closeKnock() {
      s.log.knocks.push(s.knock);
      s.lastKind = s.knock.kind;
      s.knock = null;
    }
    function endRun(result, at, events) {
      s.phase = 'over';
      s.result = result;
      s.endedAt = at;
      /* A knock still open at the end of a full cook was held on every frame
         so far, so it stays held. Out and hot runs already cleared the flag
         on the frame the needle left the band. */
      if (s.knock) { if (result !== 'done') s.knock.held = false; closeKnock(); }
      events.push('over');
      return events;
    }

    function step(dtIn) {
      var events = [];
      if (s.phase !== 'playing') return events;
      var dt = Math.min(K.DT_MAX, Math.max(0, +dtIn || 0));
      s.t += dt;
      var t = s.t, i;

      /* No knock starts so late that its warning cannot reach onset before
         the cook ends. */
      if (!s.knock && t >= s.nextKnockAt && t + maxWarn < K.RUN_SECONDS) startKnock(pickKind(), t, events);
      if (s.knock && s.knock.kind === 'wind' && s.pairAt !== null && t >= s.pairAt) {
        s.knock.windowEnd = s.pairAt;
        closeKnock();
        s.pairAt = null;
        startKnock('lid', t, events);
      }

      var k = s.knock;
      if (k) {
        if (t >= k.onset && !k.kicked) {
          k.kicked = true;
          s.v += (k.kind === 'wind' ? K.WIND_KICK : k.kind === 'lid' ? K.LID_OPEN_KICK : K.FLARE_KICK) * ks(t);
          events.push('onset');
        }
        if (t < k.onset) k.phase = 'warn';
        else if (k.kind === 'lid' && t >= k.shutStart && t < k.effectEnd) {
          if (!k.shutDone) { k.shutDone = true; events.push('lid-shut'); }
          k.phase = 'shut';
        }
        else if (t < k.effectEnd) k.phase = 'on';
        else k.phase = 'settle';
      }

      var g = K.GRAVITY;
      if (k && k.kicked) {
        if (k.kind === 'flare' && k.phase === 'on') g = K.FLARE_GRAVITY;
        else if (k.kind === 'lid' && k.phase === 'shut') g = K.LID_SHUT_GRAVITY;
        else if (k.kind === 'lid' && k.phase === 'on') g = g + K.LID_OPEN_GRAVITY_ADD;
        else if (k.kind === 'wind' && k.phase === 'on') g = g * K.WIND_GRAVITY_MULT;
      }

      var rate = K.PULSE / K.PULSE_LEN;
      for (i = s.pulses.length - 1; i >= 0; i--) {
        var p = s.pulses[i];
        if (t < p.at) continue;
        var use = Math.min(dt, p.left);
        s.v += rate * use;
        p.left -= use;
        if (p.left <= 1e-9) s.pulses.splice(i, 1);
      }
      s.v += g * dt;
      s.v *= Math.max(0, 1 - K.DAMPING * dt);
      s.v = clamp(s.v, -K.V_MAX, K.V_MAX);
      s.T = clamp(s.T + s.v * dt, K.T_MIN, K.T_MAX);

      var dev = Math.abs(s.T - K.TARGET);
      var inBand = dev <= hw(t);
      var tight = dev <= K.TIGHT_ZONE;
      if (inBand && !s.everInBand) { s.everInBand = true; events.push('in-band'); }
      if (s.everInBand && s.inBandNow && !inBand) {
        s.log.exits.push({ t: t, kind: k ? k.kind : null, seconds: 0 });
      }
      if (!inBand && s.everInBand && s.log.exits.length) s.log.exits[s.log.exits.length - 1].seconds += dt;
      s.inBandNow = inBand;
      s.tight = tight;
      if (k && !inBand) k.held = false;

      var prevMult = s.mult;
      if (inBand) s.streak += dt; else s.streak = 0;
      s.mult = s.streak < K.STREAK_X2 ? 1 : s.streak < K.STREAK_X3 ? 2 : 3;
      if (s.mult > prevMult) events.push(s.mult === 2 ? 'streak-2' : 'streak-3');
      if (inBand) s.scoreBand += K.SCORE_BAND * s.mult * dt;
      if (tight) s.scoreTight += K.SCORE_TIGHT * s.mult * dt;

      if (k && t >= k.windowEnd) {
        closeKnock();
        s.nextKnockAt = t + U(gapRange(t));
      }

      var side = s.T < K.RAIL_LO ? 'out' : s.T > K.RAIL_HI ? 'hot' : null;
      if (side) {
        if (s.railSide !== side) {
          s.railSide = side; s.railSince = t; s.graceStart = t;
          events.push(side === 'out' ? 'grace-out' : 'grace-hot');
        }
        if (t - s.railSince >= K.GRACE) return endRun(side, t, events);
      } else if (s.railSide) {
        s.railSide = null; s.railSince = null; s.graceStart = null;
        events.push('grace-clear');
      }
      if (t >= K.RUN_SECONDS) {
        s.scoreFinish = K.FINISH_BONUS;
        return endRun('done', K.RUN_SECONDS, events);
      }
      return events;
    }

    function tap() {
      if (s.phase !== 'playing') return false;
      var t = s.t;
      s.pulses.push({ at: t + K.LAG, left: K.PULSE_LEN });
      s.log.taps.push(t);
      var k = s.knock;
      if (k && k.phase !== 'settle') {
        k.tapsAfterWarn += 1;
        if (k.firstTapAfterWarn === null) k.firstTapAfterWarn = t;
        if (k.phase === 'shut') k.tapsAfterShut += 1;
      }
      return true;
    }

    function start() { if (s.phase === 'ready') s.phase = 'playing'; return s.phase === 'playing'; }
    function pause() { if (s.phase === 'playing') s.phase = 'paused'; return s.phase === 'paused'; }
    function resume() { if (s.phase === 'paused') s.phase = 'playing'; return s.phase === 'playing'; }

    /* The breakdown cells floor each part and the total is their sum, so the
       three cells always add up to the number on the card. */
    function parts() {
      return { band: Math.floor(s.scoreBand), tight: Math.floor(s.scoreTight), finish: Math.floor(s.scoreFinish) };
    }
    function score() { var p = parts(); return p.band + p.tight + p.finish; }

    function knockAt(time) {
      for (var i = 0; i < s.log.knocks.length; i++) {
        var k = s.log.knocks[i];
        if (time >= k.warnStart && time <= k.windowEnd) return k;
      }
      return null;
    }
    function countLine(n, tail) {
      return (n === 0 ? 'No taps ' : n === 1 ? '1 tap ' : n + ' taps ') + tail + '.';
    }
    function causeLine() {
      if (!s.result) return '';
      if (s.result === 'done') return fullCookCause();
      var g = s.graceStart === null ? s.endedAt : s.graceStart;
      var when = fmtTime(g), taps = s.log.taps, k = knockAt(g), one, two, n, i;
      if (s.result === 'out') {
        if (k && (k.kind === 'wind' || k.kind === 'lid')) {
          one = (k.kind === 'wind' ? 'The wind took it at ' : 'The open lid took it at ') + when + '.';
          two = k.firstTapAfterWarn === null ? 'No tap came after the warning.'
            : 'First tap came ' + (k.firstTapAfterWarn - k.warnStart).toFixed(1) + ' seconds after the warning.';
        } else {
          one = 'No knock was on at ' + when + '.';
          two = taps.length ? 'Last tap was ' + (s.endedAt - taps[taps.length - 1]).toFixed(1) + ' seconds before the end.' : 'No taps this run.';
        }
      } else if (k && k.kind === 'flare') {
        one = 'The flare took it at ' + when + '.'; two = countLine(k.tapsAfterWarn, 'after the warning');
      } else if (k && k.kind === 'lid' && g >= k.shutStart) {
        one = 'It ran hot after the lid shut at ' + when + '.'; two = countLine(k.tapsAfterShut, 'after the lid shut');
      } else if (k && k.kind === 'lid') {
        one = 'The open lid took it at ' + when + '.'; two = countLine(k.tapsAfterWarn, 'after the warning');
      } else if (k && k.kind === 'wind') {
        one = 'The wind took it at ' + when + '.'; two = countLine(k.tapsAfterWarn, 'after the warning');
      } else {
        n = 0;
        for (i = 0; i < taps.length; i++) if (taps[i] >= s.endedAt - 3) n++;
        one = 'No knock was on at ' + when + '.'; two = countLine(n, 'in the last 3 seconds');
      }
      return one + ' ' + two;
    }
    function fullCookCause() {
      var ex = s.log.exits;
      if (!ex.length) return 'Never left the band.';
      var b = { wind: 0, lid: 0, flare: 0, none: 0 };
      ex.forEach(function (e) { b[e.kind || 'none'] += e.seconds; });
      var top = 'wind';
      ['wind', 'lid', 'flare', 'none'].forEach(function (key) { if (b[key] > b[top]) top = key; });
      var sec = Math.max(1, Math.round(b[top]));
      var unit = sec === 1 ? ' second' : ' seconds';
      if (top === 'none') return 'Out of band ' + sec + unit + ', none of it on a knock.';
      return 'Costliest knock: the ' + top + ', ' + sec + unit + ' out of band.';
    }
    function knockLine() {
      var list = s.log.knocks, n = list.length;
      if (!n) return '';
      var h = 0, seen = { wind: [0, 0], lid: [0, 0], flare: [0, 0] };
      list.forEach(function (k) { seen[k.kind][0]++; if (k.held) { h++; seen[k.kind][1]++; } });
      if (h === n) return n === 1 ? 'Held the one knock.' : 'Held all ' + n + ' knocks.';
      var line = 'Held ' + h + ' of ' + n + (n === 1 ? ' knock.' : ' knocks.');
      var kinds = ['wind', 'lid', 'flare'].filter(function (k) { return seen[k][0] > 0; });
      if (kinds.length > 1) {
        var weak = kinds[0];
        kinds.forEach(function (k) {
          var r = seen[k][1] / seen[k][0], rw = seen[weak][1] / seen[weak][0];
          if (r < rw || (r === rw && seen[k][0] > seen[weak][0])) weak = k;
        });
        line += ' Weakest: ' + weak + ', ' + seen[weak][1] + ' of ' + seen[weak][0] + '.';
      }
      return line;
    }
    function summary() {
      var p = parts();
      return {
        result: s.result, endedAt: s.endedAt,
        score: p.band + p.tight + p.finish, scoreBand: p.band, scoreTight: p.tight, scoreFinish: p.finish,
        cause: causeLine(), knockLine: knockLine(),
        knocks: s.log.knocks.length,
        held: s.log.knocks.filter(function (k) { return k.held; }).length
      };
    }

    return { state: s, constants: K, start: start, step: step, tap: tap, pause: pause, resume: resume, summary: summary, score: score, hw: hw };
  }

  /* ---------- View ---------- */

  var CSS = [
    '.pit-game{position:relative;width:100%;max-width:560px;margin:0 auto;color:' + CREAM + ';font-family:Inter,sans-serif;line-height:1.4}',
    '.pit-game *,.pit-game *::before,.pit-game *::after{box-sizing:border-box}',
    '.pit-game .pg-head{display:flex;gap:12px;margin:0 0 12px}',
    '.pit-game .pg-cell{flex:1 1 0;min-width:0;text-align:center}',
    ".pit-game .pg-label{display:block;font:400 13px/1.2 'Burnt Ends Solid',Oswald,sans-serif;letter-spacing:0.16em;color:" + MUTED + ';margin:0 0 4px}',
    '.pit-game .pg-num{display:block;font:400 24px/1.1 Inter,sans-serif;font-variant-numeric:tabular-nums;color:' + CREAM + '}',
    '.pit-game .pg-streak{display:block;font:400 14px/1.2 Inter,sans-serif;color:' + MUTED + ';margin:2px 0 0}',
    '.pit-game .pg-streak.is-up{color:' + CREAM + '}',
    '.pit-game .pg-best{display:none}',
    '.pit-game .pg-best.is-on{display:block}',
    '.pit-game .pg-stage{position:relative;display:grid;grid-template-columns:minmax(0,1fr)}',
    '.pit-game .pg-canvas{grid-area:1/1;align-self:start;display:block;width:100%;max-width:100%;border-radius:14px;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer}',
    '.pit-game .pg-canvas:focus-visible,.pit-game .pg-btn:focus-visible,.pit-game .pg-apps a:focus-visible{outline:2px solid ' + CREAM + ';outline-offset:2px}',
    /* The overlay shares the canvas's grid cell, so the stage row takes the
       taller of the gauge and the card: a long end card grows the stage
       instead of hiding its lower lines inside a nested scroller. */
    '.pit-game .pg-overlay{grid-area:1/1;position:relative;display:flex;min-width:0;padding:12px;background:rgba(27,23,20,0.72);border-radius:14px}',
    '.pit-game .pg-overlay[hidden]{display:none}',
    '.pit-game .pg-card{margin:auto;max-width:92%;background:' + PANEL + ';border:2px solid ' + HAIR + ';border-radius:14px;padding:24px;text-align:center}',
    '@media (max-width:419px){.pit-game .pg-card{padding:16px}}',
    '.pit-game .pg-text{margin:0 0 16px;font:400 17px/1.45 Inter,sans-serif;color:' + CREAM + '}',
    '.pit-game .pg-fine{margin:12px 0 0;font:400 15px/1.45 Inter,sans-serif;color:' + MUTED + '}',
    ".pit-game .pg-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin:0;padding:0 24px;border:2px solid transparent;border-radius:8px;background:" + ORANGE + ';color:#1b1714;font:400 16px/1 ' + "'Burnt Ends Solid',Oswald,sans-serif;letter-spacing:0.02em;cursor:pointer;transition:background 0.15s;touch-action:manipulation;-webkit-appearance:none;appearance:none}",
    '.pit-game .pg-btn:hover{background:#e0803f}',
    '.pit-game .pg-btn:active{transform:translateY(1px)}',
    '.pit-game .pg-outline{background:transparent;border-color:' + CREAM + ';color:' + CREAM + '}',
    '.pit-game .pg-outline:hover{background:rgba(230,216,184,0.12)}',
    '.pit-game .pg-btn:disabled{opacity:0.45;cursor:default}',
    '.pit-game .pg-btn:disabled:hover{background:' + ORANGE + '}',
    '.pit-game .pg-outline:disabled:hover{background:transparent}',
    '.pit-game .pg-btn:disabled:active{transform:none}',
    '.pit-game .pg-btn.pg-arming{opacity:0.45;cursor:default}',
    '.pit-game .pg-btn.pg-arming:hover{background:' + ORANGE + '}',
    '.pit-game .pg-controls{display:flex;gap:12px;width:100%;max-width:320px;margin:16px auto 0}',
    '.pit-game .pg-feed{flex:1 1 auto;min-width:0}',
    '.pit-game .pg-pause{flex:0 0 auto;padding:0 16px}',
    '.pit-game .pg-hint{margin:12px 0 0;text-align:center;font:400 15px/1.45 Inter,sans-serif;color:' + MUTED + '}',
    ".pit-game .pg-title{margin:0 0 8px;font:400 28px/1.1 'Burnt Ends Solid',Oswald,sans-serif;color:" + CREAM + '}',
    '.pit-game .pg-time{margin:0 0 12px;font:400 15px/1.4 Inter,sans-serif;color:' + MUTED + '}',
    ".pit-game .pg-score{margin:0 0 12px;font:400 44px/1 'Burnt Ends Inline',Oswald,sans-serif;color:" + CREAM + '}',
    '.pit-game .pg-break{display:flex;gap:12px;justify-content:center;margin:0 0 16px}',
    '.pit-game .pg-break div{flex:1 1 0;min-width:0}',
    '.pit-game .pg-break .pg-label{font-size:12px;margin-bottom:2px}',
    '.pit-game .pg-val{display:block;font:400 15px/1.3 Inter,sans-serif;font-variant-numeric:tabular-nums;color:' + CREAM + '}',
    '.pit-game .pg-cause{margin:0 0 8px;font:400 15px/1.45 Inter,sans-serif;color:' + CREAM + '}',
    '.pit-game .pg-muted{margin:0 0 8px;font:400 15px/1.45 Inter,sans-serif;color:' + MUTED + '}',
    '.pit-game .pg-row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:0 0 16px}',
    /* One link per line, each line at least 44px tall, so the 44px link boxes
       cannot stack on each other when the card is narrow. */
    '.pit-game .pg-apps{margin:0;min-height:44px;font:400 15px/1.5 Inter,sans-serif;color:' + MUTED + '}',
    '.pit-game .pg-apps a{display:inline-flex;align-items:center;min-height:44px;padding:0 2px;color:' + CREAM + ';text-decoration:underline;text-decoration-color:' + ORANGE + ';text-decoration-thickness:2px;text-underline-offset:3px}',
    '.pit-game .pg-cause,.pit-game .pg-muted,.pit-game .pg-apps{text-align:left}',
    '.pit-game .pg-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '@media (prefers-reduced-motion:reduce){.pit-game .pg-btn{transition:none}.pit-game .pg-btn:active{transform:none}}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function readBest() {
    try {
      var raw = window.localStorage.getItem(C.STORAGE_KEY);
      if (raw !== null && /^\d{1,7}$/.test(raw)) return parseInt(raw, 10);
    } catch (e) { /* storage absent or blocked: BEST starts hidden */ }
    return null;
  }
  function writeBest(n) {
    try { window.localStorage.setItem(C.STORAGE_KEY, String(n)); } catch (e) { /* best stays in memory for the session */ }
  }

  var instanceCount = 0;

  function createInstance(mount) {
    var index = instanceCount++;
    mount.setAttribute('data-pit-game-mounted', '');
    empty(mount);
    var seedAttr = mount.getAttribute('data-seed');
    var fixedSeed = (seedAttr !== null && /^-?\d+$/.test(seedAttr.trim())) ? parseInt(seedAttr, 10) : null;

    var canvas = el('canvas', 'pg-canvas');
    var ctx = null;
    try { ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null; } catch (e) { ctx = null; }
    if (!ctx) {
      var fb = el('p', 'pit-game-nojs', FALLBACK);
      fb.style.cssText = 'color:' + MUTED + ';font-size:17px;text-align:center;padding:40px 0;';
      mount.appendChild(fb);
      return null;
    }

    ensureStyle();
    var root = el('div', 'pit-game');
    var head = el('div', 'pg-head');
    function cell(label) {
      var c = el('div', 'pg-cell');
      c.appendChild(el('span', 'pg-label', label));
      var n = el('span', 'pg-num', '0');
      c.appendChild(n);
      return { cell: c, num: n };
    }
    var scoreCell = cell('Score');
    var streakEl = el('span', 'pg-streak', 'x1');
    scoreCell.cell.appendChild(streakEl);
    var timeCell = cell('Time');
    timeCell.num.textContent = fmtTime(C.RUN_SECONDS);
    var bestCell = cell('Best');
    bestCell.cell.className = 'pg-cell pg-best';
    head.appendChild(scoreCell.cell);
    head.appendChild(timeCell.cell);
    head.appendChild(bestCell.cell);
    root.appendChild(head);

    var stage = el('div', 'pg-stage');
    var descId = 'pg-desc-' + index;
    /* The canvas is a graphic, not a control: out of the Tab order, still
       focusable from a tap so Space keeps feeding after a pointer run. */
    canvas.setAttribute('tabindex', '-1');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Pit gauge');
    canvas.setAttribute('aria-describedby', descId);
    stage.appendChild(canvas);
    var overlay = el('div', 'pg-overlay');
    stage.appendChild(overlay);
    root.appendChild(stage);

    var controls = el('div', 'pg-controls');
    var feedBtn = el('button', 'pg-btn pg-feed', 'Feed the fire');
    feedBtn.setAttribute('type', 'button');
    feedBtn.setAttribute('aria-describedby', descId);
    feedBtn.disabled = true;
    var pauseBtn = el('button', 'pg-btn pg-outline pg-pause', 'Pause');
    pauseBtn.setAttribute('type', 'button');
    pauseBtn.disabled = true;
    controls.appendChild(feedBtn);
    controls.appendChild(pauseBtn);
    root.appendChild(controls);
    root.appendChild(el('p', 'pg-hint', 'Tap the gauge or press Space on Feed the fire. Escape or the Pause button pauses.'));
    var desc = el('p', 'pg-sr');
    desc.id = descId;
    root.appendChild(desc);
    var live = el('div', 'pg-sr pg-live');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    root.appendChild(live);
    mount.appendChild(root);

    var sim = null;
    var view = {
      w: 0, h: 0, dpr: 1, rawDpr: 0, reducedMotion: false, smoke: [], tremorUntil: 0, lidLift: 0, fedUntil: 0,
      lastDescribeAt: -1e9, raf: 0, last: 0, fresh: true, overlayKind: null, endShownAt: 0, best: readBest()
    };
    var headCache = { score: null, time: null, mult: null, best: null };
    var liveTimer = 0, livePending = null, lastLiveAt = -1e9, lastLiveMsg = null, liveSetTimer = 0;
    var torn = false, ro = null, mq = null, dprMq = null, inst = null, feedPressed = false, pressSeq = 0;
    var timers = [];

    /* Every timer outside the live region goes through here so teardown can
       clear it. */
    function later(fn, ms) {
      var id = setTimeout(function () {
        var at = timers.indexOf(id);
        if (at !== -1) timers.splice(at, 1);
        if (!torn) fn();
      }, ms);
      timers.push(id);
      return id;
    }

    function mqOn(m, fn) { if (m.addEventListener) m.addEventListener('change', fn); else if (m.addListener) m.addListener(fn); }
    function mqOff(m, fn) { if (m.removeEventListener) m.removeEventListener('change', fn); else if (m.removeListener) m.removeListener(fn); }

    function connected() {
      return typeof mount.isConnected === 'boolean' ? mount.isConnected : (document.body ? document.body.contains(mount) : false);
    }
    function guard() { if (connected()) return true; teardown(); return false; }
    function teardown() {
      if (torn) return;
      torn = true;
      if (view.raf) { cancelAnimationFrame(view.raf); view.raf = 0; }
      if (liveTimer) { clearTimeout(liveTimer); liveTimer = 0; }
      if (liveSetTimer) { clearTimeout(liveSetTimer); liveSetTimer = 0; }
      timers.forEach(function (id) { clearTimeout(id); });
      timers.length = 0;
      document.removeEventListener('keydown', onDocKey);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      if (ro) { try { ro.disconnect(); } catch (e) { /* already gone */ } ro = null; }
      if (mq) { mqOff(mq, onMq); mq = null; }
      if (dprMq) { mqOff(dprMq, onDpr); dprMq = null; }
      if (inst) {
        var at = API.instances.indexOf(inst);
        if (at !== -1) API.instances.splice(at, 1);
      }
      /* The widget DOM goes with the listeners, so a mount that comes back
         (tab panel, accordion) is empty and unmarked, and HSPitGame.mountAll()
         rebuilds it with a full listener set instead of a half-wired one. */
      feedBtn.disabled = true;
      pauseBtn.disabled = true;
      mount.removeAttribute('data-pit-game-mounted');
      empty(mount);
    }

    /* Live region: one message per LIVE_GAP, latest pending wins, nothing
       older than 2 s is spoken. Cleared then set so a repeated word is read,
       except the same phrase inside 2 s (a rail fight re-fires 'Fire going
       out.' several times a second), which is dropped. */
    function say(msg) {
      if (msg === lastLiveMsg && nowMs() - lastLiveAt < 2000) return;
      livePending = { msg: msg, at: nowMs() };
      if (!liveTimer) {
        var wait = Math.max(0, C.LIVE_GAP * 1000 - (nowMs() - lastLiveAt));
        liveTimer = setTimeout(flushLive, wait);
      }
    }
    function flushLive() {
      liveTimer = 0;
      var p = livePending;
      livePending = null;
      if (!p || nowMs() - p.at > 2000) return;
      lastLiveAt = nowMs();
      lastLiveMsg = p.msg;
      live.textContent = '';
      if (liveSetTimer) clearTimeout(liveSetTimer);
      liveSetTimer = setTimeout(function () { liveSetTimer = 0; live.textContent = p.msg; }, 30);
    }

    function secondsLeft(st) { return Math.max(0, Math.ceil(C.RUN_SECONDS - st.t)); }
    function describe(force) {
      var now = nowMs();
      if (!force && now - view.lastDescribeAt < C.DESCRIBE_EVERY * 1000) return;
      view.lastDescribeAt = now;
      var text;
      if (!sim || sim.state.phase === 'ready') text = 'Not started. The needle sits at ' + C.T_START + '.';
      else {
        var st = sim.state, Tn = Math.round(st.T), left = secondsLeft(st);
        var leftTxt = left + (left === 1 ? ' second left' : ' seconds left');
        if (st.phase === 'over') text = 'Over. ' + fmtNum(sim.score()) + ' points.';
        else if (st.phase === 'paused') text = 'Paused. Needle at ' + Tn + ', ' + leftTxt + '.';
        else {
          var where = !st.everInBand ? 'not yet in band' : st.inBandNow ? 'in band' : st.T < C.TARGET ? 'low' : 'high';
          var streak = st.mult === 2 ? ', streak times two' : st.mult === 3 ? ', streak times three' : '';
          text = 'Needle at ' + Tn + ', ' + where + ', ' + leftTxt + streak + '.';
        }
      }
      if (desc.textContent !== text) desc.textContent = text;
    }

    function updateHead() {
      var st = sim ? sim.state : null;
      var scoreTxt = fmtNum(sim ? sim.score() : 0);
      var timeTxt = fmtTime(st ? secondsLeft(st) : C.RUN_SECONDS);
      var mult = st ? st.mult : 1;
      if (scoreTxt !== headCache.score) { headCache.score = scoreTxt; scoreCell.num.textContent = scoreTxt; }
      if (timeTxt !== headCache.time) { headCache.time = timeTxt; timeCell.num.textContent = timeTxt; }
      if (mult !== headCache.mult) {
        headCache.mult = mult;
        streakEl.textContent = 'x' + mult;
        streakEl.className = mult > 1 ? 'pg-streak is-up' : 'pg-streak';
      }
      if (view.best !== null && view.best !== headCache.best) {
        headCache.best = view.best;
        bestCell.num.textContent = fmtNum(view.best);
        bestCell.cell.className = 'pg-cell pg-best is-on';
      }
    }

    /* ---- overlays ---- */
    function hideOverlay() { empty(overlay); overlay.hidden = true; view.overlayKind = null; }
    function openCard(kind) { empty(overlay); overlay.hidden = false; view.overlayKind = kind; var card = el('div', 'pg-card'); overlay.appendChild(card); return card; }
    function button(label, outline, onClick) {
      var b = el('button', outline ? 'pg-btn pg-outline' : 'pg-btn', label);
      b.setAttribute('type', 'button');
      b.addEventListener('click', onClick);
      return b;
    }
    function showStart() {
      var card = openCard('start');
      card.appendChild(el('p', 'pg-text', 'Keep the needle in the band. The cook is ' + fmtTime(C.RUN_SECONDS) + '.'));
      card.appendChild(button('Start the cook', false, startRun));
    }
    /* Focus moves to Resume only when the pause came from inside the widget
       (or from nowhere in particular: body focus, a hidden tab, a window
       blur). An Escape pressed on a footer link or a consent button pauses
       the clock and leaves that control focused (WCAG 3.2.1). */
    function showPause(takeFocus) {
      var card = openCard('pause');
      card.appendChild(el('p', 'pg-text', 'Paused.'));
      var b = button('Resume', true, resumeRun);
      card.appendChild(b);
      card.appendChild(el('p', 'pg-fine', 'Or tap the gauge to resume.'));
      if (takeFocus) focusEl(b);
    }
    /* The result reads top to bottom: title, score, breakdown, cause, knocks,
       best, then the buttons, so the cause is seen before the thumb reaches
       Play again. Play again only looks dimmed for END_ARM_MS (the class, not
       disabled or aria-disabled, so it holds focus and is never announced as
       unavailable); startRun() itself swallows an activation inside the
       window. */
    function showEnd(sm, beaten) {
      var card = openCard('end');
      view.endShownAt = nowMs();
      card.appendChild(el('h2', 'pg-title', sm.result === 'done' ? "COOK'S DONE" : sm.result === 'out' ? 'FIRE WENT OUT' : 'PIT RAN TOO HOT'));
      if (sm.result !== 'done') card.appendChild(el('p', 'pg-time', 'Ended at ' + fmtTime(sm.endedAt) + ' of ' + fmtTime(C.RUN_SECONDS) + '.'));
      card.appendChild(el('p', 'pg-score', fmtNum(sm.score)));
      var btns = el('div', 'pg-row');
      var again = button('Play again', false, startRun);
      again.className = 'pg-btn pg-arming';
      later(function () {
        if (again.isConnected === false) return;
        again.className = 'pg-btn';
      }, C.END_ARM_MS);
      var copy = button('Copy score', true, function () { copyScore(copy, sm.score); });
      btns.appendChild(again);
      btns.appendChild(copy);
      var row = el('div', 'pg-break');
      [['In band', sm.scoreBand], ['Tight', sm.scoreTight], ['Finish', sm.scoreFinish]].forEach(function (pair) {
        var c = el('div');
        c.appendChild(el('span', 'pg-label', pair[0]));
        c.appendChild(el('span', 'pg-val', fmtNum(pair[1])));
        row.appendChild(c);
      });
      card.appendChild(row);
      card.appendChild(el('p', 'pg-cause', sm.cause));
      if (sm.knockLine) card.appendChild(el('p', 'pg-muted', sm.knockLine));
      if (beaten) card.appendChild(el('p', 'pg-muted', 'New best in this browser.'));
      else if (view.best !== null) card.appendChild(el('p', 'pg-muted', 'Best in this browser: ' + fmtNum(view.best)));
      card.appendChild(btns);
      var apps1 = el('p', 'pg-apps'), apps2 = el('p', 'pg-apps');
      var a1 = el('a', null, 'Scorecard, Notebook and Board');
      a1.setAttribute('href', '/#apps');
      var a2 = el('a', null, 'the Calculator');
      a2.setAttribute('href', '/calculator/');
      apps1.appendChild(a1);
      apps1.appendChild(document.createTextNode(','));
      apps2.appendChild(document.createTextNode('plus '));
      apps2.appendChild(a2);
      apps2.appendChild(document.createTextNode(' on the web.'));
      card.appendChild(apps1);
      card.appendChild(apps2);
      focusEl(again);
    }
    function copyScore(btn, total) {
      var text = 'Hold 225: ' + fmtNum(total) + ' points. ' + C.SHARE_SUFFIX;
      var settled = false;
      function done(ok) {
        if (settled) return;
        settled = true;
        btn.textContent = ok ? 'Copied' : 'Copy failed';
        say(ok ? 'Score copied.' : 'Copy failed.');
        later(function () { btn.textContent = 'Copy score'; }, 2000);
      }
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else done(false);
      } catch (e) { done(false); }
    }
    function focusEl(node) {
      try { node.focus({ preventScroll: true }); } catch (e) { try { node.focus(); } catch (e2) { /* not focusable yet */ } }
    }

    /* ---- transitions ---- */
    function syncPause() {
      var phase = sim ? sim.state.phase : 'ready';
      pauseBtn.disabled = !(phase === 'playing' || phase === 'paused');
      pauseBtn.textContent = phase === 'paused' ? 'Resume' : 'Pause';
    }
    function startRun() {
      /* The end card arms END_ARM_MS after it opens so a Space mash or a
         rapid click that was answering the grace does not restart before
         the score and cause have been seen. */
      if (torn) return;
      if (view.overlayKind === 'end' && nowMs() - view.endShownAt < C.END_ARM_MS) return;
      sim = makeSim(fixedSeed !== null ? fixedSeed : (Date.now() >>> 0));
      sim.start();
      view.tremorUntil = 0;
      view.lidLift = 0;
      view.fedUntil = 0;
      hideOverlay();
      feedBtn.disabled = false;
      syncPause();
      focusEl(feedBtn);
      say('Cook is on. Feed the fire.');
      updateHead();
      describe(true);
      view.fresh = true;
      ensureLoop();
      draw();
    }
    function pauseRun() {
      if (!sim || sim.state.phase !== 'playing') return;
      var ae = document.activeElement;
      var wasInside = !ae || ae === document.body || root.contains(ae);
      sim.pause();
      if (view.raf) { cancelAnimationFrame(view.raf); view.raf = 0; }
      syncPause();
      showPause(wasInside);
      say('Paused.');
      describe(true);
      draw();
    }
    function resumeRun() {
      if (!sim || sim.state.phase !== 'paused') return;
      sim.resume();
      describe(true);
      hideOverlay();
      syncPause();
      focusEl(feedBtn);
      say('Resumed.');
      view.fresh = true;
      ensureLoop();
    }
    function togglePause() {
      if (!sim) return;
      if (sim.state.phase === 'playing') pauseRun();
      else if (sim.state.phase === 'paused') resumeRun();
    }
    function feed() {
      if (!sim) return;
      if (sim.state.phase === 'paused') { resumeRun(); return; }
      if (sim.state.phase !== 'playing') return;
      /* The pulse itself pays out after LAG, so the pivot acknowledges the
         tap at once; it is input feedback, kept under reduced motion. */
      if (sim.tap()) view.fedUntil = sim.state.t + C.FED_LEN;
    }
    function onOver() {
      var sm = sim.summary();
      /* A zero run is never a best, so a first run that never found the band
         shows no best line and writes nothing. The key is re-read first so a
         higher best saved by another tab or mount since load is never
         overwritten by a lower one. */
      var stored = readBest();
      var base = Math.max(view.best === null ? -1 : view.best, stored === null ? -1 : stored);
      var beaten = sm.score > 0 && sm.score > base;
      if (beaten) { view.best = sm.score; writeBest(sm.score); }
      else if (base >= 0) view.best = base;
      /* The loop stops on this frame, so the final drawing settles first. */
      view.tremorUntil = 0;
      view.lidLift = 0;
      view.fedUntil = 0;
      feedBtn.disabled = true;
      syncPause();
      var when = fmtTime(sm.endedAt), pts = fmtNum(sm.score) + ' points.';
      var msg = sm.result === 'done' ? "Cook's done. " + pts
        : sm.result === 'out' ? 'Fire went out at ' + when + '. ' + pts
        : 'Pit ran too hot at ' + when + '. ' + pts;
      if (beaten) msg += ' New best in this browser.';
      say(msg);
      showEnd(sm, beaten);
      updateHead();
      describe(true);
    }
    function handleEvents(events) {
      for (var i = 0; i < events.length; i++) {
        switch (events[i]) {
          case 'wind': say('Wind.'); break;
          case 'lid-open': say('Lid open.'); break;
          case 'lid-shut': say('Lid shut.'); break;
          case 'flare': say('Flare.'); break;
          case 'onset': view.tremorUntil = sim.state.t + C.TREMOR_LEN; break;
          case 'in-band': say('In band.'); break;
          case 'streak-2': say('Streak times two.'); break;
          case 'streak-3': say('Streak times three.'); break;
          case 'grace-out': say('Fire going out.'); break;
          case 'grace-hot': say('Too hot.'); break;
          case 'over': onOver(); break;
          default: break;
        }
      }
    }

    /* ---- loop ---- */
    /* The loop runs only during play. Ready, paused and over are drawn once
       (mount, resize, card open), so an idle page costs no frames. */
    function loopWanted() {
      return !!sim && sim.state.phase === 'playing';
    }
    function ensureLoop() {
      if (torn || !connected()) return;
      if (loopWanted()) { if (!view.raf) { view.fresh = true; view.raf = requestAnimationFrame(tick); } }
      else if (view.raf) { cancelAnimationFrame(view.raf); view.raf = 0; }
    }
    function tick(now) {
      view.raf = 0;
      if (!guard()) return;
      var dt = view.fresh ? 0 : Math.max(0, (now - view.last) / 1000);
      view.fresh = false;
      view.last = now;
      /* The resolution query in watchDpr() does not fire in every embedder,
         so while the loop runs the ratio is also polled here: one property
         read per frame, nothing while idle. */
      if ((window.devicePixelRatio || 1) !== view.rawDpr) resize();
      var simDt = Math.min(C.DT_MAX, dt);
      if (sim && sim.state.phase === 'playing') handleEvents(sim.step(simDt));
      stepLid(simDt);
      if (!view.reducedMotion) stepSmoke(Math.min(0.1, dt));
      draw();
      updateHead();
      if (sim && sim.state.phase === 'playing') describe(false);
      /* Reschedule directly: ensureLoop() is for restarts from a stopped loop
         and resets the delta clock, which must not happen every frame. */
      if (loopWanted() && !view.raf) view.raf = requestAnimationFrame(tick);
    }
    function stepLid(dt) {
      var k = sim ? sim.state.knock : null;
      var target = (k && k.kind === 'lid' && (k.phase === 'warn' || k.phase === 'on')) ? 1 : 0;
      if (view.reducedMotion) { view.lidLift = target; return; }
      var move = dt / 0.12;
      view.lidLift = target > view.lidLift ? Math.min(1, view.lidLift + move) : Math.max(0, view.lidLift - move);
    }
    function respawn(p, stagger) {
      p.fx = (Math.random() - 0.5) * 0.3;
      p.dy = 6;
      p.vy = 12 + Math.random() * 8;
      p.life = 2.5 + Math.random() * 1.5;
      p.age = stagger ? Math.random() * p.life : 0;
      if (stagger) p.dy += p.vy * p.age;
      return p;
    }
    function stepSmoke(dt) {
      if (!view.w) return;
      var st = sim ? sim.state : null;
      var inBand = st ? Math.abs(st.T - C.TARGET) <= sim.hw(st.t) : Math.abs(C.T_START - C.TARGET) <= C.BAND_WIDE;
      var target = inBand ? C.SMOKE_IN_BAND : C.SMOKE_OUT_OF_BAND;
      var sm = view.smoke;
      for (var i = sm.length - 1; i >= 0; i--) {
        var p = sm[i];
        p.age += dt;
        p.dy += p.vy * dt;
        if (p.age >= p.life) { if (sm.length > target) sm.splice(i, 1); else respawn(p, false); }
      }
      while (sm.length < target) sm.push(respawn({}, true));
    }

    /* ---- drawing ---- */
    function geom() {
      var w = view.w, h = view.h, PAD = 14, TOP = 26, UNDER = 90;
      /* Floor at 40 so a narrow host column never asks for a negative arc
         radius, which throws and would end the loop. */
      var R = Math.max(40, Math.min(h - PAD - TOP - UNDER, (w - 2 * PAD) / 2 - 16));
      return { w: w, h: h, PAD: PAD, R: R, cx: w / 2, cy: PAD + TOP + R };
    }
    function angle(T) { return Math.PI + ((T - C.RAIL_LO) / (C.RAIL_HI - C.RAIL_LO)) * Math.PI; }
    function roundRectPath(x, y, w, h, r) {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, r); return; }
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function stateWord(st) {
      if (!st) return 'GET IT TO ' + C.TARGET;
      if (st.railSide === 'out') return 'FIRE GOING OUT';
      if (st.railSide === 'hot') return 'TOO HOT';
      var k = st.knock;
      if (k && k.phase !== 'settle') {
        if (k.kind === 'wind') return 'WIND';
        if (k.kind === 'flare') return 'FLARE';
        return k.phase === 'shut' ? 'LID SHUT' : 'LID';
      }
      if (!st.everInBand) return 'GET IT TO ' + C.TARGET;
      if (st.inBandNow) return 'IN BAND';
      return st.T < C.TARGET ? 'LOW' : 'HIGH';
    }
    function draw() {
      if (!view.w) return;
      var G = geom(), w = G.w, h = G.h, R = G.R, cx = G.cx, cy = G.cy, PAD = G.PAD;
      var st = sim ? sim.state : null;
      var T = st ? st.T : C.T_START;
      var t = st ? st.t : 0;
      var k = st ? st.knock : null;
      var hwNow = sim ? sim.hw(t) : C.BAND_WIDE;
      var inBand = Math.abs(T - C.TARGET) <= hwNow;
      var i, a, x, y;
      function radial(ang, r0, r1) {
        ctx.beginPath();
        ctx.moveTo(cx + r0 * Math.cos(ang), cy + r0 * Math.sin(ang));
        ctx.lineTo(cx + r1 * Math.cos(ang), cy + r1 * Math.sin(ang));
        ctx.stroke();
      }

      ctx.clearRect(0, 0, w, h);
      roundRectPath(0, 0, w, h, 14);
      ctx.fillStyle = PANEL;
      ctx.fill();
      roundRectPath(1, 1, w - 2, h - 2, 13);
      ctx.lineWidth = 2;
      ctx.strokeStyle = HAIR;
      ctx.stroke();

      if (!view.reducedMotion && view.smoke.length) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R - 12, Math.PI, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();
        for (i = 0; i < view.smoke.length; i++) {
          var p = view.smoke[i], f = Math.min(1, p.age / p.life);
          ctx.fillStyle = 'rgba(230,216,184,' + (0.10 * (1 - f)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(cx + p.fx * R, cy - p.dy, 6 + 8 * f, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.lineCap = 'butt';
      ctx.lineWidth = 10;
      ctx.strokeStyle = HAIR;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6, Math.PI, 2 * Math.PI);
      ctx.stroke();

      var a0 = angle(C.TARGET - hwNow), a1 = angle(C.TARGET + hwNow);
      /* 0.45 over the track clears 3:1 (WCAG 1.4.11) on its own; the edge
         ticks below still mark the limits. */
      ctx.strokeStyle = 'rgba(230,216,184,0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6, a0, a1);
      ctx.stroke();
      /* The tight zone pays SCORE_TIGHT on top of the band, so it is marked:
         a brighter arc inside the band and a tick at the target. */
      ctx.strokeStyle = 'rgba(230,216,184,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6, angle(C.TARGET - C.TIGHT_ZONE), angle(C.TARGET + C.TIGHT_ZONE));
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = CREAM;
      radial(a0, R - 16, R + 2);
      radial(a1, R - 16, R + 2);
      radial(angle(C.TARGET), R - 16, R + 2);

      var side = st ? st.railSide : null;
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = side === 'out' ? 6 : 2;
      radial(angle(C.RAIL_LO), R - 16, R + 2);
      ctx.lineWidth = side === 'hot' ? 6 : 2;
      radial(angle(C.RAIL_HI), R - 16, R + 2);

      var lift = view.lidLift, ly = PAD + 20 - 6 * lift;
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 2 + 2 * lift;
      ctx.beginPath();
      ctx.moveTo(cx - R / 2, ly);
      ctx.lineTo(cx + R / 2, ly);
      ctx.stroke();

      if (k && k.kind === 'wind' && k.phase === 'warn') {
        var x0;
        if (view.reducedMotion) x0 = cx - 31;
        else {
          var f2 = clamp((t - k.warnStart) / C.WIND_WARN, 0, 1);
          x0 = (cx - R) + f2 * (2 * R - 62);
        }
        ctx.fillStyle = CREAM;
        for (i = 0; i < 3; i++) ctx.fillRect(x0 + i * 24, PAD + 7, 14, 2);
      }

      a = angle(T);
      if (!view.reducedMotion && st && t < view.tremorUntil) {
        a += (C.TREMOR_PX / (R - 24)) * Math.sin(2 * Math.PI * 25 * t) * (view.tremorUntil - t) / C.TREMOR_LEN;
      }
      var L = R - 24, ca = Math.cos(a), sa = Math.sin(a);
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (L - 10) * ca, cy + (L - 10) * sa);
      ctx.stroke();
      var bx = cx + (L - 12) * ca, by = cy + (L - 12) * sa, px = -sa * 4.5, py = ca * 4.5;
      ctx.fillStyle = inBand ? ORANGE : MUTED;
      ctx.beginPath();
      ctx.moveTo(cx + L * ca, cy + L * sa);
      ctx.lineTo(bx + px, by + py);
      ctx.lineTo(bx - px, by - py);
      ctx.closePath();
      ctx.fill();
      var fed = !!st && st.phase === 'playing' && t < view.fedUntil;
      ctx.fillStyle = fed ? ORANGE : CREAM;
      ctx.beginPath();
      ctx.arc(cx, cy, fed ? 7 : 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = CREAM;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '400 48px Inter, sans-serif';
      ctx.fillText(String(Math.round(T)), cx, cy + 40);
      ctx.font = '400 16px Inter, sans-serif';
      var hasSpacing = 'letterSpacing' in ctx;
      if (hasSpacing) ctx.letterSpacing = '1.92px';
      ctx.fillText(stateWord(st), cx + (hasSpacing ? 1 : 0), cy + 62);
      if (hasSpacing) ctx.letterSpacing = '0px';

      var flaring = k && k.kind === 'flare' && k.phase !== 'settle';
      ctx.fillStyle = flaring ? ORANGE : 'rgba(208,97,41,0.6)';
      var span = w - 2 * PAD - 40;
      for (i = 0; i < 9; i++) {
        x = PAD + 20 + span * i / 8;
        y = h - PAD - 6;
        ctx.beginPath();
        ctx.arc(x, y, flaring ? 4 : 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    /* ---- sizing ---- */
    function resize() {
      var w = root.clientWidth;
      if (!w) return;
      var h = clamp(Math.round(0.75 * w), 260, 420);
      var raw = window.devicePixelRatio || 1;
      var dpr = Math.min(3, raw);
      if (raw !== view.rawDpr) watchDpr(raw);
      if (w === view.w && h === view.h && dpr === view.dpr) return;
      view.w = w; view.h = h; view.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function onResize() { if (guard()) resize(); }
    /* Zoom and a monitor move change devicePixelRatio without changing the
       widget's CSS width, so a resolution query re-armed at each new ratio
       catches what the ResizeObserver cannot. */
    function watchDpr(raw) {
      view.rawDpr = raw;
      if (dprMq) { mqOff(dprMq, onDpr); dprMq = null; }
      try { dprMq = window.matchMedia ? window.matchMedia('(resolution: ' + raw + 'dppx)') : null; } catch (e) { dprMq = null; }
      if (dprMq) mqOn(dprMq, onDpr);
    }
    function onDpr() { if (guard()) resize(); }

    /* ---- input ---- */
    function feedKey(e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false;
      var key = e.key;
      if (key === ' ' || key === 'Spacebar' || key === 'ArrowUp' || key === 'Up') { e.preventDefault(); return true; }
      return key === 'Enter' || key === 'f' || key === 'F';
    }
    /* Every pointerdown is one contact and one feed, any finger: a second
       thumb that lands while the first is down is non-primary in the Pointer
       Events model, so isPrimary is not checked. Only the main button counts. */
    function onPointer(e) {
      if (typeof e.button === 'number' && e.button !== 0) return;
      focusEl(canvas);
      feed();
    }
    /* The button feeds on press, not on release, so it pays out at the same
       moment as the dial. The press sets a flag and the click that follows
       the release (pointer release, the compat click after a touch tap, or
       Space keyup) is swallowed by it, however long the press was held. The
       release events clear the flag a beat later (FEED_RELEASE_MS, after
       that click has had its turn), so a release that produced no click
       (drag-off, pointercancel) cannot swallow the next Enter. The sequence
       number keeps a stale clear from a previous press off a new one during
       a fast mash. Enter arrives as a bare click and feeds as before. */
    function pressFeed() { feedPressed = true; pressSeq++; feed(); }
    function releaseFeed() {
      var seq = pressSeq;
      later(function () { if (pressSeq === seq) feedPressed = false; }, C.FEED_RELEASE_MS);
    }
    if (window.PointerEvent) canvas.addEventListener('pointerdown', onPointer);
    else canvas.addEventListener('mousedown', onPointer);
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (!window.PointerEvent) onPointer(e);
    }, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('keydown', function (e) { if (feedKey(e)) feed(); });
    if (window.PointerEvent) {
      feedBtn.addEventListener('pointerdown', function (e) {
        if (typeof e.button === 'number' && e.button !== 0) return;
        pressFeed();
      });
      feedBtn.addEventListener('pointerup', releaseFeed);
      feedBtn.addEventListener('pointerleave', releaseFeed);
      feedBtn.addEventListener('pointercancel', releaseFeed);
    }
    feedBtn.addEventListener('click', function () {
      if (feedPressed) { feedPressed = false; return; }
      feed();
    });
    feedBtn.addEventListener('blur', function () { feedPressed = false; });
    feedBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.repeat) { e.preventDefault(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.key === ' ' || e.key === 'Spacebar') pressFeed();
      else if (e.key === 'ArrowUp' || e.key === 'Up') { e.preventDefault(); feed(); }
      else if (e.key === 'f' || e.key === 'F') feed();
    });
    feedBtn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Spacebar') releaseFeed();
    });
    pauseBtn.addEventListener('click', togglePause);
    overlay.addEventListener('pointerdown', function (e) {
      if (view.overlayKind !== 'pause') return;
      var onButton = e.target && typeof e.target.closest === 'function' && e.target.closest('button');
      if (!onButton) { e.preventDefault(); resumeRun(); }
    });
    /* Escape pauses from anywhere on the page but resumes only while focus
       is inside the widget, so a key pressed in the consent dialog or the
       footer never restarts the clock or pulls focus (WCAG 3.2.1). P and R
       are character keys, so they only act inside the widget (WCAG 2.1.4). */
    function onDocKey(e) {
      if (!guard()) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      var tgt = e.target;
      if (tgt && tgt.tagName) {
        var tag = tgt.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || tgt.isContentEditable) return;
      }
      var key = e.key;
      var inside = root.contains(document.activeElement);
      if (key === 'Escape' || key === 'Esc') {
        if (inside) togglePause();
        else if (sim && sim.state.phase === 'playing') pauseRun();
        return;
      }
      if (!inside) return;
      if (key === 'p' || key === 'P') togglePause();
      else if (key === 'r' || key === 'R') {
        if (sim && sim.state.phase === 'over') startRun();
      }
    }
    /* Coming back to a tab re-checks the bitmap: a zoom or monitor move while
       hidden changes devicePixelRatio with no resize event for this page. */
    function onVis() { if (!guard()) return; if (document.hidden) pauseRun(); else resize(); }
    function onBlur() { if (!guard()) return; pauseRun(); }
    function onMq(e) {
      if (!guard()) return;
      view.reducedMotion = !!e.matches;
      if (view.reducedMotion) view.smoke.length = 0;
      ensureLoop();
      draw();
    }

    try { mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { mq = null; }
    view.reducedMotion = !!(mq && mq.matches);
    if (mq) mqOn(mq, onMq);
    document.addEventListener('keydown', onDocKey);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    if (typeof ResizeObserver === 'function') {
      /* resize() changes the canvas height, which changes the observed box,
         so the work is deferred a frame to keep the observer loop clean. */
      ro = new ResizeObserver(function () {
        if (!guard()) return;
        if (root.clientWidth !== view.w) requestAnimationFrame(onResize);
      });
      ro.observe(root);
    }

    showStart();
    resize();
    updateHead();
    syncPause();
    describe(true);
    ensureLoop();
    try {
      if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready.then(function () { if (connected()) draw(); }, function () { /* fonts unavailable */ });
      }
    } catch (e) { /* no Font Loading API */ }

    inst = {
      mount: mount,
      destroy: teardown,
      getState: function () {
        var st = sim ? sim.state : null;
        return { phase: st ? st.phase : 'ready', t: st ? st.t : 0, T: st ? st.T : C.T_START, score: sim ? sim.score() : 0, best: view.best };
      }
    };
    return inst;
  }

  function mountAll() {
    var list = Array.prototype.slice.call(document.querySelectorAll('[data-pit-game]'));
    var byId = document.getElementById('pit-game');
    if (byId && list.indexOf(byId) === -1) list.push(byId);
    list.forEach(function (m) {
      if (m.hasAttribute('data-pit-game-mounted')) return;
      var inst = createInstance(m);
      if (inst) API.instances.push(inst);
    });
  }

  var API = { version: C.VERSION, instances: [], makeSim: makeSim, mountAll: mountAll };
  var G = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (G) G.HSPitGame = API;
  if (typeof document !== 'undefined' && document && typeof document.querySelectorAll === 'function') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
    else mountAll();
  }
})();
