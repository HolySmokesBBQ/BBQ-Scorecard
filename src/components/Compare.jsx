import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { CATEGORIES } from '../constants.js';
import { calcScores, track } from '../scoring.js';

export default function Compare() {
  const {
    S, setView, reviews, compareIds, setCompareMode, setCompareIds,
  } = useAppContext();

  const r1 = reviews.find(r => r.id === compareIds[0]);
  const r2 = reviews.find(r => r.id === compareIds[1]);
  // Fire once per pairing — tells us which restaurants get compared.
  useEffect(() => {
    if (r1 && r2) track('compare_restaurants', { restaurant_a: r1.restaurant || '', restaurant_b: r2.restaurant || '' });
  }, [r1?.id, r2?.id]);
  if (!r1 || !r2) { setView('home'); return null; }
  const sc1 = calcScores(r1.scores);
  const sc2 = calcScores(r2.scores);
  const allCats = [...CATEGORIES.bbq, ...CATEGORIES.family];

  // Sort toggle: original order vs. sorted by absolute score gap.
  // "By gap" bubbles the categories where the two restaurants actually
  // disagree to the top — the interesting rows for comparison shopping.
  const [sortByGap, setSortByGap] = useState(false);
  const orderedCats = sortByGap
    ? [...allCats].sort((a, b) => {
        const gapA = Math.abs((r1.scores[a.key] || 0) - (r2.scores[a.key] || 0));
        const gapB = Math.abs((r1.scores[b.key] || 0) - (r2.scores[b.key] || 0));
        return gapB - gapA;
      })
    : allCats;

  return (
    <div className="bbq-container" style={{ padding: '16px' }}>
      <button onClick={() => { setView('home'); setCompareMode(false); setCompareIds([]); }}
        style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', letterSpacing: '2px', marginBottom: '16px' }}>Side by Side</h2>

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

      {/* Sort toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button onClick={() => {
          const next = !sortByGap;
          setSortByGap(next);
          if (next) track('compare_sort_by_gap');
        }} style={{
          background: sortByGap ? S.accent : 'transparent',
          color: sortByGap ? '#fff' : S.muted,
          border: `1px solid ${sortByGap ? S.accent : S.border}`,
          borderRadius: '999px',
          padding: '5px 12px',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '1px',
          cursor: 'pointer',
        }}>
          {sortByGap ? 'BY GAP ✓' : 'SORT BY GAP'}
        </button>
      </div>

      {/* Category comparison */}
      {orderedCats.map(c => {
        const v1 = r1.scores[c.key] || 0;
        const v2 = r2.scores[c.key] || 0;
        const winner = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
        const gap = Math.abs(v1 - v2);
        // Highlight the row's background when the gap is large — makes
        // the interesting rows visually pop even without sort mode on.
        const rowBg = gap >= 3 ? `${S.accent}18` : S.card;
        return (
          <div key={c.key} style={{ marginBottom: '6px', background: rowBg, borderRadius: '6px', padding: '10px', border: `1px solid ${gap >= 3 ? S.accent : S.border}` }}>
            <div style={{ textAlign: 'center', fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>
              {c.label.toUpperCase()}
              {gap >= 3 && <span style={{ color: S.accent, marginLeft: '6px' }}>· gap {gap}</span>}
            </div>
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
