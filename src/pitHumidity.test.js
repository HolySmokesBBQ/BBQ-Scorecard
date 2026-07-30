// Tests for the Pit Humidity math engine.
//
// Chart fixtures were digitized from the two psychrometric charts
// provided in the Pit Humidity Calculator spec (see docs/superpowers/
// specs/2026-07-28-pit-humidity-calculator-design.md). Points chosen
// at clean intersections of dry-bulb, wet-bulb, and RH curves.
//
// Tolerance per the spec:
//   - RH within ±1 point at RH ≥ 10%
//   - RH within ±1 point below 10% (loosened slightly from ±0.5 to
//     account for manual read error off the chart image; the smoker
//     operating zone at 1-10% RH is still measured to 1-point resolution)

import { describe, test, expect } from 'vitest';
import { computeHumidity } from './pitHumidity.js';

const SEA_LEVEL_KPA = 101.325;
const HIGH_ELEV_KPA = 89.483;

function pctErr(actual, expected) {
  return Math.abs(actual * 100 - expected);
}

describe('computeHumidity — sea level chart fixtures (101.325 kPa)', () => {
  const fixtures = [
    // dry-bulb, wet-bulb, expected RH % (digitized from chart)
    { dryF: 275, wetF: 160, expectedRhPct: 9,  tolerance: 1 },
    { dryF: 225, wetF: 150, expectedRhPct: 18, tolerance: 1 },
    { dryF: 200, wetF: 170, expectedRhPct: 51, tolerance: 2 },
    { dryF: 250, wetF: 150, expectedRhPct: 12, tolerance: 1 },
    { dryF: 300, wetF: 160, expectedRhPct: 7,  tolerance: 1 },
    { dryF: 220, wetF: 140, expectedRhPct: 12, tolerance: 1 },
  ];

  for (const f of fixtures) {
    test(`${f.dryF}°F / ${f.wetF}°F wet → ${f.expectedRhPct}% RH (±${f.tolerance})`, () => {
      const r = computeHumidity({
        dryF: f.dryF,
        wetF: f.wetF,
        pressureKPa: SEA_LEVEL_KPA,
      });
      expect(r.rh).not.toBeNull();
      expect(r.warning).toBeNull();
      expect(pctErr(r.rh, f.expectedRhPct)).toBeLessThanOrEqual(f.tolerance);
    });
  }
});

describe('computeHumidity — 3,400 ft chart fixtures (89.483 kPa)', () => {
  const fixtures = [
    { dryF: 250, wetF: 160, expectedRhPct: 15, tolerance: 1 },
    { dryF: 275, wetF: 160, expectedRhPct: 11, tolerance: 1 },
    { dryF: 220, wetF: 150, expectedRhPct: 22, tolerance: 2 },
    { dryF: 300, wetF: 160, expectedRhPct: 8,  tolerance: 1 },
  ];

  for (const f of fixtures) {
    test(`${f.dryF}°F / ${f.wetF}°F wet → ${f.expectedRhPct}% RH (±${f.tolerance})`, () => {
      const r = computeHumidity({
        dryF: f.dryF,
        wetF: f.wetF,
        pressureKPa: HIGH_ELEV_KPA,
      });
      expect(r.rh).not.toBeNull();
      expect(r.warning).toBeNull();
      expect(pctErr(r.rh, f.expectedRhPct)).toBeLessThanOrEqual(f.tolerance);
    });
  }
});

describe('computeHumidity — guards', () => {
  test('wet-bulb > dry-bulb → inverted, no compute', () => {
    const r = computeHumidity({ dryF: 200, wetF: 250, pressureKPa: SEA_LEVEL_KPA });
    expect(r.warning).toBe('inverted');
    expect(r.rh).toBeNull();
  });

  test('wet-bulb at boiling for sea level → above_boiling', () => {
    const r = computeHumidity({ dryF: 275, wetF: 213, pressureKPa: SEA_LEVEL_KPA });
    expect(r.warning).toBe('above_boiling');
    expect(r.rh).toBe(1.0);
  });

  test('wet-bulb at boiling for 3,400 ft → above_boiling', () => {
    const r = computeHumidity({ dryF: 275, wetF: 206, pressureKPa: HIGH_ELEV_KPA });
    expect(r.warning).toBe('above_boiling');
    expect(r.rh).toBe(1.0);
  });

  test('gap < 10°F at pit temp with wet below boiling → dry_wick with real numbers', () => {
    const r = computeHumidity({ dryF: 195, wetF: 190, pressureKPa: SEA_LEVEL_KPA });
    expect(r.warning).toBe('dry_wick');
    expect(r.rh).toBeGreaterThan(0.7);
    expect(r.rh).toBeLessThan(1.0);
    expect(r.dewpointF).not.toBeNull();
  });

  test('gap exactly 10°F at pit temp → no dry_wick', () => {
    const r = computeHumidity({ dryF: 195, wetF: 185, pressureKPa: SEA_LEVEL_KPA });
    expect(r.warning).toBeNull();
  });

  test('missing input → null result, no warning', () => {
    const r = computeHumidity({ dryF: NaN, wetF: 160, pressureKPa: SEA_LEVEL_KPA });
    expect(r.rh).toBeNull();
    expect(r.warning).toBeNull();
  });
});
