# Hold 225: handoff to the Security auditor

**Date:** 2026-10-17
**From:** the Overseer
**To:** the Security auditor, who audits sections 3 to 5 against the two files and then routes section 2 to the Website session for wiring and deploy
**Files under review:** `website/public-landing/game.html` (5,034 bytes) and `public/pit-game.js` (58,029 bytes, `VERSION '1.3.2'`, loaded as `/pit-game.js?v=6`)
**Design spec:** `docs/superpowers/specs/2026-10-17-pit-game-design.md`. The spec still carries several pre-build values (needle start 205, canvas `tabindex="0"`, "kept on this device", `?v=1`). Where the two disagree, this handoff describes what shipped. A docs pass on the spec is owed and is noted in section 6.
**What this workflow did not do:** no git commands, no deploy, no edit to any file other than the two above and the two docs under `docs/superpowers/specs/`. Both game files sit in the working tree as untracked additions. Committing them is the Website session's call once the wiring in section 2 lands in the same commit, so the page cannot exist without its allowlist entries.

---

## 1. What it is

Hold 225 is a 75-second pit game drawn on a canvas in the site's palette. The player presses Start the cook, the needle on a smoker gauge begins to sink, and one tap on the gauge or on the Feed the fire button lifts it after a short lag. The job is to keep the needle inside a band around 225 that narrows from plus or minus 25 to plus or minus 12 between the 20 and 60 second marks while three kinds of knock move it: wind and an open lid pull the heat down, a flare pushes it up, and after a lid shuts the fire climbs on its own for a second. Points accrue per second in band, with a bonus for the tight zone around 225, a streak multiplier that climbs to x3, and a finish bonus for reaching 1:15. The run ends early if the needle sits below 150 or above 300 for more than 1.5 seconds. The end card names the result, breaks the score into In band, Tight and Finish, says which knock cost the most, counts knocks held, and offers Play again and Copy score. The game ships as exactly two files: `website/public-landing/game.html`, served at `/game` through the same Netlify pretty-URL path as `/about` (5,034 bytes, the host page with masthead, lede, mount element, a HOW IT PLAYS band and the Striker footer copied from about.html), and `public/pit-game.js`, served at `/pit-game.js?v=6` (58,029 bytes, a strict-mode IIFE with no dependencies that mounts into every `[data-pit-game]` element and `#pit-game`, injects one `<style id="pit-game-style">`, and keeps one integer in `localStorage`). The script is under the task's 60 KB cap and over the spec's 40 KB target; the growth came from the three review rounds in section 6.

## 2. Wiring for the Website session

The Website session owns every file in this section. Nothing here has been applied. Each diff is against the file as it reads on 2026-10-17.

### 2.1 `scripts/assemble-dist.mjs` (required, or the page never deploys)

Two entries. The inner-pages loop copies the page, and `sharedAssets` copies the script. Without both, the allowlist trap the file's own comments describe swallows the game.

```diff
-// 1b. Inner brand pages (served at /pit, /episodes, /about via Netlify
+// 1b. Inner brand pages (served at /pit, /episodes, /about, /game via Netlify
 //     pretty URLs). Same allowlist trap as everything else here: a page not
 //     named below never deploys.
-for (const page of ['pit.html', 'episodes.html', 'about.html']) {
+for (const page of ['pit.html', 'episodes.html', 'about.html', 'game.html']) {
   const ok = copyIfExists(join(ROOT, 'website', 'public-landing', page), join(DIST, page));
```

```diff
   'site.css',      // shared stylesheet for /, /pit, /episodes, /about; *.css is immutable, so bump ?v= on change
   'lightbox.js',   // /pit gallery dialog; external because CSP script-src has no 'unsafe-inline'; bump ?v= on change
+  'pit-game.js',   // /game Hold 225 widget; external because CSP script-src has no 'unsafe-inline'; bump ?v= on change
   // SEO / verification files
```

Optional cosmetic touch on the `site.css` comment to add `/game` to its page list.

### 2.2 `public/sitemap.xml` (required)

Insert after the `/about` entry. Set `lastmod` to the day the deploy goes live.

```diff
   <url>
     <loc>https://holysmokesbbqco.com/about</loc>
     <lastmod>2026-10-01</lastmod>
     <changefreq>yearly</changefreq>
     <priority>0.7</priority>
   </url>
+  <url>
+    <loc>https://holysmokesbbqco.com/game</loc>
+    <lastmod>2026-10-17</lastmod>
+    <changefreq>monthly</changefreq>
+    <priority>0.7</priority>
+  </url>
   <url>
     <loc>https://holysmokesbbqco.com/scorecard/</loc>
```

### 2.3 The sixth nav link (only if Joel says yes; section 7 recommends yes)

The site-nav on every page carries five links. Adding GAME after THE APPS means one line on each of five pages. `.site-nav` has `flex-wrap: wrap`, so at 420 px and below (11 px, 0.1em tracking) six links may wrap to a second row rather than overflow; check it once at 375 px after the change. Indentation differs by page: index.html uses eight spaces, the others six.

`website/public-landing/index.html` (line 145):

```diff
         <a href="/about">ABOUT</a>
         <a href="/#apps">THE APPS</a>
+        <a href="/game">GAME</a>
       </nav>
```

`website/public-landing/pit.html` (line 34), `website/public-landing/episodes.html` (line 33) and `website/public-landing/about.html` (line 33):

```diff
       <a href="/about">ABOUT</a>
       <a href="/#apps">THE APPS</a>
+      <a href="/game">GAME</a>
     </nav>
```

`website/public-landing/game.html` (line 41), the only page where the new link is the current page:

```diff
       <a href="/about">ABOUT</a>
       <a href="/#apps">THE APPS</a>
+      <a href="/game" aria-current="page">GAME</a>
     </nav>
```

game.html today has no `aria-current` anywhere, by spec decision, because no existing link points at `/game`. If the sixth link is declined, that stays as is and sitecheck should not be read as flagging an omission.

### 2.4 `netlify.toml`: no change

Three reasons, each checkable against the headers block:

1. CSP. The only new resource is `/pit-game.js`, a same-origin script already allowed by `script-src 'self'`. The script makes no request, so `connect-src` is untouched. No new font, image or frame origin.
2. Framing. `frame-ancestors 'none'` and `X-Frame-Options: DENY` stay. Nothing is iframed; "embedded" means a mount element plus the script on a same-origin page (section 2.5).
3. Cache. `*.js` is served `immutable` for a year. The page references `/pit-game.js?v=6` and every change to the script ships with a `?v=` bump in game.html's script tag, so no `no-cache` override like the one for `/gtm-init.js` is wanted. The file's own header comment states the rule.

### 2.5 Embedding the game on any other site page

The script mounts into every element matching `[data-pit-game]` plus `#pit-game` at `DOMContentLoaded`, skips any element already carrying `data-pit-game-mounted`, and exposes `window.HSPitGame.mountAll()` for a mount added after load. One script tag per page.

```html
<div data-pit-game>
  <p>The game runs in your browser and needs JavaScript turned on.</p>
</div>
<script src="/pit-game.js?v=6" defer></script>
```

Two things a host page must bring itself. First, the disclosure sentence: the start card no longer carries the two fine-print lines (review round 3 removed them as duplicates of the page copy), so any page that mounts the game must print `Your best score is kept in this browser.` and `The temperatures here are game numbers, not a cooking guide.` near the mount, as game.html does in its HOW IT PLAYS band. Second, width: the widget caps itself at 560 px, and below about 84 px the gauge stops shrinking (its radius floors at 40 px) and overflows its container rather than throwing, so give it a normal content column.

### 2.6 Deploy and verification

Deploys cost 15 credits each and October is already over budget, so batch the game with the next planned production deploy. Before it, copy `website/public-landing/game.html` to `dist/game.html` and `public/pit-game.js` to `dist/pit-game.js`, serve `dist/` with the `landing-dist-static` launch config, and open `http://localhost:5179/game.html`. Run `python ~/.claude/skills/web-design/scripts/sitecheck.py website/public-landing` before the deploy and `npm run check:deploy` after it. Add the one-line changelog entry on the page the footer links (`/changelog.html`) the day the deploy is live, no forward promises. The spec also suggests a note beside the `site.css?v=` rule in `website/DESIGN.md` section 5 so the `?v=` discipline for `pit-game.js` is written where the team already keeps it.

## 3. Security statement for the auditor

Line numbers refer to `public/pit-game.js` at 58,029 bytes (`VERSION '1.3.2'`).

**CSP compliance.** game.html has zero inline `<script>` bodies, zero `on*=` attributes and zero `javascript:` URLs (grep in the final round returned only the two external script tags at lines 30 and 31: `/gtm-init.js?v=8`, the site-wide loader every page carries, and `/pit-game.js?v=6`). Both are same-origin and covered by `script-src 'self'`. The page-local `<style>` (game.html lines 23 to 29) and the injected `<style id="pit-game-style">` (pit-game.js lines 435 to 439) are covered by `style-src 'unsafe-inline'`; the injected CSS is assembled from string constants only (lines 377 to 431). No external resource of any kind: fonts come through `/site.css?v=4` and `/fonts/*.woff2`, the og image is `/photos/g-fire-logs-1440.jpg` on the same origin (the one pit.html already uses), no CDN.

**No network.** `grep -nE "fetch\(|XMLHttpRequest|sendBeacon|WebSocket|new Image|importScripts" public/pit-game.js` returns nothing. The playtest's resource list for a full page load was game.html, site.css, gtm-init.js, pit-game.js, four woff2 files, striker-dry-figure.svg, and the gtag.js request issued by gtm-init.js. pit-game.js issued none.

**No eval, no innerHTML.** `grep -nE "innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|console\.|setInterval|document\.cookie|sessionStorage|indexedDB" public/pit-game.js` returns nothing. All DOM is built with `createElement`, `createTextNode` and `textContent`. The only attribute read from the host markup is `data-seed` (line 465), checked against `/^-?\d+$/` and then `parseInt`, used only as the RNG seed. There are no inputs, no URL parameters read, no untrusted strings.

**Storage.** One key, `C.STORAGE_KEY = 'hs.pitgame.best'` (line 58). Read once at mount by `readBest()` (lines 448 to 454): `getItem` inside try/catch, accepted only if it matches `/^\d{1,7}$/`, otherwise `null` and the BEST cell stays hidden. Written by `writeBest()` (lines 455 to 457): `setItem` inside try/catch, called only when a finished run's total is greater than zero and strictly higher than the larger of the in-memory best and a fresh re-read of the stored value (round 3 added the re-read so a stale tab cannot overwrite a higher best). No cookies, no sessionStorage, no IndexedDB, no timestamps, no run history, no device data. With `window.localStorage` replaced by a throwing getter the page mounted, played, and logged nothing (playtest 2).

**Clipboard.** Write only. `navigator.clipboard.writeText` appears on lines 741 and 742 inside `copyScore()`, reached only from the Copy score button's click handler on the end card. The text is the fixed line `Hold 225: <score> points. holysmokesbbqco.com/game`. No read. Failure (API absent, promise rejected, unfocused document) degrades to the label Copy failed and the live message Copy failed. for two seconds.

**No cookies, no analytics in the game, no UGC, no name entry, no leaderboard, no third parties.** The game code calls nothing outside the page. The site's `gtm-init.js` runs on game.html as on every page under Consent Mode and is not the game's concern; the game adds no events. If Marketing later wants a "played" event, that is a separate change through the auditor (spec 12.7).

**Global.** `window.HSPitGame = { version, instances, makeSim, mountAll }` (line 1285). `mountAll` was added in round 2 so a host can rebuild a torn-down mount; the spec's item 12.6 lists only the first three. Nothing else is written to `window`.

**Console.** Zero output of any kind from pit-game.js across about 20 runs in two playtests, including a load with storage throwing. The only console errors on the page are gtag.js load failures issued by gtm-init.js (section 6.4).

### 3.1 Every line that touches localStorage, the clipboard or a window API

Storage

- 450: `window.localStorage.getItem(C.STORAGE_KEY)` inside the `readBest` try block
- 456: `window.localStorage.setItem(C.STORAGE_KEY, String(n))` inside the `writeBest` try block

Clipboard

- 741: feature test `navigator.clipboard && typeof navigator.clipboard.writeText === 'function'`
- 742: `navigator.clipboard.writeText(text).then(...)` with success and failure callbacks

Clock and seed

- 76: `performance.now()` with `Date.now()` fallback in `nowMs()`
- 95: `Date.now() >>> 0` as the default seed inside `makeSim` when none is passed
- 762: `Date.now() >>> 0` as the seed for a run when the mount has no `data-seed`

Timers (all cleared at teardown)

- 547: `setTimeout` inside `later()`, the tracked timer helper
- 567, 568, 569: `clearTimeout` for the two live-region timers and every tracked timer
- 600: `setTimeout(flushLive, wait)` for the live-region gap
- 611, 612: `clearTimeout` then a 30 ms `setTimeout` for the clear-then-set re-announce

Animation frame and pixel ratio

- 566, 783, 869: `cancelAnimationFrame`
- 868, 890: `requestAnimationFrame(tick)` (the loop runs only while playing)
- 880: `window.devicePixelRatio` compared to the cached ratio every playing frame
- 1104: `window.devicePixelRatio` read in `resize()`
- 1123: `window.matchMedia('(resolution: Ndppx)')` to catch zoom while the loop is stopped
- 1244: `requestAnimationFrame(onResize)` from the ResizeObserver callback

Media queries and observers

- 556, 557: `mqOn` / `mqOff` add and remove `change` listeners on a MediaQueryList
- 1232: `window.matchMedia('(prefers-reduced-motion: reduce)')`
- 1239 to 1244: `new ResizeObserver(...)` observing the widget root

Document and window listeners

- 571 to 574: `removeEventListener` for document `keydown`, document `visibilitychange`, window `blur`, window `resize` in teardown
- 1235 to 1238: `addEventListener` for the same four
- 1222: `document.hidden` in `onVis` (pause when hidden, resize when shown)
- 780, 781, 1208: `document.activeElement` for the focus-inside checks that gate P, R and Escape resume
- 661: `click` listener on each overlay button
- 1157, 1158: `pointerdown` on the canvas, or `mousedown` where `window.PointerEvent` is absent
- 1159 to 1162: `touchstart` on the canvas with `{ passive: false }` and `preventDefault`
- 1163: `contextmenu` on the canvas with `preventDefault`
- 1164: `keydown` on the canvas (Space, Enter, ArrowUp, F)
- 1166 to 1172: `pointerdown`, `pointerup`, `pointerleave`, `pointercancel` on Feed the fire
- 1174, 1178, 1179, 1186: `click`, `blur`, `keydown`, `keyup` on Feed the fire
- 1189: `click` on Pause
- 1190: `pointerdown` on the pause overlay (tap anywhere on the card to resume)
- 1256, 1257: `document.fonts.ready.then(draw)`
- 1286, 1287: `document.readyState` and `DOMContentLoaded` to schedule `mountAll`

DOM construction and focus

- 435 to 439: `document.getElementById(STYLE_ID)`, `document.createElement('style')`, append to `document.head`
- 442: `document.createElement` in `el()`
- 465: `mount.getAttribute('data-seed')`
- 560: `mount.isConnected`, or `document.body.contains(mount)` as fallback
- 722 to 725: `document.createTextNode` for the apps lines
- 747: `node.focus({ preventScroll: true })` with a bare `focus()` fallback in `focusEl`
- 1273, 1274: `document.querySelectorAll('[data-pit-game]')` and `document.getElementById('pit-game')` in `mountAll`
- 1285: `G.HSPitGame = API`

## 4. Privacy and legal statement

**The single storage key, under GDPR and ePrivacy.** `hs.pitgame.best` holds one integer, the player's best score in this browser. It is written only after the player has started and finished a run, which is the service the player asked for, and it is read only to show the BEST cell and the "New best in this browser." line. It carries no identifier, no timestamp and no device data, nothing reads it server-side, and nothing transmits it. On the ePrivacy side (Article 5(3), storage of information on terminal equipment), this is storage strictly necessary to provide a feature the user explicitly requested: remembering a game score is the user-expected function of a game page and has no other purpose, which is the functional exemption the Article 29 Working Party's Opinion 04/2012 describes and national regulators apply, so no consent prompt is required. On the GDPR side, a lone integer with no link to a person is not personal data in our hands (Article 4(1)); it never leaves the device, so there is no processing by Holy Smokes to find a legal basis for. The transparency duty is met on the page itself in plain words (next paragraph). This reasoning holds only while the key stays a single integer with no server read and no event tied to it; any later "played" analytics event is a separate change through the auditor.

**COPPA posture: unchanged.** No age gate, no form, no name entry, no collection of any kind from the game. The page is general audience BBQ content. With nothing collected, no notice or consent obligation arises whether or not a child plays. This matches the legal register of 2026-10-14.

**The disclosure sentence on the page.** game.html line 64, in the HOW IT PLAYS band: `Your best score is kept in this browser.` The widget's own strings match it: `New best in this browser.` and `Best in this browser: 1,829` on the end card and the live-region line. The wording changed from "on this device" to "in this browser" in round 3 because localStorage is per browser profile, not per device; the spec still carries the older phrase. The second note on line 65, `The temperatures here are game numbers, not a cooking guide.`, keeps the page clear of any cooking recommendation.

**Does the live privacy policy need a line?** `public/privacy.html` says it covers "the pages of holysmokesbbqco.com" and lists no browser storage set by any page. Recommendation: yes, a single sentence, for the Website session to add the next time the policy is touched, not a deploy on its own. Suggested placement is a short paragraph in WHAT WE COLLECT AND WHY after the analytics paragraph, or a sentence in WHAT WE DON'T DO. Suggested text: `The game at holysmokesbbqco.com/game keeps your best score as one number in your browser's local storage. It is not sent to us or anyone else, is not linked to an account, and goes away when you clear this site's data.` Do not edit the policy in this workflow; it belongs to the Website session and the two review rounds that raised this point both routed it there. Two rounds also asked whether the clipboard write needs a mention: no, the write is user-initiated, writes a fixed string the player can see, and reads nothing.

## 5. Accessibility statement

**Keyboard map.** From the top of the page, seven Tabs reach Start the cook (skip link, five nav links, the button). Enter or Space starts the cook and moves focus to Feed the fire. On Feed the fire: Space feeds on keydown (the activation click on keyup is swallowed by a press flag), Enter feeds once through the native click, ArrowUp and F feed on keydown, and a held key never auto-repeats (`e.repeat` is ignored). Tab from Feed the fire reaches Pause, which Enter toggles (label Pause while playing, Resume while paused). The canvas is `tabindex="-1"`: out of the Tab order, but a tap focuses it so Space, Enter, ArrowUp and F keep feeding after a pointer run. Escape pauses from anywhere on the page and toggles only while focus is inside the widget, so an Escape pressed on a footer link or the consent dialog pauses a running game but never resumes it or steals focus. P toggles pause and R restarts from the end card, both only while focus is inside the widget (WCAG 2.1.4). Events with ctrl, meta or alt, and events whose target is an input, textarea, select or contentEditable, are ignored. Space and ArrowUp call `preventDefault` so the page does not scroll; Space on the page body still scrolls.

**Focus management.** Start and resume focus Feed the fire. Pause focuses Resume only when focus was already inside the widget (or on body); a pause caused by an outside Escape or a window blur leaves focus where it was (WCAG 3.2.1). The end card focuses Play again, which is dimmed with a `pg-arming` class for 300 ms so a carried-over Space mash is swallowed by the start guard instead of restarting before the card is read; the button is never `disabled` during that window because a disabled button cannot hold focus.

**Live region.** `<div class="pg-sr pg-live" aria-live="polite" aria-atomic="true">`. One message per 0.3 s (`LIVE_GAP`), latest pending wins, nothing older than 2 s is spoken, the same phrase inside 2 s is dropped (a rail fight otherwise re-fires Fire going out. several times a second), and each message is cleared then set after 30 ms so a repeated word re-announces. Messages: Cook is on. Feed the fire. / In band. (only for a run that opens out of band) / Wind. / Lid open. / Lid shut. / Flare. / Streak times two. / Streak times three. / Fire going out. / Too hot. / Paused. / Resumed. / Cook's done. N points. / Fire went out at m:ss. N points. / Pit ran too hot at m:ss. N points. / New best in this browser. / Score copied. / Copy failed. Round playtest-2 fixed the start cue, which the first-frame In band. event had been overwriting; the pane now reads Cook is on. Feed the fire. 300 ms after Start and nothing else in the first 1.8 s.

**Text alternative.** The canvas has `role="img"`, `aria-label="Pit gauge"` and `aria-describedby` pointing at a visually hidden paragraph (`id="pg-desc-N"`) that the Feed the fire button also describes. The paragraph is rewritten at most once a second and never carries knock words: `Not started. The needle sits at 215.` / `Needle at 231, in band, 42 seconds left, streak times two.` (variants low, high, not yet in band, streak times three, or no streak clause; "1 second left" singular) / `Paused. Needle at 231, 42 seconds left.` / `Over. 1,240 points.` After Resume the paragraph is refreshed before focus lands so it never reads Paused. on a running game.

**Targets.** Every button is `min-height: 48px` (measured at 375 px: Start the cook 148 x 48, Feed the fire 233 x 48, Pause 75 x 48, Play again and Copy score 48 tall). The two apps links on the end card sit one per line as 44 px tall inline-flex boxes so they cannot overlap when the card wraps. Site nav links are 44 px (site.css). The canvas is at least 260 px tall. `touch-action: manipulation` on every widget button removes the double-tap delay; `touch-action: none` on the canvas only.

**Visible focus.** `outline: 2px solid #E6D8B8; outline-offset: 2px` on `:focus-visible` for the canvas, every `.pg-btn` and the apps links (line 390). Cream on the page background measures 12.62:1.

**Reduced motion.** `prefers-reduced-motion: reduce` is read at mount and on change (lines 1232 to 1234, handler at 1224). Under it: no smoke (not stepped, not drawn, array emptied on change), wind dashes sit static instead of sliding, the lid line snaps instead of easing, no needle tremor, no button transition or `:active` translate (line 431). The fed pulse on the pivot disc stays because it is input feedback, not decoration. Timing and rules are identical. Verified by code reading in the Browser pane and by headless Chrome emulation (`matchMedia` true, Feed button `transition-property: none`, a run played normally). Not verified at OS level on a device.

**Color never the only signal.** Needle head orange in band, muted outside, paired with the state word IN BAND, LOW or HIGH. Each knock pairs its word with a shape change: WIND with three dashes, LID with the lid line lifting, FLARE with the ember row brightening. The fail grace pairs a thick orange rail tick with FIRE GOING OUT or TOO HOT. The streak pairs color with the text x1, x2, x3. The tight zone is drawn as its own arc with a center tick.

**Contrast pairs, measured today (WCAG relative luminance).** Cream #E6D8B8 on background #1b1714: 12.62:1. Cream on panel #2a2015: 11.31:1. Muted #bfb39a on background: 8.59:1. Muted on panel: 7.70:1 (DESIGN.md's figures of 11:1 and 7.7:1 agree). Button text #1b1714 on orange #D06129 (16 px Burnt Ends Solid): 4.60:1, AA for normal text; on hover #e0803f: 6.21:1. Orange is never used as text inside the widget: it fills the needle head, the fed pivot disc, the ember row, the grace rail tick and the link underline only. Band arc, cream at 0.45 alpha over the hairline track: about 3.06:1 against the track and 3.93:1 against the panel (non-text, 1.4.11 needs 3:1; round 1 raised it from 0.18 alpha, which measured 1.59:1). Orange marks on the panel: 4.12:1 (non-text). The end-card apps links keep cream on hover because orange at 15 px on the panel (4.12:1) would fail AA for small text.

**375 px.** `documentElement.scrollWidth` 375 equals `innerWidth`, no element past the right edge, canvas 335 x 260 CSS with a 2x or 3x backing store, head cells shrink with `min-width: 0`, end buttons wrap, the end card grows the grid stage (measured 465 to 560 px card inside a stage that grows to fit) instead of scrolling inside a 260 px box.

**Pause on hide.** document `visibilitychange` to hidden pauses, window `blur` pauses, return to visible re-checks the pixel ratio. Headless Chrome's lifecycle freeze then activate left the game paused.

**Not done.** No screen reader run (NVDA or TalkBack); the live region and description texts were verified in the DOM only, and the clear-then-set re-announce trick is untested with a reader.

## 6. Evidence

### 6.1 Build

Two files created, nothing else edited. First build: pit-game.js 46,709 bytes at `?v=1`; `node --check` clean. Headless check in Node (`globalThis.window = globalThis; require(...)`): the spec's free-fall check gave a band edge at 2.23 s and the rail at 5.47 s (spec windows 2.0 to 2.4 and 5.0 to 6.0); after round 3 moved the start to 215, a no-input run from the start position leaves the band at 1.55 s, reaches the rail at 4.78 s and ends at 6.28 s; one tap lifted the needle 12.7 degrees within a second and 19.2 in all; the same seed replayed identically; no run of 300 ended before 5 s; `step(5)` clamped to 0.05 s; no knock kind repeated back to back across 532 knocks; every cause-line and knock-line template was produced by a scripted scenario. One bug found and fixed during the first playtest: the delta clock was re-armed every frame so the sim stepped with dt 0 in the browser; fixed before review. Browser check at the time: 375 px without overflow, the end card summing correctly, storage written, teardown clean. `sitecheck.py` over `website/public-landing`: 15 files, 0 HIGH, 0 MED, 0 LOW. That sitecheck run predates the review rounds; the Website session reruns it as part of section 2.6.

### 6.2 Review rounds

| Round | Found | Verified | Lows | Applied | Bytes after | `?v=` / VERSION after |
|---|---|---|---|---|---|---|
| 1 | 33 | 11 | 19 | 30 listed: 27 fixed, 3 skipped | 51,934 | v=2 / 1.1.0 |
| 2 | 31 | 7 | 21 | 28 listed: 20 fixed, 7 skipped, 1 no change | 55,368 | v=3 / 1.2.0 |
| 3 | 24 | 5 | 17 | 22 listed: 18 fixed, 4 skipped | 57,209 | v=4 / 1.3.0 |
| playtest-1 | 4 findings + 1 console | | | 1 fixed, 1 skipped, 3 no change | 57,650 | v=5 / 1.3.1 |
| playtest-2 | 3 findings + 3 console | | | 1 fixed, 1 skipped, 4 no change | 58,029 | v=6 / 1.3.2 |

Every round ended with `node --check` clean, zero U+2013 and U+2014 in both files, zero inline script and zero `on*=` handlers in game.html, and the canon palette untouched.

What the fixes were, grouped. Input: Feed the fire feeds on pointerdown rather than click, with a press flag so Space held long or a slow touch click cannot double-feed and a stale press cannot swallow the next Enter; secondary fingers count (two-thumb tapping); the pause card resumes on a tap anywhere; a visible Pause button for pointer players; a fed pulse on the pivot so the lag reads as registered; Play again arms for 300 ms. Physics and fairness: needle start moved 205 to 198 to 215 (the shipped 215 opens in band so the first seconds are not scoreless); a full cook no longer counts a still-open knock as missed (1,000 of 1,000 pinned-perfect seeds read Held all N knocks.); late flares retuned so a player who correctly stops tapping is not thrown out (FLARE_WARN 0.9, FLARE_KICK 10, FLARE_GRAVITY 6, BAND_TIGHT 12, KICK_SCALE_MAX 1.15); the wind-then-lid pair is armed only when the lid can land before the cook ends (5,000 forced-pair full cooks, 3,238 pairs armed, 0 late lids); no knock starts within its warning of 75 s. Accessibility: single-letter shortcuts scoped to widget focus; Escape resumes only from inside; pause never pulls focus in from outside; canvas out of the Tab order with focus on the Feed button; the end card title is an `h2`; the description is refreshed before focus on resume; the live-region gap shortened to 0.3 s and same-phrase repeats dropped; the start cue no longer overwritten; apps links one per line at 44 px; band arc contrast raised to about 3:1; TIGHT zone drawn. Layout and brand: ResizeObserver no longer resizes inside its own callback (window error list stayed empty); DPR re-read on zoom, monitor move and tab return; end card grows the stage rather than nesting a scroller; THE APPS cream band removed (its cream-on-cream focus ring and unchecked copy went with it); 8/12/16/24 spacing; 44 px score in Burnt Ends Inline; sentence-case DOM strings; radius floor so a narrow embed cannot throw. Storage: a zero score never writes or claims a new best; a stale in-memory best cannot overwrite a higher stored one. Teardown: dead instances leave `HSPitGame.instances`, all timers tracked and cleared, `destroy()` exposed, buttons disabled and the mount emptied.

What was skipped and why. Thirteen items across the five rounds were docs-only spec drift (constants, `?v=`, `tabindex`, copy) and this workflow may not edit the spec; the shipped values are recorded in this handoff. Two items asked for a sentence in `public/privacy.html`, which belongs to the Website session (section 4). One item, the first band repeating the masthead surface where every other inner page changes surface under the masthead, is a brand call for Joel (section 7). One item was judged no change needed: the needle start stays at 215 in code with the spec to follow.

### 6.3 Playtests

Both playtests served `dist/` copies of the two files over the `landing-dist-static` config at `http://localhost:5179/game.html`. Both reported `desktopPlayable`, `keyboardPlayable`, `mobilePlayable`, `noHorizontalOverflowAt375`, `bestScorePersists` and `pauseOnHideWorks` true, and `reducedMotionChecked` true by code reading plus (in the second) headless emulation. Neither touched a file outside `dist/` and scratch.

Playtest 1 (pit-game.js 57,209, VERSION 1.3.0). The Browser pane stayed hidden, so `requestAnimationFrame` delivered about 2 frames per second and a real-time cook was impossible by tool clicks; the game handled starvation correctly (dt clamped at 0.05 s, slow motion rather than a jump). The tester installed two disclosed console shims, a MessageChannel rAF pump at 60 Hz calling the game's own tick and a scripted tapper dispatching real PointerEvent and KeyboardEvent input at no more than about 1.5 taps per second; the game code was not edited, and every control was also exercised by genuine tool clicks and key presses. Results: desktop mouse full cook COOK'S DONE 2,571 = In band 1,744 + Tight 577 + Finish 250, cause Costliest knock: the lid, 3 seconds out of band., Held 8 of 10 knocks. Weakest: lid, 2 of 4., New best in this browser., storage `hs.pitgame.best` = "2571" as the only key; untouched run FIRE WENT OUT at 0:06 with 15 points and No knock was on at 0:04. No taps this run.; Escape paused at t 12.27 with no clock movement over 3 s and Enter on Resume resumed with no dt jump; P and R worked; Copy score fell to Copy failed because the hidden pane's document was unfocused (the failure branch, exercised as specified). Keyboard-only run after reload: Best 2,571 shown immediately, seven Tabs to Start, Space and ArrowUp fed without scrolling, Escape paused and resumed. Mobile preset 375 x 812 at dpr 2: scrollWidth 375, canvas 335 x 260 with a 670 x 520 bitmap, 48 px buttons, 44 px nav links; Escape with focus on the HOME link paused and left focus on HOME; a tap on the pause card resumed without feeding; the end card (286 px wide, 560 px tall) grew the stage to 584 px with nothing clipped. Four low findings: DPR not re-read on an emulated zoom (fixed in playtest-1 round), Copy failed when unfocused (expected, no change), spec wording drift (docs), no `aria-current` on game.html (by design).

Playtest 2 (pit-game.js 57,650, VERSION 1.3.1). The pane was still starved, so the tester wrote a scratchpad CDP driver that launched the installed Chrome in `--headless=new` against the same URL, dispatched real mouse, key and touch events, polled `HSPitGame.instances[0].getState()` every 70 ms, and recorded console and network. Headless rAF ran at 128 to 133 fps. Results: desktop 1280 x 900 at dpr 1.25 full cook COOK'S DONE 1,684 = 1,316 + 118 + 250 with live messages In band, Streak times two, Wind, Streak times three, Flare, Lid open, Lid shut, Cook's done; a first run of 1,829 wrote `hs.pitgame.best` = "1829" and showed New best in this browser.; a no-tap run ended at 6.28 s with 15 points and the best stayed 1829; Copy score read Copied with live Score copied. (the success branch, confirmed here). Storage: after reload the only key was `hs.pitgame.best` and the BEST cell showed 1,829; with `window.localStorage` replaced by a throwing getter the game mounted, hid BEST, played, and raised no console error. Keyboard-only: seven Tabs to Start, Space fed 11 times in 9 s, Escape paused with t frozen at 9.3336 across 1.2 s, Escape resumed, P both ways, Tab to Pause and Enter both ways, a full cook of 1,074 points by Space, R restarted. Mobile emulation 375 x 812 at dpr 3 with touch: scrollWidth 375, canvas 335 x 260 with a 1005 x 780 bitmap, targets as in section 5, 21 touch taps held 213 to 245, Pause tap and gauge tap worked, full cook 1,503, end card 527 px inside a 551 px stage, no clipping. Reduced motion emulated: `matchMedia` true, button transition none, a run played. Lifecycle freeze then activate: paused. Teardown: removing `#pit-game` and firing a keydown took instances from 1 to 0 with no errors. Copy and brand spot check: no em dashes, no banned words, Striker only in the footer, header and masthead matching about.html. Three low findings: the start announcement overwritten (fixed in playtest-2 round, re-verified in the pane), spec drift (docs), gtag.js load error from gtm-init.js (environment, see 6.4).

### 6.4 Console state

Zero console output from pit-game.js in both playtests, including with storage throwing. The only console errors on game.html are `Failed to load resource` for `https://www.googletagmanager.com/gtag/js?id=G-7X235L8GQS`: `net::ERR_ADDRESS_INVALID` in the Claude Browser pane and in the user's real Chrome (one per page load, 7 and 8 entries across the two sessions), `net::ERR_NAME_NOT_RESOLVED` in headless Chrome. The request is issued by `/gtm-init.js?v=8`, the shared analytics loader at game.html line 30 (about.html line 23 carries the same include and shows the same error). pit-game.js issues no request. googletagmanager.com appears unreachable on this workstation, so the landing group's GA4 tag for `/game` cannot be verified locally; the Website session should verify it on the deployed site through the auditor's usual route.

### 6.5 Known gaps carried from the build

Reduced motion at OS level, the clipboard success path on a phone, a screen reader run, a real touch screen (double-tap zoom, long press, a scroll that starts outside the canvas), window blur through a real window switch, a real browser zoom (the DPR finding may be an emulation artifact; the belt-and-braces fix is in), the x2 and x3 labels and knock visuals in screenshots (logic verified headless, draw code reviewed), and the physics tuning target (a first-timer finishes about one run in three) which needs a person on a phone. Per spec 4.5 a knock still open when the cook ends was counted as not held; round 1 changed that so a full cook never marks a held knock as missed. When the fire goes out after a wind window has already closed the card reads No knock was on, per the spec's window rule; worth watching on the phone.

### 6.6 Docs debt (Overseer, not Joel)

The design spec should be brought to the shipped values in one pass: `T_START 215`, canvas `tabindex="-1"` with focus on Feed the fire, "in this browser" wording, the current hint line (`Tap the gauge or press Space on Feed the fire. Escape or the Pause button pauses.`), "75-second" in the meta and lede, the grid-overlay layout, the Pause button, `mountAll` on the global, the round 2 and 3 constants (`BAND_TIGHT 12`, `KICK_SCALE_MAX 1.15`, `FLARE_WARN 0.9`, `FLARE_KICK 10`, `FLARE_GRAVITY 6`, `FED_LEN`, `FEED_RELEASE_MS 80`, `END_ARM_MS 300`), the start card without fine print, the two-line apps sentence, `LIVE_GAP 0.3`, the in-band event suppressed for an in-band opener, the 60 KB size cap, and `?v=6`.

## 7. Open items for Joel

1. **The sixth nav link.** GAME after THE APPS on all five pages. Recommendation: yes. It is one line per page, the nav already wraps at phone width, and without it the page is reachable only by URL and sitemap. Yes or no is all that is needed; the diffs are in 2.3.
2. **A homepage card.** Recommendation: not yet. Let the nav link carry it until the phone tuning pass says the game is fun for a first-timer, then decide whether it earns a card beside the BBQ Meat Calculator on index.html.
3. **The phone playtest.** The tuning target (a first-timer finishes about one run in three) was measured only by scripted bots and headless runs. Someone needs to play it on an Android phone and report: does a first run feel winnable, does double-tap on the gauge zoom, does a long press open a menu, does a scroll that starts outside the gauge still scroll, does two-thumb tapping register every tap, and does Copy score read Copied.
4. **Reduced motion on a real device.** Turn on the OS setting and confirm the gauge still plays with no smoke, static dashes and no tremor. Verified by emulation only.
5. **Screen reader.** One pass with TalkBack on the phone, or NVDA on the desktop, to confirm the gauge description reads once a second during play, each knock word is spoken, and the start cue comes first.
6. **The first band's surface.** Every other inner page changes surface under the masthead; game.html's first band repeats it. A reviewer flagged the pattern and left it as a brand call. Recommendation: leave it, the gauge panel itself is the surface change.
7. **The privacy policy sentence** in section 4 is routed to the Website session through the auditor and does not need Joel unless he wants different wording.

---

## Auditor checklist (yes or no)

1. game.html has zero inline `<script>` bodies, zero `on*=` attributes and zero `javascript:` URLs, and its only script tags are `/gtm-init.js?v=8` and `/pit-game.js?v=6`, both same-origin.
2. `grep -nE "fetch\(|XMLHttpRequest|sendBeacon|WebSocket|new Image|importScripts|innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|console\.|setInterval|document\.cookie|sessionStorage|indexedDB" public/pit-game.js` returns nothing.
3. `localStorage` appears on exactly two lines of pit-game.js (450 getItem, 456 setItem), both inside try/catch, both on the key `hs.pitgame.best`, with the read gated by `/^\d{1,7}$/` and the write gated by a strictly higher non-zero total.
4. `navigator.clipboard` appears only on lines 741 and 742, `writeText` only, reachable only from the Copy score click, writing the fixed line `Hold 225: <score> points. holysmokesbbqco.com/game`.
5. game.html line 64 reads `Your best score is kept in this browser.` and the widget's best-score strings say "in this browser".
6. netlify.toml needs no change: no new origin, no `connect-src` use, `frame-ancestors 'none'` and `X-Frame-Options: DENY` intact, cache busting by `?v=` on the script tag.
7. The privacy policy sentence is routed to the Website session as a non-blocking addition for the next time the policy is touched, and nothing in this workflow edited `public/privacy.html`.
8. The Website session's wiring list is complete and exact: two `assemble-dist.mjs` entries, one sitemap entry, the nav decision with `aria-current` on game.html if yes, the `?v=` bump rule, batched deploy, then `npm run check:deploy` and `sitecheck.py`.
