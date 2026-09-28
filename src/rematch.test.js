import { describe, test, expect, vi } from 'vitest';

// scoring.js reads window.GA_MEASUREMENT_ID at import time; give it one.
vi.hoisted(() => { globalThis.window ??= {}; });
import { findLastVisit, compareVisits } from './rematch.js';

const rev = (id, restaurant, date, scores) => ({ id, restaurant, date, scores });

describe('findLastVisit', () => {
  const march = rev('a', 'Kewpie BBQ', '2026-03-14', { taste: 6, smoke: 5 });
  const june = rev('b', 'kewpie bbq ', '2026-06-02', { taste: 7, smoke: 7 });
  const other = rev('c', 'Some Other Joint', '2026-07-01', { taste: 9 });

  test('returns the most recent earlier visit to the same joint, ignoring case and spaces', () => {
    const cur = rev('new', 'Kewpie BBQ', '2026-09-28', {});
    expect(findLastVisit([march, june, other], cur)?.id).toBe('b');
  });

  test('never returns the review itself', () => {
    expect(findLastVisit([march, june], june)?.id).toBe('a');
  });

  test('ignores visits dated after the one being viewed', () => {
    expect(findLastVisit([march, june], march)).toBeNull();
  });

  test('ignores earlier visits that have no scores', () => {
    const blank = rev('d', 'Kewpie BBQ', '2026-08-01', {});
    const cur = rev('new', 'Kewpie BBQ', '2026-09-28', {});
    expect(findLastVisit([march, blank], cur)?.id).toBe('a');
  });

  test('same-day visits count as earlier', () => {
    const lunch = rev('e', 'Kewpie BBQ', '2026-09-28', { taste: 8 });
    const cur = rev('new', 'Kewpie BBQ', '2026-09-28', {});
    expect(findLastVisit([lunch], cur)?.id).toBe('e');
  });

  test('blank restaurant name never matches', () => {
    expect(findLastVisit([rev('x', '', '2026-01-01', { taste: 5 })], rev('y', '', '2026-02-01', {}))).toBeNull();
  });
});

describe('compareVisits', () => {
  test('composite delta and category moves, biggest first, unscored categories skipped', () => {
    const prev = { taste: 6, smoke: 5, sauce: 7, service: 8 };
    const cur = { taste: 8, smoke: 4, sauce: 7 };
    const cmp = compareVisits(prev, cur);
    expect(cmp.moves.map(m => [m.key, m.delta])).toEqual([['taste', 2], ['smoke', -1]]);
    expect(cmp.moves[0].label).toBe('Taste / Flavor');
    expect(cmp.compositeDelta).toBeCloseTo((8 + 4 + 7) / 3 - (6 + 5 + 7) / 3 - 1.25, 5);
  });

  test('no scores on the new visit yet means no delta', () => {
    expect(compareVisits({ taste: 6 }, {}).compositeDelta).toBeNull();
  });
});
