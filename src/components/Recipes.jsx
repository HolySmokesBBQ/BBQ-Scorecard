import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { RECIPE_TYPE_LABELS } from '../constants.js';

const TYPE_LABELS = RECIPE_TYPE_LABELS;

export default function Recipes() {
  const { S, sBtn, sInput, setView, fbUser } = useAppContext();
  const {
    filteredRecipes, recipeTypeFilter, setRecipeTypeFilter,
    recipeSearch, setRecipeSearch,
    startNewRecipe, viewRecipeDetail, cooksUsingRecipe,
    savedNotice, setSavedNotice,
    syncWithCloud, cookSyncStatus,
  } = useCookContext();

  // Auto-dismiss the save banner after ~3.5s so it doesn't linger across
  // subsequent navigation. Tap-anywhere dismiss is handled inline below.
  useEffect(() => {
    if (!savedNotice) return;
    const t = setTimeout(() => setSavedNotice(''), 3500);
    return () => clearTimeout(t);
  }, [savedNotice, setSavedNotice]);

  return (
    <div className="bbq-container" style={{ padding: '16px', paddingBottom: '80px' }}>
      <button onClick={() => setView('home')}
        style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>
        Back
      </button>

      {savedNotice && (
        <div onClick={() => setSavedNotice('')}
          style={{
            background: '#1f3d24', border: '1px solid #4A6741', color: '#cce6ce',
            padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
          <span>{savedNotice}</span>
          <span style={{ fontSize: '16px', opacity: 0.7 }}>×</span>
        </div>
      )}

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>
        Recipes
      </h2>

      {/* Search */}
      <input
        type="text"
        value={recipeSearch}
        onChange={e => setRecipeSearch(e.target.value)}
        placeholder="Search recipes by name, ingredient, or prep…"
        style={{ ...sInput(), width: '100%', marginBottom: '10px' }}
      />

      {/* Type filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {['all', 'rub', 'sauce', 'side', 'dessert', 'fullCook'].map(t => (
          <button key={t} onClick={() => setRecipeTypeFilter(t)} style={sBtn(recipeTypeFilter === t, true)}>
            {t === 'all' ? 'All' : TYPE_LABELS[t] + 's'}
          </button>
        ))}
      </div>

      {/* New recipe buttons */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => startNewRecipe('rub')}     style={{ ...sBtn(false, true), flex: '1 1 80px' }}>+ Rub</button>
        <button onClick={() => startNewRecipe('sauce')}   style={{ ...sBtn(false, true), flex: '1 1 80px' }}>+ Sauce</button>
        <button onClick={() => startNewRecipe('side')}    style={{ ...sBtn(false, true), flex: '1 1 80px' }}>+ Side</button>
        <button onClick={() => startNewRecipe('dessert')} style={{ ...sBtn(false, true), flex: '1 1 80px' }}>+ Dessert</button>
        <button onClick={() => startNewRecipe('fullCook')} style={{ ...sBtn(false, true), flex: '1 1 80px' }}>+ Full Cook</button>
      </div>

      {/* Cloud sync — only visible when signed in. Recipes + cooks both
          sync in the same call so users don't have to think about which. */}
      {fbUser && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => syncWithCloud(fbUser.uid)}
            disabled={cookSyncStatus === 'syncing'}
            style={{
              ...sBtn(cookSyncStatus === 'done', true),
              width: '100%',
              opacity: cookSyncStatus === 'syncing' ? 0.6 : 1,
            }}>
            {cookSyncStatus === 'syncing' ? 'Syncing…'
              : cookSyncStatus === 'done' ? 'Synced ✓'
              : cookSyncStatus === 'error' ? 'Retry sync'
              : 'Sync to cloud'}
          </button>
        </div>
      )}

      {/* Recipe list */}
      {filteredRecipes.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <div style={{ background: S.card, borderRadius: '12px', padding: '32px 20px', border: `1px solid ${S.border}` }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: '700', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>
              No Recipes Yet
            </div>
            <div style={{ fontSize: '13px', color: S.muted, marginBottom: '20px', lineHeight: '1.6' }}>
              Save your rubs, sauces, and full cook blueprints.
            </div>
          </div>
        </div>
      ) : (
        <div className="bbq-review-grid">
          {filteredRecipes.map(r => {
            const cookCount = cooksUsingRecipe(r.id).length;
            return (
              <div key={r.id}
                onClick={() => viewRecipeDetail(r)}
                style={{
                  padding: '14px', background: S.card, borderRadius: '8px',
                  marginBottom: '8px', cursor: 'pointer', border: `1px solid ${S.border}`,
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: S.accent, fontWeight: '700', padding: '2px 6px',
                        background: S.dark, borderRadius: '4px', letterSpacing: '0.5px', border: `1px solid ${S.border}` }}>
                        {TYPE_LABELS[r.type]}
                      </span>
                      <span style={{ fontWeight: '600', fontSize: '15px' }}>{r.name}</span>
                    </div>
                    {r.ingredients && r.ingredients.length > 0 && (
                      <div style={{ fontSize: '12px', color: S.muted, marginTop: '4px' }}>
                        {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {cookCount > 0 && (
                      <div style={{ fontSize: '11px', color: S.accent, marginTop: '2px' }}>
                        Used in {cookCount} cook{cookCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {r.rating > 0 && (
                      <div style={{ fontSize: '18px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
                        {r.rating}/9
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
