import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { MEATS, WOOD_TYPES, INGREDIENT_UNITS, RECIPE_TYPE_LABELS } from '../constants.js';

const TYPE_LABELS = RECIPE_TYPE_LABELS;

const SUB_HEADLINES = {
  rub:      'Dry rub recipe',
  sauce:    'Sauce recipe',
  side:     'Side recipe — smoked, grilled, or stovetop',
  dessert:  'Dessert recipe',
  fullCook: 'Full cook blueprint',
};

const NAME_PLACEHOLDERS = {
  rub:      'Texas Style Dalmatian',
  sauce:    'Carolina Gold',
  side:     'Smoked Mac & Cheese',
  dessert:  'Banana Pudding',
  fullCook: 'Competition Brisket',
};

// sauce / side / dessert all expose a free-form preparation field, since
// the underlying schema is the same. The label changes per type so the
// dessert form doesn't say "COOK METHOD" for something that's stirred
// together and chilled.
const PREPARATION_LABEL = {
  sauce:   'COOK METHOD',
  side:    'PREPARATION',
  dessert: 'PREPARATION',
};
const PREPARATION_PLACEHOLDER = {
  sauce:   'Simmer for 30 minutes, stir occasionally...',
  side:    'Smoke at 225°F for 2 hours, finish on the stovetop with butter...',
  dessert: 'Layer pudding, cookies, and bananas. Chill 4 hours before serving...',
};

export default function RecipeForm() {
  const {
    S, sBtn, sInput, sLabel,
    view, setView, dirty, setDirty,
  } = useAppContext();
  const {
    currentRecipe, updateRecipe, saveRecipeEntry,
    addIngredient, removeIngredient, updateIngredient,
    rubRecipes, sauceRecipes, uniqueMeatTypes,
    setCurrentRecipe,
  } = useCookContext();

  if (!currentRecipe) return null;

  const isEdit = view === 'recipeEdit';
  const type = currentRecipe.type;

  return (
    <div className="bbq-container-form">
      <button onClick={() => {
        if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
        setView('recipes'); setCurrentRecipe(null); setDirty(false);
      }} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>
        Back
      </button>

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '4px' }}>
        {isEdit ? 'Edit' : 'New'} {TYPE_LABELS[type]}
      </h2>
      <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '16px' }}>
        {SUB_HEADLINES[type] || 'Recipe'}
      </div>

      {/* Name */}
      <div style={{ marginBottom: '16px' }}>
        <label style={sLabel()}>NAME</label>
        <input type="text" value={currentRecipe.name} onChange={e => updateRecipe('name', e.target.value)}
          placeholder={NAME_PLACEHOLDERS[type] || 'Recipe name'}
          style={sInput()} />
      </div>

      {/* Ingredients */}
      <div style={{ marginBottom: '20px' }}>
        <label style={sLabel()}>INGREDIENTS</label>
        {(currentRecipe.ingredients || []).map((ing, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
            <input type="text" value={ing.name} onChange={e => updateIngredient(idx, 'name', e.target.value)}
              placeholder="Ingredient" style={{ ...sInput(), flex: 3 }} />
            <input type="number" inputMode="decimal" step="0.25" value={ing.amount}
              onChange={e => updateIngredient(idx, 'amount', e.target.value)}
              placeholder="Amt" style={{ ...sInput(), flex: 1, textAlign: 'center' }} />
            <select value={ing.unit} onChange={e => updateIngredient(idx, 'unit', e.target.value)}
              style={{ ...sInput(), flex: 1.5, padding: '8px 4px', fontSize: '12px' }}>
              {INGREDIENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              <option value="custom">other</option>
            </select>
            <button onClick={() => removeIngredient(idx)}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '16px', padding: '4px', flexShrink: 0 }}>
              {'✕'}
            </button>
          </div>
        ))}
        <button onClick={addIngredient} style={{ ...sBtn(false, true), width: '100%' }}>+ Add Ingredient</button>
      </div>

      {/* Cook method / preparation — sauce, side, and dessert all use it.
          Label and placeholder differ per type so a dessert form doesn't
          say "COOK METHOD" for a no-cook chill-and-layer recipe. */}
      {(type === 'sauce' || type === 'side' || type === 'dessert') && (
        <div style={{ marginBottom: '16px' }}>
          <label style={sLabel()}>{PREPARATION_LABEL[type]}</label>
          <textarea value={currentRecipe.cookMethod || ''} onChange={e => updateRecipe('cookMethod', e.target.value)}
            placeholder={PREPARATION_PLACEHOLDER[type]} rows={3}
            style={{ ...sInput(), resize: 'vertical' }} />
        </div>
      )}

      {/* Full Cook fields */}
      {type === 'fullCook' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <label style={sLabel()}>MEAT TYPE</label>
            <select value={currentRecipe.meatType || ''} onChange={e => updateRecipe('meatType', e.target.value)}
              style={sInput()}>
              <option value="">Select...</option>
              {uniqueMeatTypes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={sLabel()}>INSTRUCTIONS</label>
            <textarea value={currentRecipe.instructions || ''} onChange={e => updateRecipe('instructions', e.target.value)}
              placeholder="Step by step cook instructions..." rows={6}
              style={{ ...sInput(), resize: 'vertical' }} />
          </div>

          <div className="bbq-form-fields">
            <div style={{ marginBottom: '10px' }}>
              <label style={sLabel()}>RUB RECIPE</label>
              <select value={currentRecipe.rubRecipeId || ''} onChange={e => updateRecipe('rubRecipeId', e.target.value || null)}
                style={sInput()}>
                <option value="">None / custom</option>
                {rubRecipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={sLabel()}>SAUCE RECIPE</label>
              <select value={currentRecipe.sauceRecipeId || ''} onChange={e => updateRecipe('sauceRecipeId', e.target.value || null)}
                style={sInput()}>
                <option value="">None / custom</option>
                {sauceRecipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={sLabel()}>WOOD RECOMMENDATION</label>
              <select value={WOOD_TYPES.includes(currentRecipe.woodRecommendation) ? currentRecipe.woodRecommendation : ''}
                onChange={e => updateRecipe('woodRecommendation', e.target.value)}
                style={sInput()}>
                <option value="">Select...</option>
                {WOOD_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={sLabel()}>TEMP GUIDELINES</label>
              <input type="text" value={currentRecipe.tempGuidelines || ''} onChange={e => updateRecipe('tempGuidelines', e.target.value)}
                placeholder="225F for 8-12 hrs" style={sInput()} />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={sLabel()}>TIME GUIDELINES</label>
              <input type="text" value={currentRecipe.timeGuidelines || ''} onChange={e => updateRecipe('timeGuidelines', e.target.value)}
                placeholder="1-1.5 hrs per pound" style={sInput()} />
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      <div style={{ marginBottom: '16px' }}>
        <label style={sLabel()}>NOTES</label>
        <textarea value={currentRecipe.notes || ''} onChange={e => updateRecipe('notes', e.target.value)}
          placeholder="Tips, variations, where you got the recipe..." rows={3}
          style={{ ...sInput(), resize: 'vertical' }} />
      </div>

      {/* Rating */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={sLabel()}>RATING</label>
          <span style={{ fontSize: '20px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
            {currentRecipe.rating > 0 ? `${currentRecipe.rating}/9` : '--'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => updateRecipe('rating', n)} style={{
              flex: 1, padding: '10px 0', background: currentRecipe.rating === n ? S.accent : S.dark,
              color: currentRecipe.rating === n ? '#fff' : S.muted,
              border: `1px solid ${currentRecipe.rating === n ? S.accent : S.border}`,
              borderRadius: '4px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>{n}</button>
          ))}
        </div>
      </div>

      {/* Share with friends — defaults off; Firestore rule gates friend reads on this flag */}
      <div style={{ marginBottom: '20px', padding: '14px', background: S.dark, borderRadius: '8px', border: `1px solid ${S.border}` }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!currentRecipe.shared}
            onChange={(e) => updateRecipe('shared', e.target.checked)}
            style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#4A6741', cursor: 'pointer', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: S.text, marginBottom: '2px' }}>
              Share with friends
            </div>
            <div style={{ fontSize: '11px', color: S.muted, lineHeight: '1.4' }}>
              When on, accepted friends can see this recipe. Off by default — recipes are private unless you opt in.
            </div>
          </div>
        </label>
      </div>

      {/* Save */}
      <button onClick={saveRecipeEntry} disabled={!currentRecipe.name.trim()}
        style={{
          width: '100%', padding: '14px', fontFamily: "'Oswald', sans-serif", fontSize: '16px',
          fontWeight: '700', letterSpacing: '1px', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: currentRecipe.name.trim() ? S.accent : '#333',
          color: currentRecipe.name.trim() ? '#fff' : '#666',
        }}>Save Recipe</button>
    </div>
  );
}
