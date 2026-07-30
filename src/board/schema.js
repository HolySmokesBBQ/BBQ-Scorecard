// BBQ Board schema — cut IDs, region IDs, store types.
//
// Cut IDs are stable strings we use everywhere: seed data, Firestore docs,
// submission form, filter chips. Adding a new cut = add here + update
// SUBMISSION_FORM_CUTS if it should be user-submittable.

export const CUTS = {
  brisket_prime:   { label: 'Brisket (USDA Prime)',   short: 'Prime Brisket',   category: 'Beef' },
  brisket_choice:  { label: 'Brisket (USDA Choice)',  short: 'Choice Brisket',  category: 'Beef' },
  brisket_select:  { label: 'Brisket (USDA Select)',  short: 'Select Brisket',  category: 'Beef' },
  tri_tip:         { label: 'Tri-tip',                short: 'Tri-tip',         category: 'Beef' },
  ground_beef_80:  { label: 'Ground beef (80/20)',    short: 'Ground 80/20',    category: 'Beef' },
  ribeye:          { label: 'Ribeye steak',           short: 'Ribeye',          category: 'Beef' },
  filet_mignon:    { label: 'Filet mignon',           short: 'Filet',           category: 'Beef' },
  tbone:           { label: 'T-bone steak',           short: 'T-bone',          category: 'Beef' },
  porterhouse:     { label: 'Porterhouse steak',      short: 'Porterhouse',     category: 'Beef' },
  sirloin:         { label: 'Sirloin steak',          short: 'Sirloin',         category: 'Beef' },
  flank:           { label: 'Flank steak',            short: 'Flank',           category: 'Beef' },
  chuck_roast:     { label: 'Chuck roast',            short: 'Chuck',           category: 'Beef' },
  pork_shoulder:   { label: 'Pork shoulder / Boston butt', short: 'Pork Shoulder', category: 'Pork' },
  spare_ribs:      { label: 'Spare ribs (St. Louis)', short: 'Spare Ribs',      category: 'Pork' },
  baby_back_ribs:  { label: 'Baby back ribs',         short: 'Baby Backs',      category: 'Pork' },
  bratwurst_fresh: { label: 'Bratwurst (fresh)',      short: 'Fresh Brats',     category: 'Pork' },
  bratwurst_smoked:{ label: 'Bratwurst (smoked)',     short: 'Smoked Brats',    category: 'Pork' },
  whole_chicken:   { label: 'Whole chicken',          short: 'Whole Chicken',   category: 'Poultry' },
  chicken_breast:  { label: 'Chicken breast (boneless, skinless)', short: 'Chicken Breast', category: 'Poultry' },
  whole_turkey:    { label: 'Whole turkey',           short: 'Whole Turkey',    category: 'Poultry' },
};

export const CUT_ORDER = [
  'brisket_prime', 'brisket_choice', 'brisket_select',
  'ribeye', 'filet_mignon', 'tbone', 'porterhouse', 'sirloin', 'flank',
  'chuck_roast', 'tri_tip', 'ground_beef_80',
  'pork_shoulder', 'spare_ribs', 'baby_back_ribs',
  'bratwurst_fresh', 'bratwurst_smoked',
  'whole_chicken', 'chicken_breast', 'whole_turkey',
];

// Meats group one or more cuts together for the top-level filter. Users
// browse by meat (Brisket) and the app checks every cut under that meat
// (brisket_prime / brisket_choice / brisket_select) when matching prices.
//
// The top-5 meats are always shown as filter chips even when no prices
// exist in that region yet — the empty state on those chips is a submit
// call-to-action, which is how the board grows.
export const MEATS = {
  brisket:       { label: 'Brisket',       short: 'Brisket',       cuts: ['brisket_prime', 'brisket_choice', 'brisket_select'] },
  steaks:        { label: 'Steaks',        short: 'Steaks',        cuts: ['ribeye', 'filet_mignon', 'tbone', 'porterhouse', 'sirloin', 'flank'] },
  chuck_roast:   { label: 'Chuck Roast',   short: 'Chuck',         cuts: ['chuck_roast'] },
  pork_shoulder: { label: 'Pork Shoulder', short: 'Pork Shoulder', cuts: ['pork_shoulder'] },
  ribs:          { label: 'Ribs',          short: 'Ribs',          cuts: ['spare_ribs', 'baby_back_ribs'] },
  bratwurst:     { label: 'Bratwurst',     short: 'Brats',         cuts: ['bratwurst_fresh', 'bratwurst_smoked'] },
  chicken:       { label: 'Whole Chicken', short: 'Chicken',       cuts: ['whole_chicken'] },
  chicken_breast:{ label: 'Chicken Breast',short: 'Chicken Breast',cuts: ['chicken_breast'] },
  ground_beef:   { label: 'Ground Beef',   short: 'Ground Beef',   cuts: ['ground_beef_80'] },
  turkey:        { label: 'Whole Turkey',  short: 'Turkey',        cuts: ['whole_turkey'] },
  tri_tip:       { label: 'Tri-tip',       short: 'Tri-tip',       cuts: ['tri_tip'] },
};

// Top meats — always shown as chips on the Board, in this order.
// Brisket leads (highest-search BBQ cut). Brats sit fourth: they're the
// Wisconsin cultural staple and the highest-engagement local butcher
// topic on r/milwaukee, so they earn a top slot as the WI hook.
export const TOP_MEATS = ['brisket', 'steaks', 'pork_shoulder', 'ribs', 'bratwurst', 'chicken', 'ground_beef'];

// Reverse index: cut id → meat id, for lookup when we have a price and
// need to know which meat filter it belongs under.
export const CUT_TO_MEAT = Object.fromEntries(
  Object.entries(MEATS).flatMap(([meatId, m]) => m.cuts.map(cutId => [cutId, meatId]))
);

// Regions still tag shops for grouping + Firestore query bucketing, but
// they no longer drive the UI. The UI presents a "major city + radius"
// model instead so a Waukesha resident doesn't have to know which bucket
// they belong to. Region on a submission is inferred from the shop.
export const REGIONS = {
  milwaukee_metro:    { label: 'Greater Milwaukee',   state: 'WI', lat: 43.0389, lng: -87.9065 },
  madison_metro:      { label: 'Greater Madison',     state: 'WI', lat: 43.0731, lng: -89.4012 },
  fox_valley:         { label: 'Fox Valley',          state: 'WI', lat: 44.2619, lng: -88.4154 },
  green_bay:          { label: 'Green Bay',           state: 'WI', lat: 44.5133, lng: -88.0133 },
  chicago_metro:      { label: 'Greater Chicago',     state: 'IL', lat: 41.8781, lng: -87.6298 },
  kansas_city_metro:  { label: 'Greater Kansas City', state: 'MO', lat: 39.0997, lng: -94.5786 },
  austin_metro:       { label: 'Greater Austin',      state: 'TX', lat: 30.2672, lng: -97.7431 },
  memphis_metro:      { label: 'Greater Memphis',     state: 'TN', lat: 35.1495, lng: -90.0490 },
  nashville_metro:    { label: 'Greater Nashville',   state: 'TN', lat: 36.1627, lng: -86.7816 },
  st_louis_metro:     { label: 'Greater St. Louis',   state: 'MO', lat: 38.6270, lng: -90.1994 },
  dallas_metro:       { label: 'Greater Dallas',      state: 'TX', lat: 32.7767, lng: -96.7970 },
  houston_metro:      { label: 'Greater Houston',     state: 'TX', lat: 29.7604, lng: -95.3698 },
  san_antonio_metro:  { label: 'Greater San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  birmingham_metro:   { label: 'Greater Birmingham',  state: 'AL', lat: 33.5186, lng: -86.8104 },
  boise_metro:        { label: 'Greater Boise',       state: 'ID', lat: 43.6150, lng: -116.2023 },
  lexington_metro:    { label: 'Greater Lexington',   state: 'KY', lat: 38.0406, lng: -84.5037 },
  greenville_metro:   { label: 'Greater Greenville',  state: 'SC', lat: 34.8526, lng: -82.3940 },
  owensboro_metro:    { label: 'Owensboro',           state: 'KY', lat: 37.7719, lng: -87.1112 },
  lockhart_metro:     { label: 'Lockhart',            state: 'TX', lat: 29.8849, lng: -97.6700 },
  atlanta_metro:      { label: 'Greater Atlanta',     state: 'GA', lat: 33.7490, lng: -84.3880 },
  louisville_metro:   { label: 'Greater Louisville',  state: 'KY', lat: 38.2527, lng: -85.7585 },
  charlotte_metro:    { label: 'Greater Charlotte',   state: 'NC', lat: 35.2271, lng: -80.8431 },
  raleigh_metro:      { label: 'Greater Raleigh',     state: 'NC', lat: 35.7796, lng: -78.6382 },
  columbia_metro:     { label: 'Greater Columbia',    state: 'SC', lat: 34.0007, lng: -81.0348 },
  lexington_nc_metro: { label: 'Lexington',           state: 'NC', lat: 35.8243, lng: -80.2534 },
  tuscaloosa_metro:   { label: 'Greater Tuscaloosa',  state: 'AL', lat: 33.2098, lng: -87.5692 },
  oklahoma_city_metro:{ label: 'Greater Oklahoma City',state: 'OK', lat: 35.4676, lng: -97.5164 },
  tulsa_metro:        { label: 'Greater Tulsa',       state: 'OK', lat: 36.1540, lng: -95.9928 },
  little_rock_metro:  { label: 'Greater Little Rock', state: 'AR', lat: 34.7465, lng: -92.2896 },
  new_orleans_metro:  { label: 'Greater New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
  savannah_metro:     { label: 'Greater Savannah',    state: 'GA', lat: 32.0809, lng: -81.0912 },
  denver_metro:       { label: 'Greater Denver',      state: 'CO', lat: 39.7392, lng: -104.9903 },
  jacksonville_metro: { label: 'Greater Jacksonville',state: 'FL', lat: 30.3322, lng: -81.6557 },
  phoenix_metro:      { label: 'Greater Phoenix',     state: 'AZ', lat: 33.4484, lng: -112.0740 },
  wichita_metro:      { label: 'Greater Wichita',     state: 'KS', lat: 37.6872, lng: -97.3301 },
  twin_cities_metro:  { label: 'Twin Cities',         state: 'MN', lat: 44.9778, lng: -93.2650 },
  omaha_metro:        { label: 'Greater Omaha',       state: 'NE', lat: 41.2565, lng: -95.9345 },
  cincinnati_metro:   { label: 'Greater Cincinnati',  state: 'OH', lat: 39.1031, lng: -84.5120 },
  indianapolis_metro: { label: 'Greater Indianapolis',state: 'IN', lat: 39.7684, lng: -86.1581 },
  pittsburgh_metro:   { label: 'Greater Pittsburgh',  state: 'PA', lat: 40.4406, lng: -79.9959 },
};

const REGION_ORDER = [
  'milwaukee_metro', 'madison_metro', 'fox_valley', 'green_bay',
  'chicago_metro', 'kansas_city_metro', 'austin_metro', 'memphis_metro',
  'nashville_metro', 'st_louis_metro',
  'dallas_metro', 'houston_metro', 'san_antonio_metro',
  'birmingham_metro', 'boise_metro', 'lexington_metro', 'greenville_metro',
  'owensboro_metro', 'lockhart_metro',
  'atlanta_metro', 'louisville_metro', 'charlotte_metro', 'raleigh_metro',
  'columbia_metro', 'lexington_nc_metro', 'tuscaloosa_metro', 'oklahoma_city_metro',
  'tulsa_metro',
  'little_rock_metro', 'new_orleans_metro', 'savannah_metro', 'denver_metro',
  'jacksonville_metro', 'phoenix_metro', 'wichita_metro', 'twin_cities_metro',
  'omaha_metro', 'cincinnati_metro', 'indianapolis_metro', 'pittsburgh_metro',
];

// Major cities the app offers as anchor points for the "City + radius"
// filter. Each has a Firestore region tag so we know which submissions
// to pull; multiple cities can share a region (Milwaukee + Waukesha both
// map to milwaukee_metro). Radius is applied as Haversine distance from
// the city's lat/lng.
export const CITIES = {
  // ─── Milwaukee metro ──────────────────────────────────────
  milwaukee_wi:    { label: 'Milwaukee, WI',    state: 'WI', region: 'milwaukee_metro',   lat: 43.0389, lng: -87.9065 },
  waukesha_wi:     { label: 'Waukesha, WI',     state: 'WI', region: 'milwaukee_metro',   lat: 43.0117, lng: -88.2314 },
  west_allis_wi:   { label: 'West Allis, WI',   state: 'WI', region: 'milwaukee_metro',   lat: 43.0167, lng: -88.0070 },
  racine_wi:       { label: 'Racine, WI',       state: 'WI', region: 'milwaukee_metro',   lat: 42.7261, lng: -87.7829 },
  kenosha_wi:      { label: 'Kenosha, WI',      state: 'WI', region: 'milwaukee_metro',   lat: 42.5847, lng: -87.8212 },
  oconomowoc_wi:   { label: 'Oconomowoc, WI',   state: 'WI', region: 'milwaukee_metro',   lat: 43.1117, lng: -88.4993 },
  // ─── Madison metro ────────────────────────────────────────
  madison_wi:      { label: 'Madison, WI',      state: 'WI', region: 'madison_metro',     lat: 43.0731, lng: -89.4012 },
  middleton_wi:    { label: 'Middleton, WI',    state: 'WI', region: 'madison_metro',     lat: 43.0972, lng: -89.5040 },
  sun_prairie_wi:  { label: 'Sun Prairie, WI',  state: 'WI', region: 'madison_metro',     lat: 43.1836, lng: -89.2137 },
  fitchburg_wi:    { label: 'Fitchburg, WI',    state: 'WI', region: 'madison_metro',     lat: 43.0136, lng: -89.4695 },
  janesville_wi:   { label: 'Janesville, WI',   state: 'WI', region: 'madison_metro',     lat: 42.6828, lng: -89.0187 },
  // ─── Fox Valley ───────────────────────────────────────────
  appleton_wi:     { label: 'Appleton, WI',     state: 'WI', region: 'fox_valley',        lat: 44.2619, lng: -88.4154 },
  oshkosh_wi:      { label: 'Oshkosh, WI',      state: 'WI', region: 'fox_valley',        lat: 44.0247, lng: -88.5426 },
  neenah_wi:       { label: 'Neenah, WI',       state: 'WI', region: 'fox_valley',        lat: 44.1858, lng: -88.4626 },
  // ─── Green Bay ────────────────────────────────────────────
  green_bay_wi:    { label: 'Green Bay, WI',    state: 'WI', region: 'green_bay',         lat: 44.5133, lng: -88.0133 },
  de_pere_wi:      { label: 'De Pere, WI',      state: 'WI', region: 'green_bay',         lat: 44.4489, lng: -88.0604 },
  // ─── Chicago metro ────────────────────────────────────────
  chicago_il:      { label: 'Chicago, IL',      state: 'IL', region: 'chicago_metro',     lat: 41.8781, lng: -87.6298 },
  naperville_il:   { label: 'Naperville, IL',   state: 'IL', region: 'chicago_metro',     lat: 41.7508, lng: -88.1535 },
  evanston_il:     { label: 'Evanston, IL',     state: 'IL', region: 'chicago_metro',     lat: 42.0451, lng: -87.6877 },
  // ─── Kansas City metro ────────────────────────────────────
  kansas_city_mo:  { label: 'Kansas City, MO',  state: 'MO', region: 'kansas_city_metro', lat: 39.0997, lng: -94.5786 },
  overland_park_ks:{ label: 'Overland Park, KS',state: 'KS', region: 'kansas_city_metro', lat: 38.9822, lng: -94.6708 },
  independence_mo: { label: 'Independence, MO', state: 'MO', region: 'kansas_city_metro', lat: 39.0911, lng: -94.4155 },
  liberty_mo:      { label: 'Liberty, MO',      state: 'MO', region: 'kansas_city_metro', lat: 39.2461, lng: -94.4191 },
  // ─── Austin metro ─────────────────────────────────────────
  austin_tx:       { label: 'Austin, TX',       state: 'TX', region: 'austin_metro',      lat: 30.2672, lng: -97.7431 },
  round_rock_tx:   { label: 'Round Rock, TX',   state: 'TX', region: 'austin_metro',      lat: 30.5083, lng: -97.6789 },
  san_marcos_tx:   { label: 'San Marcos, TX',   state: 'TX', region: 'austin_metro',      lat: 29.8833, lng: -97.9414 },
  // ─── Memphis metro ────────────────────────────────────────
  memphis_tn:      { label: 'Memphis, TN',      state: 'TN', region: 'memphis_metro',     lat: 35.1495, lng: -90.0490 },
  germantown_tn:   { label: 'Germantown, TN',   state: 'TN', region: 'memphis_metro',     lat: 35.0868, lng: -89.8100 },
  bartlett_tn:     { label: 'Bartlett, TN',     state: 'TN', region: 'memphis_metro',     lat: 35.2046, lng: -89.8739 },
  // ─── Nashville metro ──────────────────────────────────────
  nashville_tn:    { label: 'Nashville, TN',    state: 'TN', region: 'nashville_metro',   lat: 36.1627, lng: -86.7816 },
  franklin_tn:     { label: 'Franklin, TN',     state: 'TN', region: 'nashville_metro',   lat: 35.9251, lng: -86.8689 },
  brentwood_tn:    { label: 'Brentwood, TN',    state: 'TN', region: 'nashville_metro',   lat: 36.0331, lng: -86.7828 },
  // ─── St. Louis metro ──────────────────────────────────────
  st_louis_mo:     { label: 'St. Louis, MO',    state: 'MO', region: 'st_louis_metro',    lat: 38.6270, lng: -90.1994 },
  ofallon_mo:      { label: "O'Fallon, MO",     state: 'MO', region: 'st_louis_metro',    lat: 38.8106, lng: -90.6998 },
  // ─── Dallas metro ────────────────────────────────────────
  dallas_tx:       { label: 'Dallas, TX',        state: 'TX', region: 'dallas_metro',      lat: 32.7767, lng: -96.7970 },
  fort_worth_tx:   { label: 'Fort Worth, TX',    state: 'TX', region: 'dallas_metro',      lat: 32.7555, lng: -97.3308 },
  arlington_tx:    { label: 'Arlington, TX',     state: 'TX', region: 'dallas_metro',      lat: 32.7357, lng: -97.1081 },
  plano_tx:        { label: 'Plano, TX',         state: 'TX', region: 'dallas_metro',      lat: 33.0198, lng: -96.6989 },
  // ─── Houston metro ───────────────────────────────────────
  houston_tx:      { label: 'Houston, TX',       state: 'TX', region: 'houston_metro',     lat: 29.7604, lng: -95.3698 },
  sugar_land_tx:   { label: 'Sugar Land, TX',    state: 'TX', region: 'houston_metro',     lat: 29.6197, lng: -95.6349 },
  katy_tx:         { label: 'Katy, TX',          state: 'TX', region: 'houston_metro',     lat: 29.7858, lng: -95.8245 },
  // ─── San Antonio metro ───────────────────────────────────
  san_antonio_tx:  { label: 'San Antonio, TX',   state: 'TX', region: 'san_antonio_metro', lat: 29.4241, lng: -98.4936 },
  new_braunfels_tx:{ label: 'New Braunfels, TX', state: 'TX', region: 'san_antonio_metro', lat: 29.7030, lng: -98.1245 },
  // ─── Birmingham metro ────────────────────────────────────
  birmingham_al:   { label: 'Birmingham, AL',    state: 'AL', region: 'birmingham_metro',  lat: 33.5186, lng: -86.8104 },
  hoover_al:       { label: 'Hoover, AL',        state: 'AL', region: 'birmingham_metro',  lat: 33.4054, lng: -86.8114 },
  vestavia_hills_al:{ label: 'Vestavia Hills, AL',state: 'AL', region: 'birmingham_metro', lat: 33.4487, lng: -86.7878 },
  // ─── Boise metro ─────────────────────────────────────────
  boise_id:        { label: 'Boise, ID',         state: 'ID', region: 'boise_metro',       lat: 43.6150, lng: -116.2023 },
  meridian_id:     { label: 'Meridian, ID',       state: 'ID', region: 'boise_metro',       lat: 43.6121, lng: -116.3915 },
  nampa_id:        { label: 'Nampa, ID',          state: 'ID', region: 'boise_metro',       lat: 43.5407, lng: -116.5635 },
  // ─── Lexington metro ─────────────────────────────────────
  lexington_ky:    { label: 'Lexington, KY',     state: 'KY', region: 'lexington_metro',   lat: 38.0406, lng: -84.5037 },
  georgetown_ky:   { label: 'Georgetown, KY',    state: 'KY', region: 'lexington_metro',   lat: 38.2098, lng: -84.5588 },
  // ─── Greenville metro ────────────────────────────────────
  greenville_sc:   { label: 'Greenville, SC',    state: 'SC', region: 'greenville_metro',  lat: 34.8526, lng: -82.3940 },
  spartanburg_sc:  { label: 'Spartanburg, SC',   state: 'SC', region: 'greenville_metro',  lat: 34.9496, lng: -81.9320 },
  greer_sc:        { label: 'Greer, SC',         state: 'SC', region: 'greenville_metro',  lat: 34.9388, lng: -82.2271 },
  // ─── Owensboro ────────────────────────────────────────────
  owensboro_ky:    { label: 'Owensboro, KY',     state: 'KY', region: 'owensboro_metro',   lat: 37.7719, lng: -87.1112 },
  // ─── Lockhart ─────────────────────────────────────────────
  lockhart_tx:     { label: 'Lockhart, TX',      state: 'TX', region: 'lockhart_metro',    lat: 29.8849, lng: -97.6700 },
  // ─── Atlanta metro ───────────────────────────────────────
  atlanta_ga:      { label: 'Atlanta, GA',       state: 'GA', region: 'atlanta_metro',     lat: 33.7490, lng: -84.3880 },
  marietta_ga:     { label: 'Marietta, GA',      state: 'GA', region: 'atlanta_metro',     lat: 33.9526, lng: -84.5499 },
  decatur_ga:      { label: 'Decatur, GA',       state: 'GA', region: 'atlanta_metro',     lat: 33.7748, lng: -84.2963 },
  // ─── Louisville metro ────────────────────────────────────
  louisville_ky:   { label: 'Louisville, KY',    state: 'KY', region: 'louisville_metro',  lat: 38.2527, lng: -85.7585 },
  jeffersontown_ky:{ label: 'Jeffersontown, KY', state: 'KY', region: 'louisville_metro',  lat: 38.1937, lng: -85.5636 },
  // ─── Charlotte metro ─────────────────────────────────────
  charlotte_nc:    { label: 'Charlotte, NC',     state: 'NC', region: 'charlotte_metro',   lat: 35.2271, lng: -80.8431 },
  concord_nc:      { label: 'Concord, NC',       state: 'NC', region: 'charlotte_metro',   lat: 35.4088, lng: -80.5795 },
  gastonia_nc:     { label: 'Gastonia, NC',      state: 'NC', region: 'charlotte_metro',   lat: 35.2621, lng: -81.1873 },
  // ─── Raleigh metro ───────────────────────────────────────
  raleigh_nc:      { label: 'Raleigh, NC',       state: 'NC', region: 'raleigh_metro',     lat: 35.7796, lng: -78.6382 },
  durham_nc:       { label: 'Durham, NC',        state: 'NC', region: 'raleigh_metro',     lat: 35.9940, lng: -78.8986 },
  cary_nc:         { label: 'Cary, NC',          state: 'NC', region: 'raleigh_metro',     lat: 35.7915, lng: -78.7811 },
  // ─── Columbia metro ──────────────────────────────────────
  columbia_sc:     { label: 'Columbia, SC',      state: 'SC', region: 'columbia_metro',    lat: 34.0007, lng: -81.0348 },
  // ─── Lexington NC ────────────────────────────────────────
  lexington_nc:    { label: 'Lexington, NC',     state: 'NC', region: 'lexington_nc_metro',lat: 35.8243, lng: -80.2534 },
  // ─── Tuscaloosa metro ────────────────────────────────────
  tuscaloosa_al:   { label: 'Tuscaloosa, AL',    state: 'AL', region: 'tuscaloosa_metro',  lat: 33.2098, lng: -87.5692 },
  northport_al:    { label: 'Northport, AL',     state: 'AL', region: 'tuscaloosa_metro',  lat: 33.2290, lng: -87.5772 },
  // ─── Oklahoma City metro ─────────────────────────────────
  oklahoma_city_ok:{ label: 'Oklahoma City, OK', state: 'OK', region: 'oklahoma_city_metro',lat: 35.4676, lng: -97.5164 },
  edmond_ok:       { label: 'Edmond, OK',        state: 'OK', region: 'oklahoma_city_metro',lat: 35.6528, lng: -97.4781 },
  norman_ok:       { label: 'Norman, OK',        state: 'OK', region: 'oklahoma_city_metro',lat: 35.2226, lng: -97.4395 },
  // ─── Tulsa metro ─────────────────────────────────────────
  tulsa_ok:        { label: 'Tulsa, OK',         state: 'OK', region: 'tulsa_metro',          lat: 36.1540, lng: -95.9928 },
  broken_arrow_ok: { label: 'Broken Arrow, OK',  state: 'OK', region: 'tulsa_metro',          lat: 36.0609, lng: -95.7975 },
  // ─── Little Rock metro ───────────────────────────────────
  little_rock_ar:  { label: 'Little Rock, AR',   state: 'AR', region: 'little_rock_metro',    lat: 34.7465, lng: -92.2896 },
  north_little_rock_ar: { label: 'North Little Rock, AR', state: 'AR', region: 'little_rock_metro', lat: 34.7695, lng: -92.2671 },
  // ─── New Orleans metro ───────────────────────────────────
  new_orleans_la:  { label: 'New Orleans, LA',   state: 'LA', region: 'new_orleans_metro',    lat: 29.9511, lng: -90.0715 },
  metairie_la:     { label: 'Metairie, LA',      state: 'LA', region: 'new_orleans_metro',    lat: 29.9841, lng: -90.1529 },
  kenner_la:       { label: 'Kenner, LA',        state: 'LA', region: 'new_orleans_metro',    lat: 29.9941, lng: -90.2417 },
  // ─── Savannah metro ──────────────────────────────────────
  savannah_ga:     { label: 'Savannah, GA',      state: 'GA', region: 'savannah_metro',       lat: 32.0809, lng: -81.0912 },
  pooler_ga:       { label: 'Pooler, GA',        state: 'GA', region: 'savannah_metro',       lat: 32.1155, lng: -81.2470 },
  // ─── Denver metro ────────────────────────────────────────
  denver_co:       { label: 'Denver, CO',        state: 'CO', region: 'denver_metro',         lat: 39.7392, lng: -104.9903 },
  aurora_co:       { label: 'Aurora, CO',        state: 'CO', region: 'denver_metro',         lat: 39.7294, lng: -104.8319 },
  lakewood_co:     { label: 'Lakewood, CO',      state: 'CO', region: 'denver_metro',         lat: 39.7047, lng: -105.0814 },
  // ─── Jacksonville metro ──────────────────────────────────
  jacksonville_fl: { label: 'Jacksonville, FL',  state: 'FL', region: 'jacksonville_metro',   lat: 30.3322, lng: -81.6557 },
  orange_park_fl:  { label: 'Orange Park, FL',   state: 'FL', region: 'jacksonville_metro',   lat: 30.1661, lng: -81.7065 },
  // ─── Phoenix metro ───────────────────────────────────────
  phoenix_az:      { label: 'Phoenix, AZ',       state: 'AZ', region: 'phoenix_metro',        lat: 33.4484, lng: -112.0740 },
  mesa_az:         { label: 'Mesa, AZ',          state: 'AZ', region: 'phoenix_metro',        lat: 33.4152, lng: -111.8315 },
  scottsdale_az:   { label: 'Scottsdale, AZ',    state: 'AZ', region: 'phoenix_metro',        lat: 33.4942, lng: -111.9261 },
  glendale_az:     { label: 'Glendale, AZ',      state: 'AZ', region: 'phoenix_metro',        lat: 33.5387, lng: -112.1860 },
  // ─── Wichita metro ───────────────────────────────────────
  wichita_ks:      { label: 'Wichita, KS',       state: 'KS', region: 'wichita_metro',        lat: 37.6872, lng: -97.3301 },
  derby_ks:        { label: 'Derby, KS',         state: 'KS', region: 'wichita_metro',        lat: 37.5456, lng: -97.2689 },
  // ─── Twin Cities metro ───────────────────────────────────
  minneapolis_mn:  { label: 'Minneapolis, MN',   state: 'MN', region: 'twin_cities_metro',    lat: 44.9778, lng: -93.2650 },
  st_paul_mn:      { label: 'St. Paul, MN',      state: 'MN', region: 'twin_cities_metro',    lat: 44.9537, lng: -93.0900 },
  bloomington_mn:  { label: 'Bloomington, MN',   state: 'MN', region: 'twin_cities_metro',    lat: 44.8408, lng: -93.2983 },
  // ─── Omaha metro ─────────────────────────────────────────
  omaha_ne:        { label: 'Omaha, NE',         state: 'NE', region: 'omaha_metro',          lat: 41.2565, lng: -95.9345 },
  council_bluffs_ia: { label: 'Council Bluffs, IA', state: 'IA', region: 'omaha_metro',       lat: 41.2619, lng: -95.8608 },
  bellevue_ne:     { label: 'Bellevue, NE',      state: 'NE', region: 'omaha_metro',          lat: 41.1370, lng: -95.9145 },
  // ─── Cincinnati metro ────────────────────────────────────
  cincinnati_oh:   { label: 'Cincinnati, OH',    state: 'OH', region: 'cincinnati_metro',     lat: 39.1031, lng: -84.5120 },
  covington_ky:    { label: 'Covington, KY',     state: 'KY', region: 'cincinnati_metro',     lat: 39.0837, lng: -84.5086 },
  mason_oh:        { label: 'Mason, OH',         state: 'OH', region: 'cincinnati_metro',     lat: 39.3600, lng: -84.3099 },
  // ─── Indianapolis metro ──────────────────────────────────
  indianapolis_in: { label: 'Indianapolis, IN',  state: 'IN', region: 'indianapolis_metro',   lat: 39.7684, lng: -86.1581 },
  carmel_in:       { label: 'Carmel, IN',        state: 'IN', region: 'indianapolis_metro',   lat: 39.9784, lng: -86.1180 },
  fishers_in:      { label: 'Fishers, IN',       state: 'IN', region: 'indianapolis_metro',   lat: 39.9568, lng: -86.0134 },
  // ─── Pittsburgh metro ────────────────────────────────────
  pittsburgh_pa:   { label: 'Pittsburgh, PA',    state: 'PA', region: 'pittsburgh_metro',     lat: 40.4406, lng: -79.9959 },
  monroeville_pa:  { label: 'Monroeville, PA',   state: 'PA', region: 'pittsburgh_metro',     lat: 40.4212, lng: -79.7881 },
  bethel_park_pa:  { label: 'Bethel Park, PA',   state: 'PA', region: 'pittsburgh_metro',     lat: 40.3276, lng: -80.0339 },
};

export const CITY_ORDER = [
  'milwaukee_wi', 'waukesha_wi', 'west_allis_wi', 'racine_wi', 'kenosha_wi', 'oconomowoc_wi',
  'madison_wi', 'middleton_wi', 'sun_prairie_wi', 'fitchburg_wi', 'janesville_wi',
  'appleton_wi', 'oshkosh_wi', 'neenah_wi',
  'green_bay_wi', 'de_pere_wi',
  'chicago_il', 'naperville_il', 'evanston_il',
  'kansas_city_mo', 'overland_park_ks', 'independence_mo', 'liberty_mo',
  'austin_tx', 'round_rock_tx', 'san_marcos_tx',
  'memphis_tn', 'germantown_tn', 'bartlett_tn',
  'nashville_tn', 'franklin_tn', 'brentwood_tn',
  'st_louis_mo', 'ofallon_mo',
  'dallas_tx', 'fort_worth_tx', 'arlington_tx', 'plano_tx',
  'houston_tx', 'sugar_land_tx', 'katy_tx',
  'san_antonio_tx', 'new_braunfels_tx',
  'birmingham_al', 'hoover_al', 'vestavia_hills_al',
  'boise_id', 'meridian_id', 'nampa_id',
  'lexington_ky', 'georgetown_ky',
  'greenville_sc', 'spartanburg_sc', 'greer_sc',
  'owensboro_ky',
  'lockhart_tx',
  'atlanta_ga', 'marietta_ga', 'decatur_ga',
  'louisville_ky', 'jeffersontown_ky',
  'charlotte_nc', 'concord_nc', 'gastonia_nc',
  'raleigh_nc', 'durham_nc', 'cary_nc',
  'columbia_sc',
  'lexington_nc',
  'tuscaloosa_al', 'northport_al',
  'oklahoma_city_ok', 'edmond_ok', 'norman_ok',
  'tulsa_ok', 'broken_arrow_ok',
  'little_rock_ar', 'north_little_rock_ar',
  'new_orleans_la', 'metairie_la', 'kenner_la',
  'savannah_ga', 'pooler_ga',
  'denver_co', 'aurora_co', 'lakewood_co',
  'jacksonville_fl', 'orange_park_fl',
  'phoenix_az', 'mesa_az', 'scottsdale_az', 'glendale_az',
  'wichita_ks', 'derby_ks',
  'minneapolis_mn', 'st_paul_mn', 'bloomington_mn',
  'omaha_ne', 'council_bluffs_ia', 'bellevue_ne',
  'cincinnati_oh', 'covington_ky', 'mason_oh',
  'indianapolis_in', 'carmel_in', 'fishers_in',
  'pittsburgh_pa', 'monroeville_pa', 'bethel_park_pa',
];

// Full names for the state codes that appear in CITIES. Hand-maintained
// (there are only ~23 states in play today). Adding a new state to
// CITIES = add its label here too, or the state selector shows the raw
// code as a fallback.
export const STATE_LABELS = {
  AL: 'Alabama',
  AR: 'Arkansas',
  CO: 'Colorado',
  GA: 'Georgia',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MN: 'Minnesota',
  MO: 'Missouri',
  NC: 'North Carolina',
  NE: 'Nebraska',
  OH: 'Ohio',
  OK: 'Oklahoma',
  PA: 'Pennsylvania',
  SC: 'South Carolina',
  TN: 'Tennessee',
  TX: 'Texas',
  WI: 'Wisconsin',
};

// STATES is derived once at module load from CITIES + CITY_ORDER.
// Shape: { [code]: { code, label, cityIds: [id, ...] } }
// cityIds within each state are sorted using the existing CITY_ORDER
// so the state list reads in the same order as the rest of the app.
export const STATES = (() => {
  const byCode = {};
  for (const [id, city] of Object.entries(CITIES)) {
    const code = city.state;
    if (!byCode[code]) {
      byCode[code] = { code, label: STATE_LABELS[code] || code, cityIds: [] };
    }
    byCode[code].cityIds.push(id);
  }
  const cityRank = new Map(CITY_ORDER.map((id, i) => [id, i]));
  for (const s of Object.values(byCode)) {
    s.cityIds.sort((a, b) => (cityRank.get(a) ?? 9999) - (cityRank.get(b) ?? 9999));
  }
  return byCode;
})();

// Radius presets in miles. 25 mi is the default — wide enough to catch
// most metro shops, tight enough to feel local.
export const RADIUS_OPTIONS = [5, 10, 25, 50, 100];
export const DEFAULT_RADIUS = 25;

// Haversine distance in miles between two lat/lng pairs.
export function distanceMiles(a, b) {
  const R = 3958.8; // Earth radius in miles
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2
    + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.asin(Math.sqrt(x));
}

// Find nearest major city to a lat/lng — used by "detect my location."
// Returns { id, distance } in miles.
export function nearestCity(lat, lng) {
  let bestId = CITY_ORDER[0];
  let bestDist = Infinity;
  for (const id of CITY_ORDER) {
    const c = CITIES[id];
    const d = distanceMiles({ lat, lng }, c);
    if (d < bestDist) { bestDist = d; bestId = id; }
  }
  return { id: bestId, distance: bestDist };
}

// Store type drives icon + trust weight. Butcher shops get a small
// visual boost since they're the concept's north star (drive business
// to local butchers). Warehouse/grocery still tracked because that's
// where most people actually shop.
export const STORE_TYPES = {
  butcher:    { label: 'Butcher shop',       icon: '🔪' },
  warehouse:  { label: 'Warehouse club',     icon: '📦' },
  grocery:    { label: 'Grocery store',      icon: '🛒' },
  farm:       { label: 'Direct / Farm',      icon: '🐄' },
};

// A price is fresh for 30 days, then flagged stale. Older than 90 = hidden
// from the default view (still queryable, just not sorted into the list).
const FRESHNESS_DAYS = 30;
const STALE_THRESHOLD_DAYS = 90;

export function isFresh(timestamp) {
  if (!timestamp) return false;
  const ageMs = Date.now() - new Date(timestamp).getTime();
  return ageMs < FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

export function isStale(timestamp) {
  if (!timestamp) return true;
  const ageMs = Date.now() - new Date(timestamp).getTime();
  return ageMs > STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}

export function ageInDays(timestamp) {
  if (!timestamp) return null;
  const ageMs = Date.now() - new Date(timestamp).getTime();
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}
