import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { INGREDIENT_UNITS } from '../constants.js';

const TYPE_LABELS = { rub: 'Rub', sauce: 'Sauce', fullCook: 'Full Cook' };

export default function RecipeDetail() {
  const { S, sBtn, setView, setDirty } = useAppContext();
  const {
    currentRecipe, editRecipe, deleteRecipe, cooksUsingRecipe,
    recipes, setCurrentRecipe,
  } = useCookContext();

  if (!currentRecipe) return null;

  const cookHistory = cooksUsingRecipe(currentRecipe.id);
  const type = currentRecipe.type;

  // Resolve linked recipes for full cook type
  const linkedRub = currentRecipe.rubRecipeId ? recipes.find(r => r.id === currentRecipe.rubRecipeId) : null;
  const linkedSauce = currentRecipe.sauceRecipeId ? recipes.find(r => r.id === currentRecipe.sauceRecipeId) : null;

  const Row = ({ label, value }) => {
    if (!value) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
        <span style={{ fontSize: '12px', color: S.muted }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '600', color: S.text, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
      </div>
    );
  };

  return (
    <div className="bbq-container" style={{ padding: '16px', paddingBottom: '80px' }}>
      <button onClick={() => { setView('recipes'); setCurrentRecipe(null); setDirty(false); }}
        style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>
        Back to Recipes
      </button>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '10px', color: S.accent, fontWeight: '700', padding: '2px 8px',
          background: S.dark, borderRadius: '4px', letterSpacing: '0.5px', border: `1px solid ${S.border}` }}>
          {TYPE_LABELS[type]}
        </span>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', letterSpacing: '1px', marginTop: '8px', marginBottom: '4px' }}>
          {currentRecipe.name}
        </h2>
        {currentRecipe.rating > 0 && (
          <span style={{ fontSize: '22px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
            {currentRecipe.rating}/9
          </span>
        )}
      </div>

      {/* Ingredients */}
      {(currentRecipe.ingredients || []).length > 0 && (
        <div style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '10px' }}>
            Ingredients
          </div>
          {currentRecipe.ingredients.map((ing, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: i < currentRecipe.ingredients.length - 1 ? `1px solid ${S.border}` : 'none' }}>
              <span style={{ fontSize: '14px', color: S.text }}>{ing.name || 'Unnamed'}</span>
              <span style={{ fontSize: '13px', color: S.muted, fontWeight: '500' }}>
                {ing.amount ? `${ing.amount} ${ing.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Sauce cook method */}
      {type === 'sauce' && currentRecipe.cookMethod && (
        <div style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>
            Cook Method
          </div>
          <div style={{ fontSize: '14px', color: S.text, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {currentRecipe.cookMethod}
          </div>
        </div>
      )}

      {/* Full Cook details */}
      {type === 'fullCook' && (
        <>
          {currentRecipe.instructions && (
            <div style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>
                Instructions
              </div>
              <div style={{ fontSize: '14px', color: S.text, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {currentRecipe.instructions}
              </div>
            </div>
          )}

          <div style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>
              Cook Details
            </div>
            <Row label="Meat Type" value={currentRecipe.meatType} />
            <Row label="Rub" value={linkedRub ? linkedRub.name : null} />
            <Row label="Sauce" value={linkedSauce ? linkedSauce.name : null} />
            <Row label="Wood" value={currentRecipe.woodRecommendation} />
            <Row label="Temp" value={currentRecipe.tempGuidelines} />
            <Row label="Time" value={currentRecipe.timeGuidelines} />
          </div>
        </>
      )}

      {/* Notes */}
      {currentRecipe.notes && (
        <div style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>
            Notes
          </div>
          <div style={{ fontSize: '14px', color: S.text, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {currentRecipe.notes}
          </div>
        </div>
      )}

      {/* Cook History — every cook that used this recipe */}
      <div style={{ background: S.dark, borderRadius: '10px', padding: '14px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '10px' }}>
          Cook History
        </div>
        {cookHistory.length === 0 ? (
          <div style={{ fontSize: '13px', color: S.muted, textAlign: 'center', padding: '12px 0' }}>
            No cooks have used this recipe yet.
          </div>
        ) : (
          cookHistory.map(c => (
            <div key={c.id} style={{ padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: S.text }}>{c.name}</div>
                  <div style={{ fontSize: '11px', color: S.muted }}>{c.date}{c.meatType ? ` · ${c.meatType}` : ''}</div>
                </div>
                {c.rating > 0 && (
                  <div style={{ fontSize: '16px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
                    {c.rating}/9
                  </div>
                )}
              </div>
              {c.whatIdChange && (
                <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  Change: {c.whatIdChange}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button onClick={() => editRecipe(currentRecipe)} style={{ ...sBtn(true, false), flex: 1 }}>Edit</button>
        <button onClick={() => deleteRecipe(currentRecipe.id)}
          style={{ ...sBtn(false, false), flex: 1, color: '#f87171', borderColor: '#f8717133' }}>Delete</button>
      </div>
    </div>
  );
}
