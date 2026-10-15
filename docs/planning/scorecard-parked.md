# Scorecard: parked releases and their triggers

Every release that is held or waiting gets a line here with the condition
that moves it, so nothing depends on someone remembering. (Auditor ruling
2026-10-12, after 4.3.0 sat 12 days on Closed testing without promotion.)
Check this file at the start of every working day. Delete a line once its
trigger has fired and the step is done.

| Waiting | Trigger | Then |
|---|---|---|
| 4.4.1 (4401) Internal | Joel drags BBQ-Scorecard-Android/BBQ Scorecard-signed-v4.4.1.aab (11.2 MB, over the 10 MB browser-upload cap) into the saved Internal draft (release 45, notes already in) | Save and publish Internal, then Closed, then Open + Production, as with 4.4.0. Built and verified 2026-10-14 from 91cf8da. |
| Photo end-to-end proof | Joel fully restarts Scorecard (4.4.0+) on the old phone and adds a test photo | Read-only Firestore: J's BBQ photos[] gets https URLs, Storage reviews/<uid>/... has objects. Report the drain count to the auditor. |
| Native AAB size | Next version | dist-native carries website-only brand art from public/ (the AAB went 9.8 MB to 11.2 MB). Exclude what the app doesn't use, to get back under the 10 MB self-upload cap. |
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
