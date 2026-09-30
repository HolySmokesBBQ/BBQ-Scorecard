// Trust tier for a price row.
//
// Three kinds of price, and the user needs to tell them apart:
//   operator_verified — Joel saw it in the store. Highest trust.
//   scan              — read off the shop's own published listing by the
//                       nightly scan. Attributable and dated, but nobody
//                       stood in the store.
//   community         — a user typed it in. The default.
//
// Derives ONLY from the server-validated `source` field, never from the
// document id: a client can mint a docId beginning 'seed_' or 'scan_' and
// would otherwise forge a badge onto a fake price
// (SECURITY-AUDIT-BOARD-DEEP.md Finding B-2).

export function priceTier(price) {
  if (!price) return null;
  if (price.source === 'operator_verified') return 'verified';
  if (price.source === 'scan') return 'scan';
  return 'community';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Shop website · checked Sep 11". The date is the scan's own reportedAt,
// so the badge says when the price was actually read rather than when it
// was published. Degrades to the bare label if the date is unusable —
// a missing date should cost the provenance, not the badge.
export function scanBadgeLabel(reportedAt) {
  if (!reportedAt) return 'Shop website';
  const d = reportedAt instanceof Date ? reportedAt : new Date(reportedAt);
  if (Number.isNaN(d.getTime())) return 'Shop website';
  return `Shop website · checked ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
