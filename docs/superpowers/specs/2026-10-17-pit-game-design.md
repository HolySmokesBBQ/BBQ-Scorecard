# Hold 225: design spec

**Date:** 2026-10-17
**Slug:** `hold-225`
**Display title:** HOLD 225 (Burnt Ends Inline; basic Latin, no apostrophe)
**Ships as:** `website/public-landing/game.html` (served at `/game`) and `public/pit-game.js` (served at `/pit-game.js?v=1`). Nothing else is created or edited by the build; the Website session owns `scripts/assemble-dist.mjs`, `netlify.toml`, `site.css` and the existing pages (handoff in section 15).
**Status:** spec for the builder. Joel asked for the Security auditor to be looped in; section 12 is the auditor's checklist and section 16 lists the two calls that are not the builder's.
**Winning concept:** "Hold 225", picked 3 of 3 by the judge panel. Grafts applied: the end-screen cause line and knock tally (judges 1 and 2), gold removed from the widget and the game-numbers disclaimer added (judge 3), five nav links with no `aria-current` (all three). Physics constants were re-derived with a headless check (section 4.10) because the concept's "band edge in 1.4 s" ignored its own damping term.

---

## 1. Intent

A smoker thermometer in the site's palette. One tap feeds the fire. Keep the needle inside a band that tightens over a 75 second cook while wind, an open lid and a flare-up knock it around. Holding temperature is the whole skill of running a smoker, so the game needs no explanation, and the dial is the smokehouse sign in miniature: near-black, cream lettering, one orange needle head.

The game is a page on holysmokesbbqco.com, not a product. It sells nothing, names no price, logs nothing and makes no network request. Its one borrowed sentence is the apps line already live on the About page.

## 2. Goals and non-goals

Goals

- Fun before it is understood: the needle is sinking the moment the cook starts, the whole dial is the button, and every miss has a readable cause (tapped late, tapped after the lid shut).
- One comparable number per run. A retry costs at most 75 seconds and under 150 ms of transition.
- Playable by thumb, mouse, keyboard and screen reader, at 375 px wide, with reduced motion honored and timing identical in every mode.
- Zero collection. One `localStorage` integer, read once and written only on a new best, inside try/catch.
- Small and provable: one state object, a constants block, a pure simulation that runs headless in Node for tuning.

Non-goals

- No leaderboard, no name entry, no share that posts anywhere, no run history, no timestamps.
- No images, sprites, gradients, shadows, particles, screen shake or flashes. Everything is drawn in code.
- No adaptive difficulty. The curve is time-based so a seed replays the same run.
- No real cooking advice. 225 is a target number in the house face, and the page says the numbers are game numbers.
- No nav change on the other pages, no site.css edits, no deploy (handoff only).

## 3. The game, second to second

Press START THE COOK. The needle sits at 205 under the word GET IT TO 225 and begins to sink. You tap; nothing happens for a fifth of a second, then the needle lifts a hair. You learn to tap a beat early. The band is wide at first (plus or minus 25) and the first five seconds are quiet. Then a warning word shows with a signal you can read without reading: WIND with three dashes sliding across the top, LID with the lid line lifting, FLARE with the ember row brightening. Wind and an open lid pull the heat down, so you answer with two or three quick taps. A flare pushes the heat up, so you sit on your hands. After a lid shuts the fire climbs on its own for a second, and the player who keeps tapping overshoots. From 20 to 60 seconds the band shrinks to plus or minus 10 and the knocks come closer and hit harder. The streak label climbs x1, x2, x3 as you stay in band, and the last fifteen seconds are worth three times the first fifteen. A full cook is 1:15. Most early runs end between 0:20 and 0:50 with the fire out or the pit too hot, and the end card says which knock did it and how late the thumb was.

## 4. Rules, with numbers

All units are degrees F and seconds. Every constant below lives in one `C` object at the top of `pit-game.js` so the Website session can tune on a phone. Nothing elsewhere in the file hard-codes a number from this table.

### 4.1 Constants block

| Name | Value | Meaning |
|---|---|---|
| `VERSION` | `'1.0.0'` | reported on `window.HSPitGame.version` |
| `RUN_SECONDS` | 75 | full cook |
| `TARGET` | 225 | twelve o'clock on the dial |
| `RAIL_LO`, `RAIL_HI` | 150, 300 | dial ends; outside them the fail grace runs |
| `T_MIN`, `T_MAX` | 140, 310 | hard clamp on T |
| `T_START`, `V_START` | 205, 0 | starting needle and velocity |
| `GRAVITY` | -24 | deg per s squared; the fire dying down |
| `DAMPING` | 1.5 | per s; terminal drift is GRAVITY / DAMPING = -16 deg per s |
| `V_MAX` | 60 | velocity clamp, both signs |
| `PULSE` | 30 | velocity one tap adds, spread over PULSE_LEN |
| `PULSE_LEN` | 0.28 | seconds a pulse takes to pay out |
| `LAG` | 0.18 | seconds between the tap and the pulse starting |
| `DT_MAX` | 0.05 | frame delta clamp |
| `BAND_WIDE`, `BAND_TIGHT` | 25, 10 | band half-width at the start and the end |
| `BAND_SHRINK_START`, `BAND_SHRINK_END` | 20, 60 | linear shrink window |
| `TIGHT_ZONE` | 4 | half-width of the tight bonus zone |
| `QUIET_START` | 5 | no knocks before this |
| `FIRST_KNOCK_DELAY` | [1.5, 3.0] | first warning at QUIET_START plus this |
| `GAP_EARLY` | [3.0, 6.0] | gap before 30 s |
| `GAP_MID` | [2.5, 5.0] | gap from 30 s |
| `GAP_LATE` | [2.0, 4.0] | gap from 60 s |
| `GAP_MID_FROM`, `GAP_LATE_FROM` | 30, 60 | where the gap tables switch |
| `KICK_RAMP` | [20, 60] | onset kicks scale from 1.0 at 20 s to KICK_SCALE_MAX at 60 s |
| `KICK_SCALE_MAX` | 1.3 | and hold there |
| `WIND_WARN`, `WIND_LEN` | 0.6, 1.2 | warning, then effect |
| `WIND_GRAVITY_MULT`, `WIND_KICK` | 1.8, -20 | gravity multiplier during the effect; one-time v kick at onset |
| `LID_WARN`, `LID_OPEN_LEN`, `LID_SHUT_LEN` | 0.5, 1.6, 1.0 | warning, open phase, shut phase |
| `LID_OPEN_KICK`, `LID_OPEN_GRAVITY_ADD` | -28, -10 | kick at onset; added to gravity while open |
| `LID_SHUT_GRAVITY` | +18 | gravity is replaced by this while shut |
| `FLARE_WARN`, `FLARE_LEN` | 0.4, 0.9 | warning, then effect |
| `FLARE_KICK`, `FLARE_GRAVITY` | +26, +20 | kick at onset; gravity replaced during the effect |
| `PAIR_AFTER`, `PAIR_OFFSET`, `PAIR_CHANCE` | 60, 1.2, 0.5 | one wind-then-lid pair per run at most |
| `GRACE` | 1.5 | continuous seconds outside a rail before the run ends |
| `SETTLE` | 1.0 | tail added to a knock's window for the held test |
| `SCORE_BAND`, `SCORE_TIGHT` | 10, 5 | points per second, each times the multiplier |
| `FINISH_BONUS` | 250 | once, for a full cook |
| `STREAK_X2`, `STREAK_X3` | 5, 10 | consecutive in-band seconds for x2 and x3 |
| `LIVE_GAP` | 0.7 | minimum seconds between live region messages |
| `DESCRIBE_EVERY` | 1.0 | seconds between rewrites of the description paragraph |
| `TREMOR_LEN`, `TREMOR_PX` | 0.3, 2 | needle tremor at each knock onset |
| `SMOKE_IN_BAND`, `SMOKE_OUT_OF_BAND` | 6, 3 | decorative puffs alive |
| `STORAGE_KEY` | `'hs.pitgame.best'` | the only persistence |
| `SHARE_SUFFIX` | `'holysmokesbbqco.com/game'` | tail of the copied line |

### 4.2 State object

One object per instance. The simulation part (everything a headless test needs) is separate from the view part.

```
sim: { t, T, v, pulses[], phase: 'ready'|'playing'|'paused'|'over',
       result: null|'done'|'out'|'hot', endedAt,
       knock: null | { kind, phase: 'warn'|'on'|'shut'|'settle', until, warnStart, onset, shutStart, held, tapsAfterWarn, firstTapAfterWarn, tapsAfterShut },
       lastKind, nextKnockAt, pairUsed, pairAt,
       streak, mult, scoreBand, scoreTight, scoreFinish,
       everInBand, inBandNow, railSince, graceStart,
       log: { taps[], knocks[], exits[] }, rng }
view: { canvas, ctx, dpr, w, h, reducedMotion, smoke[], tremorUntil, lastDescribeAt, liveQueue, lastLiveAt, best }
```

Every timer in `sim` is on the game clock `t`, which only advances while `phase === 'playing'`. Nothing in `sim` reads `Date.now()` or `performance.now()` except the seed default.

### 4.3 Physics step

Per frame, with `dt = min(DT_MAX, (now - last) / 1000)`, and only while playing:

1. `t += dt`.
2. Run the knock scheduler (4.5) and advance the active knock's phase.
3. Compose gravity `g`: start at `GRAVITY`. Exactly one override applies, in this precedence: flare effect sets `g = FLARE_GRAVITY`; lid shut sets `g = LID_SHUT_GRAVITY`; lid open adds `LID_OPEN_GRAVITY_ADD`; wind effect multiplies by `WIND_GRAVITY_MULT`. Effects never overlap in practice (section 4.5), the precedence is for safety.
4. Pay out pulses: for each pulse with `t >= pulse.at`, `use = min(dt, pulse.left)`; `v += (PULSE / PULSE_LEN) * use`; `pulse.left -= use`; drop it at zero.
5. `v += g * dt`; `v *= max(0, 1 - DAMPING * dt)`; clamp `v` to `[-V_MAX, V_MAX]`.
6. `T += v * dt`; clamp `T` to `[T_MIN, T_MAX]`.
7. Band, streak, score (4.4, 4.7). Rails and grace (4.6). Full cook at `t >= RUN_SECONDS`.

With these constants, from 225 doing nothing, the needle leaves the wide band after about 2.2 s and reaches the low rail after about 5.5 s. One tap lifts the needle about 13 degrees within a second and about 19 in all. Holding steady with no knocks takes about 0.8 taps per second (`|GRAVITY| / PULSE`). Those three facts are the feel; the headless check in 4.10 prints them.

### 4.4 Feed and band

FEED is the single verb. A tap never changes `v` directly; it pushes `{ at: t + LAG, left: PULSE_LEN }` onto `pulses` and `t` onto `log.taps`. Pulses stack, so three quick taps are how a lid open is answered. If the active knock is in its warn, on or shut phase, the tap increments `knock.tapsAfterWarn` (and `tapsAfterShut` once the lid has shut) and sets `firstTapAfterWarn` if unset.

Band half-width `hw(t)`: `BAND_WIDE` until `BAND_SHRINK_START`, linear to `BAND_TIGHT` at `BAND_SHRINK_END`, then flat. In band means `|T - TARGET| <= hw(t)`. Tight means `|T - TARGET| <= TIGHT_ZONE`. `everInBand` flips true on the first in-band frame and drives the GET IT TO 225 word and the first "In band." announcement. An exit is a frame where in-band goes from true to false after `everInBand`; it is logged as `{ t, knock: activeKnockRef | null }` and attributed to that knock's kind if the exit falls inside the knock's window `[warnStart, windowEnd]`, else to "unforced". Out-of-band seconds accrue to the exit's bucket until re-entry or the end of the run. Seconds before the first entry count for nothing.

### 4.5 Knocks

Scheduler. `nextKnockAt = QUIET_START + U(FIRST_KNOCK_DELAY)` at run start (so the first warning lands between 6.5 and 8.0 s). When `t >= nextKnockAt` and no knock is active, pick a kind uniformly from the two kinds that are not `lastKind` (three on the first pick), and start its warning. When a knock's window closes, `nextKnockAt = t + U(gap)` where `gap` is `GAP_EARLY` before `GAP_MID_FROM`, `GAP_MID` before `GAP_LATE_FROM`, else `GAP_LATE`. The gap is measured from the end of the previous knock's window to the next warning start, so knocks never overlap.

Kick scale. `ks(t) = 1 + (KICK_SCALE_MAX - 1) * clamp((t - KICK_RAMP[0]) / (KICK_RAMP[1] - KICK_RAMP[0]), 0, 1)`. Only the one-time onset kicks are multiplied by `ks`; gravity modifiers are not.

| Kind | Warning (word plus static-safe signal) | Onset | Effect | After |
|---|---|---|---|---|
| WIND | `WIND_WARN` 0.6 s. Word WIND. Three cream dashes slide left to right across the top zone (static, centered, under reduced motion). | `v += WIND_KICK * ks` | `WIND_LEN` 1.2 s with gravity x `WIND_GRAVITY_MULT`. | `SETTLE` 1.0 s tail, then window closes. |
| LID | `LID_WARN` 0.5 s. Word LID. The lid line above the dial lifts 6 px and thickens from 2 to 4 px (instant under reduced motion, eased over 120 ms otherwise). | `v += LID_OPEN_KICK * ks` | `LID_OPEN_LEN` 1.6 s with gravity plus `LID_OPEN_GRAVITY_ADD`; line stays lifted. Then `LID_SHUT_LEN` 1.0 s with gravity replaced by `LID_SHUT_GRAVITY`; word LID SHUT; line drops back. | `SETTLE` 1.0 s tail. |
| FLARE | `FLARE_WARN` 0.4 s. Word FLARE. The nine ember dots go from 60% to 100% alpha orange and from 6 to 8 px. | `v += FLARE_KICK * ks` | `FLARE_LEN` 0.9 s with gravity replaced by `FLARE_GRAVITY`; embers stay bright. | `SETTLE` 1.0 s tail. |

Knock words show from warning start through the end of the effect (LID SHUT through the shut phase); the settle tail shows the band words again.

Pair. At most once per run: when a WIND starts at `t >= PAIR_AFTER` and `rng() < PAIR_CHANCE` and `!pairUsed`, set `pairUsed = true` and `pairAt = onset + PAIR_OFFSET` (1.2 s after the wind onset, which is the moment the wind effect ends). At `pairAt` the wind's window closes early (its held flag is final as of then) and a LID warning starts immediately, skipping the gap. `lastKind` becomes `'lid'` as usual.

Held. A knock is held when the needle was in band on every frame from `warnStart` to `windowEnd`. Any out-of-band frame in the window sets `held = false`. A knock still open when the run ends is closed as not held and counts in the tally. Needle tremor (view only): `tremorUntil = t + TREMOR_LEN` at each onset.

### 4.6 Rails, grace and the end of a run

Outside a rail means `T < RAIL_LO` or `T > RAIL_HI`. The first such frame sets `railSince = t` and `graceStart = t`; a frame back inside clears both. When `t - railSince >= GRACE` the run ends with `result = 'out'` (low) or `'hot'` (high) and `endedAt = t`. During the grace the offending rail tick thickens from 2 to 6 px and the state word reads FIRE GOING OUT or TOO HOT, so there is a last-ditch save moment. At `t >= RUN_SECONDS` the run ends with `result = 'done'`, `scoreFinish = FINISH_BONUS`, `endedAt = RUN_SECONDS`.

### 4.7 Scoring and streak

Per frame while in band: `streak += dt`, else `streak = 0`. `mult = streak < STREAK_X2 ? 1 : streak < STREAK_X3 ? 2 : 3`. In band: `scoreBand += SCORE_BAND * mult * dt`. Tight: `scoreTight += SCORE_TIGHT * mult * dt`. Total shown is `floor(scoreBand + scoreTight + scoreFinish)`; the breakdown cells floor each part. Leaving the band resets the streak and the multiplier with no other penalty. Realistic range: a first run 150 to 500, a decent run 800 to 1,400, the ceiling about 3,400 (never stated on the page). Streak milestones announce once per crossing of 5 s and 10 s (re-announced after a reset).

### 4.8 Difficulty curve

| Window | Band half-width | Knock gap (from previous window end) | Onset kick scale | Notes |
|---|---|---|---|---|
| 0 to 5 s | 25 | none | 1.0 | needle starts at 205 and sinks; learn the rhythm |
| 5 to 20 s | 25 | first at 6.5 to 8.0 s, then 3.0 to 6.0 s | 1.0 | base strength |
| 20 to 30 s | 25 shrinking | 3.0 to 6.0 s | 1.0 rising | |
| 30 to 60 s | shrinking to 10 | 2.5 to 5.0 s | rising to 1.3 | |
| 60 to 75 s | 10 | 2.0 to 4.0 s | 1.3 | one possible wind-then-lid pair; streak worth the most |

Grace is 1.5 s throughout. The curve is time-based only, never adaptive.

### 4.9 RNG and determinism

mulberry32, seeded from `Date.now() >>> 0` unless the mount carries `data-seed="<integer>"`, in which case every run on that mount uses that seed (tests). `U(a, b) = a + (b - a) * rng()`. Every random draw in the simulation goes through this one generator in a fixed order (kind pick, gap, pair chance), so a seed replays the same run. Decorative smoke uses `Math.random()` and never touches the simulation.

### 4.10 Tuning, and what the headless check showed

The physics is linear, so three numbers describe the feel: terminal drift `GRAVITY / DAMPING` (how fast the needle falls with no help), lift per tap `PULSE / DAMPING` (how far one tap eventually moves it), and hold rate `|GRAVITY| / PULSE` (taps per second to stand still). The concept's values (-16, 0.8, 30) give a hold rate of 0.53 taps per second and a floaty 35 degree lift that keeps paying out for three seconds; a 1 Hz tapper ran hot on every run. The chosen values (-24, 1.5, 30) give a 0.8 taps per second hold rate, a 13 degree lift inside a second, band edge at 2.2 s and rail at 5.5 s.

A scripted tapper is not a person. The check (section 14.1) showed that bots which predict with velocity finish almost every run at any setting, and that bots limited to a tap-and-watch rhythm live or die on whether their rate beats the hold rate. The honest target is a phone playtest: a first-timer finishes about one run in three, and the fails split between FIRE WENT OUT and PIT RAN TOO HOT rather than all one kind. Tuning rule for the Website session: move `GRAVITY` first, between -22 (easier) and -26 (harder), keep `DAMPING` at 1.5 and `PULSE` at 30; raise `LAG` toward 0.25 only if the game feels like a reflex test rather than a rhythm. Bump `?v=` after any change (section 15).

## 5. States and transitions

| From | Trigger | To | Side effects |
|---|---|---|---|
| ready | START THE COOK click, or Enter/Space on it | playing | reset `sim` with a fresh seed (or `data-seed`), remove the start overlay, enable FEED, focus the canvas, live "Cook is on. Feed the fire." |
| playing | Escape or P (document), `visibilitychange` to hidden, `window` blur | paused | stop the clock, show the pause overlay, focus RESUME, live "Paused." |
| paused | RESUME click, Escape or P, pointerdown on the pause overlay backdrop, a feed key on the focused canvas, FEED THE FIRE click | playing | hide the overlay, `last = now` so no dt jump, focus the canvas, live "Resumed." The resuming input is swallowed; it never feeds. |
| playing | grace expires, or `t >= RUN_SECONDS` | over | stop, compute diagnostics, write best if higher, show the end overlay, disable FEED, focus PLAY AGAIN, live result |
| over | PLAY AGAIN click, Enter/Space on it, or R (document) | playing | same as ready to playing; no transition longer than 150 ms, no animation |

In ready and over the FEED THE FIRE button is `disabled`; canvas pointer and key input do nothing. Pause from the ready or over state is a no-op. Escape, P and R are ignored when the event target is an input, textarea, select or contenteditable element (none on game.html; the guard is for other host pages).

## 6. Controls

Touch. `pointerdown` anywhere on the canvas feeds (primary button only, `pointerType` any). The canvas has `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-tap-highlight-color: transparent`. The instance adds `touchstart` (`{ passive: false }`, calls `preventDefault`) and `contextmenu` (`preventDefault`) listeners on the canvas only, so no double-tap zoom, pull-to-refresh or long-press menu on the gauge, and the rest of the page keeps normal gestures. `pointerdown` also calls `canvas.focus({ preventScroll: true })` because the touchstart preventDefault suppresses the browser's own focus.

Button. FEED THE FIRE, a real `<button>` 48 px tall under the canvas, calls the same feed handler from its `click` event. Enter and Space work through the button's native click; the button adds a `keydown` handler only for ArrowUp and F (with `preventDefault` on ArrowUp) so the four feed keys match the canvas without double-firing.

Mouse. Click anywhere on the canvas (via `pointerdown`) or the button.

Keyboard, canvas focused (`tabindex="0"`): Space, Enter, ArrowUp, F feed on `keydown`; `e.repeat` is ignored so holding a key never machine-guns the fire; `preventDefault` on Space and ArrowUp so the page does not scroll; events with ctrl, meta or alt are ignored. Document level: Escape or P toggles pause while playing or paused; R restarts from over. Start, pause and end overlays are real buttons, so Tab reaches them and Enter or Space activates them with no extra code.

Focus ring everywhere inside the widget, canvas included: `outline: 2px solid #E6D8B8; outline-offset: 2px` on `:focus-visible`.

## 7. The page: `website/public-landing/game.html`

Copy `about.html` and change only what is listed. The nav stays at the five existing links and no link carries `aria-current` (adding a sixth GAME link touches every page, which is the Website session's call; section 16). The h1 is the game title. The footer block is copied from `about.html` unchanged. One page-local `<style>` is allowed (CSP `style-src` permits inline styles); no inline script, no inline event handlers, no `javascript:` URLs.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1b1714" />
  <title>Hold 225 | Holy Smokes BBQ Co</title>
  <link rel="stylesheet" href="/site.css?v=4" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  <link rel="canonical" href="https://holysmokesbbqco.com/game" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Holy Smokes BBQ Co" />
  <meta property="og:title" content="Hold 225 | Holy Smokes BBQ Co" />
  <meta property="og:description" content="A 75 second pit game. Keep the needle in the band with one tap that feeds the fire. Wind and an open lid pull the heat down, a flare pushes it up." />
  <meta property="og:image" content="https://holysmokesbbqco.com/photos/g-fire-logs-1440.jpg" />
  <meta property="og:url" content="https://holysmokesbbqco.com/game" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Hold 225 | Holy Smokes BBQ Co" />
  <meta name="twitter:description" content="A 75 second pit game. Keep the needle in the band with one tap that feeds the fire. Wind and an open lid pull the heat down, a flare pushes it up." />
  <meta name="twitter:image" content="https://holysmokesbbqco.com/photos/g-fire-logs-1440.jpg" />
  <meta name="description" content="A 75 second pit game. Keep the needle in the band with one tap that feeds the fire. Wind and an open lid pull the heat down, a flare pushes it up." />
  <style>
    .how { max-width: 62ch; }
    .how p { font-size: 17px; line-height: 1.5; color: #E6D8B8; margin-bottom: 12px; }
    .how p.note { color: #bfb39a; }
    .how p:last-child { margin-bottom: 0; }
    .pit-game-nojs { color: #bfb39a; font-size: 17px; text-align: center; padding: 40px 0; }
  </style>
  <script src="/gtm-init.js?v=8" defer data-ga-title="Hold 225 | Holy Smokes BBQ Co" data-ga-group="landing"></script>
  <script src="/pit-game.js?v=1" defer></script>
</head>
<body>
  <a class="skip" href="#main">Skip to the content</a>
  <header class="masthead">
    <nav class="site-nav" aria-label="Site">
      <a href="/">HOME</a>
      <a href="/pit">FROM THE PIT</a>
      <a href="/episodes">EPISODES</a>
      <a href="/about">ABOUT</a>
      <a href="/#apps">THE APPS</a>
    </nav>
    <h1>HOLD 225</h1>
    <p>Keep the pit needle in the band for a 75 second cook. One tap feeds the fire.</p>
  </header>
  <main id="main">
    <section class="band">
      <div class="wrap">
        <div id="pit-game" data-pit-game>
          <p class="pit-game-nojs">The game runs in your browser and needs JavaScript turned on.</p>
        </div>
      </div>
    </section>
    <section class="band band-umber">
      <div class="wrap">
        <h2 class="display">HOW IT PLAYS</h2>
        <div class="how">
          <p>A tap feeds the fire after a short lag, so tap a beat before the needle leaves the band.</p>
          <p>Wind and an open lid pull the heat down. A few quick taps bring it back.</p>
          <p>A flare pushes the heat up. Stop tapping until it passes.</p>
          <p>The band tightens as the cook goes on, and a long stretch in band is worth more.</p>
          <p>The cook ends at 1:15, or sooner if the fire goes out or the pit runs too hot.</p>
          <p class="note">Your best score is kept on this device.</p>
          <p class="note">The temperatures here are game numbers, not a cooking guide.</p>
        </div>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
    <footer>
      <p class="signoff">
        <img src="/striker/striker-dry-figure.svg" width="280" height="300" alt="Striker, the Holy Smokes torch character" loading="lazy" decoding="async" />
        <span>It's just a match. <span class="who">STRIKER</span></span>
      </p>
      <p>Catering clients: <a href="/catering/">sign in to your quotes</a></p>
      <p>
        <a href="/privacy.html">Privacy</a>
        <span class="sep" aria-hidden="true">&middot;</span>
        <a href="/accessibility.html">Accessibility</a>
        <span class="sep" aria-hidden="true">&middot;</span>
        <a href="/changelog.html">Changelog</a>
        <span class="sep" aria-hidden="true">&middot;</span>
        <a href="/delete-account.html">Delete account</a>
        <span class="sep" aria-hidden="true">&middot;</span>
        <a href="#analytics-choices" data-analytics-choices>Analytics choices</a>
      </p>
      <p>&copy; 2026 Holy Smokes BBQ Co</p>
    </footer>
      </div>
    </section>
  </main>
</body>
</html>
```

Notes for the builder: match the `?v=` on `site.css` and `gtm-init.js` to whatever `about.html` carries on the day you build (today 4 and 8). The og image is the fire-logs photo already referenced by `about.html`; it exists at 1440 px. The footer is byte-identical to `about.html` lines 101 to 119. The mount div's nojs paragraph is removed by the script on mount.

## 8. Mount contract: `public/pit-game.js`

- One IIFE, `'use strict'`, ES2020, no dependencies, no `eval`, no `new Function`, no `innerHTML`, no network, no console output in normal operation. Target under 40 KB unminified (concept estimate 26 KB).
- The script is `defer`red, so it runs after parse. It does not wait for `DOMContentLoaded` (already fired or about to); it runs `mountAll()` directly, guarded by `typeof document !== 'undefined'` so the same file loads in Node for the headless check.
- `mountAll()` selects every element matching `[data-pit-game]`, then `#pit-game` if present and not already in the list, and creates one instance per element. An element already carrying `data-pit-game-mounted` is skipped. Each instance sets that attribute.
- Styles: one `<style id="pit-game-style">` appended to `document.head` the first time an instance mounts (`createElement('style')` plus `textContent`; allowed under `style-src 'unsafe-inline'`). Every selector is scoped under `.pit-game`. Font stacks: `'Burnt Ends Solid', 'Oswald', sans-serif` for labels and buttons, `'Inter', sans-serif` for numbers and text. No `@font-face` of its own; the host page's faces apply, fallbacks otherwise.
- DOM: the instance empties the mount, then builds everything with `createElement`, `textContent`, `setAttribute` and `append`. The structure is in section 9.1. Element ids that must be unique (the description paragraph) are suffixed with the instance index.
- Canvas: `getContext('2d')`; if null, the instance writes one paragraph into the mount, "This browser cannot draw the gauge, so the game will not run here.", and stops.
- Listeners per instance: canvas `pointerdown`, `touchstart`, `contextmenu`, `keydown`; feed button `click`, `keydown`; overlay buttons `click`; pause backdrop `pointerdown`; `document` `keydown` and `visibilitychange`; `window` `blur`; a `ResizeObserver` on the root (fallback `window` `resize`); `matchMedia('(prefers-reduced-motion: reduce)')` `change`.
- Loop: `requestAnimationFrame` with delta time, never `setInterval`. The loop runs while the phase is playing, and in ready or over while decorative motion is on; it stops while paused (nothing moves) and restarts on resume with `last = now`. Each tick first checks `mount.isConnected`; if false it cancels the frame, removes the document, window, media and observer listeners and returns. The document and window listeners begin with the same `isConnected` guard and self-remove when it fails, which covers removal while the loop is stopped. No MutationObserver.
- Sizing: on each ResizeObserver callback and at mount, `w = root.clientWidth`, `h = clamp(260, round(0.75 * w), 420)`, `dpr = min(3, devicePixelRatio || 1)`; set `canvas.width = w * dpr`, `canvas.height = h * dpr`, `canvas.style.width = w + 'px'`, `canvas.style.height = h + 'px'`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, then draw one frame even when the loop is stopped. This covers rotation and zoom without a blurred dial.
- Globals: nothing on `window` except `window.HSPitGame = { version, instances, makeSim }`. `instances` is an array of `{ mount, getState() }` where `getState()` returns a snapshot `{ phase, t, T, score, best }` for the sitecheck. `makeSim(seed, overrides)` is the pure simulation factory used by the instances themselves and by the headless check; it returns `{ state, constants, start(), step(dt), tap(), summary() }` and touches no DOM. `start()` moves the phase from ready to playing, `step(dt)` is section 4.3 with the clamp applied inside, `tap()` is section 4.4, and `summary()` returns the end-card facts (result, endedAt, score parts, cause and knock sentences) so the diagnostics in 10.4 are computed in one place and testable headless.
- Storage: `best` is an in-memory integer initialized from `localStorage.getItem(STORAGE_KEY)` once at mount, inside try/catch; a value that is not a finite non-negative integer below 10,000,000 reads as none. It is written (`setItem(STORAGE_KEY, String(best))`, inside try/catch) only when a run ends with a higher total. Storage that throws or is absent changes nothing visible except that BEST appears only once a run has been played.

## 9. Visual treatment

Palette inside the widget: background `#1b1714`, panel `#2a2015`, hairline `#3a332c`, cream `#E6D8B8`, muted `#bfb39a`, orange `#D06129`, hover `#e0803f`, ink `#1b1714` for text on orange. Gold `#F3CF6D` is the Calculator's color under DESIGN.md's per-app rule and appears nowhere in the widget. No gradients, no shadows, no images. Radii 8 px on buttons, 14 px on the panel and overlay cards. Depth from fill against fill and 2 px borders.

### 9.1 Widget structure (built by the script)

```
div.pit-game                       max-width 560px; margin 0 auto; color cream
  div.pg-head                      three cells, flex, gap 12px, margin-bottom 12px
    div.pg-cell                    label SCORE / number / streak label "x1"
    div.pg-cell                    label TIME  / number "1:15"
    div.pg-cell.pg-best            label BEST  / number; hidden (display:none) until a best exists
  div.pg-stage                     position relative
    canvas.pg-canvas               tabindex="0" role="img" aria-label="Pit gauge" aria-describedby="pg-desc-N"
    div.pg-overlay                 absolute inset 0; holds the start, pause or end card; removed while playing
  button.pg-feed                   FEED THE FIRE; 48px tall; full width up to 320px; margin 14px auto 0; disabled in ready and over
  p.pg-hint                        instruction line, muted 15px Inter, centered
  p.pg-sr#pg-desc-N                visually hidden description paragraph
  div.pg-sr.pg-live                visually hidden, aria-live="polite" aria-atomic="true"
```

Labels: Burnt Ends Solid 13 px, letter-spacing 0.16em, muted. Numbers: Inter 24 px cream, `font-variant-numeric: tabular-nums`. The streak label under SCORE is Inter 14 px: "x1" muted, "x2" and "x3" cream (the text is the signal). Score shows with a thousands separator via `toLocaleString('en-US')` inside try/catch, falling back to `String(n)`. TIME shows `m:ss` of `ceil(RUN_SECONDS - t)` floored at 0:00.

`.pg-sr`: `position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0`.

### 9.2 Canvas geometry

Layout constants: `PAD 14`, `TOP_ZONE 26`, `UNDER 90`. `R = min(h - PAD - TOP_ZONE - UNDER, (w - 2 * PAD) / 2 - 16)`; pivot `cx = w / 2`, `cy = PAD + TOP_ZONE + R`. At 335 x 260 (a 375 px phone) R is 130; at 560 x 420 R is 250.

Angle map: `angle(T) = PI + ((T - RAIL_LO) / (RAIL_HI - RAIL_LO)) * PI` in canvas radians, so 150 is at 9 o'clock, 225 at 12, 300 at 3. A point at radius `L` is `(cx + L * cos(a), cy + L * sin(a))`.

Draw order each frame:

1. Panel: `roundRect` (or a path fallback) over the whole canvas, fill `#2a2015`, 2 px `#3a332c` stroke inset by 1 px, radius 14.
2. Smoke (normal motion only), behind everything else inside the dial: see 9.3.
3. Track: arc at radius `R - 6` from `PI` to `2 * PI`, 10 px stroke, `#3a332c`, butt caps.
4. Band: the same arc from `angle(TARGET - hw)` to `angle(TARGET + hw)`, 10 px stroke, cream at 18% alpha. Band edge ticks: radial 2 px cream lines from `R - 16` to `R + 2` at both edge angles; they creep inward as the band tightens.
5. Rail ticks: radial lines at `angle(RAIL_LO)` and `angle(RAIL_HI)` from `R - 16` to `R + 2`, 2 px orange; the offending one is 6 px during the grace.
6. Lid line: horizontal, length `R`, centered on `cx`, at `y = PAD + 20` resting, `PAD + 14` and 4 px thick from the lid warning through the end of the open phase (eased 120 ms normally, instant under reduced motion); 2 px cream otherwise.
7. Wind dashes (warning only): three 14 x 2 px cream dashes, 24 px apart, at `y = PAD + 8`, sliding from `x = cx - R` to `cx + R - 62` over the 0.6 s warning; under reduced motion the three dashes sit centered on `cx` for the warning.
8. Needle: 3 px cream line with round caps from the pivot to length `R - 24`, plus a triangle head 12 px long and 9 px wide at the tip, filled orange while in band and muted while out. Tremor (normal motion only): while `t < tremorUntil`, add `(TREMOR_PX / (R - 24)) * sin(2 * PI * 25 * t) * (tremorUntil - t) / TREMOR_LEN` radians.
9. Pivot: cream disc, radius 5.
10. Temperature: `round(T)` in Inter 48 px cream, centered at `cx`, baseline `cy + 40`.
11. State word: Inter 16 px cream, letter-spacing 0.12em (`ctx.letterSpacing` when supported, else plain), centered, baseline `cy + 62`, text in capitals. Priority: FIRE GOING OUT or TOO HOT during the grace; WIND, LID, LID SHUT or FLARE from a warning start through its effect; GET IT TO 225 before the first band entry; otherwise IN BAND, LOW or HIGH.
12. Embers: nine dots, 6 px, orange at 60% alpha, evenly spaced between `x = PAD + 20` and `w - PAD - 20` at `y = h - PAD - 6`; 8 px at 100% alpha from the flare warning through the end of the flare effect.

Canvas text is Inter only, never Burnt Ends, so no `document.fonts` wait is needed. The display face appears only in DOM labels and buttons.

### 9.3 Decorative motion

All of it is removed when `prefers-reduced-motion: reduce` matches, re-checked on the media query's `change` event. Rules and timing never change with the setting.

- Smoke: up to `SMOKE_IN_BAND` soft cream circles while in band, `SMOKE_OUT_OF_BAND` otherwise. Each spawns at `(cx + U(-0.15, 0.15) * R, cy - 6)`, rises at 12 to 20 px per second, grows from 6 to 14 px radius and fades from 10% to 0 alpha over 2.5 to 4 s, then respawns. Clipped to the dial's half disc so nothing crosses the panel edge.
- Wind dashes sliding during a wind warning (static under reduced motion).
- Lid line easing 120 ms (instant under reduced motion).
- Needle tremor 300 ms at each knock onset (none under reduced motion).
- Button background transition 150 ms (none under reduced motion).

No screen shake, no particles beyond the smoke, no flashes, no gradients, no shadows. Text never animates. Overlays appear and disappear with no transition.

### 9.4 Buttons and cards

`.pg-btn`: `min-height 48px; padding 0 22px; border-radius 8px; font: 400 16px 'Burnt Ends Solid', 'Oswald', sans-serif; letter-spacing 0.02em; cursor pointer; border 2px solid transparent`. Orange variant: background `#D06129`, color `#1b1714`, hover `#e0803f`. Outline variant: border `#E6D8B8`, color `#E6D8B8`, transparent background, hover background `rgba(230,216,184,0.12)`. Disabled: opacity 0.45, default cursor. Active: `translateY(1px)` (none under reduced motion).

Overlay card: centered in the stage over a backdrop `rgba(27,23,20,0.72)`, panel `#2a2015`, 2 px `#3a332c` border, 14 px radius, padding 22 px, max-width 92% of the stage, text centered. The end card may be taller than the stage on a 260 px canvas; the stage's overlay scrolls (`overflow:auto`) rather than clipping.

## 10. Overlays

### 10.1 Start

One line in Inter 17 px cream: "Keep the needle in the band. The cook is 1:15." Under it the orange button START THE COOK. Behind it the canvas shows the needle at 205 and the word GET IT TO 225 (smoke drifting under normal motion).

### 10.2 Pause

"Paused." in Inter 17 px cream, the outline button RESUME (focused), and under it in muted 15 px "Or tap the gauge to resume." A pointerdown on the backdrop resumes and is swallowed.

### 10.3 End

Over the dimmed canvas, top to bottom:

1. Title, Burnt Ends Solid 28 px cream: COOK'S DONE (full cook), FIRE WENT OUT (low rail), PIT RAN TOO HOT (high rail). The ASCII apostrophe is in the face (verified in the woff2 today, same as the footer's "It's just a match.").
2. Time line, Inter 15 px muted, early ends only: "Ended at 0:48 of 1:15."
3. Score, Inter 44 px cream, thousands separator.
4. Breakdown row: three cells with labels IN BAND, TIGHT, FINISH (Burnt Ends Solid 12 px, 0.16em, muted) over their floored values (Inter 15 px cream). FINISH is 0 on an early end.
5. Cause line, Inter 15 px cream: section 10.4.
6. Knock line, Inter 15 px muted: section 10.4. Omitted when no knock reached its warning.
7. Best line, Inter 15 px muted: "Best on this device: 1,240" or, when this run beat it, "New best on this device."
8. Buttons, 48 px tall, 8 px radius, side by side (wrapping at narrow widths): PLAY AGAIN (orange, focused on open) and COPY SCORE (outline). COPY SCORE writes `"Hold 225: 1,240 points. holysmokesbbqco.com/game"` with `navigator.clipboard.writeText` inside try/catch, then sets its own label to COPIED for 2 s, or to COPY FAILED when the API is missing or the promise rejects, then back to COPY SCORE. Nothing is posted anywhere.
9. Apps line, Inter 15 px muted, with two links styled like the masthead lede's link (cream, 2 px orange underline, 44 px hit area): "Scorecard, Notebook and Board, plus the Calculator on the web." where "Scorecard, Notebook and Board" links to `/#apps` and "the Calculator" links to `/calculator/`. This is the sentence live on `about.html` line 91.

R restarts, Enter on the focused PLAY AGAIN restarts, and the new run's first five seconds are again free of knocks.

### 10.4 The cause line and the knock line (the graft)

Both are computed from the run log at the moment the run ends and are never stored.

Cause line, early end. Let `K` be the knock whose window `[warnStart, windowEnd]` contains `graceStart`, or none.

| Result | K | Sentence one | Sentence two |
|---|---|---|---|
| out | wind | "The wind took it at 0:48." | "First tap came 1.1 seconds after the warning." or "No tap came after the warning." |
| out | lid | "The open lid took it at 0:48." | same as wind |
| out | flare or none | "No knock was on at 0:31." | "Last tap was 2.4 seconds before the end." or "No taps this run." |
| hot | flare | "The flare took it at 0:52." | "3 taps after the warning." / "1 tap after the warning." / "No taps after the warning." |
| hot | lid, `graceStart >= shutStart` | "It ran hot after the lid shut at 0:40." | "3 taps after the lid shut." / "1 tap after the lid shut." / "No taps after the lid shut." |
| hot | lid, before the shut | "The open lid took it at 0:40." | taps after the warning, as for flare |
| hot | wind | "The wind took it at 0:48." | taps after the warning, as for flare |
| hot | none | "No knock was on at 0:52." | "4 taps in the last 3 seconds." / "1 tap in the last 3 seconds." / "No taps in the last 3 seconds." |

The time is `graceStart` formatted `m:ss` (floor). Seconds in the stat are one decimal (`toFixed(1)`), counted from `K.warnStart` to the first tap in `log.taps` after it (sentence two of the out rows), or from the last tap to `endedAt` (the none row). Counts come from `K.tapsAfterWarn`, `K.tapsAfterShut`, or taps with `t >= endedAt - 3`.

Cause line, full cook: "Never left the band." when `log.exits` is empty; otherwise take the bucket with the most out-of-band seconds. If it is a knock kind: "Costliest knock: the lid, 9 seconds out of band." with the kind phrase "the wind", "the lid" or "the flare" and `max(1, round(seconds))` ("1 second" singular). If the unforced bucket wins: "Out of band 6 seconds, none of it on a knock." (same rounding, singular at 1).

Knock line, any result, when at least one knock reached its warning. `n` knocks, `h` held. All held: "Held all 7 knocks." or "Held the one knock." Otherwise: "Held 5 of 7 knocks. Weakest: lid, 1 of 3." with "knock" singular when `n` is 1 and the Weakest clause omitted when only one kind occurred. Weakest is the kind with the lowest held ratio among kinds seen; ties go to the kind seen more often, then the order wind, lid, flare. Kind words here are "wind", "lid", "flare".

## 11. Accessibility

- Canvas: `tabindex="0"`, `role="img"`, `aria-label="Pit gauge"`, `aria-describedby` pointing at the description paragraph. The paragraph is rewritten at most once per `DESCRIBE_EVERY` second and never carries knock words (the live region does). Texts: ready "Not started. The needle sits at 205."; playing "Needle at 231, in band, 42 seconds left, streak times two." with "in band", "low", "high" or "not yet in band" and the streak clause only at x2 or x3 ("streak times three"); paused "Paused. Needle at 231, 42 seconds left."; over "Over. 1,240 points."
- Live region (`aria-live="polite"`, `aria-atomic="true"`), one message per `LIVE_GAP` at most, latest pending message wins, nothing older than 2 s is spoken: "Cook is on. Feed the fire." / "In band." (first entry only) / "Wind." / "Lid open." / "Lid shut." / "Flare." / "Streak times two." / "Streak times three." / "Fire going out." / "Too hot." / "Paused." / "Resumed." / "Cook's done. 1,240 points." / "Fire went out at 0:48. 412 points." / "Pit ran too hot at 0:52. 390 points." with " New best on this device." appended when beaten / "Score copied." / "Copy failed."
- Focus: canvas on start and resume, RESUME on pause, PLAY AGAIN on the end card. All overlay controls are native buttons. The feed button and the canvas are both in the tab order.
- Every control is at least 44 px tall (buttons 48, canvas 260 or more). Visible focus ring, 2 px cream, 2 px offset.
- Color is never the only signal: knock warnings pair a word with a shape change; in band pairs the needle head color with the word IN BAND; the streak pairs color with the text x1, x2, x3; the fail grace pairs the thick tick with a word.
- Contrast on the panel `#2a2015`: cream 11:1, muted 7.7:1 (measured values from DESIGN.md), orange only as fills behind ink text and as thin marks, never as text. On the widget background `#1b1714` the same pairs hold.
- Works at 375 px with no horizontal overflow: the widget is `width:100%`, the canvas is the mount's width, the head cells shrink with `min-width:0`, the end buttons wrap.
- Pauses on `visibilitychange` to hidden, on `window` blur, on Escape or P. Keyboard-only play is complete: Tab to START THE COOK, Enter, Space to feed, Escape to pause, Enter on RESUME, R to restart.
- Reduced motion: section 9.3. Timing and rules identical.

## 12. Persistence, privacy and security (Security auditor checklist)

Facts the auditor can verify in the two files:

1. CSP: `game.html` has no inline `<script>`, no `on*=` attributes, no `javascript:` URL. The only scripts are `/gtm-init.js?v=8` (already on every page) and `/pit-game.js?v=1`, both `self`. The page-local `<style>` and the script's injected `<style>` are covered by `style-src 'unsafe-inline'`.
2. Network: `pit-game.js` makes no request of any kind. No `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `Image()` or `<link>` creation. Nothing loads from a CDN. `grep -nE "fetch\(|XMLHttpRequest|sendBeacon|WebSocket|new Image|importScripts" public/pit-game.js` returns nothing.
3. Storage: exactly one key, `hs.pitgame.best`, holding one integer. Read once at mount, written only when a run ends with a higher total, both inside try/catch. No cookies, no sessionStorage, no IndexedDB, no timestamps, no run history, no device data. The page says in one plain line that the best score is kept on this device.
4. Clipboard: write only, only from the COPY SCORE click handler (a user gesture), only the fixed line with the score. No read. Failure degrades to a label change.
5. DOM: `createElement` and `textContent` throughout; `grep -n "innerHTML\|outerHTML\|insertAdjacentHTML\|eval(\|new Function" public/pit-game.js` returns nothing. There are no untrusted strings anyway (no input fields, no URL parameters read; `data-seed` is parsed with `parseInt` and used only as a number).
6. Globals: `window.HSPitGame` only, read-only in practice (version string, instances array of snapshots, the pure `makeSim`).
7. Analytics: the game code calls nothing. The site's `gtm-init.js` runs on the page as on every other page under Consent Mode; the game adds no events. If Marketing later wants a "played" event, that is a separate change through the auditor.
8. Children and age: no age gate, no collection, so COPPA posture is unchanged (legal register 2026-10-14). The page has no form.
9. Content: no prices, no shop, no sauce, no Striker in the game (footer sign-off only, copied from about.html), no first-person Joel copy, no pro or trophy claim, no real cooking recommendation; the disclaimer line is on the page.
10. Caching: `*.js` is immutable for a year; the page references `/pit-game.js?v=1` and every change bumps `?v=` (section 15).

Calls for the auditor, not the builder: section 16.

## 13. Copy, final

Every user-facing string. Checked against the copy rules: no em dashes, no "not just X, but Y", no rule-of-three cadence, no rhetorical question pairs, no eyebrow labels, no "Get started" or "Learn more", no forward promises, no "anonymous", no identity padding, no KCBS, three apps plus the Calculator, nothing for sale, no offset, no Peyton, no Texas Match, no first person. Capitals in display strings come from the face; the HTML carries them in caps where the nav and h1 pattern on about.html does.

Page (`game.html`)

- `<title>` and og/twitter title: `Hold 225 | Holy Smokes BBQ Co`
- Description (meta, og, twitter): `A 75 second pit game. Keep the needle in the band with one tap that feeds the fire. Wind and an open lid pull the heat down, a flare pushes it up.`
- Skip link: `Skip to the content`
- Nav: `HOME`, `FROM THE PIT`, `EPISODES`, `ABOUT`, `THE APPS`
- h1: `HOLD 225`
- Lede: `Keep the pit needle in the band for a 75 second cook. One tap feeds the fire.`
- No-JS line inside the mount: `The game runs in your browser and needs JavaScript turned on.`
- Band h2: `HOW IT PLAYS`
- Paragraphs: `A tap feeds the fire after a short lag, so tap a beat before the needle leaves the band.` / `Wind and an open lid pull the heat down. A few quick taps bring it back.` / `A flare pushes the heat up. Stop tapping until it passes.` / `The band tightens as the cook goes on, and a long stretch in band is worth more.` / `The cook ends at 1:15, or sooner if the fire goes out or the pit runs too hot.`
- Notes: `Your best score is kept on this device.` / `The temperatures here are game numbers, not a cooking guide.`
- Footer: copied from about.html unchanged (`It's just a match.`, `STRIKER`, `Catering clients:`, `sign in to your quotes`, `Privacy`, `Accessibility`, `Changelog`, `Delete account`, `Analytics choices`, `© 2026 Holy Smokes BBQ Co`).

Widget header: `SCORE`, `TIME`, `BEST`; streak label `x1`, `x2`, `x3`; time `1:15` counting down.

Canvas: `Pit gauge` (aria-label); temperature as an integer; state words `GET IT TO 225`, `IN BAND`, `LOW`, `HIGH`, `WIND`, `LID`, `LID SHUT`, `FLARE`, `FIRE GOING OUT`, `TOO HOT`.

Controls: `FEED THE FIRE`; hint `Tap the gauge or press Space to feed the fire. Escape pauses.`

Start card: `Keep the needle in the band. The cook is 1:15.` / `START THE COOK`

Pause card: `Paused.` / `RESUME` / `Or tap the gauge to resume.`

End card: titles `COOK'S DONE`, `FIRE WENT OUT`, `PIT RAN TOO HOT`; time line `Ended at 0:48 of 1:15.`; breakdown labels `IN BAND`, `TIGHT`, `FINISH`; best `Best on this device: 1,240` / `New best on this device.`; buttons `PLAY AGAIN`, `COPY SCORE`, `COPIED`, `COPY FAILED`; apps line `Scorecard, Notebook and Board, plus the Calculator on the web.`

Cause line templates: `The wind took it at 0:48.` / `The open lid took it at 0:48.` / `It ran hot after the lid shut at 0:40.` / `The flare took it at 0:52.` / `No knock was on at 0:31.` / `First tap came 1.1 seconds after the warning.` / `No tap came after the warning.` / `Last tap was 2.4 seconds before the end.` / `No taps this run.` / `3 taps after the warning.` / `1 tap after the warning.` / `No taps after the warning.` / `3 taps after the lid shut.` / `1 tap after the lid shut.` / `No taps after the lid shut.` / `4 taps in the last 3 seconds.` / `1 tap in the last 3 seconds.` / `No taps in the last 3 seconds.` / `Never left the band.` / `Costliest knock: the lid, 9 seconds out of band.` / `Out of band 6 seconds, none of it on a knock.`

Knock line templates: `Held all 7 knocks.` / `Held the one knock.` / `Held 5 of 7 knocks. Weakest: lid, 1 of 3.` / `Held 0 of 1 knock.`

Clipboard line: `Hold 225: 1,240 points. holysmokesbbqco.com/game`

Live region: `Cook is on. Feed the fire.` / `In band.` / `Wind.` / `Lid open.` / `Lid shut.` / `Flare.` / `Streak times two.` / `Streak times three.` / `Fire going out.` / `Too hot.` / `Paused.` / `Resumed.` / `Cook's done. 1,240 points.` / `Fire went out at 0:48. 412 points.` / `Pit ran too hot at 0:52. 390 points.` / `New best on this device.` / `Score copied.` / `Copy failed.`

Description paragraph: `Not started. The needle sits at 205.` / `Needle at 231, in band, 42 seconds left, streak times two.` (variants `low`, `high`, `not yet in band`, `streak times three`, or no streak clause) / `Paused. Needle at 231, 42 seconds left.` / `Over. 1,240 points.`

Fallback: `This browser cannot draw the gauge, so the game will not run here.`

## 14. Testing and acceptance

### 14.1 Headless check (before the canvas is drawn)

Because `makeSim` is pure and the file guards its DOM code, this runs in Node:

```js
globalThis.window = globalThis;
require('./public/pit-game.js');
const { makeSim } = window.HSPitGame;
// free fall facts
let s = makeSim(1); s.state.T = 225; s.state.nextKnockAt = 1e9; s.start();
let edge, rail; while (s.state.phase === 'playing' && s.state.t < 20) { s.step(1/60); if (!edge && s.state.T < 200) edge = s.state.t; if (!rail && s.state.T < 150) rail = s.state.t; }
console.log('band edge', edge.toFixed(2), 'rail', rail.toFixed(2)); // expect about 2.2 and 5.5
// a tap-and-watch first-timer over 300 seeds: tap when T + 0.3 v < 225, wait 0.65 s after each tap, react 0.4 s, hold off on flare and lid shut 40% of the time
```

Acceptance for the headless run: band edge 2.0 to 2.4 s and rail 5.0 to 6.0 s; the same seed produces the same `endedAt` and score twice; a run with `data-seed` set replays identically in the browser; no run ends before 5 s unless the tapper never taps.

### 14.2 In the browser

Local playtest: copy `website/public-landing/game.html` to `dist/game.html` and `public/pit-game.js` to `dist/pit-game.js` (dist is build output, never committed), start the `landing-dist-static` launch config (python http.server on 5179 serving dist/), open `http://localhost:5179/game.html`.

Checklist, at 375 x 667 and at desktop width:

- No horizontal overflow; the canvas is the wrap width; the head cells and end buttons fit.
- Start: focus lands on the canvas; the needle sinks from 205; the first tap lifts it after a visible lag; the state word reads GET IT TO 225 until the first entry, then IN BAND.
- Knocks: each warning shows its word and its shape signal; WIND and LID pull down, FLARE pushes up, LID SHUT climbs on its own; after 60 s a WIND can be followed by a LID 1.2 s later, once at most.
- Fail grace: the rail tick thickens and the word changes for 1.5 s; a burst of taps saves a low run.
- End card: correct title for each of the three results; time line only on early ends; breakdown sums to the score; cause and knock lines read correctly for a wind fail, a lid-shut overshoot, a flare overshoot, a no-knock fail and a full cook; COPY SCORE flips to COPIED (and to COPY FAILED when `navigator.clipboard` is undefined in DevTools).
- Pause: Escape, P, tab switch and window blur each pause; RESUME, Escape, P, backdrop tap and a canvas key each resume without feeding; no dt jump after a 30 s pause.
- Keys: holding Space fires once; Space and ArrowUp on the canvas do not scroll; Space on the page body still scrolls; Enter on FEED THE FIRE feeds once, not twice.
- Touch (Android Chrome): double tap on the gauge does not zoom; long press shows no menu; the page still scrolls when the finger starts outside the canvas.
- Storage: with `localStorage` cleared, BEST is hidden until the first run ends; with storage blocked (DevTools, or a `Storage.prototype.getItem` that throws) the page loads with no console error and BEST tracks the session.
- Reduced motion (DevTools emulation): no smoke, static dashes, instant lid line, no tremor, identical timing.
- Screen reader (NVDA or TalkBack): the gauge announces its description once a second during play; each knock word is spoken; the end result is spoken; the tab order is canvas, FEED THE FIRE, then the card buttons.
- `window.HSPitGame.instances[0].getState()` returns a sane snapshot; two `[data-pit-game]` elements on one test page produce two independent games.
- Console: zero messages at load, during play and at the end.

Site checks the Website session runs: `python ~/.claude/skills/web-design/scripts/sitecheck.py website/public-landing` and, after deploy, `npm run check:deploy`.

## 15. Handoff to the Website session (owner of the files this build must not touch)

1. `scripts/assemble-dist.mjs`: add `'game.html'` to the inner pages loop (`['pit.html', 'episodes.html', 'about.html', 'game.html']`) and `'pit-game.js'` to `sharedAssets` with a comment like the `lightbox.js` one (external because CSP has no `'unsafe-inline'`; bump `?v=` on change). Without both entries the page never deploys (the allowlist trap).
2. Cache: `*.js` is immutable for a year. Every change to `pit-game.js` ships with a bump of `?v=` in `game.html`'s script tag. Note it next to the `site.css?v=` rule in `website/DESIGN.md` section 5 if the team keeps that list there.
3. `public/sitemap.xml`: add `https://holysmokesbbqco.com/game` beside the other inner pages.
4. Nav: this spec ships five links and no `aria-current` on `/game`. Adding a sixth link (GAME) to the site-nav means editing every page plus `.site-nav` spacing at 420 px (six links at 11 px with 0.1em tracking may wrap to two rows). The Website session decides; if yes, add `aria-current="page"` to the new link on `game.html` in the same change.
5. Deploy discipline: deploys cost 15 credits each; batch the game with the next planned deploy, verify locally first, then `npm run check:deploy`.
6. Tuning on a phone: constants in the `C` block at the top of `pit-game.js`; the tuning rule is in section 4.10. Target: a first-timer finishes about one run in three.
7. Changelog: public changelog lists what actually went live; add the game the day it deploys, one line, no forward promises.

## 16. Open calls (not the builder's)

- Website session: the sixth nav link (section 15.4).
- Security auditor: whether the one `localStorage` integer needs a sentence in `privacy.html` (it is not personal data and is written only after the player finishes a run they started; the page already says it is kept on the device) and whether the clipboard write needs any mention. The build does not wait on either; both are copy edits to files this build does not touch.
