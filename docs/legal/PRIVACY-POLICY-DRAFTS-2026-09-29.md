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

**[DECISION FOR JOEL — EU/UK representative]**: A US controller offering services to EEA/UK users generally needs a local representative (GDPR Art. 27) unless processing is occasional, low-risk, and not large-scale — which these apps plausibly satisfy today. The drafts omit a representative on that exemption. Revisit if EEA usage becomes regular rather than incidental.

**[DECISION FOR JOEL — contact address]**: The drafts use `datadelete@holysmokesbbqco.com` as the single privacy contact, since it already exists and is monitored. If you want a distinct privacy@ alias, say so before publish.

---

## POLICY 1 — BBQ Scorecard

### Privacy Policy — BBQ Scorecard

**Last updated: [publish date]**

BBQ Scorecard is made by Holy Smokes BBQ Co ("we"). This policy explains what data the app and website handle, why, and the choices you have. It applies to the BBQ Scorecard app (Android and iOS) and the web version at holysmokesbbqco.com/scorecard/.

**What we collect and why**

*Your account (only if you sign in).* Name, email address, and profile photo from your Google or Apple account, or the email you sign up with, plus a friend code the app generates. We use these to run your account, sync your reviews between devices, and let friends you approve see what you share. Legal basis: performing our agreement with you (GDPR Art. 6(1)(b)).

*Your content.* The reviews you write — restaurant names, scores, notes, dates, and any photos you attach. Photos are stored in Google Firebase Storage; everything else in Google Firestore. Your content is visible to you and, where you share it, to friends you have approved. Nobody else can read it. Legal basis: performing our agreement with you.

*Usage analytics (only with your consent).* With your permission we use Google Analytics and Firebase Analytics to see which features get used, so we know what to improve. This is off until you say yes, and you can change your mind any time — in the app under Settings, on the website via the analytics banner choice. If you are signed in, analytics is linked to your account ID, not your name or email. Legal basis: consent (Art. 6(1)(a)).

*Crash reports.* The mobile apps send crash logs and basic diagnostics through Firebase Crashlytics so we can fix failures. Legal basis: our legitimate interest in keeping the app working (Art. 6(1)(f)). You can object using the contact below.

*Location (only when you use BBQ Near Me).* If you tap BBQ Near Me and allow location access, your approximate coordinates are sent to the OpenStreetMap Overpass API to find barbecue spots near you, and OpenStreetMap map tiles load around that point. We do not store your coordinates. Legal basis: performing the lookup you asked for.

**What we never do**

We do not sell your data. We do not run ads. We do not share your content with anyone except the friends you approve.

**Who processes data for us**

Google (Firebase: sign-in, database, photo storage, analytics, crash reports) and Netlify (website hosting). These providers process data on our instructions.

**Where data is processed**

Our servers are in the United States. If you use the app from the EEA, UK, or Switzerland, your data is transferred to the US. Google LLC is certified under the EU-US Data Privacy Framework, and standard contractual clauses apply where required.

**How long we keep it**

Account data and your content: until you delete them or your account. Analytics data: up to 14 months. Crash logs: per Firebase Crashlytics retention (90 days). Data on your own device stays until you delete the app or clear its data.

**Your rights**

Wherever you live, you can ask us for a copy of your data, ask us to correct or delete it, restrict or object to processing, take your data elsewhere, and withdraw consent at any time. Email datadelete@holysmokesbbqco.com and we will respond within a month. Deleting individual reviews in the app removes them from our servers immediately; full account deletion is described at our account deletion page and completed within 7 days. If you are in the EEA or UK you can also complain to your data protection authority (in the UK, the ICO).

**Children**

BBQ Scorecard is not directed at children under 13, and we do not knowingly collect their data.

**Changes**

If this policy changes, we will update this page and the date above.

---

## POLICY 2 — BBQ Notebook

### Privacy Policy — BBQ Notebook

**Last updated: [publish date]**

BBQ Notebook is made by Holy Smokes BBQ Co ("we"). This policy explains what data the app handles, why, and the choices you have. It applies to the BBQ Notebook app (Android) and the web version at holysmokesbbqco.com/notebook/.

**What we collect and why**

*Your account (only if you sign in).* Name, email address, and profile photo from your Google account, or the email you sign up with, plus a friend code the app generates. We use these to run your account, sync your cooks and recipes between devices, and let friends you approve see what you choose to share. Legal basis: performing our agreement with you (GDPR Art. 6(1)(b)).

*Your content.* Your cook logs (meat, rub, wood, temperatures, times, pit readings, notes, ratings, photos) and recipes. Photos are stored in Google Firebase Storage; everything else in Google Firestore. Cooks and recipes are private unless you mark them shared, and shared items are visible only to friends you have approved. Legal basis: performing our agreement with you.

*Weather at your location (only if you allow it).* When you log a cook, the app can fetch current weather from the US National Weather Service (api.weather.gov) using your approximate location, and saves the weather values — temperature, wind, humidity — with your cook. Your coordinates themselves are not stored on our servers. Legal basis: performing the lookup you asked for.

*Usage analytics (only with your consent).* With your permission we use Google Analytics and Firebase Analytics to see which features get used. This is off until you say yes, and you can change your mind any time in Settings. If you are signed in, analytics is linked to your account ID, not your name or email. Legal basis: consent (Art. 6(1)(a)).

*Crash reports.* The Android app sends crash logs and basic diagnostics through Firebase Crashlytics so we can fix failures. Legal basis: our legitimate interest in keeping the app working (Art. 6(1)(f)). You can object using the contact below.

**What we never do**

We do not sell your data. We do not run ads. We do not share your cooks or recipes with anyone except friends you approve, and only when you mark them shared.

**Who processes data for us**

Google (Firebase: sign-in, database, photo storage, analytics, crash reports) and Netlify (website hosting). The National Weather Service receives only the coordinates needed for the weather lookup you request.

**Where data is processed**

Our servers are in the United States. If you use the app from the EEA, UK, or Switzerland, your data is transferred to the US. Google LLC is certified under the EU-US Data Privacy Framework, and standard contractual clauses apply where required.

**How long we keep it**

Account data, cooks, recipes, and photos: until you delete them or your account. Analytics data: up to 14 months. Crash logs: per Firebase Crashlytics retention (90 days). Data on your own device stays until you delete the app or clear its data.

**Your rights**

Wherever you live, you can ask us for a copy of your data, ask us to correct or delete it, restrict or object to processing, take your data elsewhere, and withdraw consent at any time. Email datadelete@holysmokesbbqco.com and we will respond within a month. Deleting individual cooks or recipes in the app removes them and their photos from our servers immediately; full account deletion is described at our account deletion page and completed within 7 days. If you are in the EEA or UK you can also complain to your data protection authority (in the UK, the ICO).

**Children**

BBQ Notebook is not directed at children under 13, and we do not knowingly collect their data.

**Changes**

If this policy changes, we will update this page and the date above.

---

## POLICY 3 — BBQ Board

### Privacy Policy — BBQ Board

**Last updated: [publish date]**

BBQ Board is made by Holy Smokes BBQ Co ("we"). This policy explains what data the app handles, why, and the choices you have. It applies to the BBQ Board app (Android and iOS) and the web version at holysmokesbbqco.com/board/.

**The most important thing to know**

Board is a public price directory. Prices you submit are shown publicly to everyone using Board. Your name and email are never shown with a price — submissions display without your identity — but they are stored with your account internally so we can moderate abuse.

**What we collect and why**

*Browsing needs no account.* You can look up prices without signing in, and no account data is collected.

*Your account (only if you sign in to submit).* Name, email address, and profile photo from your Google or Apple account. Used to run your account and attribute your submissions internally. Legal basis: performing our agreement with you (GDPR Art. 6(1)(b)).

*Your submissions.* Store, cut, price, region, and any note you add, stored in Google Firestore and displayed publicly without your identity. Legal basis: performing our agreement with you; public display is the purpose of the service.

*Ad scans (only if you use Scan).* If you scan a store's weekly ad, the photo is processed on your device to read prices. The photo itself is not uploaded to our servers.

*Your region.* You pick a metro region so Board shows nearby prices. If you allow location access, it is used to suggest a region; your coordinates are not stored on our servers.

*Usage analytics (only with your consent).* With your permission we use Google Analytics and Firebase Analytics to see which features get used. Off until you say yes; change your mind any time in Settings. If you are signed in, analytics is linked to your account ID, not your name or email. Legal basis: consent (Art. 6(1)(a)).

*Crash reports.* The mobile apps send crash logs and basic diagnostics through Firebase Crashlytics so we can fix failures. Legal basis: our legitimate interest in keeping the app working (Art. 6(1)(f)). You can object using the contact below.

**What we never do**

We do not sell your data. We do not run ads. We never display your name or email with a price.

**Who processes data for us**

Google (Firebase: sign-in, database, analytics, crash reports) and Netlify (website hosting).

**Where data is processed**

Our servers are in the United States. If you use the app from the EEA, UK, or Switzerland, your data is transferred to the US. Google LLC is certified under the EU-US Data Privacy Framework, and standard contractual clauses apply where required.

**How long we keep it**

Account data: until you delete your account. Price submissions: you can delete your own submissions in the app at any time; because Board is a public directory, submissions you leave up remain published. Analytics data: up to 14 months. Crash logs: per Firebase Crashlytics retention (90 days).

**Your rights**

Wherever you live, you can ask us for a copy of your data, ask us to correct or delete it, restrict or object to processing, take your data elsewhere, and withdraw consent at any time. Email datadelete@holysmokesbbqco.com and we will respond within a month. If you are in the EEA or UK you can also complain to your data protection authority (in the UK, the ICO).

**Children**

BBQ Board is not directed at children under 13, and we do not knowingly collect their data.

**Changes**

If this policy changes, we will update this page and the date above.
