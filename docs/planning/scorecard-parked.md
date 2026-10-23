# Scorecard: parked releases and their triggers

Every release that is held or waiting gets a line here with the condition
that moves it, so nothing depends on someone remembering. (Auditor ruling
2026-10-12, after 4.3.0 sat 12 days on Closed testing without promotion.)
Check this file at the start of every working day. Delete a line once its
trigger has fired and the step is done.

| Waiting | Trigger | Then |
|---|---|---|
| Android 4.4.4 (4404), the rating prompt: audit PASS (no Data safety change, auditor ruling 10/23). Internal live 10/23 18:26; Closed (Alpha) submitted 10/23 | Closed approved (Publishing overview clear, Closed shows 4404 Active) | Promote Open and Production together, one submission, 100%. Re-check at the start of every session. Next release AAB: build from a clean HEAD worktree (auditor doctrine 10/23) and flag the auditor before any gradle run. |
| iOS 4.4.3 (16) APPROVED, Pending Developer Release (2026-10-23) | Joel clicks Release (or tells me to) | Then set the App Store Promotional Text, which is locked until the version is live: "Your first 5 reviews are free. One $3.99 purchase unlocks unlimited reviews, and reviews you've already saved stay open." iOS 4.4.4 rides the next Codemagic build. |
| Delete Account device test | Joel signs in with a throwaway account on 4.4.3 and runs Settings > Delete Account | Confirm in the console: users/{uid}, reviews, friendCode, Storage folder and the Auth record are all gone. |
| Photo end-to-end proof | Joel fully restarts Scorecard (4.4.0+) on the old phone and adds a test photo | Read-only Firestore: J's BBQ photos[] gets https URLs, Storage reviews/<uid>/... has objects. Report the drain count to the auditor. |

## Requirements for the per-app consent versions (before building)

- Each app has its own version value. Scorecard bumps with the 4.4.0
  sentence; **Board stays 1 and Notebook stays 1.** Board 2.4.6 is live on
  Internal with grants stored as textVersion 1, so seeding Board anywhere
  else would re-prompt every Board user and stop analytics until they answer.
- Versions are opaque per-app tokens compared with **strict equality**. No
  coercion or normalizing (values differ in type across the office:
  integers natively, date strings on the web).
- Legacy fallback: a stored `{ textVersion: 1 }` under the old shared key
  counts as valid for any app whose version is 1.
- Store each app's answer under its own key. Web apps share one origin, so
  one shared record would make Scorecard and Notebook re-prompt each other
  back and forth. Read your own key first, then the legacy key; always write
  your own key.
- Tests in the consent.js suite: one per app showing its existing stored shape
  validates without a prompt, plus Scorecard's v1 record re-prompting after
  the bump. Board re-verifies on its next rebuild.
