// Rewards / tier system — pure functions over the cook log. No
// persistence here; everything is computed on the fly from the cooks
// array. The only state that lives elsewhere is the "already
// celebrated" set in localStorage (tracked by CookContext at save
// time so we don't re-fire the unlock toast for the same tier).
//
// Three categories:
//   - Overall ladder (10 tiers, 1 → 2500 total cooks)
//   - Per-meat ladder (9 tiers each, 1 → 1000, separate per meat type)
//   - Behavioral achievements (8 binary unlocks driven by cook attributes)

// ── Overall ladder ──────────────────────────────────────────────

export const OVERALL_LADDER = [
  { id: 'overall-1',     min: 1,    title: 'First Light' },
  { id: 'overall-5',     min: 5,    title: 'Just Getting Warmed Up' },
  { id: 'overall-10',    min: 10,   title: 'Wood Stacker' },
  { id: 'overall-25',    min: 25,   title: 'Pit Tender' },
  { id: 'overall-50',    min: 50,   title: 'Smoke Apprentice' },
  { id: 'overall-100',   min: 100,  title: 'Seasoned Pitmaster' },
  { id: 'overall-250',   min: 250,  title: 'Smoke Master' },
  { id: 'overall-500',   min: 500,  title: 'Living Legend' },
  { id: 'overall-1000',  min: 1000, title: 'Holy Smokes Hall of Fame' },
  { id: 'overall-2500',  min: 2500, title: 'Eternal Pitmaster' },
];

// ── Per-meat ladders ────────────────────────────────────────────
// Same 9 numerical thresholds for every meat; names vary per meat to
// honor each cook's culture. Lookup is by Notebook's canonical meat
// type string (matches what extractMeatType/CookForm produces).

const MEAT_TIER_NAMES = {
  'Brisket':           ['Packer Picker',    'Bark Builder',       'Stall Conqueror',     'Brisket Boss',          'Texas Royalty',           'Burnt End Sage',       'Brisket Master',     'Brisket Immortal',     'Hall of Brisket'],
  'Pulled Pork':       ['First Butt',       'Shoulder Shredder',  'Bone-Slid Believer',  'Pork Prophet',          'Carolina Crown',          'Whole Hog Hero',       'Pulled Pork Master', 'Pulled Pork Immortal', 'Hall of Pulled Pork'],
  'St. Louis Ribs':    ['Rib Rookie',       'Membrane Master',    'Bend-Test Believer',  'Rib Ringer',            'Memphis Made',            '3-2-1 Sensei',         'Rib Master',         'Rib Immortal',         'Hall of Ribs'],
  'Baby Back Ribs':    ['Rib Rookie',       'Membrane Master',    'Bend-Test Believer',  'Rib Ringer',            'Memphis Made',            '3-2-1 Sensei',         'Rib Master',         'Rib Immortal',         'Hall of Ribs'],
  'Beef Ribs':         ['Dino Rib Diver',   'Plate Picker',       'Rib Reaper',          'Beef Rib Boss',         'Dino Rib Royalty',        'Plate Master',         'Beef Rib Master',    'Beef Rib Immortal',    'Hall of Beef Ribs'],
  'Chicken (whole)':   ['Bird Beginner',    'Skin Crisper',       'Spatchcock Specialist','Bird Boss',            'Yardbird Royalty',        'Cluck Champion',       'Whole Bird Master',  'Bird Immortal',        'Hall of the Yardbird'],
  'Chicken Breast':    ['Breast Newcomer',  'Juicy Believer',     'Brine Beat-keeper',   'Breast Boss',           'Crisp King',              'Boneless Beast',       'Breast Master',      'Breast Immortal',      'Hall of the Breast'],
  'Chicken Thigh':     ['Thigh Tinkerer',   'Dark Meat Devotee',  'Crispy-Skin Striver', 'Thigh Lord',            'Thigh Royalty',           'Dark Meat Master',     'Thigh Master',       'Thigh Immortal',       'Hall of Dark Meat'],
  'Chicken Wings':     ['First Flap',       'Wing Whisperer',     'Crisp Captain',       'Wing Warrior',          'Wing King',               'Cluck-of-Fire',        'Wing Master',        'Wing Immortal',        'Hall of Wings'],
  'Turkey (whole)':    ['First Bird',       'Brine Believer',     'Holiday Hero',        'Turkey Titan',          'Thanksgiving Royalty',    'Gobble Guru',          'Turkey Master',      'Turkey Immortal',      'Hall of the Tom'],
  'Turkey Breast':     ['First Bird',       'Brine Believer',     'Holiday Hero',        'Turkey Titan',          'Thanksgiving Royalty',    'Gobble Guru',          'Turkey Master',      'Turkey Immortal',      'Hall of the Tom'],
  'Tri-tip':           ['Tri-tip Trainee',  'Santa Maria Striver','Carbon Crusader',     'Tri-tip Tactician',     'California Crown',        'Santa Maria Sage',     'Tri-tip Master',     'Tri-tip Immortal',     'Hall of Santa Maria'],
  'Sausage':           ['Link Lover',       'Snap Setter',        'Casing Crafter',      'Sausage Sergeant',      'Link Lord',               'Encased Excellence',   'Sausage Master',     'Sausage Immortal',     'Hall of the Link'],
  'Lamb':              ['Lamb Learner',     "Shepherd's Smoke",   'Lamb Lover',          'Lamb Sage',             'Lamb Royalty',            'Pastoral Pitmaster',   'Lamb Master',        'Lamb Immortal',        'Hall of Lamb'],
  'Pork':              ['Pork Pupil',       'Pork Apprentice',    'Pork Pursuer',        'Pork Pro',              'Pork Royalty',            'Pig Whisperer',        'Pork Master',        'Pork Immortal',        'Hall of the Pig'],
  'Beef':              ['Beef Beginner',    'Cow Curator',        'Beef Believer',       'Beef Boss',             'Beef Royalty',            'Cattle King',          'Beef Master',        'Beef Immortal',        'Hall of the Steer'],
};

const CUSTOM_MEAT_NAMES = ['Curious Cook', 'Tinkerer', 'Tradition Breaker', 'Outside-the-Lines Boss', 'Original Pitmaster', 'Genre Bender', 'Wildcard Master', 'Wildcard Immortal', 'Hall of the Wild'];

const PER_MEAT_THRESHOLDS = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

// Build a meat ladder on demand — same thresholds for every meat, names
// vary. Custom/unknown meat types fall through to the Wildcard ladder.
function meatLadder(meatType) {
  const names = MEAT_TIER_NAMES[meatType] || CUSTOM_MEAT_NAMES;
  return PER_MEAT_THRESHOLDS.map((min, i) => ({
    id: `meat-${slug(meatType)}-${min}`,
    min,
    title: names[i],
    meatType,
  }));
}

// ── Behavioral achievements ─────────────────────────────────────

const BEHAVIORAL = [
  { id: 'behavior-note-taker',       title: 'Note Taker',           desc: 'Add timestamped notes during 5 separate cooks',  test: (cooks) => cooks.filter(c => Array.isArray(c.notesLog) && c.notesLog.length > 0).length >= 5 },
  { id: 'behavior-recipe-author',    title: 'Recipe Author',        desc: 'Save 5 of your own recipes',                     test: (_, ctx) => (ctx.recipes || []).length >= 5 },
  { id: 'behavior-compare-pro',      title: 'Compare Pro',          desc: 'View Cook Compare 10 times',                     test: (_, ctx) => (ctx.compareViews || 0) >= 10 },
  { id: 'behavior-friend-of-pit',    title: 'Friend of the Pit',    desc: 'Connect with 3 friends',                         test: (_, ctx) => (ctx.friendCount || 0) >= 3 },
  { id: 'behavior-shared-smoke',     title: 'Shared the Smoke',     desc: 'Share 5 Cook Share Cards',                       test: (_, ctx) => (ctx.shareCount || 0) >= 5 },
  { id: 'behavior-lesson-learner',   title: 'Lesson Learner',       desc: 'Fill out "What I\'d change next time" on 10 cooks', test: (cooks) => cooks.filter(c => (c.whatIdChange || '').trim().length > 0).length >= 10 },
  { id: 'behavior-thermometer',      title: 'Thermometer Whisperer',desc: 'Import 10 cooks via the multi-brand importer',   test: (cooks) => cooks.filter(c => Array.isArray(c.tags) && c.tags.some(t => IMPORT_TAGS.has(t))).length >= 10 },
  { id: 'behavior-photo-pitmaster',  title: 'Photo Pitmaster',      desc: 'Upload photos on 10 separate cooks',             test: (cooks) => cooks.filter(c => Array.isArray(c.photos) && c.photos.length > 0).length >= 10 },
];

const IMPORT_TAGS = new Set([
  'meater', 'fireboard', 'thermoworks', 'weber', 'inkbird',
  'combustion', 'thermopro', 'govee', 'maverick', 'chefstemp', 'other',
]);

// ── Core compute ────────────────────────────────────────────────

// Returns the highest tier the user has earned for a given count.
// Returns null if count < smallest threshold.
function highestEarnedTier(ladder, count) {
  let earned = null;
  for (const tier of ladder) {
    if (count >= tier.min) earned = tier;
    else break;
  }
  return earned;
}

// Returns the next tier the user is working toward, or null at the top.
function nextTier(ladder, count) {
  for (const tier of ladder) {
    if (count < tier.min) return tier;
  }
  return null;
}

export function computeRewards(cooks, ctx = {}) {
  const real = (cooks || []).filter(c => !c._isExample);
  const total = real.length;

  // Overall
  const overallEarned = highestEarnedTier(OVERALL_LADDER, total);
  const overallNext = nextTier(OVERALL_LADDER, total);

  // Per-meat — group cooks by meatType, build a per-meat tier for each
  const byMeat = new Map();
  for (const c of real) {
    const m = (c.meatType || '').trim();
    if (!m) continue;
    byMeat.set(m, (byMeat.get(m) || 0) + 1);
  }
  const perMeat = [];
  for (const [meatType, count] of byMeat.entries()) {
    const ladder = meatLadder(meatType);
    const earned = highestEarnedTier(ladder, count);
    const next = nextTier(ladder, count);
    perMeat.push({ meatType, count, ladder, earned, next });
  }
  perMeat.sort((a, b) => b.count - a.count);

  // Behavioral
  const behavioral = BEHAVIORAL.map(b => ({
    ...b,
    unlocked: !!b.test(real, ctx),
  }));

  // Flatten every unlocked tier id — used for unlock-celebration diffing
  const unlockedIds = new Set();
  if (overallEarned) unlockedIds.add(overallEarned.id);
  for (const m of perMeat) {
    if (m.earned) unlockedIds.add(m.earned.id);
  }
  for (const b of behavioral) {
    if (b.unlocked) unlockedIds.add(b.id);
  }

  return {
    overall:   { count: total, earned: overallEarned, next: overallNext },
    perMeat,
    behavioral,
    unlockedIds,
    unlockedCount: unlockedIds.size,
  };
}

// Look up a tier object by id across all ladders. Used to render the
// celebration toast with the right title.
export function tierById(id, cooks) {
  if (!id) return null;
  if (id.startsWith('overall-')) {
    return OVERALL_LADDER.find(t => t.id === id) || null;
  }
  if (id.startsWith('meat-')) {
    const meatTypes = new Set((cooks || []).map(c => (c.meatType || '').trim()).filter(Boolean));
    for (const m of meatTypes) {
      const ladder = meatLadder(m);
      const hit = ladder.find(t => t.id === id);
      if (hit) return hit;
    }
    return null;
  }
  if (id.startsWith('behavior-')) {
    return BEHAVIORAL.find(t => t.id === id) || null;
  }
  return null;
}

// Visual treatment per tier index (0-8 for per-meat, 0-9 for overall).
// Lower tiers use the olive-green family; the top two use bronze/gold
// with a glow border. Returned shape suitable for inline style spread.
export function tierVisual(tierIdx, totalTiers) {
  // Top tier (Hall) = gold
  if (tierIdx === totalTiers - 1) {
    return { kind: 'gold',   ring: '#f0c050', glow: 'rgba(240, 192, 80, 0.5)',  bg: 'linear-gradient(135deg, #5a4515 0%, #3a2d10 100%)' };
  }
  // Second-to-top (Immortal) = bronze
  if (tierIdx === totalTiers - 2) {
    return { kind: 'bronze', ring: '#c98545', glow: 'rgba(201, 133, 69, 0.45)', bg: 'linear-gradient(135deg, #5a3a1f 0%, #3a2a18 100%)' };
  }
  // Master (third from top) = charcoal-dark with green ring
  if (tierIdx === totalTiers - 3) {
    return { kind: 'master', ring: '#7a9670', glow: 'rgba(122, 150, 112, 0.35)', bg: '#1f2a1a' };
  }
  // Upper-middle tiers — accent-light
  if (tierIdx >= 4) {
    return { kind: 'mid', ring: '#7a9670', glow: 'transparent', bg: '#1f2a1a' };
  }
  // Lower tiers — base olive
  return { kind: 'low', ring: '#4A6741', glow: 'transparent', bg: '#1a2419' };
}

function slug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
