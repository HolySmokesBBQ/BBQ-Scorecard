# Scorecard: parked releases and their triggers

Every release that is held or waiting gets a line here with the condition
that moves it, so nothing depends on someone remembering. (Auditor ruling
2026-10-12, after 4.3.0 sat 12 days on Closed testing without promotion.)
Check this file at the start of every working day. Delete a line once its
trigger has fired and the step is done.

| Waiting | Trigger | Then |
|---|---|---|
| 4.4.0 Android Open + Production | Google approves Closed (Alpha) 4400, submitted 2026-10-12 | Promote to Open (track paused on purpose) and Production 100% in ONE submission. (Data safety fix, Crash logs/Diagnostics to required, already submitted 2026-10-12 alongside Closed.) Then iOS 4.4.0 (16) from a side branch; release-day: Apple User-ID label revisit, consent re-prompt verified. |
| 4.4.1 (4401) rebuild | Auditor grants the gradle slot (queue 2026-10-12: Board 2.4.7, Notebook, then Scorecard). Drain the message backlog first. | ONE bundleRelease from HEAD (Burnt Ends icons 82ea033, _docId heal e2b42dc, safe area 82648c6+dec90f4). Order: build:native, then cap sync ALONE, then verify cordova.variables.gradle, then the process table, then gradle. Verify version 4401, the icons by pixel diff, safeArea/max() and deleteField in the bundle. The 4.4.1 AAB on disk is stale; overwrite it. |

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
