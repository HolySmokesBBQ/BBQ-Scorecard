import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { STAR_COLORS, GEOCODE_CACHE_KEY } from '../constants.js';
import { calcScores, track } from '../scoring.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function Map() {
  const {
    S, setView, reviews, mapLoading, setMapLoading, mapRef,
  } = useAppContext();

  // Map initialization
  useEffect(() => {
    if (!mapRef.current) return;

    track('map_viewed', { reviews: reviews.length });
    let cancelled = false;
    setMapLoading(true);

    const map = L.map(mapRef.current).setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 100);

    const geocodeCache = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}');

    (async () => {
      const bounds = [];
      const locations = [...new Set(reviews.filter(r => r.location).map(r => r.location))];

      for (const loc of locations) {
        if (cancelled) return;

        let coords = geocodeCache[loc];
        if (!coords) {
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`
            );
            const data = await resp.json();
            if (data[0]) {
              coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
              geocodeCache[loc] = coords;
            }
            await new Promise(r => setTimeout(r, 1100));
          } catch { continue; }
        }

        if (!coords) continue;

        const locReviews = reviews.filter(r => r.location === loc);
        locReviews.forEach((r, idx) => {
          const sc = calcScores(r.scores);
          const offset = idx * 0.003;
          const marker = L.circleMarker([coords.lat + offset * 0.5, coords.lng + offset], {
            radius: 10,
            fillColor: STAR_COLORS[sc.stars] || '#888',
            color: '#fff',
            weight: 2,
            fillOpacity: 0.9,
          })
            .bindPopup(
              `<div style="font-family:Inter,sans-serif;font-size:13px">` +
              `<b>${r.restaurant}</b><br>${r.location}<br>` +
              `<span style="color:#fbbf24">${'★'.repeat(sc.stars)}${'☆'.repeat(5 - sc.stars)}</span> ` +
              `<b>${sc.composite.toFixed(2)}</b></div>`
            )
            .addTo(map);
          marker.on('click', () => track('map_pin_clicked', { restaurant: r.restaurant || '', stars: sc.stars }));

          bounds.push([coords.lat + offset * 0.5, coords.lng + offset]);
        });
      }

      localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache));
      if (!cancelled) {
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
        setMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      map.remove();
      // Leaflet injects white backgrounds — force restore on both html and body
      document.documentElement.style.background = S.bg;
      document.body.style.background = S.bg;
    };
  }, []);

  return (
    <div className="bbq-container" style={{ padding: '16px' }}>
      <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '12px' }}>BBQ Map</h2>

      {mapLoading && (
        <div style={{ textAlign: 'center', color: S.muted, fontSize: '13px', marginBottom: '8px' }}>
          Locating restaurants...
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[5, 4, 3, 2, 1].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: S.muted }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: STAR_COLORS[s], border: '2px solid #fff' }} />
            {s}{'★'}
          </div>
        ))}
      </div>

      <div ref={mapRef} style={{
        width: '100%', height: '60vh', borderRadius: '8px', border: `1px solid ${S.border}`,
        background: S.dark,
      }} />

      {reviews.filter(r => r.location).length === 0 && (
        <div style={{ textAlign: 'center', color: S.muted, fontSize: '13px', marginTop: '12px' }}>
          Add locations to your reviews to see them on the map.
        </div>
      )}
    </div>
  );
}
