// "BBQ Near Me" query building with location minimisation (legal register
// #6, 2026-10-14). See nearbyQuery.test.js for the why.
//
// Only coarsen()'d coordinates may appear in anything sent off the device.
// The precise fix stays on the phone for the "You are here" marker, the
// distance labels and the final radius filter.

// One decimal place of a degree: about 11 km north-south and 8 km east-west
// in Wisconsin, an area well above Google Play's 3 km^2 line for
// "approximate location".
export const coarsen = (deg) => Math.round(deg * 10) / 10;

export function metersBetween(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// The farthest a real position can sit from its rounded centre is a cell
// corner, 0.05 degrees off in both axes: about 7.9 km at the equator, less
// anywhere else. Padding the search radius by that much means the coarse
// query still returns everything inside the user's real radius.
export const ROUNDING_PAD_M = 8000;

export function buildOverpassQuery(lat, lng, radiusM) {
  const cLat = coarsen(lat);
  const cLng = coarsen(lng);
  const r = radiusM + ROUNDING_PAD_M;
  return `[out:json][timeout:25];(nwr["cuisine"~"bbq|barbecue",i](around:${r},${cLat},${cLng});nwr["name"~"smokehouse|smokehaus",i]["amenity"](around:${r},${cLat},${cLng}););out center body;`;
}

// Drop anything the padded query returned that is outside the real radius,
// measured from the precise on-device position.
export function withinRadius(results, lat, lng, radiusM) {
  return results.filter((r) => metersBetween(lat, lng, r.lat, r.lng) <= radiusM);
}
