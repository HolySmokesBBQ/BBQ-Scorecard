import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { CATEGORIES } from '../constants.js';
import { calcScores, track } from '../scoring.js';

export default function Stats() {
  const {
    S, setView, reviews,
  } = useAppContext();

  useEffect(() => { track('stats_viewed', { reviews: reviews.length }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="bbq-container" style={{ padding: '16px' }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>Stats Dashboard</h2>

      <div style={{ background: S.card, borderRadius: '8px', padding: '16px', marginBottom: '12px', border: `1px solid ${S.border}` }}>
        <StatRow label="Total Reviews" value={total} />
        <StatRow label="Avg Composite" value={avgComposite.toFixed(2)} />
        <StatRow label="Avg BBQ Track" value={avgBbq.toFixed(2)} />
        <StatRow label="Avg Family Track" value={avgFam.toFixed(2)} />
        <StatRow label="Avg Price" value={avgPrice ? `$${avgPrice.toFixed(0)}` : '—'} />
        <StatRow label="Avg Price/Person" value={avgPP ? `$${avgPP.toFixed(0)}` : '—'} />
        {best && <StatRow label="Best" value={`${best.restaurant} (${calcScores(best.scores).composite.toFixed(2)})`} />}
        {worst && total > 1 && <StatRow label="Worst" value={`${worst.restaurant} (${calcScores(worst.scores).composite.toFixed(2)})`} />}
      </div>

      {/* Star distribution */}
      <div style={{ background: S.card, borderRadius: '8px', padding: '16px', marginBottom: '12px', border: `1px solid ${S.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Star Distribution</div>
        {[5,4,3,2,1].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ width: '24px', fontSize: '12px', color: '#fbbf24' }}>{s}{'★'}</span>
            <div style={{ flex: 1, height: '16px', background: S.dark, borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${total ? (starDist[s-1] / total) * 100 : 0}%`, height: '100%', background: S.accent, borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ width: '20px', fontSize: '12px', color: S.muted, textAlign: 'right' }}>{starDist[s-1]}</span>
          </div>
        ))}
      </div>

      {/* Category averages */}
      <div style={{ background: S.card, borderRadius: '8px', padding: '16px', border: `1px solid ${S.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Category Averages</div>
        <div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, marginBottom: '6px', letterSpacing: '1px' }}>BBQ Track</div>
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
        <div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, marginTop: '12px', marginBottom: '6px', letterSpacing: '1px' }}>Family Track</div>
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
