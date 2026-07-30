import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  MEAT_GUIDE, APPETITE_LEVELS, CUT_NAMES,
  SMOKERS, CUSTOM_SMOKERS_KEY,
} from './constants.js';
import { WOODS, BLENDS, getRecommendedWoods, getCompat } from './woods.js';

// Standalone BBQ Meat Calculator — servings-first math (slices, ribs,
// links) with smoker capacity factored in so the result actually tells
// you how many batches you're running and what your real clock time is.
//
// No Firebase, no auth — just inputs → outputs. Custom smokers persist
// in localStorage so you don't have to redefine your pit each visit.

const ACCENT = '#4A6741';
const ACCENT_LIGHT = '#7a9670';
const GOLD = '#d4a64a';
const RED = '#f87171';
const BG = '#1a1a1a';
const CARD = '#2a2015';
const BORDER = '#3a2f22';
const TEXT = '#f5e6d3';
const MUTED = '#999';

const SMOKER_CATEGORIES = ['Charcoal', 'Pellet', 'Offset', 'Drum', 'Electric', 'Competition'];

// Lightweight GA4 event helper. The gtag script is loaded by index.calculator.html
// so window.gtag exists by the time React mounts. No-op if blocked / not loaded.
const track = (event, params) => {
  try { window.gtag?.('event', event, { app: 'calculator', ...params }); } catch {}
};

// Buffer to get the pit up to cook temp before the meat goes on.
// 45 min covers most styles — pellet hoppers spin up fast (15 min)
// but charcoal/offset need a chimney lit and the firebox seasoned.
const STOKE_MINUTES = 45;

function nextSaturdayAt5PM() {
  const d = new Date();
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const daysAhead = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysAhead);
  d.setHours(17, 0, 0, 0);
  return d;
}

function toLocalISOString(d) {
  // datetime-local needs YYYY-MM-DDTHH:MM in LOCAL time, not UTC
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduleTime(d) {
  // "Fri 3:45 AM" — friendly, compact
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[d.getDay()];
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${day} ${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function buildCookPlan(serveDate, result) {
  // Walk backwards from serve time:
  //   serve  ← rest complete
  //   rest   ← off smoker = serve - restMinutes
  //   smoker ← meat-on  = off - totalCookHours
  //   stoke  ← stoke    = meat-on - STOKE_MINUTES
  const serveMs = serveDate.getTime();
  const restMs = result.guide.restMinutes * 60_000;
  const cookMs = result.totalCookHours * 3_600_000;
  const stokeMs = STOKE_MINUTES * 60_000;

  const offSmoker = new Date(serveMs - restMs);
  const meatOn = new Date(offSmoker.getTime() - cookMs);
  const stoke = new Date(meatOn.getTime() - stokeMs);

  // Per-batch on-times (informational for multi-batch cooks)
  const perBatchMs = result.perCutCookHours * 3_600_000;
  const batchOnTimes = [];
  for (let i = 0; i < result.batches; i++) {
    batchOnTimes.push(new Date(meatOn.getTime() + i * perBatchMs));
  }

  return { stoke, meatOn, offSmoker, serve: serveDate, batchOnTimes };
}

export default function CalculatorApp() {
  const [guests, setGuests] = useState(50);
  const [meatTypes, setMeatTypes] = useState(['Brisket']);
  const [appetite, setAppetite] = useState('normal');
  const [sidesIncluded, setSidesIncluded] = useState(true);
  const [servingOverrides, setServingOverrides] = useState({});
  const [smokerName, setSmokerName] = useState(''); // '' = no smoker selected
  // Two-step smoker picker: user selects a style first (Charcoal,
  // Pellet, Offset, etc.) which narrows the dropdown to that segment.
  // Empty string means "no style chosen" which gates the dropdown.
  const [smokerStyle, setSmokerStyle] = useState('');
  const [customSmokers, setCustomSmokers] = useState([]);
  const [editingCustom, setEditingCustom] = useState(null); // null or capacity object during edit
  // Cook schedule — serve time as local ISO string for the datetime-local
  // input. Defaults to next Saturday 5 PM so the user sees a sensible plan
  // immediately; they edit it for their actual event.
  const [serveTimeISO, setServeTimeISO] = useState(() => toLocalISOString(nextSaturdayAt5PM()));
  const [showSchedule, setShowSchedule] = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [showWood, setShowWood] = useState(false);
  // 'cook' = filtered to user's selected meats. 'matrix' = full cheat sheet.
  const [woodMode, setWoodMode] = useState('cook');
  const [copyStatus, setCopyStatus] = useState(''); // '' | 'copied' | 'failed'

  // Load custom smokers on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SMOKERS_KEY);
      if (raw) setCustomSmokers(JSON.parse(raw));
    } catch { /* ignore */ }
    track('calc_loaded');
  }, []);

  // Hydrate cook-plan state from URL query params on mount. Lets users
  // text a link to a co-cook ("here's our plan for Saturday") without
  // needing accounts or a backend. Each known param has a guard so a
  // malformed link can't break the page — unknown values fall back.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('g')) {
      const v = parseInt(params.get('g'), 10);
      if (!isNaN(v) && v >= 1 && v <= 500) setGuests(v);
    }
    if (params.has('m')) {
      const allMeats = Object.keys(MEAT_GUIDE);
      const picked = params.get('m').split(',').filter(m => allMeats.includes(m));
      if (picked.length > 0) setMeatTypes(picked);
    }
    if (params.has('a')) {
      const a = params.get('a');
      if (['light', 'normal', 'hearty'].includes(a)) setAppetite(a);
    }
    if (params.has('s')) setSidesIncluded(params.get('s') === '1');
    if (params.has('p')) {
      // Smoker — set style first so the dropdown filters, then name
      const pitName = params.get('p');
      const all = [...SMOKERS]; // customSmokers haven't loaded yet but covered below
      const found = all.find(x => x.name === pitName);
      if (found) {
        setSmokerStyle(found.category);
        setSmokerName(pitName);
      }
    }
    if (params.has('t')) {
      const t = params.get('t');
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) setServeTimeISO(t);
    }
  }, []);

  // Mirror state back into the URL so the address bar / share button
  // always reflects the current plan. Use replaceState — no history
  // spam as the user clicks pills and steppers.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('g', String(guests || 1));
    if (meatTypes.length) params.set('m', meatTypes.join(','));
    if (appetite !== 'normal') params.set('a', appetite);
    if (!sidesIncluded) params.set('s', '0');
    if (smokerName) params.set('p', smokerName);
    if (serveTimeISO) params.set('t', serveTimeISO);
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', url);
  }, [guests, meatTypes, appetite, sidesIncluded, smokerName, serveTimeISO]);

  const allSmokers = useMemo(() => [...SMOKERS, ...customSmokers], [customSmokers]);
  const smoker = allSmokers.find(s => s.name === smokerName) || null;

  const toggleMeat = (m) => {
    setMeatTypes(prev => {
      const adding = !prev.includes(m);
      track(adding ? 'calc_meat_add' : 'calc_meat_remove', { meat: m });
      return adding ? [...prev, m] : prev.filter(x => x !== m);
    });
  };

  const changeAppetite = (a) => {
    setAppetite(a);
    setServingOverrides({});
    track('calc_appetite_change', { appetite: a });
  };

  const setServingFor = useCallback((meat, n) => {
    setServingOverrides(prev => ({ ...prev, [meat]: n }));
  }, []);

  const resetServing = useCallback((meat) => {
    setServingOverrides(prev => { const next = { ...prev }; delete next[meat]; return next; });
  }, []);

  const persistCustomSmokers = (next) => {
    setCustomSmokers(next);
    try { localStorage.setItem(CUSTOM_SMOKERS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const startEditingCustom = (existing) => {
    if (existing) {
      setEditingCustom({ name: existing.name, capacity: { ...existing.capacity }, isNew: false, originalName: existing.name });
    } else {
      const blank = Object.fromEntries(Object.keys(MEAT_GUIDE).map(m => [m, 0]));
      setEditingCustom({ name: '', capacity: blank, isNew: true });
    }
  };

  const saveCustomSmoker = () => {
    if (!editingCustom?.name?.trim()) return;
    const newCustom = {
      name: editingCustom.name.trim(),
      category: 'Custom',
      capacity: editingCustom.capacity,
    };
    let next;
    if (editingCustom.isNew) {
      next = [...customSmokers, newCustom];
    } else {
      next = customSmokers.map(s => s.name === editingCustom.originalName ? newCustom : s);
    }
    persistCustomSmokers(next);
    setSmokerName(newCustom.name);
    setEditingCustom(null);
    track('calc_custom_smoker_saved', { is_new: editingCustom.isNew });
  };

  const deleteCustomSmoker = (name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    persistCustomSmokers(customSmokers.filter(s => s.name !== name));
    if (smokerName === name) setSmokerName('');
  };

  const results = useMemo(
    () => calculate(guests, meatTypes, appetite, sidesIncluded, servingOverrides, smoker),
    [guests, meatTypes, appetite, sidesIncluded, servingOverrides, smoker],
  );
  // Fire once per session when the first meaningful result lands — this
  // is the calculator's "conversion event," indicating the user got past
  // the input stage and saw output. We don't want one per recompute.
  useEffect(() => {
    if (results.length > 0) {
      track('calc_results_viewed', {
        meats: results.length,
        guests: guests || 0,
        has_smoker: !!smoker,
      });
    }
    // Intentionally only fires when results FIRST become non-empty by
    // including results.length transition. React's effect-equality on a
    // primitive guards re-fires.
  }, [results.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalRawLb = results.reduce((sum, r) => sum + r.rawLb, 0);
  // Longest batch chain — assumes you can cook all meats in parallel
  // when batches overlap. This is the worst single-meat total time.
  const longestChain = results.reduce((best, r) => r.totalCookHours > (best?.totalCookHours || 0) ? r : best, null);

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "'Inter', sans-serif" }}>
      <header className="no-print" style={{ background: '#1a1610', borderBottom: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div className="bbq-container-wide" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 0 }}>
          <a href="/" onClick={() => track('cross_app_nav', { from: 'calculator', to: 'site' })}
            style={{ color: MUTED, textDecoration: 'none', fontSize: 14 }}>← Back</a>
          <div style={{ height: 20, width: 1, background: BORDER }} />
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1, color: GOLD }}>
              BBQ CALCULATOR
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: -2 }}>
              Plan your cook from guest count to fire time
            </div>
          </div>
        </div>
      </header>
      <div className="bbq-container-wide" style={{ padding: '24px 16px 64px' }}>

        <div className="print-only" style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #000' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 900, letterSpacing: '2px' }}>
            HOLY SMOKES BBQ — COOK PLAN
          </div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            {(guests || 1)} guests · {meatTypes.join(', ') || '—'}{smoker ? ` · ${smoker.name}` : ''}
          </div>
        </div>

        <div className="no-print" style={{ textAlign: 'center', margin: '24px 0' }}>
          <img src="/calculator/bbq-calculator-logo.png" alt="BBQ Calculator"
            width="120" height="120"
            style={{ width: '120px', height: '120px', borderRadius: '50%', marginBottom: '12px' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '28px', fontWeight: '700', letterSpacing: '3px', color: GOLD, margin: 0 }}>
            BBQ CALCULATOR
          </h1>
          <div style={{ fontSize: '12px', color: MUTED, letterSpacing: '2px', marginTop: '4px' }}>
            BY HOLY SMOKES BBQ CO
          </div>
        </div>

        <p className="no-print" style={{ textAlign: 'center', fontSize: '14px', color: MUTED, marginBottom: '24px', lineHeight: 1.6 }}>
          Plan by the slice, the rib, the link. Tell us your smoker and
          we&rsquo;ll factor in batches and total clock time.
        </p>

        {/* Inputs */}
        <div className="no-print" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <Field label="GUESTS">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setGuests(g => Math.max(1, (parseInt(g, 10) || 1) - 1))} style={stepBtn()}>−</button>
              <input
                type="number" inputMode="numeric" min="1" max="500"
                value={guests}
                onChange={e => {
                  if (e.target.value === '') return setGuests('');
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 500) setGuests(v);
                }}
                onBlur={() => { if (!guests || guests < 1) setGuests(1); }}
                aria-label="Number of guests"
                style={{
                  fontFamily: "'Oswald', sans-serif", fontSize: '36px',
                  fontWeight: '900', color: ACCENT_LIGHT,
                  width: '100px', height: '60px', textAlign: 'center',
                  background: '#111', border: `1px solid ${BORDER}`,
                  borderRadius: '10px', outline: 'none',
                  MozAppearance: 'textfield',
                }}
              />
              <button onClick={() => setGuests(g => Math.min(500, (parseInt(g, 10) || 0) + 1))} style={stepBtn()}>+</button>
            </div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
              {/* Backyard sizes first — matches the search-intent presets
                  (/calculator/?g=N landing routes) — then catering scale. */}
              {[10, 20, 30, 50, 100, 150, 200].map(n => (
                <button key={n} onClick={() => { setGuests(n); track('calc_guests_quick_pick', { guests: n }); }} style={quickBtn(guests === n)}>{n}</button>
              ))}
            </div>
          </Field>

          <Field label="SMOKER STYLE">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SMOKER_CATEGORIES.map(cat => {
                const count = SMOKERS.filter(s => s.category === cat).length;
                if (count === 0) return null;
                const active = smokerStyle === cat;
                return (
                  <button key={cat} onClick={() => {
                    if (smokerStyle === cat) {
                      // toggle off — clears smoker selection too
                      setSmokerStyle('');
                      setSmokerName('');
                    } else {
                      setSmokerStyle(cat);
                      setSmokerName(''); // reset model when style changes
                      track('calc_smoker_style', { style: cat });
                    }
                  }} style={stylePill(active)}>{cat}</button>
                );
              })}
              {customSmokers.length > 0 && (
                <button onClick={() => {
                  if (smokerStyle === 'Custom') { setSmokerStyle(''); setSmokerName(''); }
                  else { setSmokerStyle('Custom'); setSmokerName(''); }
                }} style={stylePill(smokerStyle === 'Custom')}>My Smokers</button>
              )}
            </div>
            {!smokerStyle && (
              <div style={{ fontSize: '11px', color: MUTED, marginTop: '8px', textAlign: 'center' }}>
                Pick a style to see compatible smokers and batch math. Skip to show per-cut times only.
              </div>
            )}
          </Field>

          {smokerStyle && (
            <Field label="SMOKER MODEL">
              <select
                value={smokerName}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__new__') { startEditingCustom(null); return; }
                  setSmokerName(v);
                  if (v) track('calc_smoker_model', { model: v, style: smokerStyle });
                }}
                style={{
                  width: '100%', padding: '12px',
                  background: '#111', color: TEXT, border: `1px solid ${BORDER}`,
                  borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
                }}>
                <option value="">Choose your smoker…</option>
                {smokerStyle === 'Custom' ? (
                  <>
                    {customSmokers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    <option value="__new__">+ Add another custom smoker…</option>
                  </>
                ) : (
                  <>
                    {SMOKERS.filter(s => s.category === smokerStyle).map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                    <option value="__new__">+ Add a custom smoker…</option>
                  </>
                )}
              </select>

              {smoker && smoker.category === 'Custom' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'center' }}>
                  <button onClick={() => startEditingCustom(smoker)} style={subBtn()}>Edit</button>
                  <button onClick={() => deleteCustomSmoker(smoker.name)} style={{ ...subBtn(), color: RED, borderColor: RED }}>Delete</button>
                </div>
              )}
            </Field>
          )}

          {/* Custom smoker editor — inline panel */}
          {editingCustom && (
            <div style={{
              background: '#111', border: `1px dashed ${GOLD}`,
              borderRadius: '10px', padding: '14px', marginBottom: '14px',
            }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '12px', letterSpacing: '2px', color: GOLD, marginBottom: '8px' }}>
                {editingCustom.isNew ? 'NEW CUSTOM SMOKER' : 'EDIT CUSTOM SMOKER'}
              </div>
              <input
                type="text" value={editingCustom.name}
                onChange={e => setEditingCustom({ ...editingCustom, name: e.target.value })}
                placeholder="My Pit"
                aria-label="Smoker name"
                style={{
                  width: '100%', padding: '10px',
                  background: '#000', color: TEXT, border: `1px solid ${BORDER}`,
                  borderRadius: '6px', fontSize: '14px', marginBottom: '10px',
                }}
              />
              <div style={{ fontSize: '11px', color: MUTED, marginBottom: '8px' }}>
                How many of each cut fit on the grates at once?
              </div>
              {Object.keys(MEAT_GUIDE).map(meat => {
                const cn = CUT_NAMES[meat];
                const cap = editingCustom.capacity[meat] || 0;
                return (
                  <div key={meat} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: TEXT }}>{meat}</div>
                      <div style={{ fontSize: '10px', color: MUTED }}>
                        {cap === 1 ? cn.singular : cn.plural}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => setEditingCustom({ ...editingCustom, capacity: { ...editingCustom.capacity, [meat]: Math.max(0, cap - 1) } })} style={tinyStepBtn()}>−</button>
                      <span style={{
                        minWidth: '32px', textAlign: 'center',
                        fontFamily: "'Oswald', sans-serif", fontSize: '18px',
                        fontWeight: '700', color: cap > 0 ? ACCENT_LIGHT : MUTED,
                      }}>{cap}</span>
                      <button onClick={() => setEditingCustom({ ...editingCustom, capacity: { ...editingCustom.capacity, [meat]: cap + 1 } })} style={tinyStepBtn()}>+</button>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => setEditingCustom(null)} style={{ ...subBtn(), flex: 1 }}>Cancel</button>
                <button
                  onClick={saveCustomSmoker}
                  disabled={!editingCustom.name.trim()}
                  style={{
                    ...subBtn(), flex: 1,
                    background: editingCustom.name.trim() ? GOLD : BORDER,
                    color: editingCustom.name.trim() ? '#1a1a1a' : MUTED,
                    borderColor: editingCustom.name.trim() ? GOLD : BORDER,
                  }}>
                  Save
                </button>
              </div>
            </div>
          )}

          <Field label="APPETITE">
            <div style={{ display: 'flex', gap: '6px' }}>
              {Object.entries(APPETITE_LEVELS).map(([key, { label }]) => (
                <button key={key} onClick={() => changeAppetite(key)} style={pillBtn(appetite === key)}>{label}</button>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: MUTED, marginTop: '6px', textAlign: 'center' }}>
              Sets the default servings per person — adjust any meat below.
            </div>
          </Field>

          <Field label="SIDES INCLUDED?">
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { setSidesIncluded(true);  track('calc_sides_toggle', { sides: true }); }}  style={pillBtn(sidesIncluded)}>Yes</button>
              <button onClick={() => { setSidesIncluded(false); track('calc_sides_toggle', { sides: false }); }} style={pillBtn(!sidesIncluded)}>No (bump meat 15%)</button>
            </div>
          </Field>

          <Field label={`MEAT${meatTypes.length > 1 ? `S (${meatTypes.length})` : ''}`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.keys(MEAT_GUIDE).map(m => (
                <button key={m} onClick={() => toggleMeat(m)} style={meatPill(meatTypes.includes(m))}>{m}</button>
              ))}
            </div>
          </Field>

        </div>

        {/* Results */}
        {meatTypes.length === 0 ? (
          <EmptyMeatPrompt />
        ) : (
          <>
            {results.length > 0 && (
              <div className="no-print" style={{
                background: CARD, border: `2px solid ${GOLD}`,
                borderRadius: '14px', padding: '16px', marginBottom: '12px',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
              }}>
                <SummaryStat label="TOTAL BUY" value={`${totalRawLb.toFixed(1)} lb`} note={`across ${results.length} meat${results.length !== 1 ? 's' : ''}`} color={ACCENT_LIGHT} />
                <SummaryStat
                  label={smoker ? 'LONGEST CHAIN' : 'LONGEST COOK'}
                  value={longestChain?.totalCookHoursLabel || '—'}
                  note={longestChain ? (
                    longestChain.batches > 1
                      ? `${longestChain.meatType} (${longestChain.batches} batches)`
                      : `${longestChain.meatType} (per cut)`
                  ) : ''}
                  color={GOLD} />
              </div>
            )}

            {smoker && results.length > 0 && (
              <CookSchedulePanel
                serveTimeISO={serveTimeISO}
                onChange={(v) => { setServeTimeISO(v); track('calc_serve_time_set'); }}
                expanded={showSchedule}
                onToggle={() => setShowSchedule(v => { if (!v) track('calc_schedule_open'); return !v; })}
                results={results}
              />
            )}

            {results.length > 0 && (
              <ShoppingListPanel
                results={results}
                totalCookHours={longestChain?.totalCookHours || 0}
                smoker={smoker}
                sidesIncluded={sidesIncluded}
                guests={guests || 1}
                expanded={showShopping}
                onToggle={() => setShowShopping(v => { if (!v) track('calc_shopping_open'); return !v; })}
                copyStatus={copyStatus}
                setCopyStatus={setCopyStatus}
              />
            )}

            {results.length > 0 && (
              <WoodGuidePanel
                meats={meatTypes}
                expanded={showWood}
                mode={woodMode}
                onToggle={() => setShowWood(v => { if (!v) track('calc_wood_guide_open'); return !v; })}
                onModeChange={(m) => { setWoodMode(m); track('calc_wood_mode', { mode: m }); }}
              />
            )}

            <div className="no-print">
            {results.map((r) => (
              <MeatResultCard
                key={r.meatType}
                result={r}
                solo={results.length === 1}
                hasSmoker={!!smoker}
                isOverridden={servingOverrides[r.meatType] !== undefined}
                onSetServing={(n) => setServingFor(r.meatType, n)}
                onReset={() => resetServing(r.meatType)}
              />
            ))}
            </div>
          </>
        )}

        {/* Cross-link */}
        <div className="no-print" style={{ background: CARD, border: `1px solid ${ACCENT}`, borderRadius: '12px', padding: '18px', textAlign: 'center', marginTop: '8px', marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: ACCENT_LIGHT, marginBottom: '6px' }}>
            WANT TO LOG THE COOK?
          </div>
          <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6, marginBottom: '14px' }}>
            BBQ Notebook is the cook log this calculator was built into &mdash;
            track rubs, wood, temps, weather, outcomes, and share cooks with
            friends.
          </div>
          <a href="/notebook/" onClick={() => track('cross_app_nav', { from: 'calculator', to: 'notebook' })} style={{
            display: 'inline-block', background: ACCENT, color: '#fff',
            padding: '12px 28px', borderRadius: '8px',
            fontFamily: "'Oswald', sans-serif", fontSize: '14px',
            fontWeight: '700', letterSpacing: '1px', textDecoration: 'none',
          }}>Launch BBQ Notebook</a>
        </div>

        <div className="no-print" style={{ textAlign: 'center', paddingTop: '24px', borderTop: `1px solid ${BORDER}`, fontSize: '11px', color: MUTED, letterSpacing: '1px' }}>
          <div style={{ marginBottom: '6px' }}>
            <a href="/" onClick={() => track('cross_app_nav', { from: 'calculator', to: 'site' })} style={{ color: MUTED, textDecoration: 'none', margin: '0 8px' }}>Home</a>
            <span style={{ color: BORDER }}>•</span>
            <a href="/notebook/" onClick={() => track('cross_app_nav', { from: 'calculator', to: 'notebook' })} style={{ color: MUTED, textDecoration: 'none', margin: '0 8px' }}>BBQ Notebook</a>
            <span style={{ color: BORDER }}>•</span>
            <a href="/scorecard/" onClick={() => track('cross_app_nav', { from: 'calculator', to: 'scorecard' })} style={{ color: MUTED, textDecoration: 'none', margin: '0 8px' }}>BBQ Scorecard</a>
          </div>
          <div>By Holy Smokes BBQ Co</div>
        </div>
      </div>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: '11px',
        letterSpacing: '1.5px', color: MUTED, marginBottom: '6px',
      }}>{label}</div>
      {children}
    </div>
  );
}

function SummaryStat({ label, value, note, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '10px', letterSpacing: '2px', color: MUTED, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '32px', fontWeight: '900', color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>{note}</div>
    </div>
  );
}

// Per-hour fuel consumption by smoker style. These are starting points
// pulled from manufacturer specs (pellet hoppers), KCBS team blogs
// (offsets), and chimney-count posts on Smoking Meat Forums. The point
// is to give a shopping number, not a precise burn rate.
const FUEL_RATES = {
  Pellet:      { primary: { unit: 'lb pellets',     perHour: 1.0 }, secondary: null },
  Offset:      { primary: { unit: 'wood splits',    perHour: 1.5 }, secondary: { unit: 'lb charcoal (light fire)', flat: 8 } },
  Charcoal:    { primary: { unit: 'lb lump charcoal', perHour: 1.0 }, secondary: { unit: 'wood chunks',     perHour: 1.5 } },
  Drum:        { primary: { unit: 'lb lump charcoal', perHour: 0.8 }, secondary: { unit: 'wood chunks',     perHour: 1.0 } },
  Electric:    { primary: { unit: 'cups wood chips', perHour: 1.0 }, secondary: null },
  Competition: { primary: { unit: 'wood splits',    perHour: 1.5 }, secondary: { unit: 'lb charcoal (light fire)', flat: 10 } },
};

// Sides estimates — based on KCBS-team plating + standard catering math.
// Beans/slaw at ~1 cup uncooked-equivalent per person; sauce at ~2 oz.
const SIDE_RATES = {
  beans:  { label: 'baked beans',  perPerson: 0.5, unit: 'cup cooked' }, // ~1/2 cup
  slaw:   { label: 'coleslaw',     perPerson: 0.5, unit: 'cup' },
  sauce:  { label: 'BBQ sauce',    perPerson: 2,   unit: 'oz' },
  bread:  { label: 'rolls/buns',   perPerson: 1.5, unit: '' },
};

function buildShoppingList({ results, totalCookHours, smoker, sidesIncluded, guests }) {
  const lines = [];

  // ── Meats ──
  lines.push({ heading: 'MEAT (raw weight)' });
  results.forEach(r => {
    const name = CUT_NAMES[r.meatType];
    const cutDesc = r.cutsNeeded === 1
      ? `1 ${name.singular} ~${r.perCutLb.toFixed(1)} lb`
      : `${r.cutsNeeded} ${name.plural} ~${r.perCutLb.toFixed(1)} lb each`;
    lines.push({ item: `${r.meatType}`, qty: `${r.rawLb.toFixed(1)} lb`, sub: cutDesc });
  });

  // ── Rub ──
  // ~1 tbsp per lb raw meat → 16 tbsp = 1 cup → 1 cup per 16 lb
  const totalRawLb = results.reduce((sum, r) => sum + r.rawLb, 0);
  const rubTbsp = Math.ceil(totalRawLb);
  const rubCups = (rubTbsp / 16);
  lines.push({ heading: 'SEASONING' });
  lines.push({
    item: 'Dry rub',
    qty: `~${rubCups.toFixed(1)} cups`,
    sub: `~1 tbsp per lb raw (${rubTbsp} tbsp total)`,
  });

  // ── Brine (poultry / pork only) ──
  const brineableLb = results
    .filter(r => /chicken|turkey|pork/i.test(r.meatType))
    .reduce((sum, r) => sum + r.rawLb, 0);
  if (brineableLb > 0) {
    const brineGal = Math.ceil(brineableLb / 5);
    const saltCups = brineGal * 0.5;
    lines.push({
      item: 'Brine (poultry/pork)',
      qty: `~${brineGal} gal`,
      sub: `~½ cup kosher salt per gal (${saltCups.toFixed(1)} cups total)`,
    });
  }

  // ── Fuel / wood ──
  if (smoker && FUEL_RATES[smoker.category]) {
    const rates = FUEL_RATES[smoker.category];
    lines.push({ heading: 'FUEL & SMOKE' });
    const primaryQty = Math.ceil(rates.primary.perHour * totalCookHours);
    lines.push({
      item: rates.primary.unit,
      qty: `~${primaryQty}`,
      sub: `${rates.primary.perHour}/hr × ${totalCookHours.toFixed(1)} hr`,
    });
    if (rates.secondary) {
      const sec = rates.secondary;
      const qty = sec.flat != null ? sec.flat : Math.ceil(sec.perHour * totalCookHours);
      lines.push({
        item: sec.unit,
        qty: `~${qty}`,
        sub: sec.flat != null ? 'one-time' : `${sec.perHour}/hr × ${totalCookHours.toFixed(1)} hr`,
      });
    }
  }

  // ── Wrap supplies (proportional to brisket/pork shoulder count) ──
  const wrapCuts = results
    .filter(r => /brisket|pork shoulder|pulled pork/i.test(r.meatType))
    .reduce((sum, r) => sum + r.cutsNeeded, 0);
  if (wrapCuts > 0) {
    lines.push({ heading: 'WRAP & PREP' });
    lines.push({
      item: 'Butcher paper',
      qty: `~${Math.ceil(wrapCuts * 6)} ft`,
      sub: '~6 ft per wrap',
    });
    lines.push({
      item: 'Heavy-duty foil',
      qty: `~${Math.ceil(wrapCuts / 4)} roll(s)`,
      sub: '~4 wraps per roll',
    });
  }

  // ── Sides (if user opted in for "sides included" plating math) ──
  if (sidesIncluded) {
    lines.push({ heading: 'SIDES' });
    Object.values(SIDE_RATES).forEach(side => {
      const qty = side.perPerson * guests;
      const display = side.unit
        ? `${qty.toFixed(qty < 10 ? 1 : 0)} ${side.unit}${qty >= 2 && side.unit !== '' && !side.unit.endsWith('s') ? 's' : ''}`
        : `${Math.ceil(qty)}`;
      lines.push({
        item: side.label,
        qty: display,
        sub: `${side.perPerson} ${side.unit || 'each'} per person × ${guests}`,
      });
    });
  }

  return lines;
}

function shoppingListToText(lines) {
  const out = ['HOLY SMOKES BBQ — SHOPPING LIST', ''];
  lines.forEach(line => {
    if (line.heading) {
      out.push('');
      out.push(`── ${line.heading} ──`);
    } else {
      out.push(`  ${line.item.padEnd(28)} ${line.qty}`);
      if (line.sub) out.push(`    ${line.sub}`);
    }
  });
  return out.join('\n');
}

const SHOPPING_OVERRIDES_KEY = 'bbq-calc-shopping-overrides-v1';

// Given a generated list, return the same list with persisted overrides
// applied: per-row qty/item edits, deletions, and appended custom items.
function applyOverrides(baseLines, overrides) {
  const out = [];
  baseLines.forEach((line, i) => {
    if (line.heading) { out.push({ ...line, _key: `h:${line.heading}` }); return; }
    const key = `r:${line.heading || ''}:${line.item}`;
    const ov = overrides.byKey?.[key];
    if (ov?.deleted) return;
    out.push({
      ...line,
      _key: key,
      item: ov?.item ?? line.item,
      qty: ov?.qty ?? line.qty,
      sub: ov?.sub ?? line.sub,
    });
  });
  // Append custom rows under a custom heading if any
  if (overrides.custom?.length) {
    out.push({ heading: 'CUSTOM', _key: 'h:CUSTOM' });
    overrides.custom.forEach(c => {
      out.push({ _key: `c:${c.id}`, _custom: true, _id: c.id, item: c.item, qty: c.qty, sub: c.sub });
    });
  }
  return out;
}

function ShoppingListPanel({ results, totalCookHours, smoker, sidesIncluded, guests, expanded, onToggle, copyStatus, setCopyStatus }) {
  const baseLines = buildShoppingList({ results, totalCookHours, smoker, sidesIncluded, guests });

  const [overrides, setOverrides] = useState(() => {
    try {
      const raw = localStorage.getItem(SHOPPING_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : { byKey: {}, custom: [] };
    } catch { return { byKey: {}, custom: [] }; }
  });

  const persist = useCallback((next) => {
    setOverrides(next);
    try { localStorage.setItem(SHOPPING_OVERRIDES_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const lines = applyOverrides(baseLines, overrides);

  const setRow = (key, patch) => {
    persist({ ...overrides, byKey: { ...overrides.byKey, [key]: { ...overrides.byKey[key], ...patch } } });
  };
  const deleteRow = (key, isCustom, id) => {
    if (isCustom) {
      persist({ ...overrides, custom: overrides.custom.filter(c => c.id !== id) });
    } else {
      setRow(key, { deleted: true });
    }
  };
  const addCustom = () => {
    const id = `c_${Date.now().toString(36)}`;
    persist({ ...overrides, custom: [...(overrides.custom || []), { id, item: 'New item', qty: '1', sub: '' }] });
  };
  const resetAll = () => {
    if (!window.confirm('Wipe all customizations and rebuild from current inputs?')) return;
    persist({ byKey: {}, custom: [] });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shoppingListToText(lines));
      setCopyStatus('copied');
      track('calc_shopping_copy');
      setTimeout(() => setCopyStatus(''), 1500);
    } catch {
      setCopyStatus('failed');
      setTimeout(() => setCopyStatus(''), 1500);
    }
  };

  return (
    <div className="printable" style={{
      background: CARD, border: `2px solid ${ACCENT}`,
      borderRadius: '14px', padding: '16px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: GOLD, fontWeight: 700 }}>
            SHOPPING LIST
          </div>
          <div style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>
            Meat, rub, fuel, wrap, and sides
          </div>
        </div>
        <button onClick={onToggle} style={{
          background: expanded ? GOLD : 'transparent',
          color: expanded ? '#1a1a1a' : GOLD,
          border: `1px solid ${GOLD}`, borderRadius: '8px',
          padding: '8px 14px', fontFamily: "'Oswald', sans-serif",
          fontSize: '11px', letterSpacing: '1.5px', fontWeight: 700,
          cursor: 'pointer',
        }}>
          {expanded ? 'HIDE' : 'BUILD LIST'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <button onClick={copy} style={{
              background: ACCENT, color: '#fff', border: 'none',
              borderRadius: '8px', padding: '8px 14px',
              fontFamily: "'Oswald', sans-serif", fontSize: '11px',
              letterSpacing: '1.5px', fontWeight: 700, cursor: 'pointer',
            }}>
              {copyStatus === 'copied' ? '✓ COPIED' : copyStatus === 'failed' ? 'COPY FAILED' : 'COPY TO CLIPBOARD'}
            </button>
            <button onClick={() => { track('calc_shopping_print'); window.print(); }} style={{
              background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`,
              borderRadius: '8px', padding: '8px 14px',
              fontFamily: "'Oswald', sans-serif", fontSize: '11px',
              letterSpacing: '1.5px', fontWeight: 700, cursor: 'pointer',
            }}>
              PRINT
            </button>
            <button onClick={addCustom} className="no-print" style={{
              background: 'transparent', color: ACCENT_LIGHT, border: `1px dashed ${ACCENT}`,
              borderRadius: '8px', padding: '8px 14px',
              fontFamily: "'Oswald', sans-serif", fontSize: '11px',
              letterSpacing: '1.5px', fontWeight: 700, cursor: 'pointer',
            }}>
              + ADD ITEM
            </button>
            <button onClick={resetAll} className="no-print" style={{
              background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`,
              borderRadius: '8px', padding: '8px 14px',
              fontFamily: "'Oswald', sans-serif", fontSize: '11px',
              letterSpacing: '1.5px', fontWeight: 700, cursor: 'pointer',
            }}>
              RESET
            </button>
          </div>

          <div style={{
            background: '#111', border: `1px solid ${BORDER}`,
            borderRadius: '10px', padding: '12px',
          }}>
            {lines.map((line, i) => {
              if (line.heading) {
                return (
                  <div key={line._key} style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: '11px',
                    letterSpacing: '2px', color: GOLD, fontWeight: 700,
                    marginTop: i === 0 ? 0 : '14px', marginBottom: '6px',
                    borderBottom: `1px solid ${BORDER}`, paddingBottom: '4px',
                  }}>{line.heading}</div>
                );
              }
              return (
                <ShoppingListRow
                  key={line._key}
                  line={line}
                  onItemChange={(v) => line._custom
                    ? persist({ ...overrides, custom: overrides.custom.map(c => c.id === line._id ? { ...c, item: v } : c) })
                    : setRow(line._key, { item: v })}
                  onQtyChange={(v) => line._custom
                    ? persist({ ...overrides, custom: overrides.custom.map(c => c.id === line._id ? { ...c, qty: v } : c) })
                    : setRow(line._key, { qty: v })}
                  onDelete={() => deleteRow(line._key, line._custom, line._id)}
                />
              );
            })}
          </div>

          <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginTop: '10px', fontStyle: 'italic' }}>
            Tap any item or quantity to edit. Add custom rows for what you specifically want. Reset wipes your edits and rebuilds from current inputs.
          </div>
        </div>
      )}
    </div>
  );
}

// Editable shopping list row. Item name and qty become text inputs when
// the row is in edit mode (toggled by tapping the row). Delete via the
// small × button shown only when editing.
function ShoppingListRow({ line, onItemChange, onQtyChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="no-print" style={{ padding: '8px 0', borderBottom: `1px dashed ${BORDER}` }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            value={line.item || ''}
            onChange={e => onItemChange(e.target.value)}
            style={{
              flex: 2, background: '#000', color: TEXT, border: `1px solid ${BORDER}`,
              borderRadius: '6px', padding: '6px 8px', fontSize: '13px',
            }}
          />
          <input
            value={line.qty || ''}
            onChange={e => onQtyChange(e.target.value)}
            style={{
              flex: 1, background: '#000', color: ACCENT_LIGHT, border: `1px solid ${BORDER}`,
              borderRadius: '6px', padding: '6px 8px', fontSize: '13px',
              fontFamily: "'Oswald', sans-serif", fontWeight: 700, textAlign: 'right',
            }}
          />
          <button onClick={onDelete} style={{
            background: 'transparent', color: RED, border: `1px solid ${RED}`,
            borderRadius: '6px', padding: '6px 10px', fontSize: '14px',
            cursor: 'pointer', fontWeight: 700,
          }}>×</button>
          <button onClick={() => setEditing(false)} style={{
            background: ACCENT, color: '#fff', border: 'none',
            borderRadius: '6px', padding: '6px 12px', fontSize: '12px',
            cursor: 'pointer', fontWeight: 700,
          }}>OK</button>
        </div>
        {line.sub && (
          <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px', fontStyle: 'italic' }}>
            {line.sub}
          </div>
        )}
      </div>
    );
  }
  return (
    <div onClick={() => setEditing(true)} style={{
      padding: '6px 0', borderBottom: `1px dashed ${BORDER}`, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
        <span style={{ color: TEXT, fontSize: '13px' }}>{line.item}</span>
        <span style={{
          fontFamily: "'Oswald', sans-serif", fontWeight: 700,
          color: ACCENT_LIGHT, letterSpacing: '1px', fontSize: '13px',
          whiteSpace: 'nowrap',
        }}>{line.qty}</span>
      </div>
      {line.sub && (
        <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px', fontStyle: 'italic' }}>
          {line.sub}
        </div>
      )}
    </div>
  );
}

function ShareButton() {
  const [status, setStatus] = useState('');
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BBQ Cook Plan', url });
        setStatus('shared');
        track('calc_share', { method: 'native' });
      } else {
        await navigator.clipboard.writeText(url);
        setStatus('copied');
        track('calc_share', { method: 'clipboard' });
      }
      setTimeout(() => setStatus(''), 1500);
    } catch {
      setStatus('');
    }
  };
  return (
    <button onClick={share} style={{
      background: 'transparent', color: ACCENT_LIGHT,
      border: `1px solid ${ACCENT}`, borderRadius: '8px',
      padding: '8px 14px', fontFamily: "'Oswald', sans-serif",
      fontSize: '11px', letterSpacing: '1.5px', fontWeight: 700,
      cursor: 'pointer',
    }}>
      {status === 'copied' ? '✓ LINK COPIED' : status === 'shared' ? '✓ SHARED' : 'SHARE PLAN'}
    </button>
  );
}

function CookSchedulePanel({ serveTimeISO, onChange, expanded, onToggle, results }) {
  // Build plans only when expanded — datetime parsing is cheap but no
  // sense doing it for users who don't open the panel.
  const serveDate = serveTimeISO ? new Date(serveTimeISO) : null;
  const valid = serveDate && !isNaN(serveDate.getTime());
  const plans = expanded && valid
    ? results.map(r => ({ meat: r, plan: buildCookPlan(serveDate, r) }))
    : [];
  const earliestStoke = plans.length
    ? plans.reduce((earliest, { plan }) => plan.stoke < earliest ? plan.stoke : earliest, plans[0].plan.stoke)
    : null;

  return (
    <div className="printable" style={{
      background: CARD, border: `2px solid ${ACCENT}`,
      borderRadius: '14px', padding: '16px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: GOLD, fontWeight: 700 }}>
            COOK SCHEDULE
          </div>
          <div style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>
            Reverse timeline from your serve time
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ShareButton />
          <button onClick={onToggle} style={{
            background: expanded ? GOLD : 'transparent',
            color: expanded ? '#1a1a1a' : GOLD,
            border: `1px solid ${GOLD}`, borderRadius: '8px',
            padding: '8px 14px', fontFamily: "'Oswald', sans-serif",
            fontSize: '11px', letterSpacing: '1.5px', fontWeight: 700,
            cursor: 'pointer',
          }}>
            {expanded ? 'HIDE' : 'PLAN COOK'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <label style={{ fontFamily: "'Oswald', sans-serif", fontSize: '10px', letterSpacing: '2px', color: MUTED }}>
              SERVE TIME
            </label>
            <input
              type="datetime-local"
              value={serveTimeISO}
              onChange={(e) => onChange(e.target.value)}
              style={{
                background: '#111', color: TEXT, border: `1px solid ${BORDER}`,
                borderRadius: '8px', padding: '10px 12px',
                fontFamily: "'Inter', sans-serif", fontSize: '14px',
                colorScheme: 'dark',
              }}
            />
          </div>

          {!valid && (
            <div style={{ fontSize: '12px', color: RED }}>Pick a serve date and time.</div>
          )}

          {valid && earliestStoke && (
            <div style={{
              background: '#111', border: `1px solid ${BORDER}`,
              borderRadius: '10px', padding: '12px', marginBottom: '12px',
              fontSize: '13px', color: TEXT, lineHeight: 1.5,
            }}>
              <strong style={{ color: GOLD }}>Light your fire {formatScheduleTime(earliestStoke)}</strong>
              {' '}— that&rsquo;s when the earliest meat needs to start.
            </div>
          )}

          {plans.map(({ meat, plan }) => (
            <div key={meat.meatType} style={{
              background: '#111', border: `1px solid ${BORDER}`,
              borderRadius: '10px', padding: '12px', marginBottom: '10px',
            }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '1.5px', color: GOLD, fontWeight: 700, marginBottom: '8px' }}>
                {meat.meatType.toUpperCase()}
                <span style={{ color: MUTED, fontSize: '11px', fontWeight: 400, letterSpacing: '1px', marginLeft: '8px' }}>
                  {meat.totalCookHoursLabel} cook · {meat.guide.restMinutes}m rest
                </span>
              </div>
              <ScheduleRow label="Stoke smoker"    time={formatScheduleTime(plan.stoke)}     muted />
              <ScheduleRow label="Meat on"          time={formatScheduleTime(plan.meatOn)}    accent />
              {meat.batches > 1 && plan.batchOnTimes.slice(1).map((d, i) => (
                <ScheduleRow key={i} label={`Batch ${i + 2} on`} time={formatScheduleTime(d)} muted indent />
              ))}
              <ScheduleRow label="Off the smoker"   time={formatScheduleTime(plan.offSmoker)} muted />
              <ScheduleRow label={`Slice & serve`}  time={formatScheduleTime(plan.serve)}     accent />
            </div>
          ))}

          <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginTop: '8px', fontStyle: 'italic' }}>
            Assumes ~{STOKE_MINUTES} min to reach cook temp. Add a buffer for big briskets &mdash; pitmasters add 1&ndash;2 hours of slack so the meat&rsquo;s ready early, then hold in a faux Cambro.
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ label, time, accent, muted, indent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '4px 0', paddingLeft: indent ? '14px' : 0,
      borderBottom: `1px dashed ${BORDER}`,
      fontSize: '13px',
    }}>
      <span style={{ color: muted ? MUTED : TEXT }}>{label}</span>
      <span style={{
        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
        color: accent ? GOLD : (muted ? TEXT : ACCENT_LIGHT),
        letterSpacing: '1px',
      }}>{time}</span>
    </div>
  );
}

function WoodGuidePanel({ meats, expanded, mode, onToggle, onModeChange }) {
  // Build per-meat recommendations from the currently selected meats.
  // Empty when meats array is empty — outer guard already prevents that.
  const perMeat = meats.map(m => ({ meat: m, woods: getRecommendedWoods(m) }));
  const allMeats = Object.keys(MEAT_GUIDE);
  const allWoods = Object.keys(WOODS);

  // Suggest blends from BLENDS that overlap with the user’s meat selection.
  const suggestedBlends = BLENDS.filter(b =>
    b.forMeats.some(meat => meats.includes(meat))
  );

  return (
    <div className="printable" style={{
      background: CARD, border: `2px solid ${ACCENT}`,
      borderRadius: '14px', padding: '16px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: GOLD, fontWeight: 700 }}>
            WOOD GUIDE
          </div>
          <div style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>
            What to throw in the firebox
          </div>
        </div>
        <button onClick={onToggle} style={{
          background: expanded ? GOLD : 'transparent',
          color: expanded ? '#1a1a1a' : GOLD,
          border: `1px solid ${GOLD}`, borderRadius: '8px',
          padding: '8px 14px', fontFamily: "'Oswald', sans-serif",
          fontSize: '11px', letterSpacing: '1.5px', fontWeight: 700,
          cursor: 'pointer',
        }}>
          {expanded ? 'HIDE' : 'PICK WOOD'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '14px' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <button onClick={() => onModeChange('cook')} style={woodModeBtn(mode === 'cook')}>
              For Your Cook
            </button>
            <button onClick={() => onModeChange('matrix')} style={woodModeBtn(mode === 'matrix')}>
              Full Cheat Sheet
            </button>
          </div>

          {mode === 'cook' ? (
            <>
              {perMeat.map(({ meat, woods }) => (
                <div key={meat} style={{
                  background: '#111', border: `1px solid ${BORDER}`,
                  borderRadius: '10px', padding: '12px', marginBottom: '10px',
                }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '1.5px', color: GOLD, fontWeight: 700, marginBottom: '8px' }}>
                    {meat.toUpperCase()}
                  </div>
                  {woods.slice(0, 4).map((w, i) => (
                    <div key={w.name} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      padding: '6px 0',
                      borderBottom: i < 3 ? `1px dashed ${BORDER}` : 'none',
                    }}>
                      <div style={{ flex: 1, paddingRight: '10px' }}>
                        <div style={{ color: i === 0 ? GOLD : TEXT, fontSize: '13px', fontWeight: i === 0 ? 700 : 400 }}>
                          {i === 0 && '★ '}{w.name}
                          <span style={{ color: MUTED, fontSize: '11px', marginLeft: '8px' }}>
                            {intensityDots(w.intensity)}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: MUTED, fontStyle: 'italic', marginTop: '2px' }}>
                          {w.tagline}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {suggestedBlends.length > 0 && (
                <div style={{
                  background: 'rgba(212, 166, 74, 0.06)',
                  border: `1px solid ${GOLD}`, borderRadius: '10px',
                  padding: '12px', marginTop: '6px',
                }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '12px', letterSpacing: '1.5px', color: GOLD, fontWeight: 700, marginBottom: '8px' }}>
                    SUGGESTED BLENDS
                  </div>
                  {suggestedBlends.map(b => (
                    <div key={b.name} style={{ padding: '6px 0', borderBottom: `1px dashed ${BORDER}` }}>
                      <div style={{ color: TEXT, fontSize: '13px', fontWeight: 600 }}>
                        {b.name} <span style={{ color: ACCENT_LIGHT, fontWeight: 400 }}>· {b.mix.join(' + ')}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: MUTED, fontStyle: 'italic', marginTop: '2px' }}>
                        {b.note}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Full cheat sheet view — matrix of meats × woods, plus wood cards
            <>
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{
                  width: '100%', borderCollapse: 'collapse', fontSize: '11px',
                  background: '#111', borderRadius: '8px', overflow: 'hidden',
                }}>
                  <thead>
                    <tr>
                      <th style={woodCellHead()}>Meat ↓ / Wood →</th>
                      {allWoods.map(w => (
                        <th key={w} style={woodCellHead()}>{w}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allMeats.map(meat => (
                      <tr key={meat}>
                        <td style={woodCellMeat()}>{meat}</td>
                        {allWoods.map(w => {
                          const c = getCompat(w, meat);
                          return (
                            <td key={w} style={woodCellCompat(c)} title={`${w} on ${meat}: ${c}`}>
                              <span style={compatCircle(c)} aria-label={c} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: '11px', color: MUTED, marginBottom: '14px', textAlign: 'center', display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={compatCircle('best')} /> best
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={compatCircle('okay')} /> works
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={compatCircle('avoid')} /> avoid
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={compatCircle('neutral')} /> neutral
                </span>
              </div>

              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '12px', letterSpacing: '1.5px', color: GOLD, fontWeight: 700, marginBottom: '10px' }}>
                WOOD CARDS
              </div>
              {allWoods.map(name => {
                const w = WOODS[name];
                return (
                  <div key={name} style={{
                    background: '#111', border: `1px solid ${BORDER}`,
                    borderRadius: '10px', padding: '10px 12px', marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '1.5px', color: GOLD, fontWeight: 700 }}>
                        {name.toUpperCase()}
                        <span style={{ color: MUTED, fontSize: '11px', fontWeight: 400, letterSpacing: '1px', marginLeft: '10px' }}>
                          {intensityDots(w.intensity)}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: w.burnsHot ? '#f87171' : ACCENT_LIGHT }}>
                        {w.burnsHot ? 'burns hot' : 'burns cool'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: TEXT, marginTop: '6px' }}>{w.profile}</div>
                    <div style={{ fontSize: '11px', color: MUTED, fontStyle: 'italic', marginTop: '4px' }}>{w.tagline}</div>
                    {w.bestFor.length > 0 && (
                      <div style={{ fontSize: '11px', color: ACCENT_LIGHT, marginTop: '6px' }}>
                        <strong>Best:</strong> {w.bestFor.join(', ')}
                      </div>
                    )}
                    {w.avoidFor.length > 0 && (
                      <div style={{ fontSize: '11px', color: RED, marginTop: '2px' }}>
                        <strong>Avoid:</strong> {w.avoidFor.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginTop: '10px', fontStyle: 'italic' }}>
            Pairings are starting points, not gospel &mdash; tune to your pit and your palate.
          </div>
        </div>
      )}
    </div>
  );
}

function intensityDots(n) {
  return '●'.repeat(n) + '○'.repeat(5 - n);
}

function woodModeBtn(active) {
  return {
    flex: 1, padding: '8px 14px',
    background: active ? ACCENT : 'transparent',
    color: active ? '#fff' : TEXT,
    border: `1px solid ${active ? ACCENT : BORDER}`,
    borderRadius: '8px',
    fontFamily: "'Oswald', sans-serif",
    fontSize: '11px', letterSpacing: '1.5px', fontWeight: 700,
    cursor: 'pointer',
  };
}

function woodCellHead() {
  return {
    padding: '8px 6px', textAlign: 'left',
    background: '#000', color: GOLD,
    borderBottom: `1px solid ${BORDER}`,
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: '1px', fontWeight: 700,
    fontSize: '10px', whiteSpace: 'nowrap',
  };
}

function woodCellMeat() {
  return {
    padding: '6px 8px', color: TEXT, fontWeight: 600,
    borderBottom: `1px solid ${BORDER}`,
    background: '#0a0a0a',
    whiteSpace: 'nowrap',
  };
}

function woodCellCompat(c) {
  return {
    padding: '6px 8px', textAlign: 'center',
    borderBottom: `1px solid ${BORDER}`,
  };
}

// Traffic-light compat dot: green = best pairing, yellow = works,
// red = avoid, blue = neutral (no strong signal). Universal at-a-glance
// vocabulary replaces the older `●●●`/`●●`/`—`/`·` system that was
// hard to interpret without reading the legend every time.
function compatCircle(c) {
  const colors = {
    best:    '#4ade80', // green — the Scorecard "high score" green
    okay:    '#fbbf24', // yellow — the star yellow used across Scorecard
    avoid:   '#f87171', // red — matches the existing RED danger constant
    neutral: '#60a5fa', // blue — cool, low-signal "no strong opinion"
  };
  return {
    display: 'inline-block',
    width: '14px', height: '14px', borderRadius: '50%',
    background: colors[c] || colors.neutral,
    border: '1px solid rgba(0,0,0,0.3)',
    verticalAlign: 'middle',
  };
}

function MeatResultCard({ result, solo, hasSmoker, isOverridden, onSetServing, onReset }) {
  const {
    meatType, guide, servings, totalUnits, rawLb, cookedLb,
    cutsNeeded, perCutLb, perCutCookHours, perCutCookHoursLabel,
    cutLabel, batches, totalCookHoursLabel, smokerCapacity, smokerCannotFit,
  } = result;
  const s = guide.serving;

  return (
    <div style={{
      background: CARD, border: `2px solid ${smokerCannotFit ? RED : (solo ? ACCENT : BORDER)}`,
      borderRadius: '14px', padding: '18px', marginBottom: '12px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: '10px',
      }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: '700', letterSpacing: '1.5px', color: GOLD }}>
          {meatType.toUpperCase()}
        </div>
        {isOverridden && (
          <button onClick={onReset} style={{
            background: 'transparent', border: 'none', color: ACCENT_LIGHT,
            fontSize: '11px', cursor: 'pointer', textDecoration: 'underline',
          }}>reset</button>
        )}
      </div>

      {/* Serving stepper */}
      <div style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          <button onClick={() => onSetServing(Math.max(s.min, servings - s.step))} style={smallStepBtn()}>−</button>
          <div style={{ textAlign: 'center', minWidth: '180px' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '28px', fontWeight: '900', color: ACCENT_LIGHT, lineHeight: 1 }}>
              {servings} {servings === 1 ? s.unit : s.unitPlural}
            </div>
            <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>per person</div>
          </div>
          <button onClick={() => onSetServing(Math.min(s.max, servings + s.step))} style={smallStepBtn()}>+</button>
        </div>
        <div style={{ fontSize: '11px', color: MUTED, marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>
          {s.description}
        </div>
      </div>

      {/* Result blocks */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
        marginBottom: '12px',
      }}>
        <ResultBlock label="BUY"
          big={`${rawLb.toFixed(1)} lb`}
          sub={cutLabel}
          color={ACCENT_LIGHT} />
        <ResultBlock
          label={hasSmoker ? 'TOTAL COOK' : 'COOK PER CUT'}
          big={hasSmoker ? totalCookHoursLabel : perCutCookHoursLabel}
          sub={hasSmoker
            ? (batches > 1 ? `${batches} batches × ${perCutCookHoursLabel}` : `${perCutLb.toFixed(1)} lb at ${guide.cookTemp}°F`)
            : `${perCutLb.toFixed(1)} lb at ${guide.cookTemp}°F`}
          color={GOLD} />
      </div>

      {/* Smoker constraint warning */}
      {smokerCannotFit && (
        <div style={{
          background: 'rgba(248, 113, 113, 0.08)',
          border: `1px solid ${RED}`, borderRadius: '8px',
          padding: '10px 12px', fontSize: '12px', color: RED,
          lineHeight: 1.5, marginBottom: '10px',
        }}>
          <strong>This pit can&rsquo;t fit a single {CUT_NAMES[meatType].singular}</strong> &mdash; pick a bigger smoker or use the Custom option to override capacity.
        </div>
      )}

      {hasSmoker && !smokerCannotFit && batches > 1 && (
        <div style={{
          background: 'rgba(212, 166, 74, 0.06)',
          border: `1px solid ${GOLD}`, borderRadius: '8px',
          padding: '10px 12px', fontSize: '12px', color: TEXT,
          lineHeight: 1.5, marginBottom: '10px',
        }}>
          Smoker fits <strong>{smokerCapacity}</strong> {smokerCapacity === 1 ? CUT_NAMES[meatType].singular : CUT_NAMES[meatType].plural} at a time. You need <strong>{cutsNeeded}</strong> &mdash; that&rsquo;s <strong>{batches}</strong> batches back-to-back.
        </div>
      )}

      <DetailRow label="Total servings" value={`${totalUnits} ${totalUnits === 1 ? s.unit : s.unitPlural}`} />
      <DetailRow label="Cooked yield"   value={`~${cookedLb.toFixed(1)} lb`} />
      <DetailRow label="Finish temp"    value={`${guide.finishTemp}°F`} />
      <DetailRow label="Wrap"           value={guide.wrapMethod} />
      <DetailRow label="Rest"           value={`${guide.restMinutes} min`} />
      <DetailRow label="Shrinkage"      value={`~${Math.round(guide.shrinkage * 100)}%`} last />
    </div>
  );
}

function ResultBlock({ label, big, sub, color }) {
  return (
    <div style={{
      background: '#111', border: `1px solid ${BORDER}`,
      borderRadius: '10px', padding: '12px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '10px', letterSpacing: '2px', color: MUTED, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '26px', fontWeight: '900', color, lineHeight: 1 }}>
        {big}
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>{sub}</div>
    </div>
  );
}

function DetailRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: last ? 'none' : `1px solid ${BORDER}`,
    }}>
      <span style={{ fontSize: '12px', color: MUTED, letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '12px', color: TEXT, fontWeight: '600' }}>{value}</span>
    </div>
  );
}

function EmptyMeatPrompt() {
  return (
    <div style={{
      background: CARD, border: `1px dashed ${BORDER}`,
      borderRadius: '12px', padding: '32px 16px', textAlign: 'center',
      marginBottom: '12px',
    }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: GOLD, marginBottom: '6px' }}>
        PICK AT LEAST ONE MEAT
      </div>
      <div style={{ fontSize: '12px', color: MUTED }}>
        Tap a meat above to see how much to buy and how long to cook.
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────

function stepBtn() {
  return {
    width: '52px', height: '52px', borderRadius: '50%',
    background: '#111', color: TEXT, border: `1px solid ${BORDER}`,
    fontSize: '26px', fontWeight: '700', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  };
}

function smallStepBtn() {
  return {
    width: '40px', height: '40px', borderRadius: '50%',
    background: '#1a1a1a', color: TEXT, border: `1px solid ${BORDER}`,
    fontSize: '20px', fontWeight: '700', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1, flexShrink: 0,
  };
}

function tinyStepBtn() {
  return {
    width: '32px', height: '32px', borderRadius: '50%',
    background: '#000', color: TEXT, border: `1px solid ${BORDER}`,
    fontSize: '16px', fontWeight: '700', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1, flexShrink: 0,
  };
}

function quickBtn(active) {
  return {
    padding: '6px 14px',
    background: active ? GOLD : 'transparent',
    color: active ? '#1a1a1a' : MUTED,
    border: `1px solid ${active ? GOLD : BORDER}`,
    borderRadius: '999px',
    fontFamily: "'Oswald', sans-serif", fontSize: '11px',
    letterSpacing: '1px', fontWeight: '700', cursor: 'pointer',
  };
}

function subBtn() {
  return {
    padding: '8px 14px', background: 'transparent', color: TEXT,
    border: `1px solid ${BORDER}`, borderRadius: '6px',
    fontFamily: "'Oswald', sans-serif", fontSize: '12px',
    letterSpacing: '1px', fontWeight: '600', cursor: 'pointer',
  };
}

function pillBtn(active) {
  return {
    flex: 1, padding: '10px 8px',
    background: active ? ACCENT : '#111',
    color: active ? '#fff' : MUTED,
    border: `1px solid ${active ? ACCENT : BORDER}`,
    borderRadius: '8px',
    fontFamily: "'Oswald', sans-serif", fontSize: '12px',
    letterSpacing: '1px', fontWeight: '600', cursor: 'pointer',
  };
}

function stylePill(active) {
  return {
    padding: '10px 14px',
    background: active ? GOLD : '#111',
    color: active ? '#1a1a1a' : TEXT,
    border: `1px solid ${active ? GOLD : BORDER}`,
    borderRadius: '999px',
    fontFamily: "'Oswald', sans-serif", fontSize: '12px',
    letterSpacing: '1.5px', fontWeight: '700', cursor: 'pointer',
  };
}

function meatPill(active) {
  return {
    padding: '10px 14px',
    background: active ? GOLD : '#111',
    color: active ? '#1a1a1a' : TEXT,
    border: `1px solid ${active ? GOLD : BORDER}`,
    borderRadius: '999px',
    fontFamily: "'Oswald', sans-serif", fontSize: '13px',
    letterSpacing: '1px', fontWeight: '600', cursor: 'pointer',
  };
}

// ── Math ────────────────────────────────────────────────────────

function calculate(guests, meatTypes, appetite, sidesIncluded, servingOverrides, smoker) {
  const n = guests || 1;
  const sidesFactor = sidesIncluded ? 1.0 : 1.15;

  return meatTypes.map(meatType => {
    const guide = MEAT_GUIDE[meatType];
    const s = guide.serving;

    const servings = servingOverrides[meatType] ?? s.defaults[appetite];

    const cookedLbPerPerson = servings * s.cookedLbEach * sidesFactor;
    const cookedLb = cookedLbPerPerson * n;
    const rawLb = cookedLb / (1 - guide.shrinkage);
    const totalUnits = servings * n;

    const cutsNeeded = Math.max(1, Math.ceil(rawLb / guide.typicalCutLb));
    const perCutLb = rawLb / cutsNeeded;
    const hrPerLb = (guide.hrPerLbLow + guide.hrPerLbHigh) / 2;
    const perCutCookHours = perCutLb * hrPerLb;

    const name = CUT_NAMES[meatType];
    const cutLabel = cutsNeeded === 1
      ? `1 ${name.singular} (~${perCutLb.toFixed(1)} lb)`
      : `${cutsNeeded} ${name.plural} (~${perCutLb.toFixed(1)} lb each)`;

    // Smoker math — how many cuts fit, how many batches we run.
    const smokerCapacity = smoker ? (smoker.capacity[meatType] || 0) : null;
    const smokerCannotFit = smokerCapacity === 0;
    const batches = (!smoker || smokerCannotFit)
      ? 1
      : Math.max(1, Math.ceil(cutsNeeded / smokerCapacity));
    const totalCookHours = perCutCookHours * batches;

    return {
      meatType, guide,
      servings, totalUnits,
      rawLb, cookedLb,
      cutsNeeded, perCutLb, perCutCookHours,
      perCutCookHoursLabel: formatCookHours(perCutCookHours),
      cutLabel,
      smokerCapacity, smokerCannotFit, batches,
      totalCookHours,
      totalCookHoursLabel: formatCookHours(totalCookHours),
    };
  });
}

function formatCookHours(hours) {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
