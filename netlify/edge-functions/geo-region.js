// Region cookie for the analytics consent banner (L-1, website).
//
// Netlify resolves the visitor's country at the edge. This function tags
// HTML responses with a short-lived cookie the page reads to decide whether
// to show the consent banner:
//   hs_geo=eu       EEA + UK + Switzerland: banner, analytics off until yes
//   hs_geo=other    everywhere else: no banner, current behaviour
//   hs_geo=unknown  geo lookup returned nothing: treated like "other"
//
// The cookie governs DISPLAY only. Enforcement is Consent Mode's
// region-scoped default in gtm-init.js, which Google applies server-side
// from the visitor's IP. So if this function misses (cold edge, missing
// geo, cookie blocked), an EEA visitor still has analytics_storage denied
// at Google's end; the failure mode is lost data, never unlawful
// collection. That is why "unknown" falls to US behaviour rather than
// showing everyone a banner.
//
// Runs on every request but does its work only for HTML navigations
// (Accept: text/html); assets pass straight through. It is not a cached
// response, so one visitor's cookie can never be served to another.
//
// The cookie is strictly necessary for the consent mechanism itself and
// carries no identifier, so it needs no consent of its own (ePrivacy 5(3)
// exemption). Keep the same list in sync with EEA_UK_CH in gtm-init.js.

const EEA_UK_CH = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
]);

export default async (request, context) => {
  const accept = request.headers.get('accept') || '';
  if (!accept.includes('text/html')) return; // not a page: let it through untouched

  const response = await context.next();
  const code = String(context.geo?.country?.code || '').toUpperCase();
  const region = !code ? 'unknown' : (EEA_UK_CH.has(code) ? 'eu' : 'other');

  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', `hs_geo=${region}; Path=/; Max-Age=86400; SameSite=Lax; Secure`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const config = { path: '/*' };
