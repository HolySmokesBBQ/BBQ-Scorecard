// localStorage adapters for offline-first reviews, cooks, and recipes.
//
// NOTE: The legacy Google Drive sync code that previously lived here was
// removed June 5, 2026 per Security Audit Finding #4. It was dead code
// (exported but never imported) and added attack surface: a hardcoded
// OAuth client ID, dynamic script injection from accounts.google.com, a
// module-scoped access token with no rotation, and an unescaped Drive API
// query construction. Firebase sync (firebaseSync.js) supersedes it.

const STORAGE_KEY = 'muiller-bbq-reviews';

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocal(reviews) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  } catch (e) {
    console.error('localStorage save failed:', e);
  }
}

/* ── Cook Notebook Storage ── */
const COOKS_KEY = 'muiller-bbq-cooks';
const RECIPES_KEY = 'muiller-bbq-recipes';

export function loadCooks() {
  try { return JSON.parse(localStorage.getItem(COOKS_KEY) || '[]'); } catch { return []; }
}
export function saveCooksLocal(cooks) {
  try { localStorage.setItem(COOKS_KEY, JSON.stringify(cooks)); } catch (e) { console.error('Cook save failed:', e); }
}
export function loadRecipes() {
  try { return JSON.parse(localStorage.getItem(RECIPES_KEY) || '[]'); } catch { return []; }
}
export function saveRecipesLocal(recipes) {
  try { localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes)); } catch (e) { console.error('Recipe save failed:', e); }
}

/* ── Tombstones ──
   Local-only record of IDs the user deleted. On cloud merge, anything
   in here is excluded from the merged set so an offline delete still
   wins against a later cloud sync that re-fetches the deleted doc.
   Closes the edge case from security audit finding N-2. */
const COOK_TOMBSTONES_KEY = 'muiller-bbq-cook-tombstones';
const RECIPE_TOMBSTONES_KEY = 'muiller-bbq-recipe-tombstones';

export function loadCookTombstones()    { try { return new Set(JSON.parse(localStorage.getItem(COOK_TOMBSTONES_KEY) || '[]')); } catch { return new Set(); } }
export function loadRecipeTombstones()  { try { return new Set(JSON.parse(localStorage.getItem(RECIPE_TOMBSTONES_KEY) || '[]')); } catch { return new Set(); } }
export function saveCookTombstones(s)   { try { localStorage.setItem(COOK_TOMBSTONES_KEY, JSON.stringify(Array.from(s))); } catch (e) { console.error(e); } }
export function saveRecipeTombstones(s) { try { localStorage.setItem(RECIPE_TOMBSTONES_KEY, JSON.stringify(Array.from(s))); } catch (e) { console.error(e); } }

/* ── Cook form draft ──
   Saved on every dirty edit so an interrupted cook (phone call, app
   backgrounded by Android) restores the in-progress form on next
   launch. Cleared on successful save or explicit discard. */
const COOK_DRAFT_KEY = 'muiller-bbq-cook-draft';

export function loadCookDraft() {
  try { const v = localStorage.getItem(COOK_DRAFT_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function saveCookDraft(cook) {
  try { localStorage.setItem(COOK_DRAFT_KEY, JSON.stringify(cook)); } catch (e) { console.error('Draft save failed:', e); }
}
export function clearCookDraft() {
  try { localStorage.removeItem(COOK_DRAFT_KEY); } catch {}
}

/* ── Onboarding flag ── */
const ONBOARDED_KEY = 'muiller-bbq-notebook-onboarded';
export function hasOnboarded()   { return !!localStorage.getItem(ONBOARDED_KEY); }
export function markOnboarded()  { try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch {} }
