import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  loadCooks, saveCooksLocal, loadRecipes, saveRecipesLocal,
  loadCookTombstones, loadRecipeTombstones, saveCookTombstones, saveRecipeTombstones,
  loadCookDraft, saveCookDraft, clearCookDraft,
} from '../storage.js';
import { MEATS } from '../constants.js';
import { genId, compressPhoto, track, setGaContext } from '../scoring.js';
import { computeRewards, tierById } from '../rewards.js';

const CELEBRATED_KEY = 'bbq-celebrated-tiers';

function loadCelebrated() {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function saveCelebrated(set) {
  try { localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...set])); } catch {}
}
import { useAppContext } from './AppContext.jsx';
import {
  syncCooksUp, loadMyCloudCooks, mergeCooks,
  syncRecipesUp, loadMyCloudRecipes, mergeRecipes,
  uploadCookPhotos, syncCookWithPhotos,
  deleteCloudCook, deleteCloudRecipe, deleteCookPhotos,
  getAllFriendCooks, getAllFriendRecipes,
} from '../firebaseSync.js';

const CookContext = createContext(null);

export function useCookContext() {
  return useContext(CookContext);
}

function emptyCook() {
  return {
    id: genId(),
    name: '',
    date: new Date().toISOString().split('T')[0],
    meatType: '',
    cut: '',
    weight: '',
    rub: '',
    rubRecipeId: null,
    sauce: '',
    sauceRecipeId: null,
    woodType: [],
    smokerType: '',
    fuelSource: '',
    cookTemp: '',
    wrapMethod: 'No wrap',
    wrapTemp: '',
    targetInternalTemp: '',
    cookTimeHours: '',
    cookTimeMinutes: '',
    restTime: '',
    weatherTemp: '',
    weatherWind: '',
    weatherHumidity: '',
    photos: [],
    notesLog: [],
    notes: '',
    whatIdChange: '',
    rating: 0,
    tags: [],
    recipeIds: [],
    shared: false,
    lastEdited: null,
  };
}

function emptyRecipe(type = 'rub') {
  return {
    id: genId(),
    type,
    name: '',
    ingredients: [],
    cookMethod: '',
    meatType: '',
    instructions: '',
    rubRecipeId: null,
    sauceRecipeId: null,
    woodRecommendation: '',
    tempGuidelines: '',
    timeGuidelines: '',
    notes: '',
    rating: 0,
    shared: false,
    createdAt: new Date().toISOString(),
    lastEdited: null,
  };
}

export default function CookProvider({ children }) {
  const { navigateTo, setView, setDirty, view, fbUser, fbFriends } = useAppContext();

  const [cooks, setCooks] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [currentCook, setCurrentCook] = useState(null);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  // Transient banner the post-save list view reads to confirm the write
  // actually happened. Cleared by the consumer after a short timeout so
  // the next interaction doesn't carry stale state.
  const [savedNotice, setSavedNotice] = useState('');
  // Cloud sync status — 'idle' / 'syncing' / 'done' / 'error'.
  const [cookSyncStatus, setCookSyncStatus] = useState('idle');
  // Friend cook + recipe state — populated from Firestore when the user
  // is signed in with at least one accepted friend. NotebookLeaderboard
  // falls back to SAMPLE_FRIEND_COOKS only when this array is empty so
  // the bracket layout has something to render for new users.
  const [friendCooks, setFriendCooks] = useState([]);
  const [friendRecipes, setFriendRecipes] = useState([]);
  // Tombstones — IDs the user deleted locally. Cloud merges filter these
  // out so an offline delete survives a subsequent sync that would
  // otherwise pull the cloud copy back down.
  const cookTombstones   = useRef(loadCookTombstones());
  const recipeTombstones = useRef(loadRecipeTombstones());
  // Filters persist between sessions so a user filtering their cook log
  // by meat type doesn't lose context on every app re-open. Search is
  // intentionally NOT persisted — most users want a fresh search bar.
  const [cookSearch, setCookSearch] = useState('');
  const [cookMeatFilter, setCookMeatFilter] = useState(() => {
    try { return localStorage.getItem('bbq-cook-meat-filter') || ''; } catch { return ''; }
  });
  const [cookTagFilter, setCookTagFilter] = useState(() => {
    try { return localStorage.getItem('bbq-cook-tag-filter') || ''; } catch { return ''; }
  });
  useEffect(() => {
    try {
      if (cookMeatFilter) localStorage.setItem('bbq-cook-meat-filter', cookMeatFilter);
      else localStorage.removeItem('bbq-cook-meat-filter');
    } catch {}
  }, [cookMeatFilter]);
  useEffect(() => {
    try {
      if (cookTagFilter) localStorage.setItem('bbq-cook-tag-filter', cookTagFilter);
      else localStorage.removeItem('bbq-cook-tag-filter');
    } catch {}
  }, [cookTagFilter]);
  const [cookSort, setCookSort] = useState('date');
  const [recipeTypeFilter, setRecipeTypeFilter] = useState('all');
  const [recipeSearch, setRecipeSearch] = useState('');
  const cookSnapshot = useRef(null);
  const recipeSnapshot = useRef(null);
  const cookPhotoRef = useRef(null);
  const cookGalleryRef = useRef(null);

  // Load on mount
  useEffect(() => {
    setCooks(loadCooks());
    setRecipes(loadRecipes());
  }, []);

  // CookForm draft persistence — save the in-progress cook on every
  // edit so backgrounding the app (or a crash) doesn't lose the draft.
  // Cleared on successful save / cancel via clearCookDraft().
  useEffect(() => {
    if (currentCook && (view === 'cookNew' || view === 'cookEdit')) {
      saveCookDraft(currentCook);
    }
  }, [currentCook, view]);

  // Keep GA4 user properties in sync with cook/recipe counts
  useEffect(() => {
    setGaContext({ cook_count: cooks.length, recipe_count: recipes.length });
  }, [cooks.length, recipes.length]);

  // Clear cook/recipe state when navigating away from cook views
  useEffect(() => {
    const cookViews = ['cookNew', 'cookEdit', 'cookDetail'];
    const recipeViews = ['recipeNew', 'recipeEdit', 'recipeDetail', 'recipes'];
    if (!cookViews.includes(view) && !recipeViews.includes(view)) {
      if (currentCook && !cookViews.includes(view)) setCurrentCook(null);
      if (currentRecipe && !recipeViews.includes(view)) setCurrentRecipe(null);
    }
  }, [view]);

  const persistCooks = useCallback((updated) => {
    setCooks(updated);
    saveCooksLocal(updated);
  }, []);

  const persistRecipes = useCallback((updated) => {
    setRecipes(updated);
    saveRecipesLocal(updated);
  }, []);

  /* ── Cook CRUD ── */
  const startNewCook = () => {
    // Restore an in-progress draft if one exists. Only prompt when the
    // draft has a name (otherwise it's a stale empty form).
    const draft = loadCookDraft();
    if (draft && draft.name?.trim() && !cooks.some(c => c.id === draft.id)) {
      if (window.confirm(`You have an unsaved draft for "${draft.name}". Restore it?`)) {
        setCurrentCook(draft);
        cookSnapshot.current = JSON.stringify(draft);
        setDirty(true);
        navigateTo('cookNew');
        return;
      }
      clearCookDraft();
    }
    const c = emptyCook();
    setCurrentCook(c);
    cookSnapshot.current = JSON.stringify(c);
    setDirty(false);
    navigateTo('cookNew');
  };

  const editCook = (cook) => {
    setCurrentCook({ ...cook });
    cookSnapshot.current = JSON.stringify(cook);
    setDirty(false);
    navigateTo('cookEdit');
  };

  const viewCookDetail = (cook) => {
    setCurrentCook({ ...cook });
    setDirty(false);
    navigateTo('cookDetail');
  };

  const saveCookEntry = async () => {
    if (!currentCook?.name?.trim()) return;
    // Strip the transient _noteInput field before saving
    const { _noteInput, ...cleanCook } = currentCook;
    const exists = cooks.find(c => c.id === cleanCook.id);
    const baseSave = exists
      ? { ...cleanCook, lastEdited: new Date().toISOString().split('T')[0] }
      : cleanCook;

    // Local save first — UX never blocks on cloud. Audit finding N-3:
    // if user is signed in, upload any base64 cook photos to Storage
    // and replace them with cloud URLs before the Firestore write so
    // photos actually survive a device wipe.
    let toSave = baseSave;
    let updated = exists
      ? cooks.map(c => c.id === baseSave.id ? toSave : c)
      : [toSave, ...cooks];
    persistCooks(updated);
    setDirty(false);
    setView('home');
    setCurrentCook(null);
    clearCookDraft();

    // Check for any tier unlocks this save triggered. Replace the
    // standard save banner with a celebration message when one fires;
    // append the save note if multiple unlocks land at once (rare).
    const beforeCelebrated = loadCelebrated();
    const rewardsNow = computeRewards(updated, { recipes });
    const fresh = [];
    for (const id of rewardsNow.unlockedIds) {
      if (!beforeCelebrated.has(id)) fresh.push(id);
    }
    if (fresh.length) {
      const titles = fresh
        .map(id => tierById(id, updated))
        .filter(Boolean)
        .map(t => t.title);
      setSavedNotice(`🏆 Unlocked: ${titles.join(' · ')}`);
      const next = new Set(beforeCelebrated);
      for (const id of fresh) next.add(id);
      saveCelebrated(next);
      for (const id of fresh) track('tier_unlocked', { tier_id: id });
    } else {
      setSavedNotice(`✓ Cook saved: ${toSave.name}`);
    }
    track(exists ? 'cook_edited' : 'cook_created', { name: toSave.name, meatType: toSave.meatType });

    if (fbUser) {
      try {
        const photos = await uploadCookPhotos(fbUser.uid, toSave.id, toSave.photos || []);
        toSave = { ...toSave, photos };
        // Re-derive from LATEST cooks state via functional setter — a
        // concurrent cook edit or delete during the photo upload would
        // otherwise be dropped when we persist the stale `updated` array
        // captured before the await. (Audit v2.1.9)
        setCooks(prev => {
          const fresh = prev.map(c => c.id === toSave.id ? toSave : c);
          saveCooksLocal(fresh);
          return fresh;
        });
        await syncCookWithPhotos(fbUser.uid, toSave);
      } catch (e) {
        console.error('Cloud cook save failed:', e);
      }
    }
  };

  const deleteCook = (id) => {
    if (!window.confirm('Delete this cook log?')) return;
    const removed = cooks.find(c => c.id === id);
    persistCooks(cooks.filter(c => c.id !== id));
    track('cook_deleted', { meatType: removed?.meatType || '' });
    setView('home');
    setCurrentCook(null);
    setDirty(false);
    // Tombstone the ID locally so an offline delete still wins against
    // a later cloud sync. Audit finding N-2's online-fix is best-effort;
    // this guards the offline case.
    cookTombstones.current.add(id);
    saveCookTombstones(cookTombstones.current);
    if (fbUser) {
      deleteCloudCook(fbUser.uid, id).catch(() => {});
      deleteCookPhotos(fbUser.uid, id).catch(() => {});
    }
  };

  const duplicateCook = (cook) => {
    const dup = {
      ...cook,
      id: genId(),
      name: cook.name + ' (copy)',
      date: new Date().toISOString().split('T')[0],
      photos: [],
      notesLog: [],
      notes: '',
      whatIdChange: '',
      rating: 0,
      shared: false,
      lastEdited: null,
    };
    setCurrentCook(dup);
    cookSnapshot.current = JSON.stringify(dup);
    setDirty(false);
    navigateTo('cookNew');
  };

  const updateCook = (key, val) => {
    const updated = { ...currentCook, [key]: val };
    setCurrentCook(updated);
    setDirty(JSON.stringify(updated) !== cookSnapshot.current);
  };

  const handleCookPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressPhoto(file);
    const photos = [...(currentCook.photos || [])];
    if (photos.length >= 3) {
      alert('Maximum 3 photos per entry.');
      return;
    }
    photos.push(compressed);
    setCurrentCook({ ...currentCook, photos });
    setDirty(true);
    e.target.value = '';
  };

  const removeCookPhoto = (idx) => {
    const photos = [...(currentCook.photos || [])];
    photos.splice(idx, 1);
    setCurrentCook({ ...currentCook, photos });
    setDirty(true);
  };

  const addCookNote = () => {
    if (!currentCook.notes?.trim()) return;
    const now = new Date();
    const stamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const entry = `${stamp}: ${currentCook.notes.trim()}`;
    const log = [...(currentCook.notesLog || []), entry];
    setCurrentCook({ ...currentCook, notesLog: log, notes: '' });
    setDirty(true);
  };

  const addCookTag = (tag) => {
    if (!tag.trim()) return;
    const tags = [...(currentCook.tags || [])];
    const t = tag.trim();
    if (!tags.includes(t)) tags.push(t);
    setCurrentCook({ ...currentCook, tags });
    setDirty(true);
  };

  const removeCookTag = (tag) => {
    const tags = (currentCook.tags || []).filter(t => t !== tag);
    setCurrentCook({ ...currentCook, tags });
    setDirty(true);
  };

  /* ── Recipe CRUD ── */
  const startNewRecipe = (type = 'rub') => {
    const r = emptyRecipe(type);
    setCurrentRecipe(r);
    recipeSnapshot.current = JSON.stringify(r);
    setDirty(false);
    navigateTo('recipeNew');
  };

  const editRecipe = (recipe) => {
    setCurrentRecipe({ ...recipe });
    recipeSnapshot.current = JSON.stringify(recipe);
    setDirty(false);
    navigateTo('recipeEdit');
  };

  const viewRecipeDetail = (recipe) => {
    setCurrentRecipe({ ...recipe });
    setDirty(false);
    navigateTo('recipeDetail');
  };

  const saveRecipeEntry = () => {
    if (!currentRecipe?.name?.trim()) return;
    const exists = recipes.find(r => r.id === currentRecipe.id);
    // Defensive: backfill createdAt if missing on edits, ensure newest-on-top
    // sort works even for recipes saved before that field existed.
    const toSave = exists
      ? { ...currentRecipe, lastEdited: new Date().toISOString().split('T')[0] }
      : { ...currentRecipe, createdAt: currentRecipe.createdAt || new Date().toISOString() };
    const updated = exists
      ? recipes.map(r => r.id === currentRecipe.id ? toSave : r)
      : [toSave, ...recipes];
    persistRecipes(updated);
    setDirty(false);
    setView('recipes');
    setCurrentRecipe(null);
    setSavedNotice(`✓ Recipe saved: ${toSave.name}`);
    track(exists ? 'recipe_edited' : 'recipe_created', { name: toSave.name, type: toSave.type });
  };

  const deleteRecipe = (id) => {
    if (!window.confirm('Delete this recipe?')) return;
    const removed = recipes.find(r => r.id === id);
    persistRecipes(recipes.filter(r => r.id !== id));
    track('recipe_deleted', { type: removed?.type || '' });
    setView('recipes');
    setCurrentRecipe(null);
    setDirty(false);
    recipeTombstones.current.add(id);
    saveRecipeTombstones(recipeTombstones.current);
    if (fbUser) {
      deleteCloudRecipe(fbUser.uid, id).catch(() => {});
    }
  };

  const updateRecipe = (key, val) => {
    const updated = { ...currentRecipe, [key]: val };
    setCurrentRecipe(updated);
    setDirty(JSON.stringify(updated) !== recipeSnapshot.current);
  };

  const addIngredient = () => {
    const ingredients = [...(currentRecipe.ingredients || []), { name: '', amount: '', unit: 'tsp' }];
    updateRecipe('ingredients', ingredients);
  };

  const removeIngredient = (idx) => {
    const ingredients = [...(currentRecipe.ingredients || [])];
    ingredients.splice(idx, 1);
    updateRecipe('ingredients', ingredients);
  };

  const updateIngredient = (idx, key, val) => {
    const ingredients = [...(currentRecipe.ingredients || [])];
    ingredients[idx] = { ...ingredients[idx], [key]: val };
    updateRecipe('ingredients', ingredients);
  };

  /* ── Cloud sync ──
     Two-phase: pull cloud → merge with local → push merged copy back so
     anything that existed only locally lands in Firestore in the same
     round-trip. Mirrors the review-sync workflow. Photos stay out of
     the metadata write — base64s only get uploaded by the explicit
     per-cook save path (TBD for cooks; reviews already do this). */
  const syncWithCloud = useCallback(async (userId) => {
    if (!userId) return { ok: false, error: 'Not signed in' };
    setCookSyncStatus('syncing');
    try {
      const friendIds = (fbFriends || []).map(f => f.id);
      const [cloudCooks, cloudRecipes, fCooks, fRecipes] = await Promise.all([
        loadMyCloudCooks(userId),
        loadMyCloudRecipes(userId),
        getAllFriendCooks(friendIds),
        getAllFriendRecipes(friendIds),
      ]);
      // Apply tombstones before merge — anything the user deleted
      // locally stays deleted even if the cloud copy still exists.
      const cookT   = cookTombstones.current;
      const recipeT = recipeTombstones.current;
      const filteredCloudCooks   = cloudCooks.filter(c => !cookT.has(c.id));
      const filteredCloudRecipes = cloudRecipes.filter(r => !recipeT.has(r.id));
      const mergedCooks   = mergeCooks(cooks, filteredCloudCooks);
      const mergedRecipes = mergeRecipes(recipes, filteredCloudRecipes);
      persistCooks(mergedCooks);
      persistRecipes(mergedRecipes);
      setFriendCooks(fCooks);
      setFriendRecipes(fRecipes);
      await Promise.all([
        syncCooksUp(userId, mergedCooks),
        syncRecipesUp(userId, mergedRecipes),
      ]);
      setCookSyncStatus('done');
      const cookCount = mergedCooks.filter(c => !c._isExample).length;
      const recipeCount = mergedRecipes.filter(r => !r._isExample).length;
      setSavedNotice(`✓ Synced ${cookCount} cook${cookCount !== 1 ? 's' : ''} and ${recipeCount} recipe${recipeCount !== 1 ? 's' : ''}`);
      setTimeout(() => setCookSyncStatus('idle'), 2000);
      track('cook_sync', { cooks: cookCount, recipes: recipeCount, friend_cooks: fCooks.length });
      return { ok: true, cooks: cookCount, recipes: recipeCount, friendCooks: fCooks.length };
    } catch (e) {
      console.error('Cook/recipe sync failed:', e);
      setCookSyncStatus('error');
      setSavedNotice(`× Sync failed — check your connection`);
      setTimeout(() => setCookSyncStatus('idle'), 3000);
      return { ok: false, error: e?.message || 'Sync failed' };
    }
  }, [cooks, recipes, persistCooks, persistRecipes, fbFriends]);

  // Background friend-cook refresh — runs whenever the friend list
  // changes (sign-in, accept, remove). Cheap read, no merge logic.
  useEffect(() => {
    if (!fbUser || !fbFriends || fbFriends.length === 0) {
      setFriendCooks([]);
      setFriendRecipes([]);
      return;
    }
    const friendIds = fbFriends.map(f => f.id);
    Promise.all([getAllFriendCooks(friendIds), getAllFriendRecipes(friendIds)])
      .then(([c, r]) => { setFriendCooks(c); setFriendRecipes(r); })
      .catch(e => console.error('Friend cook/recipe fetch failed:', e));
  }, [fbUser, fbFriends]);

  /* ── Derived Data ── */
  const rankedCooks = useMemo(() => {
    let list = [...cooks];
    if (cookSearch) {
      const q = cookSearch.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.meatType || '').toLowerCase().includes(q) ||
        (c.cut || '').toLowerCase().includes(q) ||
        (c.smokerType || '').toLowerCase().includes(q)
      );
    }
    if (cookMeatFilter) list = list.filter(c => c.meatType === cookMeatFilter);
    if (cookTagFilter) list = list.filter(c => (c.tags || []).includes(cookTagFilter));
    if (cookSort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [cooks, cookSearch, cookMeatFilter, cookTagFilter, cookSort]);

  const previousCooksOfMeat = useCallback((meatType, excludeId) => {
    if (!meatType) return [];
    return cooks
      .filter(c => c.meatType === meatType && c.id !== excludeId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 3);
  }, [cooks]);

  const cooksUsingRecipe = useCallback((recipeId) => {
    return cooks.filter(c =>
      c.rubRecipeId === recipeId ||
      c.sauceRecipeId === recipeId ||
      (c.recipeIds || []).includes(recipeId)
    ).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [cooks]);

  const rubRecipes = useMemo(() => recipes.filter(r => r.type === 'rub'), [recipes]);
  const sauceRecipes = useMemo(() => recipes.filter(r => r.type === 'sauce'), [recipes]);
  const fullCookRecipes = useMemo(() => recipes.filter(r => r.type === 'fullCook'), [recipes]);

  const filteredRecipes = useMemo(() => {
    let list = recipes;
    if (recipeTypeFilter !== 'all') {
      list = list.filter(r => r.type === recipeTypeFilter);
    }
    if (recipeSearch.trim()) {
      const q = recipeSearch.trim().toLowerCase();
      list = list.filter(r => {
        const inName = (r.name || '').toLowerCase().includes(q);
        const inIngredients = (r.ingredients || []).some(i => (i?.name || '').toLowerCase().includes(q));
        const inPrep = (r.preparation || '').toLowerCase().includes(q);
        return inName || inIngredients || inPrep;
      });
    }
    return [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [recipes, recipeTypeFilter, recipeSearch]);

  const uniqueSmokerTypes = useMemo(() =>
    [...new Set(cooks.map(c => c.smokerType).filter(Boolean))],
  [cooks]);

  const uniqueMeatTypes = useMemo(() => {
    const custom = cooks.map(c => c.meatType).filter(Boolean);
    return [...new Set([...MEATS, ...custom])];
  }, [cooks]);

  const uniqueTags = useMemo(() =>
    [...new Set(cooks.flatMap(c => c.tags || []))],
  [cooks]);

  const value = {
    cooks, recipes,
    currentCook, setCurrentCook,
    currentRecipe, setCurrentRecipe,
    cookSearch, setCookSearch,
    cookMeatFilter, setCookMeatFilter,
    cookTagFilter, setCookTagFilter,
    cookSort, setCookSort,
    recipeTypeFilter, setRecipeTypeFilter,
    recipeSearch, setRecipeSearch,
    cookPhotoRef, cookGalleryRef,
    startNewCook, editCook, viewCookDetail, saveCookEntry, deleteCook, duplicateCook,
    updateCook, handleCookPhoto, removeCookPhoto, addCookNote, addCookTag, removeCookTag,
    startNewRecipe, editRecipe, viewRecipeDetail, saveRecipeEntry, deleteRecipe,
    updateRecipe, addIngredient, removeIngredient, updateIngredient,
    rankedCooks, previousCooksOfMeat, cooksUsingRecipe,
    rubRecipes, sauceRecipes, fullCookRecipes, filteredRecipes,
    uniqueSmokerTypes, uniqueMeatTypes, uniqueTags,
    persistCooks, persistRecipes,
    savedNotice, setSavedNotice,
    syncWithCloud, cookSyncStatus,
    friendCooks, friendRecipes,
  };

  return <CookContext.Provider value={value}>{children}</CookContext.Provider>;
}
