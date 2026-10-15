import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { computeRewards, tierVisual, OVERALL_LADDER } from '../rewards.js';

// Rewards screen — three sections stacked top to bottom:
//   1. Overall ladder with progress bar to next tier
//   2. Per-meat tier cards, ordered by cook count desc
//   3. Behavioral achievements grid (unlocked + locked)

const ACCENT = '#4A6741';
const ACCENT_LIGHT = '#7a9670';
const GOLD = '#d4a64a';

export default function NotebookRewards() {
  const { S, setView, fbFriends } = useAppContext();
  const { cooks, recipes } = useCookContext();

  const ctx = useMemo(() => ({
    recipes,
    friendCount: fbFriends?.length || 0,
    compareViews: readCounter('bbq-compare-views'),
    shareCount: readCounter('bbq-share-count'),
  }), [recipes, fbFriends]);

  const rewards = useMemo(() => computeRewards(cooks, ctx), [cooks, ctx]);

  return (
    <div className="bbq-container" style={{ padding: '16px', paddingBottom: '64px' }}>
      <button onClick={() => setView('home')}
        style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '14px',
          cursor: 'pointer', marginBottom: '16px' }}>← Back</button>

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px',
        letterSpacing: '2px', marginBottom: '4px', color: ACCENT }}>Rewards</h2>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '20px' }}>
        Tiers you've earned by smoking your way through the cook log
      </div>

      <OverallSection S={S} overall={rewards.overall} />
      <PerMeatSection S={S} perMeat={rewards.perMeat} />
      <BehavioralSection S={S} behavioral={rewards.behavioral} />
    </div>
  );
}

function OverallSection({ S, overall }) {
  const { count, earned, next } = overall;
  const visualIdx = earned ? OVERALL_LADDER.findIndex(t => t.id === earned.id) : -1;
  const v = visualIdx >= 0 ? tierVisual(visualIdx, OVERALL_LADDER.length) : null;
  const progress = next ? Math.min(100, (count / next.min) * 100) : 100;

  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderRadius: '12px', padding: '18px', marginBottom: '24px',
    }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px',
        letterSpacing: '2px', color: ACCENT, marginBottom: '12px' }}>OVERALL PATH</div>

      {earned ? (
        <TierBadge label={earned.title} sublabel={`${count} cook${count === 1 ? '' : 's'} total`} v={v} size="large" />
      ) : (
        <div style={{ fontSize: '14px', color: S.muted, padding: '12px 0' }}>
          Log your first cook to start the path.
        </div>
      )}

      {next && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '6px' }}>
            <span>NEXT: {next.title.toUpperCase()}</span>
            <span>{count} / {next.min}</span>
          </div>
          <div style={{ height: '6px', background: S.dark, borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: ACCENT_LIGHT, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

function PerMeatSection({ S, perMeat }) {
  if (!perMeat.length) {
    return null;
  }
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px',
        letterSpacing: '2px', color: ACCENT, marginBottom: '12px' }}>BY MEAT</div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {perMeat.map(m => {
          const idx = m.earned ? m.ladder.findIndex(t => t.id === m.earned.id) : -1;
          const v = idx >= 0 ? tierVisual(idx, m.ladder.length) : null;
          return (
            <div key={m.meatType} style={{
              background: S.card, border: `1px solid ${S.border}`,
              borderRadius: '10px', padding: '14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: S.text }}>{m.meatType}</div>
                <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px' }}>
                  {m.count} cook{m.count === 1 ? '' : 's'}
                </div>
              </div>
              {m.earned ? (
                <TierBadge label={m.earned.title} v={v} size="small" />
              ) : (
                <div style={{ fontSize: '12px', color: S.muted }}>
                  {m.ladder[0].min - m.count} more to unlock <em>{m.ladder[0].title}</em>
                </div>
              )}
              {m.next && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: S.muted, letterSpacing: '1px' }}>
                  {m.next.min - m.count} until <strong style={{ color: ACCENT_LIGHT }}>{m.next.title}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BehavioralSection({ S, behavioral }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '11px',
        letterSpacing: '2px', color: ACCENT, marginBottom: '12px' }}>ACHIEVEMENTS</div>
      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {behavioral.map(b => (
          <div key={b.id} style={{
            background: b.unlocked ? '#1f2a1a' : S.card,
            border: `1px solid ${b.unlocked ? ACCENT : S.border}`,
            opacity: b.unlocked ? 1 : 0.55,
            borderRadius: '10px', padding: '12px',
          }}>
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontSize: '12px',
              letterSpacing: '1px', fontWeight: '700',
              color: b.unlocked ? GOLD : S.muted, marginBottom: '4px',
            }}>{b.unlocked ? '✓ ' : ''}{b.title.toUpperCase()}</div>
            <div style={{ fontSize: '11px', color: S.muted, lineHeight: 1.4 }}>{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TierBadge({ label, sublabel, v, size = 'small' }) {
  const big = size === 'large';
  const baseStyle = {
    display: 'inline-block',
    padding: big ? '12px 16px' : '8px 12px',
    borderRadius: '8px',
    background: v?.bg || '#1a2419',
    border: `2px solid ${v?.ring || ACCENT}`,
    boxShadow: v?.glow && v.glow !== 'transparent'
      ? `0 0 14px ${v.glow}, inset 0 0 8px ${v.glow}`
      : 'none',
  };
  return (
    <div style={baseStyle}>
      <div style={{
        fontFamily: "'Oswald', sans-serif",
        fontSize: big ? '20px' : '14px',
        fontWeight: '700', letterSpacing: '1.5px',
        color: v?.kind === 'gold' ? '#f5e6d3' : v?.kind === 'bronze' ? '#f5d6b0' : '#e0e8d8',
      }}>{label}</div>
      {sublabel && (
        <div style={{
          fontSize: '11px', color: '#aaa', marginTop: '4px', letterSpacing: '1px',
        }}>{sublabel}</div>
      )}
    </div>
  );
}

function readCounter(key) {
  try {
    const v = parseInt(localStorage.getItem(key) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
