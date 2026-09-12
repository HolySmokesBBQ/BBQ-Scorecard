# Decisions: live price pipeline

**From:** Joel, via the secretary session, 2026-09-12. Joel delegated the two open calls ("do what you think is best"); these are the answers, on the record.
**Re:** `RESPONSE-live-price-pipeline.md`

1. **Scan badge: YES.** Third trust tier, labelled from the record's own data: "Shop website · checked <scan date>". Sits between operator-verified and community exactly as recommended. Rides the 2.4.1 queue.
2. **Backfill: YES, one pass, latest-per-city.** Publish the most recent pending file per city, discard older duplicates, then publish forward daily. Joel reviews the backfill batches; batch size at his pace, not all 180 in one sitting.
3. **Service-account key:** Joel's task, pending. He creates it in the Firebase console for holy-smokes-bbq-board and stores it in AppStoreConnect-Keys, never the repo. Wiring is yours once it exists.
4. **Scan-side note accepted:** publish-scan.mjs should take a git ref as well as file paths (`git show board/pending:data/<file>`), per your section 4. The board/pending plumbing is live as of the 9/11 evening run.

Green light: proceed to the spec in docs/superpowers/specs/, then the implementation plan. The counter-proposal supersedes the Netlify design in full; no parallel JSON endpoint gets built.
