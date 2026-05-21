import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadLocal, saveLocal, signInGoogle, loadFromDrive, saveToDrive } from './storage.js';

/* ── Constants ── */
const CATEGORIES = {
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

const DESCRIPTORS = {
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

const MEATS = ['Brisket','Smoked Turkey','Sausage','Pulled Pork','Ribs','Chicken','Pork Chop','Burnt Ends'];
const SIDES_LIST = ['Potato Salad','Mac & Cheese','Beans','Rice','Coleslaw','Corn','Green Beans','Bread'];
const SAUCE_DEP_OPTIONS = ['No — meat stood on its own','Helped but not necessary','Yes — meat needed sauce'];
const RETURN_OPTIONS = ['Absolutely','Probably','Maybe','Probably not','No'];

const S = {
  bg: '#1a1a1a', card: '#222', border: '#333', accent: '#d4782f',
  text: '#f5e6d3', muted: '#888', dark: '#111',
};

/* ── Scoring ── */
function calcScores(scores) {
  const bbqKeys = CATEGORIES.bbq.map(c => c.key);
  const famKeys = CATEGORIES.family.map(c => c.key);
  const bbqVals = bbqKeys.map(k => scores[k]).filter(v => v > 0);
  const famVals = famKeys.map(k => scores[k]).filter(v => v > 0);
  const bbqAvg = bbqVals.length ? bbqVals.reduce((a,b) => a+b, 0) / bbqVals.length : 0;
  const famAvg = famVals.length ? famVals.reduce((a,b) => a+b, 0) / famVals.length : 0;
  let bonus = 0;
  if (famAvg >= 8) bonus = 1.25;
  else if (famAvg >= 7) bonus = 1.00;
  else if (famAvg >= 6) bonus = 0.75;
  else if (famAvg >= 5) bonus = 0.50;
  else if (famAvg >= 4) bonus = 0.25;
  const composite = bbqAvg + bonus;
  let stars = 1;
  if (composite >= 5.75) stars = 5;
  else if (composite >= 4.75) stars = 4;
  else if (composite >= 3.75) stars = 3;
  else if (composite >= 2.75) stars = 2;
  return { bbqAvg, famAvg, bonus, composite, stars };
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function emptyReview() {
  return {
    id: genId(), restaurant: '', date: new Date().toISOString().split('T')[0],
    location: '', meats: [], meatOther: '', sides: [], sideOther: '', dessert: '',
    scores: {}, sauceDep: '', wouldReturn: '', notes: '', notesLog: [],
    price: '', priceSplit: '1', trip: '', googleReviewUrl: '', photo: null,
  };
}

/* ── Photo compression ── */
function compressPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── Styles ── */
const sBtn = (active, small) => ({
  padding: small ? '6px 12px' : '10px 16px',
  background: active ? S.accent : S.card,
  color: active ? '#fff' : S.muted,
  border: `1px solid ${active ? S.accent : S.border}`,
  borderRadius: '6px', cursor: 'pointer',
  fontSize: small ? '12px' : '13px', fontWeight: '600',
  transition: 'all 0.15s',
});

const sInput = {
  width: '100%', padding: '10px', background: S.card, border: `1px solid ${S.border}`,
  borderRadius: '6px', color: S.text, fontFamily: 'inherit', fontSize: '14px', boxSizing: 'border-box',
};

const sLabel = {
  display: 'block', fontSize: '11px', color: S.muted, marginBottom: '4px', letterSpacing: '1px',
};

/* ══════════════════════ APP ══════════════════════ */
export default function App() {
  const [reviews, setReviews] = useState([]);
  const [view, setView] = useState('home');
  const [currentReview, setCurrentReview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [sort, setSort] = useState('date');
  const [search, setSearch] = useState('');
  const [tripFilter, setTripFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [dirty, setDirty] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const savedSnapshot = useRef(null);

  useEffect(() => {
    setReviews(loadLocal());
    setLoaded(true);
  }, []);

  // Browser back button support
  useEffect(() => {
    const handler = (e) => {
      if (view !== 'home') {
        e.preventDefault();
        if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) {
          window.history.pushState(null, '', '');
          return;
        }
        setView('home');
        setCurrentReview(null);
        setDirty(false);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [view, dirty]);

  function navigateTo(v) {
    window.history.pushState(null, '', '');
    setView(v);
  }

  const save = useCallback((updated) => {
    setReviews(updated);
    saveLocal(updated);
  }, []);

  const startNew = () => {
    const nr = emptyReview();
    setCurrentReview(nr);
    savedSnapshot.current = JSON.stringify(nr);
    setDirty(false);
    navigateTo('new');
  };

  const editReview = (r) => {
    setCurrentReview({ ...r });
    savedSnapshot.current = JSON.stringify(r);
    setDirty(false);
    navigateTo('edit');
  };

  const viewDetail = (r) => {
    setCurrentReview(r);
    setDirty(false);
    navigateTo('detail');
  };

  const duplicateReview = (r) => {
    const dup = {
      ...r,
      id: genId(),
      date: new Date().toISOString().split('T')[0],
      restaurant: r.restaurant + ' (copy)',
      photo: null,
      notesLog: [],
      notes: '',
    };
    setCurrentReview(dup);
    savedSnapshot.current = JSON.stringify(dup);
    setDirty(false);
    navigateTo('new');
  };

  const update = (key, val) => {
    const updated = { ...currentReview, [key]: val };
    setCurrentReview(updated);
    setDirty(JSON.stringify(updated) !== savedSnapshot.current);
  };

  const updateScore = (key, val) => {
    const scores = { ...currentReview.scores, [key]: val };
    const updated = { ...currentReview, scores };
    setCurrentReview(updated);
    setDirty(JSON.stringify(updated) !== savedSnapshot.current);
  };

  const toggleChip = (key, val) => {
    const arr = currentReview[key] || [];
    const updated = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
    update(key, updated);
  };

  const saveCurrentReview = () => {
    if (!currentReview.restaurant.trim()) return;
    const exists = reviews.find(r => r.id === currentReview.id);
    const updated = exists
      ? reviews.map(r => r.id === currentReview.id ? currentReview : r)
      : [currentReview, ...reviews];
    save(updated);
    setDirty(false);
    setView('home');
    setCurrentReview(null);
  };

  const deleteReview = (id) => {
    if (!window.confirm('Delete this review?')) return;
    save(reviews.filter(r => r.id !== id));
    setView('home');
    setCurrentReview(null);
    setDirty(false);
  };

  const syncToDrive = async () => {
    setSyncStatus('connecting');
    const ok = await signInGoogle();
    if (ok) {
      setSyncStatus('syncing');
      const driveData = await loadFromDrive();
      let latest = reviews;
      if (driveData && Array.isArray(driveData)) {
        const map = new Map();
        for (const r of driveData) map.set(r.id, r);
        for (const r of reviews) map.set(r.id, r);
        latest = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setReviews(latest);
        saveLocal(latest);
      }
      const saved = await saveToDrive(latest);
      setSyncStatus(saved ? 'done' : 'error');
    } else {
      setSyncStatus('error');
    }
    setTimeout(() => setSyncStatus(''), 3000);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressPhoto(file);
    update('photo', compressed);
  };

  const addTimestampedNote = () => {
    if (!currentReview.notes.trim()) return;
    const stamp = new Date().toISOString().split('T')[0];
    const entry = `${stamp}: ${currentReview.notes.trim()}`;
    const log = [...(currentReview.notesLog || []), entry];
    const updated = { ...currentReview, notesLog: log, notes: '' };
    setCurrentReview(updated);
    setDirty(true);
  };

  /* ── Derived data ── */
  const ranked = useMemo(() => {
    let list = [...reviews];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.restaurant.toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q));
    }
    if (tripFilter) list = list.filter(r => r.trip === tripFilter);
    if (cityFilter) list = list.filter(r => r.location === cityFilter);
    if (sort === 'score') list.sort((a, b) => calcScores(b.scores).composite - calcScores(a.scores).composite);
    else list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [reviews, search, tripFilter, cityFilter, sort]);

  // For running rank: rank based on composite score regardless of filter/sort
  const rankMap = useMemo(() => {
    const byScore = [...reviews].sort((a, b) => calcScores(b.scores).composite - calcScores(a.scores).composite);
    const map = {};
    byScore.forEach((r, i) => { map[r.id] = i + 1; });
    return map;
  }, [reviews]);

  const trips = useMemo(() => [...new Set(reviews.map(r => r.trip).filter(Boolean))], [reviews]);
  const cities = useMemo(() => [...new Set(reviews.map(r => r.location).filter(Boolean))], [reviews]);

  const shareReview = (r) => {
    const sc = calcScores(r.scores);
    const text = `${r.restaurant} — ${'★'.repeat(sc.stars)}${'☆'.repeat(5 - sc.stars)} (${sc.composite.toFixed(2)})\n${r.location || ''}${r.wouldReturn ? `\nWould return: ${r.wouldReturn}` : ''}`;
    if (navigator.share) navigator.share({ title: r.restaurant, text });
    else navigator.clipboard?.writeText(text);
  };

  const exportText = (r) => {
    const sc = calcScores(r.scores);
    const lines = [
      `═══ ${r.restaurant} ═══`,
      `Date: ${r.date}  |  Location: ${r.location || 'N/A'}`,
      r.trip ? `Trip: ${r.trip}` : '',
      `Price: $${r.price || '?'}${r.priceSplit > 1 ? ` ($${(r.price / r.priceSplit).toFixed(2)}/person × ${r.priceSplit})` : ''}`,
      '',
      '— BBQ Track —',
      ...CATEGORIES.bbq.map(c => `  ${c.label}: ${r.scores[c.key] || '-'}/9`),
      `  BBQ Average: ${sc.bbqAvg.toFixed(2)}`,
      '',
      '— Family Track —',
      ...CATEGORIES.family.map(c => `  ${c.label}: ${r.scores[c.key] || '-'}/9`),
      `  Family Average: ${sc.famAvg.toFixed(2)}  |  Bonus: +${sc.bonus.toFixed(2)}`,
      '',
      `COMPOSITE: ${sc.composite.toFixed(2)}  |  ${'★'.repeat(sc.stars)}${'☆'.repeat(5 - sc.stars)}`,
      '',
      r.sauceDep ? `Sauce: ${r.sauceDep}` : '',
      r.wouldReturn ? `Return: ${r.wouldReturn}` : '',
      ...(r.notesLog?.length ? ['', '— Notes —', ...r.notesLog] : []),
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(lines);
  };

  if (!loaded) return <div style={{ padding: '40px', textAlign: 'center', color: S.muted }}>Loading...</div>;

  /* ══════════ HOME ══════════ */
  if (view === 'home') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '80px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <img src={`${import.meta.env.BASE_URL}Holy Smokes Logo Final.png`} alt="Holy Smokes" style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '8px' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', fontWeight: '700', letterSpacing: '2px', color: S.accent }}>
            MUILLER & FRIENDS
          </h1>
          <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '3px' }}>BBQ SCORECARD</div>
          <div style={{ fontSize: '10px', color: S.border, marginTop: '2px' }}>v2.1.2</div>
        </div>

        {/* Search */}
        <input type="text" placeholder="Search restaurants..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...sInput, marginBottom: '10px' }} />

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {trips.length > 0 && (
            <select value={tripFilter} onChange={e => setTripFilter(e.target.value)}
              style={{ ...sInput, width: 'auto', flex: 1, fontSize: '12px', padding: '8px' }}>
              <option value="">All Trips</option>
              {trips.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {cities.length > 0 && (
            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              style={{ ...sInput, width: 'auto', flex: 1, fontSize: '12px', padding: '8px' }}>
              <option value="">All Cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* Sort + actions */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['date', 'score'].map(s => (
            <button key={s} onClick={() => setSort(s)} style={sBtn(sort === s, true)}>
              {s === 'date' ? '📅 Date' : '⭐ Score'}
            </button>
          ))}
          <button onClick={() => navigateTo('stats')} style={sBtn(false, true)}>📈 Stats</button>
          <button onClick={() => { setCompareMode(!compareMode); setCompareIds([]); }}
            style={sBtn(compareMode, true)}>
            {compareMode ? '✕ Cancel' : '⚖️ Compare'}
          </button>
        </div>

        {compareMode && (
          <div style={{ padding: '8px', background: S.dark, borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: S.muted }}>
            Tap 2 restaurants to compare. Selected: {compareIds.length}/2
            {compareIds.length === 2 && (
              <button onClick={() => { navigateTo('compare'); }}
                style={{ ...sBtn(true, true), marginLeft: '8px' }}>Go →</button>
            )}
          </div>
        )}

        {/* Review list */}
        {ranked.length === 0 ? (
          <div style={{ textAlign: 'center', color: S.muted, marginTop: '48px', fontSize: '14px' }}>
            No reviews yet.<br />Hit the button and get eating.
          </div>
        ) : (
          ranked.map((r) => {
            const sc = calcScores(r.scores);
            const rank = rankMap[r.id];
            const isSelected = compareIds.includes(r.id);
            return (
              <div key={r.id}
                onClick={() => {
                  if (compareMode) {
                    if (isSelected) setCompareIds(compareIds.filter(id => id !== r.id));
                    else if (compareIds.length < 2) setCompareIds([...compareIds, r.id]);
                    return;
                  }
                  viewDetail(r);
                }}
                style={{
                  padding: '14px', background: isSelected ? '#2a2015' : S.card, borderRadius: '8px',
                  marginBottom: '8px', cursor: 'pointer', border: `1px solid ${isSelected ? S.accent : S.border}`,
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: S.accent, fontWeight: '700', fontFamily: "'Oswald', sans-serif" }}>
                        #{rank}
                      </span>
                      <span style={{ fontWeight: '600', fontSize: '15px' }}>{r.restaurant}</span>
                      {rank === 1 && <span>🥇</span>}
                      {rank === reviews.length && reviews.length > 1 && <span>🔻</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>
                      {r.location || 'No location'}{r.trip ? ` · ${r.trip}` : ''} · {r.date}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: '#fbbf24', fontSize: '14px', letterSpacing: '1px' }}>
                      {'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: S.accent }}>{sc.composite.toFixed(2)}</div>
                    {r.price && (
                      <div style={{ fontSize: '11px', color: S.muted }}>
                        ${r.price}{r.priceSplit > 1 ? ` · $${(r.price / r.priceSplit).toFixed(0)}/ea` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Sync */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button onClick={syncToDrive} disabled={syncStatus === 'syncing' || syncStatus === 'connecting'}
            style={{ ...sBtn(false, true), opacity: syncStatus === 'syncing' ? 0.5 : 1 }}>
            {syncStatus === 'connecting' ? '🔗 Connecting...' : syncStatus === 'syncing' ? '⏳ Syncing...'
              : syncStatus === 'done' ? '✅ Synced!' : syncStatus === 'error' ? '❌ Failed — tap to retry'
              : '↑ Sync to Google Drive'}
          </button>
        </div>

        {/* FAB */}
        <button onClick={startNew} style={{
          position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px',
          borderRadius: '50%', background: S.accent, color: '#fff', border: 'none',
          fontSize: '28px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>
    );
  }

  /* ══════════ STATS ══════════ */
  if (view === 'stats') {
    const allScores = reviews.map(r => calcScores(r.scores));
    const total = reviews.length;
    const avgComposite = total ? allScores.reduce((a, s) => a + s.composite, 0) / total : 0;
    const avgBbq = total ? allScores.reduce((a, s) => a + s.bbqAvg, 0) / total : 0;
    const avgFam = total ? allScores.reduce((a, s) => a + s.famAvg, 0) / total : 0;
    const best = total ? reviews.reduce((a, b) => calcScores(a.scores).composite > calcScores(b.scores).composite ? a : b) : null;
    const worst = total ? reviews.reduce((a, b) => calcScores(a.scores).composite < calcScores(b.scores).composite ? a : b) : null;
    const starDist = [1,2,3,4,5].map(s => allScores.filter(sc => sc.stars === s).length);
    const priced = reviews.filter(r => r.price > 0);
    const avgPrice = priced.length ? priced.reduce((a, r) => a + Number(r.price), 0) / priced.length : 0;
    const pricedPP = priced.filter(r => r.priceSplit > 0);
    const avgPP = pricedPP.length ? pricedPP.reduce((a, r) => a + (Number(r.price) / Number(r.priceSplit)), 0) / pricedPP.length : 0;

    // Category averages
    const allCats = [...CATEGORIES.bbq, ...CATEGORIES.family];
    const catAvgs = allCats.map(c => {
      const vals = reviews.map(r => r.scores[c.key]).filter(v => v > 0);
      return { label: c.label, avg: vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0, count: vals.length };
    });

    const StatRow = ({ label, value }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
        <span style={{ color: S.muted, fontSize: '13px' }}>{label}</span>
        <span style={{ fontWeight: '600', fontSize: '13px' }}>{value}</span>
      </div>
    );

    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>← Back</button>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>STATS DASHBOARD</h2>

        <div style={{ background: S.card, borderRadius: '8px', padding: '16px', marginBottom: '12px', border: `1px solid ${S.border}` }}>
          <StatRow label="Total Reviews" value={total} />
          <StatRow label="Avg Composite" value={avgComposite.toFixed(2)} />
          <StatRow label="Avg BBQ Track" value={avgBbq.toFixed(2)} />
          <StatRow label="Avg Family Track" value={avgFam.toFixed(2)} />
          <StatRow label="Avg Price" value={avgPrice ? `$${avgPrice.toFixed(0)}` : '—'} />
          <StatRow label="Avg Price/Person" value={avgPP ? `$${avgPP.toFixed(0)}` : '—'} />
          {best && <StatRow label="👑 Best" value={`${best.restaurant} (${calcScores(best.scores).composite.toFixed(2)})`} />}
          {worst && total > 1 && <StatRow label="🔻 Worst" value={`${worst.restaurant} (${calcScores(worst.scores).composite.toFixed(2)})`} />}
        </div>

        {/* Star distribution */}
        <div style={{ background: S.card, borderRadius: '8px', padding: '16px', marginBottom: '12px', border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>STAR DISTRIBUTION</div>
          {[5,4,3,2,1].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '24px', fontSize: '12px', color: '#fbbf24' }}>{s}★</span>
              <div style={{ flex: 1, height: '16px', background: S.dark, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${total ? (starDist[s-1] / total) * 100 : 0}%`, height: '100%', background: S.accent, borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
              <span style={{ width: '20px', fontSize: '12px', color: S.muted, textAlign: 'right' }}>{starDist[s-1]}</span>
            </div>
          ))}
        </div>

        {/* Category averages */}
        <div style={{ background: S.card, borderRadius: '8px', padding: '16px', border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>CATEGORY AVERAGES</div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, marginBottom: '6px', letterSpacing: '1px' }}>BBQ TRACK</div>
          {catAvgs.slice(0, 7).map(c => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span style={{ color: S.muted }}>{c.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '60px', height: '6px', background: S.dark, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(c.avg / 9) * 100}%`, height: '100%', background: S.accent, borderRadius: '3px' }} />
                </div>
                <span style={{ fontWeight: '600', width: '32px', textAlign: 'right' }}>{c.avg ? c.avg.toFixed(1) : '—'}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, marginTop: '12px', marginBottom: '6px', letterSpacing: '1px' }}>FAMILY TRACK</div>
          {catAvgs.slice(7).map(c => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span style={{ color: S.muted }}>{c.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '60px', height: '6px', background: S.dark, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(c.avg / 9) * 100}%`, height: '100%', background: S.accent, borderRadius: '3px' }} />
                </div>
                <span style={{ fontWeight: '600', width: '32px', textAlign: 'right' }}>{c.avg ? c.avg.toFixed(1) : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ══════════ COMPARE ══════════ */
  if (view === 'compare') {
    const r1 = reviews.find(r => r.id === compareIds[0]);
    const r2 = reviews.find(r => r.id === compareIds[1]);
    if (!r1 || !r2) { setView('home'); return null; }
    const sc1 = calcScores(r1.scores);
    const sc2 = calcScores(r2.scores);
    const allCats = [...CATEGORIES.bbq, ...CATEGORIES.family];

    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
        <button onClick={() => { setView('home'); setCompareMode(false); setCompareIds([]); }}
          style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>← Back</button>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', letterSpacing: '2px', marginBottom: '16px' }}>SIDE BY SIDE</h2>

        {/* Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[r1, r2].map((r, i) => {
            const sc = i === 0 ? sc1 : sc2;
            return (
              <div key={r.id} style={{ background: S.card, borderRadius: '8px', padding: '12px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
                {r.photo && <img src={r.photo} alt="" style={{ width: '100%', borderRadius: '6px', marginBottom: '8px', maxHeight: '120px', objectFit: 'cover' }} />}
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{r.restaurant}</div>
                <div style={{ color: '#fbbf24', fontSize: '13px' }}>{'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}</div>
                <div style={{ color: S.accent, fontWeight: '700', fontSize: '16px' }}>{sc.composite.toFixed(2)}</div>
                <div style={{ fontSize: '11px', color: S.muted }}>{r.location}</div>
              </div>
            );
          })}
        </div>

        {/* Category comparison */}
        {allCats.map(c => {
          const v1 = r1.scores[c.key] || 0;
          const v2 = r2.scores[c.key] || 0;
          const winner = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
          return (
            <div key={c.key} style={{ marginBottom: '6px', background: S.card, borderRadius: '6px', padding: '10px', border: `1px solid ${S.border}` }}>
              <div style={{ textAlign: 'center', fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>{c.label.toUpperCase()}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', color: winner === 1 ? '#4ade80' : winner === 2 ? '#f87171' : S.text }}>
                  {v1 || '—'}
                </div>
                <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', color: winner === 2 ? '#4ade80' : winner === 1 ? '#f87171' : S.text }}>
                  {v2 || '—'}
                </div>
              </div>
            </div>
          );
        })}

        {/* Summary row */}
        <div style={{ marginTop: '8px', background: S.dark, borderRadius: '6px', padding: '12px', border: `1px solid ${S.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: S.muted }}>BBQ Track</div>
              <div style={{ fontWeight: '700', color: sc1.bbqAvg >= sc2.bbqAvg ? '#4ade80' : '#f87171' }}>{sc1.bbqAvg.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: S.muted }}>BBQ Track</div>
              <div style={{ fontWeight: '700', color: sc2.bbqAvg >= sc1.bbqAvg ? '#4ade80' : '#f87171' }}>{sc2.bbqAvg.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center', marginTop: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', color: S.muted }}>Family Bonus</div>
              <div style={{ fontWeight: '600' }}>+{sc1.bonus.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: S.muted }}>Family Bonus</div>
              <div style={{ fontWeight: '600' }}>+{sc2.bonus.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════ DETAIL ══════════ */
  if (view === 'detail' && currentReview) {
    const r = currentReview;
    const sc = calcScores(r.scores);
    const allCats = [...CATEGORIES.bbq, ...CATEGORIES.family];
    const orderParts = [
      ...(r.meats || []), r.meatOther, ...(r.sides || []), r.sideOther, r.dessert ? `Dessert: ${r.dessert}` : '',
    ].filter(Boolean);

    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
        <button onClick={() => { setView('home'); setCurrentReview(null); }}
          style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>← Back</button>

        {/* Photo */}
        {r.photo && (
          <img src={r.photo} alt="Food" style={{ width: '100%', borderRadius: '8px', marginBottom: '12px', maxHeight: '250px', objectFit: 'cover' }} />
        )}

        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', marginBottom: '4px' }}>{r.restaurant}</h2>
        <div style={{ fontSize: '13px', color: S.muted, marginBottom: '4px' }}>
          {r.location}{r.trip ? ` · ${r.trip}` : ''} · {r.date}
        </div>
        {r.price && (
          <div style={{ fontSize: '13px', color: S.muted, marginBottom: '8px' }}>
            ${r.price} total{r.priceSplit > 1 ? ` · $${(Number(r.price) / Number(r.priceSplit)).toFixed(2)}/person (${r.priceSplit} people)` : ''}
          </div>
        )}

        {/* Score banner */}
        <div style={{ background: S.dark, borderRadius: '8px', padding: '16px', marginBottom: '16px', textAlign: 'center', border: `1px solid ${S.border}` }}>
          <div style={{ color: '#fbbf24', fontSize: '20px', letterSpacing: '2px' }}>{'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>{sc.composite.toFixed(2)}</div>
          <div style={{ fontSize: '12px', color: S.muted }}>
            BBQ {sc.bbqAvg.toFixed(2)} + Family Bonus {sc.bonus.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: S.muted, marginTop: '2px' }}>Rank #{rankMap[r.id]} of {reviews.length}</div>
        </div>

        {/* Order */}
        {orderParts.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ ...sLabel }}>ORDERED</div>
            <div style={{ fontSize: '13px', color: S.text }}>{orderParts.join(', ')}</div>
          </div>
        )}

        {/* Category scores with descriptors */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ ...sLabel, marginBottom: '8px' }}>BBQ TRACK</div>
          {CATEGORIES.bbq.map(c => {
            const v = r.scores[c.key];
            return (
              <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${S.border}` }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</div>
                  {v > 0 && DESCRIPTORS[c.key]?.[v] && (
                    <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic' }}>{DESCRIPTORS[c.key][v]}</div>
                  )}
                </div>
                <span style={{ fontWeight: '700', fontSize: '15px', color: v >= 7 ? '#4ade80' : v >= 5 ? S.text : v > 0 ? '#f87171' : S.muted }}>
                  {v || '—'}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ ...sLabel, marginBottom: '8px' }}>FAMILY TRACK</div>
          {CATEGORIES.family.map(c => {
            const v = r.scores[c.key];
            return (
              <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${S.border}` }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</div>
                  {v > 0 && DESCRIPTORS[c.key]?.[v] && (
                    <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic' }}>{DESCRIPTORS[c.key][v]}</div>
                  )}
                </div>
                <span style={{ fontWeight: '700', fontSize: '15px', color: v >= 7 ? '#4ade80' : v >= 5 ? S.text : v > 0 ? '#f87171' : S.muted }}>
                  {v || '—'}
                </span>
              </div>
            );
          })}
        </div>

        {r.sauceDep && <div style={{ fontSize: '13px', color: S.muted, marginBottom: '4px' }}>Sauce: {r.sauceDep}</div>}
        {r.wouldReturn && <div style={{ fontSize: '13px', color: S.muted, marginBottom: '8px' }}>Would return: {r.wouldReturn}</div>}
        {r.googleReviewUrl && (
          <a href={r.googleReviewUrl} target="_blank" rel="noopener" style={{ fontSize: '12px', color: S.accent, display: 'block', marginBottom: '8px' }}>
            View Google Review →
          </a>
        )}

        {/* Notes log */}
        {(r.notesLog?.length > 0 || r.notes) && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ ...sLabel }}>NOTES</div>
            {r.notesLog?.map((n, i) => (
              <div key={i} style={{ fontSize: '13px', color: S.text, padding: '4px 0', borderBottom: `1px solid ${S.border}` }}>{n}</div>
            ))}
            {r.notes && !r.notesLog?.length && <div style={{ fontSize: '13px', color: S.text }}>{r.notes}</div>}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button onClick={() => editReview(r)} style={sBtn(true, false)}>✏️ Edit</button>
          <button onClick={() => duplicateReview(r)} style={sBtn(false, false)}>📋 Duplicate</button>
          <button onClick={() => shareReview(r)} style={sBtn(false, false)}>📤 Share</button>
          <button onClick={() => exportText(r)} style={sBtn(false, false)}>📝 Export</button>
          <button onClick={() => deleteReview(r.id)} style={{ ...sBtn(false, false), color: '#f87171', borderColor: '#f87171' }}>🗑 Delete</button>
        </div>
      </div>
    );
  }

  /* ══════════ NEW / EDIT ══════════ */
  if ((view === 'new' || view === 'edit') && currentReview) {
    const sc = calcScores(currentReview.scores);

    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '100px' }}>
        <button onClick={() => {
          if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
          setView('home'); setCurrentReview(null); setDirty(false);
        }} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>
          ← Back
        </button>

        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>
          {view === 'new' ? 'NEW REVIEW' : 'EDIT REVIEW'}
        </h2>

        {/* Info Fields */}
        <div style={{ marginBottom: '20px' }}>
          {/* Restaurant */}
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel}>RESTAURANT</label>
            <input type="text" value={currentReview.restaurant} onChange={e => update('restaurant', e.target.value)} placeholder="Name" style={sInput} />
          </div>

          {/* Date — native picker */}
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel}>DATE</label>
            <input type="date" value={currentReview.date} onChange={e => update('date', e.target.value)} style={sInput} />
          </div>

          {/* Location */}
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel}>LOCATION</label>
            <input type="text" value={currentReview.location} onChange={e => update('location', e.target.value)} placeholder="City, State" style={sInput} />
          </div>

          {/* Trip */}
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel}>TRIP</label>
            <input type="text" value={currentReview.trip || ''} onChange={e => update('trip', e.target.value)} placeholder="e.g. San Antonio 2026" style={sInput}
              list="trip-suggestions" />
            {trips.length > 0 && (
              <datalist id="trip-suggestions">
                {trips.map(t => <option key={t} value={t} />)}
              </datalist>
            )}
          </div>

          {/* Price + Split */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div style={{ flex: 2 }}>
              <label style={sLabel}>PRICE ($)</label>
              <input type="number" inputMode="decimal" value={currentReview.price || ''} onChange={e => update('price', e.target.value)} placeholder="Total" style={sInput} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={sLabel}>SPLIT</label>
              <input type="number" inputMode="numeric" value={currentReview.priceSplit || '1'} onChange={e => update('priceSplit', e.target.value)} min="1" style={sInput} />
            </div>
            {currentReview.price > 0 && currentReview.priceSplit > 1 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: S.accent, fontWeight: '600' }}>
                  ${(Number(currentReview.price) / Number(currentReview.priceSplit)).toFixed(2)}/ea
                </span>
              </div>
            )}
          </div>

          {/* Photo */}
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel}>PHOTO</label>
            {currentReview.photo ? (
              <div style={{ position: 'relative' }}>
                <img src={currentReview.photo} alt="Food" style={{ width: '100%', borderRadius: '6px', maxHeight: '200px', objectFit: 'cover' }} />
                <button onClick={() => update('photo', null)}
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ ...sBtn(false, false), flex: 1 }}>📷 Camera</button>
                <button onClick={() => galleryInputRef.current?.click()}
                  style={{ ...sBtn(false, false), flex: 1 }}>🖼️ Gallery</button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
          </div>

          {/* Google Review URL */}
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel}>GOOGLE REVIEW URL</label>
            <input type="url" value={currentReview.googleReviewUrl || ''} onChange={e => update('googleReviewUrl', e.target.value)} placeholder="https://..." style={sInput} />
          </div>
        </div>

        {/* Meats */}
        <div style={{ marginBottom: '16px' }}>
          <label style={sLabel}>MEATS ORDERED</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            {MEATS.map(m => (
              <button key={m} onClick={() => toggleChip('meats', m)}
                style={sBtn((currentReview.meats || []).includes(m), true)}>{m}</button>
            ))}
          </div>
          <input type="text" value={currentReview.meatOther || ''} onChange={e => update('meatOther', e.target.value)} placeholder="Other meat..." style={{ ...sInput, fontSize: '12px' }} />
        </div>

        {/* Sides */}
        <div style={{ marginBottom: '16px' }}>
          <label style={sLabel}>SIDES ORDERED</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            {SIDES_LIST.map(s => (
              <button key={s} onClick={() => toggleChip('sides', s)}
                style={sBtn((currentReview.sides || []).includes(s), true)}>{s}</button>
            ))}
          </div>
          <input type="text" value={currentReview.sideOther || ''} onChange={e => update('sideOther', e.target.value)} placeholder="Other side..." style={{ ...sInput, fontSize: '12px' }} />
        </div>

        {/* Dessert */}
        <div style={{ marginBottom: '20px' }}>
          <label style={sLabel}>DESSERT</label>
          <input type="text" value={currentReview.dessert || ''} onChange={e => update('dessert', e.target.value)} placeholder="What'd you have?" style={sInput} />
        </div>

        {/* BBQ Scoring */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: S.accent, marginBottom: '12px' }}>BBQ QUALITY TRACK</div>
          {CATEGORIES.bbq.map(c => (
            <div key={c.key} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: S.accent }}>{currentReview.scores[c.key] || '—'}</span>
              </div>
              {currentReview.scores[c.key] > 0 && DESCRIPTORS[c.key]?.[currentReview.scores[c.key]] && (
                <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic', marginBottom: '6px' }}>
                  {DESCRIPTORS[c.key][currentReview.scores[c.key]]}
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => updateScore(c.key, n)} style={{
                    flex: 1, padding: '8px 0', background: currentReview.scores[c.key] === n ? S.accent : S.dark,
                    color: currentReview.scores[c.key] === n ? '#fff' : S.muted,
                    border: `1px solid ${currentReview.scores[c.key] === n ? S.accent : S.border}`,
                    borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Family Scoring */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: S.accent, marginBottom: '12px' }}>FAMILY EXPERIENCE TRACK</div>
          {CATEGORIES.family.map(c => (
            <div key={c.key} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: S.accent }}>{currentReview.scores[c.key] || '—'}</span>
              </div>
              {currentReview.scores[c.key] > 0 && DESCRIPTORS[c.key]?.[currentReview.scores[c.key]] && (
                <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic', marginBottom: '6px' }}>
                  {DESCRIPTORS[c.key][currentReview.scores[c.key]]}
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => updateScore(c.key, n)} style={{
                    flex: 1, padding: '8px 0', background: currentReview.scores[c.key] === n ? S.accent : S.dark,
                    color: currentReview.scores[c.key] === n ? '#fff' : S.muted,
                    border: `1px solid ${currentReview.scores[c.key] === n ? S.accent : S.border}`,
                    borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Live score */}
        <div style={{ background: S.dark, borderRadius: '8px', padding: '14px', marginBottom: '16px', textAlign: 'center', border: `1px solid ${S.border}` }}>
          <div style={{ color: '#fbbf24', fontSize: '18px' }}>{'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>{sc.composite.toFixed(2)}</div>
          <div style={{ fontSize: '11px', color: S.muted }}>BBQ {sc.bbqAvg.toFixed(2)} + Bonus {sc.bonus.toFixed(2)}</div>
        </div>

        {/* Sauce dependency */}
        <div style={{ marginBottom: '16px' }}>
          <label style={sLabel}>SAUCE DEPENDENCY</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {SAUCE_DEP_OPTIONS.map(opt => (
              <button key={opt} onClick={() => update('sauceDep', opt)}
                style={sBtn(currentReview.sauceDep === opt, true)}>{opt}</button>
            ))}
          </div>
        </div>

        {/* Would return */}
        <div style={{ marginBottom: '16px' }}>
          <label style={sLabel}>WOULD WE RETURN?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {RETURN_OPTIONS.map(opt => (
              <button key={opt} onClick={() => update('wouldReturn', opt)}
                style={sBtn(currentReview.wouldReturn === opt, true)}>{opt}</button>
            ))}
          </div>
        </div>

        {/* Notes with timestamp */}
        <div style={{ marginBottom: '20px' }}>
          <label style={sLabel}>NOTES</label>
          {(currentReview.notesLog || []).length > 0 && (
            <div style={{ marginBottom: '8px', background: S.dark, borderRadius: '6px', padding: '10px' }}>
              {currentReview.notesLog.map((n, i) => (
                <div key={i} style={{ fontSize: '12px', color: S.text, padding: '3px 0', borderBottom: i < currentReview.notesLog.length - 1 ? `1px solid ${S.border}` : 'none' }}>{n}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <textarea value={currentReview.notes || ''} onChange={e => update('notes', e.target.value)}
              placeholder="Add a note..." rows={2}
              style={{ ...sInput, resize: 'vertical', flex: 1 }} />
            <button onClick={addTimestampedNote} disabled={!currentReview.notes?.trim()}
              style={{ ...sBtn(!!currentReview.notes?.trim(), true), alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
              + Add
            </button>
          </div>
        </div>

        {/* Save */}
        <button onClick={saveCurrentReview} disabled={!currentReview.restaurant.trim()}
          style={{
            width: '100%', padding: '14px', fontFamily: "'Oswald', sans-serif", fontSize: '16px',
            fontWeight: '700', letterSpacing: '1px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: currentReview.restaurant.trim() ? S.accent : '#333',
            color: currentReview.restaurant.trim() ? '#fff' : '#666',
          }}>SAVE REVIEW</button>
      </div>
    );
  }

  return null;
}
