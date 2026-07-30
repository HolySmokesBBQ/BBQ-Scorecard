import { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { SAMPLE_FRIEND_COOKS } from '../sampleData.js';

// Cook Compare — the Notebook's leaderboard equivalent.
//
// Two views in one screen, switched by the meat-type filter pill row:
//
//   • Pill "All" selected (default) → RECENCY FEED
//       Your cooks plus your friends' shared cooks, newest first. Tap
//       any to drill into detail. Answers "what's everyone been smoking
//       lately."
//
//   • Pill <meat type> selected → BRACKET LAYOUT
//       Your last N cooks of that meat alongside your friends' last
//       cooks of the same meat, as side-by-side cards comparing rub /
//       wood / cook temp / finish temp / rest / weather / outcome.
//       Answers "what did Brian do differently on his brisket."
//
// Friend cook sync via Firestore lands in v2.1 — until then, the
// SAMPLE_FRIEND_COOKS in sampleData.js stand in so the layout reads as
// designed. Each example friend cook is rendered with a clear EXAMPLE
// badge so there's no confusion about which cooks are real.

const ACCENT = '#4A6741';
const ACCENT_DARK = '#3a5234';
const GOLD = '#d4a64a';

export default function NotebookLeaderboard() {
  const { S, sBtn, setView, fbFriends } = useAppContext();
  const { cooks, viewCookDetail, friendCooks } = useCookContext();

  const [meatFilter, setMeatFilter] = useState('');

  // Merge order: your real cooks + real friend cooks (resolved against
  // the friend list for display names) + example seed friend cooks ONLY
  // when there are zero real shared friend cooks. The examples keep the
  // bracket non-empty for users whose friends haven't shared yet — they
  // step aside the moment a real shared cook lands.
  const allCooks = useMemo(() => {
    const tagged = cooks.map(c => ({ ...c, userName: 'You' }));
    const friendsById = Object.fromEntries((fbFriends || []).map(f => [f.id, f]));
    const realFriendTagged = (friendCooks || []).map(c => ({
      ...c,
      userName: friendsById[c.userId]?.displayName || 'Friend',
    }));
    if (realFriendTagged.length > 0) {
      return [...tagged, ...realFriendTagged];
    }
    return [...tagged, ...SAMPLE_FRIEND_COOKS];
  }, [cooks, friendCooks, fbFriends]);

  // Pill row pulls from EVERY cook (yours + examples) so brisket shows
  // even if you've only got pork shoulders logged so far.
  const cookedMeats = [...new Set(allCooks.map(c => c.meatType).filter(Boolean))].sort();

  const sortedAll = [...allCooks].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const cooksOfMeat = sortedAll
    .filter(c => c.meatType === meatFilter)
    .slice(0, 6);

  return (
    <div className="bbq-container" style={{ padding: '16px' }}>
      <button onClick={() => setView('home')}
        style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '14px',
          cursor: 'pointer', marginBottom: '16px' }}>Back</button>

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px',
        letterSpacing: '2px', marginBottom: '4px', color: ACCENT }}>Cook Compare</h2>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '20px' }}>
        {meatFilter
          ? `${cooksOfMeat.length} ${meatFilter.toLowerCase()} cook${cooksOfMeat.length !== 1 ? 's' : ''} from you and friends, side by side`
          : 'Latest cooks from you and friends — tap a meat to compare them head-to-head'}
      </div>

      {/* Filter pill row */}
      {cookedMeats.length > 0 && (
        <div style={{
          display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px',
          marginBottom: '16px', WebkitOverflowScrolling: 'touch',
        }}>
          <FilterPill label="All" active={meatFilter === ''} onClick={() => setMeatFilter('')} S={S} />
          {cookedMeats.map(m => (
            <FilterPill key={m} label={m} active={meatFilter === m} onClick={() => setMeatFilter(m)} S={S} />
          ))}
        </div>
      )}

      {/* Body */}
      {allCooks.length === 0 ? (
        <EmptyCooks S={S} />
      ) : meatFilter === '' ? (
        <RecencyFeed cooks={sortedAll} S={S} onView={viewCookDetail} />
      ) : (
        <BracketView cooks={cooksOfMeat} meatType={meatFilter} S={S} onView={viewCookDetail} />
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick, S }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0,
      background: active ? ACCENT : S.card,
      color: active ? '#fff' : S.text,
      border: `1px solid ${active ? ACCENT : S.border}`,
      borderRadius: '999px', padding: '6px 14px',
      fontFamily: "'Oswald', sans-serif", fontSize: '13px',
      letterSpacing: '1px', fontWeight: '600',
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{label.toUpperCase()}</button>
  );
}

function RecencyFeed({ cooks, S, onView }) {
  return (
    <div>
      {cooks.map(c => {
        const isExample = c._isExample;
        const accentBar = isExample ? GOLD : ACCENT;
        return (
          <div key={c.id} onClick={() => onView(c)}
            style={{
              background: S.card, border: `1px solid ${isExample ? GOLD : S.border}`,
              borderRadius: '10px', padding: '12px 14px',
              marginBottom: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
            <div style={{
              width: '6px', borderRadius: '4px',
              background: accentBar, alignSelf: 'stretch', minHeight: '40px',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {isExample && (
                  <span style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: '9px',
                    fontWeight: '700', letterSpacing: '1.5px',
                    color: '#1a1a1a', background: GOLD,
                    padding: '2px 6px', borderRadius: '3px',
                  }}>EXAMPLE</span>
                )}
                <div style={{
                  fontWeight: '600', fontSize: '15px', color: S.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>{c.name || `Untitled cook`}</div>
              </div>
              <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>
                {c.userName || 'You'}{c.meatType ? ` · ${c.meatType}` : ''} · {c.date || 'no date'}
              </div>
            </div>
            {c.rating > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: "'Oswald', sans-serif", fontSize: '20px',
                  fontWeight: '700', color: ACCENT,
                }}>{c.rating}<span style={{ fontSize: '12px', color: S.muted }}>/9</span></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BracketView({ cooks, meatType, S, onView }) {
  if (cooks.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: S.muted, padding: '32px 12px' }}>
        No {meatType.toLowerCase()} cooks logged yet.
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px',
      WebkitOverflowScrolling: 'touch',
    }}>
      {cooks.map((c, idx) => (
        <BracketCard key={c.id} cook={c} rank={idx} S={S} onView={onView} />
      ))}
    </div>
  );
}

function BracketCard({ cook, rank, S, onView }) {
  const isExample = cook._isExample;
  const fields = [
    ['Date',         cook.date || '—'],
    ['Rub',          cook.rub || '—'],
    ['Wood',         Array.isArray(cook.woodType) ? cook.woodType.join(' + ') : (cook.woodType || '—')],
    ['Smoker',       cook.smokerType || '—'],
    ['Cook temp',    cook.cookTemp ? `${cook.cookTemp}°F` : '—'],
    ['Wrap',         cook.wrapMethod || '—'],
    ['Finish temp',  cook.targetInternalTemp ? `${cook.targetInternalTemp}°F` : '—'],
    ['Rest',         cook.restTime ? `${cook.restTime} min` : '—'],
    ['Weather',      cook.weatherTemp ? `${cook.weatherTemp}°F${cook.weatherHumidity ? ` · ${cook.weatherHumidity}%` : ''}` : '—'],
    ['Rating',       cook.rating > 0 ? `${cook.rating}/9` : '—'],
  ];
  const borderColor = isExample ? GOLD : (rank === 0 ? ACCENT : S.border);
  return (
    <div onClick={() => onView(cook)}
      style={{
        flexShrink: 0, width: '260px',
        background: S.card, border: `1px solid ${borderColor}`,
        borderRadius: '12px', padding: '14px',
        cursor: 'pointer',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
        {isExample && (
          <span style={{
            fontFamily: "'Oswald', sans-serif", fontSize: '10px',
            letterSpacing: '1.5px', fontWeight: '700',
            color: '#1a1a1a', background: GOLD,
            padding: '3px 8px', borderRadius: '4px',
          }}>EXAMPLE</span>
        )}
        <span style={{
          fontFamily: "'Oswald', sans-serif", fontSize: '11px',
          letterSpacing: '1px', fontWeight: '600', color: S.muted,
        }}>{cook.userName || 'You'}</span>
      </div>
      <div style={{
        fontWeight: '700', fontSize: '15px', color: S.text, marginBottom: '10px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{cook.name || 'Untitled'}</div>
      {fields.map(([k, v]) => (
        <div key={k} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '5px 0', borderBottom: `1px solid ${S.border}`,
          fontSize: '12px',
        }}>
          <span style={{ color: S.muted, letterSpacing: '0.5px' }}>{k}</span>
          <span style={{
            color: S.text, fontWeight: '600', textAlign: 'right',
            maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyCooks({ S }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: '16px',
        fontWeight: '700', letterSpacing: '2px', color: ACCENT, marginBottom: '8px',
      }}>No cooks to compare yet</div>
      <div style={{ fontSize: '13px', color: S.muted, lineHeight: 1.6 }}>
        Log a few cooks from the home screen first. Once you have two or
        more of the same meat, the bracket layout shows them side by side.
      </div>
    </div>
  );
}
