# BBQ Board — Calculator + Hamburger Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side hamburger menu to BBQ Board that houses a new lightweight Calculator (buy-lbs + post-smoke yield with per-meat shrinkage slider) and a new minimal Settings screen. Ship to Android Play Internal first for UI iteration; iOS follows automatically via the next Codemagic build.

**Architecture:** Three new files (`src/board/calc.js` pure math, `src/board/Calculator.jsx` screen, `src/board/Settings.jsx` screen, `src/components/BoardHamburger.jsx` nav), plus edits to `src/App.board.jsx` to mount the hamburger and route views. Shrinkage overrides persist in `localStorage` per-meat. Baseline values come from `MEAT_GUIDE` in `src/constants.js`.

**Tech Stack:** Preact + Vite (Board's existing web stack), Capacitor for native, no new npm deps. Board has no test framework configured; pure math helpers get inline `console.assert()` dev-mode blocks, UI verified via Vite dev server + Chrome MCP.

**Spec:** [docs/superpowers/specs/2026-08-04-board-calculator-hamburger-design.md](../specs/2026-08-04-board-calculator-hamburger-design.md)

---

## Task 1 — Pure calculator math

**Files:**
- Create: `src/board/calc.js`

- [ ] **Step 1: Create the file with all pure functions + inline dev assertions**

```javascript
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
```

- [ ] **Step 2: Verify no syntax errors by running the vite build check**

Run: `npx vite build --config vite.config.native.board.js 2>&1 | tail -5`
Expected: `✓ built in Xms` with no errors mentioning calc.js.

- [ ] **Step 3: Commit**

```bash
git add src/board/calc.js
git commit -m "Board: add pure calculator math (buy + yield + shrinkage overrides)"
```

---

## Task 2 — Calculator screen

**Files:**
- Create: `src/board/Calculator.jsx`

- [ ] **Step 1: Create the Calculator screen**

```jsx
import { useState, useMemo, useEffect } from 'react';
import { MEAT_GUIDE } from '../constants.js';
import {
  CALC_MEATS, PORTION_LEVELS,
  getShrinkageOverrides, saveShrinkageOverride, resetShrinkageOverride,
  effectiveShrinkage, shrinkageBounds,
  calculateBuy, calculateYield,
} from './calc.js';

// Board-embedded calculator. Two panels:
//   A) "How much to buy" — guest count + portion + meats → raw lbs at counter
//   B) "Post-smoke yield" — raw lbs on smoker + meat → cooked lbs off
// Per-meat shrinkage slider is shared state between panels: adjust it in
// either place, both panels re-price.

const PAL = {
  bg: '#1a1a1a', panel: '#232830', panelDeep: '#1c2027',
  border: '#3a4048', brass: '#d4a64a', brassDim: '#a17c33',
  text: '#f5e6d3', textDim: '#9aa3ad',
  green: '#6a9968', amber: '#d4a64a',
};

const S = {
  card: {
    background: PAL.panel, border: `1px solid ${PAL.border}`,
    borderRadius: 8, padding: 16, marginBottom: 16,
  },
  h2: {
    fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700,
    letterSpacing: 2, color: PAL.brass, margin: '0 0 12px 0',
  },
  label: { display: 'block', fontSize: 12, color: PAL.textDim, marginBottom: 6, letterSpacing: 1 },
  input: {
    width: '100%', boxSizing: 'border-box',
    background: PAL.panelDeep, border: `1px solid ${PAL.border}`,
    borderRadius: 6, padding: '10px 12px', color: PAL.text, fontSize: 15,
  },
  chip: (active) => ({
    background: active ? PAL.brass : PAL.panelDeep,
    color: active ? '#1a1a1a' : PAL.text,
    border: `1px solid ${active ? PAL.brass : PAL.border}`,
    borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  }),
  meatToggle: (on) => ({
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    padding: '8px 10px', borderRadius: 6,
    background: on ? '#2a3138' : 'transparent',
    border: `1px solid ${on ? PAL.brass : PAL.border}`,
    marginBottom: 6,
  }),
  slider: {
    width: '100%', accentColor: PAL.brass, margin: '4px 0',
  },
  resetLink: {
    background: 'none', border: 'none', color: PAL.brassDim,
    fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline',
  },
  outputCard: {
    background: PAL.panelDeep, border: `1px solid ${PAL.border}`,
    borderRadius: 6, padding: 12, marginTop: 8,
  },
  outputBig: {
    fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700,
    color: PAL.brass, letterSpacing: 1,
  },
  outputSmall: { fontSize: 12, color: PAL.textDim, marginTop: 2 },
};

function pct(v) { return Math.round(v * 100); }

// Slider for one meat's shrinkage. Presents the current value + baseline
// tick + a "reset" affordance when the user has overridden.
function ShrinkageSlider({ meat, value, onChange }) {
  const { min, max, baseline } = shrinkageBounds(meat);
  const isOverridden = Math.abs(value - baseline) > 0.001;
  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: PAL.textDim, marginBottom: 2 }}>
        <span>Shrinkage: <strong style={{ color: PAL.brass }}>{pct(value)}%</strong> {isOverridden && <span style={{ color: PAL.textDim }}>(baseline {pct(baseline)}%)</span>}</span>
        {isOverridden && (
          <button style={S.resetLink} onClick={() => onChange(baseline)}>reset</button>
        )}
      </div>
      <input
        type="range"
        min={min} max={max} step={0.01} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={S.slider}
        aria-label={`${meat} shrinkage percentage`}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: PAL.textDim }}>
        <span>{pct(min)}%</span>
        <span>{pct(max)}%</span>
      </div>
    </div>
  );
}

export default function Calculator({ onClose }) {
  // Panel A state
  const [guests, setGuests] = useState(8);
  const [portionLevel, setPortionLevel] = useState('normal');
  const [selectedMeats, setSelectedMeats] = useState(() => new Set(['Brisket']));

  // Panel B state
  const [yieldMeat, setYieldMeat] = useState('Brisket');
  const [rawInput, setRawInput] = useState(12);

  // Shrinkage state — shared across panels. Loaded from localStorage once,
  // then held in-memory + persisted on every change.
  const [overrides, setOverrides] = useState(() => getShrinkageOverrides());

  const setShrink = (meat, value) => {
    const { min, max } = shrinkageBounds(meat);
    const clamped = Math.max(min, Math.min(max, value));
    const next = { ...overrides, [meat]: clamped };
    setOverrides(next);
    saveShrinkageOverride(meat, clamped);
  };

  const resetShrink = (meat) => {
    const next = { ...overrides };
    delete next[meat];
    setOverrides(next);
    resetShrinkageOverride(meat);
  };

  const toggleMeat = (meat) => {
    const next = new Set(selectedMeats);
    if (next.has(meat)) next.delete(meat); else next.add(meat);
    setSelectedMeats(next);
  };

  // Panel A results
  const buyResults = useMemo(() => {
    return CALC_MEATS
      .filter(m => selectedMeats.has(m))
      .map(m => ({
        meat: m,
        shrinkage: effectiveShrinkage(m, overrides),
        ...calculateBuy({
          meat: m, guests: Math.max(1, guests), portionLevel,
          shrinkage: effectiveShrinkage(m, overrides),
        }),
      }));
  }, [selectedMeats, guests, portionLevel, overrides]);

  const totalRaw = buyResults.reduce((sum, r) => sum + r.rawLb, 0);

  // Panel B result
  const yieldResult = useMemo(() => {
    const s = effectiveShrinkage(yieldMeat, overrides);
    return {
      shrinkage: s,
      ...calculateYield({ meat: yieldMeat, rawLb: Math.max(0, parseFloat(rawInput) || 0), shrinkage: s }),
    };
  }, [yieldMeat, rawInput, overrides]);

  return (
    <div style={{ minHeight: '100vh', background: PAL.bg, color: PAL.text, padding: 16 }}>
      <div className="bbq-container-wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: 3, color: PAL.brass, margin: 0 }}>
            CALCULATOR
          </h1>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: `1px solid ${PAL.border}`, color: PAL.text, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
            aria-label="Close calculator"
          >
            ← Back
          </button>
        </div>

        <p style={{ fontSize: 13, color: PAL.textDim, marginTop: 0, marginBottom: 20 }}>
          Buy-lbs and post-smoke yield with per-meat shrinkage you control.
          Slider changes save automatically and stick between visits.
        </p>

        {/* ── Panel A: How much to buy ── */}
        <div style={S.card}>
          <h2 style={S.h2}>HOW MUCH TO BUY</h2>

          <label style={S.label}>Guests</label>
          <input
            type="number" min="1" max="500" value={guests}
            onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={S.input}
          />

          <label style={{ ...S.label, marginTop: 14 }}>Portion size</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {PORTION_LEVELS.map(level => (
              <button key={level} style={S.chip(portionLevel === level)}
                onClick={() => setPortionLevel(level)}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>

          <label style={{ ...S.label, marginTop: 14 }}>Meats</label>
          <div>
            {CALC_MEATS.map(m => {
              const on = selectedMeats.has(m);
              return (
                <div key={m}>
                  <div style={S.meatToggle(on)} onClick={() => toggleMeat(m)}
                    role="checkbox" aria-checked={on}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') toggleMeat(m); }}
                    tabIndex={0}>
                    <span style={{ fontSize: 16 }}>{on ? '☑' : '☐'}</span>
                    <span style={{ flex: 1 }}>{m}</span>
                    <span style={{ fontSize: 11, color: PAL.textDim }}>
                      {MEAT_GUIDE[m].serving.defaults[portionLevel]} {MEAT_GUIDE[m].serving[MEAT_GUIDE[m].serving.defaults[portionLevel] === 1 ? 'unit' : 'unitPlural']} / person
                    </span>
                  </div>
                  {on && (
                    <div style={{ paddingLeft: 28, paddingRight: 10 }}>
                      <ShrinkageSlider
                        meat={m}
                        value={effectiveShrinkage(m, overrides)}
                        onChange={(v) => setShrink(m, v)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {buyResults.length > 0 && (
            <>
              <div style={{ marginTop: 16, borderTop: `1px solid ${PAL.border}`, paddingTop: 16 }}>
                {buyResults.map(r => (
                  <div key={r.meat} style={S.outputCard}>
                    <div style={{ fontSize: 13, color: PAL.textDim, marginBottom: 4 }}>{r.meat}</div>
                    <div style={S.outputBig}>{r.rawLb.toFixed(1)} lb raw</div>
                    <div style={S.outputSmall}>
                      = {r.cookedLb.toFixed(1)} lb cooked · {r.cuts} {r.cuts === 1 ? 'cut' : 'cuts'} @ ~{MEAT_GUIDE[r.meat].typicalCutLb} lb each · {pct(r.shrinkage)}% shrinkage
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, textAlign: 'right', fontFamily: "'Oswald', sans-serif", fontSize: 16, letterSpacing: 1, color: PAL.text }}>
                TOTAL RAW <span style={{ color: PAL.brass, fontWeight: 700 }}>{totalRaw.toFixed(1)} lb</span>
              </div>
            </>
          )}
        </div>

        {/* ── Panel B: Post-smoke yield ── */}
        <div style={S.card}>
          <h2 style={S.h2}>POST-SMOKE YIELD</h2>

          <label style={S.label}>Meat</label>
          <select value={yieldMeat} onChange={(e) => setYieldMeat(e.target.value)} style={S.input}>
            {CALC_MEATS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <label style={{ ...S.label, marginTop: 14 }}>Raw pounds on the smoker</label>
          <input
            type="number" min="0" max="500" step="0.5" value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            style={S.input}
          />

          <div style={{ marginTop: 8 }}>
            <ShrinkageSlider
              meat={yieldMeat}
              value={yieldResult.shrinkage}
              onChange={(v) => setShrink(yieldMeat, v)}
            />
          </div>

          <div style={S.outputCard}>
            <div style={{ fontSize: 13, color: PAL.textDim, marginBottom: 4 }}>You'll pull</div>
            <div style={S.outputBig}>{yieldResult.cookedLb.toFixed(1)} lb cooked</div>
            <div style={S.outputSmall}>
              ≈ {Math.round(yieldResult.servingsAtNormal)} servings at Normal portion · {pct(yieldResult.shrinkage)}% shrinkage
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: PAL.textDim, textAlign: 'center', margin: '24px 0 8px', lineHeight: 1.5 }}>
          Baselines from Franklin, Meathead, KCBS, National Pork Board, and Raichlen.
          Your overrides save on this device.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npx vite build --config vite.config.native.board.js 2>&1 | tail -5`
Expected: `✓ built in Xms` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/board/Calculator.jsx
git commit -m "Board: add Calculator screen (buy + yield + shrinkage slider)"
```

---

## Task 3 — Settings screen

**Files:**
- Create: `src/board/Settings.jsx`

- [ ] **Step 1: Create the Settings screen**

```jsx
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.board.js';
import { STATES, STATE_LABELS } from './schema.js';

// Board Settings — minimal by design. Board has less user-owned state
// than Scorecard/Notebook (no cooks, no reviews to export). This
// screen only surfaces things a user actually might want to change:
// default region + radius + units, plus authentication and legal links.

const PAL = {
  bg: '#1a1a1a', panel: '#232830', panelDeep: '#1c2027',
  border: '#3a4048', brass: '#d4a64a',
  text: '#f5e6d3', textDim: '#9aa3ad',
};

const S = {
  card: {
    background: PAL.panel, border: `1px solid ${PAL.border}`,
    borderRadius: 8, padding: 16, marginBottom: 16,
  },
  h2: {
    fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700,
    letterSpacing: 2, color: PAL.brass, margin: '0 0 12px 0',
  },
  label: { display: 'block', fontSize: 12, color: PAL.textDim, marginBottom: 6, letterSpacing: 1 },
  input: {
    width: '100%', boxSizing: 'border-box',
    background: PAL.panelDeep, border: `1px solid ${PAL.border}`,
    borderRadius: 6, padding: '10px 12px', color: PAL.text, fontSize: 15,
  },
  chip: (active) => ({
    background: active ? PAL.brass : PAL.panelDeep,
    color: active ? '#1a1a1a' : PAL.text,
    border: `1px solid ${active ? PAL.brass : PAL.border}`,
    borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  }),
  link: {
    color: PAL.brass, textDecoration: 'none', fontSize: 14, display: 'block',
    padding: '10px 0', borderBottom: `1px solid ${PAL.border}`,
  },
  btn: {
    background: 'transparent', border: `1px solid ${PAL.border}`,
    color: PAL.text, borderRadius: 6, padding: '8px 16px', cursor: 'pointer',
    fontSize: 14,
  },
};

const LS_REGION = 'board-default-region';
const LS_RADIUS = 'board-default-radius';
const LS_UNITS = 'board-distance-units';
const RADIUS_OPTIONS = [10, 25, 50, 100];
const UNIT_OPTIONS = ['mi', 'km'];

function readLS(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeLS(key, value) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch {}
}

export default function Settings({ user, onSignIn, onClose }) {
  const [region, setRegion] = useState(() => readLS(LS_REGION, 'milwaukee_metro'));
  const [radius, setRadius] = useState(() => parseInt(readLS(LS_RADIUS, '25'), 10));
  const [units, setUnits] = useState(() => readLS(LS_UNITS, 'mi'));

  const handleRegion = (v) => { setRegion(v); writeLS(LS_REGION, v); };
  const handleRadius = (v) => { setRadius(v); writeLS(LS_RADIUS, String(v)); };
  const handleUnits = (v) => { setUnits(v); writeLS(LS_UNITS, v); };

  return (
    <div style={{ minHeight: '100vh', background: PAL.bg, color: PAL.text, padding: 16 }}>
      <div className="bbq-container-wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: 3, color: PAL.brass, margin: 0 }}>
            SETTINGS
          </h1>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: `1px solid ${PAL.border}`, color: PAL.text, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
            aria-label="Close settings"
          >
            ← Back
          </button>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>DEFAULTS</h2>

          <label style={S.label}>Default region</label>
          <select value={region} onChange={(e) => handleRegion(e.target.value)} style={S.input}>
            {STATES.map(s => (
              <option key={s} value={s}>{STATE_LABELS[s] || s}</option>
            ))}
          </select>

          <label style={{ ...S.label, marginTop: 14 }}>Default search radius</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RADIUS_OPTIONS.map(r => (
              <button key={r} style={S.chip(radius === r)} onClick={() => handleRadius(r)}>
                {r} {units}
              </button>
            ))}
          </div>

          <label style={{ ...S.label, marginTop: 14 }}>Distance units</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {UNIT_OPTIONS.map(u => (
              <button key={u} style={S.chip(units === u)} onClick={() => handleUnits(u)}>
                {u === 'mi' ? 'Miles' : 'Kilometers'}
              </button>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>ACCOUNT</h2>
          {user ? (
            <>
              <div style={{ fontSize: 14, marginBottom: 12 }}>
                Signed in as <strong>{user.email || user.displayName || 'Google user'}</strong>
              </div>
              <button style={S.btn} onClick={() => signOut(auth)}>Sign out</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, color: PAL.textDim, marginBottom: 12 }}>
                Google Sign-In lets you submit prices and appear on the Leaderboard.
              </div>
              <button style={S.btn} onClick={onSignIn}>Sign in with Google</button>
            </>
          )}
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>LEGAL</h2>
          <a href="https://holysmokesbbqco.com/privacy-board.html" target="_blank" rel="noopener noreferrer" style={S.link}>
            Privacy Policy
          </a>
          <a href="https://holysmokesbbqco.com/delete-account-board.html" target="_blank" rel="noopener noreferrer" style={{ ...S.link, borderBottom: 'none' }}>
            Delete Account
          </a>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>ABOUT THIS APP</h2>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            BBQ Board v{import.meta.env?.VITE_BUILD_VERSION || '2.3.6'}
          </div>
          <a href="https://holysmokesbbqco.com/board/changelog" target="_blank" rel="noopener noreferrer" style={{ color: PAL.brass, fontSize: 13 }}>
            Release notes →
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npx vite build --config vite.config.native.board.js 2>&1 | tail -5`
Expected: `✓ built in Xms`.

- [ ] **Step 3: Commit**

```bash
git add src/board/Settings.jsx
git commit -m "Board: add minimal Settings screen (region, radius, units, account, legal)"
```

---

## Task 4 — Hamburger menu

**Files:**
- Create: `src/components/BoardHamburger.jsx`

- [ ] **Step 1: Create the BoardHamburger component**

```jsx
import { useState, useEffect } from 'react';

// Board's hamburger menu — right-side floating ☰ button that opens a
// right-slide drawer. Structure matches Scorecard's AppNav and
// Notebook's NotebookHamburger: titled groups + About button pinned
// in the footer. Board's groups are lighter because Board has fewer
// nav destinations than the other two apps.

const PAL = {
  bg: '#1a1a1a', panel: '#232830', panelDeep: '#1c2027',
  border: '#3a4048', brass: '#d4a64a',
  text: '#f5e6d3', textDim: '#9aa3ad',
};

const MENU_GROUPS = [
  { title: 'BBQ BOARD', items: [{ label: 'Home', key: 'home' }] },
  { title: 'TOOLS',     items: [{ label: 'Calculator', key: 'calculator' }] },
  { title: 'ACCOUNT',   items: [{ label: 'Settings', key: 'settings' }] },
];

export default function BoardHamburger({ currentView, onNavigate, onAbout }) {
  const [open, setOpen] = useState(false);

  // Close drawer on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSelect = (key) => {
    setOpen(false);
    onNavigate(key);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          right: '14px',
          zIndex: 900,
          background: PAL.panel,
          border: `1px solid ${PAL.border}`,
          borderRadius: 8,
          width: 40,
          height: 40,
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: PAL.text,
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        ☰
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 2999,
            }}
          />
          <div
            role="dialog" aria-label="Menu"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 'min(320px, 85vw)',
              background: PAL.bg,
              borderLeft: `1px solid ${PAL.border}`,
              zIndex: 3000,
              display: 'flex', flexDirection: 'column',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: `1px solid ${PAL.border}`,
            }}>
              <span style={{
                fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700,
                letterSpacing: 3, color: PAL.textDim,
              }}>
                MENU
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                style={{
                  background: 'transparent', border: 'none', color: PAL.text,
                  fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
              {MENU_GROUPS.map(group => (
                <div key={group.title} style={{ marginBottom: 20 }}>
                  <div style={{
                    padding: '0 20px 6px', fontFamily: "'Oswald', sans-serif",
                    fontSize: 11, letterSpacing: 2, color: PAL.textDim, fontWeight: 700,
                  }}>
                    {group.title}
                  </div>
                  {group.items.map(item => {
                    const active = currentView === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleSelect(item.key)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          background: active ? PAL.panel : 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${PAL.border}`,
                          color: active ? PAL.brass : PAL.text,
                          padding: '14px 20px', fontSize: 15, cursor: 'pointer',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${PAL.border}`, padding: '12px 20px' }}>
              <button
                onClick={() => { setOpen(false); onAbout(); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none',
                  color: PAL.brass, padding: '10px 0', fontSize: 14,
                  fontFamily: "'Oswald', sans-serif", letterSpacing: 2, cursor: 'pointer',
                }}
              >
                ABOUT HOLY SMOKES BBQ
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npx vite build --config vite.config.native.board.js 2>&1 | tail -5`
Expected: `✓ built in Xms`.

- [ ] **Step 3: Commit**

```bash
git add src/components/BoardHamburger.jsx
git commit -m "Board: add hamburger menu (☰) with BBQ BOARD / TOOLS / ACCOUNT groups"
```

---

## Task 5 — Wire everything into App.board.jsx

**Files:**
- Modify: `src/App.board.jsx`

- [ ] **Step 1: Add imports and view state**

Open `src/App.board.jsx`. Add these imports near the top with the other component/lib imports (top of file, next to the other `import` lines):

```jsx
import BoardHamburger from './components/BoardHamburger.jsx';
import Calculator from './board/Calculator.jsx';
import Settings from './board/Settings.jsx';
```

- [ ] **Step 2: Add view state next to the existing useState calls in the main App component**

Find the block that currently reads:

```jsx
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [showAbout, setShowAbout] = useState(false);
  const [detailShopId, setDetailShopId] = useState(null);
```

Add a new state line right after that block:

```jsx
  const [view, setView] = useState('home'); // 'home' | 'calculator' | 'settings'
```

- [ ] **Step 3: Route sub-screens BEFORE the main return block**

Find the line `return (` at the start of the main component's JSX (currently around line 249). Insert this block IMMEDIATELY BEFORE that line:

```jsx
  if (view === 'calculator') {
    return (
      <>
        <Calculator onClose={() => setView('home')} />
        <BoardHamburger currentView={view} onNavigate={setView} onAbout={() => { setShowAbout(true); track('board_about_opened'); }} />
        {showAbout && <AboutScreen onClose={() => setShowAbout(false)} user={user} />}
      </>
    );
  }

  if (view === 'settings') {
    return (
      <>
        <Settings user={user} onSignIn={handleSignIn} onClose={() => setView('home')} />
        <BoardHamburger currentView={view} onNavigate={setView} onAbout={() => { setShowAbout(true); track('board_about_opened'); }} />
        {showAbout && <AboutScreen onClose={() => setShowAbout(false)} user={user} />}
      </>
    );
  }
```

- [ ] **Step 4: Mount the hamburger in the main view + remove Header's About button**

Find the JSX block starting with `return (` and the `<Header` element right after. Update the `<Header>` call to drop the `onAbout` prop (About moves to the hamburger footer), then add `<BoardHamburger>` alongside `<AboutScreen>`.

Replace:

```jsx
      <Header
        user={user}
        onSignIn={handleSignIn}
        onSignOut={() => signOut(auth)}
        onAbout={() => { setShowAbout(true); track('board_about_opened'); }}
      />
      {showAbout && <AboutScreen onClose={() => setShowAbout(false)} user={user} />}
```

With:

```jsx
      <Header
        user={user}
        onSignIn={handleSignIn}
        onSignOut={() => signOut(auth)}
      />
      <BoardHamburger
        currentView={view}
        onNavigate={setView}
        onAbout={() => { setShowAbout(true); track('board_about_opened'); }}
      />
      {showAbout && <AboutScreen onClose={() => setShowAbout(false)} user={user} />}
```

- [ ] **Step 5: Remove the About button from the Header component**

Find the `function Header(...)` definition (around line 552). Its signature currently accepts `onAbout` and renders an About button. Replace the whole function with:

```jsx
function Header({ user, onSignIn, onSignOut }) {
  // Slim action-bar-only header. About + Settings live in the hamburger
  // now, so this header carries only the back-to-website link (web)
  // and sign-in/out.
  return (
    <header style={{
      background: PAL.panelDeep,
      borderBottom: `1px solid ${PAL.border}`,
      padding: '8px 16px',
    }}>
      <div className="bbq-container-wide" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!window.Capacitor?.isNativePlatform?.() && (
            <a href="/" onClick={() => track('cross_app_nav', { from: 'board', to: 'site' })}
              style={{ color: PAL.textDim, textDecoration: 'none', fontSize: 14, padding: '6px 4px' }}>← Back</a>
          )}
        </div>
        {user ? (
          <button onClick={onSignOut} style={secondaryBtn}>Sign out</button>
        ) : (
          <button onClick={onSignIn} style={secondaryBtn}>Sign in</button>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Verify no syntax errors after all edits**

Run: `npx vite build --config vite.config.native.board.js 2>&1 | tail -5`
Expected: `✓ built in Xms`.

- [ ] **Step 7: Commit**

```bash
git add src/App.board.jsx
git commit -m "Board: mount hamburger + route Calculator/Settings views; drop Header About button"
```

---

## Task 6 — Web build + sync + Vite dev-server verify

**Files:**
- No new files; runtime verification only.

- [ ] **Step 1: Fresh production-web build**

Run: `npm run build:board-native 2>&1 | tail -10`
Expected: `✓ built in Xs` with no errors; last lines list the generated `dist-board-native/*.js` files.

- [ ] **Step 2: Sync web bundle to android-board**

Run: `npm run sync:board 2>&1 | tail -5`
Expected: `Done.` — bundle copied into `android-board/app/src/main/assets/public/`.

- [ ] **Step 3: Start Vite dev server for Board**

Confirm `.claude/launch.json` has an entry for Board's dev server; if not, add one. Then start via the preview tool:

If entry needs creating, use this shape in `.claude/launch.json`:

```json
{
  "name": "board-dev",
  "runtimeExecutable": "npx",
  "runtimeArgs": ["vite", "--config", "vite.config.board.js"],
  "port": 5173
}
```

Start the preview via `preview_start` with `name: 'board-dev'`. The URL Vite prints goes into the Chrome MCP browser.

- [ ] **Step 4: Manual UI check via Chrome MCP browser**

Open the Board dev URL. Verify by inspecting the running page (screenshot only if needed for a layout question — prefer read_page/find per browser-textmode preference):

1. Header shows only the Sign in / Sign out button on the right. NO "About" button.
2. Floating ☰ appears top-right, above the shop directory content.
3. Clicking ☰ opens the right-side drawer with three groups: BBQ BOARD (Home), TOOLS (Calculator), ACCOUNT (Settings), plus ABOUT HOLY SMOKES BBQ pinned in the footer.
4. Clicking Calculator: shows CALCULATOR heading, Guest count input, Portion chips, meat toggles (default Brisket checked). Toggling on shows the shrinkage slider. Sliding it changes the output cards live and persists after a page reload (`localStorage.getItem('board-calc-shrinkage-overrides')` returns a JSON blob).
5. Clicking Settings: shows region dropdown, radius chips, units chips, Account state, Legal + version links.
6. Clicking ABOUT HOLY SMOKES BBQ in the drawer footer: opens the existing AboutScreen modal (Board's brand story + cross-promo).
7. Back arrow on Calculator and Settings returns to the home directory.

- [ ] **Step 5: Fix any surface bugs found in the manual check**

If the manual check surfaces issues (unlikely for pure UI wiring but possible), fix inline and re-run steps 1–4. Commit each fix as its own commit.

- [ ] **Step 6: Commit any dev launch config change**

If `.claude/launch.json` was edited in Step 3:

```bash
git add .claude/launch.json
git commit -m "Board: add Vite dev-server launch entry"
```

---

## Task 7 — Version bump + AAB build + queue rebuild

**Files:**
- Modify: `android-board/app/build.gradle`
- New signed AABs: `BBQ-Board-Android/BBQ Board-signed-v2.3.6.aab` (through v2.4.3)

- [ ] **Step 1: Ping sibling Android sessions before starting the queue rebuild**

Per `feedback-gradle-daemon-cross-session`, concurrent gradle builds across sibling sessions kill each other's daemon. Send Scorecard + Notebook sessions a heads-up that Board is about to run ~8 gradle builds in sequence over the next ~15 min, so they hold off on their own gradle work.

- [ ] **Step 2: Bump versionCode + versionName in `android-board/app/build.gradle` to 2.3.6**

The file currently has `versionCode 24300` / `versionName "2.4.3"` from the last queue rebuild. Replace with:

```groovy
        versionCode 23600
        versionName "2.3.6"
```

- [ ] **Step 3: Build the v2.3.6 AAB**

Run: `cd android-board && ./gradlew :app:bundleRelease 2>&1 | tail -10 && cd ..`
Expected: `BUILD SUCCESSFUL` and a message `Signed AAB archived to: ../BBQ-Board-Android/BBQ Board-signed-v2.3.6.aab`.

- [ ] **Step 4: Confirm v2.3.6 AAB exists and looks right**

Run: `ls -la "BBQ-Board-Android/BBQ Board-signed-v2.3.6.aab"`
Expected: file exists, ~30 MB (Board's baseline is ~29.6 MB; Calculator + hamburger add small JS).

- [ ] **Step 5: Rebuild the rest of the queue (v2.3.7 → v2.4.3, 7 AABs) via the existing loop script**

Reuse `scratchpad/rebuild-board-queue.sh` — bump the versions array to start at 2.3.7 instead of 2.3.6 since we already built 2.3.6. Or use this ad-hoc:

```bash
VERSIONS=(
  "23700 2.3.7"
  "23800 2.3.8"
  "23900 2.3.9"
  "24000 2.4.0"
  "24100 2.4.1"
  "24200 2.4.2"
  "24300 2.4.3"
)
for line in "${VERSIONS[@]}"; do
  code="${line% *}"
  name="${line#* }"
  echo "=== v${name} ==="
  sed -i "s/versionCode [0-9]*/versionCode ${code}/" android-board/app/build.gradle
  sed -i "s/versionName \"[0-9.]*\"/versionName \"${name}\"/" android-board/app/build.gradle
  ( cd android-board && ./gradlew :app:bundleRelease 2>&1 | tail -3 )
done
ls -la BBQ-Board-Android/BBQ\ Board-signed-v2.3.*.aab BBQ-Board-Android/BBQ\ Board-signed-v2.4.*.aab
```

Run that in the background (via `run_in_background: true`) — takes ~10 min.

- [ ] **Step 6: Commit the versionCode/versionName bump (only the final state)**

The build.gradle ends up at v2.4.3 after the loop. That's fine — it's a working-state file, the important thing is the AABs are on disk.

```bash
git add android-board/app/build.gradle
git commit -m "Board: bump to 2.3.6 baseline for Calculator + Hamburger release; queue rebuilt through 2.4.3"
```

- [ ] **Step 7: Push all Board commits to origin + board remotes**

```bash
git push origin main
```

Board remote sync happens via the divergent-remote worktree pattern only if the SPEC or codemagic yaml files changed. This release doesn't touch either — origin push is enough for now.

---

## Task 8 — Ship v2.3.6 to Play Store Internal Testing

**Files:**
- No repo changes; manual Play Console step.

- [ ] **Step 1: Navigate to Play Console → BBQ Board → Internal Testing → Create new release**

Chrome MCP driven. Use `mcp__claude-in-chrome__navigate` to `https://play.google.com/console/u/0/developers/6509526948711252857/app/4972094170880359969/tracks/internal-testing`.

- [ ] **Step 2: Click "Create new release"**

Via ref-based click after `find`.

- [ ] **Step 3: Ask user to drag the v2.3.6 AAB into the drop zone**

Path to hand off: `C:\Users\jmuil\Desktop\bbq-pwa-source-v2.1.2\BBQ-Board-Android\BBQ Board-signed-v2.3.6.aab`. The file_upload MCP tool cannot bypass the sandbox on project paths — this is the standard human-in-the-loop drag step per feedback-browser-textmode.

- [ ] **Step 4: Fill release notes**

Once the AAB uploads, scroll to Release notes and paste:

```
<en-US>
New: Hamburger menu (top-right) with Calculator and Settings inside. The Calculator estimates how much meat to buy for your guest count and how much comes off after the smoke, with per-meat shrinkage sliders you can dial to your smoker. About Holy Smokes BBQ moved to the hamburger footer.
</en-US>
```

Type via real keyboard events (per browser-textmode memory: ASC/Play forms use controlled inputs that need real key events, not JS setters). Use `computer.left_click` on the textarea via its ref, then `computer.type`.

- [ ] **Step 5: Next → Save and publish**

Internal Testing publishes immediately after save. No Google review required.

- [ ] **Step 6: Update the task list, close the release loop**

Mark this task complete and add a follow-up task to promote v2.3.6 to Closed Testing (Alpha) after ~24h of internal tester feedback on the Calculator UI.

---

## Post-implementation notes

- **iOS follows automatically** when the next Codemagic build runs on Board's remote. The web bundle is shared; native code doesn't need to change. Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `ios-board/App/App.xcodeproj/project.pbxproj` (2.3.5 → 2.3.6, build 2 → 3) and push to board remote → Codemagic auto-triggers → uploads to ASC → auto-submits for external review (per the yaml flip on 2026-08-03).

- **Do NOT flip submit_to_testflight or otherwise touch the ios-board/ tree in this plan.** Android UI iteration is the goal. iOS ports later once UI is stable.

- **Testers to watch for feedback from:** internal testers (Joel + whoever's been added to the Internal Testers group). Focus areas: does the drawer feel natural, does the shrinkage slider make sense at first glance, does anyone complain about missing List/Map in the drawer.
