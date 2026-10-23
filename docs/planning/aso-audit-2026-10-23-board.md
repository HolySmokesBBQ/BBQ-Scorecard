# ASO audit: BBQ Board, Google Play (2026-10-23)

This is the `aso` skill (Corey Haines marketingskills pack), run the same way
as Scorecard's audit (aso-audit-2026-10-23.md). It reads the live public Play
page and checks the listing's claims against Board's code. Scoring uses the
**Challenger** tier, which scores strictly against textbook ASO.

**iOS:** there is no App Store listing to audit. Board ships on iOS through
TestFlight only, so this audit covers Google Play. The notes at the end
apply when an App Store listing is created.

Every copy line below is a draft. Before anything goes live it runs through
/antislop. The house rules apply: no em dashes, and no "cheapest brisket"
price callouts in marketing (Joel, 10/12).

## Score card

| Dimension (weight) | Score | Key issue |
|---|---|---|
| Title & short description (20%) | 6 | Title uses 23 of 30 characters and contains an em dash. The short description is strong at 78/80 |
| Description (15%) | 5 | Keywords are good, but four claims no longer match the app (below) |
| Visual assets (25%) | 6 | 4 captioned screenshots (8 allowed). No video |
| Ratings & reviews (20%) | 0 | **Zero ratings.** Board has no in-app review prompt in the code |
| Metadata & freshness (10%) | 6 | Updated Oct 15. English only. Data safety over-declares Photos |
| Conversion signals (10%) | 4 | "1+ downloads", no social proof |
| **Overall** | **46 (D)** | |

The grade matches Scorecard's, for the same main reason: no ratings.
Board's own priority is different, though. Four lines in the description
describe features the app doesn't have, and fixing them comes before any
keyword work.

## Fix first: description claims that don't match the app

The full description is indexed on Play, so fixing these also counts as
keyword work. Each item was checked against the code.

1. **"verified prices from Kettle Range Meat Co., Bavaria Sausage Kitchen..."**
   - The legal exposure register (#13) already rules that the "Verified"
     badge becomes a dated "Checked <date>", because nobody verifies
     community prices. The listing repeats the same claim.
   - Draft: "At launch: prices checked in person at Kettle Range Meat Co.,
     Bavaria Sausage Kitchen, Bunzel's and Ray's Butcher Shoppe, plus
     Costco, Sam's Club, Walmart and Hy-Vee."
   - Also drop "At launch". The app has been live since July.
2. **"Every listing shows who reported it and when."**
   - Board shows only the age ("Reported 3 days ago"), never who reported
     it, and showing reporters would be a privacy change.
   - Draft: "Every price shows how many days ago it was reported."
3. **"Sign in with Google. Photo of the price tag or type it in."**
   - Submitting works without an account (anonymous sign-in), and the scan
     reads a weekly ad, not a price tag.
   - Draft: "Submit a price with or without a Google account. Type it in, or
     scan a weekly ad and pick the prices you want."
4. **"...and BBQ Calculator (plan how much meat to buy)."**
   - This lists the Calculator as a fourth app. Marketing's rule is that the
     Calculator is a website tool, not an app. Mirror Board's About screen:
     "...BBQ Scorecard and BBQ Notebook, with the BBQ Calculator on the
     website."

**Joel's call: the opening paragraph.** The description opens on a
three-store brisket price comparison ("Costco Prime brisket at $5.99/lb...").
Price comparison is literally Board's product, so it's defensible in a
store listing. It still runs against the 10/12 direction to lead with the
community and the tool. A community-first opening would be: "Every price on
Board was posted by someone who just bought that cut. Find what brisket,
ribs and pork butt cost at the butchers and grocers near you, and post what
you paid so the next cook can find it too." That's 218 characters and needs
/antislop. I recommend the community-first opening.

## Quick wins (under an hour each)

1. **Title: "BBQ Board: Butcher Meat Prices" (30/30).**
   - This replaces the em dash, uses the 7 spare characters, and adds
     "butcher", the word the description says is the point. It keeps the
     brand first. It's a brand call, so it goes to Joel.
   - Fallback without the brand change: "BBQ Board: Meat Prices" (21/30).
2. **Short description: keep it.** "Crowdsourced brisket, ribs, pork butt
   prices at butchers and grocers near you." (78/80) puts the four
   strongest keywords in the second-strongest indexed field.
3. **Description fixes 1 to 4 above.** These are text-only, so they go live
   with no app release.
4. **Data safety: remove Photos.** The auditor ruled it goes at the next
   form edit, so do it in the same Play session as fix 3.

## Bigger levers

- **In-app review prompt (code).** There is no review-request code in Board,
  the same gap as Scorecard. Ask once, right after a user's 2nd successful
  price submission, never on first launch and never after an error.
  - It needs a Capacitor plugin, so the registry doctrine applies:
    BOARD_NATIVE_PLUGINS, both gradle files, and nativePlugins.test.js all
    change together.
  - Coordinate with Scorecard so the two apps use the same plugin and the
    same rules.
  - It ships in the next code version, together with anonymous account
    deletion.
- **Screenshots (Joel makes these).** Go from 4 to 8:
  - Add the ad scan, Your Submissions (delete your own prices) and Near me.
  - Captions stay one message each, the way "LOCAL BUTCHERS ALL ON ONE MAP"
    already works.
  - Check all 8 against the Burnt Ends rebrand.
  - store-listing/ has a 5th shot (About) that isn't on the live listing.
    It's the weakest of the five, so that's fine.
- **Localization:** Spanish later, once there are submitters to serve.

## Found in passing: in-app copy that's now wrong

The submit sheet tells anonymous users: "Anonymous submissions can't be
edited or deleted later" (src/App.board.jsx:1842). Since 2.4.8 they can
delete them in Settings → Your submissions, on the same install. The line
is only true after a reinstall. Draft: "You can delete prices you post from
Settings on this phone. Sign in with Google to keep them if you switch
phones." This needs a code release, so it rides the next version with the
review prompt and anonymous deletion.

## Already right

- **Category:** Food & Drink.
- **Rating:** Everyone.
- **What's new:** plain and specific.
- **Keywords:** the description's closing keyword paragraph ("brisket prices
  near me, local butcher deals, pork butt prices...") is natural and
  on-target, and so is the full cut list.

## When Board gets an App Store listing

- Apple doesn't index the long description. Search comes from the title (30),
  subtitle (30) and the hidden keyword field (100 bytes).
- Suggested subtitle: "Brisket & butcher prices" (24/30). Keep its words
  out of the keyword field.
- Don't name another platform anywhere in the listing (Apple rejected
  Scorecard 4.0.0 over it).

## Limitations

- Search volume, ranking positions and install conversion need paid tools or
  the Play Console stats.
- The feature graphic and the store's tags can't be confirmed from the
  public page.
- At "1+ downloads", ASO is not the bottleneck. Submitters are. See the
  community-marketing and onboarding audits.
