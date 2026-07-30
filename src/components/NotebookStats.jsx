import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { track } from '../scoring.js';

// Cook-side stats — the Notebook's gamification surface. Reads from
// CookContext's local + cloud-merged cook/recipe arrays. Excludes
// _isExample seeds so the numbers reflect what the user actually did,
// not the sample friend cooks visible in Cook Compare.

const ACCENT = '#4A6741';
const ACCENT_LIGHT = '#7a9670';
const GOLD = '#d4a64a';

export default function NotebookStats() {
  const { S, sBtn, setView, fbFriends } = useAppContext();
  const { cooks, recipes, viewCookDetail } = useCookContext();

  const stats = useMemo(() => computeStats(cooks, recipes), [cooks, recipes]);
  const [exportMsg, setExportMsg] = useState('');

  const exportCooks = async () => {
    const { exportAllCooksToCsv } = await import('../cookCsv.js');
    const n = exportAllCooksToCsv(cooks.filter(c => !c._isExample));
    setExportMsg(`Exported ${n} cooks to CSV.`);
    setTimeout(() => setExportMsg(''), 3000);
    track('cooks_csv_exported', { count: n });
  };
  const exportRecipes = async () => {
    const { exportAllRecipesToCsv } = await import('../cookCsv.js');
    const n = exportAllRecipesToCsv(recipes);
    setExportMsg(`Exported ${n} recipes to CSV.`);
    setTimeout(() => setExportMsg(''), 3000);
    track('recipes_csv_exported', { count: n });
  };

  return (
    <div className="bbq-container" style={{ padding: '16px', paddingBottom: '64px' }}>
      <button onClick={() => setView('home')}
        style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '14px',
          cursor: 'pointer', marginBottom: '16px' }}>Back</button>

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px',
        letterSpacing: '2px', marginBottom: '4px', color: ACCENT }}>Stats</h2>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '24px' }}>
        Your cook log, by the numbers
      </div>

      {stats.cookCount === 0 ? (
        <EmptyState S={S} setView={setView} />
      ) : (
        <>
          {/* Hero — total smoking time */}
          <div style={{
            background: S.card, border: `2px solid ${ACCENT}`,
            borderRadius: '14px', padding: '24px', marginBottom: '16px',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontSize: '12px',
              letterSpacing: '3px', color: S.muted, marginBottom: '8px',
            }}>TOTAL SMOKING TIME</div>
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontSize: '48px',
              fontWeight: '900', color: ACCENT_LIGHT, letterSpacing: '1px',
              lineHeight: 1,
            }}>{stats.totalTimeDisplay}</div>
            <div style={{ fontSize: '12px', color: S.muted, marginTop: '8px' }}>
              across {stats.cookCount} cook{stats.cookCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Counters row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px', marginBottom: '16px',
          }}>
            <StatChip label="Cooks"   value={stats.cookCount}   S={S} />
            <StatChip label="Recipes" value={stats.recipeCount} S={S} />
            <StatChip label="Friends" value={fbFriends.length}  S={S} />
          </div>

          {/* Best cook */}
          {stats.bestCook && (
            <FeatureCard label="Best Rated Cook" S={S}>
              <div onClick={() => viewCookDetail(stats.bestCook)}
                style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: '36px',
                    fontWeight: '900', color: GOLD, lineHeight: 1,
                  }}>{stats.bestCook.rating}<span style={{ fontSize: '14px', color: S.muted }}>/9</span></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: S.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stats.bestCook.name || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>
                      {stats.bestCook.meatType || ''}{stats.bestCook.date ? ` · ${stats.bestCook.date}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </FeatureCard>
          )}

          {/* Longest smoke */}
          {stats.longestSmoke && (
            <FeatureCard label="Longest Smoke" S={S}>
              <div onClick={() => viewCookDetail(stats.longestSmoke.cook)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  fontFamily: "'Oswald', sans-serif", fontSize: '32px',
                  fontWeight: '900', color: ACCENT_LIGHT, lineHeight: 1,
                }}>{stats.longestSmoke.display}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: S.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stats.longestSmoke.cook.name || 'Untitled'}
                  </div>
                  <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>
                    {stats.longestSmoke.cook.meatType || ''}{stats.longestSmoke.cook.date ? ` · ${stats.longestSmoke.cook.date}` : ''}
                  </div>
                </div>
              </div>
            </FeatureCard>
          )}

          {/* Averages */}
          <FeatureCard label="Averages" S={S}>
            <AverageRow label="Cook temp"  value={stats.avgCookTemp     ? `${Math.round(stats.avgCookTemp)}°F` : '—'} S={S} />
            <AverageRow label="Finish temp" value={stats.avgFinishTemp   ? `${Math.round(stats.avgFinishTemp)}°F` : '—'} S={S} />
            <AverageRow label="Rest time"  value={stats.avgRest          ? `${Math.round(stats.avgRest)} min` : '—'} S={S} />
            <AverageRow label="Rating"     value={stats.avgRating         ? `${stats.avgRating.toFixed(1)}/9` : '—'} S={S} last />
          </FeatureCard>

          {/* Favorites */}
          <FeatureCard label="Favorites" S={S}>
            <AverageRow label="Most-used rub"  value={stats.favoriteRub  ? `${stats.favoriteRub.name} (${stats.favoriteRub.count})` : '—'} S={S} />
            <AverageRow label="Most-used wood" value={stats.favoriteWood ? `${stats.favoriteWood.name} (${stats.favoriteWood.count})` : '—'} S={S} />
            <AverageRow label="Most cooked"    value={stats.favoriteMeat ? `${stats.favoriteMeat.name} (${stats.favoriteMeat.count})` : '—'} S={S} last />
          </FeatureCard>

          {/* Meat breakdown */}
          {stats.meatBreakdown.length > 0 && (
            <FeatureCard label="Meat Breakdown" S={S}>
              {stats.meatBreakdown.map(([meat, count], i) => (
                <div key={meat} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < stats.meatBreakdown.length - 1 ? `1px solid ${S.border}` : 'none',
                }}>
                  <span style={{ fontSize: '14px', color: S.text }}>{meat}</span>
                  <span style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: '18px',
                    fontWeight: '700', color: ACCENT_LIGHT,
                  }}>{count}</span>
                </div>
              ))}
            </FeatureCard>
          )}
        </>
      )}

      {/* Bulk export — sits at the bottom of Stats because that's where users
          come when they want to see/manage their data holistically. */}
      <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: `1px solid ${S.border}` }}>
        <div style={{
          fontFamily: "'Oswald', sans-serif", fontSize: '13px',
          letterSpacing: '2px', color: ACCENT_LIGHT, marginBottom: '10px',
        }}>EXPORT YOUR DATA</div>
        <div style={{ fontSize: '12px', color: S.muted, marginBottom: '12px' }}>
          Download every cook or recipe as a CSV — open in Sheets/Excel for backup or analysis. Photos aren&rsquo;t embedded; use a cook&rsquo;s Export PDF button to include those.
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={exportCooks} disabled={!cooks.length}
            style={{ ...sBtn(!!cooks.length, true), flex: '1 1 140px' }}>Export cooks CSV</button>
          <button onClick={exportRecipes} disabled={!recipes.length}
            style={{ ...sBtn(!!recipes.length, true), flex: '1 1 140px' }}>Export recipes CSV</button>
        </div>
        {exportMsg && (
          <div style={{
            marginTop: '10px', padding: '8px 12px',
            background: '#1f3d24', border: `1px solid ${ACCENT}`,
            borderRadius: '6px', fontSize: '12px', color: '#cce6ce',
          }}>{exportMsg}</div>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, S }) {
  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderRadius: '10px', padding: '14px 8px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: '28px',
        fontWeight: '700', color: ACCENT_LIGHT, lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: '10px', color: S.muted, letterSpacing: '1.5px', marginTop: '6px' }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

function FeatureCard({ label, S, children }) {
  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderRadius: '12px', padding: '16px', marginBottom: '12px',
    }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: '11px',
        letterSpacing: '2px', color: ACCENT, marginBottom: '10px',
      }}>{label.toUpperCase()}</div>
      {children}
    </div>
  );
}

function AverageRow({ label, value, S, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: last ? 'none' : `1px solid ${S.border}`,
    }}>
      <span style={{ fontSize: '13px', color: S.muted, letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '14px', color: S.text, fontWeight: '600' }}>{value}</span>
    </div>
  );
}

function EmptyState({ S, setView }) {
  return (
    <div style={{
      textAlign: 'center', background: S.card, borderRadius: '12px',
      padding: '40px 24px', border: `1px solid ${S.border}`,
    }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: '16px',
        fontWeight: '700', letterSpacing: '2px', color: ACCENT, marginBottom: '8px',
      }}>NO COOKS LOGGED YET</div>
      <div style={{ fontSize: '13px', color: S.muted, marginBottom: '20px', lineHeight: 1.6 }}>
        Log a few cooks and your smoking history will show up here — total time,
        longest smoke, favorite rubs and woods, meat breakdown, and your
        best-rated cook.
      </div>
      <button onClick={() => setView('home')} style={{
        background: ACCENT, color: '#fff', border: 'none',
        padding: '12px 28px', borderRadius: '8px',
        fontFamily: "'Oswald', sans-serif", fontSize: '14px',
        fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
      }}>Back to Home</button>
    </div>
  );
}

// ── Stat computation ────────────────────────────────────────────

function computeStats(cooks, recipes) {
  // Exclude _isExample seed data — only the user's real cooks count.
  const myCooks = cooks.filter(c => !c._isExample);
  const myRecipes = recipes.filter(r => !r._isExample);

  const cookCount = myCooks.length;
  const recipeCount = myRecipes.length;

  // Total smoking time in minutes
  const totalMinutes = myCooks.reduce((sum, c) => {
    const h = parseFloat(c.cookTimeHours) || 0;
    const m = parseFloat(c.cookTimeMinutes) || 0;
    return sum + h * 60 + m;
  }, 0);

  // Longest smoke — track both minutes and the cook itself for the card
  const longestSmoke = myCooks.reduce((best, c) => {
    const h = parseFloat(c.cookTimeHours) || 0;
    const m = parseFloat(c.cookTimeMinutes) || 0;
    const total = h * 60 + m;
    if (total === 0) return best;
    if (!best || total > best.minutes) return { minutes: total, cook: c, display: formatHHMM(total) };
    return best;
  }, null);

  // Best-rated cook (highest rating, ties broken by most recent date)
  const ratedCooks = myCooks.filter(c => c.rating > 0);
  const bestCook = ratedCooks.length > 0
    ? ratedCooks.reduce((best, c) => {
        if (c.rating > best.rating) return c;
        if (c.rating === best.rating && (c.date || '').localeCompare(best.date || '') > 0) return c;
        return best;
      })
    : null;

  // Average rating across rated cooks
  const avgRating = ratedCooks.length > 0
    ? ratedCooks.reduce((sum, c) => sum + c.rating, 0) / ratedCooks.length
    : 0;

  // Average cook temp / finish temp / rest
  const avgCookTemp   = avgNumeric(myCooks, 'cookTemp');
  const avgFinishTemp = avgNumeric(myCooks, 'targetInternalTemp');
  const avgRest       = avgNumeric(myCooks, 'restTime');

  // Favorite rub — recipe IDs map to recipe names; free-form rubs use the string itself
  const rubUses = {};
  myCooks.forEach(c => {
    if (c.rubRecipeId) {
      rubUses[`recipe:${c.rubRecipeId}`] = (rubUses[`recipe:${c.rubRecipeId}`] || 0) + 1;
    } else if (c.rub && c.rub.trim()) {
      rubUses[`text:${c.rub.trim()}`] = (rubUses[`text:${c.rub.trim()}`] || 0) + 1;
    }
  });
  const favoriteRubEntry = Object.entries(rubUses).sort((a, b) => b[1] - a[1])[0];
  const favoriteRub = favoriteRubEntry ? {
    name: resolveRubName(favoriteRubEntry[0], myRecipes),
    count: favoriteRubEntry[1],
  } : null;

  // Favorite wood — flatten the woodType arrays
  const woodUses = {};
  myCooks.forEach(c => {
    const list = Array.isArray(c.woodType) ? c.woodType : (c.woodType ? [c.woodType] : []);
    list.forEach(w => {
      if (w) woodUses[w] = (woodUses[w] || 0) + 1;
    });
  });
  const favoriteWoodEntry = Object.entries(woodUses).sort((a, b) => b[1] - a[1])[0];
  const favoriteWood = favoriteWoodEntry ? {
    name: favoriteWoodEntry[0],
    count: favoriteWoodEntry[1],
  } : null;

  // Meat breakdown — sorted by count desc
  const meatCounts = {};
  myCooks.forEach(c => {
    if (c.meatType) meatCounts[c.meatType] = (meatCounts[c.meatType] || 0) + 1;
  });
  const meatBreakdown = Object.entries(meatCounts).sort((a, b) => b[1] - a[1]);
  const favoriteMeat = meatBreakdown.length > 0 ? {
    name: meatBreakdown[0][0],
    count: meatBreakdown[0][1],
  } : null;

  return {
    cookCount, recipeCount,
    totalMinutes,
    totalTimeDisplay: formatTotalTime(totalMinutes),
    longestSmoke,
    bestCook,
    avgRating, avgCookTemp, avgFinishTemp, avgRest,
    favoriteRub, favoriteWood, favoriteMeat,
    meatBreakdown,
  };
}

function avgNumeric(cooks, field) {
  const values = cooks.map(c => parseFloat(c[field])).filter(v => !isNaN(v) && v > 0);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function resolveRubName(key, recipes) {
  if (key.startsWith('recipe:')) {
    const id = key.slice(7);
    const r = recipes.find(rec => rec.id === id);
    return r ? r.name : 'Saved rub';
  }
  return key.slice(5); // strip "text:" prefix
}

function formatHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// "53d 4h" / "12h 30m" / "45m" — readable at a glance
function formatTotalTime(totalMinutes) {
  if (totalMinutes <= 0) return '0m';
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.round(totalMinutes % 60);
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (totalHours > 0) {
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }
  return `${minutes}m`;
}
