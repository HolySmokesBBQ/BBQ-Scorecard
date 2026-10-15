import { useAppContext } from '../context/AppContext.jsx';

export default function MVP() {
  const {
    S, setView, viewDetail, meatMvps,
  } = useAppContext();

  return (
    <div className="bbq-container" style={{ padding: '16px' }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '4px' }}>Meat MVP</h2>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '16px' }}>Best restaurant for each meat, ranked by BBQ score</div>

      {meatMvps.length === 0 ? (
        <div style={{ textAlign: 'center', color: S.muted, marginTop: '48px', fontSize: '14px' }}>
          No meat data yet. Start reviewing!
        </div>
      ) : (
        meatMvps.map(({ meat, restaurant, review, score, count }) => (
          <div key={meat}
            onClick={() => viewDetail(review)}
            style={{
              padding: '14px', background: S.card, borderRadius: '8px', marginBottom: '8px',
              border: `1px solid ${S.border}`, cursor: 'pointer', transition: 'all 0.15s',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>
                  Best {meat}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', marginTop: '2px' }}>{restaurant}</div>
                <div style={{ fontSize: '11px', color: S.muted, marginTop: '2px' }}>
                  {review.location}{review.date ? ` · ${review.date}` : ''} · {count} review{count !== 1 ? 's' : ''} with {meat.toLowerCase()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#fbbf24', fontSize: '13px' }}>
                  {'★'.repeat(score.stars)}{'☆'.repeat(5 - score.stars)}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: S.accent }}>
                  {score.bbqAvg.toFixed(2)}
                </div>
                <div style={{ fontSize: '10px', color: S.muted }}>BBQ avg</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
