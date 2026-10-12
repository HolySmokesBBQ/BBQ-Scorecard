# DESIGN.md: Holy Smokes BBQ Co website

Status: values extracted from the live site on 2026-10-01 (audit-001) and
checked against Holy Smokes Marketing's brand inputs the same day
(`marketing/holy-smokes-bbq-voice-profile.md`, `marketing/brand-type-system.md`,
`marketing/brand-template-spec.md`). Two decisions are Joel's and are marked
PENDING below: whether the site switches to the brand typeface, and whether
the web palette moves to the logo colors.

## 1. Visual Theme & Atmosphere
A smokehouse sign at night: near-black, cream lettering, one burnt-orange
glow. The site is a landing page for four free BBQ apps and the family
behind them. Readers are home pitmasters and people hunting a BBQ joint,
most arriving on a phone from a store listing or a search. It should feel
like a hand-painted menu board, not a startup: confident, plain-spoken,
specific. Joel's own bio opens the page in first person; the product copy is
plain third person in his register, not marketing voice. No fire clichés
beyond the logo's own flames, no stock photos or BBQ clip art, no claims the
code can't back.

Voice (Marketing's profile): Joel talking, first person singular, "I" never
"we here at Holy Smokes". Kansas City is the heritage; he lives in Waukesha,
WI. Short declaratives, plain verbs, contractions mixed with full forms,
specs over adjectives, no hype, no trophy or pro claims, no em dashes, no
"it's not X, it's Y". Sign-off "Faith, Family, and Fire." (Joel, 2026-10-02: a motto is capitalized; "and" and "&" are interchangeable, and he likes the ampersand on the mark). The slogan is
styled FAITH, FAMILY & FIRE as a mark. Facts that must hold: THREE apps
(Scorecard, Notebook, Board) plus the Calculator, which is a website tool,
never "four apps"; the sauce is not for sale and nothing may imply it is;
never call the smoker an offset; Peyton's name and face never appear; no
exterior shots of the house. Anything drafted in Joel's name runs humanize,
then joel, then antislop.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2 (logos: the 2026 Burnt Ends set from Marketing; the leaf-flame 2025 badge is retired, archive only)
Impeccable mode: Persuade (homepage), Read (SEO and legal pages)

Photo-led since 2026-10-01 (Joel: "make it as eye-catching as the light
show site"). The homepage is banded like a smokehouse wall, a chalkboard and
a menu card: a real photo under the sign, Joel's story on cream, the apps on
near-black, the pit photos and the YouTube tile on umber, dated news on
cream. Two authored motions only: a slow smoke drift behind the hero
lettering (the company is named after smoke) and photos easing up as they
scroll in. Text never animates. Both are off under prefers-reduced-motion.
Photos come from `marketing/photo-library` and `marketing/bts-photos`, web-sized
into `public/photos/`, and obey Marketing's rules: no photo with Joel's
daughter, no house exterior, no sauce jars or labels (sale implication), and
captions never identify cuts, wood or gear from a photo; until Joel writes
his own lines, captions are dates only.

Identity motif: **Striker**, the torch character (Joel chose the torch over
a smoke puff on 2026-10-01; masters in `assets-source/striker/`, site copies
in `public/striker/`). Eight faces: dry (default), pleased, surprised,
patient, skeptical, sleepy, fired (the only one with flame) and out (flame
out, a curl of smoke: 404 and empty states). His one line is "It's just a
match." Rules: at most one aside beside a photo and one footer sign-off per
page; never over prices, store buttons, hours or legal text; never the words
"Texas Match" anywhere (a product name); copy about him runs humanize, joel,
antislop. The site favicon stays the Holy Smokes logo; Striker's favicon is
for his own surfaces only.

## 2. Color Palette & Roles
Decided 2026-10-01 (Joel delegated; Marketing's canon applied): the web
palette is the logo's. Sources: logo sample (orange `#D06129`, gold
`#F3CF6D`, charcoal `#444947`), video end cards (near-black `#1b1714`),
print palette (cream `#E6D8B8`, ink `#33211A`).

Core: background `#1b1714` (warm near-black), surface `#2a2015` (umber
panels), text `#E6D8B8` (cream). Accent: `#D06129` logo orange for h1,
section headings, links and hover. Muted text `#bfb39a` (cream at 80%),
footer-grade `#9a9084`. Hairlines `#3a332c` on background, `#2a2015`
between sections.

Per-app colors are the written reason the palette exceeds 2+1: Scorecard
`#D06129`, Notebook `#4a6741`, Board `#a85f52`, Calculator `#F3CF6D`. Rule:
an app's color appears on its own card border and Launch button, and
nowhere else. Card headings are cream for every app, because Notebook green
on the panel is 2.5:1 and Board brick 3.4:1, both below AA for text.

Contrast pairs that must stay AA (measured): cream on background 12.6:1;
muted on background 8.6:1, on surface 7.7:1; footer on background 5.7:1;
orange on background 4.6:1 (headings 18px+ only; never body text on it);
near-black on orange buttons 4.6:1, hover `#e0803f` 6.2:1 (the orange is
never a fill for white text: 3.9:1); ink on gold buttons 10.2:1, hover
`#f6da8c` 11.2:1; white on Notebook green 6.4:1; white on Board brick 4.75:1
(do not darken the brick).

The same hexes are used on the Board city pages, calculator-guests pages and
the privacy, deletion, changelog and support pages, so the whole website
reads as one surface. The app shells (/scorecard/, /notebook/, /board/)
carry their own themes and are not in scope of this file's palette.

## 3. Typography Rules
Decided 2026-10-12 (Joel, via Marketing's BRAND-UPDATE-2026-10-12.md): **Burnt
Ends**, the house face that letters the logos, replaces Thornwood everywhere.
Two cuts, self-hosted from `public/fonts/burnt-ends-inline.woff2` and
`burnt-ends-solid.woff2` (`@font-face` in `public/site.css` and inline on the
compliance and SEO pages). No Adobe kit, no third-party font host, no font
consent gate; the L-8 gate and `brand-font.js` are retired. One weight (400):
never let the browser synthesize bold or italic on it.

Burnt Ends is an **all-caps face**: lowercase glyphs render as capitals. That
sets the roles. It is for display, headings, buttons and labels; paragraph
text is Inter (self-hosted, as before), because 17px body copy in capitals
is not readable.

- Display: Burnt Ends Inline (the cut with the drawn highlight, which only
  reads at about 34px and up): hero h1 `clamp(60px, 11vw, 124px)`, inner-page
  masthead h1, band h2 (38px, 46px from 600px), lead app-card h2 38px, the
  SEO-section h2 34px, the Board price number. Tracking 0.01em on the h1s.
- Headings and UI: Burnt Ends Solid, 400: card h2 30px, lead-card and tile
  h3, news h3, FAQ questions, buttons (16 to 17px), nav links, the slogan,
  meta labels (12 to 13px, tracking 0.14 to 0.2em), figcaptions, footer.
- Body: Inter 400: 17px / 1.5 on the homepage and compliance pages (story
  19px / 1.55), 18px on the light SEO pages, 16px card copy.
- Store buttons keep Inter at 12px (they imitate the store badges).

Oswald and Inter remain as fallbacks in every stack. Burnt Ends covers basic
Latin only (no accented characters); keep copy to that set or the fallback
takes over mid-word.

Scale: unchanged from the Thornwood era (sizes above). Headings
`text-wrap: balance`. Capitals come from the face, not from
`text-transform`, so copy is still written in sentence case in the HTML.

## 4. Component Stylings
Buttons: Oswald 700 14px, 12px 24px padding, 8px radius, app color fill,
hover shifts the fill (lighter for the orange so dark text keeps AA, darker
for the rest), `:active` translateY(1px), `:focus-visible` 2px cream outline
offset 2px, transitions 150ms on background and transform only.
Store buttons: black `.play-mini`, 6px radius, 44px min height, real store
URLs; a non-link `.play-soon` variant with the same look, dimmed, for a
store the app is not on yet. Never a store button for a store the app is
not on.
Cards: surface fill, 2px border in the app color, 14px radius, flex column
so Launch buttons align across a row. Lead row (Scorecard, Board): 90px
logo, 26px heading, 32px padding. Second row (Notebook, Calculator): 72px
logo, 22px heading, 24px padding. The difference is the hierarchy: the two
apps on both stores and the newest app lead.
Social links: SVG mark + name, 44px tall, orange on hover.
Skip link: visually hidden until focused, then a cream pill at top left.

## 5. Layout Principles
Four pages since 2026-10-01 (Joel: "the site needs more than one page"),
one stylesheet (`public/site.css?v=N`, bump N on every change because
Netlify caches `*.css` immutable), one nav row on every page (HOME, FROM
THE PIT, EPISODES, ABOUT, THE APPS), one footer with the Striker sign-off:

- `/` (Persuade): hero → app grid → "More from Holy Smokes", three link
  cards (From the Pit with the Striker aside, Episodes, About) → social
  strip → footer. The story, the pit grid, What's New, the FAQ and "What
  each app does" came off the homepage on 2026-10-01; the FAQPage schema
  went with the FAQ.
- `/pit` (Experience): the full gallery, 45 photos from `marketing/`
  (`gallery-manifest.json` is the source list), 3:2 frames in a 3-column
  grid with one wide frame per seven, no captions, no dates. Each frame is
  a `<button>` opening a native `<dialog>` lightbox (arrows, Escape, focus
  returns to the opener). Without JS the grid still shows every photo.
- `/episodes` (Read): every YouTube episode newest first, still on the
  left from 700px, one line each in Joel's own description words, the
  published date, a "Watch" button. Episode 2 is missing on purpose and the
  page says so in his words.
- `/about` (Read): THE STORY verbatim (his keystrokes) on cream, then three
  link cards.

Inner pages open with a short dark masthead (nav, display h1, one-line
lede) instead of the hero. Single column, max-width 980px, 20px side
gutters. Spacing scale 8/12/16/24/32/40px; more space above a heading
than below it. The composition is specific because the bio comes before
the products and the products are a 2+2 grid with a heavier first row,
not a uniform three-across.

## 6. Depth & Elevation
No shadows; depth comes from surface color against background and 2px
color borders. Radii: 6px store buttons, 8px buttons, 14px cards and story
panel, 50% logos. Nothing pill-shaped.

## 7. Do's and Don'ts
Do: verify every number against the code before it ships (cities, states,
app counts, wood species). Do: keep every control at 44px or taller on a
phone. Do: run `python ~/.claude/skills/web-design/scripts/sitecheck.py
website/public-landing` and `npm run check:deploy` after every change.
Don't: em dashes anywhere in copy. Don't: eyebrow labels above headings
("NEW", "JUST LAUNCHED"). Don't: a "coming soon" badge once the app is on
that store, or a store badge before it is. Don't: "Get started" / "Learn
more" CTAs; name the app. Don't: forward promises ("no ads", "will stay
free"), "anonymous", identity padding in copy. Don't: text that animates, or
more than the two authored motions (hero smoke drift, photo reveal); MOTION
is 2, with `prefers-reduced-motion` honored.

## 8. Responsive Behavior
Breakpoints: one column under 600px, two columns from 600px. Logo 120px
under 600px, 160px above. h1 scales with the clamp. Story and FAQ text
never exceed 68ch. Tap targets 44px minimum; store buttons wrap to their
own line on narrow cards. No horizontal overflow at 375px. Card logos are
served at 2x their rendered size (180px for 90px, 144px for 72px).

## 9. Agent Prompt Guide
Build to a dark smokehouse sign: `#1a1a1a` background, `#f5e6d3` cream text,
`#d4782f` orange accent, umber `#2a2015` panels, Oswald caps for display
and Inter for body. Each app owns one color on its own card and button
only. ENERGY 2 / RHYTHM 2 / MOTION 2. The identity motif is Striker, the
torch, in every footer, and the display caps over real pit photos. Easy to get wrong: white text on the orange
(fails AA), numbers that drift from the data, and labels above headings.
