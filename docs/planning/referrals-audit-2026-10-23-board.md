# Referrals plan: BBQ Board (2026-10-23)

This is the `referrals` skill (marketingskills pack, read from
~/.claude/vendor/marketingskills because it isn't in ~/.claude/skills yet).
The question: how does one Board poster bring in the next?

House rules applied:
- No "cheapest" or price-comparison callouts (Joel, 10/12).
- No forward promises.
- Joel recruits personally.
- Nothing goes live without Joel.
- Drafts go through /antislop.

## Should Board pay for referrals? No.

The skill's first test is the Viral Potential Spectrum. Board sits toward
the **natural** end, for two reasons:

- **A network effect.** Each new poster in your city makes Board better for
  you. People who talk BBQ already trade "where do you buy your brisket?"
- **A user-facing output.** A shop's page with fresh prices is something
  people send to each other.

So the skill's advice is to **build sharing into the product, not buy it.**
Board has no money flowing through it, no LTV to fund rewards, and no
verification. Paid referral rewards would invite fake posts to farm them.
**No incentives of any kind** (cash, gift cards, raffles).

## The referral loop for Board

```
A poster sees their price go live → shares the SHOP, not the price
   → a friend opens the shop page → sees fresh prices → posts their own
```

### Trigger moments (when to offer sharing)

1. **Right after a post goes live.** This is the onboarding audit's
   confirmation sheet, the "aha" for a poster. It gets a third button,
   "Tell a friend who shops here".
2. **A city's first community price.** "You put Tulsa on the board. Know
   another cook in Tulsa?"
3. **Shop detail.** A share icon on every shop page. Readers share too, not
   only posters.

### Share mechanism

- The native share sheet already ships: @capacitor/share has been in Board's
  build since 2.4.7, and Report a problem uses it. **No new plugin**, and
  the registry and gradle files don't change.
- A pre-written message, editable by the user. It points at the shop and the
  community, never at a price:
  - After a post: "I just posted on BBQ Board, where cooks share what they
    pay at the butchers near us. Post what you paid at your shop too:
    <Play link>"
  - Shop page: "Kettle Range is on BBQ Board. Cooks post what they paid
    there: <Play link>"
- **Link:** the Play listing for now. A deep link that opens the shop
  directly needs App Links plus a website route. That's later, and it's
  Website's lane.
- **Is a single shared price a "price callout"?** It's a user's own post
  shared by the user, not a Holy Smokes marketing post. I still recommend
  keeping prices out of the pre-written text, so the share stays on
  community and shop. Joel can loosen that if he wants.

### Attribution, within the consent rules

- **Store side:** add utm-style referrer parameters to the Play link
  (`&referrer=utm_source%3Dboard_share%26utm_medium%3D<surface>`). Play
  Console's acquisition reports read them, and nothing personal is sent.
- **In-app:** board_share_tapped {source: post_confirm, first_city or
  shop_detail}. source is an existing parameter filed under "features"
  in DISCLOSED_PARAMS, so there's no sentence change. Whether the friend
  installed is never linked back to the sharer.

## Reviews (the skill's review rules)

The ASO audit's in-app review prompt overlaps with this skill. The review
rules apply to it:

- **Ask neutrally, after an experience milestone** (the 2nd successful
  post).
- **Never gate on sentiment.** No "Enjoying Board? Yes → Play / No →
  feedback form" funnel. Play and Apple both forbid that, and so does the
  FTC review rule. Use the platform prompt as-is.
- **Never incentivize a review.**

## Word of mouth that needs no code (Joel's lane)

- **The founding posters** (community plan) are the referral program at this
  stage. Joel asks each one directly: "Know one other person who buys at
  Kettle Range?"
- **A counter card at willing butcher shops**, with a QR code to the Play
  listing. Draft: "Bought brisket here? Post what you paid on BBQ Board."
  - The shop shares the card. It does not post its own prices (see the
    community plan).
  - This is co-marketing, so it needs each shop's OK. Joel's relationships.

## Metrics

- **Shares** (board_share_tapped, by source).
- **Play installs with utm_source = board_share** (Play Console acquisition
  report).
- **New posters who arrived by a share.** Only roughly measurable without
  linking users, and that's the right trade-off.

## Ships with

The next Board code version: the share button on the post confirmation and
shop detail screens, one new event, and the review prompt. That's the same
release as the onboarding fixes and anonymous account deletion, so the
whole set gets one consent inventory check.
