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
              const perPerson = MEAT_GUIDE[m].serving.defaults[portionLevel];
              const unit = perPerson === 1 ? MEAT_GUIDE[m].serving.unit : MEAT_GUIDE[m].serving.unitPlural;
              return (
                <div key={m}>
                  <div style={S.meatToggle(on)} onClick={() => toggleMeat(m)}
                    role="checkbox" aria-checked={on}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') toggleMeat(m); }}
                    tabIndex={0}>
                    <span style={{ fontSize: 16 }}>{on ? '☑' : '☐'}</span>
                    <span style={{ flex: 1 }}>{m}</span>
                    <span style={{ fontSize: 11, color: PAL.textDim }}>
                      {perPerson} {unit} / person
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
