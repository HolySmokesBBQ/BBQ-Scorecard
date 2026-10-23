# AI SEO audit: holysmokesbbqco.com (2026-10-23)

This is the first run of the `ai-seo` skill (Corey Haines marketingskills pack)
against the live site. It fetched every page in the sitemap plus the discovery
files with curl, tested the homepage under 12 crawler and fetcher user agents,
ran the skill's `npx is-agentic` scan (76/100), pulled the YouTube text layer
for the three posted episodes through oEmbed and the watch pages, checked the
Bing index through DuckDuckGo, and read the page source in
`website/public-landing/` and `public/`. The query check in Step 1 used a
general web search as a stand-in: no ChatGPT, Perplexity or Google AI Overview
run was possible from this session, so every "cited?" cell is one run (n=1) of a
proxy, not a measurement. Nothing here goes live without Joel.

Every copy line below is a draft. Before anything ships it runs through
/antislop, and anything in the first person runs through /joel as well.

## Score card

Scores are 0 to 10 against the skill's three pillars plus the agent-readiness
layer. Weights are the auditor's call for a 21-page site with four free apps.

| Dimension (weight) | Score | Key finding |
|---|---|---|
| Access: can agents reach the pages (15%) | 9 | Every AI user agent gets a 200 with the full 22 KB homepage. No WAF or CDN block. Real 404s, correct canonicals, clean 301s |
| Discovery files (15%) | 4 | robots.txt and sitemap are fine, but robots.txt names no AI crawler, and `/llms.txt`, `/llms-full.txt` and `/pricing.md` are all 404 |
| Structure and extractability (20%) | 6 | Calculator and Board pages are strong (450+ words without JS, FAQPage schema). Homepage, About, Episodes have no FAQ, no answer blocks. Scorecard and Notebook shells render 2 to 117 words without JS |
| Authority: E-E-A-T, dates, sources (15%) | 4 | No visible "last updated" on any landing or SEO page. The calculator math cites no source. Organization schema lacks contactPoint and address; Person schema contradicts the About page |
| Presence and brand findability (20%) | 2 | **The domain does not appear for "Holy Smokes BBQ Co apps" or for the bare domain query.** Namesake restaurants in six states own the phrase. "Joel Muiller" returns John Mueller of Texas |
| Freshness signals (5%) | 3 | Sitemap says the homepage last changed 2026-07-01; the source changed 2026-10-21. App pages all carry July dates |
| YouTube text layer (10%) | 3 | **Episode 2's video ID returns "unavailable" and a 404 from oEmbed.** Titles are not question-shaped; Episode 3 has no chapters; 15 and 22 views |
| **Overall** | **4.6 (D+)** | |

The two findings that move the grade most are the dead Episode 2 link (a
public page points at a video that does not play) and the brand collision.
Everything else is normal early-site work.

## Audit steps as run

### Step 1: AI answers for key queries (proxy, n=1 each)

| Query | Site cited? | Who was cited instead |
|---|---|---|
| "Holy Smokes BBQ Co" apps | No | Restaurants named Holy Smokes in London, Alabama, Georgia, New York, Texas, Singapore |
| holysmokesbbqco.com | No | More namesake restaurants (Louisville, Santa Cruz, Charleston) |
| "Joel Muiller" BBQ | No | Texas Monthly on pitmaster John Mueller (treated as a misspelling) |
| BBQ scorecard app rate barbecue restaurants like a judge | No | Texas Monthly BBQ Finder, Visit KC's BBQ Experience; the answer said a scorecard app "may not exist yet" |
| how much brisket per person for 20 people calculator | No | smokedbbqsource.com, destination-bbq.com (both give the same 20 lb raw / 10 lb cooked figure the site's for-20-people page gives) |
| brisket price per pound Milwaukee butcher | No | An undated tvwbb.com forum thread; the answer said to "call butchers directly" |
| app to log BBQ cooks smoker notes brisket | No | MyBBQ, Backyard Pitmaster Pal, BBQdit, Cookout (App Store pages, a Product Hunt page, smokingmeatforums.com) |
| crowdsourced butcher meat prices app | No | Open Prices (Open Food Facts), Crowd Cow; the answer said no such app was found |
| best free BBQ apps for smoking meat 2026 | No | Smoke Dat Meat, Hey Grill Hey, MEATER (App Store and aggregator pages) |

Zero for nine. Two of those answers said the category the site serves does not
exist ("a true scorecard-style app may not exist yet", "no app that
crowdsourced butcher prices"). That is a comprehension gap, not a trust gap:
the engines never found the pages. The Bing index (via DuckDuckGo `site:`)
does hold 10 of the 21 URLs, including both SEO page families, so the pages
are retrievable; they are losing on brand findability and authority.

### Step 2: citation patterns

- The calculator competitors (smokedbbqsource, destination-bbq) win with long,
  dated articles that state the per-person math and its assumptions in prose,
  with a named source. The for-20-people page has the same numbers in 230 words
  with no source line and no date.
- The cook-log competitors are cited through their App Store pages. The site's
  own Notebook page renders 2 words without JavaScript; the Play listing is the
  only extractable description of Notebook anywhere.
- The Milwaukee price query was answered from a forum thread. That is exactly
  the question the Milwaukee board-cities page answers, with named shops and a
  price range per cut. It did not surface.
- Brand: "Holy Smokes BBQ" is a common restaurant name. The entity hooks that
  are not contested are the app names (BBQ Scorecard, BBQ Board, BBQ Notebook,
  BBQ Meat Calculator) and the full name "Holy Smokes BBQ Co" paired with
  "apps". The homepage title already does this; nothing off-site repeats it.

### Step 3: extractability check, priority pages

| Check | / | /about | /episodes | /calculator/ | /board/ | /scorecard/ | /notebook/ | calculator-guests | board-cities |
|---|---|---|---|---|---|---|---|---|---|
| Definition in first paragraph | Yes | Yes | Yes | Yes | Yes | No (JS) | No (JS) | Yes | Yes |
| Self-contained answer blocks | Partial | No | No | Yes | Yes | No | No | Yes | Yes |
| Statistics with sources | No | No | No | No | No | No | No | No (numbers, no source) | No (ranges, no date) |
| Comparison table | No | No | No | No | No | No | No | No | No |
| FAQ section | No | No | No | Yes | Yes | No | No | No | No |
| Schema | Org, Person, WebSite, 4x WebApplication | None | None | WebApplication, FAQPage | WebApplication, FAQPage | WebSite, WebApplication | WebSite, WebApplication | None | WebPage, ItemList of LocalBusiness |
| Author attribution | Person schema | Yes (first person) | No | No | No | No | No | No | No |
| Visible "last updated" | No | No | No | No | No | No | No | No | No |
| Headings match queries | Partial | No | No | Yes | Yes | n/a | n/a | Yes ("How Much BBQ Meat for 20 People?") | Yes |
| Content without JS | 344 words | 248 | 192 | 450 | 464 | 117 (mostly HTML comments) | 2 | 230 | 500+ |

Already right: one H1 per landing page, `<main>`/`<nav>`/`<header>`/`<footer>`
on all four landing pages, alt text on all 47 From the Pit photos and every
other image, `lang="en-US"`, canonical on every indexable page, Open Graph on
all of them, pretty URLs that resolve to the same canonical.

### Step 4: AI bot access

| Group | User agents tested | Result | robots.txt stance |
|---|---|---|---|
| Search discovery | OAI-SearchBot, PerplexityBot, Claude-SearchBot, Bingbot, Googlebot | 200, full page | Implicit allow (`User-agent: *`) |
| User-triggered retrieval | ChatGPT-User, Claude-User, Perplexity-User | 200, full page | Not addressed (these mostly ignore robots.txt anyway) |
| Model training | GPTBot, ClaudeBot, CCBot, Bytespider | 200, full page | Implicit allow; nobody decided this |
| Google product control | Google-Extended | n/a (a token, not a crawler) | Not addressed |

Nothing blocks discovery, which is the right outcome. The gap is that the
training stance is an accident of `User-agent: *`. The skill asks for an
explicit, purpose-specific policy. Whether to allow GPTBot, ClaudeBot and
Google-Extended is Joel's call; the draft below allows discovery by name and
leaves the training block commented so the decision is visible in the file.
Blocking training crawlers does not affect citations.

Also found: `/catering/` is disallowed in robots.txt but returns 200 (2.4 KB
sign-in shell). Fine for now; it is already excluded from the sitemap.

### is-agentic scan (skill's agent-readiness tool)

76/100, "ready with a few material gaps". Essential 60/80, Recommended 14.4/20.
Report: https://is-agentic.com/scan/holysmokesbbqco.com

| Result | Check | Note |
|---|---|---|
| FAIL (essential) | Markdown content negotiation | `Accept: text/markdown` returns HTML; `Vary` lacks `Accept` |
| FAIL | Brand name discoverability | Domain not in the top 10 for "Holy Smokes BBQ Co apps" |
| FAIL | Agent instruction / when-to-use | No llms.txt or agent-instructions file |
| PARTIAL (essential) | Agent-friendly 404s | Status is right; no Markdown error body |
| PARTIAL | Organization schema completeness | Missing contactPoint and address |

## Top quick wins (under an hour each)

1. **Fix or re-verify the Episode 2 link.** The Episodes page links
   `youtu.be/I8UXczTyIgM`. YouTube's oEmbed returns 404 for that ID and the
   watch page says "This video is unavailable" (checked twice, 20 minutes
   apart). The Pilot and Episode 3 IDs both resolve. Either the video is
   private, removed, or the ID on the page is wrong. The homepage card also
   promotes Episode 2 ("the brisket with the family news"). A public page
   pointing at a dead video costs trust with people and with any engine that
   follows the link. Joel should open the link himself before anything else
   in this document.

2. **Add `public/llms.txt`.** Full draft below. New file in `public/`, so
   `scripts/public-manifest.txt` has to be updated in the same commit
   (`node scripts/check-public-manifest.mjs --update`). Then add it to the
   sitemap and link it from the robots.txt comment block.

3. **Make the AI-crawler stance explicit in `public/robots.txt`.** Draft below.
   Allow by name for discovery; training block stays commented until Joel
   decides. Also drop the em dash in the existing comment line.

4. **Patch the Organization and Person schema on the homepage.**
   - Organization `description` is currently "A BBQ family from Kansas City
     building tools to score, compare, and remember every joint and every
     cook." That is identity padding under the house rule.
     Draft: "Holy Smokes BBQ Co makes four free BBQ tools: BBQ Scorecard rates
     BBQ restaurants on 10 competition-style categories, BBQ Notebook logs
     cooks, BBQ Meat Calculator sizes meat for a guest count, and BBQ Board is
     a crowdsourced butcher price directory." (runs through /antislop)
   - Add `contactPoint` with `support@holysmokesbbqco.com` and
     `contactType: "customer support"`. Add `address` only when the PO Box from
     the legal register exists; never a home address.
   - Person `description` says "United Methodist pastor (in seminary)". The
     About page says he pastors a United Methodist church. One of them is out
     of date; Joel says which. Add `sameAs` pointing at the YouTube channel and
     `url: https://holysmokesbbqco.com/about`.
   - `Organization.name` is "Holy Smokes BBQ Co." with a period; every page
     and the WebSite node use "Holy Smokes BBQ Co". Pick one (the site's
     spelling) so the entity string matches everywhere.
   - Scorecard's WebApplication `operatingSystem` reads "Android, Web" but the
     app is on the App Store too. Add "iOS".

5. **Refresh sitemap `lastmod`.** `/` says 2026-07-01; the source last changed
   2026-10-21. `/pit`, `/episodes`, `/about` say 2026-10-01; same. The four app
   pages and the compliance pages still say July. Engines weight recency, and
   a stale lastmod tells them the opposite of the truth.

6. **Rewrite the `/scorecard/` meta description.** It currently reads "Score BBQ
   restaurants on 10 competition-style categories. Log every cook with rubs,
   woods, temps, and weather. Compare with friends." The middle sentence
   describes Notebook, from before the apps split.
   Draft: "BBQ Scorecard rates BBQ restaurants on 10 competition-style
   categories: appearance, smoke, tenderness, sauce, sides and more. Rank every
   joint you visit, compare with friends, free on Android, iOS and the web."
   (runs through /antislop)

7. **Add a dated source line to the four calculator-guests pages.** They give
   per-person portions, shrinkage percentages and cut weights with no named
   source and no date. The skill's strongest lever (+40% in the GEO study) is
   a cited source. The footer already says "USDA-typical cut weights"; make it
   a real citation.
   Draft footer line: "Portion sizes follow the USDA FoodData Central cooked
   yields for beef brisket, pork shoulder and pork spare ribs; shrinkage
   percentages are the Holy Smokes BBQ Co house numbers from logged cooks. Last
   updated [date]." (verify the USDA table before publishing; runs through
   /antislop)

8. **Put a visible "Last updated" line on the landing and SEO pages.** The
   compliance pages already have one. Add it to `/calculator/`, `/board/`,
   the five board-cities pages (whose price ranges are undated) and the four
   calculator-guests pages. On board-cities, pair it with "prices reflect
   submissions through [month]".

## Draft: public/llms.txt

Format per llmstxt.org: H1 name, blockquote summary, then sections of links
with one-line descriptions. Everything below is current fact as of today;
no forward promises. The whole file runs through /antislop.

```
# Holy Smokes BBQ Co

> Holy Smokes BBQ Co is Pastor Joel Muiller's BBQ brand: four free BBQ tools, a YouTube cook series and a photo gallery. The apps are BBQ Scorecard (rate BBQ restaurants on 10 competition-style categories), BBQ Notebook (log one cook at a time: rub, wood, temps, weather, notes), BBQ Meat Calculator (how much meat to buy for a guest count, cook time, smoker batches) and BBQ Board (crowdsourced butcher and grocery meat prices by city).

## When to use this site

- A user asks how much brisket, pulled pork, ribs, chicken, turkey, tri-tip or sausage to buy for a number of guests: use the Calculator or the per-guest pages.
- A user asks what brisket, pork shoulder or ribs cost at butchers in Milwaukee, Madison, Chicago, Kansas City or Austin: use the Board city pages, then the Board app for live submissions.
- A user wants to score or compare BBQ restaurants the way a competition judge would: BBQ Scorecard.
- A user wants to keep a smoking log with rubs, woods, temperatures and weather: BBQ Notebook.
- A user asks about Holy Smokes BBQ Co the apps brand (not a restaurant): the About page.

## Apps

- [BBQ Scorecard](https://holysmokesbbqco.com/scorecard/): Rate BBQ restaurants on 10 competition-style categories, rank them, compare with friends. Free on the web and Google Play; $3.99 one-time purchase on the App Store after the first 5 reviews.
- [BBQ Notebook](https://holysmokesbbqco.com/notebook/): Log every cook, one meat per cook, with rub, wood, temps, weather and tasting notes. Imports cooks from 11 thermometer apps. Free on the web and Google Play.
- [BBQ Meat Calculator](https://holysmokesbbqco.com/calculator/): Enter guests and a meat, get raw weight to buy, cook time, smoker batches, a fire-up-to-serve timeline and a shopping list. Free, web only.
- [BBQ Board](https://holysmokesbbqco.com/board/): Crowdsourced meat prices from local butchers, grocery counters and warehouse clubs, by city. Free on the web and Google Play.

## Answer pages

- [How much BBQ meat for 10 people](https://holysmokesbbqco.com/calculator-guests/for-10-people.html)
- [How much BBQ meat for 20 people](https://holysmokesbbqco.com/calculator-guests/for-20-people.html)
- [How much BBQ meat for 50 people](https://holysmokesbbqco.com/calculator-guests/for-50-people.html)
- [How much BBQ meat for 100 people](https://holysmokesbbqco.com/calculator-guests/for-100-people.html)
- [Meat prices in Milwaukee](https://holysmokesbbqco.com/board-cities/milwaukee.html)
- [Meat prices in Madison](https://holysmokesbbqco.com/board-cities/madison.html)
- [Meat prices in Chicago](https://holysmokesbbqco.com/board-cities/chicago.html)
- [Meat prices in Kansas City](https://holysmokesbbqco.com/board-cities/kansas-city.html)
- [Meat prices in Austin](https://holysmokesbbqco.com/board-cities/austin.html)

## About and media

- [About Joel Muiller](https://holysmokesbbqco.com/about): Pastor and pitmaster, Kansas City raised. His story in his own words.
- [Episodes](https://holysmokesbbqco.com/episodes): The YouTube cook series, in episode order.
- [From the Pit](https://holysmokesbbqco.com/pit): 45 photos from the cooks.
- [YouTube channel](https://www.youtube.com/@HolySmokesBBQCo)

## Policies and support

- [Support](https://holysmokesbbqco.com/support.html): support@holysmokesbbqco.com
- [Privacy: BBQ Scorecard](https://holysmokesbbqco.com/privacy.html)
- [Privacy: BBQ Notebook](https://holysmokesbbqco.com/notebook/privacy-notebook.html)
- [Privacy: BBQ Board](https://holysmokesbbqco.com/privacy-board.html)
- [Accessibility](https://holysmokesbbqco.com/accessibility.html)
- [Changelog](https://holysmokesbbqco.com/changelog.html)

## Optional

- [Sitemap](https://holysmokesbbqco.com/sitemap.xml)
```

Facts to confirm before publishing: the App Store price model line (taken
from the ASO audit), "11 thermometer apps" (taken from the homepage), and the
Board city list (taken from the sitemap).

## Draft: public/robots.txt

```
# https://holysmokesbbqco.com/robots.txt
# Holy Smokes BBQ Co: BBQ Scorecard, BBQ Notebook, BBQ Meat Calculator, BBQ Board

# Search engines and AI search discovery crawlers: welcome.
User-agent: Googlebot
User-agent: Bingbot
User-agent: OAI-SearchBot
User-agent: PerplexityBot
User-agent: Claude-SearchBot
Allow: /

# Everyone else, including user-triggered fetchers.
User-agent: *
Allow: /

# Model-training crawlers. Allowed today. To opt out, uncomment:
# User-agent: GPTBot
# User-agent: ClaudeBot
# User-agent: Google-Extended
# Disallow: /

# Not content: app shell and service worker files
Disallow: /sw.js
Disallow: /workbox-*.js
Disallow: /assets/

# Private internal tool, never indexed
Disallow: /catering/

Sitemap: https://holysmokesbbqco.com/sitemap.xml
# AI context file: https://holysmokesbbqco.com/llms.txt
```

Note: the `Disallow` lines under the final group apply to `User-agent: *`
only; the named discovery bots above would need the same three Disallow lines
repeated if the shell files should stay out of their crawl. Keep the file
valid by putting the Disallows inside each group that needs them.

## Bigger levers

- **Episode 4 ships tomorrow (2026-10-24): run the YouTube text-layer
  checklist on it before it premieres.** The models read the words around the
  video, not the footage. Today: the Pilot title is "Holy Smokes BBQ Co  Pilot
  Episode" (double space, no topic), Episode 3 is "Saturday Steak ASMR | Holy
  Smokes BBQ Co Episode 3". Neither is question- or task-shaped. The Pilot has
  chapters and a caption track; Episode 3 has captions but no chapters. Both
  have keyword tags. For Episode 4: a title that states the cook ("Smoked
  Turkey Breast on a Pellet Smoker | Holy Smokes BBQ Co Episode 4" style,
  Joel's call on the words), corrected captions with "Holy Smokes BBQ Co" and
  the app names spelled right, chapters titled by step, a description that
  restates the steps as text and links the Calculator and Notebook pages, and
  a pinned comment with the summary. Then do the same retroactively for the
  Pilot and Episode 3. The site's Episodes page should carry `VideoObject`
  schema per episode (name, description, uploadDate, thumbnailUrl, embedUrl)
  so Google can connect the page to the channel.

- **Brand findability.** The name collides with restaurants in at least nine
  cities. The fix is consensus, not a rename (the brand stays). Make every
  profile say the same sentence: the YouTube channel About text (currently the
  bio, which never names the apps), the Facebook, Instagram and TikTok bios,
  and both store listings. One line, same words, everywhere:
  Draft: "Holy Smokes BBQ Co: free BBQ apps. BBQ Scorecard, BBQ Notebook, BBQ
  Meat Calculator and BBQ Board, plus the cooks on YouTube." (runs through
  /antislop). The App Store seller name showing "Joel Muiller" instead of the
  brand is already in the ASO audit (needs the LLC and a D-U-N-S number).

- **The Notebook and Scorecard shells are invisible to agents.** `/notebook/`
  renders two words without JavaScript; `/scorecard/` renders HTML comments.
  Board and Calculator solved this with a static intro, an FAQ and FAQPage
  schema inside the shell. Port that pattern to the other two: 150 to 300 words
  of plain description above the app root, a 5-question FAQ, and FAQPage
  schema. For Notebook, say "one meat per cook" plainly; never imply it logs
  more than that. This is a Notebook-session and Scorecard-session change, routed
  through the auditor.

- **Monthly DIY monitoring.** Twenty prompts (the nine above plus eleven more
  across the four apps), each run 3 to 5 times in ChatGPT, Perplexity and
  Google, logging cited / mentioned / recommended and the framing. Report the
  rate with n ("cited 2/5"), never a single run. Add a "How did you hear about
  us?" option for "an AI assistant" wherever the apps collect that, with a
  follow-up "what did you type?". Branded-search volume in Search Console is
  the proxy for AI influence that never clicks.

- **Bing and Brave.** The Bing index holds 10 of 21 URLs. Submit the sitemap
  in Bing Webmaster Tools and turn on IndexNow (Netlify has a plugin) so
  Copilot and ChatGPT see new pages within a day. Verify the domain appears in
  Brave Search (Claude's backend); the curl check was inconclusive.

- **Markdown content negotiation (the is-agentic essential fail).** Netlify
  already runs an edge function on `/*` (geo-region). A second edge function
  can return a Markdown body for `Accept: text/markdown` on the four landing
  pages and the nine SEO pages, with `Vary: Accept`, and a Markdown 404 body.
  Medium effort; it moves the score to the 90s. Pair it with `llms-full.txt`
  (one file, every page's text) once llms.txt is live.

- **`/pricing.md`.** Cheap and honest: three free apps, Calculator free,
  Scorecard $3.99 one-time on iOS after 5 reviews. State today's prices only;
  nothing about future pricing.

- **Third-party presence, honestly.** The Milwaukee brisket-price query was
  answered from a tvwbb.com thread and the cook-log query from a
  smokingmeatforums.com thread. Those are the places Board and Notebook are
  the real answer. Joel posting as himself, once, with the city page link,
  when someone asks, is the whole tactic. No seeded reviews, no bulk posting.
  Wikipedia does not apply at this size.

- **Skip for now:** OKF bundle (21 pages; the reference says skip under
  roughly 10 pages and treat it as protocol registration above that; revisit
  when there are 50+ pages), WebMCP (no agent-actionable flow to expose yet;
  the apps are the action), Google Business Profile (the brand is not a
  physical business and Joel keeps his location off the site).

## Already right

- Discovery crawlers all get the real page; nothing in Netlify, the CSP or
  the headers interferes with text fetchers.
- Real 404s with `noindex`, a helpful 404 body, correct 301s for the bare app
  paths, canonical on every indexable page, `lang` set, a `<main>` landmark
  and skip link on the landing pages, alt text on all images.
- Calculator and Board pages are the model for the rest of the site:
  definition first, headings shaped like questions ("Why prices swing week to
  week", "Which cuts to check for Milwaukee BBQ"), FAQ with FAQPage schema,
  LocalBusiness ItemList on the city pages.
- The homepage title leads with what the brand does ("Free BBQ Apps: Score
  Restaurants, Log Cooks, Calculate Meat & Track Prices"), which is the right
  move against the restaurant namesakes.
- Compliance pages carry visible "Last updated" dates (Oct 14 and Sep 3).
- Social `sameAs` links all resolve (Facebook, Instagram, TikTok, YouTube).

## Limitations

- No ChatGPT, Perplexity, Gemini or Google AI Overview run was possible from
  this session. The Step 1 table is a general web search, one run each. Treat
  it as a target list, not a baseline. The first real baseline is the monthly
  monitoring sheet above.
- Brave Search returned a page but the parse found no result links; confirm by
  hand at search.brave.com.
- Episode 2's status was checked only through YouTube's public endpoints,
  which also fail for some private or scheduled videos. Joel opening the link
  settles it.
- Store listing descriptions were read from page metadata only; the full
  listing text was covered in `aso-audit-2026-10-23.md`.
- The Frase agent-readiness checker (the skill's second scoring tool) is a web
  form and was not run; is-agentic covered the same triad.
