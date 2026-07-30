/* ── Constants ── */
export const CATEGORIES = {
  bbq: [
    { key: 'appearance', label: 'Appearance' },
    { key: 'taste', label: 'Taste / Flavor' },
    { key: 'tenderness', label: 'Tenderness / Texture' },
    { key: 'smoke', label: 'Smoke' },
    { key: 'sides', label: 'Sides' },
    { key: 'sauce', label: 'Sauce' },
    { key: 'portions', label: 'Portions / Value' },
  ],
  family: [
    { key: 'service', label: 'Service' },
    { key: 'cleanliness', label: 'Cleanliness' },
    { key: 'amenities', label: 'Family Amenities' },
  ],
};

export const DESCRIPTORS = {
  appearance: { 1:'Inedible looking',2:'Sloppy, no care',3:'Below average',4:'Passable',5:'Standard BBQ',6:'Attention to plating',7:'Appetizing on sight',8:'Photo-worthy',9:'Competition-level' },
  taste: { 1:'Spit-it-out bad',2:'Struggle to finish',3:'Bland or off-putting',4:'Forgettable',5:'Solid, no complaints',6:'Well balanced',7:'Keeps you reaching back',8:'Complex and layered',9:'Best ever' },
  tenderness: { 1:"Can't chew it",2:'Tough or dry',3:'Chewy or dried out',4:'Needs work',5:'Standard for the cut',6:'Good moisture and pull',7:'Clean bite, rendered fat',8:'Perfect moisture balance',9:'Every bite perfect' },
  smoke: { 1:'Zero smoke presence',2:'Barely detectable',3:'Faint hint',4:'Present but flat',5:'Noticeable ring and flavor',6:'Good balance with meat',7:'Clean wood flavor throughout',8:'Deep penetration, clean finish',9:'Masterclass smoke profile' },
  sides: { 1:'Inedible',2:'Gas station quality',3:'Below average',4:'Forgettable',5:'Standard, does the job',6:'A step above',7:'Would order on their own',8:'Standout, memorable',9:'Best sides anywhere' },
  sauce: { 1:'Awful',2:'Bottom shelf',3:'Generic',4:'Passable',5:'Solid house sauce',6:'Good flavor, complements meat',7:'Distinctive and balanced',8:'Complex, craveable',9:'Hall of fame sauce' },
  portions: { 1:'Insulting',2:'Left hungry',3:'Skimpy for the price',4:'Below average',5:'Fair for the price',6:'Good value',7:'Generous portions',8:'Outstanding value',9:'Absurd amount of food' },
  service: { 1:'Hostile',2:'Rude or ignored',3:'Slow and indifferent',4:'Below average',5:'Fine, nothing notable',6:'Friendly',7:'Attentive and warm',8:'Went above and beyond',9:'Made the experience' },
  cleanliness: { 1:'Health hazard',2:'Dirty, sticky',3:'Needs attention',4:'Below average',5:'Acceptable',6:'Clean',7:'Well maintained',8:'Spotless',9:'Immaculate' },
  amenities: { 1:'Hostile to families',2:'No accommodations',3:'Bare minimum',4:'Below average',5:'Standard setup',6:'Kid-friendly touches',7:'Good for families',8:'Family destination',9:'Built for families' },
};

export const MEATS = ['Brisket','Smoked Turkey','Sausage','Pulled Pork','Ribs','Chicken','Pork Chop','Burnt Ends'];
export const SIDES_LIST = ['Potato Salad','Mac & Cheese','Beans','Rice','Coleslaw','Corn','Green Beans','Bread'];
export const SAUCE_DEP_OPTIONS = ['No — meat stood on its own','Helped but not necessary','Yes — meat needed sauce'];
export const RETURN_OPTIONS = ['Absolutely','Probably','Maybe','Probably not','No'];

export const THEMES = {
  dark: { bg: '#1a1a1a', card: '#222', border: '#333', accent: '#d4782f', text: '#f5e6d3', muted: '#888', dark: '#111' },
  light: { bg: '#f5f0eb', card: '#ffffff', border: '#ddd', accent: '#c06820', text: '#2a2420', muted: '#777', dark: '#ede5dc' },
};

export const STAR_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#22c55e' };
export const GEOCODE_CACHE_KEY = 'muiller-bbq-geocache';

/* ── Cook Notebook Constants ── */
export const WOOD_TYPES = ['Hickory', 'Oak', 'Cherry', 'Apple', 'Mesquite', 'Pecan', 'Maple'];
export const FUEL_SOURCES = ['Charcoal', 'Pellets', 'Propane', 'Electric', 'Wood'];
export const WRAP_METHODS = ['No wrap', 'Butcher paper', 'Foil'];
// "box" added in v2.0.7 for dessert recipes (e.g. 1 box instant pudding).
// "can" + "jar" + "pkg" added at the same time to cover sides and
// desserts that aren't measured by volume.
export const INGREDIENT_UNITS = ['tsp', 'tbsp', 'cup', 'oz', 'lb', 'clove', 'pinch', 'dash', 'box', 'can', 'jar', 'pkg'];

// Recipe types — added "side" and "dessert" in v2.0.7. The form treats
// all three of sauce/side/dessert the same way (ingredients + cook
// method) since the underlying schema is the same; only the labels and
// filter buttons differ.
export const RECIPE_TYPE_LABELS = {
  rub:      'Rub',
  sauce:    'Sauce',
  side:     'Side',
  dessert:  'Dessert',
  fullCook: 'Full Cook',
};

/* ── BBQ Meat Calculator reference data ──
   Calculator math is grounded in concrete servings — "4 brisket slices
   per person," "3 ribs per person" — instead of abstract per-person
   pounds. That's how pitmasters actually plan a cook. Each meat carries:

     - serving.unit / unitPlural — the countable unit ("slice", "rib",
       "link", "ounce of pulled pork", "quarter chicken")
     - serving.description — short note explaining the unit so the user
       knows what they're sizing
     - serving.cookedLbEach — the cooked-weight of one unit; the engine
       multiplies by user-set count and back-calcs raw weight using
       shrinkage
     - serving.defaults — Light / Normal / Hearty starting counts. The
       user can override any meat's count per-event.
     - serving.min / max / step — bounds for the UI stepper.

   typicalCutLb is the standard size of a single cut at the butcher
   (whole brisket packer, Boston butt, full rack of ribs). The calculator
   divides raw weight needed by this to find how many cuts to buy AND
   drives the per-cut cook time — since cuts run in parallel on a smoker,
   what matters is "longest single cut" not "sum of all."

   Sources for the defaults:
     - Franklin Barbecue: A Meat-Smoking Manifesto (brisket serving)
     - Meathead's Meathead: The Science of Great Barbecue and Grilling
     - Kansas City Barbeque Society (KCBS) competition standards
     - National Pork Board (pulled-pork serving guidance)
     - Steven Raichlen Project Smoke (ribs, sausage) */
export const MEAT_GUIDE = {
  'Brisket': {
    typicalCutLb: 12.0, shrinkage: 0.50,
    hrPerLbLow: 1.0, hrPerLbHigh: 1.5,
    finishTemp: 203, cookTemp: 225,
    wrapMethod: 'Butcher paper', restMinutes: 60,
    serving: {
      unit: 'slice', unitPlural: 'slices',
      description: 'pencil-cut slice, ~1/4 inch thick',
      cookedLbEach: 0.125,   // ≈ 2 oz cooked per slice
      defaults: { light: 2, normal: 4, hearty: 6 },
      min: 1, max: 12, step: 1,
    },
  },
  'Pulled Pork': {
    typicalCutLb: 8.0, shrinkage: 0.35,
    hrPerLbLow: 1.5, hrPerLbHigh: 2.0,
    finishTemp: 203, cookTemp: 225,
    wrapMethod: 'Foil', restMinutes: 45,
    serving: {
      unit: 'oz', unitPlural: 'oz',
      description: 'ounces of pulled pork (sandwich ≈ 5 oz)',
      cookedLbEach: 0.0625,  // 1 oz = 0.0625 lb
      defaults: { light: 3, normal: 5, hearty: 8 },
      min: 1, max: 16, step: 1,
    },
  },
  'St. Louis Ribs': {
    typicalCutLb: 3.0, shrinkage: 0.30,
    hrPerLbLow: 0.8, hrPerLbHigh: 1.0,
    finishTemp: 198, cookTemp: 250,
    wrapMethod: 'Foil', restMinutes: 15,
    serving: {
      unit: 'rib', unitPlural: 'ribs',
      description: 'St. Louis spare rib (≈ 2.4 oz meat cooked)',
      cookedLbEach: 0.15,
      defaults: { light: 2, normal: 3, hearty: 5 },
      min: 1, max: 8, step: 1,
    },
  },
  'Baby Back Ribs': {
    typicalCutLb: 1.75, shrinkage: 0.30,
    hrPerLbLow: 0.6, hrPerLbHigh: 0.8,
    finishTemp: 195, cookTemp: 250,
    wrapMethod: 'Foil', restMinutes: 15,
    serving: {
      unit: 'rib', unitPlural: 'ribs',
      description: 'baby back rib (≈ 1.5 oz meat cooked)',
      cookedLbEach: 0.094,
      defaults: { light: 3, normal: 4, hearty: 6 },
      min: 1, max: 10, step: 1,
    },
  },
  'Chicken (whole)': {
    typicalCutLb: 4.0, shrinkage: 0.25,
    hrPerLbLow: 0.5, hrPerLbHigh: 0.75,
    finishTemp: 165, cookTemp: 275,
    wrapMethod: 'No wrap', restMinutes: 10,
    serving: {
      unit: 'piece', unitPlural: 'pieces',
      description: 'quarter chicken (≈ 0.45 lb cooked with skin)',
      cookedLbEach: 0.45,
      defaults: { light: 1, normal: 1, hearty: 2 },
      min: 1, max: 4, step: 1,
    },
  },
  'Turkey (whole)': {
    typicalCutLb: 14.0, shrinkage: 0.25,
    hrPerLbLow: 0.5, hrPerLbHigh: 0.67,
    finishTemp: 165, cookTemp: 275,
    wrapMethod: 'No wrap', restMinutes: 30,
    serving: {
      unit: 'slice', unitPlural: 'slices',
      description: 'turkey slice, ~1/4 inch thick (≈ 3 oz cooked)',
      cookedLbEach: 0.1875,
      defaults: { light: 2, normal: 3, hearty: 5 },
      min: 1, max: 8, step: 1,
    },
  },
  'Tri-tip': {
    typicalCutLb: 2.5, shrinkage: 0.30,
    hrPerLbLow: 0.5, hrPerLbHigh: 0.5,
    finishTemp: 130, cookTemp: 225,
    wrapMethod: 'No wrap', restMinutes: 15,
    serving: {
      unit: 'slice', unitPlural: 'slices',
      description: 'tri-tip slice across the grain (≈ 2 oz cooked)',
      cookedLbEach: 0.125,
      defaults: { light: 2, normal: 3, hearty: 5 },
      min: 1, max: 8, step: 1,
    },
  },
  'Sausage': {
    typicalCutLb: 1.0, shrinkage: 0.15,
    hrPerLbLow: 0.5, hrPerLbHigh: 0.5,
    finishTemp: 160, cookTemp: 225,
    wrapMethod: 'No wrap', restMinutes: 5,
    serving: {
      unit: 'link', unitPlural: 'links',
      description: 'sausage link (≈ 3 oz cooked, regular size)',
      cookedLbEach: 0.1875,
      defaults: { light: 1, normal: 2, hearty: 3 },
      min: 1, max: 6, step: 1,
    },
  },
};

// Singular / plural names for the typical cut at the butcher, used in
// result copy ("9 lb across 1 brisket" / "18 lb across 2 briskets").
export const CUT_NAMES = {
  'Brisket':          { singular: 'brisket',      plural: 'briskets' },
  'Pulled Pork':      { singular: 'pork butt',    plural: 'pork butts' },
  'St. Louis Ribs':   { singular: 'rack',         plural: 'racks' },
  'Baby Back Ribs':   { singular: 'rack',         plural: 'racks' },
  'Chicken (whole)':  { singular: 'chicken',      plural: 'chickens' },
  'Turkey (whole)':   { singular: 'turkey',       plural: 'turkeys' },
  'Tri-tip':          { singular: 'tri-tip',      plural: 'tri-tips' },
  'Sausage':          { singular: 'lb pack',      plural: 'lb packs' },
};

/* ── Smoker catalog ──
   Capacity is "how many of the typical cut fit on the grates at once."
   Numbers are conservative, real-world estimates (Sausage is in lb-packs
   since cuts of sausage are counted in 1 lb packs per CUT_NAMES). When
   the calculator needs more cuts than fit, it computes batches and the
   total cook clock = batches × per-cut cook hours.

   Sources: manufacturer spec sheets for grate size, then cross-checked
   with BBQ subreddit consensus and Smoking Meat Forums build-out posts.
   Numbers err on the conservative side — if your pit fits more, use the
   Custom smoker option and override. */
export const SMOKERS = [
  // ── Charcoal ──────────────────────────────────────────────
  { name: 'Weber Smokey Mountain 14"', category: 'Charcoal',
    capacity: { 'Brisket': 0, 'Pulled Pork': 1, 'St. Louis Ribs': 2, 'Baby Back Ribs': 3, 'Chicken (whole)': 2, 'Turkey (whole)': 0, 'Tri-tip': 2, 'Sausage': 2 } },
  { name: 'Weber Smokey Mountain 18"', category: 'Charcoal',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 4, 'Baby Back Ribs': 5, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 3, 'Sausage': 4 } },
  { name: 'Weber Smokey Mountain 22"', category: 'Charcoal',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 8, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'Weber Kettle 22"', category: 'Charcoal',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 2, 'Baby Back Ribs': 3, 'Chicken (whole)': 2, 'Turkey (whole)': 1, 'Tri-tip': 3, 'Sausage': 3 } },
  { name: 'Big Green Egg Large', category: 'Charcoal',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 3, 'Baby Back Ribs': 4, 'Chicken (whole)': 2, 'Turkey (whole)': 1, 'Tri-tip': 3, 'Sausage': 3 } },
  { name: 'Big Green Egg XL', category: 'Charcoal',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 5, 'Baby Back Ribs': 6, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 5 } },
  { name: 'Kamado Joe Classic III', category: 'Charcoal',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 4, 'Baby Back Ribs': 5, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 4 } },
  { name: 'Kamado Joe Big Joe III', category: 'Charcoal',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'Kamado Joe Classic II', category: 'Charcoal',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 4, 'Baby Back Ribs': 5, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 4 } },
  { name: 'Primo Oval XL 400', category: 'Charcoal',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 5 } },
  { name: 'Char-Griller Akorn', category: 'Charcoal',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 3, 'Baby Back Ribs': 4, 'Chicken (whole)': 2, 'Turkey (whole)': 1, 'Tri-tip': 3, 'Sausage': 3 } },
  // ── Pellet ────────────────────────────────────────────────
  { name: 'Traeger Pro 575', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 5, 'Baby Back Ribs': 6, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 5 } },
  { name: 'Traeger Pro 780', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'Traeger Ironwood 885', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 4, 'St. Louis Ribs': 7, 'Baby Back Ribs': 8, 'Chicken (whole)': 5, 'Turkey (whole)': 1, 'Tri-tip': 6, 'Sausage': 7 } },
  { name: 'Traeger Timberline 1300', category: 'Pellet',
    capacity: { 'Brisket': 3, 'Pulled Pork': 5, 'St. Louis Ribs': 8, 'Baby Back Ribs': 10, 'Chicken (whole)': 6, 'Turkey (whole)': 2, 'Tri-tip': 8, 'Sausage': 10 } },
  // Traeger Woodridge series — 2024 lineup, replaces Pro 575 / Pro 780
  { name: 'Traeger Woodridge', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 5, 'Baby Back Ribs': 6, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 5 } },
  { name: 'Traeger Woodridge Pro', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 4, 'St. Louis Ribs': 7, 'Baby Back Ribs': 8, 'Chicken (whole)': 5, 'Turkey (whole)': 1, 'Tri-tip': 6, 'Sausage': 7 } },
  { name: 'Traeger Woodridge Elite', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 4, 'St. Louis Ribs': 7, 'Baby Back Ribs': 9, 'Chicken (whole)': 5, 'Turkey (whole)': 2, 'Tri-tip': 7, 'Sausage': 8 } },
  // Recteq — popular Traeger competitor
  { name: 'Recteq RT-590', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 5, 'Baby Back Ribs': 6, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 5 } },
  { name: 'Recteq Bull RT-700', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'Recteq Bullseye RT-1250', category: 'Pellet',
    capacity: { 'Brisket': 3, 'Pulled Pork': 5, 'St. Louis Ribs': 9, 'Baby Back Ribs': 11, 'Chicken (whole)': 6, 'Turkey (whole)': 2, 'Tri-tip': 8, 'Sausage': 11 } },
  // Green Mountain Grills
  { name: 'GMG Davy Crockett', category: 'Pellet',
    capacity: { 'Brisket': 0, 'Pulled Pork': 1, 'St. Louis Ribs': 2, 'Baby Back Ribs': 2, 'Chicken (whole)': 1, 'Turkey (whole)': 0, 'Tri-tip': 2, 'Sausage': 2 } },
  { name: 'GMG Daniel Boone Prime Plus', category: 'Pellet',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 4, 'Baby Back Ribs': 5, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 5 } },
  { name: 'GMG Jim Bowie Prime Plus', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 5, 'Baby Back Ribs': 6, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'GMG Peak Prime Plus', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 4, 'St. Louis Ribs': 8, 'Baby Back Ribs': 9, 'Chicken (whole)': 5, 'Turkey (whole)': 2, 'Tri-tip': 7, 'Sausage': 8 } },
  // Z Grills — popular budget pellet
  { name: 'Z Grills 700D4E', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'Z Grills 11002B', category: 'Pellet',
    capacity: { 'Brisket': 3, 'Pulled Pork': 4, 'St. Louis Ribs': 8, 'Baby Back Ribs': 10, 'Chicken (whole)': 5, 'Turkey (whole)': 2, 'Tri-tip': 7, 'Sausage': 8 } },
  // Camp Chef higher tier
  { name: 'Camp Chef Apex 36', category: 'Pellet',
    capacity: { 'Brisket': 3, 'Pulled Pork': 4, 'St. Louis Ribs': 8, 'Baby Back Ribs': 9, 'Chicken (whole)': 5, 'Turkey (whole)': 2, 'Tri-tip': 7, 'Sausage': 8 } },
  // Memphis Grills — premium
  { name: 'Memphis Grills Beale Street', category: 'Pellet',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 3, 'Baby Back Ribs': 4, 'Chicken (whole)': 2, 'Turkey (whole)': 1, 'Tri-tip': 3, 'Sausage': 4 } },
  { name: 'Memphis Grills Pro ITC3', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 5, 'Baby Back Ribs': 6, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 5 } },
  // MAK — high-end American-made
  { name: 'MAK 2 Star General', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  // Weber SmokeFire
  { name: 'Weber SmokeFire EX4', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'Pit Boss Sportsman 7 Series', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'Pit Boss Pro Series 1100', category: 'Pellet',
    capacity: { 'Brisket': 3, 'Pulled Pork': 4, 'St. Louis Ribs': 8, 'Baby Back Ribs': 10, 'Chicken (whole)': 5, 'Turkey (whole)': 2, 'Tri-tip': 7, 'Sausage': 9 } },
  { name: 'Camp Chef Woodwind 24', category: 'Pellet',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  // ── Offset ────────────────────────────────────────────────
  { name: 'Oklahoma Joe Highland', category: 'Offset',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 5, 'Baby Back Ribs': 6, 'Chicken (whole)': 3, 'Turkey (whole)': 1, 'Tri-tip': 4, 'Sausage': 6 } },
  { name: 'Oklahoma Joe Longhorn', category: 'Offset',
    capacity: { 'Brisket': 3, 'Pulled Pork': 4, 'St. Louis Ribs': 7, 'Baby Back Ribs': 8, 'Chicken (whole)': 4, 'Turkey (whole)': 2, 'Tri-tip': 5, 'Sausage': 8 } },
  { name: 'Lang 36" Original', category: 'Offset',
    capacity: { 'Brisket': 4, 'Pulled Pork': 6, 'St. Louis Ribs': 10, 'Baby Back Ribs': 12, 'Chicken (whole)': 6, 'Turkey (whole)': 2, 'Tri-tip': 8, 'Sausage': 12 } },
  { name: 'Yoder YS640', category: 'Offset',
    capacity: { 'Brisket': 2, 'Pulled Pork': 4, 'St. Louis Ribs': 7, 'Baby Back Ribs': 9, 'Chicken (whole)': 4, 'Turkey (whole)': 2, 'Tri-tip': 6, 'Sausage': 7 } },
  { name: 'Workhorse Pits 1957', category: 'Offset',
    capacity: { 'Brisket': 3, 'Pulled Pork': 5, 'St. Louis Ribs': 9, 'Baby Back Ribs': 11, 'Chicken (whole)': 5, 'Turkey (whole)': 2, 'Tri-tip': 7, 'Sausage': 9 } },
  { name: 'Workhorse Pits 1969', category: 'Offset',
    capacity: { 'Brisket': 4, 'Pulled Pork': 6, 'St. Louis Ribs': 11, 'Baby Back Ribs': 13, 'Chicken (whole)': 6, 'Turkey (whole)': 3, 'Tri-tip': 8, 'Sausage': 11 } },
  { name: 'Mill Scale Metalworks 94', category: 'Offset',
    capacity: { 'Brisket': 4, 'Pulled Pork': 6, 'St. Louis Ribs': 10, 'Baby Back Ribs': 12, 'Chicken (whole)': 6, 'Turkey (whole)': 2, 'Tri-tip': 8, 'Sausage': 10 } },
  { name: 'LSG 24x48 Offset', category: 'Offset',
    capacity: { 'Brisket': 3, 'Pulled Pork': 5, 'St. Louis Ribs': 9, 'Baby Back Ribs': 10, 'Chicken (whole)': 5, 'Turkey (whole)': 2, 'Tri-tip': 7, 'Sausage': 9 } },
  { name: 'Old Country Brazos', category: 'Offset',
    capacity: { 'Brisket': 3, 'Pulled Pork': 4, 'St. Louis Ribs': 8, 'Baby Back Ribs': 9, 'Chicken (whole)': 5, 'Turkey (whole)': 2, 'Tri-tip': 6, 'Sausage': 8 } },
  // ── Drum / Other ──────────────────────────────────────────
  { name: 'Pit Barrel Cooker Classic', category: 'Drum',
    capacity: { 'Brisket': 2, 'Pulled Pork': 4, 'St. Louis Ribs': 8, 'Baby Back Ribs': 8, 'Chicken (whole)': 8, 'Turkey (whole)': 2, 'Tri-tip': 4, 'Sausage': 10 } },
  { name: 'Pit Barrel Junior', category: 'Drum',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 4, 'Baby Back Ribs': 4, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 2, 'Sausage': 5 } },
  { name: 'Gateway Drum 55 Gallon', category: 'Drum',
    capacity: { 'Brisket': 2, 'Pulled Pork': 4, 'St. Louis Ribs': 8, 'Baby Back Ribs': 8, 'Chicken (whole)': 8, 'Turkey (whole)': 2, 'Tri-tip': 4, 'Sausage': 10 } },
  { name: 'Masterbuilt Electric MES40', category: 'Electric',
    capacity: { 'Brisket': 2, 'Pulled Pork': 4, 'St. Louis Ribs': 6, 'Baby Back Ribs': 8, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 6, 'Sausage': 6 } },
  { name: 'Masterbuilt Gravity Series 800', category: 'Electric',
    capacity: { 'Brisket': 2, 'Pulled Pork': 3, 'St. Louis Ribs': 6, 'Baby Back Ribs': 7, 'Chicken (whole)': 4, 'Turkey (whole)': 1, 'Tri-tip': 5, 'Sausage': 6 } },
  { name: 'Bradley Smoker Original', category: 'Electric',
    capacity: { 'Brisket': 1, 'Pulled Pork': 2, 'St. Louis Ribs': 4, 'Baby Back Ribs': 4, 'Chicken (whole)': 2, 'Turkey (whole)': 0, 'Tri-tip': 3, 'Sausage': 4 } },
  { name: 'Backwoods Competitor', category: 'Competition',
    capacity: { 'Brisket': 4, 'Pulled Pork': 8, 'St. Louis Ribs': 12, 'Baby Back Ribs': 14, 'Chicken (whole)': 10, 'Turkey (whole)': 3, 'Tri-tip': 10, 'Sausage': 15 } },
];

// localStorage key for user-saved custom smokers — array of the same
// { name, category: 'Custom', capacity: {...} } shape as SMOKERS.
export const CUSTOM_SMOKERS_KEY = 'bbq-calc-custom-smokers';

export const APPETITE_LEVELS = {
  light:  { label: 'Light',  factor: 0.75 },
  normal: { label: 'Normal', factor: 1.00 },
  hearty: { label: 'Hearty', factor: 1.25 },
};
