// Tests for the weekly-ad price extractor.
//
// The OCR text below is what Tesseract actually returned for a rendered
// "BRISKET $5.99/lb / PORK BUTT $2.49 lb" ad in Board's native build
// (2026-09-29): it read both "lb"s wrong. Before this fix the extractor
// found nothing in that text, and on clean text it filed the pork price
// under brisket.

import { describe, test, expect } from 'vitest';
import { extractPricedPhrases } from './circular.js';

const pick = (rows) => rows.map(r => [r.cut, r.pricePerLb]);

describe('extractPricedPhrases', () => {
  test('reads real Tesseract output with "lb" misread as 1b and Ib', () => {
    expect(pick(extractPricedPhrases('BRISKET $5.99/1b\nPORK BUTT $2.49 Ib\n'))).toEqual([
      ['brisket_choice', 5.99],
      ['pork_shoulder', 2.49],
    ]);
  });

  test('accepts the other common misreads of the l', () => {
    expect(pick(extractPricedPhrases('Tri Tip $9.99 |b'))).toEqual([['tri_tip', 9.99]]);
    expect(pick(extractPricedPhrases('Tri Tip $9.99 LB'))).toEqual([['tri_tip', 9.99]]);
    expect(pick(extractPricedPhrases('Tri Tip $9.99 per pound'))).toEqual([['tri_tip', 9.99]]);
  });

  test("an earlier item's name does not claim the next price", () => {
    expect(pick(extractPricedPhrases('BRISKET $5.99/lb PORK BUTT $2.49 lb'))).toEqual([
      ['brisket_choice', 5.99],
      ['pork_shoulder', 2.49],
    ]);
  });

  test('a name after the price still counts when nothing precedes it', () => {
    expect(pick(extractPricedPhrases('$3.49/lb Spare Ribs'))).toEqual([['spare_ribs', 3.49]]);
  });

  test('ignores prices with no cut and prices that are not per pound', () => {
    expect(extractPricedPhrases('Paper towels $5.99/lb')).toEqual([]);
    expect(extractPricedPhrases('BRISKET $5.99 each')).toEqual([]);
    expect(extractPricedPhrases('')).toEqual([]);
  });
});
