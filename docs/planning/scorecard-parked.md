# Scorecard: parked releases and their triggers

Every release that is held or waiting gets a line here with the condition
that moves it, so nothing depends on someone remembering. (Auditor ruling
2026-10-12, after 4.3.0 sat 12 days on Closed testing without promotion.)
Check this file at the start of every working day. Delete a line once its
trigger has fired and the step is done.

| Waiting | Trigger | Then |
|---|---|---|
| 4.4.2 (4402) Open + Production | Google approves Closed (Alpha) 4402, submitted 2026-10-15 08:15 | Promote to Open and Production 100% in ONE submission. 4402 replaces 4401, which is burned in Play's library by an Oct 12 icon-only upload. AAB is 6.4 MB after the native press-art strip (0d5e500). |
| In-app account deletion | Auditor commits and publishes the rules in docs/handoffs/deletion-rules-change-2026-10-15.md, then I verify the live ruleset in the console | Apply docs/handoffs/Settings.deletion-wiring.jsx.txt (Settings button), test on device, ship in the next Android version, then unblock iOS 4.4.x. Code: 900b61a. |
| Photo end-to-end proof | Joel fully restarts Scorecard (4.4.0+) on the old phone and adds a test photo | Read-only Firestore: J's BBQ photos[] gets https URLs, Storage reviews/<uid>/... has objects. Report the drain count to the auditor. |
| iOS 4.4.x | 4.4.1 Android on Production | Codemagic build from a side branch, App Store submission, Joel's manual release. Release day: the Apple User-ID label revisit. |

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
