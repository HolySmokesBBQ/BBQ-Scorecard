# Privacy Policy Drafts — L-3 (2026-09-29)

**From**: Overseer (counsel work product per COMPLIANCE-DATA-LAW-2026-09-29.md, item L-3)
**To**: Website session, for publication as replacements of `public/privacy.html`, `public/privacy-notebook.html`, `public/privacy-board.html`
**Status**: DRAFT — publish after the two bracketed decisions below are resolved with Joel.

## Implementation notes for the Website session

1. Three full policy texts follow; each replaces its page's body. Keep the existing page chrome/styling.
2. Set the "Last updated" date to the publish date.
3. antislop pass approved; no voice pass (legal text), correct.
4. The consent-withdrawal sentences assume the L-1 banner (web) and Settings toggle (apps) exist. **Do not publish before the L-1 web banner ships** — the policy must not describe controls that don't exist yet. Sequence: banner deploy, then policies in the same or next deploy.
5. `[BRACKETED]` items are the only open decisions; everything else is settled by the compliance memo.

**DECIDED (Joel, 2026-09-30) — EU/UK representative**: Art. 27 exemption taken (processing occasional, low-risk, not large-scale). No representative appointed. Revisit if EEA usage becomes regular rather than incidental.

**DECIDED (Joel, 2026-09-30) — contact address**: `datadelete@holysmokesbbqco.com` is the privacy contact.

**[PUBLISH-DAY SELECT — Board deletion sentence]** Board's date message will state whether the own-submission delete UI shipped in the live build (it is in 2.4.6 scope). Stage exactly one variant of the retention sentence:
- **Variant A (delete UI shipped):** "Price submissions: because Board is a public directory, they remain published until removed. You can delete your own submissions in the app at any time, or email datadelete@holysmokesbbqco.com and we will take one down."
- **Variant B (not shipped):** the sentence as currently drafted (email takedown only).

**All publish gates from Joel are now cleared.** Remaining gate is per-app: each policy publishes the day its app's consent release is live **on ALL its platforms — the LATER platform's day when Android and iOS differ** (Scorecard: both Android 4.3.0 Production and iOS 4.3.0 live; Board likewise at its turn; Notebook is Android-only, so its day is its day). Rationale: the page describes both platforms together, and publishing on the first platform's day makes it false for every user still on the other platform's pre-consent build. (Rule corrected 2026-09-30 by Scorecard via Website; the Overseer's earlier "first platform" acceptance was wrong.) The website-only sentences are already true.

---

## POLICY 1 — BBQ Scorecard

### Privacy Policy — BBQ Scorecard

**Last updated: [publish date]**

BBQ Scorecard is made by Holy Smokes BBQ Co ("we"). This policy explains what data the app and website handle, why, and the choices you have. It applies to the BBQ Scorecard app (Android and iOS), the web version at holysmokesbbqco.com/scorecard/, and the pages of holysmokesbbqco.com.

**What we collect and why**

*Your account (only if you sign in).* Name, email address, and profile photo from your Google or Apple account, or the email you sign up with, plus a friend code the app generates. We use these to run your account, sync your reviews between devices, and let friends you approve see what you share. Legal basis: performing our agreement with you (GDPR Art. 6(1)(b)).

*Your content.* The reviews you write — restaurant names, scores, notes, dates, and any photos you attach. Photos you attach stay with your content on your device; when cloud sync is available they are stored in Google Firebase Storage. Everything else syncs to Google Firestore. Your content is visible to you and, where you share it, to friends you have approved. Nobody else can read it. Legal basis: performing our agreement with you.

*Usage analytics (only with your consent).* With your permission we use Google Analytics and Firebase Analytics to see which features get used, so we know what to improve. In the app, this is off until you say yes and you can change your mind any time in Settings. On the website, visitors in the EEA, UK, and Switzerland are asked before analytics runs; elsewhere on the website it runs by default. Analytics is not linked to your account, name, or email. Google Analytics also records standard device and browser information, including an approximate location estimated from your IP address. Legal basis: consent (Art. 6(1)(a)).

*Crash reports.* The mobile apps send crash logs and basic diagnostics through Firebase Crashlytics so we can fix failures. Legal basis: our legitimate interest in keeping the app working (Art. 6(1)(f)). You can object using the contact below.

*Location (only when you use BBQ Near Me).* If you tap BBQ Near Me and allow location access, your coordinates, at the precision your device reports, are sent to the OpenStreetMap Overpass API to find barbecue spots near you, and OpenStreetMap map tiles load around that point (the tile servers receive your IP address and the map area you view). We do not store your coordinates. Legal basis: performing the lookup you asked for.

**What we don't do**

We do not sell your data. We do not run ads. We do not share your content with anyone except the friends you approve.

**Who processes data for us**

Google (Firebase: sign-in, database, photo storage, analytics, crash reports) and Netlify (website hosting). When you use BBQ Near Me, OpenStreetMap receives the coordinates you search from (Overpass API) and your IP address and the map area you view (tile servers). These providers process data on our instructions, except OpenStreetMap, which handles the lookup under its own privacy policy. Fonts are served from our own site; no font provider receives anything.

**Where data is processed**

Our servers are in the United States. If you use the app from the EEA, UK, or Switzerland, your data is transferred to the US. Google LLC is certified under the EU-US Data Privacy Framework, and standard contractual clauses apply where required.

**How long we keep it**

Account data and your content: until you delete them or your account. Analytics data: up to 14 months. Crash logs: per Firebase Crashlytics retention (90 days). Data on your own device stays until you delete the app or clear its data.

**Your rights**

Wherever you live, you can ask us for a copy of your data, ask us to correct or delete it, restrict or object to processing, take your data elsewhere, and withdraw consent at any time. To withdraw analytics consent on the website, use the "Analytics choices" link in the page footer; in the app, use the analytics setting in Settings. Our website does not respond to Do Not Track or Global Privacy Control browser signals; those two controls are how you turn analytics off here. Email datadelete@holysmokesbbqco.com and we will respond within a month. Deleting individual reviews in the app removes them from our servers immediately; full account deletion is described at our account deletion page and completed within 7 days. If you are in the EEA or UK you can also complain to your data protection authority (in the UK, the ICO).

**Children**

BBQ Scorecard is not directed at children under 16, and we do not knowingly collect their data.

**Changes**

If this policy changes, we will update this page and the date above.

---

## POLICY 2 — BBQ Notebook

### Privacy Policy — BBQ Notebook

**Last updated: [publish date]**

BBQ Notebook is made by Holy Smokes BBQ Co ("we"). This policy explains what data the app handles, why, and the choices you have. It applies to the BBQ Notebook app (Android), the web version at holysmokesbbqco.com/notebook/, and the pages of holysmokesbbqco.com.

**What we collect and why**

*Your account (only if you sign in).* Name, email address, and profile photo from your Google account, or the email you sign up with, plus a friend code the app generates. We use these to run your account, sync your cooks and recipes between devices, and let friends you approve see what you choose to share. Legal basis: performing our agreement with you (GDPR Art. 6(1)(b)).

*Your content.* Your cook logs (meat, rub, wood, temperatures, times, pit readings, notes, ratings, photos) and recipes. Photos you attach stay with your content on your device; when cloud sync is available they are stored in Google Firebase Storage. Everything else syncs to Google Firestore. Cooks and recipes are private unless you mark them shared, and shared items are visible only to friends you have approved. Legal basis: performing our agreement with you.

*Weather at your location (only if you allow it).* When you log a cook, the app can fetch current weather from the US National Weather Service (api.weather.gov) using your location rounded to about a mile, and saves the weather values — temperature, wind, humidity — with your cook. Your coordinates themselves are not stored on our servers. Legal basis: performing the lookup you asked for.

*Usage analytics (only with your consent).* With your permission we use Google Analytics and Firebase Analytics to see which features get used. In the app, this is off until you say yes and you can change your mind any time in Settings. On the website version, visitors in the EEA, UK, and Switzerland are asked before analytics runs; elsewhere on the website it runs by default. Analytics is not linked to your account, name, or email. Google Analytics also records standard device and browser information, including an approximate location estimated from your IP address. Legal basis: consent (Art. 6(1)(a)).

*Crash reports.* The Android app sends crash logs and basic diagnostics through Firebase Crashlytics so we can fix failures. Legal basis: our legitimate interest in keeping the app working (Art. 6(1)(f)). You can object using the contact below.

**What we don't do**

We do not sell your data. We do not run ads. We do not share your cooks or recipes with anyone except friends you approve, and only when you mark them shared.

**Who processes data for us**

Google (Firebase: sign-in, database, photo storage, analytics, crash reports) and Netlify (website hosting). The US National Weather Service (api.weather.gov) receives only your rounded coordinates for the weather lookup you request, under its own privacy policy. Fonts are served from our own site; no font provider receives anything.

**Where data is processed**

Our servers are in the United States. If you use the app from the EEA, UK, or Switzerland, your data is transferred to the US. Google LLC is certified under the EU-US Data Privacy Framework, and standard contractual clauses apply where required.

**How long we keep it**

Account data, cooks, recipes, and photos: until you delete them or your account. Analytics data: up to 14 months. Crash logs: per Firebase Crashlytics retention (90 days). Data on your own device stays until you delete the app or clear its data.

**Your rights**

Wherever you live, you can ask us for a copy of your data, ask us to correct or delete it, restrict or object to processing, take your data elsewhere, and withdraw consent at any time. To withdraw analytics consent on the website, use the "Analytics choices" link in the page footer; in the app, use the analytics setting in Settings. Our website does not respond to Do Not Track or Global Privacy Control browser signals; those two controls are how you turn analytics off here. Email datadelete@holysmokesbbqco.com and we will respond within a month. Deleting individual cooks or recipes in the app removes them and their photos from our servers immediately; full account deletion is described at our account deletion page and completed within 7 days. If you are in the EEA or UK you can also complain to your data protection authority (in the UK, the ICO).

**Children**

BBQ Notebook is not directed at children under 16, and we do not knowingly collect their data.

**Changes**

If this policy changes, we will update this page and the date above.

---

## POLICY 3 — BBQ Board

### Privacy Policy — BBQ Board

**Last updated: [publish date]**

BBQ Board is made by Holy Smokes BBQ Co ("we"). This policy explains what data the app handles, why, and the choices you have. It applies to the BBQ Board app (Android and iOS), the web version at holysmokesbbqco.com/board/, and the pages of holysmokesbbqco.com.

**The most important thing to know**

Board is a public price directory. Prices you submit are shown publicly to everyone using Board. Your name and email are not shown with a price; submissions display without your identity. Each submission is stored with an account identifier so we can moderate abuse.

**What we collect and why**

*Browsing needs no account.* You can look up prices without signing in, and no account data is collected.

*Your account (only if you sign in to submit).* Name, email address, and profile photo from your Google account. Used to run your account and attribute your submissions internally. If you submit using "Continue without an account," a random identifier, not linked to your name or email, is created so your submissions can be managed. Legal basis: performing our agreement with you (GDPR Art. 6(1)(b)).

*Your submissions.* Store, cut, price, region, and any note you add, stored in Google Firestore and displayed publicly without your identity. Legal basis: performing our agreement with you; public display is the purpose of the service.

*Ad scans (only if you use Scan).* If you scan a store's weekly ad, the photo is processed on your device to read prices. The photo itself is not uploaded to our servers.

*Your region.* You pick a metro region so Board shows nearby prices. If you allow location access, it is used to suggest a region; your coordinates are not stored on our servers.

*Usage analytics (only with your consent).* With your permission we use Google Analytics and Firebase Analytics to see which features get used. In the app, this is off until you say yes and you can change your mind any time in Settings. On the website version, visitors in the EEA, UK, and Switzerland are asked before analytics runs; elsewhere on the website it runs by default. Analytics is not linked to your account, name, or email. Google Analytics also records standard device and browser information, including an approximate location estimated from your IP address. Legal basis: consent (Art. 6(1)(a)).

*Crash reports.* The mobile apps send crash logs and basic diagnostics through Firebase Crashlytics so we can fix failures. Legal basis: our legitimate interest in keeping the app working (Art. 6(1)(f)). You can object using the contact below.

**What we don't do**

We do not sell your data. We do not run ads. We do not display your name or email with a price.

**Who processes data for us**

Google (Firebase: sign-in, database, analytics, crash reports) and Netlify (website hosting). The shop map loads tiles from OpenStreetMap, which receives your IP address and the map area you view under its own privacy policy. Fonts are served from our own site; no font provider receives anything.

**Where data is processed**

Our servers are in the United States. If you use the app from the EEA, UK, or Switzerland, your data is transferred to the US. Google LLC is certified under the EU-US Data Privacy Framework, and standard contractual clauses apply where required.

**How long we keep it**

Account data: until you delete your account. Price submissions: because Board is a public directory, they remain published until removed. To remove one of yours, email datadelete@holysmokesbbqco.com and we will take it down. Analytics data: up to 14 months. Crash logs: per Firebase Crashlytics retention (90 days).

**Your rights**

Wherever you live, you can ask us for a copy of your data, ask us to correct or delete it, restrict or object to processing, take your data elsewhere, and withdraw consent at any time. To withdraw analytics consent on the website, use the "Analytics choices" link in the page footer; in the app, use the analytics setting in Settings. Our website does not respond to Do Not Track or Global Privacy Control browser signals; those two controls are how you turn analytics off here. Email datadelete@holysmokesbbqco.com and we will respond within a month. Full account deletion is described at our account deletion page (/delete-account-board.html) and completed within 7 days. If you are in the EEA or UK you can also complain to your data protection authority (in the UK, the ICO).

**Children**

BBQ Board is not directed at children under 16, and we do not knowingly collect their data.

**Changes**

If this policy changes, we will update this page and the date above.
