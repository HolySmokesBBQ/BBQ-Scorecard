// "BBQ Near Me" location minimisation (legal register #6, 2026-10-14).
//
// The Overpass query used to carry the device's full-precision lat/lng to
// overpass-api.de, which made Play's "Approximate location" declaration
// false. Now only a 0.1-degree-rounded point leaves the phone (about 10 km,
// above Google's 3 km^2 "approximate" bar), the search radius is padded by
// the worst-case rounding error so nothing inside the user's real radius is
// missed, and results are filtered on the device against the true position.

import { describe, test, expect } from 'vitest';
import { coarsen, ROUNDING_PAD_M, buildOverpassQuery, metersBetween, withinRadius } from './nearbyQuery.js';

describe('only a rounded point leaves the phone', () => {
  test('coordinates round to one decimal place', () => {
    expect(coarsen(43.07312345)).toBe(43.1);
    expect(coarsen(-88.24987)).toBe(-88.2);
    expect(coarsen(43.04999)).toBe(43);
  });

  test('the query string carries no more than one decimal of the position', () => {
    const q = buildOverpassQuery(43.0731234, -89.4012345, 40000);
    expect(q).not.toMatch(/43\.07/);
    expect(q).not.toMatch(/-89\.40/);
    // Every coordinate in the query has at most one decimal digit.
    for (const m of q.matchAll(/around:(\d+),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
      expect(m[2]).toMatch(/^-?\d+(\.\d)?$/);
      expect(m[3]).toMatch(/^-?\d+(\.\d)?$/);
    }
  });

  test('the radius is padded by the worst-case rounding offset', () => {
    const q = buildOverpassQuery(43.0731, -89.4012, 40000);
    const radii = [...q.matchAll(/around:(\d+),/g)].map((m) => Number(m[1]));
    expect(radii.length).toBe(2);
    for (const r of radii) expect(r).toBe(40000 + ROUNDING_PAD_M);
  });

  test('the pad covers the farthest a point can sit from its rounded centre', () => {
    // Worst case is a corner of a 0.1-degree cell: 0.05 deg in each axis.
    // At the equator the longitude term is largest.
    const worst = metersBetween(0.05, 0.05, 0, 0);
    expect(ROUNDING_PAD_M).toBeGreaterThanOrEqual(worst);
  });
});

describe('results are still exact on the device', () => {
  test('anything outside the real radius is dropped, anything inside kept', () => {
    const me = { lat: 43.0731, lng: -89.4012 };
    const near = { name: 'near', lat: 43.08, lng: -89.40 };   // ~0.8 km
    const far = { name: 'far', lat: 43.30, lng: -89.40 };     // ~25 km
    const kept = withinRadius([near, far], me.lat, me.lng, 16000).map((r) => r.name);
    expect(kept).toEqual(['near']);
  });

  test('metersBetween is a sane haversine', () => {
    // One degree of latitude is ~111.2 km.
    expect(Math.round(metersBetween(43, -89, 44, -89) / 100)).toBe(1112);
  });
});
