# Data-Law Compliance Memo — 2026-09-29

**From**: Overseer, acting as data-protection counsel per Joel's 2026-09-29 role expansion
**Trigger**: Apps expanding to overseas distribution
**Standard applied**: EU/UK GDPR + ePrivacy as the high-water mark. Meeting it substantially covers Canada (PIPEDA), Brazil (LGPD), and Australia. Every claim below was verified against current code on 2026-09-29; file:line cited.

---

## The one-paragraph opinion

The apps are in decent shape on data *minimization* (no ad tech, no data sales, modest PII: email, display name, photos, cooks/reviews, coarse location for weather/regions) and deletion now genuinely works. They are **not ready for EEA/UK distribution** on two grounds that are cheap to fix and routinely enforced: analytics runs without consent on every surface, and the privacy policies disclose none of what European law requires. **Recommendation: do not enable EEA/UK country availability until L-1 and L-3 below are closed.** Everything else can follow within a normal release cadence.

---

## L-1 — BLOCKER: Analytics collection without consent, every surface

**Web** — `public/gtm-init.js:49-51` sets Consent Mode defaults to `analytics_storage: 'granted'` before any user interaction. The comment at line 46 states the rationale: *"US-only audience, no ads — grant analytics, deny ad signals."* That premise is now false by decision. For EEA/UK visitors, analytics storage requires **prior opt-in** (ePrivacy Art. 5(3), GDPR-standard consent); "granted by default, no banner" is the fact pattern in a long line of CNIL/DSB enforcement.

**Native (all three apps)** — no `setConsent` or `setCollectionEnabled` call exists anywhere in `src/` (verified by grep). `@capacitor-firebase/analytics` therefore collects from first launch. Google's EU User Consent Policy independently requires consent signals for EEA end users.

**Fix (scoped to keep US behavior unchanged):**
- Web: region-conditional consent — default `denied` for EEA/UK (Consent Mode v2 `region` parameter or a geo-gated banner), keep current behavior for US. A minimal self-built banner is fine at this traffic level; no paid CMP needed.
- Native: on first launch, a one-time analytics consent screen for EEA/UK locales (or simpler: ship `setCollectionEnabled(false)` until consent for everyone — cleanest, tiny data cost).
- **Owners**: Website session (web); each app session (native). Route after Joel approves the approach.

## L-2 — HIGH: Any signed-in user can enumerate every user's email

`firestore.rules:98-99`: `match /users/{userId} { allow read: if isSignedIn(); }` — the whole collection is listable and profile docs still carry `email`. One throwaway account harvests the entire userbase's emails. Under GDPR this is an Art. 32 failure (appropriate security), and if exploited it is a notifiable personal-data breach (Art. 33, 72-hour clock). This was flagged in the July audit as an accepted tradeoff; overseas distribution changes the calculus.

**Fix**: the profile split recommended in July — owner-only doc (email + private fields), public subdoc (displayName/photoURL/friendCode) for friend discovery. Shared rules + client reads across Scorecard/Notebook: **Overseer specs it, app sessions adjust reads, coordinated rules deploy.**

## L-3 — BLOCKER (paired with L-1): Privacy policies disclose nothing GDPR requires

`public/privacy.html`, `privacy-notebook.html`, `privacy-board.html`: grep for GDPR elements returns **zero hits** in all three — no legal basis, no retention periods, no international-transfer disclosure, no user-rights enumeration (access/erasure/portability/objection), no supervisory-authority mention. Firebase processes data in the US, so an Art. 13 notice must disclose the transfer and its mechanism (Google LLC is certified under the EU-US Data Privacy Framework — the disclosure is straightforward, it just has to exist).

**Fix**: I draft the three policy revisions (counsel work product); Website session publishes. One template, three app-specific variants. Include: controller identity (Holy Smokes BBQ Co / Joel), data categories, purposes + legal bases (contract for accounts/sync; consent for analytics; legitimate interest for crash logs), retention, transfer + DPF disclosure, rights + how to exercise (datadelete@ + in-app), complaint right.

## L-4 — MEDIUM: Erasure pipeline is manual but its promises are now true

Verified fixed: `deleteCloudReview` + `deleteReviewPhotos` + tombstones wired (`src/context/AppContext.jsx:114, 1028-1029`) — individual deletion now actually erases server-side, closing July's S-2, which had made the deletion pages' claims false. Account deletion remains a manual email process (`datadelete@`, 7-day promise). GDPR allows a month; 7 days is fine **if honored** — the legal risk is operational (a missed email = broken promise in writing). Recommendation: lightweight — a logged checklist per request; longer-term, in-app account deletion (Play already nudges this direction).

## L-5 — MEDIUM: Store declarations must match reality in every territory

Standing memory: Notebook and Board likely still carry the Data Safety analytics gap (Scorecard's fixed 2026-07-20). Inaccurate Play Data Safety / Apple privacy labels are enforceable listing violations everywhere and consumer-law exposure in the EU. Ties to F-10's missing `PrivacyInfo.xcprivacy`. **Owners**: each app session verifies its console declarations before any new-territory rollout; Overseer drives the console review (browser).

## L-6 — LOW: Board public price data + userId attribution

`board_prices` docs carry `userId` and are world-readable. A Firebase UID tied to submissions is personal data under GDPR (identifiability via combination). Exposure is low (opaque UID, no profile join for signed-out readers — profile reads require sign-in, see L-2). Post-L-2, consider whether public price reads need `userId` at all; serving it only to the owner/moderation path would moot the question.

---

## Sequencing for the overseas rollout

| Gate | Item | Owner | Status |
|---|---|---|---|
| **Before enabling any EEA/UK availability** | L-1 consent (web + native) | Website + 3 app sessions | not started |
| **Before enabling any EEA/UK availability** | L-3 policies | Overseer drafts → Website publishes | not started |
| First release after | L-2 profile split | Overseer spec → sessions | not started |
| First release after | L-5 declarations re-check | app sessions + Overseer console pass | partially (Scorecard done) |
| Normal cadence | L-4 deletion ops, L-6 userId | Overseer / Board | L-4 promises now true |

**When real counsel is warranted** (flagging now so it's never a surprise): any regulator correspondence, a data-breach event, or if a future feature adds payments/health/children's data. Nothing in today's scope requires it.
