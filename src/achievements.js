// Achievements / rewards system for BBQ Scorecard.
//
// Pure functions over the reviews array — no state, no localStorage, no
// network. Every achievement is recomputed from scratch each time the
// list is rendered, so the user's progress is always consistent with
// whatever reviews they currently have.
//
// Predicate contract: each achievement defines `predicate(reviews, sc)`
// where `sc` is a precomputed array of calcScores results (one per
// review, in the same order). Both are passed so individual predicates
// don't need to recompute score data — keeps the per-render cost down
// even with 100+ reviews.
//
// Progress field (optional): if set, returns { current, target } so the
// UI can render a progress bar for not-yet-earned achievements. Adds
// motivation without changing earned status.

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

function countMeat(reviews, meatName) {
  return reviews.filter((r) => {
    if (Array.isArray(r.meats) && r.meats.includes(meatName)) return true;
    // Also check the free-form meatOther field for the same name
    const other = (r.meatOther || '').toLowerCase();
    return other.includes(meatName.toLowerCase());
  }).length;
}

function uniqueCities(reviews) {
  return uniq(reviews.map((r) => (r.location || '').trim())).filter(Boolean);
}

export const ACHIEVEMENTS = [
  // ── Volume — review count tiers ─────────────────────────────────
  {
    id: 'first-bite',
    category: 'Milestones',
    name: 'First Bite',
    desc: 'Welcome to the smoke. First review logged.',
    glyph: '★',
    predicate: (reviews) => reviews.length >= 1,
    progress: (reviews) => ({ current: Math.min(reviews.length, 1), target: 1 }),
  },
  {
    id: 'warmed-up',
    category: 'Milestones',
    name: 'Just Getting Warmed Up',
    desc: 'Five reviews logged. The grill is heating.',
    glyph: '🔥', // intentionally generic flame, not an emoji-laden gimmick
    predicate: (reviews) => reviews.length >= 5,
    progress: (reviews) => ({ current: Math.min(reviews.length, 5), target: 5 }),
  },
  {
    id: 'pit-boss-trainee',
    category: 'Milestones',
    name: 'Pit Boss in Training',
    desc: "Ten reviews. You know what good BBQ looks like.",
    glyph: '★★',
    predicate: (reviews) => reviews.length >= 10,
    progress: (reviews) => ({ current: Math.min(reviews.length, 10), target: 10 }),
  },
  {
    id: 'seasoned',
    category: 'Milestones',
    name: 'Seasoned Reviewer',
    desc: "Twenty-five joints scored. You've got opinions and the data to back them.",
    glyph: '★★★',
    predicate: (reviews) => reviews.length >= 25,
    progress: (reviews) => ({ current: Math.min(reviews.length, 25), target: 25 }),
  },
  {
    id: 'connoisseur',
    category: 'Milestones',
    name: 'BBQ Connoisseur',
    desc: 'Fifty reviews. Your friends ask YOU where to eat.',
    glyph: '★★★★',
    predicate: (reviews) => reviews.length >= 50,
    progress: (reviews) => ({ current: Math.min(reviews.length, 50), target: 50 }),
  },
  {
    id: 'pit-master',
    category: 'Milestones',
    name: 'Pit Master',
    desc: 'One hundred reviews. The bar is set.',
    glyph: '★★★★★',
    predicate: (reviews) => reviews.length >= 100,
    progress: (reviews) => ({ current: Math.min(reviews.length, 100), target: 100 }),
  },

  // ── Meat-specific tiers ─────────────────────────────────────────
  {
    id: 'brisket-hunter',
    category: 'Meats',
    name: 'Brisket Hunter',
    desc: 'Five brisket reviews. You take it seriously.',
    glyph: 'B',
    predicate: (reviews) => countMeat(reviews, 'Brisket') >= 5,
    progress: (reviews) => ({ current: Math.min(countMeat(reviews, 'Brisket'), 5), target: 5 }),
  },
  {
    id: 'rib-tickler',
    category: 'Meats',
    name: 'Rib Tickler',
    desc: 'Five rib joints down.',
    glyph: 'R',
    predicate: (reviews) => countMeat(reviews, 'Ribs') >= 5,
    progress: (reviews) => ({ current: Math.min(countMeat(reviews, 'Ribs'), 5), target: 5 }),
  },
  {
    id: 'pork-patrolman',
    category: 'Meats',
    name: 'Pork Patrolman',
    desc: 'Five pulled pork reviews. Sandwich royalty.',
    glyph: 'P',
    predicate: (reviews) => countMeat(reviews, 'Pulled Pork') >= 5,
    progress: (reviews) => ({ current: Math.min(countMeat(reviews, 'Pulled Pork'), 5), target: 5 }),
  },
  {
    id: 'chicken-chaser',
    category: 'Meats',
    name: 'Chicken Chaser',
    desc: 'Five chicken plates and counting.',
    glyph: 'C',
    predicate: (reviews) => countMeat(reviews, 'Chicken') >= 5,
    progress: (reviews) => ({ current: Math.min(countMeat(reviews, 'Chicken'), 5), target: 5 }),
  },
  {
    id: 'sausage-seeker',
    category: 'Meats',
    name: 'Sausage Seeker',
    desc: 'You know your links.',
    glyph: 'S',
    predicate: (reviews) => countMeat(reviews, 'Sausage') >= 5,
    progress: (reviews) => ({ current: Math.min(countMeat(reviews, 'Sausage'), 5), target: 5 }),
  },
  {
    id: 'burnt-ends-baron',
    category: 'Meats',
    name: 'Burnt Ends Baron',
    desc: 'The KC specialty speaks to you.',
    glyph: 'BE',
    predicate: (reviews) => countMeat(reviews, 'Burnt Ends') >= 5,
    progress: (reviews) => ({ current: Math.min(countMeat(reviews, 'Burnt Ends'), 5), target: 5 }),
  },
  {
    id: 'turkey-tracker',
    category: 'Meats',
    name: 'Turkey Tracker',
    desc: 'Five smoked turkey reviews. The unsung hero.',
    glyph: 'T',
    predicate: (reviews) => countMeat(reviews, 'Smoked Turkey') >= 5,
    progress: (reviews) => ({ current: Math.min(countMeat(reviews, 'Smoked Turkey'), 5), target: 5 }),
  },
  {
    id: 'omnivore',
    category: 'Meats',
    name: 'Meat Omnivore',
    desc: "Tried at least once of every meat type tracked. You've covered the menu.",
    glyph: 'Ω',
    predicate: (reviews) => {
      const wanted = ['Brisket', 'Smoked Turkey', 'Sausage', 'Pulled Pork', 'Ribs', 'Chicken', 'Pork Chop', 'Burnt Ends'];
      return wanted.every((m) => countMeat(reviews, m) >= 1);
    },
    progress: (reviews) => {
      const wanted = ['Brisket', 'Smoked Turkey', 'Sausage', 'Pulled Pork', 'Ribs', 'Chicken', 'Pork Chop', 'Burnt Ends'];
      const got = wanted.filter((m) => countMeat(reviews, m) >= 1).length;
      return { current: got, target: wanted.length };
    },
  },

  // ── Travel — unique cities ──────────────────────────────────────
  {
    id: 'road-tripper',
    category: 'Travel',
    name: 'Road Tripper',
    desc: 'BBQ in three different cities.',
    glyph: '→',
    predicate: (reviews) => uniqueCities(reviews).length >= 3,
    progress: (reviews) => ({ current: Math.min(uniqueCities(reviews).length, 3), target: 3 }),
  },
  {
    id: 'wandering-pitmaster',
    category: 'Travel',
    name: 'Wandering Pitmaster',
    desc: 'Five cities deep.',
    glyph: '→→',
    predicate: (reviews) => uniqueCities(reviews).length >= 5,
    progress: (reviews) => ({ current: Math.min(uniqueCities(reviews).length, 5), target: 5 }),
  },
  {
    id: 'bbq-cartographer',
    category: 'Travel',
    name: 'BBQ Cartographer',
    desc: 'Ten cities. Your map is filling out.',
    glyph: '→→→',
    predicate: (reviews) => uniqueCities(reviews).length >= 10,
    progress: (reviews) => ({ current: Math.min(uniqueCities(reviews).length, 10), target: 10 }),
  },

  // ── Quality — high scores ───────────────────────────────────────
  {
    id: 'found-a-winner',
    category: 'Quality',
    name: 'Found a Winner',
    desc: 'First five-star review (composite 7.5+).',
    glyph: '✦',
    predicate: (reviews, sc) => sc.some((s) => s.composite >= 7.5),
    progress: (reviews, sc) => ({
      current: Math.min(sc.filter((s) => s.composite >= 7.5).length, 1),
      target: 1,
    }),
  },
  {
    id: 'gold-club',
    category: 'Quality',
    name: 'Gold Club',
    desc: 'Five top-tier joints in the book.',
    glyph: '✦✦',
    predicate: (reviews, sc) => sc.filter((s) => s.stars === 5).length >= 5,
    progress: (reviews, sc) => ({
      current: Math.min(sc.filter((s) => s.stars === 5).length, 5),
      target: 5,
    }),
  },
  {
    id: 'found-perfection',
    category: 'Quality',
    name: 'Found Perfection',
    desc: 'A flawless 9.0 composite. Did it really earn it?',
    glyph: '✺',
    predicate: (reviews, sc) => sc.some((s) => s.composite >= 9.0),
    progress: (reviews, sc) => ({
      current: sc.some((s) => s.composite >= 9.0) ? 1 : 0,
      target: 1,
    }),
  },

  // ── Engagement ─────────────────────────────────────────────────
  {
    id: 'photogenic',
    category: 'Engagement',
    name: 'Photogenic',
    desc: 'Five reviews with photos. You document the goods.',
    glyph: '◫',
    predicate: (reviews) =>
      reviews.filter((r) => (r.photos && r.photos.length > 0) || r.photo).length >= 5,
    progress: (reviews) => ({
      current: Math.min(
        reviews.filter((r) => (r.photos && r.photos.length > 0) || r.photo).length,
        5
      ),
      target: 5,
    }),
  },
  {
    id: 'family-table',
    category: 'Engagement',
    name: 'Family Table',
    desc: 'Five reviews where the whole table chimed in with their own scores.',
    glyph: '♣',
    predicate: (reviews) =>
      reviews.filter((r) => Array.isArray(r.friends) && r.friends.length > 0).length >= 5,
    progress: (reviews) => ({
      current: Math.min(
        reviews.filter((r) => Array.isArray(r.friends) && r.friends.length > 0).length,
        5
      ),
      target: 5,
    }),
  },

  // ── v3.4.2 additions — five more badges covering habit patterns
  // (streaks + variety) that the original 22 didn't reach. Order still
  // groups by category so the Rewards grid stays coherent.

  {
    id: 'road-warrior',
    category: 'Travel',
    name: 'Road Warrior',
    desc: 'Ten different cities. You are officially a BBQ tourist.',
    glyph: '⚑',
    predicate: (reviews) => uniqueCities(reviews).length >= 10,
    progress: (reviews) => ({ current: Math.min(uniqueCities(reviews).length, 10), target: 10 }),
  },
  {
    id: 'cross-country',
    category: 'Travel',
    name: 'Cross-Country',
    desc: 'Reviews logged in three different trips.',
    glyph: '✈',
    predicate: (reviews) => uniq(reviews.map((r) => (r.trip || '').trim())).length >= 3,
    progress: (reviews) => ({ current: Math.min(uniq(reviews.map((r) => (r.trip || '').trim())).length, 3), target: 3 }),
  },
  {
    id: 'streak-week',
    category: 'Engagement',
    name: 'On a Roll',
    desc: 'Reviews on three different days in a single week.',
    glyph: '⚡',
    predicate: (reviews) => hasWeeklyStreak(reviews, 3),
    progress: (reviews) => ({ current: bestWeekStreak(reviews), target: 3 }),
  },
  {
    id: 'note-taker',
    category: 'Engagement',
    name: 'Note Taker',
    desc: 'Ten reviews with your own notes attached.',
    glyph: '✎',
    predicate: (reviews) =>
      reviews.filter((r) => (r.notes || '').trim() || (r.notesLog?.length || 0) > 0).length >= 10,
    progress: (reviews) => ({
      current: Math.min(
        reviews.filter((r) => (r.notes || '').trim() || (r.notesLog?.length || 0) > 0).length,
        10
      ),
      target: 10,
    }),
  },
  {
    id: 'critic',
    category: 'Quality',
    name: 'Honest Critic',
    desc: 'Five reviews under 3 stars. Not every plate is a winner.',
    glyph: '✕',
    predicate: (reviews, sc) => sc.filter((s) => s.stars <= 2).length >= 5,
    progress: (reviews, sc) => ({ current: Math.min(sc.filter((s) => s.stars <= 2).length, 5), target: 5 }),
  },
];

// Small helper — bins a review list into ISO-week keys (YYYY-WW-ish)
// and returns the largest number of distinct days seen inside any bin.
// Used by the "On a Roll" streak achievement.
function bestWeekStreak(reviews) {
  const dates = reviews.map((r) => r.date).filter(Boolean).sort();
  if (dates.length === 0) return 0;
  const bins = new Map();
  for (const d of dates) {
    const day = new Date(d + 'T00:00:00Z');
    const jan1 = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
    const week = Math.floor((day - jan1) / (7 * 24 * 3600 * 1000));
    const key = `${day.getUTCFullYear()}-${week}`;
    if (!bins.has(key)) bins.set(key, new Set());
    bins.get(key).add(d);
  }
  let best = 0;
  for (const set of bins.values()) if (set.size > best) best = set.size;
  return best;
}
function hasWeeklyStreak(reviews, n) {
  return bestWeekStreak(reviews) >= n;
}

// Group helper for the UI
export function achievementsByCategory() {
  const groups = {};
  for (const a of ACHIEVEMENTS) {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  }
  return groups;
}

// Compute earned status for every achievement in one pass.
// Returns { earned: Set<id>, progress: Map<id, {current, target}> }.
export function computeAchievements(reviews, calcScores) {
  const sc = reviews.map((r) => calcScores(r.scores));
  const earned = new Set();
  const progress = new Map();
  for (const a of ACHIEVEMENTS) {
    if (a.predicate(reviews, sc)) earned.add(a.id);
    if (a.progress) progress.set(a.id, a.progress(reviews, sc));
  }
  return { earned, progress };
}
