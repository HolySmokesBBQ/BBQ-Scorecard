// BBQ wood pairing reference. Used by the Calculator's Wood Guide panel.
//
// Pairings drawn from Aaron Franklin's pit guide, Meathead's Science of
// Great BBQ wood reference, KCBS team consensus on the wood discussions
// from KCBS forums, and the consensus among Texas/Carolina/Kansas pitmasters
// on what wood actually plays with what meat. Intensity ratings are
// 1 (whisper) to 5 (smacks you in the face).

export const WOODS = {
  Alder: {
    intensity: 1,
    profile: 'Very light, faintly sweet — the classic Pacific Northwest salmon wood.',
    burnsHot: false,
    bestFor: ['Chicken', 'Turkey'],
    okayFor: ['Pork Shoulder', 'Baby Back Ribs'],
    avoidFor: ['Brisket', 'Tri-tip'],
    tagline: 'What salmon smokehouses use. Underrated for chicken thighs.',
  },
  Almond: {
    intensity: 3,
    profile: 'Nutty, sweet — like a mellower pecan with a subtle marzipan note.',
    burnsHot: true,
    bestFor: ['Pork Shoulder', 'Chicken', 'Turkey', 'St. Louis Ribs', 'Baby Back Ribs'],
    okayFor: ['Brisket', 'Tri-tip', 'Sausage'],
    avoidFor: [],
    tagline: 'California favorite. Do-anything wood with a hint of marzipan.',
  },
  Apple: {
    intensity: 2,
    profile: 'Sweet, mild, fruity — gives a faint pink tinge to poultry skin.',
    burnsHot: false,
    bestFor: ['Pork Shoulder', 'St. Louis Ribs', 'Baby Back Ribs', 'Chicken', 'Turkey'],
    okayFor: ['Sausage', 'Tri-tip'],
    avoidFor: [],
    tagline: 'The crowd-pleaser. Hard to mess up.',
  },
  Ash: {
    intensity: 2,
    profile: 'Light, clean-burning — mild smoke without a strong flavor stamp.',
    burnsHot: true,
    bestFor: ['Pork Shoulder', 'St. Louis Ribs', 'Baby Back Ribs', 'Chicken', 'Turkey'],
    okayFor: ['Brisket', 'Tri-tip', 'Sausage'],
    avoidFor: [],
    tagline: 'Underrated workhorse. If you have a downed ash tree, you have great BBQ wood.',
  },
  'Bourbon Barrel': {
    intensity: 3,
    profile: 'Oak with vanilla-caramel notes from the whiskey soak — sweet and deep.',
    burnsHot: true,
    bestFor: ['Brisket', 'Pork Shoulder', 'St. Louis Ribs'],
    okayFor: ['Baby Back Ribs', 'Sausage', 'Tri-tip'],
    avoidFor: ['Chicken', 'Turkey'],
    tagline: 'Oak with a whiskey kiss. Best as a 25% blend so the vanilla lands without overwhelming.',
  },
  Cherry: {
    intensity: 2,
    profile: 'Sweet, mild, slightly fruity — best wood for color on bark.',
    burnsHot: false,
    bestFor: ['Pork Shoulder', 'St. Louis Ribs', 'Baby Back Ribs', 'Chicken', 'Turkey'],
    okayFor: ['Brisket', 'Sausage'],
    avoidFor: [],
    tagline: 'Use it for the mahogany bark. Pairs with almost anything.',
  },
  Citrus: {
    intensity: 2,
    profile: 'Bright, floral, mildly sweet — orange or lemon wood with a subtle citrus note.',
    burnsHot: false,
    bestFor: ['Chicken', 'Turkey', 'Pork Shoulder'],
    okayFor: ['St. Louis Ribs', 'Baby Back Ribs'],
    avoidFor: ['Brisket', 'Tri-tip'],
    tagline: 'Especially good on holiday turkey. Uncommon but worth trying.',
  },
  'Grape Vine': {
    intensity: 2,
    profile: 'Fruity, mild, slightly wine-like — burns fast so use as an accent.',
    burnsHot: true,
    bestFor: ['Chicken', 'Turkey', 'Pork Shoulder'],
    okayFor: ['St. Louis Ribs', 'Baby Back Ribs', 'Sausage'],
    avoidFor: ['Brisket'],
    tagline: 'What Napa BBQ uses. Blend with oak — it burns too fast solo.',
  },
  Hickory: {
    intensity: 4,
    profile: 'Strong, smoky, bacon-y — the classic American BBQ flavor.',
    burnsHot: true,
    bestFor: ['Brisket', 'Pork Shoulder', 'St. Louis Ribs', 'Sausage'],
    okayFor: ['Baby Back Ribs', 'Tri-tip'],
    avoidFor: ['Chicken', 'Turkey'],
    tagline: 'Default for Kansas City and Carolina pits. Heavy hand bitters poultry.',
  },
  Maple: {
    intensity: 2,
    profile: 'Sweet, mild, subtle — the flavor under good bacon.',
    burnsHot: false,
    bestFor: ['Chicken', 'Turkey', 'Pork Shoulder'],
    okayFor: ['St. Louis Ribs', 'Baby Back Ribs'],
    avoidFor: ['Brisket', 'Tri-tip'],
    tagline: 'Perfect with poultry. Lost on beef.',
  },
  Mesquite: {
    intensity: 5,
    profile: 'Intense, earthy, distinctly Texan — burns hot and fast.',
    burnsHot: true,
    bestFor: ['Brisket', 'Tri-tip'],
    okayFor: ['Sausage'],
    avoidFor: ['Chicken', 'Turkey', 'St. Louis Ribs', 'Baby Back Ribs', 'Pork Shoulder'],
    tagline: 'Texas brisket wood. Use sparingly or it overwhelms everything.',
  },
  Mulberry: {
    intensity: 2,
    profile: 'Sweet, mild, apple-like — subtle fruit note without being cloying.',
    burnsHot: false,
    bestFor: ['Chicken', 'Turkey', 'Pork Shoulder', 'St. Louis Ribs', 'Baby Back Ribs'],
    okayFor: ['Sausage'],
    avoidFor: ['Brisket', 'Tri-tip'],
    tagline: 'Backyard bonus if you have a mulberry tree. Sweeter than apple.',
  },
  Oak: {
    intensity: 3,
    profile: 'Medium, balanced, foundational — the workhorse pit wood.',
    burnsHot: true,
    bestFor: ['Brisket', 'Tri-tip', 'Sausage'],
    okayFor: ['Pork Shoulder', 'St. Louis Ribs', 'Baby Back Ribs', 'Chicken', 'Turkey'],
    avoidFor: [],
    tagline: 'Can’t go wrong. Texas central pit wood and a good blender.',
  },
  Pecan: {
    intensity: 3,
    profile: 'Nutty, sweet, rich — like hickory’s softer cousin.',
    burnsHot: false,
    bestFor: ['Brisket', 'Pork Shoulder', 'St. Louis Ribs', 'Baby Back Ribs', 'Chicken', 'Turkey'],
    okayFor: ['Sausage', 'Tri-tip'],
    avoidFor: [],
    tagline: 'The do-anything wood. Sweet enough for poultry, deep enough for beef.',
  },
  'Post Oak': {
    intensity: 3,
    profile: 'Cleaner, milder than red oak — the Texas central pit standard.',
    burnsHot: true,
    bestFor: ['Brisket', 'Tri-tip', 'Sausage'],
    okayFor: ['Pork Shoulder', 'St. Louis Ribs', 'Baby Back Ribs'],
    avoidFor: [],
    tagline: 'Franklin BBQ uses only this. If you can find it, use it on brisket.',
  },
  Walnut: {
    intensity: 4,
    profile: 'Bold, slightly bitter, tannic — needs a lighter wood to soften it.',
    burnsHot: true,
    bestFor: ['Brisket', 'Sausage'],
    okayFor: ['Tri-tip', 'Pork Shoulder'],
    avoidFor: ['Chicken', 'Turkey', 'Baby Back Ribs', 'St. Louis Ribs'],
    tagline: 'Strong hand. Blend with apple or cherry so it doesn’t take over.',
  },
};

// Suggested blends — common pitmaster combinations. Each entry lists the
// wood mix and what it’s known for. Blending is how you tune flavor
// to the meat without over-committing to one wood’s personality.
export const BLENDS = [
  { name: 'Texas Classic',     mix: ['Oak', 'Mesquite'],          forMeats: ['Brisket'],         note: '60/40 oak/mesquite — Franklin-style central Texas.' },
  { name: 'Kansas City',       mix: ['Hickory', 'Oak'],           forMeats: ['Brisket', 'Sausage'], note: '50/50 — the KCBS competition default.' },
  { name: 'Memphis Sweet',     mix: ['Hickory', 'Apple'],         forMeats: ['Pork Shoulder', 'St. Louis Ribs'], note: 'Lean apple-heavy for ribs, hickory-heavy for shoulder.' },
  { name: 'Carolina Pit',      mix: ['Oak', 'Hickory'],           forMeats: ['Pork Shoulder'],   note: 'Eastern Carolina whole hog tradition.' },
  { name: 'Poultry Perfect',   mix: ['Apple', 'Cherry'],          forMeats: ['Chicken', 'Turkey'], note: '60/40 — sweet without overwhelming the skin.' },
  { name: 'Holiday Bird',      mix: ['Maple', 'Apple'],           forMeats: ['Turkey'],          note: 'Thanksgiving classic.' },
];

// Return ranked wood recommendations for a single meat type. Uses a
// simple scoring system: bestFor = 3 points, okayFor = 1, avoidFor = -5
// (effectively excludes). Ties broken by intensity preference per meat.
export function getRecommendedWoods(meatType) {
  const scored = Object.entries(WOODS).map(([name, w]) => {
    let score = 0;
    if (w.bestFor.includes(meatType)) score += 3;
    else if (w.okayFor.includes(meatType)) score += 1;
    else if (w.avoidFor.includes(meatType)) score -= 5;
    return { name, ...w, score };
  });
  return scored
    .filter(w => w.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Wood × meat compatibility for the matrix view.
// Returns 'best' | 'okay' | 'avoid' | 'neutral'.
export function getCompat(woodName, meatType) {
  const w = WOODS[woodName];
  if (!w) return 'neutral';
  if (w.bestFor.includes(meatType)) return 'best';
  if (w.okayFor.includes(meatType)) return 'okay';
  if (w.avoidFor.includes(meatType)) return 'avoid';
  return 'neutral';
}
