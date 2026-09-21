# Scan-to-Firestore publish pipeline — design

**Date:** 2026-09-12
**App:** BBQ Board
**Supersedes:** `docs/planning/PROPOSAL-live-price-pipeline.md` (Netlify data-branch design), per `DECISIONS-live-price-pipeline.md`.
**Status:** awaiting Joel's review before an implementation plan is written.

## 1. Goal

Nightly scan output reaches users in seconds instead of on the next AAB, through the
runtime data layer Board already has. A reviewed scan file becomes Firestore
`board_prices` documents with one command. The bundled `seed.js` stays as the first-run
baseline and stops being the delivery path for scan data.

## 2. Scope

**In:**
- `scripts/publish-scan.mjs` — validate, dedupe, map and write scan proposals to Firestore.
- A third trust tier, `source: 'scan'`, rendered in the app with its own badge.
- One-pass backfill of the pending queue, then daily publishing.

**Out:**
- The scan itself and the `board/pending` branch plumbing (secretary session; live since 9/11).
- Any change to how the app surfaces national online shops across regions. A national shop's scan price lands in that shop's home region, same as its seed price does today.
- Firestore security-rule changes. The Admin SDK bypasses rules; client rules are untouched.
- Removing `seed.js`.

## 3. Data model

A published scan proposal becomes one `board_prices` document:

| Field | Value | From |
|---|---|---|
| `shopId` | proposal `shopId` | scan |
| `store` | `getShop(shopId).name` | shops.js |
| `storeType` | `getShop(shopId).storeType` | shops.js |
| `region` | `getShop(shopId).region` | shops.js — **never the scan's `region`**, which is `null` for national shops |
| `location` | `getShop(shopId).location` | shops.js |
| `cut` | proposal `cut` | scan |
| `pricePerLb` | proposal `pricePerLb` | scan |
| `reportedAt` | proposal `reportedAt` as a Firestore Timestamp | scan — the real scan time, not write time |
| `source` | `'scan'` | constant — the trust tier |
| `scanSource` | proposal `source` (`national_online` / `shopify` / `supermarket`) | scan — provenance, distinct from tier |
| `sourceUrl` | proposal `sourceUrl` | scan |
| `notes` | `productTitle` + `variantTitle` + pack price/weight, joined, capped at 500 chars | scan |
| `userId` | `'operator:scan'` | constant — satisfies the field, never a real uid |

Document id: `scan_<shopId>_<cut>_<YYYY-MM-DD>`. Deterministic, so re-publishing the same
day's file overwrites rather than duplicates, and the `seed_` prefix guard in the rules
is not touched.

`seed.js` records are unchanged. The app's merge in `App.board.jsx:135-152` already
takes every Firestore doc regardless of `source`; scan docs flow through it with no
change to the merge.

## 4. `scripts/publish-scan.mjs`

### Inputs

```
node scripts/publish-scan.mjs <file-or-ref> [<file-or-ref> ...] [--dry-run] [--key <path>]
```

Each argument is either a path to a `pending-prices-*.json` file, or a git ref of the
form `board/pending:data/<file>` read via `git show`. Mixed arguments are allowed.

`--key` defaults to `<home>\AppStoreConnect-Keys\holy-smokes-bbq-board-admin.json`, with `<home>` from `os.homedir()`.
The script refuses to run if that path is inside the repo.

### Validation — whole-file, fail-closed

Every proposal in every input is checked before anything is written. Any failure rejects
the entire run with a list of every failing record and reason. Nothing partial.

| Check | Rule |
|---|---|
| shop exists | `getShop(shopId)` is defined |
| cut exists | `cut` is in `CUT_ORDER` |
| region exists | `getShop(shopId).region` is in `REGIONS` (catches shops.js drift, the Sep 6 rules bug's cousin) |
| price is a number | `typeof pricePerLb === 'number' && isFinite` |
| global price band | `0.50 <= pricePerLb <= 100` |
| per-cut price band | see table below; outside the band is a rejection, not a warning |
| reportedAt | parses as ISO 8601, is not in the future, is within 30 days — a price older than that would arrive already stale under `isFresh`, so it is not worth publishing |
| sourceUrl | absent or a valid `https://` URL |

Per-cut bands, $/lb. Generous on purpose: the goal is to catch a decimal slip or a
pack price mistaken for a per-pound price, not to police the market.

| Cut | Min | Max |
|---|---|---|
| brisket_prime, brisket_choice, brisket_select | 2.00 | 30.00 |
| ribeye, filet_mignon, tbone, porterhouse | 6.00 | 80.00 |
| sirloin, flank, chuck_roast, tri_tip | 3.00 | 40.00 |
| ground_beef_80 | 2.00 | 20.00 |
| pork_shoulder, spare_ribs, baby_back_ribs | 1.00 | 20.00 |
| bratwurst_fresh, bratwurst_smoked | 2.00 | 20.00 |
| whole_chicken, chicken_breast | 0.75 | 15.00 |
| whole_turkey | 0.75 | 15.00 |

### Dedupe

Within a run, records are keyed by `(shopId, cut, reportedAt date)`. National shops
appear in every city's scan file — Porter Road is in both the 9/11 KC and Tulsa files —
so the same price arrives many times. Duplicates within a run collapse to one document.
Across runs, the deterministic document id makes a same-day re-publish an overwrite.

### Write

Batched through the Admin SDK in chunks of 400 (Firestore's batch limit is 500). Each
chunk commits atomically. The script prints the count written, the count deduped, and
the document ids.

### Dry run

`--dry-run` performs every validation and dedupe step and prints exactly what would be
written, then exits without touching Firestore or requiring the key file. This is the
review view: Joel runs dry-run first, reads the output, then runs it for real.

### Output

Exit 0 on success with a summary. Exit 1 on validation failure with every failing
record listed. Exit 2 on a Firestore write error, with the chunk that failed identified
so the run can be resumed.

## 5. App change: the scan badge

`App.board.jsx:1252` currently distinguishes two tiers:

```js
const isSeed = price && price.source === 'operator_verified';
```

This becomes a three-way tier:

| `source` | Badge text |
|---|---|
| `operator_verified` | existing seed badge, unchanged |
| `scan` | **Shop website · checked <Mon D>** — date from `reportedAt` |
| `community` (and anything else) | existing default, unchanged |

The badge is data-driven from the record itself, per the decision. No new state, no
new component — it extends the existing conditional. `sourceUrl`, when present, becomes
the tap target for the badge so a user can see the listing the price came from.

This is the only piece that ships in an AAB. It was written against the 2.4.1 queue,
but 2.4.1 and 2.4.2 shipped without it (2.4.1 was the service-worker fix, 2.4.2 the
error boundary), so it now targets the next queue rebuild after implementation. Scan
documents are readable by every shipped version today; they just render with the
default badge until the badge lands.

## 6. Security

- The service-account key lives in `AppStoreConnect-Keys\`, is never committed, and
  the script refuses a key path inside the repo. `.gitignore` gets `*-admin.json` as a
  second guard.
- The Admin SDK bypasses Firestore rules, so the existing `board_prices` create rules —
  which require `source == 'community'` and a real `userId` — are untouched. Clients
  still cannot forge a scan record.
- `userId: 'operator:scan'` cannot collide with a Firebase Auth uid (uids are 28-char
  alphanumerics) and cannot be claimed by a client, since rules require
  `request.resource.data.userId == request.auth.uid`.
- The `scan_` docId prefix is not protected by rules the way `seed_` is. It does not
  need to be: a client cannot write `source: 'scan'` at all under the current rules.

## 7. Testing

`scripts/publish-scan.test.mjs`, run with `node --test`:

- Validation: one test per rule in the table, each with a single bad record in an
  otherwise-good file, asserting the whole file is rejected and the reason names the
  record.
- Dedupe: two files containing the same national-shop record collapse to one document;
  same shop, same cut, different dates do not collapse.
- Mapping: a proposal with `region: null` produces a document whose `region` is the
  shop's home region from `shops.js`.
- Document id is deterministic and carries the date.
- Dry run writes nothing (Firestore client is a stub that throws if called).
- Git-ref input: `board/pending:data/<file>` reads the same bytes as the file on disk.

The Firestore write path is exercised once by hand against the live project with a
single record, then deleted, before the backfill — the same probe pattern used on Sep 6
to verify the rules deploy.

## 8. Rollout

1. Joel creates the service-account key; I wire the default path and run the
   single-record live probe.
2. Backfill, one pass: for each city, the most recent `pending-prices-*` file wins;
   older files for that city are skipped. A city whose most recent file is itself
   older than 30 days is skipped too — the validator would reject it, and correctly,
   since that price would be stale on arrival. Expect the backfill to publish
   noticeably fewer than 180 files; that is the rule working, not a failure. Joel
   reviews in batches at his own pace via `--dry-run`, then publishes each batch.
3. Daily: after each scan lands on `board/pending`, Joel (or a scheduled task, later)
   runs `publish-scan.mjs board/pending:data/<today's files>`.
4. The scan badge ships with 2.4.1.

## 9. Not decided, and deliberately so

- **Automating the daily publish.** Out of scope until the manual flow has run for a
  couple of weeks and the validator has seen real bad data. The review gate is the
  point; automation comes after trust.
- **Pruning `seed.js`.** Once scan data covers a shop, its Jul 1 seed price is
  redundant and the stale-at-90-days rule will hide it anyway. Leave it; revisit when
  the seed is genuinely in the way.
