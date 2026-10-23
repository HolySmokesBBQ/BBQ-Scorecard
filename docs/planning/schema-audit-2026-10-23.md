# Schema audit: holysmokesbbqco.com (2026-10-23)

This is the first run of the `schema` skill (Corey Haines marketingskills pack)
against the live site. Deliverable is this document only. Nothing here goes
live without Joel. No site file was edited, nothing was deployed or committed.

**What was run and how.** The skill's steps, in order: (1) checked for a
product-marketing context file (none at `.agents/`, `.claude/` or the legacy
name); (2) assessed page type, current state and goals for every URL in the
live sitemap; (3) fetched each live page with curl, pulled every
`application/ld+json` block, parsed it with node to confirm valid JSON, and
checked each FAQ question against the visible page text; (4) read the sources
(`website/public-landing/*.html`, `board-cities/`, `calculator-guests/`, the
root `index.*.html` app shells, `public/`, `netlify.toml`,
`scripts/assemble-dist.mjs`); (5) checked Google feature support per type
before recommending it; (6) wrote the drafts; (7) wrote the testing checklist.
Browser tools were not used.

Every new copy line is marked **DRAFT** and runs through /antislop before it
ships. Lines lifted verbatim from the live page are not re-marked.

## Current state

| URL | Existing JSON-LD | Valid JSON | Verdict |
|---|---|---|---|
| `/` | `@graph`: Organization, Person, WebSite; second block with 4 WebApplication | yes | Present but stale: identity-padding description, a slogan that is not on the page, Scorecard missing iOS and its price, logo dimensions wrong (file is 520 px, block says 512) |
| `/scorecard/` | WebSite + WebApplication | yes | No iOS, no App Store, no install URLs. `@id` links to `#organization` and `#joel`, which only exist on the homepage |
| `/notebook/` | WebSite + WebApplication | yes | Same dangling `@id` problem. No install URL. Content is accurate (single-meat cook log, no multi-meat claim) |
| `/calculator/` | WebApplication + FAQPage | yes | FAQPage is a retired Google rich result. One of six FAQ questions ("How many ribs per person") is in the schema but not on the page |
| `/board/` | WebApplication + FAQPage | yes | FAQPage retired. Two of six questions ("How does BBQ Board get its prices?", "Which cities does BBQ Board cover?") are schema-only. `operatingSystem` says Web only; the app is on Google Play. A FAQ answer quotes a specific Costco price per pound that no page can keep current. `keywords` and `featureList` name a US state and call brats a cultural staple |
| `/episodes` | none | n/a | Three videos on the page, zero VideoObject |
| `/about` | none | n/a | No Person markup on the one page that is about a person |
| `/pit` | none | n/a | Out of scope for this pass (see longer-term) |
| `/board-cities/*.html` (5) | WebPage + ItemList of 7 LocalBusiness | yes | LocalBusiness items carry no street address, so they are unverifiable entities. Milwaukee's list labels a Madison shop and a shop in a neighboring city as `addressLocality: Milwaukee`. Kansas City uses `addressRegion: "MO/KS"`, which is not a region code. No BreadcrumbList |
| `/calculator-guests/*.html` (4) | none | n/a | Zero markup. No BreadcrumbList |
| compliance pages in `public/` | none | n/a | Fine as is. Legal pages do not need markup |

Also noticed: sitemap `lastmod` values predate the content (`/` says
2026-07-01, `/episodes` says 2026-10-01 and will be wrong again on 10-24).
`/catering/` is disallowed in robots.txt and `/yourpit/` is noindex; both stay
out of every graph.

### Google feature support, checked per type

- **Organization, Person, WebSite, BreadcrumbList, VideoObject,
  SoftwareApplication**: all currently supported.
- **SoftwareApplication rich result**: Google's Software App documentation asks
  for a rating or review alongside name and price. The same-day ASO audit found
  zero ratings on either store, so none of the four apps is eligible yet. The
  markup still gives Google and the AI engines clean entity data (names,
  platforms, prices, store URLs), which is the reason to ship it now.
- **VideoObject rich result**: Google expects the video to be watchable on the
  page. `/episodes` links out to YouTube with a thumbnail and no embed, so the
  blocks below are semantic data plus Google Video indexing of the YouTube
  link; the carousel treatment needs an embed (longer-term).
- **FAQPage**: Google stopped showing FAQ rich results in May 2026 and removed
  the docs. **HowTo**: retired September 2023. **WebSite SearchAction**:
  retired November 2024. None of these are a reason to keep or add markup.

## Quick wins (under an hour each)

1. **Fix the homepage Organization.** Drop the "A BBQ family from Kansas
   City" description (identity padding), drop the `slogan` (it appears
   nowhere on the page), fix the logo dimensions to 520, make the name match
   `og:site_name` ("Holy Smokes BBQ Co", no period), add a support contact
   point. Why: this is the brand's knowledge-panel seed. Draft A.
2. **Scorecard: add iOS, the App Store URL and both prices.** Today the
   markup says Android and Web, free. Why: a price mismatch between markup
   and store is the kind of thing that costs trust with Google. Draft B.
3. **Remove the schema-only FAQ questions** on `/calculator/` (one) and
   `/board/` (two). Why: markup for content that is not on the page is the
   one thing Google's guidelines say never to do. Recommendation: remove both
   FAQPage blocks outright; the rich result is gone and the Board one carries
   a stale price.
4. **Fix the dangling `@id` references** on the four app pages by embedding a
   stub Organization node with the same `@id`. Why: a node that is only an
   IRI validates but says nothing to a crawler that lands on `/scorecard/`
   first.
5. **Add BreadcrumbList to the nine SEO pages** (five cities, four guest
   counts). Why: the cheapest supported rich result on the site, and it gives
   Google the hierarchy (Home > BBQ Board > Milwaukee) the URL alone does not.
   Add a one-line visible trail above the `<h1>` so markup mirrors the page.
   Drafts G and H.

## JSON-LD drafts

Conventions: one `@graph` per page, in `<head>`. Stable `@id` values so pages
can point at each other: `/#organization`, `/#website`, `/about#joel`,
`/scorecard/#app`, `/notebook/#app`, `/calculator/#app`, `/board/#app`. Every
page other than the homepage carries this stub so its references resolve:

```json
{ "@type": "Organization", "@id": "https://holysmokesbbqco.com/#organization", "name": "Holy Smokes BBQ Co", "url": "https://holysmokesbbqco.com/", "logo": "https://holysmokesbbqco.com/holy-smokes-logo.png" }
```

Drafts C through H omit it to save space; it goes first in each graph.

### Draft A: homepage (`website/public-landing/index.html`), replaces both blocks

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://holysmokesbbqco.com/#organization",
      "name": "Holy Smokes BBQ Co",
      "alternateName": "Holy Smokes BBQ",
      "url": "https://holysmokesbbqco.com/",
      "logo": { "@type": "ImageObject", "url": "https://holysmokesbbqco.com/holy-smokes-logo.png", "width": 520, "height": 520 },
      "description": "DRAFT: Free BBQ apps and a web calculator: score the joints you visit, log every cook, plan how much meat to buy, and track local butcher prices.",
      "founder": { "@id": "https://holysmokesbbqco.com/about#joel" },
      "areaServed": "US",
      "contactPoint": { "@type": "ContactPoint", "contactType": "customer support", "email": "support@holysmokesbbqco.com", "url": "https://holysmokesbbqco.com/support.html", "availableLanguage": "English" },
      "sameAs": [
        "https://www.facebook.com/HolySmokesBBQCompany",
        "https://www.instagram.com/holysmokesbbqco/",
        "https://www.youtube.com/@HolySmokesBBQCo",
        "https://www.tiktok.com/@holysmokesbbqco"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://holysmokesbbqco.com/#website",
      "url": "https://holysmokesbbqco.com/",
      "name": "Holy Smokes BBQ Co",
      "publisher": { "@id": "https://holysmokesbbqco.com/#organization" },
      "inLanguage": "en-US"
    }
  ]
}
```

The Person node moves to `/about` (Draft E); the homepage keeps the `founder`
pointer. The second homepage block (four WebApplication nodes) goes away: each
app's full node lives on its own page. If Joel wants the apps on the homepage
too, inline Drafts B through D unchanged (same `@id`, same content) so the two
copies never drift.

### Draft B: BBQ Scorecard (`index.web.html`, served at `/scorecard/`)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "https://holysmokesbbqco.com/#organization", "name": "Holy Smokes BBQ Co", "url": "https://holysmokesbbqco.com/", "logo": "https://holysmokesbbqco.com/holy-smokes-logo.png" },
    {
      "@type": "SoftwareApplication",
      "@id": "https://holysmokesbbqco.com/scorecard/#app",
      "name": "BBQ Scorecard",
      "url": "https://holysmokesbbqco.com/scorecard/",
      "image": "https://holysmokesbbqco.com/bbq-scorecard-logo.png",
      "description": "Score BBQ restaurants on 10 competition-style categories. Compare with friends and keep a personal leaderboard.",
      "applicationCategory": "LifestyleApplication",
      "applicationSubCategory": "Food & Drink",
      "operatingSystem": "Android, iOS, Web",
      "browserRequirements": "Requires JavaScript",
      "installUrl": [
        "https://play.google.com/store/apps/details?id=com.holysmokesbbq.scorecard",
        "https://apps.apple.com/us/app/bbq-scorecard/id6796120225"
      ],
      "offers": [
        { "@type": "Offer", "name": "Android and web", "price": "0", "priceCurrency": "USD", "url": "https://play.google.com/store/apps/details?id=com.holysmokesbbq.scorecard" },
        { "@type": "Offer", "name": "iOS", "price": "3.99", "priceCurrency": "USD", "url": "https://apps.apple.com/us/app/bbq-scorecard/id6796120225" }
      ],
      "publisher": { "@id": "https://holysmokesbbqco.com/#organization" },
      "author": { "@id": "https://holysmokesbbqco.com/about#joel" },
      "featureList": [
        "10-category competition-style BBQ restaurant scoring",
        "Friend system with shared friend codes",
        "Leaderboard, comparison views and a map of scored restaurants",
        "Cloud sync, offline-first"
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://holysmokesbbqco.com/" },
        { "@type": "ListItem", "position": 2, "name": "BBQ Scorecard", "item": "https://holysmokesbbqco.com/scorecard/" }
      ]
    }
  ]
}
```

Price note for the implementer: the brief for this audit says $3.99 on iOS.
The same-day ASO audit recorded the App Store listing as "Free, In-App
Purchases" with a $3.99 unlock. The Offer must match what the store page shows
on the day it ships: if the store says free with IAP, set the iOS `price` to
"0" and put the unlock in the description. Check the store, not this document.
No `aggregateRating`: there are no ratings to report, and inventing one is
the fastest way to a manual action. No `softwareVersion`: it changes with
every ship and would go stale.

### Draft C: BBQ Notebook (`index.notebook.web.html`, served at `/notebook/`)

Same graph shape as Draft B (stub, app node, two-item breadcrumb ending in
"BBQ Notebook" at `/notebook/`). The app node:

```json
{
  "@type": "SoftwareApplication",
  "@id": "https://holysmokesbbqco.com/notebook/#app",
  "name": "BBQ Notebook",
  "url": "https://holysmokesbbqco.com/notebook/",
  "image": "https://holysmokesbbqco.com/bbq-notebook-logo.png",
  "description": "Log every BBQ cook with rubs, woods, temps, weather, and outcomes. Save rubs and sauces as reusable recipes. Compare techniques with friends.",
  "applicationCategory": "LifestyleApplication",
  "applicationSubCategory": "Food & Drink",
  "operatingSystem": "Android, Web",
  "browserRequirements": "Requires JavaScript",
  "installUrl": "https://play.google.com/store/apps/details?id=com.holysmokesbbq.notebook",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD", "url": "https://play.google.com/store/apps/details?id=com.holysmokesbbq.notebook" },
  "publisher": { "@id": "https://holysmokesbbqco.com/#organization" },
  "author": { "@id": "https://holysmokesbbqco.com/about#joel" },
  "featureList": [
    "One cook, one meat: cut, weight, rub, sauce, wood, smoker, fuel, temps, wrap, finish temp, rest, weather and outcome notes",
    "Reusable rub and sauce recipes, photo attachments per cook, friend sharing via 6-character codes",
    "Offline-first, installable as a PWA"
  ]
}
```

The description is the page's live meta description. The first featureList
line is DRAFT; it states the single-meat model so no crawler infers multi-meat
logging.

### Draft D: BBQ Calculator and BBQ Board (`index.calculator.html`, `index.board.web.html`)

Both keep their current WebApplication node with these edits, and both drop
the FAQPage block (retired result, schema-only questions, stale price text):

- `@type` becomes `"SoftwareApplication"`; `@id` becomes `/calculator/#app`
  and `/board/#app`.
- Board: `operatingSystem` becomes `"Android, Web"`; add `installUrl` and
  `offers.url` pointing at
  `https://play.google.com/store/apps/details?id=com.holysmokesbbq.board`;
  add `"image": "https://holysmokesbbqco.com/bbq-board-logo.png"`. Do not add
  an App Store URL until the listing is live; "coming soon" has no schema
  expression and a placeholder URL would 404 in the validator.
- Board: remove the state name and the "cultural staple" line from
  `keywords` and `featureList`. Keep the coverage as plain "Fresh bratwurst
  coverage" (DRAFT).
- Calculator: add `"image": "https://holysmokesbbqco.com/bbq-calculator-logo.png"`.
  Everything else in that node already matches the page.
- Both: add the stub Organization node and a two-item BreadcrumbList as in
  Draft B.

### Draft E: `/about` (`website/public-landing/about.html`)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://holysmokesbbqco.com/about#joel",
      "name": "Joel Muiller",
      "honorificPrefix": "Pastor",
      "jobTitle": "Pastor",
      "description": "Pastor and pitmaster, Kansas City raised.",
      "image": "https://holysmokesbbqco.com/photos/joel-portrait-640.jpg",
      "url": "https://holysmokesbbqco.com/about",
      "birthPlace": { "@type": "Place", "name": "Kansas City metropolitan area" },
      "worksFor": { "@id": "https://holysmokesbbqco.com/#organization" },
      "mainEntityOfPage": "https://holysmokesbbqco.com/about"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://holysmokesbbqco.com/" },
        { "@type": "ListItem", "position": 2, "name": "About", "item": "https://holysmokesbbqco.com/about" }
      ]
    }
  ]
}
```

Deliberately absent, per the brief: no street address, no city of residence,
no phone, no personal email, no `sameAs` (the social accounts are the brand's
and already sit on the Organization). "Pastor" is the brand title; "Rev."
stays on the church side. `birthPlace` restates the page's own "Born and
raised in the greater Kansas City area" and nothing more. The description is
the page's own subtitle, verbatim.

### Draft F: `/episodes` (`website/public-landing/episodes.html`)

One full VideoObject shown; the other two use the same shape with the values
in the table. Descriptions are the page's visible copy, verbatim. Dates come
from the brief. No `duration`: it is not on the page and was not supplied.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "VideoObject",
      "@id": "https://holysmokesbbqco.com/episodes#ep3",
      "name": "Saturday Steak ASMR (Episode 3)",
      "description": "Saturday steak on the smoker, from lighting the coals to the first slice. I don't say a word the whole time, it's just the fire and the sizzle.",
      "thumbnailUrl": ["https://holysmokesbbqco.com/photos/yt-episode-3-1280.jpg", "https://holysmokesbbqco.com/photos/yt-episode-3-640.jpg"],
      "uploadDate": "2026-09-26",
      "url": "https://youtu.be/cXQxAk_Cj0E",
      "embedUrl": "https://www.youtube.com/embed/cXQxAk_Cj0E",
      "publisher": { "@id": "https://holysmokesbbqco.com/#organization" }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://holysmokesbbqco.com/" },
        { "@type": "ListItem", "position": 2, "name": "Episodes", "item": "https://holysmokesbbqco.com/episodes" }
      ]
    }
  ]
}
```

| `@id` | `name` | `uploadDate` | YouTube ID (`url`, `embedUrl`) | `thumbnailUrl` base | `description` |
|---|---|---|---|---|---|
| `#ep2` | Big Revelations (Episode 2) | 2026-10-10 | I8UXczTyIgM | `/photos/yt-episode-2-{1280,640}.jpg` | the page's Episode 2 paragraph, verbatim |
| `#pilot` | Pilot Episode | 2026-09-25 | x0NodCwbVYk | `/photos/yt-pilot-{1280,640}.jpg` | the page's pilot paragraph, verbatim |
| `#ep4` | from the entry | 2026-10-24 | av8HTvWysRE | `/photos/yt-episode-4-{1280,640}.jpg` | from the entry |

**Episode 4** premieres 2026-10-24. Today the page carries only an "Up next"
sentence, no entry, so no VideoObject yet: markup has to match visible
content. When the Website session adds the entry, add the `#ep4` node in the
same commit, with the thumbnails (they do not exist yet; `website/photos/`
has pilot, 2 and 3 only) and a sitemap `lastmod` bump for `/episodes`.

### Draft G: board-cities pages (`website/public-landing/board-cities/_template.html`)

Replaces the ItemList-of-LocalBusiness graph. Reason: a LocalBusiness with
only a city is an unverifiable entity, several entries are mislabelled (see
the table), and this site does not operate those shops. Milwaukee shown; the
template substitutes city, state code and slug.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://holysmokesbbqco.com/board-cities/milwaukee.html",
      "url": "https://holysmokesbbqco.com/board-cities/milwaukee.html",
      "name": "Cheapest Brisket, Pork & Ribs in Milwaukee: Live Meat Prices | BBQ Board",
      "description": "Crowdsourced brisket, pork, and rib prices at Milwaukee butchers and grocery meat counters.",
      "inLanguage": "en-US",
      "isPartOf": { "@id": "https://holysmokesbbqco.com/#website" },
      "about": { "@id": "https://holysmokesbbqco.com/board/#app" },
      "spatialCoverage": { "@type": "City", "name": "Milwaukee", "containedInPlace": { "@type": "State", "name": "WI" } },
      "publisher": { "@id": "https://holysmokesbbqco.com/#organization" }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://holysmokesbbqco.com/" },
        { "@type": "ListItem", "position": 2, "name": "BBQ Board", "item": "https://holysmokesbbqco.com/board/" },
        { "@type": "ListItem", "position": 3, "name": "Milwaukee", "item": "https://holysmokesbbqco.com/board-cities/milwaukee.html" }
      ]
    }
  ]
}
```

Kansas City straddles two states; set `containedInPlace` to the state the
page's shops mostly sit in, or omit it, rather than "MO/KS". If Joel wants to
keep the shop list in markup, each item needs a real `streetAddress` and
`addressLocality` from Google Maps (not Yelp), and a shop outside the page's
city must carry its own city. Otherwise the visible list is enough.

### Draft H: calculator-guests pages (`website/public-landing/calculator-guests/*.html`)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://holysmokesbbqco.com/calculator-guests/for-50-people.html",
      "url": "https://holysmokesbbqco.com/calculator-guests/for-50-people.html",
      "name": "How Much BBQ Meat for 50 People?",
      "description": "Feeding 50 people? Here is the real math: how many pounds of brisket, pulled pork, and ribs to buy, how many packers or butts that is, and how long the cook takes. Free BBQ calculator, no signup.",
      "inLanguage": "en-US",
      "isPartOf": { "@id": "https://holysmokesbbqco.com/#website" },
      "about": { "@id": "https://holysmokesbbqco.com/calculator/#app" },
      "publisher": { "@id": "https://holysmokesbbqco.com/#organization" }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://holysmokesbbqco.com/" },
        { "@type": "ListItem", "position": 2, "name": "BBQ Calculator", "item": "https://holysmokesbbqco.com/calculator/" },
        { "@type": "ListItem", "position": 3, "name": "For 50 people", "item": "https://holysmokesbbqco.com/calculator-guests/for-50-people.html" }
      ]
    }
  ]
}
```

The `<h1>` is a question, which tempts a FAQPage. Do not: retired result,
and the page is one answer, not a list of questions.

## Implementation notes

- **CSP.** `netlify.toml` sets `script-src` without `'unsafe-inline'`. That
  blocks inline *executable* scripts. A `<script type="application/ld+json">`
  block is a data block: browsers never execute it, so CSP does not apply and
  Google reads it from the HTML. Proof already on the site: the homepage
  serves two such blocks today under this exact header, and both parsed as
  valid JSON in this audit. Still, after the first change ships, run
  https://search.google.com/test/rich-results on
  `https://holysmokesbbqco.com/` and confirm the Organization is detected.
- **Where the blocks live.** Brand pages: `website/public-landing/*.html`,
  copied by `scripts/assemble-dist.mjs`. App pages: root `index.web.html`,
  `index.notebook.web.html`, `index.calculator.html`, `index.board.web.html`
  (confirmed: the live `/scorecard/` block is byte-identical to
  `index.web.html`). SEO pages: `board-cities/_template.html` plus the five
  generated files, and the four `calculator-guests/*.html` by hand. Do not
  touch `public/`; the compliance pages need nothing.
- **Escaping.** Any `<` inside a JSON string must be written `<` so a
  stray `</script>` in copy cannot close the block. None of the drafts above
  contain one; the rule matters when descriptions get edited later.
- **Deploy cost.** Netlify production deploys cost 15 credits each and the
  October budget is already over. Batch every schema change into one deploy
  with the Episode 4 update on 10-24, then run `npm run check:deploy`.
- **Routing.** Website edits go through the Security auditor to the Website
  session, per the hub-and-spoke rule. This document is the hand-off.

## Longer-term items

- **Embed the episodes** (lite-youtube or a plain iframe) so the VideoObject
  qualifies for Google's video rich result. Needs
  `https://www.youtube-nocookie.com` in `frame-src` and a consent check,
  since YouTube sets cookies; that is a data-law question for the Overseer
  before it is a schema question.
- **First ratings unlock the Software App rich result.** The ASO audit's
  in-app review prompt is the dependency. When ratings exist, add
  `aggregateRating` with the real `ratingValue` and `ratingCount` from the
  store, refreshed by hand on each listing check, never guessed.
- **Board on the App Store.** When the iOS listing is live, add its URL to
  `installUrl` and a second Offer with the store's actual price.
- **`/pit` as an ImageGallery** (45 photos, per the page) from
  `gallery-manifest.json`, low priority; and **sitemap `lastmod` hygiene**,
  tied to the deploy script so it stops lagging the content.

## Testing checklist (from the skill)

- [ ] Each requested Google appearance is currently supported, or a separate
      consumer is named (done above: FAQPage and SearchAction dropped)
- [ ] Every block validates at https://validator.schema.org/ and the supported
      types pass https://search.google.com/test/rich-results on the live URL
- [ ] Required-field errors resolved; recommended-field warnings reviewed
      (expect "aggregateRating missing" warnings on the apps; that is honest)
- [ ] Every statement in markup is visible on the page it sits on
- [ ] No ratings, review counts, prices or dates that did not come from the
      store, the page or Joel
- [ ] `/yourpit/` and `/catering/` carry no markup and are in no graph
- [ ] Search Console enhancement reports checked two weeks after deploy
      (Breadcrumbs, Videos; Software App appears only once ratings exist)

## Limitations

Live pages were fetched with curl, so what the four React app shells render
after JavaScript was not checked; the JSON-LD sits in the static `<head>`, so
Google reads it either way. The Scorecard App Store price was not re-fetched
(see Draft B). Rich Results Test and Search Console were not run (no browser
in this pass); the checklist covers them at implementation time.
