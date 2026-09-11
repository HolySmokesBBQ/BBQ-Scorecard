# Response: Split BBQ Board price data from app releases

**From:** BBQ Board Coder session, 2026-09-11.
**To:** Joel, cc the secretary session.
**Re:** `PROPOSAL-live-price-pipeline.md`
**Verdict:** The problem is real and worse than stated. The proposed fix builds a
second runtime data layer next to the one Board already has. Counter-proposal below
uses the existing one and is about a fifth of the effort.

Nothing has been built. This is the assessment you asked for.

---

## 1. The premise is wrong, and it matters

The proposal says *"the app stops bundling price data and fetches it at runtime."*

**Board already fetches price data at runtime.** On every load `App.board.jsx:105-116`
queries Firestore's `board_prices` collection for the active region and merges the
result with a bundled `SEED_PRICES` baseline (`App.board.jsx:135-152`). This is the
live layer whose missing composite index I fixed on Sep 6, which is why five
community prices became visible that day for the first time.

So Board has two price tiers, and the proposal conflates them:

| Tier | Path today | Latency |
|---|---|---|
| Community submissions | app -> Firestore -> every other user | seconds |
| Nightly scan output | `data/*.json` -> PR -> `seed.js` -> next AAB | ~2 weeks |

Only the second tier has a staleness queue. And it is not a 2-week queue in practice:
there are **180** `pending-prices-*.json` files on disk right now that never reached
`seed.js` at all. `seed.js` holds 134 records dated Jul 1. The scan has been running
for weeks into a folder nothing reads.

That reframes the fix. The question is not *"how do we give the app a runtime data
source"* -- it has one. The question is *"how does scan output get into the runtime
data source it already has."*

## 2. Counter-proposal: publish scan output to Firestore

Add a third source tier, `source: 'scan'`, and a one-command publish step:

```
node scripts/publish-scan.mjs data/pending-prices-2026-09-09-*.json
```

The script reads the reviewed JSON, denormalizes `store` / `storeType` / `region` /
`location` from `getShop(shopId)` (the scan record and the Firestore record are
otherwise the same shape), and batch-writes `board_prices` docs through the Firebase
Admin SDK. Joel's review gate becomes: look at the pending JSON, run the script.
Prices are live in seconds, not on the next AAB.

What this needs:

- **`firebase-admin` as a devDependency.** Not installed today.
- **One service-account key** for `holy-smokes-bbq-board`, created in the Firebase
  console, stored at `C:\Users\jmuil\AppStoreConnect-Keys\` alongside the `.p8` -- never
  in the repo. Admin SDK bypasses security rules, so no rules change is needed for the
  write path.
- **A `'scan'` source badge in the UI.** `App.board.jsx:1252` treats only
  `'operator_verified'` as trusted seed; `'community'` is the default. Scan prices
  want their own label ("from the shop's website, checked <date>") so users can weigh
  them. Small change, but a product decision -- see section 7.
- **`seed.js` stays** as the first-run / offline baseline, exactly the fallback the
  proposal wanted. It just stops being the delivery path for scan data.

### Why this beats the Netlify design

**It doesn't build what already exists.** The proposal's runtime fetch, stale-while-
revalidate cache, bundled fallback, schema-versioning story and hosting endpoint are
all things Firestore + `seed.js` already do. Adding a parallel JSON endpoint means two
sources of truth for the same records, two freshness models, and two failure modes.

**It doesn't reintroduce the service worker.** The proposal's *"PWA fetches with
stale-while-revalidate"* is a precaching service worker. Board just spent Sep 7
removing one: it held the WebView on 2.3.9's bundle after the 2.4.0 update because
Android preserves Cache Storage across upgrades, and Joel saw a day-old broken UI on a
correct install. 2.4.1 ships a self-destroying worker specifically to clean that up.
Bringing a caching layer back for price data is the same trap with a different
payload, and the native WebView doesn't need it -- assets are on disk.

**It doesn't depend on Netlify.** The proposal itself flags that the Netlify account
had a billing flag in August. Both GCP billing accounts closed Sep 3 and Firebase is
on Spark; Firestore stayed up through that, Storage did not. The existing live layer
has already survived the outage the new one would be exposed to.

**Freshness is already solved.** Every Firestore record carries `reportedAt`; the app
marks anything past 30 days stale and past 90 days hidden (`isFresh` / `isStale` in
`schema.js`). Daily scan writes are always inside the fresh window. No TTL design
needed.

**Spark quota is fine.** Firestore free tier is 20k writes/day. The scan produces
roughly 10 proposals per city per run; even publishing all 109 cities daily is ~1,100
writes. Reads are the existing pattern (<=500 docs per region per load) and unchanged.

## 3. Holes in the original design, beyond the premise

- **Merge-to-`data/live` as the review gate has no validation.** Q5 asks whether a
  validation script should gate the merge. Yes, and the counter-proposal makes it
  unavoidable: `publish-scan.mjs` *is* the gate. It should refuse any record whose
  `shopId` isn't in `shops.js`, whose `cut` isn't in `CUT_ORDER`, whose `region` isn't
  in `REGIONS` (the rules-allowlist drift from Sep 6 was exactly this class of bug,
  caught late because nothing checked), or whose `pricePerLb` is outside a sane band
  per cut. Refuse the whole file on any failure so a partial publish can't happen.
- **Per-city files vs one blob is the wrong question for the counter-proposal.**
  Firestore is already queried per region. The scan already writes per city. Nothing to
  decide.
- **Schema versioning is a non-problem.** Firestore docs are schemaless and the app
  reads fields by name; adding a field is additive. The one real risk is a scan record
  format change breaking `publish-scan.mjs`, which the validation step catches.
- **The proposal has the app "fetching at runtime" but keeps biweekly AABs shipping
  "a refreshed fallback snapshot."** That means every release still regenerates
  `seed.js` from live data, which is a second sync mechanism to maintain. Under the
  counter-proposal `seed.js` is a genuine baseline that changes rarely (new shops, new
  cities), not a snapshot that must track Firestore.

## 4. The scan-side plumbing fix

Agreed, ship it regardless. Plumbing commits to a standing `board/pending` branch is
sound and removes the `/tmp` worktree failure. Two notes for whoever implements it:

- The 9/9 run did **not** lose its output. Both JSON files were on disk, valid, 10
  entries each, untracked. The failure mode is "written but not committed," not
  "written to a sandbox that evaporated." The recovery advice in that thread would have
  re-run a scan that had already succeeded.
- `publish-scan.mjs` should accept a git ref as well as file paths, so the review flow
  can be `git show board/pending:data/<file>` -> publish, without checking anything out.

## 5. Answers to the seven questions

1. **Endpoint shape** -- moot. Firestore, queried per region, already.
2. **Schema/versioning** -- no version field needed. Additive fields only; the publish
   script validates the scan format on the way in.
3. **Service worker** -- none, deliberately. See section 2. Firestore's own SDK cache
   handles the offline read case; `seed.js` handles first run.
4. **Hosting** -- no new hosting. Firestore is the endpoint. Netlify billing status
   becomes irrelevant to this feature.
5. **Promotion mechanics** -- a validating publish script is the gate, not a branch
   merge. A merge can be done by hand and skip checks; a script cannot.
6. **Other consumers** -- the website fork (`website/src/board/`) has its own
   `seed.js` and its own Firebase client pointed at the same project, so it picks up
   Firestore writes automatically. The `board-cities` page under `dist/` reads
   `schema.js`, not prices. Nothing else consumes `seed.js`.
7. **Effort** -- below.

## 6. Effort

| Piece | Estimate |
|---|---|
| `scripts/publish-scan.mjs` with validation, dry-run, and git-ref input | 1 day |
| Service-account key (Joel creates; I wire it) | 15 min |
| `'scan'` badge + label in the price row | 1/2 day |
| Backfill: run the script over the 180 pending files, reviewed in batches | Joel's time, not mine |
| Tests for the validator (shopId/cut/region/price band, refuse-whole-file) | included in day 1 |

**About 1 1/2 days of build**, no app-side architecture change, no new hosting, no
release needed to start -- the publish script works against today's live 2.4.0. The
badge is the only piece that rides an AAB, and it can go in 2.4.1's queue.

Against that, the Netlify design is a fetch layer, a cache strategy, a fallback
snapshot regeneration step, a data branch, a Netlify site config, a hosting check,
and a schema-version field, plus reintroducing a service worker. I'd put it at a
week, and it would leave Board with two live data paths to keep consistent.

## 7. What I need decided before a spec

One product question, one confirmation:

- **How should scan prices be labelled?** They're less trusted than a price Joel saw
  in person but more trusted than an anonymous submission. Recommend a third badge:
  "Shop website - checked Sep 9". Yes/no.
- **Confirm the 180 pending files are worth backfilling**, or whether to publish
  forward from the next scan only. Recommend publishing the most recent file per city
  and discarding older duplicates -- one pass, then daily.

If both are yes, next step is a spec in `docs/superpowers/specs/` and then an
implementation plan. Nothing gets built before that.
