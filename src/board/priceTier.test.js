// Tests for the price trust tier.
//
// Board shows three kinds of price and a user needs to know which they're
// looking at: one Joel checked in person, one a machine read off a shop's
// own website, and one a stranger typed in. Before this there were only
// two tiers and scan prices rendered as anonymous community submissions,
// which undersells them — a shop's own published price is more trustworthy
// than an unattributed entry, just not as good as someone standing in the
// store.
//
// The tier derives ONLY from the server-validated `source` field. It must
// never derive from the document id: a client can mint a docId beginning
// 'seed_' or 'scan_' and forge a badge on a fake price
// (SECURITY-AUDIT-BOARD-DEEP.md Finding B-2).

import { describe, test, expect } from 'vitest';
import { priceTier, scanBadgeLabel } from './priceTier.js';

describe('priceTier', () => {
  test('operator_verified is the verified tier', () => {
    expect(priceTier({ source: 'operator_verified' })).toBe('verified');
  });

  test('scan is its own tier', () => {
    expect(priceTier({ source: 'scan' })).toBe('scan');
  });

  test('community and anything unrecognised fall through to community', () => {
    expect(priceTier({ source: 'community' })).toBe('community');
    expect(priceTier({ source: 'chain_catalog' })).toBe('community');
    expect(priceTier({ source: 'something_new' })).toBe('community');
    expect(priceTier({})).toBe('community');
  });

  test('a missing price has no tier', () => {
    expect(priceTier(null)).toBe(null);
    expect(priceTier(undefined)).toBe(null);
  });

  test('the docId cannot grant a tier — only `source` can', () => {
    // Finding B-2: forging the badge via a self-minted document id.
    expect(priceTier({ id: 'seed_fake', source: 'community' })).toBe('community');
    expect(priceTier({ id: 'scan_fake', source: 'community' })).toBe('community');
    expect(priceTier({ id: 'seed_fake' })).toBe('community');
  });
});

describe('scanBadgeLabel', () => {
  test('reads "Shop website · checked <Mon D>" from reportedAt', () => {
    expect(scanBadgeLabel('2026-09-11T09:15:00.000Z')).toBe('Shop website · checked Sep 11');
    expect(scanBadgeLabel('2026-01-02T12:00:00.000Z')).toBe('Shop website · checked Jan 2');
  });

  test('falls back to the bare label when the date is missing or unparseable', () => {
    expect(scanBadgeLabel(null)).toBe('Shop website');
    expect(scanBadgeLabel(undefined)).toBe('Shop website');
    expect(scanBadgeLabel('not a date')).toBe('Shop website');
  });

  test('accepts a Date as well as an ISO string', () => {
    expect(scanBadgeLabel(new Date('2026-09-11T09:15:00.000Z'))).toBe('Shop website · checked Sep 11');
  });
});
