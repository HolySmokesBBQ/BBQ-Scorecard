# SEO audit: holysmokesbbqco.com (2026-10-23)

This is the first run of the `seo-audit` skill (Corey Haines marketingskills
pack) against the live site. It fetched every URL in the sitemap plus the
compliance pages, the four app shells, the 404 page and the URL variants
(http, www, trailing slash, `.html` twins) with curl, read response headers,
robots.txt and sitemap.xml, and checked each finding against the source in
`website/public-landing/`, `public/`, the `index.*.html` entry files and
`netlify.toml`. Structured data was read from the static HTML, which is
authoritative here: there is no CMS plugin injecting JSON-LD at runtime.
Lighthouse data could not be pulled (the public PageSpeed API returned a
quota error) and Search Console was not reachable without the browser pane.
Every copy line below is a draft. It runs through /antislop, and anything in
Joel's first person runs through /joel, before it goes live. Nothing here
goes live without Joel.

Site context, answered from the repo rather than asked: a brand site for a
small publisher of free BBQ apps, single language (`lang="en"`), US
audience, no storefront. The business goal for organic search is installs
and web-app use. Priority topics: BBQ restaurant rating, cook logging, meat
quantity planning and local meat prices.

## Score card

| Dimension | Score | Key issue |
|---|---|---|
| Crawlability and indexation | 7 | Sitemap `lastmod` dates are stale (homepage says July 1, file changed Oct 21); `.html` twins and `/privacy`, `/support` pretty URLs resolve without a canonical on the compliance pages |
| Technical foundations | 8 | HTTPS, HSTS, Brotli, immutable hashed assets, AVIF/WebP, preloaded hero, self-hosted fonts with swap. TTFB 0.3 to 0.5 s warm. Two-hop redirect from `http://www` |
| On-page (titles, descriptions, headings) | 5 | Homepage title is 95 characters, description 339. SEO page titles run 69 to 83 characters. Ten compliance pages have no description or canonical. Two app titles carry em dashes |
| Content | 4 | `/scorecard/` renders 7 words and `/notebook/` renders 2 words without JavaScript. City pages are templated and promise "live" prices they do not show. `/pit` is 75 words |
| Structured data | 7 | Organization, Person, WebSite and four WebApplication nodes at the root; ItemList on city pages. No VideoObject on `/episodes`, brand name written two ways, `addressRegion: "MO/KS"` is not a region code |
| Internal linking and architecture | 4 | All nine city and guest-count pages are orphans: zero inbound links from any page. Inner pages link to the apps only through `/#apps` |
| Authority and links | 3 | No backlink data in hand. A web search for the domain and for the brand plus app names surfaced nothing from the site; "Holy Smokes BBQ" is shared by at least six unrelated restaurants |
| **Overall** | **5.4 / 10 (C)** | Foundations are strong. The losses are orphaned pages, over-long metadata and two app pages that are empty to a crawler |

Internal linking and the empty app shells move the grade the most, and
both are cheap to fix.

## Quick wins (under an hour each)

1. **Homepage title, 95 characters to about 55.** Google truncates by pixel
   width near 60 characters, so "Holy Smokes BBQ Co" never shows today.
   - Current: `Free BBQ Apps: Score Restaurants, Log Cooks, Calculate Meat & Track Prices | Holy Smokes BBQ Co`
   - Draft: `Free BBQ Apps and a Meat Calculator | Holy Smokes BBQ Co` (56)
   - Why: query first, brand last, and it stops the homepage competing with
     `/calculator/` and `/board/` for "calculate meat" and "track prices".
     The H1 is `HOLY SMOKES BBQ CO`, so the brand belongs in the title too.
2. **Homepage meta description, 339 characters to about 150.**
   - Current: the four-app parenthetical list (339 characters).
   - Draft: `Three free BBQ apps and a web calculator: rate the BBQ joints you visit, log every cook, track local meat prices and work out how much meat to buy.` (147)
   - Why: Google cuts at roughly 160. Today the snippet ends mid-sentence
     inside the Scorecard parenthetical and never mentions Board.
3. **Link the nine orphan pages.** `board-cities/*.html` (5) and
   `calculator-guests/*.html` (4) exist only in the sitemap. No page on the
   site links to them, including the Board and Calculator shells they
   promote.
   - Current: `/board/` lists its cities as plain text under "Cities
     covered"; `/calculator/` has no guest-count links.
   - Draft: turn the city names in the Board static section into links to
     the five city pages; add a "Plan by guest count: 10, 20, 50, 100
     people" line to the Calculator static section; add both rows to the
     homepage app cards or footer.
   - Why: the rankings-push reference calls internal links the biggest
     single lever and the most neglected. A page with zero inbound links
     gets crawled from the sitemap but inherits no authority, and the
     skill's new-page checklist asks for links from at least three pages.
4. **Sitemap freshness.** `lastmod` says 2026-07-01 for the homepage and
   all four apps; git shows the homepage changed 2026-10-21 and the city
   pages 2026-10-12 (sitemap says 07-20). Stale dates teach Google to
   ignore the field. Fix: have `scripts/assemble-dist.mjs` stamp `lastmod`
   from each file's git date at build, and add `support.html`,
   `privacy-board.html`, `delete-account-board.html` and the three
   `/notebook/*-notebook.html` pages, which are live but unlisted.
5. **Canonical and description on the ten compliance pages.** `privacy.html`,
   `privacy-board.html`, `delete-account.html`, `delete-account-board.html`,
   `changelog.html`, `support.html` and the three Notebook pages have no
   `<link rel="canonical">`, no meta description and no OG tags
   (`accessibility.html` has a description only). Netlify also serves them
   at `/privacy` and `/support` (200, same bytes), so each is a duplicate
   pair with no canonical to resolve it.
   - Draft descriptions, one per page, under 160 characters, in the pattern
     `What BBQ Scorecard collects, who processes it, how long it is kept and how to exercise your rights. Last updated October 14, 2026.`
   - Why: these pages rank for brand-plus-privacy queries and the Play
     Console links point at them; a missing canonical lets Google pick
     either URL.
6. **Em dashes out of two titles and one H1.** The `/calculator/` and
   `/board/` titles and the Board H1 use an em dash. The skill's AI-writing
   reference flags the em dash as the primary AI tell, and the titles run
   65 and 57 characters.
   - Current: the Calculator title reads "BBQ Meat Calculator", an em dash,
     "How Much Meat + Cook Time | Holy Smokes BBQ" (65).
   - Draft: `BBQ Meat Calculator: How Much to Buy and Cook Time | Holy Smokes` (64)
   - Current: the Board title reads "BBQ Board", an em dash, "Local Butcher
     & Meat Prices | Holy Smokes BBQ" (57); the H1 repeats the dash.
   - Draft: `BBQ Board: Local Butcher and Meat Prices | Holy Smokes BBQ` (58)
7. **Scorecard and Notebook titles carry no query words.**
   - Current: `BBQ Scorecard by Holy Smokes BBQ Co` (35) and `BBQ Notebook by Holy Smokes BBQ Co` (34)
   - Draft: `BBQ Scorecard: Rate BBQ Restaurants Like a Judge | Holy Smokes` (62)
   - Draft: `BBQ Notebook: Log Every BBQ Cook, Rub and Wood | Holy Smokes` (60)
   - Why: 25 unused characters each, and neither title says what the app
     does. The pattern for product pages is category first, brand last.
8. **Trim the SEO page titles and descriptions.** City titles run 69 to 74
   characters, guest titles 82 to 83; descriptions run 195 to 234.
   - Current: `How Much BBQ Meat for 10 People? Brisket, Pulled Pork & Ribs Math | BBQ Calculator`
   - Draft: `How Much BBQ Meat for 10 People? Brisket, Pork and Ribs | BBQ Calculator` (72, still long; drop the brand if it must fit: 55)
   - Current: `Cheapest Brisket, Pork & Ribs in Austin: Live Meat Prices | BBQ Board`
   - Draft: `Cheapest Brisket, Pork and Ribs in Austin | BBQ Board` (53)
   - Why: the question-form title matches the how-to pattern and the first
     50 characters carry the whole query. "Live" comes out for the reason
     in the longer-term section.
9. **Identity padding in metadata.** The Organization schema description
   reads "A BBQ family from Kansas City building tools..." and the Scorecard
   shell's `og:description` ends "Built by a BBQ family from Kansas City."
   Both break the house rule against identity padding. Draft: describe what
   the apps do instead; the Person node already carries Joel's story.
10. **One brand spelling.** Schema uses `Holy Smokes BBQ Co.` (with a
    period); every title, OG tag and footer uses `Holy Smokes BBQ Co`. Pick
    the no-period form everywhere. With six unrelated restaurants sharing
    the name, every consistent brand signal helps the entity resolve.

## Longer-term items

- **Give `/scorecard/` and `/notebook/` server-rendered content.** With
  JavaScript off they render 7 words and 2 words. The Calculator and Board
  shells already carry a static intro, feature list and common questions
  (449 and 464 words) that a crawler reads before the bundle runs. Copy that
  pattern: 300 to 400 words on what Scorecard scores (the 10 categories),
  what Notebook logs, and the Play and App Store links in plain anchors.
  Today neither shell contains a single `<a>` tag.
- **City pages: deliver what the titles promise, or stop promising it.**
  Each page says "Live Meat Prices", "Shops Tracked This Week" and "Prices
  below are pulled from real submissions", then lists shop names with no
  prices and no dates. The Austin page admits coverage "is still growing".
  The template is near-identical across five cities. Two honest paths:
  (a) have the build pull Board's real submissions for that city into a
  dated table (the live-price pipeline proposal in this folder is the hook),
  which makes the pages genuinely unique; or (b) keep them as guides and
  remove "live", "this week" and "updated by real pitmasters". Do not add
  cities Board has no data for. Google treats swapped-city-name pages as
  doorway pages.
- **Guest-count pages: expand only where the math is different.** The four
  pages (255 words each) answer a real query family ("how much brisket for
  50 people"). A table (meat, raw pounds, whole cuts, cook time) would
  match the format the top results use. Add 25, 30, 40, 75 and 150 only if
  each gets its own worked example and a line on smoker batches; and link
  each guest page to the matching Calculator preset (already done) and to
  the Board page for buying the meat.
- **VideoObject schema on `/episodes`.** Three YouTube episodes, no
  structured data. Each needs `name`, `description`, `thumbnailUrl`,
  `uploadDate`, `embedUrl` and `duration`. This is the only page on the site
  eligible for a video rich result, and Episode 4 is due 2026-10-24, so
  wire the template now.
- **BreadcrumbList on the city and guest pages** (Home, BBQ Board, Austin),
  and fix `addressRegion: "MO/KS"` on the Kansas City page: schema wants
  one ISO region, so use the state of each listed shop or drop the field.
- **Open Graph images.** Eleven pages use the square 512 px logo as
  `og:image`; the landing pages use the 1280 px photos. A 1200 by 630
  image per app lifts social click-through, which feeds brand search.
- **Search Console pull.** Verification is in place
  (`googleb5ed7e361153ee65.html` is live). The next step the skill cannot
  do from curl: export the last 28 days of query and page pairs, bucket
  positions 8 to 20 as striking distance, and run the rankings-push loop on
  the guest-count and city pages. Record baselines before any title change
  so the quick wins above are attributable; allow 3 to 4 weeks.
- **Core Web Vitals.** No field data was reachable. The homepage is 5.8 KB
  compressed with a preloaded AVIF hero, so LCP should be fine; the risk is
  CLS from the four display fonts swapping in. Check the Search Console CWV
  report once it has data, and if CLS shows, add `size-adjust` fallbacks.
- **Soft 404s on app routes.** `/scorecard/anything` and `/board/anything`
  return 200 with the app shell. Nothing links there today, so it is
  dormant; if Search Console reports "Soft 404", add a client-side not-found
  state that sets `<meta name="robots" content="noindex">`.
- **Redirect chain.** `http://www.holysmokesbbqco.com/` hops to
  `https://www.` and then to the apex (two 301s). One hop is a Netlify
  domain setting, not a code change.
- **Content program.** Beyond the apps the site has four brand pages and
  nine SEO pages. The pit page is 45 captioned photos and 75 words. A short
  written cook note under each episode (what went on, wood, temps, the
  mistake) would give `/episodes` and `/pit` text to rank on and would come
  from Joel's own notes, in his voice, through /joel. This is a
  content-strategy question, so size it there.
- **Brand collision.** "Holy Smokes BBQ" belongs to restaurants in at
  least six states, so the brand query is contested. Consistent naming
  (item 10), the Organization `sameAs` links already present, and the store
  listings pointing back at the site are the levers; a Google Business
  Profile is not, since there is no storefront.

## Checks that passed

- **Crawl basics.** robots.txt allows everything but service workers,
  `/assets/` (no landing asset lives there) and the internal catering tool,
  and names the sitemap. The catering tool also carries `noindex, nofollow`,
  so the footer link to it on every page is harmless.
- **Canonicals on the public pages.** Every landing, app and SEO page has a
  self-referencing canonical to the pretty URL, so `/about.html`,
  `/pit.html` and `/index.html` resolving is handled. `/pit/`, `/Pit` and
  `/scorecard` all 301 to the canonical form.
- **404s.** Unknown root paths return a real 404 with `noindex`, a
  description and two links home. `_template.html` is not deployed.
- **Security and speed.** HTTPS everywhere, HSTS with includeSubDomains,
  CSP without `unsafe-inline` scripts, Brotli on HTML and CSS, hashed JS
  and CSS immutable, images on a month cache, sitemap and robots on an hour.
- **Images.** All 47 pit photos and all homepage images carry alt text,
  width and height, `loading="lazy"` below the fold, and `<picture>` with
  AVIF or WebP sources. File names describe the subject.
- **Mobile.** Viewport meta on every page, one responsive HTML set, no
  separate mobile site, 48 px buttons in the shared stylesheet.
- **International.** Single locale, `lang="en"`, schema `inLanguage`
  en-US. No hreflang is needed and none is present, which is correct.
- **Local SEO.** Not a storefront or service-area business, so the local
  reference's profile and citation work does not apply. The city pages are
  content pages, not location pages, and should not carry LocalBusiness
  data for Holy Smokes itself.
- **Trust signals.** Privacy, deletion, accessibility and support pages are
  linked from every footer, with a support email and dated revisions. The
  about page is in Joel's own words.

## Limitations

- No Search Console, CrUX or Lighthouse data: positions, impressions,
  click-through and Core Web Vitals are unmeasured. The PageSpeed API
  quota was exhausted on the shared key, and the browser pane was off
  limits for this run.
- No backlink index was available, so the authority score is an inference
  from the search results, not a count.
- The `site:` check used the search tool available here, not Google. A
  blank result is weak evidence; Search Console's coverage report is the
  real answer.
- Store listing pages were not re-audited here; see `aso-audit-2026-10-23.md`
  and `aso-audit-2026-10-23-board.md` in this folder.
