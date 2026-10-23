# Analytics audit: holysmokesbbqco.com, app-download and episode clicks (2026-10-23)

Run of the `analytics` skill (Corey Haines marketingskills pack) for the
website at holysmokesbbqco.com. Goal named by Marketing: a tracking plan for
app-download clicks (Play and App Store badges, and the web-app links in THE
APPS grid) and episode clicks (YouTube stills and links on /episodes, and the
homepage EPISODES card), feeding the weekly brief.

Plan only. Nothing here is implemented, deployed or committed. Every change
below goes through the Security auditor and ships only on Joel's yes.

Why a separate file: `analytics-audit-2026-10-23.md` already holds the game
session's Your Pit analytics draft (commit 9602297). Same-day precedent in
this folder is `aso-audit-2026-10-23.md` plus `aso-audit-2026-10-23-board.md`,
so this one carries the `-website` suffix rather than overwriting a sibling's
committed work.

## 1. What was run and how

The skill's steps, in order:

1. **Context check.** None of `.agents/product-marketing.md`,
   `.claude/product-marketing.md` or `product-marketing-context.md` exists.
   The three opening questions (business context, current state, technical
   context) were answered from the repo and the session memory instead.
2. **Current state** from source: `public/gtm-init.js` (read in full),
   `netlify.toml` (CSP, cache headers, edge function),
   `netlify/edge-functions/geo-region.js`, the four landing pages in
   `website/public-landing/` (index, episodes, about, pit), `door.js`,
   `site-fx.js`, `lightbox.js`, `website/tests/gtm-init-consent.test.js`,
   `scripts/public-manifest.txt`, `public/privacy.html`.
3. **Live check with curl:** `/`, `/episodes`, `/about`, `/pit` and
   `/gtm-init.js`. The live `gtm-init.js` is byte-identical to the repo. The
   four live pages match the repo except two footer hrefs the build rewrites
   (`/privacy.html` to `/privacy`, `/accessibility.html` to `/accessibility`).
   All four load `/gtm-init.js?v=8` with `data-ga-group="landing"`.
4. **The apps' own analytics, context only:** `website/src/scoring.js`
   (`track()`, `setGaContext()`, `trackPageView()`), `website/src/analyticsCodes.js`
   and the event inventory across `website/src` (about 60 `track()` names,
   object_action style). No change is proposed to any of them.
5. **Skill references read:** `ga4-implementation.md`, `event-library.md`,
   `gtm-implementation.md`. GTM is not in use here (gtag.js direct), so the
   GTM section applies only as the consent-mode pattern, which the site
   already follows.
6. **No Google console was opened and no browser pane was used.** Anything
   that needs the GA4 Admin screen is listed as a check, not a finding.

## 2. Current state

### Tooling

- **GA4 web tag G-7X235L8GQS** (letter S), property 539744965, "Holy Smokes
  Website" stream. Loaded by `public/gtm-init.js`, which reads the
  measurement ID, page title and content group off its own script tag
  (`data-ga-id`, `data-ga-title`, `data-ga-group`). The four landing pages
  pass `data-ga-group="landing"`.
- **Events the site sends today** (all from gtm-init.js): `page_view` (via
  config), `consent_choice` {choice, content_group}, `exception`
  {description, fatal, source: fixed codes and a bare file name},
  `web_vital` {metric, value}. Nothing else. `door.js`, `site-fx.js` and
  `lightbox.js` send nothing.
- **Enhanced measurement:** the only record is SECURITY-PUNCH-LIST item 30
  (June 6, 2026): "Enhanced Measurement verified ON (all 8 + SPA browser
  history events)" for this property. If still on, GA4 already records an
  outbound `click` event (parameters `link_url`, `link_domain`, `link_id`,
  `link_classes`, `outbound: true`) for every click on a Play, App Store or
  YouTube link, with no code. Confirm in Admin > Data streams > Enhanced
  measurement before building anything in section 5. This matters: it is the
  double-counting risk and also the zero-code baseline.
- **Netlify deploy previews** (`*.netlify.app`) stub `gtag` so previews send
  nothing. Any test of new events has to run on production or in the vm test.

### Consent model (unchanged by this plan)

- Region-scoped Consent Mode v2: `analytics_storage` denied by default for
  the EEA, UK, Switzerland and California; granted by default elsewhere. Ad
  signals denied everywhere.
- Basic consent mode: gtag.js is only appended to the page outside the
  consent regions (absent a stored denial) or inside them after a stored
  grant. Events pushed before the tag loads sit in `dataLayer` and are
  honoured only if a grant follows.
- Banner for `hs_geo=eu` with no stored choice; text: "We use Google
  Analytics to see which pages get used. Say no and everything still works
  the same." Stored as `hs-consent-v1` with `CONSENT_TEXT_VERSION`
  `2026-10-01`. Any wording change bumps the version and re-asks everyone.
- Withdrawal: the "Analytics choices" footer link on every page; a denial
  sets `ga-disable-<id>` and expires `_ga*` cookies on host and apex.
- Consequence for this plan: **any event sent through `window.gtag` inherits
  all of this automatically.** It is queued, not sent, where consent is
  required and not given, and never sent after a denial. No new consent
  logic is needed or wanted.

### Constraints that shape the implementation

- CSP `script-src` has no `'unsafe-inline'`: every snippet lives in an
  external same-origin file.
- `*.js` is `Cache-Control: immutable` for a year, except explicit overrides
  (`/gtm-init.js` and `/site-fx.js` are `no-cache`). A new script therefore
  needs a `?v=` on its tag and a bump on every change (`door.js?v=2` is the
  precedent), or its own no-cache override in `netlify.toml`.
- Everything in `public/` ships inside all three native app bundles and is
  guarded by `scripts/public-manifest.txt` (any add needs the manifest
  updated in the same commit). `website/public-landing/` is website-only.
- Privacy text today: banner "which pages get used"; policies "which
  features get used", plus the standard device and approximate-IP-location
  disclosure. No user IDs are set on the website tag. No PII in parameters.

### What the current data can and cannot answer

- Can: page views and users per landing page (`content_group=landing`),
  referrers, device, region; `/episodes` views the week an episode drops; and,
  if enhanced measurement is on, raw outbound clicks by `link_url`.
- Cannot (without the plan): which app card or which store a click came from
  as a clean dimension, still versus button on an episode, the homepage card
  versus the hero CTA as the path into /episodes, and clean key-event counts
  the weekly brief can quote without hand-filtering URLs.

### Links in scope (from source)

- Homepage THE APPS grid: Play badges for Scorecard, Board, Notebook; App
  Store badge for Scorecard (Board shows a non-link "Coming soon" span);
  internal launch links `/scorecard/`, `/board/`, `/notebook/`, `/calculator/`.
- Homepage hero: "Watch the latest cook" (to `/episodes`). MORE FROM HOLY
  SMOKES: EPISODES card button "See the episodes" (to `/episodes`).
- /episodes: three stills and three "Watch" buttons to `youtu.be/<id>`
  (Episode 3 `cXQxAk_Cj0E`, Episode 2 `I8UXczTylgM`, Pilot `x0NodCwbVYk`),
  plus "Subscribe on YouTube". Episode 4 premieres October 24 and gets a
  fourth row.
- Out of scope on purpose: `/yourpit/`, the door in `door.js`, the /pit
  lightbox, social-strip links (already visible as outbound `click` by
  `link_domain`), footer links.

## 3. Decisions this data should inform

| Decision | Question | Signal |
|---|---|---|
| Is the homepage earning installs? | Clicks on store badges per app, per store, per week | `app_store_click` |
| Web app or native? | Launch-link clicks vs badge clicks per card | `app_launch_click` vs `app_store_click` |
| Does an episode drop move the site? | Episode clicks and /episodes views in premiere week vs baseline | `episode_click`, `page_view` |
| Still or button? Which path into /episodes? | Placement split | `placement` on `episode_click` |
| Is enhanced measurement enough? | Custom counts vs outbound `click` counts | Both, compared once |

Anything not serving a row above stays out. No scroll depth, no hover, no
timing, nothing on the hidden page.

## 4. Tracking plan

Naming: object_action, lowercase, underscores. Every parameter is a fixed
label read from a `data-*` attribute in the HTML, never typed by a visitor,
never a URL fragment, never an identifier. Consent behaviour is identical for
all rows: sent through `window.gtag`, so queued where consent is required and
not yet given, dropped after a denial, sent by default elsewhere.

| Event | Trigger | Parameters (fixed values) | Page(s) | Consent behaviour |
|---|---|---|---|---|
| `app_store_click` | Click on a Play or App Store badge in THE APPS grid | `app`: scorecard, board, notebook; `store`: google_play, app_store; `placement`: apps_grid | `/` | Inherits Consent Mode; nothing before a required grant |
| `app_launch_click` | Click on a "Launch ..." link in THE APPS grid | `app`: scorecard, board, notebook, calculator; `placement`: apps_grid | `/` | Same |
| `episode_click` | Click on an episode still or Watch button on /episodes; the "Subscribe on YouTube" link; the hero "Watch the latest cook"; the EPISODES card button | `episode`: pilot, ep2, ep3, ep4 (or `list` for links that land on /episodes, `channel` for Subscribe); `placement`: still, button, subscribe, hero_cta, home_card | `/episodes`, `/` | Same |

Notes on the rows:

- `page_location` and `content_group` arrive automatically; no `page`
  parameter is sent.
- No `video_id` parameter: the `episode` label covers the brief, and the
  YouTube id is already in `link_url` on the enhanced `click` event for
  anyone who needs it.
- Episode 4's row is just another `data-episode="ep4"` on the new HTML.
- Volume is low (single or double digits a week). Report weekly, not daily.

### Custom dimensions to register (event scope, GA4 Admin, only after approval)

| Dimension | Parameter |
|---|---|
| App | `app` |
| Store | `store` |
| Placement | `placement` |
| Episode | `episode` |

Four new event-scoped dimensions on top of the eight registered in June; well
under the 50 limit. Values that arrive before registration are collected but
not reportable, so register on the same day as the deploy.

### Key events

- `app_store_click`: mark as a key event, counted every event. This is the
  one number the brief leads with.
- Nothing else is marked. `episode_click` and `app_launch_click` are read
  from the Events report.

### Enhanced measurement: how not to double count

If outbound clicks are on, the same badge click produces both `click`
(`link_domain` play.google.com or apps.apple.com) and `app_store_click`.
They are different event names, so GA4 does not merge them. The brief quotes
`app_store_click` and `episode_click` only. The `click` event is kept as a
cross-check in the first month (counts should match within a few clicks;
`click` also catches the social-strip links). If the counts match for four
weeks and nobody wants the dimensions, the plan can stop at Phase 0 below
and never ship Phase 1. Internal launch links are same-origin, so enhanced
measurement never sees them; only `app_launch_click` or `page_referrer` does.

### UTMs (inbound, not code)

Links from YouTube descriptions, Facebook, Instagram and TikTok to the site
should carry `utm_source=youtube|facebook|instagram|tiktok`,
`utm_medium=video|social`, `utm_campaign=episode_4` (lowercase, underscores,
one line per link in a shared sheet). This is what lets the brief say "the
premiere sent N people to /episodes" rather than "traffic went up".
Play badge links can carry a `&referrer=utm_source%3Dholysmokesbbqco.com`
suffix that Play Console reads for install attribution; GA4 never sees
installs, so this is a Play Console report line, optional, and Joel's call.

## 5. Implementation notes (for the Website session, after approval)

Phase 0, no code:

1. Confirm enhanced measurement is on and which of the eight toggles are set
   (Admin > Data streams > Holy Smokes Website > Enhanced measurement).
2. In the Events report, filter `click` by `link_domain` for
   play.google.com, apps.apple.com, youtu.be and youtube.com over the last
   28 days. That is the baseline the brief can start quoting next Wednesday
   with no deploy.
3. Confirm the property's Internal Traffic filter actually matches Joel's
   current IP (memory says it may not). At this volume his own badge taps
   would be the biggest line.

Phase 1, code (one commit, one deploy, batched with other website work to
save Netlify credits):

1. **New file `website/public-landing/track-links.js`**, loaded on `/` and
   `/episodes` as `<script src="/track-links.js?v=1" defer>`, the same
   pattern as `door.js`. One delegated `click` listener on `document`:
   walk up from the target to the nearest `[data-track]`, read
   `data-track`, `data-app`, `data-store`, `data-episode`, `data-placement`,
   and call `window.gtag('event', name, params)` when `window.gtag` is a
   function. Values are copied only from an allowlist of attribute names and
   checked against the fixed value lists above; anything else is dropped.
   About 30 lines. Why not `public/gtm-init.js`: that file ships inside all
   three native app bundles, is `no-cache` on purpose, and carries a
   286-line consent test harness; a site-only listener does not belong in
   it. Why not a new `public/*.js`: same bundle problem, plus the manifest.
2. **HTML attributes** on existing anchors in `index.html` and
   `episodes.html`, for example `data-track="app_store_click"
   data-app="scorecard" data-store="google_play" data-placement="apps_grid"`
   and `data-track="episode_click" data-episode="ep3" data-placement="still"`.
   No new elements, no copy change, no layout change.
3. **Cache:** `*.js` is immutable, so either rely on `?v=` and bump it on
   every edit, or add a `/track-links.js` `no-cache` override next to
   `/site-fx.js` in `netlify.toml`. Recommend the override; the site already
   lost a measurement-ID fix to this cache once.
4. **Beacon on navigation:** the store badges open in the same tab. gtag uses
   `sendBeacon` where available, so the event survives the navigation the
   same way the enhanced `click` does. No `event_callback` delay is added.
5. **Tests:** a vm test next to `gtm-init-consent.test.js` that runs the real
   file with a stub `document`, dispatches clicks on each annotated anchor,
   and asserts (a) the exact event list and parameter keys (this list is the
   sender inventory the auditor reads against the consent text), (b) no
   event for elements without `data-track`, (c) nothing when `window.gtag`
   is absent, (d) an unknown attribute value is dropped, not sent. The
   existing axe gate and `npm run check:deploy` run as usual.
6. **Verification after deploy:** GA4 DebugView (GA Debugger extension, or
   `debug_mode` in a local build) shows each event once per click with only
   the documented keys; with `hs_geo=eu` forced per the banner-test recipe in
   memory, no `/g/collect` request leaves before a grant; a stored denial
   sends nothing. Then register the four dimensions and the key event.

## 6. Privacy and consent review

- **Parameters:** `app`, `store`, `placement`, `episode` are fixed labels from
  the HTML. No PII, no user ID, no free text, no URL. Within the no-PII rule.
- **Consent:** nothing fires before a required grant, nothing after a denial,
  because every event rides the existing `gtag` queue and Consent Mode
  defaults. No new storage, no new cookie, no change to `hs-consent-v1`.
- **Does the disclosure still cover it?** Banner: "which pages get used."
  Policies: "which features get used." Enhanced measurement already records
  outbound link clicks under that same text today, so link clicks are not a
  new category of collection. My read is that the current wording still
  describes what is collected. **Flag for the auditor:** if the ruling is
  that "links" must be named, the banner wording changes, which bumps
  `CONSENT_TEXT_VERSION` and re-asks every EEA, UK, Swiss and Californian
  visitor; the three policies' analytics paragraph changes too. That cost
  should be weighed before Phase 1, not after.
- **Sender-inventory rule:** the test in 5.5 is the inventory. The consent
  text is checked against it both ways before the deploy.
- **Retention:** existing 14-month setting applies. Nothing new.
- **Hidden page:** no event on `/yourpit/`, the door, or the /pit gallery.
  `track-links.js` is not loaded on those pages and nothing there carries
  `data-track`.

## 7. Reporting notes for the weekly brief

Wednesday's apps briefing already pulls GA4 for this property. Add these
lines, each as this week, last week, and the 4-week average:

1. **Store clicks** (`app_store_click`), total and by `app` x `store`.
   Lead line. Note the Board App Store badge is not a link yet, so Board
   has one column until it is.
2. **Launch clicks** (`app_launch_click`) by `app`, next to the store
   clicks for the same app, as a web-versus-native ratio.
3. **Episode clicks** (`episode_click`) by `episode` and by `placement`.
   In a premiere week, show the new episode's row against the previous
   episode's first week.
4. **Path into episodes:** `/episodes` page views, plus the `hero_cta` and
   `home_card` placements, so the brief can say whether the homepage or an
   outside link brought the viewers.
5. **Cross-check (first month only):** outbound `click` by `link_domain`
   against lines 1 and 3. If they diverge by more than a handful, the
   listener or the attributes are wrong; fix before trusting either.
6. **Caveats printed with the numbers every week:** consent-region visitors
   who decline or never answer are not counted; Joel's own testing inflates
   small numbers unless the internal filter matches; dimension values from
   before registration are not reportable. Counts this small are direction,
   not measurement; call a change real only when it holds for two weeks or
   lines up with a known cause (a premiere, a post, a store release).

## 8. Open questions

1. Is enhanced measurement still on for stream 14982182426, and is outbound
   clicks among the toggles? (Admin check; decides whether Phase 0 alone can
   feed the brief for now.)
2. Auditor ruling on the disclosure wording in section 6: leave as is, or
   name links and pay the re-ask.
3. Does the Internal Traffic filter match Joel's current IP?
4. Is Marketing content with `episode` labels (pilot, ep2, ep3, ep4) or do
   they want the YouTube id as well? (Default here: labels only.)
5. Play badge `referrer=` suffix for Play Console install attribution: wanted
   or not? It is store-side, not GA4, and changes the badge URLs.
6. Housekeeping outside this plan: ten other site pages load
   `gtm-init.js?v=7` without `data-ga-group`, so their views report as
   `content_group=unknown`. Worth a pass by the Website session some week.

No em dashes in this document. Draft only; nothing here goes live without
Joel.
