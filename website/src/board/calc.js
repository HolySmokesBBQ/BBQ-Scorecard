// Pure calculator math for BBQ Board's in-app Calculator screen.
//
// The math is deliberately simple and side-effect free — one function
// per calculation, all inputs explicit. localStorage is the only
// side effect and it's confined to the shrinkageOverride helpers.
//
// Baseline shrinkage per meat lives in src/constants.js MEAT_GUIDE.
// The user can override any meat's shrinkage via a slider bounded to
// baseline ±15 percentage points (see SLIDER_HALF_RANGE). Overrides
// persist in localStorage under LS_KEY, keyed by meat name.

import { MEAT_GUIDE } from '../constants.js';

// Meats Board's Calculator surfaces. Same set as MEAT_GUIDE — the
// Calculator inherits the standalone Calculator app's meat lineup so
// the numbers agree across surfaces.
export const CALC_MEATS = Object.keys(MEAT_GUIDE);

// Portion levels — chip picker in the UI. Each meat's serving.defaults
// object in MEAT_GUIDE has a numeric count for each of these keys
// (e.g. brisket light=2 slices, normal=4, hearty=6).
export const PORTION_LEVELS = ['light', 'normal', 'hearty'];

// Slider half-range in decimal points. Slider spans baseline ±0.15
// so brisket (baseline 0.50) slides 0.35–0.65, sausage (baseline 0.15)
// slides 0.00–0.30 (clamped to a floor of 0).
export const SLIDER_HALF_RANGE = 0.15;

// localStorage key for shrinkage overrides. JSON blob of {meat: value}.
const LS_KEY = 'board-calc-shrinkage-overrides';

// Read all user shrinkage overrides. Returns an object mapping meat
// name to decimal shrinkage. Missing keys mean "use baseline."
export function getShrinkageOverrides() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// Save a single meat's override. Value should be the decimal
// shrinkage (0.35, not 35). Pass null/undefined to clear.
export function saveShrinkageOverride(meat, value) {
  if (typeof window === 'undefined') return;
  const all = getShrinkageOverrides();
  if (value == null) delete all[meat]; else all[meat] = value;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
}

// Clear one meat's override so it falls back to baseline.
export function resetShrinkageOverride(meat) {
  saveShrinkageOverride(meat, null);
}

// Effective shrinkage = user override if set, otherwise baseline.
// This is the ONLY function callers should use to look up the number
// they should actually apply to a meat.
export function effectiveShrinkage(meat, overrides = getShrinkageOverrides()) {
  const baseline = MEAT_GUIDE[meat]?.shrinkage ?? 0;
  const override = overrides[meat];
  return typeof override === 'number' ? override : baseline;
}

// Slider bounds for a meat. Clamped to [0, 0.95] so users can't dial
// in absurd values that would blow up the math (division by ~0) or
// suggest negative meat.
export function shrinkageBounds(meat) {
  const baseline = MEAT_GUIDE[meat]?.shrinkage ?? 0;
  const min = Math.max(0, baseline - SLIDER_HALF_RANGE);
  const max = Math.min(0.95, baseline + SLIDER_HALF_RANGE);
  return { min, max, baseline };
}

// Buy-lbs calculation for a single meat.
// Inputs:
//   meat: string (must be a key of MEAT_GUIDE)
//   guests: positive integer
//   portionLevel: one of PORTION_LEVELS
//   shrinkage: decimal, typically from effectiveShrinkage()
// Returns:
//   cookedLb: total cooked pounds needed
//   rawLb: total raw pounds to buy (= cookedLb / (1 - shrinkage))
//   cuts: suggested number of typicalCutLb-sized cuts (rounded up)
//   servingsPerPerson: integer, from MEAT_GUIDE[meat].serving.defaults[level]
export function calculateBuy({ meat, guests, portionLevel, shrinkage }) {
  const spec = MEAT_GUIDE[meat];
  if (!spec) return { cookedLb: 0, rawLb: 0, cuts: 0, servingsPerPerson: 0 };
  const servingsPerPerson = spec.serving.defaults[portionLevel] ?? spec.serving.defaults.normal;
  const cookedLb = guests * servingsPerPerson * spec.serving.cookedLbEach;
  const yieldFactor = 1 - shrinkage;
  const rawLb = yieldFactor > 0 ? cookedLb / yieldFactor : cookedLb;
  const cuts = spec.typicalCutLb > 0 ? Math.ceil(rawLb / spec.typicalCutLb) : 0;
  return { cookedLb, rawLb, cuts, servingsPerPerson };
}

// Post-smoke yield calculation.
// Inputs:
//   meat: string
//   rawLb: raw pounds going on the smoker
//   shrinkage: decimal
// Returns:
//   cookedLb: pounds coming off
//   servingsAtNormal: how many Normal-portion servings that covers
export function calculateYield({ meat, rawLb, shrinkage }) {
  const spec = MEAT_GUIDE[meat];
  if (!spec) return { cookedLb: 0, servingsAtNormal: 0 };
  const cookedLb = rawLb * (1 - shrinkage);
  const normalServing = spec.serving.defaults.normal * spec.serving.cookedLbEach;
  const servingsAtNormal = normalServing > 0 ? cookedLb / normalServing : 0;
  return { cookedLb, servingsAtNormal };
}

// Dev-mode self-check. Fires once on module import in a Vite dev
// build. Catches regressions where someone changes MEAT_GUIDE
// shrinkage values or breaks the arithmetic.
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  const buy = calculateBuy({ meat: 'Brisket', guests: 10, portionLevel: 'normal', shrinkage: 0.5 });
  console.assert(Math.abs(buy.cookedLb - 5) < 0.01, 'calc: brisket 10ppl normal cookedLb should be 5', buy);
  console.assert(Math.abs(buy.rawLb - 10) < 0.01, 'calc: brisket 10ppl normal rawLb should be 10 at 50% shrinkage', buy);
  console.assert(buy.cuts === 1, 'calc: brisket 10lb raw fits in one 12lb packer', buy);

  const y = calculateYield({ meat: 'Brisket', rawLb: 12, shrinkage: 0.5 });
  console.assert(Math.abs(y.cookedLb - 6) < 0.01, 'calc: brisket 12lb raw at 50% shrinkage = 6lb cooked', y);

  const b = shrinkageBounds('Brisket');
  console.assert(Math.abs(b.min - 0.35) < 0.001 && Math.abs(b.max - 0.65) < 0.001, 'calc: brisket bounds 0.35..0.65', b);

  const b2 = shrinkageBounds('Sausage');
  console.assert(Math.abs(b2.min - 0) < 0.001 && Math.abs(b2.max - 0.30) < 0.001, 'calc: sausage bounds 0..0.30 (clamped)', b2);
}
