import { CATEGORIES } from './constants.js';
import { calcScores } from './scoring.js';

// Rematch: when you review a joint you've already scored, line the new
// visit up against the last one. Same-joint match is the same rule the
// Detail "VISIT N" badge uses (trimmed, case-insensitive name).

const ALL_CATEGORIES = [...CATEGORIES.bbq, ...CATEGORIES.family];
const norm = (s) => (s || '').trim().toLowerCase();
const hasScores = (scores) => Object.values(scores || {}).some(v => v > 0);

// Most recent scored review of the same joint dated on or before `current`,
// excluding `current` itself. Null when this is the first visit.
export function findLastVisit(reviews, current) {
  const name = norm(current?.restaurant);
  if (!name) return null;
  const date = current.date || '';
  let best = null;
  for (const r of reviews || []) {
    if (!r || r.id === current.id) continue;
    if (norm(r.restaurant) !== name) continue;
    if (!hasScores(r.scores)) continue;
    if (date && (r.date || '') > date) continue;
    if (!best || (r.date || '') > (best.date || '')) best = r;
  }
  return best;
}

// Per-category moves (only categories scored on both visits), biggest
// absolute move first, plus the composite change. compositeDelta is null
// until the new visit has at least one score.
export function compareVisits(prevScores, curScores) {
  const moves = ALL_CATEGORIES
    .filter(c => prevScores?.[c.key] > 0 && curScores?.[c.key] > 0)
    .map(c => ({ key: c.key, label: c.label, prev: prevScores[c.key], cur: curScores[c.key], delta: curScores[c.key] - prevScores[c.key] }))
    .filter(m => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const compositeDelta = hasScores(curScores)
    ? calcScores(curScores).composite - calcScores(prevScores || {}).composite
    : null;
  return { moves, compositeDelta };
}

// "Mar 14" (or "Mar 14, 2025" when it's not this year) from an ISO date.
export function shortVisitDate(iso) {
  if (!iso) return 'your last visit';
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d)) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
