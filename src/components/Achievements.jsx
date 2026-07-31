import { useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { calcScores, track } from '../scoring.js';
import { ACHIEVEMENTS, achievementsByCategory, computeAchievements } from '../achievements.js';

// Achievements view — earned badges + progress toward the next ones.
// Reads reviews from context, computes earned set in one pass, renders
// grouped by category. Earned badges are highlighted in brand colors;
// unearned show as grayed-out with a progress bar (when applicable) so
// the user sees how close they are.

export default function Achievements() {
  const { S, reviews, setView } = useAppContext();

  const { earned, progress } = useMemo(
    () => computeAchievements(reviews, calcScores),
    [reviews]
  );

  useEffect(() => {
    track('achievements_viewed', { earned_count: earned.size, total: ACHIEVEMENTS.length });
  }, [earned.size]);

  const groups = achievementsByCategory();
  const earnedCount = earned.size;
  const totalCount = ACHIEVEMENTS.length;
  const pct = totalCount ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <div className="bbq-container" style={{ padding: '16px' }}>

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px',
        letterSpacing: '2px', marginBottom: '4px' }}>Achievements</h2>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '16px' }}>
        {earnedCount} of {totalCount} earned · {pct}% complete
      </div>

      {/* Overall progress bar */}
      <div style={{ height: '8px', background: S.dark, borderRadius: '4px',
        overflow: 'hidden', marginBottom: '20px', border: `1px solid ${S.border}` }}>
        <div style={{ width: `${pct}%`, height: '100%',
          background: S.accent, transition: 'width 0.3s' }} />
      </div>

      {Object.entries(groups).map(([category, list]) => (
        <div key={category} style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px',
            fontWeight: '600', letterSpacing: '2px', color: S.muted,
            marginBottom: '10px' }}>{category.toUpperCase()}</div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {list.map((a) => {
              const isEarned = earned.has(a.id);
              const prog = progress.get(a.id);
              return (
                <div key={a.id} style={{
                  background: isEarned ? S.card : 'transparent',
                  border: `1px solid ${isEarned ? S.accent : S.border}`,
                  borderLeft: `4px solid ${isEarned ? S.accent : S.border}`,
                  borderRadius: '8px',
                  padding: '12px 14px',
                  opacity: isEarned ? 1 : 0.55,
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: isEarned ? S.accent : S.dark,
                    color: isEarned ? '#fff' : S.muted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: a.glyph.length > 2 ? '10px' : '14px',
                    letterSpacing: '0.5px',
                    flexShrink: 0,
                  }}>
                    {a.glyph}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700',
                      color: isEarned ? S.text : S.muted,
                      marginBottom: '2px' }}>
                      {a.name}
                    </div>
                    <div style={{ fontSize: '12px', color: S.muted, lineHeight: 1.35 }}>
                      {a.desc}
                    </div>

                    {!isEarned && prog && (
                      <div style={{ marginTop: '6px', display: 'flex',
                        alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px',
                          background: S.dark, borderRadius: '2px',
                          overflow: 'hidden' }}>
                          <div style={{
                            width: `${(prog.current / prog.target) * 100}%`,
                            height: '100%', background: S.muted,
                          }} />
                        </div>
                        <span style={{ fontSize: '11px', color: S.muted,
                          fontFamily: "'Oswald', sans-serif",
                          fontWeight: '600' }}>
                          {prog.current}/{prog.target}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
