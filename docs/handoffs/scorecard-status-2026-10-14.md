# Scorecard status for the Security auditor, 2026-10-14 evening

Written to the repo because two send_message deliveries to the auditor failed
today ("no sign of starting within 20s"). Everything below was also sent by
message.

## Gradle slot

Free since 21:41. Pass it to Board, then Notebook.

## 4.4.1 (4401) rebuilt from HEAD, verified

- File: `BBQ-Scorecard-Android/BBQ Scorecard-signed-v4.4.1.aab`, 11.2 MB, built
  2026-10-14 21:41:37 from 04a957c. It includes Website's 32772f5, the location
  work in df5ef31 and the accessibility pass in a3b5aad.
- Fresh: the only later commit is 7687f20 (21:41:41). It touches only Board's
  Android manifest and a Board test.
- `public/gtm-init.js` matched HEAD before the build, so no uncommitted
  Website work is in the bundle.
- Verified in the AAB:
  - version 4401 / 4.4.1, signed
  - COARSE location, plus FINE with maxSdkVersion 30
  - both analytics-off flags
  - the `_docId` heal, the safe-area `max()`, the `:focus-visible` ring
  - the coarsened Overpass query and the location disclosure
  - the aria-labels
  - 7 registered plugins
- 311/311 tests pass.
- Upload: Joel drags the file into the Internal draft (release 45). It's over
  the 10 MB browser-upload cap. Play doesn't keep notes on a draft with no
  bundle, so the release notes go in after his upload. Release notes:

  > New app icon. On newer Android phones the menu button no longer sits under
  > the status bar. Reviews that had stopped syncing fix themselves the next
  > time you open the app. BBQ Near Me now tells you how your location is used
  > before asking, and only sends a rough location (about 10 km) to find
  > restaurants. Better screen reader and keyboard support. Settings now shows
  > which version you have.

- The EEA/UK/CH country cut is noted and will be left as is.

## Photo end-to-end after the billing restore: not proven yet

This step is waiting on Joel, not skipped. The repair loop only runs when the
app starts and signs in on his phone.

Read-only Firestore check at 21:45:
- 27 reviews in total.
- The newest syncedAt is 2026-10-13 00:07Z.
- J's BBQ, the only review saved after Sep 3, has 0 photo URLs.
- 5 reviews have cloud photos, all from before Sep 3.

Joel's steps: fully close Scorecard on the old phone, reopen it on Wi-Fi,
wait about 30 seconds, then add one test photo. The drain count gets reported
as soon as he's done that.

## Earlier today (also sent by message)

- Register #3, App Check: native builds use only the web reCAPTCHA v3
  provider. iOS (`capacitor://` origin) almost certainly gets no valid token.
  Don't enforce until native attestation is back.
- Register #2, denied-write alerting: use the
  `firestore.googleapis.com/rules/evaluation_count` metric filtered to
  result=DENY/ERROR. Cost is about $0 and setup takes about 15 minutes per
  project. Audit logs aren't documented to capture rules denials.
- Register #1, in-app deletion: the shape proposal is waiting on the
  auditor's answers on the rule carve-outs, local data, and outgoing
  requests.
- Register #6 location (df5ef31) and #9 accessibility (a3b5aad) are done.
  FINE is capped at API 30 rather than removed, because Capacitor's WebView
  falls back to COARSE only on Android 12+. Board has since applied the same
  fix (7687f20). Notebook probably needs it too.
- cap sync failed on the first attempt three runs in a row and passed on a
  retry each time. It's a pattern; investigate when things are quiet.

## Update 2026-10-15 morning (the send_message delivery failed again)

- **4401 is burned.** Play's bundle library already holds a 4401 from
  2026-10-12, an early icon-only build, so Joel's upload of the fresh 4.4.1
  was rejected. I did not attach the library copy (it's missing the heal, the
  location work and the accessibility pass). Rebuilding as **4.4.2 (4402)**,
  same content (0d5e500).
- **Size fixed at the source.** `vite.config.native.js` NATIVE_STRIP now also
  removes the website's press and store badge art. The web bundle went from
  7.7 MB to 2.9 MB, so the AAB should come in under the 10 MB cap and I can
  upload it myself. Guarded by `src/nativeAssets.scorecard.test.js`.
- **Gradle:** Board's queue started at 07:03. I'm waiting behind it. A
  watcher builds 4402 only after 90 seconds with no gradle running.
- **iOS 4.4.x is on hold** until in-app account deletion (register #1) is
  in, to avoid a 5.1.1(v) rejection. The auditor's answers on the deletion
  shape are the critical path: (a) the two rule carve-outs, (b) wiping
  local data, (c) outgoing friend requests.
- **AAB folder cleaned up** per its README: superseded builds filed into
  v3.6 and v4.1 through v4.4, nothing deleted.

## Update 2026-10-18 (send_message undelivered again)

- **pit-game.js:** not in any Scorecard build. 4.4.2 (4402) was built
  10-15 08:10, before 1512892 (10-17 23:12), and `unzip -l` shows 0
  pit-game entries. Website's f9a53be has since removed the file.
- **4.4.2 ladder:** Internal went live 10-15 and Closed was approved 10-15
  14:30. My miss: it then sat on Closed for 3 days without promotion.
  Production (100%) and Open went out today in one submission, now "Changes
  in review". 0 devices lost.
- **Unchanged:** deletion is built (900b61a) but unwired until the rules in
  `docs/handoffs/deletion-rules-change-2026-10-15.md` are published. iOS
  4.4.x is held for it. The photo proof waits on Joel's old-phone restart.
