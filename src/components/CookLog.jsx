import { useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { SAMPLE_COOK } from '../sampleData.js';
import { track } from '../scoring.js';

export default function CookLog() {
  const { S, sBtn, sInput, navigateTo } = useAppContext();
  const {
    rankedCooks, cooks,
    cookSearch, setCookSearch,
    cookMeatFilter, setCookMeatFilter,
    cookTagFilter, setCookTagFilter,
    cookSort, setCookSort,
    viewCookDetail, startNewCook, deleteCook,
    uniqueMeatTypes, uniqueTags,
  } = useCookContext();

  const meatTypes = [...new Set(cooks.map(c => c.meatType).filter(Boolean))];
  const tags = uniqueTags;

  // Long-press handler for delete
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const startLongPress = useCallback((callback) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      callback();
    }, 600);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  return (
    <>
      {/* Search */}
      <input type="text" placeholder="Search cooks..." value={cookSearch} onChange={e => setCookSearch(e.target.value)}
        style={{ ...sInput(), marginBottom: '10px' }} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {meatTypes.length > 0 && (
          <select value={cookMeatFilter} onChange={e => setCookMeatFilter(e.target.value)}
            style={{ ...sInput(), width: 'auto', flex: 1, fontSize: '12px', padding: '8px' }}>
            <option value="">All Meats</option>
            {meatTypes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {tags.length > 0 && (
          <select value={cookTagFilter} onChange={e => setCookTagFilter(e.target.value)}
            style={{ ...sInput(), width: 'auto', flex: 1, fontSize: '12px', padding: '8px' }}>
            <option value="">All Tags</option>
            {tags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Sort + actions */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {['date', 'rating'].map(s => (
          <button key={s} onClick={() => setCookSort(s)} style={sBtn(cookSort === s, true)}>
            {s === 'date' ? 'Date' : 'Rating'}
          </button>
        ))}
        <button onClick={() => navigateTo('recipes')} style={sBtn(false, true)}>Recipes</button>
      </div>

      {/* Cook list.
          Empty-state + example show ONLY when the user has zero real cooks.
          Once they log one, the example disappears permanently — even if a
          filter currently matches nothing (we show a "no matches" hint in
          that case instead of falling back to the example). */}
      {cooks.length === 0 ? (
        <div style={{ marginTop: '32px' }}>
          <div style={{ textAlign: 'center', background: S.card, borderRadius: '12px', padding: '32px 20px', border: `1px solid ${S.border}`, marginBottom: '16px' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: '700', letterSpacing: '2px', color: '#4A6741', marginBottom: '8px' }}>
              No Cooks Yet
            </div>
            <div style={{ fontSize: '13px', color: S.muted, marginBottom: '20px', lineHeight: '1.6' }}>
              Log your first cook and start tracking what works.
            </div>
            <button onClick={() => { track('new_cook_started', { source: 'empty_state' }); startNewCook(); }} style={{ ...sBtn(true, false), padding: '12px 32px', fontSize: '15px', fontWeight: '600', background: '#4A6741', borderColor: '#4A6741' }}>
              Log a Cook
            </button>
          </div>

          {/* Example cook */}
          <div>
            <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '8px', textAlign: 'center' }}>
              EXAMPLE COOK LOG — TAP TO SEE HOW IT WORKS
            </div>
            <div onClick={() => viewCookDetail(SAMPLE_COOK)}
              style={{ padding: '14px', background: S.dark, borderRadius: '8px', cursor: 'pointer',
                border: `1px dashed ${S.border}`, opacity: 0.85 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', color: '#4A6741', background: S.card, padding: '2px 6px', borderRadius: '4px', fontWeight: '700', letterSpacing: '0.5px' }}>EXAMPLE</span>
                    <span style={{ fontWeight: '600', fontSize: '15px' }}>{SAMPLE_COOK.name}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>
                    {SAMPLE_COOK.meatType} - {SAMPLE_COOK.cut} · {SAMPLE_COOK.date}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {SAMPLE_COOK.tags.map(t => (
                      <span key={t} style={{ fontSize: '10px', color: '#4A6741', background: S.card, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${S.border}` }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#4A6741', fontFamily: "'Oswald', sans-serif" }}>
                    {SAMPLE_COOK.rating}/9
                  </div>
                  <div style={{ fontSize: '11px', color: S.muted }}>{SAMPLE_COOK.weight} lbs</div>
                </div>
              </div>
              {SAMPLE_COOK.whatIdChange && (
                <div style={{ fontSize: '11px', color: S.muted, marginTop: '6px', fontStyle: 'italic', borderTop: `1px solid ${S.border}`, paddingTop: '6px' }}>
                  Next time: {SAMPLE_COOK.whatIdChange.slice(0, 80)}...
                </div>
              )}
            </div>
          </div>
        </div>
      ) : rankedCooks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: S.muted, fontSize: '13px' }}>
          No cooks match your filters.
          {(cookSearch || cookMeatFilter || cookTagFilter) && (
            <div style={{ marginTop: '12px' }}>
              <button onClick={() => { setCookSearch(''); setCookMeatFilter(''); setCookTagFilter(''); }}
                style={sBtn(false, true)}>Clear filters</button>
            </div>
          )}
        </div>
      ) : (
        <div className="bbq-review-grid">
          {rankedCooks.map((c) => (
            <div key={c.id}
              onClick={() => { if (longPressTriggered.current) return; viewCookDetail(c); }}
              onTouchStart={() => startLongPress(() => deleteCook(c.id))}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onContextMenu={(e) => { e.preventDefault(); deleteCook(c.id); }}
              style={{
                padding: '14px', background: S.card, borderRadius: '8px',
                marginBottom: '8px', cursor: 'pointer', border: `1px solid ${S.border}`,
                transition: 'all 0.15s', WebkitTouchCallout: 'none', userSelect: 'none',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>
                    {c.meatType || 'No meat type'}{c.cut ? ` - ${c.cut}` : ''} · {c.date}
                  </div>
                  {(c.tags || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {c.tags.map(t => (
                        <span key={t} style={{ fontSize: '10px', color: S.accent, background: S.dark, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${S.border}` }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {c.rating > 0 && (
                    <>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
                        {c.rating}/9
                      </div>
                    </>
                  )}
                  {c.weight && (
                    <div style={{ fontSize: '11px', color: S.muted }}>{c.weight} lbs</div>
                  )}
                </div>
              </div>
              {c.whatIdChange && (
                <div style={{ fontSize: '11px', color: S.muted, marginTop: '6px', fontStyle: 'italic', borderTop: `1px solid ${S.border}`, paddingTop: '6px' }}>
                  Next time: {c.whatIdChange.length > 80 ? c.whatIdChange.slice(0, 80) + '...' : c.whatIdChange}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
