// Bulk CSV export — flattens every cook (or recipe) into a single CSV
// row each, suitable for backup, spreadsheet analysis, or migration to
// other tools. Lives outside the component tree so it can be lazy-loaded
// only when the user taps Export from the Stats page.
//
// Photo blobs are intentionally NOT included — they would balloon the
// file size into megabytes and most spreadsheet tools choke on giant
// base64 strings anyway. The cook PDF export (cookPdf.js) is the right
// vehicle for photos. Photo COUNT is included so the user knows how
// many photos a row has.

const COOK_COLUMNS = [
  'id', 'name', 'date', 'meatType', 'cut', 'weight',
  'smoker', 'wood', 'fuel', 'rub', 'sauce', 'brine',
  'cookTemp', 'targetInternalTemp',
  'cookTimeHours', 'cookTimeMinutes',
  'wrap', 'restMinutes', 'weather', 'outdoorTemp',
  'rating', 'tags', 'photoCount',
  'notes', 'whatIdChange',
];

const RECIPE_COLUMNS = [
  'id', 'name', 'type', 'createdAt',
  'cookMethod', 'preparation',
  'ingredientCount', 'ingredients',
  'notes',
];

export function exportAllCooksToCsv(cooks) {
  const safeCooks = Array.isArray(cooks) ? cooks : [];
  const rows = safeCooks.map(c => COOK_COLUMNS.map(col => formatCookField(c, col)));
  download(toCsv([COOK_COLUMNS, ...rows]), `BBQ-Notebook-cooks-${todayIso()}.csv`);
  return safeCooks.length;
}

export function exportAllRecipesToCsv(recipes) {
  const safeRecipes = Array.isArray(recipes) ? recipes : [];
  const rows = safeRecipes.map(r => RECIPE_COLUMNS.map(col => formatRecipeField(r, col)));
  download(toCsv([RECIPE_COLUMNS, ...rows]), `BBQ-Notebook-recipes-${todayIso()}.csv`);
  return safeRecipes.length;
}

// ── Field formatters ───────────────────────────────────────────

function formatCookField(c, col) {
  switch (col) {
    case 'tags':       return Array.isArray(c.tags) ? c.tags.join('; ') : '';
    case 'photoCount': return Array.isArray(c.photos) ? c.photos.length : 0;
    default:           return c[col] == null ? '' : c[col];
  }
}

function formatRecipeField(r, col) {
  switch (col) {
    case 'ingredientCount':
      return Array.isArray(r.ingredients) ? r.ingredients.length : 0;
    case 'ingredients':
      return Array.isArray(r.ingredients)
        ? r.ingredients
            .map(i => `${i?.amount || ''} ${i?.unit || ''} ${i?.name || ''}`.trim())
            .filter(Boolean)
            .join(' | ')
        : '';
    default:
      return r[col] == null ? '' : r[col];
  }
}

// ── CSV writer ─────────────────────────────────────────────────

function toCsv(rows) {
  return rows.map(row => row.map(csvField).join(',')).join('\r\n');
}

function csvField(v) {
  if (v == null) return '';
  const s = String(v);
  // Always quote if the field contains comma, quote, CR, or LF.
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function download(text, filename) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}
