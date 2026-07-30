import { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { MEAT_GUIDE, APPETITE_LEVELS, CUT_NAMES } from './constants.js';
import { SIDES_MENU, DESSERTS_MENU, computeMenuCostPerPerson } from './menu.js';
import { auth, googleProvider } from './firebase.catering.js';

// ────────────────────────────────────────────────────────────────
// Private internal catering quote calculator.
//
// Access model: Google sign-in via Firebase Auth + email whitelist.
// Anyone can land on /catering/ and see the sign-in prompt; only
// users whose email is in ALLOWED_EMAILS get past the gate. Anyone
// else sees an access-denied screen.
//
// To grant a teammate access: add their email to ALLOWED_EMAILS,
// redeploy, and have them visit /catering/ and sign in with Google.
// ────────────────────────────────────────────────────────────────

const ALLOWED_EMAILS = [
  'jmuiller56@gmail.com',
  'owner@holysmokesbbqco.com',
];

const RATES_KEY = 'bbq-catering-rates-v1';
const QUOTES_KEY = 'bbq-catering-quotes-v1';

// Two palettes, intentionally. Holy Smokes brand chrome (sign-in,
// access-denied, landing card) stays in the warm family so the public
// surfaces feel like part of the same site. The interior quote
// calculator switches to a cool slate/steel-blue palette pulled from
// the BBQ Calculator logo — signals to the operator "you are now in
// the working tool."
//
// COOL = the catering calculator interior
const ACCENT = '#3D5A80';        // steel blue (logo inner circle)
const ACCENT_LIGHT = '#5C7DA0';  // lighter steel blue
const GOLD = '#F5C842';          // saffron (logo text)
const RED = '#f87171';
const BG = '#1A2128';            // deep slate background
const CARD = '#2C3539';          // gunmetal slate (logo outer ring)
const BORDER = '#3D4954';        // mid-slate border
const TEXT = '#E8E1D3';          // warm off-white for contrast on cool slate
const MUTED = '#8A95A3';         // cool gray-blue

// WARM = public/brand surfaces (matches Scorecard, Notebook, Calculator chrome)
const W_BG = '#1a1a1a';
const W_CARD = '#2a2015';
const W_BORDER = '#3a2f22';
const W_TEXT = '#f5e6d3';
const W_MUTED = '#999';
const W_GOLD = '#d4a64a';
const W_ACCENT = '#4A6741';

// ── Default rates ───────────────────────────────────────────────
// Wisconsin retail prices for 2026, mid-tier cuts. These are starting
// defaults — user can adjust per-event and the overrides persist.
const DEFAULT_RATES = {
  meatPricePerLb: {
    'Brisket':         6.50,
    'Pork Shoulder':   3.50,
    'St. Louis Ribs':  5.50,
    'Baby Back Ribs':  6.50,
    'Chicken':         2.50,
    'Turkey':          2.50,
    'Sausage':         5.00,
    'Tri-tip':        11.00,
  },
  hourlyRate: 30,        // $/hr — skilled labor, side-hustle tier
  mileageRate: 0.70,     // $/mi — 2026 IRS standard business rate
  sidesPerPerson: 2.00,  // $/person — homemade beans, slaw, sauce, rolls
  fuelPerHour: 1.50,     // $/hr — pellets/wood cost roughly
  markup: 2.5,           // total quote = (cost) × markup
};

// ── Helpers ─────────────────────────────────────────────────────
const fmtUSD = (n) => `$${(n || 0).toFixed(2)}`;
const fmtUSD0 = (n) => `$${Math.round(n || 0).toLocaleString()}`;
const track = (event, params) => {
  try { window.gtag?.('event', event, { app: 'catering', ...params }); } catch {}
};

function loadRates() {
  try {
    const raw = localStorage.getItem(RATES_KEY);
    if (!raw) return DEFAULT_RATES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_RATES, ...parsed, meatPricePerLb: { ...DEFAULT_RATES.meatPricePerLb, ...(parsed.meatPricePerLb || {}) } };
  } catch { return DEFAULT_RATES; }
}

function saveRates(rates) {
  try { localStorage.setItem(RATES_KEY, JSON.stringify(rates)); } catch {}
}

function loadQuotes() {
  try { return JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); } catch { return []; }
}

function saveQuotes(quotes) {
  try { localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes)); } catch {}
}

// Quote engine. Takes inputs + rates, returns full quote object.
//
// New inputs (backwards-compatible):
//   - meatServingsOverride: { [meat]: number }  per-meat servings/person override
//   - sidesSelection:       { [name]: { servings?, costPerPerson? } }  selected sides
//   - dessertsSelection:    { [name]: { servings?, costPerPerson? } }  selected desserts
function buildQuote({
  guests, meats, sides, appetite, distanceMiles,
  laborHoursOverride, markupOverride, rates,
  meatServingsOverride = {},
  sidesSelection = {},
  dessertsSelection = {},
}) {
  // If user has selected specific sides from the menu, sides=true regardless
  // of legacy toggle so the bump-meat-15% only fires when truly no sides.
  const anySidesSelected = Object.keys(sidesSelection).length > 0;
  const effectiveSides = sides || anySidesSelected;
  const sidesFactor = effectiveSides ? 1.0 : 1.15;
  const n = Math.max(1, guests || 1);

  const meatBreakdown = meats.map(meat => {
    const guide = MEAT_GUIDE[meat];
    if (!guide) return null;
    const s = guide.serving;
    const defaultServings = s.defaults[appetite] ?? s.defaults.normal;
    const servings = meatServingsOverride[meat] != null && meatServingsOverride[meat] !== ''
      ? Number(meatServingsOverride[meat])
      : defaultServings;
    const cookedLbPerPerson = servings * s.cookedLbEach * sidesFactor;
    const cookedLb = cookedLbPerPerson * n;
    const rawLb = cookedLb / (1 - guide.shrinkage);
    const cutsNeeded = Math.max(1, Math.ceil(rawLb / guide.typicalCutLb));
    const perCutLb = rawLb / cutsNeeded;
    const hrPerLb = (guide.hrPerLbLow + guide.hrPerLbHigh) / 2;
    const cookHours = perCutLb * hrPerLb; // single-cut cook time (parallel)
    const pricePerLb = rates.meatPricePerLb[meat] ?? 5.00;
    const cost = rawLb * pricePerLb;
    return { meat, servings, defaultServings, rawLb, cookedLb, cutsNeeded, perCutLb, cookHours, pricePerLb, cost };
  }).filter(Boolean);

  const totalRawLb = meatBreakdown.reduce((a, m) => a + m.rawLb, 0);
  const totalMeatCost = meatBreakdown.reduce((a, m) => a + m.cost, 0);
  // Longest single-cut cook time across meats (parallel on a trailer)
  const longestCookHours = meatBreakdown.reduce((a, m) => Math.max(a, m.cookHours), 0);

  // Labor auto-estimate (user can override):
  //   prep 2hr + light cook attention (~1/3 of cook hours) + 5hr setup/serve/cleanup
  //   + round-trip drive time at 50 mph average
  const driveHours = (distanceMiles || 0) * 2 / 50;
  const estimatedLaborHours =
    2 +                              // prep night before
    Math.ceil(longestCookHours / 3) + // light attention during cook
    5 +                              // setup + serve + cleanup
    driveHours;                      // round-trip drive
  const laborHours = laborHoursOverride != null && laborHoursOverride !== ''
    ? Number(laborHoursOverride)
    : estimatedLaborHours;

  const laborCost = laborHours * rates.hourlyRate;
  const mileageCost = (distanceMiles || 0) * 2 * rates.mileageRate;

  // Sides + desserts: itemized cost. Falls back to the legacy flat
  // rate.sidesPerPerson only when no specific menu items are selected
  // AND the legacy "sides" boolean is true.
  let sidesCost = 0;
  let dessertsCost = 0;
  if (anySidesSelected || Object.keys(dessertsSelection).length > 0) {
    sidesCost = n * Object.keys(sidesSelection).reduce((sum, name) => {
      const def = SIDES_MENU[name];
      const sel = sidesSelection[name];
      const cost = sel?.costPerPerson ?? def?.costPerPerson ?? 0;
      return sum + cost;
    }, 0);
    dessertsCost = n * Object.keys(dessertsSelection).reduce((sum, name) => {
      const def = DESSERTS_MENU[name];
      const sel = dessertsSelection[name];
      const cost = sel?.costPerPerson ?? def?.costPerPerson ?? 0;
      return sum + cost;
    }, 0);
  } else if (sides) {
    sidesCost = n * rates.sidesPerPerson;
  }

  const fuelCost = longestCookHours * rates.fuelPerHour;

  const totalCost = totalMeatCost + laborCost + mileageCost + sidesCost + dessertsCost + fuelCost;
  const markup = markupOverride != null && markupOverride !== ''
    ? Number(markupOverride)
    : rates.markup;
  const suggestedQuote = totalCost * markup;
  const perPerson = suggestedQuote / n;

  return {
    meatBreakdown,
    totalRawLb,
    totalMeatCost,
    longestCookHours,
    estimatedLaborHours,
    laborHours,
    laborCost,
    mileageCost,
    sidesCost,
    dessertsCost,
    fuelCost,
    totalCost,
    markup,
    suggestedQuote,
    perPerson,
    driveHours,
  };
}

// Build a structured shopping list for a saved quote. Each line:
//   { id, heading?, item, qty, sub, purchased }
// Returns ordered lines suitable for display and toggle-tracking.
function buildCateringShopping({ quote, guests, meats, sidesSelection, dessertsSelection, distanceMiles }) {
  const lines = [];
  const n = Math.max(1, guests || 1);

  lines.push({ id: 'h:meat', heading: 'MEAT (raw weight)' });
  quote.meatBreakdown.forEach(m => {
    const name = CUT_NAMES[m.meat];
    const cutDesc = m.cutsNeeded === 1
      ? `1 ${name?.singular || 'cut'} ~${m.perCutLb.toFixed(1)} lb`
      : `${m.cutsNeeded} ${name?.plural || 'cuts'} ~${m.perCutLb.toFixed(1)} lb each`;
    lines.push({ id: `meat:${m.meat}`, item: m.meat, qty: `${m.rawLb.toFixed(1)} lb`, sub: cutDesc, purchased: false });
  });

  const totalRawLb = quote.totalRawLb || 0;
  const rubTbsp = Math.ceil(totalRawLb);
  lines.push({ id: 'h:seasoning', heading: 'SEASONING' });
  lines.push({
    id: 'rub',
    item: 'Dry rub',
    qty: `~${(rubTbsp / 16).toFixed(1)} cups`,
    sub: `~1 tbsp per lb raw (${rubTbsp} tbsp)`,
    purchased: false,
  });

  const sidesKeys = Object.keys(sidesSelection);
  if (sidesKeys.length > 0) {
    lines.push({ id: 'h:sides', heading: 'SIDES' });
    sidesKeys.forEach(name => {
      const def = SIDES_MENU[name];
      const sel = sidesSelection[name];
      if (!def) return;
      const servings = sel.servings ?? def.default;
      const total = servings * n;
      lines.push({
        id: `side:${name}`,
        item: name,
        qty: `${total.toFixed(total < 10 ? 1 : 0)} ${def.unit}${total >= 2 && !def.unit.endsWith('s') ? 's' : ''}`,
        sub: def.ingredients,
        purchased: false,
      });
    });
  }

  const dessertsKeys = Object.keys(dessertsSelection);
  if (dessertsKeys.length > 0) {
    lines.push({ id: 'h:desserts', heading: 'DESSERTS' });
    dessertsKeys.forEach(name => {
      const def = DESSERTS_MENU[name];
      const sel = dessertsSelection[name];
      if (!def) return;
      const servings = sel.servings ?? def.default;
      const total = servings * n;
      lines.push({
        id: `dessert:${name}`,
        item: name,
        qty: `${total.toFixed(total < 10 ? 1 : 0)} ${def.unit}${total >= 2 && !def.unit.endsWith('s') ? 's' : ''}`,
        sub: def.ingredients,
        purchased: false,
      });
    });
  }

  const wrapCuts = quote.meatBreakdown
    .filter(m => /brisket|pork shoulder|pulled pork/i.test(m.meat))
    .reduce((s, m) => s + m.cutsNeeded, 0);
  if (wrapCuts > 0) {
    lines.push({ id: 'h:wrap', heading: 'WRAP & PREP' });
    lines.push({ id: 'paper', item: 'Butcher paper', qty: `~${Math.ceil(wrapCuts * 6)} ft`, sub: '~6 ft per wrap', purchased: false });
    lines.push({ id: 'foil', item: 'Heavy-duty foil', qty: `~${Math.ceil(wrapCuts / 4)} roll(s)`, sub: '~4 wraps per roll', purchased: false });
  }

  return lines;
}

// Generate plain-text quote summary for SMS/email
function quoteToText({ customer, event, meats, sides, quote, finalQuote }) {
  const lines = [];
  lines.push(`Holy Smokes BBQ — Catering Estimate`);
  if (customer.name) lines.push(`For: ${customer.name}`);
  if (event.date) lines.push(`Event: ${event.type || 'Catering'} on ${event.date}`);
  lines.push(`Guests: ${event.guests}`);
  lines.push('');
  lines.push(`Menu: ${meats.join(', ')}${sides ? ' + sides' : ''}`);
  lines.push('');
  const finalTotal = finalQuote != null && finalQuote !== '' ? Number(finalQuote) : quote.suggestedQuote;
  lines.push(`Estimated total: ${fmtUSD0(finalTotal)}`);
  lines.push(`Per person: ~${fmtUSD(finalTotal / Math.max(1, event.guests))}`);
  lines.push('');
  lines.push(`Reply to confirm and we'll lock the date.`);
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Root component — handles auth gate
// ────────────────────────────────────────────────────────────────
export default function CateringApp() {
  const [authState, setAuthState] = useState({ status: 'loading', user: null });
  const [signInError, setSignInError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return setAuthState({ status: 'signed_out', user: null });
      const email = (user.email || '').toLowerCase();
      const allowed = ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email);
      setAuthState({ status: allowed ? 'allowed' : 'denied', user });
      if (allowed) track('catering_unlocked', { method: 'auth' });
    });
    return unsub;
  }, []);

  const handleSignIn = async () => {
    setSignInError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setSignInError((e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request')
        ? '' // user cancelled — not an error worth showing
        : 'Sign-in failed. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try { await signOut(auth); } catch {}
  };

  if (authState.status === 'loading') return null;
  if (authState.status === 'signed_out') return <SignInView onSignIn={handleSignIn} error={signInError} />;
  if (authState.status === 'denied') return <AccessDeniedView user={authState.user} onSignOut={handleSignOut} />;
  return <CateringTool user={authState.user} onSignOut={handleSignOut} />;
}

// Pre-auth view. Warm Holy Smokes palette — matches the rest of the
// site so the brand stays consistent. The cool palette only shows up
// after sign-in (the tool interior).
function SignInView({ onSignIn, error }) {
  return (
    <div style={{ background: W_BG, minHeight: '100vh', color: W_TEXT, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{
        background: W_CARD, border: `1px solid ${W_BORDER}`, borderRadius: '14px',
        padding: '32px 24px', maxWidth: '380px', width: '100%', textAlign: 'center',
      }}>
        <img src="/holy-smokes-logo.png" alt="Holy Smokes BBQ" width="80" height="80"
          style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '14px' }}
          onError={(e) => { e.target.style.display = 'none'; }} />
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px', letterSpacing: '2px', color: W_MUTED, marginBottom: '8px' }}>
          INTERNAL TOOL
        </div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '24px', fontWeight: 700, letterSpacing: '2px', color: W_GOLD, margin: '0 0 12px' }}>
          BBQ CATERING
        </h1>
        <p style={{ fontSize: '13px', color: W_MUTED, lineHeight: 1.6, marginBottom: '24px' }}>
          Holy Smokes BBQ Co catering quote tool. Sign in to continue.
        </p>
        <button onClick={onSignIn} style={{
          width: '100%', padding: '12px 18px',
          background: W_GOLD, color: '#1a1a1a', border: 'none',
          borderRadius: '8px', fontFamily: "'Oswald', sans-serif",
          fontSize: '13px', letterSpacing: '2px', fontWeight: 700,
          cursor: 'pointer',
        }}>
          SIGN IN WITH GOOGLE
        </button>
        {error && (
          <div style={{ fontSize: '12px', color: RED, marginTop: '12px' }}>{error}</div>
        )}
        <div style={{ marginTop: '20px' }}>
          <a href="/" style={{ color: W_ACCENT, fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>← Back to Holy Smokes</a>
        </div>
      </div>
    </div>
  );
}

// Signed in, but not in the whitelist. Soft denial — explains it's
// internal and points them to the inquiry email rather than framing
// the visitor as a bad actor.
function AccessDeniedView({ user, onSignOut }) {
  return (
    <div style={{ background: W_BG, minHeight: '100vh', color: W_TEXT, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{
        background: W_CARD, border: `1px solid ${W_BORDER}`, borderRadius: '14px',
        padding: '32px 24px', maxWidth: '420px', width: '100%', textAlign: 'center',
      }}>
        <img src="/holy-smokes-logo.png" alt="Holy Smokes BBQ" width="80" height="80"
          style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '14px' }}
          onError={(e) => { e.target.style.display = 'none'; }} />
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px', letterSpacing: '2px', color: W_MUTED, marginBottom: '8px' }}>
          ACCESS REQUIRED
        </div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 700, letterSpacing: '1px', color: W_GOLD, margin: '0 0 12px' }}>
          This tool is internal
        </h1>
        <p style={{ fontSize: '13px', color: W_MUTED, lineHeight: 1.6, marginBottom: '16px' }}>
          You&rsquo;re signed in as <strong style={{ color: W_TEXT }}>{user?.email || 'unknown'}</strong>, but this account isn&rsquo;t on the access list.
        </p>
        <p style={{ fontSize: '13px', color: W_TEXT, lineHeight: 1.6, marginBottom: '24px' }}>
          Interested in a quote for your event? Email us at{' '}
          <a href="mailto:catering@holysmokesbbqco.com" style={{ color: W_GOLD, fontWeight: 600, textDecoration: 'underline' }}>
            catering@holysmokesbbqco.com
          </a>
          {' '}and we&rsquo;ll get back to you.
        </p>
        <button onClick={onSignOut} style={{
          width: '100%', padding: '10px 18px',
          background: 'transparent', color: W_TEXT, border: `1px solid ${W_BORDER}`,
          borderRadius: '8px', fontFamily: "'Oswald', sans-serif",
          fontSize: '12px', letterSpacing: '1.5px', fontWeight: 700,
          cursor: 'pointer', marginBottom: '12px',
        }}>
          SIGN OUT
        </button>
        <div>
          <a href="/" style={{ color: W_ACCENT, fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>← Back to Holy Smokes</a>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main tool (unlocked state)
// ────────────────────────────────────────────────────────────────
function CateringTool({ user, onSignOut }) {
  // ── Customer + event inputs ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [guests, setGuests] = useState(50);

  // ── Menu ──
  const [meats, setMeats] = useState(['Brisket']);
  const [sides, setSides] = useState(true);
  const [appetite, setAppetite] = useState('normal');
  // Per-meat servings overrides — empty means use the appetite default.
  // Keyed by meat name. Editable in the new portion-control stepper.
  const [meatServingsOverride, setMeatServingsOverride] = useState({});
  // Sides + desserts menu selections. Each value is { servings, costPerPerson }.
  // Empty objects = "no menu items selected" — falls back to legacy
  // flat-rate sides cost via the `sides` boolean below.
  const [sidesSelection, setSidesSelection] = useState({});
  const [dessertsSelection, setDessertsSelection] = useState({});
  // Shopping list for THIS quote. Stored as a list of items with
  // purchased/qty/item overrides per id. Regenerated from the current
  // quote when empty or on user request.
  const [shoppingItems, setShoppingItems] = useState([]);
  const [showCateringShopping, setShowCateringShopping] = useState(false);

  // ── Pricing overrides ──
  const [rates, setRatesState] = useState(loadRates());
  const [showRates, setShowRates] = useState(false);
  const [laborHoursOverride, setLaborHoursOverride] = useState('');
  const [markupOverride, setMarkupOverride] = useState('');
  const [finalQuoteOverride, setFinalQuoteOverride] = useState('');

  // ── History ──
  const [quotes, setQuotes] = useState(loadQuotes);
  const [showHistory, setShowHistory] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  // ── UI state ──
  const [copyStatus, setCopyStatus] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  const persistRates = useCallback((next) => {
    setRatesState(next);
    saveRates(next);
  }, []);

  const persistQuotes = useCallback((next) => {
    setQuotes(next);
    saveQuotes(next);
  }, []);

  const toggleMeat = (m) => {
    setMeats(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const quote = useMemo(
    () => buildQuote({
      guests, meats, sides, appetite, distanceMiles,
      laborHoursOverride, markupOverride, rates,
      meatServingsOverride, sidesSelection, dessertsSelection,
    }),
    [guests, meats, sides, appetite, distanceMiles, laborHoursOverride, markupOverride, rates, meatServingsOverride, sidesSelection, dessertsSelection],
  );

  const newQuote = () => {
    setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
    setEventDate(''); setEventType(''); setEventLocation('');
    setDistanceMiles(0); setGuests(50);
    setMeats(['Brisket']); setSides(true); setAppetite('normal');
    setMeatServingsOverride({}); setSidesSelection({}); setDessertsSelection({});
    setShoppingItems([]);
    setLaborHoursOverride(''); setMarkupOverride(''); setFinalQuoteOverride('');
    setEditingQuoteId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveQuote = () => {
    if (!customerName.trim()) {
      alert('Add a customer name before saving.');
      return;
    }
    const finalTotal = finalQuoteOverride !== '' ? Number(finalQuoteOverride) : quote.suggestedQuote;
    const snapshot = {
      id: editingQuoteId || `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: editingQuoteId ? quotes.find(q => q.id === editingQuoteId)?.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now(),
      customer: { name: customerName.trim(), phone: customerPhone.trim(), email: customerEmail.trim() },
      event: { date: eventDate, type: eventType, location: eventLocation, distanceMiles, guests },
      menu: { meats, sides, appetite, meatServingsOverride, sidesSelection, dessertsSelection },
      shoppingItems,
      pricing: {
        ratesSnapshot: rates,
        laborHoursOverride: laborHoursOverride !== '' ? Number(laborHoursOverride) : null,
        markupOverride: markupOverride !== '' ? Number(markupOverride) : null,
        finalQuoteOverride: finalQuoteOverride !== '' ? Number(finalQuoteOverride) : null,
        computed: {
          totalCost: quote.totalCost,
          suggestedQuote: quote.suggestedQuote,
          finalTotal,
          perPerson: finalTotal / Math.max(1, guests),
        },
      },
    };
    const existing = quotes.findIndex(q => q.id === snapshot.id);
    const next = existing >= 0
      ? [...quotes.slice(0, existing), snapshot, ...quotes.slice(existing + 1)]
      : [snapshot, ...quotes];
    persistQuotes(next);
    setEditingQuoteId(snapshot.id);
    setSavedNotice(existing >= 0 ? 'Quote updated' : 'Quote saved');
    setTimeout(() => setSavedNotice(''), 1800);
    track('catering_quote_saved', { is_edit: existing >= 0, guests, meats: meats.length });
  };

  const loadQuoteIntoForm = (q) => {
    setCustomerName(q.customer.name || '');
    setCustomerPhone(q.customer.phone || '');
    setCustomerEmail(q.customer.email || '');
    setEventDate(q.event.date || '');
    setEventType(q.event.type || '');
    setEventLocation(q.event.location || '');
    setDistanceMiles(q.event.distanceMiles || 0);
    setGuests(q.event.guests || 50);
    setMeats(q.menu.meats || ['Brisket']);
    setSides(q.menu.sides ?? true);
    setAppetite(q.menu.appetite || 'normal');
    setMeatServingsOverride(q.menu.meatServingsOverride || {});
    setSidesSelection(q.menu.sidesSelection || {});
    setDessertsSelection(q.menu.dessertsSelection || {});
    setShoppingItems(q.shoppingItems || []);
    setLaborHoursOverride(q.pricing.laborHoursOverride != null ? String(q.pricing.laborHoursOverride) : '');
    setMarkupOverride(q.pricing.markupOverride != null ? String(q.pricing.markupOverride) : '');
    setFinalQuoteOverride(q.pricing.finalQuoteOverride != null ? String(q.pricing.finalQuoteOverride) : '');
    setEditingQuoteId(q.id);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteQuote = (id) => {
    if (!window.confirm('Delete this quote?')) return;
    persistQuotes(quotes.filter(q => q.id !== id));
    if (editingQuoteId === id) setEditingQuoteId(null);
  };

  const handleCopy = async () => {
    const text = quoteToText({
      customer: { name: customerName },
      event: { date: eventDate, type: eventType, guests },
      meats,
      sides,
      quote,
      finalQuote: finalQuoteOverride,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
      track('catering_quote_copied');
    } catch {
      setCopyStatus('failed');
    }
    setTimeout(() => setCopyStatus(''), 1500);
  };

  const finalTotal = finalQuoteOverride !== '' ? Number(finalQuoteOverride) : quote.suggestedQuote;
  const finalPerPerson = finalTotal / Math.max(1, guests);

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "'Inter', sans-serif" }}>
      <header style={{ background: '#151B20', borderBottom: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div className="bbq-container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{ color: MUTED, textDecoration: 'none', fontSize: 14 }}>← Back</a>
            <div style={{ height: 20, width: 1, background: BORDER }} />
            <div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1, color: GOLD }}>
                CATERING QUOTE
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: -2 }}>
                Internal quote builder
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: MUTED, letterSpacing: 1 }}>{user?.email}</span>
            <button onClick={onSignOut} style={{
              background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`,
              borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
            }}>Sign out</button>
          </div>
        </div>
      </header>
      <div className="bbq-container-wide" style={{ padding: '24px 16px 64px' }}>

        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '26px', fontWeight: 700, letterSpacing: '3px', color: GOLD, margin: 0 }}>
            CATERING QUOTE
          </h1>
          <div style={{ fontSize: '12px', color: MUTED, letterSpacing: '2px', marginTop: '4px' }}>
            HOLY SMOKES BBQ CO
          </div>
        </div>

        {savedNotice && (
          <div style={{
            background: 'rgba(74, 103, 65, 0.18)', border: `1px solid ${ACCENT}`,
            color: ACCENT_LIGHT, borderRadius: '10px', padding: '10px 14px',
            fontSize: '13px', fontWeight: 600, marginBottom: '12px', textAlign: 'center',
          }}>{savedNotice}</div>
        )}

        {/* Customer card */}
        <Section title="CUSTOMER">
          <Field label="NAME">
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Smith Family" style={inputStyle()} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="PHONE">
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(555) 555-5555" style={inputStyle()} />
            </Field>
            <Field label="EMAIL">
              <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="email@example.com" style={inputStyle()} />
            </Field>
          </div>
        </Section>

        {/* Event card */}
        <Section title="EVENT">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="DATE">
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ ...inputStyle(), colorScheme: 'dark' }} />
            </Field>
            <Field label="TYPE">
              <select value={eventType} onChange={e => setEventType(e.target.value)} style={inputStyle()}>
                <option value="">Select…</option>
                {['Graduation', 'Wedding', 'Church event', 'Family reunion', 'Birthday', 'Corporate', 'Holiday', 'Other'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="LOCATION">
            <input value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="City or venue" style={inputStyle()} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="GUESTS">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setGuests(g => Math.max(1, (parseInt(g, 10) || 1) - 1))} style={stepBtn()}>−</button>
                <input type="number" inputMode="numeric" value={guests} onChange={e => setGuests(parseInt(e.target.value, 10) || 0)} style={{ ...inputStyle(), textAlign: 'center', flex: 1 }} />
                <button onClick={() => setGuests(g => (parseInt(g, 10) || 0) + 1)} style={stepBtn()}>+</button>
              </div>
            </Field>
            <Field label="DISTANCE (MI, ONE-WAY)">
              <input type="number" inputMode="numeric" value={distanceMiles} onChange={e => setDistanceMiles(parseFloat(e.target.value) || 0)} placeholder="0" style={inputStyle()} />
            </Field>
          </div>
        </Section>

        {/* Menu card */}
        <Section title="MENU">
          <Field label="MEATS">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.keys(MEAT_GUIDE).map(m => (
                <button key={m} onClick={() => toggleMeat(m)} style={meatPill(meats.includes(m))}>{m}</button>
              ))}
            </div>
          </Field>
          <Field label="APPETITE">
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.entries(APPETITE_LEVELS).map(([k, v]) => (
                <button key={k} onClick={() => setAppetite(k)} style={pillBtn(appetite === k)}>{v.label}</button>
              ))}
            </div>
          </Field>
          <Field label="SIDES">
            <div style={{ fontSize: '11px', color: MUTED, fontStyle: 'italic', marginBottom: '6px' }}>
              Tap to select. Selected items get an editable per-person qty + cost.
            </div>
            <MenuPicker
              menu={SIDES_MENU}
              selection={sidesSelection}
              setSelection={setSidesSelection}
            />
            {Object.keys(sidesSelection).length === 0 && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button onClick={() => setSides(true)} style={pillBtn(sides)}>Sides bundled (flat rate)</button>
                <button onClick={() => setSides(false)} style={pillBtn(!sides)}>No sides (bump meat 15%)</button>
              </div>
            )}
          </Field>

          <Field label="DESSERTS">
            <div style={{ fontSize: '11px', color: MUTED, fontStyle: 'italic', marginBottom: '6px' }}>
              Optional. Tap to add to the menu.
            </div>
            <MenuPicker
              menu={DESSERTS_MENU}
              selection={dessertsSelection}
              setSelection={setDessertsSelection}
            />
          </Field>
        </Section>

        {/* Per-meat portion controls + quantities. Stepper overrides
            the appetite default for that specific meat. */}
        {meats.length > 0 && (
          <Section title="QUANTITIES">
            {quote.meatBreakdown.map(m => {
              const guide = MEAT_GUIDE[m.meat];
              const s = guide?.serving;
              const isOverridden = meatServingsOverride[m.meat] != null;
              return (
                <div key={m.meat} style={{ padding: '10px 0', borderBottom: `1px dashed ${BORDER}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                    <span style={{ color: TEXT, fontSize: '13px' }}>
                      <strong style={{ color: GOLD }}>{m.meat}</strong>
                      <span style={{ color: MUTED, fontSize: '12px', marginLeft: '8px' }}>
                        {m.cutsNeeded === 1 ? `1 ${CUT_NAMES[m.meat]?.singular || 'cut'}` : `${m.cutsNeeded} ${CUT_NAMES[m.meat]?.plural || 'cuts'}`} · ~{m.cookHours.toFixed(1)}h
                      </span>
                    </span>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: ACCENT_LIGHT, fontSize: '13px' }}>
                      {m.rawLb.toFixed(1)} lb
                    </span>
                  </div>
                  {s && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: MUTED }}>
                      <button onClick={() => { setMeatServingsOverride(o => ({ ...o, [m.meat]: Math.max(s.min, m.servings - s.step) })); track('catering_portion_override', { meat: m.meat, direction: 'down' }); }} style={miniStepBtn()}>−</button>
                      <span style={{ minWidth: '110px', textAlign: 'center', color: TEXT }}>
                        {m.servings} {m.servings === 1 ? s.unit : s.unitPlural} / person
                      </span>
                      <button onClick={() => { setMeatServingsOverride(o => ({ ...o, [m.meat]: Math.min(s.max, m.servings + s.step) })); track('catering_portion_override', { meat: m.meat, direction: 'up' }); }} style={miniStepBtn()}>+</button>
                      {isOverridden && (
                        <button onClick={() => setMeatServingsOverride(o => { const next = { ...o }; delete next[m.meat]; return next; })} style={{
                          background: 'transparent', color: ACCENT_LIGHT, border: 'none',
                          fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', marginLeft: 'auto',
                        }}>reset</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: MUTED, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Total raw to buy</span>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: GOLD, fontSize: '15px' }}>{quote.totalRawLb.toFixed(1)} lb</span>
            </div>
          </Section>
        )}

        {/* Pricing & quote */}
        <Section title="QUOTE">
          {/* Cost breakdown */}
          <div style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
            <CostLine label="Meat" value={quote.totalMeatCost} sub={`${quote.totalRawLb.toFixed(1)} lb @ market`} />
            {quote.sidesCost > 0 && (
              <CostLine
                label="Sides"
                value={quote.sidesCost}
                sub={Object.keys(sidesSelection).length > 0
                  ? Object.keys(sidesSelection).join(', ')
                  : `${guests} × ${fmtUSD(rates.sidesPerPerson)}/person`}
              />
            )}
            {quote.dessertsCost > 0 && (
              <CostLine
                label="Desserts"
                value={quote.dessertsCost}
                sub={Object.keys(dessertsSelection).join(', ')}
              />
            )}
            <CostLine
              label="Labor"
              value={quote.laborCost}
              sub={`${quote.laborHours.toFixed(1)} hr × ${fmtUSD(rates.hourlyRate)}/hr${quote.driveHours > 0 ? ` (incl. ${quote.driveHours.toFixed(1)}h drive)` : ''}`}
            />
            {distanceMiles > 0 && <CostLine label="Mileage" value={quote.mileageCost} sub={`${(distanceMiles * 2).toFixed(0)} mi round trip × ${fmtUSD(rates.mileageRate)}/mi`} />}
            {quote.fuelCost > 0 && <CostLine label="Fuel" value={quote.fuelCost} sub={`${quote.longestCookHours.toFixed(1)} hr × ${fmtUSD(rates.fuelPerHour)}/hr`} />}
            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '8px', paddingTop: '8px' }}>
              <CostLine label="TOTAL COST" value={quote.totalCost} bold />
            </div>
          </div>

          {/* Markup + suggested */}
          <div style={{
            background: 'rgba(212, 166, 74, 0.08)', border: `2px solid ${GOLD}`,
            borderRadius: '12px', padding: '14px', marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px', letterSpacing: '1.5px', color: MUTED }}>SUGGESTED QUOTE</div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '32px', fontWeight: 900, color: GOLD, lineHeight: 1 }}>
                  {fmtUSD0(quote.suggestedQuote)}
                </div>
                <div style={{ fontSize: '12px', color: TEXT, marginTop: '4px' }}>
                  ~{fmtUSD(quote.suggestedQuote / Math.max(1, guests))} per person · markup {quote.markup}×
                </div>
              </div>
            </div>
          </div>

          {/* Overrides */}
          <Field label="LABOR HOURS (override auto-estimate)">
            <input
              type="number" inputMode="decimal" step="0.5"
              value={laborHoursOverride}
              placeholder={`Auto: ${quote.estimatedLaborHours.toFixed(1)} hr`}
              onChange={e => setLaborHoursOverride(e.target.value)}
              style={inputStyle()}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="MARKUP">
              <input
                type="number" inputMode="decimal" step="0.1"
                value={markupOverride}
                placeholder={`Default ${rates.markup}×`}
                onChange={e => setMarkupOverride(e.target.value)}
                style={inputStyle()}
              />
            </Field>
            <Field label="FINAL QUOTE ($)">
              <input
                type="number" inputMode="decimal"
                value={finalQuoteOverride}
                placeholder={`Auto: ${fmtUSD0(quote.suggestedQuote)}`}
                onChange={e => setFinalQuoteOverride(e.target.value)}
                style={inputStyle()}
              />
            </Field>
          </div>

          {finalQuoteOverride !== '' && (
            <div style={{ fontSize: '12px', color: ACCENT_LIGHT, marginTop: '8px', fontStyle: 'italic' }}>
              Final quote: {fmtUSD0(finalTotal)} ({fmtUSD(finalPerPerson)}/person)
            </div>
          )}
        </Section>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button onClick={handleSaveQuote} style={primaryBtn()}>
            {editingQuoteId ? 'UPDATE QUOTE' : 'SAVE QUOTE'}
          </button>
          <button onClick={handleCopy} style={secondaryBtn()}>
            {copyStatus === 'copied' ? '✓ COPIED' : copyStatus === 'failed' ? 'COPY FAILED' : 'COPY TEXT'}
          </button>
          <button onClick={newQuote} style={ghostBtn()}>NEW</button>
        </div>

        {/* Shopping list per quote */}
        <CateringShoppingPanel
          quote={quote}
          guests={guests}
          meats={meats}
          sidesSelection={sidesSelection}
          dessertsSelection={dessertsSelection}
          distanceMiles={distanceMiles}
          items={shoppingItems}
          setItems={setShoppingItems}
          expanded={showCateringShopping}
          onToggle={() => setShowCateringShopping(v => { if (!v) track('catering_shopping_open'); return !v; })}
        />

        {/* Rates panel */}
        <RatesPanel
          rates={rates}
          setRates={persistRates}
          expanded={showRates}
          onToggle={() => setShowRates(v => !v)}
        />

        {/* History */}
        <HistoryPanel
          quotes={quotes}
          expanded={showHistory}
          onToggle={() => setShowHistory(v => !v)}
          onLoad={loadQuoteIntoForm}
          onDelete={deleteQuote}
          editingId={editingQuoteId}
        />

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: '24px', borderTop: `1px solid ${BORDER}`, fontSize: '11px', color: MUTED, letterSpacing: '1px', marginTop: '12px' }}>
          <div>INTERNAL TOOL · NOT PUBLIC · HOLY SMOKES BBQ CO</div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable components ─────────────────────────────────────────

// Pill picker for sides + desserts. Tap a pill to add to the selection
// at default qty + cost. Selected pills expand into editable rows under
// the picker so the operator can tweak per-person quantity or cost.
function MenuPicker({ menu, selection, setSelection }) {
  const items = Object.keys(menu);
  const toggle = (name) => {
    if (selection[name]) {
      const next = { ...selection };
      delete next[name];
      setSelection(next);
      track('catering_menu_remove', { item: name });
    } else {
      const def = menu[name];
      setSelection({ ...selection, [name]: { servings: def.default, costPerPerson: def.costPerPerson } });
      track('catering_menu_add', { item: name });
    }
  };
  const update = (name, patch) => {
    setSelection({ ...selection, [name]: { ...selection[name], ...patch } });
  };
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {items.map(name => (
          <button key={name} onClick={() => toggle(name)} style={pillBtn(!!selection[name])}>
            {name}
          </button>
        ))}
      </div>
      {Object.keys(selection).length > 0 && (
        <div style={{ marginTop: '12px', background: '#111', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px' }}>
          {Object.entries(selection).map(([name, sel]) => {
            const def = menu[name];
            if (!def) return null;
            return (
              <div key={name} style={{ padding: '6px 0', borderBottom: `1px dashed ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: GOLD, fontSize: '13px', fontWeight: 600, minWidth: '120px' }}>{name}</span>
                  <input
                    type="number" inputMode="decimal" step="0.25"
                    value={sel.servings ?? def.default}
                    onChange={e => update(name, { servings: parseFloat(e.target.value) || 0 })}
                    style={{
                      background: '#000', color: TEXT, border: `1px solid ${BORDER}`,
                      borderRadius: '6px', padding: '4px 6px', fontSize: '12px',
                      width: '60px', textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: MUTED }}>{def.unit}/person</span>
                  <span style={{ color: MUTED, fontSize: '11px' }}>·</span>
                  <span style={{ fontSize: '11px', color: MUTED }}>$</span>
                  <input
                    type="number" inputMode="decimal" step="0.25"
                    value={sel.costPerPerson ?? def.costPerPerson}
                    onChange={e => update(name, { costPerPerson: parseFloat(e.target.value) || 0 })}
                    style={{
                      background: '#000', color: TEXT, border: `1px solid ${BORDER}`,
                      borderRadius: '6px', padding: '4px 6px', fontSize: '12px',
                      width: '60px', textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: MUTED }}>/person</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 14px 4px', marginBottom: '12px' }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px', letterSpacing: '2px', color: GOLD, fontWeight: 700, marginBottom: '12px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '10px', letterSpacing: '1.5px', color: MUTED, marginBottom: '6px' }}>{label}</div>
      {children}
    </div>
  );
}

function CostLine({ label, value, sub, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <div>
        <span style={{ color: bold ? GOLD : TEXT, fontWeight: bold ? 700 : 400, fontSize: '13px' }}>{label}</span>
        {sub && <div style={{ fontSize: '11px', color: MUTED, fontStyle: 'italic' }}>{sub}</div>}
      </div>
      <span style={{
        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
        color: bold ? GOLD : ACCENT_LIGHT, fontSize: bold ? '16px' : '13px',
      }}>{fmtUSD(value)}</span>
    </div>
  );
}

// Shopping list panel for the current quote. Auto-generates lines from
// the quote+menu state. User can mark items as purchased, edit item
// names/quantities, delete rows, or add custom rows. The list lives on
// the saved quote, so reloading a quote brings back its shopping state.
function CateringShoppingPanel({ quote, guests, meats, sidesSelection, dessertsSelection, distanceMiles, items, setItems, expanded, onToggle }) {
  // Generate base list from current inputs whenever needed.
  const generatedLines = useMemo(
    () => buildCateringShopping({ quote, guests, meats, sidesSelection, dessertsSelection, distanceMiles }),
    [quote, guests, meats, sidesSelection, dessertsSelection, distanceMiles],
  );

  // Merge: take generated, apply item-level overrides from `items` (which
  // is the saved state). Items not in generated are kept (custom rows).
  const merged = useMemo(() => {
    const itemsById = Object.fromEntries((items || []).map(it => [it.id, it]));
    const seen = new Set();
    const out = [];
    generatedLines.forEach(g => {
      if (g.heading) { out.push(g); return; }
      const saved = itemsById[g.id];
      seen.add(g.id);
      out.push({
        ...g,
        item: saved?.item ?? g.item,
        qty: saved?.qty ?? g.qty,
        sub: saved?.sub ?? g.sub,
        purchased: saved?.purchased ?? false,
      });
    });
    // Custom rows appended (saved with id starting with 'custom:')
    (items || []).forEach(it => {
      if (!seen.has(it.id) && it.id.startsWith('custom:')) {
        out.push({ ...it, _custom: true });
      }
    });
    return out;
  }, [generatedLines, items]);

  const updateItem = (id, patch) => {
    const existing = (items || []).find(it => it.id === id);
    if (existing) {
      setItems(items.map(it => it.id === id ? { ...it, ...patch } : it));
    } else {
      // First customization of a generated row — snapshot it
      const base = merged.find(m => m.id === id);
      if (base) setItems([...(items || []), { id, item: base.item, qty: base.qty, sub: base.sub, purchased: false, ...patch }]);
    }
  };

  const togglePurchased = (id) => {
    const cur = merged.find(m => m.id === id);
    updateItem(id, { purchased: !cur?.purchased });
    track('catering_shopping_item_check', { checked: !cur?.purchased });
  };

  const deleteItem = (id) => {
    setItems((items || []).filter(it => it.id !== id));
  };

  const addCustom = () => {
    const id = `custom:${Date.now().toString(36)}`;
    setItems([...(items || []), { id, item: 'New item', qty: '1', sub: '', purchased: false }]);
  };

  const resetAll = () => {
    if (!window.confirm('Wipe all customizations on this shopping list?')) return;
    setItems([]);
  };

  const purchasedCount = merged.filter(m => !m.heading && m.purchased).length;
  const totalCount = merged.filter(m => !m.heading).length;

  return (
    <div className="printable" style={{
      background: CARD, border: `1px solid ${BORDER}`,
      borderRadius: '14px', padding: '14px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px', letterSpacing: '2px', color: GOLD, fontWeight: 700 }}>
            SHOPPING LIST
          </div>
          <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>
            {totalCount > 0 ? `${purchasedCount} / ${totalCount} items checked off` : 'Auto-built from your quote'}
          </div>
        </div>
        <span style={{ color: GOLD, fontSize: '20px' }}>{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <button onClick={addCustom} style={{
              background: 'transparent', color: ACCENT_LIGHT, border: `1px dashed ${ACCENT}`,
              borderRadius: '8px', padding: '8px 14px',
              fontFamily: "'Oswald', sans-serif", fontSize: '11px',
              letterSpacing: '1.5px', fontWeight: 700, cursor: 'pointer',
            }}>+ ADD ITEM</button>
            <button onClick={resetAll} style={{
              background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`,
              borderRadius: '8px', padding: '8px 14px',
              fontFamily: "'Oswald', sans-serif", fontSize: '11px',
              letterSpacing: '1.5px', fontWeight: 700, cursor: 'pointer',
            }}>RESET</button>
            <button onClick={() => { track('catering_shopping_print'); window.print(); }} style={{
              background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`,
              borderRadius: '8px', padding: '8px 14px',
              fontFamily: "'Oswald', sans-serif", fontSize: '11px',
              letterSpacing: '1.5px', fontWeight: 700, cursor: 'pointer',
            }}>PRINT</button>
          </div>

          <div style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px' }}>
            {merged.map((line, i) => {
              if (line.heading) {
                return (
                  <div key={line.id} style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: '11px',
                    letterSpacing: '2px', color: GOLD, fontWeight: 700,
                    marginTop: i === 0 ? 0 : '14px', marginBottom: '6px',
                    borderBottom: `1px solid ${BORDER}`, paddingBottom: '4px',
                  }}>{line.heading}</div>
                );
              }
              return (
                <CateringShoppingRow
                  key={line.id}
                  line={line}
                  onToggle={() => togglePurchased(line.id)}
                  onItemChange={(v) => updateItem(line.id, { item: v })}
                  onQtyChange={(v) => updateItem(line.id, { qty: v })}
                  onDelete={() => deleteItem(line.id)}
                />
              );
            })}
            {totalCount === 0 && (
              <div style={{ fontSize: '12px', color: MUTED, fontStyle: 'italic', textAlign: 'center', padding: '8px' }}>
                Pick meats above to generate a list.
              </div>
            )}
          </div>

          <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginTop: '10px', fontStyle: 'italic' }}>
            Tap the checkbox to mark items purchased. Tap a row to edit. Customizations save with the quote.
          </div>
        </div>
      )}
    </div>
  );
}

function CateringShoppingRow({ line, onToggle, onItemChange, onQtyChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div style={{ padding: '8px 0', borderBottom: `1px dashed ${BORDER}` }}>
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
      </div>
    );
  }
  return (
    <div style={{ padding: '6px 0', borderBottom: `1px dashed ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onToggle} style={{
          width: '20px', height: '20px',
          background: line.purchased ? ACCENT : 'transparent',
          color: '#fff', border: `1.5px solid ${line.purchased ? ACCENT : BORDER}`,
          borderRadius: '4px', fontSize: '12px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>{line.purchased ? '✓' : ''}</button>
        <div onClick={() => setEditing(true)} style={{ flex: 1, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
            <span style={{
              color: line.purchased ? MUTED : TEXT, fontSize: '13px',
              textDecoration: line.purchased ? 'line-through' : 'none',
            }}>{line.item}</span>
            <span style={{
              fontFamily: "'Oswald', sans-serif", fontWeight: 700,
              color: line.purchased ? MUTED : ACCENT_LIGHT, letterSpacing: '1px', fontSize: '13px',
              whiteSpace: 'nowrap',
              textDecoration: line.purchased ? 'line-through' : 'none',
            }}>{line.qty}</span>
          </div>
          {line.sub && (
            <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px', fontStyle: 'italic' }}>
              {line.sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RatesPanel({ rates, setRates, expanded, onToggle }) {
  const updateMeat = (meat, value) => {
    setRates({ ...rates, meatPricePerLb: { ...rates.meatPricePerLb, [meat]: parseFloat(value) || 0 } });
  };
  const updateField = (field, value) => {
    setRates({ ...rates, [field]: parseFloat(value) || 0 });
  };
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px', letterSpacing: '2px', color: GOLD, fontWeight: 700 }}>
            MY RATES
          </div>
          <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>
            Defaults persist across events · adjust when prices change
          </div>
        </div>
        <span style={{ color: GOLD, fontSize: '20px' }}>{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '10px', letterSpacing: '1.5px', color: MUTED, marginBottom: '6px' }}>MEAT $/LB (RAW)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {Object.keys(MEAT_GUIDE).map(meat => (
              <label key={meat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: TEXT }}>
                <span style={{ minWidth: '110px', color: ACCENT_LIGHT }}>{meat}</span>
                <span style={{ color: MUTED }}>$</span>
                <input
                  type="number" inputMode="decimal" step="0.25"
                  value={rates.meatPricePerLb[meat] ?? ''}
                  onChange={e => updateMeat(meat, e.target.value)}
                  style={{ ...inputStyle(), padding: '6px 8px', fontSize: '13px' }}
                />
              </label>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="HOURLY RATE ($/HR)">
              <input type="number" inputMode="decimal" step="1" value={rates.hourlyRate} onChange={e => updateField('hourlyRate', e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="MILEAGE ($/MI)">
              <input type="number" inputMode="decimal" step="0.05" value={rates.mileageRate} onChange={e => updateField('mileageRate', e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="SIDES ($/PERSON)">
              <input type="number" inputMode="decimal" step="0.25" value={rates.sidesPerPerson} onChange={e => updateField('sidesPerPerson', e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="FUEL ($/COOK HOUR)">
              <input type="number" inputMode="decimal" step="0.25" value={rates.fuelPerHour} onChange={e => updateField('fuelPerHour', e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="DEFAULT MARKUP (×)">
              <input type="number" inputMode="decimal" step="0.1" value={rates.markup} onChange={e => updateField('markup', e.target.value)} style={inputStyle()} />
            </Field>
          </div>
          <button onClick={() => { setRates(DEFAULT_RATES); }} style={{ ...ghostBtn(), marginTop: '6px' }}>RESET TO DEFAULTS</button>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ quotes, expanded, onToggle, onLoad, onDelete, editingId }) {
  const sortedQuotes = [...quotes].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px', letterSpacing: '2px', color: GOLD, fontWeight: 700 }}>
            QUOTE HISTORY <span style={{ color: MUTED, fontWeight: 400 }}>({quotes.length})</span>
          </div>
          <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>
            Tap a quote to reload it
          </div>
        </div>
        <span style={{ color: GOLD, fontSize: '20px' }}>{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: '14px' }}>
          {sortedQuotes.length === 0 ? (
            <div style={{ fontSize: '13px', color: MUTED, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
              No quotes saved yet.
            </div>
          ) : sortedQuotes.map(q => {
            const total = q.pricing?.computed?.finalTotal ?? 0;
            const dateLabel = q.event.date || new Date(q.createdAt).toISOString().slice(0, 10);
            const isEditing = q.id === editingId;
            return (
              <div key={q.id} style={{
                background: isEditing ? 'rgba(212, 166, 74, 0.08)' : '#111',
                border: `1px solid ${isEditing ? GOLD : BORDER}`,
                borderRadius: '10px', padding: '10px 12px', marginBottom: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: TEXT, fontSize: '14px' }}>
                      {q.customer.name || '(no name)'}
                    </div>
                    <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>
                      {dateLabel} · {q.event.type || 'Event'} · {q.event.guests} guests
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: GOLD, fontSize: '15px' }}>
                      {fmtUSD0(total)}
                    </div>
                    <div style={{ fontSize: '10px', color: MUTED }}>~{fmtUSD(total / Math.max(1, q.event.guests))}/pp</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button onClick={() => onLoad(q)} style={smallBtn(ACCENT, '#fff')}>Load</button>
                  <button onClick={() => onDelete(q.id)} style={smallBtn('transparent', RED)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const inputStyle = () => ({
  width: '100%', padding: '10px 12px',
  background: '#111', color: TEXT, border: `1px solid ${BORDER}`,
  borderRadius: '8px', fontSize: '14px', outline: 'none',
});

const miniStepBtn = () => ({
  width: '28px', height: '28px',
  background: '#111', color: GOLD, border: `1px solid ${BORDER}`,
  borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
});

const stepBtn = () => ({
  width: '36px', height: '36px',
  background: '#111', color: GOLD, border: `1px solid ${BORDER}`,
  borderRadius: '8px', fontSize: '18px', fontWeight: 700, cursor: 'pointer',
});

const pillBtn = (active) => ({
  padding: '8px 14px',
  background: active ? GOLD : 'transparent',
  color: active ? '#1a1a1a' : TEXT,
  border: `1px solid ${active ? GOLD : BORDER}`,
  borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
});

const meatPill = (active) => ({
  padding: '8px 14px',
  background: active ? ACCENT : 'transparent',
  color: active ? '#fff' : TEXT,
  border: `1px solid ${active ? ACCENT : BORDER}`,
  borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
});

const primaryBtn = () => ({
  background: GOLD, color: '#1a1a1a', border: 'none',
  borderRadius: '8px', padding: '12px 22px',
  fontFamily: "'Oswald', sans-serif", fontSize: '13px',
  letterSpacing: '2px', fontWeight: 700, cursor: 'pointer',
});

const secondaryBtn = () => ({
  background: ACCENT, color: '#fff', border: 'none',
  borderRadius: '8px', padding: '12px 22px',
  fontFamily: "'Oswald', sans-serif", fontSize: '13px',
  letterSpacing: '2px', fontWeight: 700, cursor: 'pointer',
});

const ghostBtn = () => ({
  background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`,
  borderRadius: '8px', padding: '12px 22px',
  fontFamily: "'Oswald', sans-serif", fontSize: '13px',
  letterSpacing: '2px', fontWeight: 700, cursor: 'pointer',
});

const smallBtn = (bg, color) => ({
  background: bg, color,
  border: bg === 'transparent' ? `1px solid ${color}` : 'none',
  borderRadius: '6px', padding: '6px 12px',
  fontFamily: "'Oswald', sans-serif", fontSize: '11px',
  letterSpacing: '1.5px', fontWeight: 700, cursor: 'pointer',
});
