// What Board's usage-analytics consent card tells the user, and the
// inventory it was written from.
//
// Board can't render the shared src/components/ConsentCard.jsx: that card
// reads its palette from Scorecard's AppContext, which would pull
// Scorecard's Firebase setup into Board. So Board keeps its own copy here,
// with the same sentence shape and the same consent.js gate underneath.
//
// The sentence was written from an inventory of every analytics call in
// Board's source (2026-10-07, re-checked 2026-10-12 for 2.4.6), not from
// memory of what the app does. Google Analytics never receives the price
// itself, shop names, notes, coordinates, or search text (only its length).
// consentInventory.test.js fails if a new tracked parameter shows up that
// this file hasn't accounted for.

export const BOARD_CONSENT = {
  name: 'BBQ Board',
  purpose:
    'That covers which screens and features you use, plus the city you pick ' +
    '(and how far away it is when you use Near me), the cuts and store types ' +
    'you filter by, the cut, store type and region of any price you submit, ' +
    'and a short code for any error the app runs into. ' +
    "It isn't linked to your account, name, or email.",
  privacyUrl: 'https://holysmokesbbqco.com/privacy-board.html',
};

// Every parameter key Board sends, mapped to the part of the sentence that
// discloses it.
export const DISCLOSED_PARAMS = {
  // "which screens and features you use"
  view: 'features', source: 'features', radius: 'features', target: 'features',
  from: 'features', to: 'features', at_card: 'features', query_length: 'features',
  hit_count: 'features', fileType: 'features', proposals: 'features',
  proposalCount: 'features', successCount: 'features', failCount: 'features',
  shopMode: 'features', anon: 'features', signed_in: 'features',
  // After-post sheet: 'another' or 'done' (2.4.9).
  action: 'features',
  // true/false only since 2.4.6; the shop id itself used to be sent here.
  prefill_shop: 'features', prefill_cut: 'features',
  // "the city you pick (and how far away it is when you use Near me)"
  city: 'location', distance: 'location', state: 'location',
  // "the cuts and store types you filter by"
  meat: 'filters', type: 'filters',
  // "the cut, store type and region of any price you submit"
  cut: 'submission', storeType: 'submission', region: 'submission',
  // "a short code for any error the app runs into" (errorCode() from
  // src/analyticsCodes.js, or the browser's numeric geolocation code)
  error: 'errors', code: 'errors',
};
