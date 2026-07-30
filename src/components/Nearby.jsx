import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function Nearby() {
  const {
    S, sBtn, setView, navigateTo,
    nearbyStatus, setNearbyStatus,
    nearbyResults, setNearbyResults,
    nearbyRadius, setNearbyRadius,
    nearbyMapRef,
  } = useAppContext();

  // Nearby BBQ — Overpass API map
  useEffect(() => {
    if (!nearbyMapRef.current) return;

    let cancelled = false;
    let map = null;

    const initMap = async () => {
      setNearbyStatus('locating');
      setNearbyResults([]);
      let userLat, userLng;
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: false });
        });
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
      } catch (e) {
        if (!cancelled) setNearbyStatus('denied');
        return;
      }

      if (cancelled) return;

      map = L.map(nearbyMapRef.current).setView([userLat, userLng], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);
      setTimeout(() => map.invalidateSize(), 100);

      L.circleMarker([userLat, userLng], {
        radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 0.9,
      }).bindPopup('<b>You are here</b>').addTo(map);

      setNearbyStatus('searching');
      try {
        const query = `[out:json][timeout:25];(nwr["cuisine"~"bbq|barbecue",i](around:${nearbyRadius},${userLat},${userLng});nwr["name"~"smokehouse|smokehaus",i]["amenity"](around:${nearbyRadius},${userLat},${userLng}););out center body;`;
        const resp = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const data = await resp.json();

        if (cancelled) return;

        const seen = new Set();
        const results = [];
        for (const el of (data.elements || [])) {
          const lat = el.lat || el.center?.lat;
          const lon = el.lon || el.center?.lon;
          if (!lat || !lon) continue;
          const key = `${(el.tags?.name || '').toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({
            name: el.tags?.name || 'BBQ Restaurant',
            lat: lat,
            lng: lon,
            address: [el.tags?.['addr:street'], el.tags?.['addr:city'], el.tags?.['addr:state']].filter(Boolean).join(', '),
            cuisine: el.tags?.cuisine || '',
            phone: el.tags?.phone || el.tags?.['contact:phone'] || '',
            website: el.tags?.website || el.tags?.['contact:website'] || '',
          });
        }

        setNearbyResults(results);
        setNearbyStatus('done');

        // Haversine distance in miles, so we can label each popup with
        // "0.8 mi away" — the single most useful bit of info someone
        // scanning the map wants ("which of these is closest?").
        const milesBetween = (aLat, aLng, bLat, bLng) => {
          const toRad = d => d * Math.PI / 180;
          const R = 3958.8;
          const dLat = toRad(bLat - aLat);
          const dLng = toRad(bLng - aLng);
          const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
          return 2 * R * Math.asin(Math.sqrt(s));
        };

        const bounds = [[userLat, userLng]];
        results.forEach(r => {
          const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
          const distMi = milesBetween(userLat, userLng, r.lat, r.lng);

          // SECURITY: OSM POI data is world-editable. Never concatenate
          // it into an HTML string — Leaflet's bindPopup would innerHTML
          // an attacker's payload straight into a Capacitor WebView with
          // no CSP and native-bridge access. Build the popup as DOM
          // nodes; textContent handles all encoding automatically. For
          // the website link we also scheme-check (http/https only) so
          // an attacker can't slip in javascript: or data: URIs.
          const el = document.createElement('div');
          el.style.cssText = 'font-family:Inter,sans-serif;font-size:13px;min-width:160px';

          const nameEl = document.createElement('b');
          nameEl.style.fontSize = '14px';
          nameEl.textContent = r.name;
          el.appendChild(nameEl);

          const distEl = document.createElement('div');
          distEl.style.cssText = 'color:#d4782f;font-size:12px;font-weight:600;margin-top:2px';
          distEl.textContent = distMi < 0.1
            ? '< 0.1 mi away'
            : `${distMi.toFixed(1)} mi away`;
          el.appendChild(distEl);

          if (r.address) {
            el.appendChild(document.createElement('br'));
            const addr = document.createElement('span');
            addr.style.color = '#666';
            addr.textContent = r.address;
            el.appendChild(addr);
          }
          if (r.phone) {
            el.appendChild(document.createElement('br'));
            el.appendChild(document.createTextNode(r.phone));
          }

          el.appendChild(document.createElement('br'));
          const dir = document.createElement('a');
          dir.href = directionsUrl;
          dir.target = '_blank';
          dir.rel = 'noopener';
          dir.style.cssText = 'color:#d4782f;font-weight:600';
          dir.textContent = 'Get Directions';
          el.appendChild(dir);

          if (r.website && /^https?:\/\//i.test(r.website)) {
            el.appendChild(document.createTextNode(' · '));
            const site = document.createElement('a');
            site.href = r.website;
            site.target = '_blank';
            site.rel = 'noopener';
            site.style.color = '#d4782f';
            site.textContent = 'Website';
            el.appendChild(site);
          }

          L.circleMarker([r.lat, r.lng], {
            radius: 14, fillColor: '#d4782f', color: '#fff', weight: 2, fillOpacity: 0.9,
          }).bindPopup(el).addTo(map);

          bounds.push([r.lat, r.lng]);
        });

        if (results.length > 0 && map) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
        }

        track('nearby_search', { results: results.length, radius: nearbyRadius });
      } catch (e) {
        if (!cancelled) {
          setNearbyStatus('error');
          console.error('Overpass query failed:', e);
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (map) map.remove();
      document.documentElement.style.background = S.bg;
      document.body.style.background = S.bg;
    };
  }, [nearbyRadius]);

  return (
    <div className="bbq-container" style={{ padding: '16px' }}>
      <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '4px' }}>BBQ Near Me</h2>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '12px' }}>
        {nearbyStatus === 'locating' ? 'Finding your location...' :
         nearbyStatus === 'searching' ? 'Searching for BBQ nearby...' :
         nearbyStatus === 'denied' ? 'Location access denied.' :
         nearbyStatus === 'error' ? 'Search failed. Try again.' :
         `${nearbyResults.length} BBQ spot${nearbyResults.length !== 1 ? 's' : ''} found nearby`}
      </div>

      {/* Radius selector */}
      {nearbyStatus !== 'denied' && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {[{label: '10 mi', val: 16000}, {label: '25 mi', val: 40000}, {label: '50 mi', val: 80000}].map(r => (
            <button key={r.val} onClick={() => setNearbyRadius(r.val)}
              style={sBtn(nearbyRadius === r.val, true)}>{r.label}</button>
          ))}
        </div>
      )}

      {nearbyStatus === 'denied' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '14px', color: S.muted, marginBottom: '12px' }}>
            Allow location access in your browser settings to find BBQ restaurants near you.
          </div>
          <button onClick={() => { setNearbyStatus('locating'); setView('home'); setTimeout(() => navigateTo('nearby'), 100); }}
            style={sBtn(true, false)}>Try Again</button>
        </div>
      )}

      <div ref={nearbyMapRef} style={{
        width: '100%', height: nearbyStatus === 'denied' ? '0' : '55vh',
        borderRadius: '8px', border: nearbyStatus === 'denied' ? 'none' : `1px solid ${S.border}`,
        background: S.dark,
      }} />

      {/* Results list below map */}
      {nearbyStatus === 'done' && nearbyResults.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '8px' }}>Results</div>
          {nearbyResults.map((r, i) => (
            <a key={i} href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
              target="_blank" rel="noopener"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{
                padding: '12px', background: S.card, borderRadius: '8px', marginBottom: '6px',
                border: `1px solid ${S.border}`, cursor: 'pointer',
              }}>
                <div style={{ fontWeight: '600', fontSize: '14px', color: S.text }}>{r.name}</div>
                {r.address && <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>{r.address}</div>}
                <div style={{ fontSize: '12px', color: S.accent, marginTop: '4px', fontWeight: '500' }}>Get Directions</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {nearbyStatus === 'done' && nearbyResults.length === 0 && (
        <div style={{ textAlign: 'center', color: S.muted, fontSize: '14px', marginTop: '24px' }}>
          No BBQ restaurants found in this area. Try a wider radius.
        </div>
      )}
    </div>
  );
}
