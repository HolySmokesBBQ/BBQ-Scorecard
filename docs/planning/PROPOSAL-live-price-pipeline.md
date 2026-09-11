# Proposal: Split BBQ Board price data from app releases

**From:** Joel's secretary session, 9/11/2026, at Joel's direction.
**To:** BBQ Board Coder (Claude Code instance).
**Ask:** Assess this, poke holes in it, counter-propose where it's wrong, and estimate effort. Joel wants it thought through hard before anything is built — run it through /superpowers or whatever planning discipline you use. Nothing here is decided except the problem being real.

## The problem

1. **Data staleness queue.** BBQ Board app releases ship every ~2 weeks and bundle the price data. The nightly scan collects butcher prices continuously, so scanned cities sit in a queue up to two weeks before users see them. Prices can be stale on arrival.
2. **The scan's git staging keeps breaking.** The overnight scan task stages JSON via a git worktree in /tmp plus a fresh daily branch (`board/daily-scrub-YYYY-MM-DD`). The task sandbox's /tmp evaporates between sessions (orphaning worktree registrations) and the unattended run cannot delete files (locks and stale refs accumulate). Result, recurring: `worktree add` aborts, JSONs land on disk uncommitted, manual cleanup needed. The 9/11 run failed exactly this way.

## Proposed shape

**Scan side (secretary implements, in the task prompt):** replace the worktree flow with plumbing commits to one standing local branch, `board/pending`. Temp index (`GIT_INDEX_FILE`), `read-tree` from the branch tip, add the new JSONs, `write-tree`, `commit-tree`, `update-ref refs/heads/board/pending`. No worktree, no daily branches, no deletes, working copy untouched. One commit per run, timestamped trail, a bad scan can be dropped by rewinding one commit. Nothing is pushed by the task, ever.

**App side (yours, if it survives your review):** the app stops bundling price data and fetches it at runtime.

- A data branch (say `data/live`) holds the reviewed `prices.json` (or per-city files — your call, see questions).
- Netlify auto-deploys that branch as a static data endpoint. Push = live in minutes.
- Joel's review flow becomes: inspect `board/pending` → merge to `data/live` → push. Human review stays the gate; it just gets cheap enough to do every few days instead of per release.
- PWA fetches with stale-while-revalidate; keep a bundled snapshot as first-run/offline fallback so a failed fetch degrades to today's behavior, never worse.
- Biweekly app releases keep shipping code only (plus a refreshed fallback snapshot).

## Open questions for you

1. Endpoint shape: single prices.json vs per-city files vs city index + lazy per-city fetch? (109-city roster, coverage was ~50/109.)
2. Schema/versioning: does current bundled data have a schema version the runtime fetch should carry? Migration story when the schema changes mid-cycle?
3. Service worker: current caching strategy, and what TTL/revalidation makes sense for price data?
4. Hosting: Netlify data-branch deploy vs the existing site's own deploy vs GitHub raw. Netlify account status should be verified before relying on it (a billing flag existed in August).
5. Promotion mechanics: is merge `board/pending` → `data/live` the right review gate, or do you want a validation script (schema check, sanity ranges on prices) as a required step before anything merges?
6. Does anything else consume the bundled data (widgets, exports, the Holy Smokes site) that would need the same endpoint?
7. Effort estimate, and whether this fits the current release cadence or wants its own small release.

## What happens regardless

The scan-side plumbing fix ships independently of your verdict — it fixes the nightly failures whether or not the runtime-fetch idea survives. If you counter-propose a different app-side design, the standing `board/pending` branch should still work as your input.

Reply however you normally report — a file next to this one is fine. Joel reads both sides before anything is built.
