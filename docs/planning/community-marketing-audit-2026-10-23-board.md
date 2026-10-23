# Community plan: BBQ Board submitters (2026-10-23)

This is the `community-marketing` skill (marketingskills pack). Board's
community is unusual: it isn't a chat group, it's the set of people who
post prices. Every price is a contribution, and the board is only as good as
last week's posts. So the "community" work here is mostly making
contributing feel worth it, and only a little about hosting conversation.

House rules applied:
- No price-comparison or "cheapest brisket" callouts (Joel, 10/12).
- No forward promises.
- Joel recruits people personally, so there are no email lists or automated
  invites.
- Nothing goes live without Joel.
- Every copy line is a draft for /antislop, and /joel for anything in his
  name.

## Where Board stands

- **Stage: pre-community.** Play shows "1+ downloads", Production has single
  digits, and the community submissions on the board are few.
- **Model (skill reference):** Founder-Led now. Joel's voice and his BBQ
  circle are the only trust Board has. That later specializes into a
  contribution network (closest to Support-Driven: members serve each
  other).
- **Identity to reinforce:** *cooks who know their butcher.* That's people who
  care where the brisket came from and help the next cook find a good
  shop. It matches the listing's own line, "Local butchers are the point",
  and it's an identity rather than a deal. That's why it survives the
  no-price-callouts rule.

## The core loop

```
A cook buys a cut → posts what they paid (20 seconds) → sees it live
     ↑                                                        ↓
the next cook finds a fresh price  ←  the shop's page gets one more fresh price
```

**Weekly core action:** post one price from this week's shopping trip.

Today the loop breaks at "sees it live": the modal just closes (onboarding
audit, finding 2). Fixing that is the first community task, even though
it's code.

## 90-day plan (Founder-Led, fits Joel's time)

### Days 1 to 30: founding posters, by hand

- **Recruit 10 to 20 founding posters in Milwaukee, personally.**
  - Joel picks them: people in his BBQ circle who already buy at
    Kettle Range, Bunzel's, Ray's or Bavaria.
  - The ask is one price a week from wherever they already shop. That's
    easy and specific.
  - Depth beats breadth: one city with fresh prices is worth more than 40
    cities with one stale price each. All 40 regions exist in the schema
    already.
- **Seed it the honest way.** Joel posts his own real purchases each week.
  No invented prices, and no posts from anyone who didn't buy the cut.
- **Thank people the do-things-that-don't-scale way.** Joel texts each
  founding poster after their first post. Board shows no names, so that
  thanks has to happen off-app.

### Days 31 to 60: rituals

- **A weekly "Board check" on the Holy Smokes pages, built around activity.**
  - It reports what the community did, never who is cheapest. Draft:
    "Board check: 14 fresh prices this week across 6 Milwaukee shops.
    Bought brisket or ribs this week? Post what you paid."
  - It needs a small count from Firestore (prices posted in the last 7 days
    per region). That's an aggregate, with no names and no prices quoted.
  - It slots into the existing series cadence. Marketing owns the post.
- **Butcher spotlights, on the shop rather than the price.**
  - Example: "Kettle Range cuts brisket to order. Here's what to ask for."
  - Each spotlight ends with "Shop there? Post this week's price on
    Board."
  - This is the identity play, and it gives Marketing content that isn't a
    price comparison.
- **"First price in your city."** The listing already says it: "If your city
  isn't covered yet, submit the first price and it will be."
  - The analytics audit's zero-result searches show which cities people
    want.
  - When a city's first community price lands, the Holy Smokes pages say
    so. That's a milestone, not a deal.

### Days 61 to 90: power posters

- **Find the 1% who post weekly**, from Firestore counts per uid.
  - That's internal, owner-side data, never shown in the app.
  - Joel reaches out to each one personally.
- **Recognition within the privacy rules.**
  - Board shows no reporter names, and adding public names would be a
    privacy and consent change.
  - So recognition is private (Joel's thanks), or opt-in only on social:
    "Can we thank you by name in this week's Board check?"
  - An in-app "Top poster" badge or leaderboard would need an auditor
    ruling first (public profile data, a new Firestore field, a rules
    change). Not now.
- **Product feedback from posters.** When a poster's suggestion ships,
  credit them (with permission) in the changelog and on the page. That's
  the "close the loop" step from the skill.

## Deliberately not recommended

- **Discord, Slack or a Facebook group for Board.** At this stage a channel
  with 10 members is mostly staff posts, which is the skill's first warning
  sign. The Holy Smokes pages already have the audience. Revisit at
  100+ weekly posters.
- **Butchers posting their own prices.** It's tempting, because shops want
  traffic. It breaks the board's premise: the prices are what customers
  paid, community-reported and unverified. Shops can share the "post your
  price" card with their customers, but they shouldn't post their own
  shelf prices. If a shop wants a presence, that's a separate, labeled
  feature for a later ruling.
- **Incentives (gift cards, raffles) for posting.** They invite fake posts on
  a board with no verification. Recognition is the reward.

## Health metrics (weekly, from Firestore counts plus the analytics audit's events)

- **Fresh prices per region**, posted in the last 30 days. Under 30 days is
  the app's own "fresh" line.
- **Weekly active posters**: distinct uids with a post in the last 7 days.
- **New-poster return rate**: of last month's first-time posters, how many
  posted again.
- **Share of prices from people other than Joel.** This is the skill's
  "content by non-staff" metric, and the most honest single number for
  whether a community exists yet.

**Warning signs:** most posts are Joel's, prices across a region go stale
(past 30 days), or posters stop after their first post.

## Needs a decision (Joel)

1. **Milwaukee-first depth:** yes or no. I recommend yes.
2. **The weekly Board check post:** Marketing owns it. It needs one small
   owner-side count script, which I'd build (read-only, aggregate).
