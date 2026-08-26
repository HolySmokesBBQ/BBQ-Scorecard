import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth';
import { signInAnonymously } from './firebase.board.js';
import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
  orderBy, limit,
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase.board.js';
import {
  CUTS, CUT_ORDER, MEATS, TOP_MEATS, CUT_TO_MEAT,
  REGIONS, CITIES, CITY_ORDER, RADIUS_OPTIONS, DEFAULT_RADIUS,
  STATES, STATE_LABELS,
  STORE_TYPES,
  ageInDays, isFresh, isStale, nearestCity,
} from './board/schema.js';
import { SEED_PRICES } from './board/seed.js';
import { SHOPS, shopsForRegion, shopsNear, getShop, shopLatLng } from './board/shops.js';
import { extractPricedPhrases } from './board/circular.js';
import Onboarding, { hasOnboarded } from './board/Onboarding.jsx';
import BoardHamburger from './components/BoardHamburger.jsx';
import Calculator from './board/Calculator.jsx';
import Settings from './board/Settings.jsx';
import { sendProblemReport } from './diagnostics.js';
import 'leaflet/dist/leaflet.css';

// ─── palette ───────────────────────────────────────────────────
const PAL = {
  bg: '#1a1a1a',
  panel: '#232830',
  panelDeep: '#1c2027',
  border: '#3a4048',
  brass: '#d4a64a',
  brassDim: '#a17c33',
  text: '#f5e6d3',
  textDim: '#9aa3ad',
  green: '#6a9968',
  amber: '#d4a64a',
  red: '#c26a5c',
  butcherRed: '#8b3a3a',
};

// ─── XSS guard ──────────────────────────────────────────────────
// Any user-provided value (Firestore cut/shop/notes strings, OCR
// text, etc.) that is interpolated into a raw HTML template MUST
// pass through here. Leaflet popups + any innerHTML/setContent
// call site are the primary sinks. Even though the Firestore rules
// whitelist fields, they don't validate values against enums
// (SECURITY-AUDIT-BOARD.md Finding B-5), so a signed-in attacker
// can still write malicious payloads that reach these sinks.
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

// Strip HTML tags + control chars from a note before Firestore
// write. Defense-in-depth for Finding B-8 — even if a rendering
// site forgets to escape, the stored data is already clean.
function sanitizeNote(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]*>/g, '') // strip tags
    .replace(/[\x00-\x1F\x7F]/g, '') // strip control chars
    .slice(0, 500);
}

const track = (event, params = {}) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  try { window.gtag('event', event, { content_group: 'board', ...params }); } catch {}
};

// ─── App ───────────────────────────────────────────────────────
const LS_CITY = 'board:city';
const LS_RADIUS = 'board:radius';
const LS_TYPE = 'board:type';

export default function BoardApp() {
  const [cityId, setCityId] = useState(() => {
    try { return localStorage.getItem(LS_CITY) || 'milwaukee_wi'; } catch { return 'milwaukee_wi'; }
  });
  const [radius, setRadius] = useState(() => {
    try { const v = Number(localStorage.getItem(LS_RADIUS)); return v > 0 ? v : DEFAULT_RADIUS; } catch { return DEFAULT_RADIUS; }
  });
  const [meatFilter, setMeatFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState(() => {
    try { return localStorage.getItem(LS_TYPE) || 'all'; } catch { return 'all'; }
  });
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded());
  const city = CITIES[cityId] || CITIES.milwaukee_wi;
  const region = city.region;

  useEffect(() => { try { localStorage.setItem(LS_CITY, cityId); } catch {} }, [cityId]);
  useEffect(() => { try { localStorage.setItem(LS_RADIUS, String(radius)); } catch {} }, [radius]);
  useEffect(() => { try { localStorage.setItem(LS_TYPE, typeFilter); } catch {} }, [typeFilter]);
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitState, setSubmitState] = useState(null); // { shopId?, cut? } or null

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const q = query(
          collection(db, 'board_prices'),
          where('region', '==', region),
          orderBy('reportedAt', 'desc'),
          limit(500),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const rows = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          reportedAt: d.data().reportedAt?.toDate?.().toISOString?.() ?? d.data().reportedAt,
        }));
        setSubmissions(rows);
      } catch (err) {
        console.error('board_prices read failed', err);
        if (!cancelled) setSubmissions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [region, submitState === null ? 'closed' : 'open']);

  // Build the full prices pool for this region, freshest-first per (shop, cut).
  const allPrices = useMemo(() => {
    const seedForRegion = SEED_PRICES.filter(p => {
      const shop = getShop(p.shopId);
      return shop && shop.region === region;
    });
    const submissionsForRegion = submissions.filter(s => !isStale(s.reportedAt));
    const merged = [...seedForRegion, ...submissionsForRegion];
    // Keep only the newest report per (shopId, cut) pair.
    const byKey = new Map();
    for (const p of merged) {
      const key = `${p.shopId}::${p.cut}`;
      const existing = byKey.get(key);
      if (!existing || new Date(p.reportedAt) > new Date(existing.reportedAt)) {
        byKey.set(key, p);
      }
    }
    return [...byKey.values()];
  }, [submissions, region]);

  // Build shop rows within radius of the selected city, filtered by the
  // meat picker AND the store-type picker. Every shop that survives the
  // filters appears — priced or not — so unpriced ones become submission
  // CTAs.
  const shopRows = useMemo(() => {
    const inRange = shopsNear({ lat: city.lat, lng: city.lng }, radius);
    const meatCuts = meatFilter === 'all' ? null : MEATS[meatFilter]?.cuts || [];
    const typeFiltered = typeFilter === 'all'
      ? inRange
      : inRange.filter(({ shop }) => shop.storeType === typeFilter);
    const rows = typeFiltered.map(({ shop, distance }) => {
      const shopPrices = allPrices.filter(p => p.shopId === shop.id);
      const relevant = meatCuts
        ? shopPrices.filter(p => meatCuts.includes(p.cut))
        : shopPrices;
      const displayPrice = relevant.length
        ? relevant.reduce((min, p) => p.pricePerLb < min.pricePerLb ? p : min)
        : null;
      return { shop, distance, price: displayPrice, allPrices: shopPrices };
    });
    return rows.sort((a, b) => {
      if (a.price && !b.price) return -1;
      if (!a.price && b.price) return 1;
      // Priced results: closest to the selected city first. When two
      // priced shops are within 3 mi of each other, break the tie by
      // cheaper price. This puts "results from this city" ahead of a
      // priced shop 24 mi away, which was the earlier confusing behavior.
      if (a.price && b.price) {
        const distDiff = a.distance - b.distance;
        if (Math.abs(distDiff) > 3) return distDiff;
        return a.price.pricePerLb - b.price.pricePerLb;
      }
      return a.distance - b.distance; // both unpriced — nearest first
    });
  }, [allPrices, city.lat, city.lng, radius, meatFilter, typeFilter]);

  // Store types present at all in range — used to hide chips for types
  // that don't exist near the user (e.g. no farms in Milwaukee metro).
  const availableTypes = useMemo(() => {
    const inRange = shopsNear({ lat: city.lat, lng: city.lng }, radius);
    return new Set(inRange.map(({ shop }) => shop.storeType));
  }, [city.lat, city.lng, radius]);

  // Meats present at all in the region's prices — used to show "extra"
  // chips beyond the always-visible top 5.
  const extraMeats = useMemo(() => {
    const s = new Set();
    for (const p of allPrices) {
      const m = CUT_TO_MEAT[p.cut];
      if (m && !TOP_MEATS.includes(m)) s.add(m);
    }
    return [...s];
  }, [allPrices]);

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [showAbout, setShowAbout] = useState(false);
  const [detailShopId, setDetailShopId] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'calculator' | 'settings'

  const pricedCount = shopRows.filter(r => r.price).length;
  const unpricedCount = shopRows.length - pricedCount;
  const filterLabel = meatFilter === 'all' ? null : MEATS[meatFilter]?.short;

  const handleSignIn = async () => {
    try {
      // In the Capacitor Android app, signInWithPopup opens a Chrome Custom
      // Tab that can't return to the WebView — the user hangs on a blank
      // page. Route through the native @capacitor-firebase/authentication
      // plugin, then hand the resulting Google idToken to the web SDK via
      // signInWithCredential. Same pattern as firebaseSync.firebaseSignIn
      // (Notebook/Scorecard); duplicated here because those apps use a
      // different auth instance (firebase.js vs firebase.board.js).
      const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
      if (isCapacitor) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await FirebaseAuthentication.signInWithGoogle();
        const credential = GoogleAuthProvider.credential(result.credential?.idToken);
        await signInWithCredential(auth, credential);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
      track('board_signin');
    } catch (err) {
      console.error('signin failed', err);
      track('board_signin_failed', { error: err?.code || 'unknown' });
    }
  };

  // Anonymous fallback — signed-in-required at the Firestore rules layer
  // but users don't want to hand over a Google account just to add a price.
  // Anonymous auth still gives us a real uid so shopId construction and
  // duplicate detection keep working.
  const handleSignInAnon = async () => {
    try {
      await signInAnonymously();
      track('board_signin_anon');
    } catch (err) {
      console.error('anon signin failed', err);
      track('board_signin_anon_failed', { error: err?.code || 'unknown' });
      throw err;
    }
  };

  const openSubmit = (prefill = {}) => {
    setSubmitState(prefill);
    track('board_submit_opened', {
      prefill_shop: prefill.shopId || 'none',
      prefill_cut: prefill.cut || 'none',
      signed_in: !!user,
    });
  };

  // ── Sub-screens accessed via the hamburger menu ────────────────
  // Rendered as full-screen replacements (not modals) with the same
  // hamburger + AboutScreen mounted so navigation stays reachable.
  if (view === 'calculator') {
    return (
      <>
        <Calculator onClose={() => setView('home')} />
        <BoardHamburger
          currentView={view}
          onNavigate={setView}
          onAbout={() => { setShowAbout(true); track('board_about_opened'); }}
        />
        {showAbout && <AboutScreen onClose={() => setShowAbout(false)} user={user} />}
      </>
    );
  }

  if (view === 'settings') {
    return (
      <>
        <Settings user={user} onSignIn={handleSignIn} onClose={() => setView('home')} />
        <BoardHamburger
          currentView={view}
          onNavigate={setView}
          onAbout={() => { setShowAbout(true); track('board_about_opened'); }}
        />
        {showAbout && <AboutScreen onClose={() => setShowAbout(false)} user={user} />}
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAL.bg, color: PAL.text }}>
      <Header />
      <BoardHamburger
        currentView={view}
        onNavigate={setView}
        onAbout={() => { setShowAbout(true); track('board_about_opened'); }}
      />
      {showAbout && <AboutScreen onClose={() => setShowAbout(false)} user={user} />}
      <div className="bbq-container-wide" style={{ padding: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', paddingTop: '8px' }}>
          <img src={`${import.meta.env.BASE_URL}bbq-board-logo.png`} alt="BBQ Board"
            style={{ width: '150px', height: '150px', borderRadius: '50%', marginBottom: '8px' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '28px', fontWeight: '700', letterSpacing: '3px', color: PAL.brass, margin: 0 }}>
            BBQ BOARD
          </h1>
          <div style={{ fontSize: '11px', color: PAL.textDim, letterSpacing: '3px', marginTop: '4px' }}>
            by Holy Smokes BBQ Co
          </div>
        </div>
        <IntroCard />

        <LocationPicker
          cityId={cityId}
          radius={radius}
          onCityChange={setCityId}
          onRadiusChange={setRadius}
        />

        <MeatFilter
          extraMeats={extraMeats}
          value={meatFilter}
          onChange={setMeatFilter}
        />

        <StoreTypeFilter
          available={availableTypes}
          value={typeFilter}
          onChange={setTypeFilter}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 4px 8px', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ color: PAL.textDim, fontSize: 13 }}>
            {loading ? 'Loading…' : (
              <>
                <span style={{ color: PAL.text, fontWeight: 700 }}>{pricedCount}</span> priced
                {' · '}
                <span style={{ color: PAL.text, fontWeight: 700 }}>{unpricedCount}</span> waiting on a price
                {filterLabel && (
                  <span> for {filterLabel}</span>
                )}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <ViewToggle value={viewMode} onChange={(v) => { setViewMode(v); track('board_view_toggled', { view: v }); }} />
            <button onClick={() => openSubmit()} style={primaryBtn}>+ Submit a price</button>
          </div>
        </div>

        {viewMode === 'map' ? (
          <BoardMap
            shopRows={shopRows}
            city={city}
            radius={radius}
            onShopTap={(shopId) => { setDetailShopId(shopId); track('board_shop_detail_opened', { source: 'map' }); }}
            onSubmit={(shopId) => openSubmit({
              shopId,
              cut: meatFilter !== 'all' ? (MEATS[meatFilter]?.cuts[0]) : 'brisket_choice',
            })}
          />
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {shopRows.map(row => (
              <ShopCard
                key={row.shop.id}
                shop={row.shop}
                price={row.price}
                distance={row.distance}
                onOpen={() => { setDetailShopId(row.shop.id); track('board_shop_detail_opened', { source: 'list' }); }}
                onSubmit={() => openSubmit({
                  shopId: row.shop.id,
                  cut: meatFilter !== 'all' ? (MEATS[meatFilter]?.cuts[0]) : 'brisket_choice',
                })}
              />
            ))}
          </div>
        )}

        <MissingShopCTA onSubmit={() => openSubmit()} />

        <CircularScrubPanel
          region={region}
          user={user}
          onSignIn={handleSignIn}
          onSignInAnon={handleSignInAnon}
        />

        <Footer />
      </div>

      {submitState !== null && (
        <SubmitModal
          region={region}
          user={user}
          prefillShopId={submitState.shopId}
          prefillCut={submitState.cut}
          onClose={() => setSubmitState(null)}
          onSignIn={handleSignIn}
          onSignInAnon={handleSignInAnon}
        />
      )}

      {detailShopId && (() => {
        const row = shopRows.find(r => r.shop.id === detailShopId);
        if (!row) return null;
        return (
          <ShopDetail
            row={row}
            onClose={() => setDetailShopId(null)}
            onSubmit={(shopId) => {
              setDetailShopId(null);
              openSubmit({ shopId });
            }}
          />
        );
      })()}

      {showOnboarding && <Onboarding onDismiss={() => setShowOnboarding(false)} />}
    </div>
  );
}

const primaryBtn = {
  background: PAL.brass, color: '#111', border: 'none',
  padding: '10px 16px', borderRadius: 6, fontWeight: 700,
  fontSize: 14, cursor: 'pointer', letterSpacing: 0.3,
};

// ─── View toggle (list / map) ─────────────────────────────────
function ViewToggle({ value, onChange }) {
  const btn = (mode, label) => {
    const active = value === mode;
    return (
      <button
        onClick={() => onChange(mode)}
        style={{
          background: active ? PAL.panel : 'transparent',
          color: active ? PAL.text : PAL.textDim,
          border: `1px solid ${active ? PAL.border : 'transparent'}`,
          padding: '6px 10px', fontSize: 13, cursor: 'pointer',
          fontWeight: active ? 700 : 400, borderRadius: 5,
        }}
      >{label}</button>
    );
  };
  return (
    <div style={{
      display: 'inline-flex', background: PAL.panelDeep,
      borderRadius: 6, padding: 2, gap: 2,
    }}>
      {btn('list', '☰ List')}
      {btn('map', '🗺 Map')}
    </div>
  );
}

// ─── Map view ─────────────────────────────────────────────────
const PIN_COLORS = {
  butcher: '#8b3a3a',
  warehouse: '#4a7ab5',
  grocery: '#6a9968',
  farm: '#a07840',
};

function BoardMap({ shopRows, city, radius, onSubmit, onShopTap }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    let L;
    const init = async () => {
      L = (await import('leaflet')).default;

      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      if (!mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [city.lat, city.lng],
        zoom: radius <= 10 ? 12 : radius <= 25 ? 10 : radius <= 50 ? 9 : 7,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const markers = [];
      for (const row of shopRows) {
        const coords = shopLatLng(row.shop);
        if (!coords) continue;

        const color = PIN_COLORS[row.shop.storeType] || '#888';
        const storeType = STORE_TYPES[row.shop.storeType];
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:${color};border:2px solid #fff;
            display:flex;align-items:center;justify-content:center;
            font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4);
          ">${storeType?.icon || '📍'}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        });

        // Cut label: prefer schema label (trusted), fall back to
        // escaped raw value (untrusted — could be attacker-crafted).
        const cutLabel = row.price
          ? (CUTS[row.price.cut]?.label || escapeHtml(row.price.cut))
          : '';
        const priceHtml = row.price
          ? `<div style="font-size:18px;font-weight:700;color:#d4a64a;">$${row.price.pricePerLb.toFixed(2)}/lb</div>
             <div style="font-size:11px;color:#999;">${cutLabel}</div>`
          : `<div style="font-size:12px;color:#999;font-style:italic;">No price yet</div>`;

        const popup = L.popup({ maxWidth: 240 }).setContent(`
          <div style="font-family:Inter,sans-serif;line-height:1.4;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${storeType?.icon || ''} ${escapeHtml(row.shop.name)}</div>
            <div style="font-size:11px;color:#666;margin-bottom:6px;">${escapeHtml(row.shop.location || '')} &middot; ${Math.round(row.distance)} mi</div>
            ${priceHtml}
          </div>
        `);

        const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(map).bindPopup(popup);
        if (onShopTap) {
          marker.on('click', (e) => {
            // Suppress Leaflet's default popup so the tap goes straight to
            // the ShopDetail modal, which is a strict superset of what the
            // popup used to show. Keep bindPopup() around for accessibility
            // (screen-reader popup announcement) but close it immediately.
            marker.closePopup();
            onShopTap(row.shop.id);
          });
        }
        markers.push(marker);
      }

      markersRef.current = markers;
      mapInstance.current = map;

      // Fit bounds if we have markers
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    };

    init();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [shopRows, city.lat, city.lng, radius]);

  return (
    <div style={{ marginTop: 8 }}>
      <div
        ref={mapRef}
        style={{
          height: 420, borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${PAL.border}`,
        }}
      />
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap',
        marginTop: 8, padding: '6px 4px',
      }}>
        {Object.entries(PIN_COLORS).map(([type, color]) => {
          const cfg = STORE_TYPES[type];
          if (!cfg) return null;
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: PAL.textDim }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              {cfg.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────
function Header() {
  // Web-only Back link. Sign-in/out lives in the hamburger (Settings →
  // ACCOUNT); keeping a duplicate button up here just overlaps with the
  // floating hamburger and asks users the same question twice.
  const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
  if (isNative) return null;
  return (
    <header style={{
      background: PAL.panelDeep,
      borderBottom: `1px solid ${PAL.border}`,
      padding: '8px 16px',
    }}>
      <div className="bbq-container-wide" style={{
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <a href="/" onClick={() => track('cross_app_nav', { from: 'board', to: 'site' })}
          style={{ color: PAL.textDim, textDecoration: 'none', fontSize: 14, padding: '6px 4px' }}>← Back</a>
      </div>
    </header>
  );
}

// ─── About screen — Holy Smokes story + cross-promo ────────────
function AboutScreen({ onClose, user }) {
  const openApp = (packageId, appLabel) => {
    track('board_crosspromo_click', { target: appLabel });
    const url = `https://play.google.com/store/apps/details?id=${packageId}`;
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 16, overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PAL.panel, border: `1px solid ${PAL.border}`, borderRadius: 12,
          maxWidth: 520, width: '100%', padding: 24, color: PAL.text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: 1, color: PAL.brass, margin: 0 }}>
            HOLY SMOKES BBQ
          </h2>
          <button onClick={onClose} style={{ ...secondaryBtn, padding: '4px 10px' }} aria-label="Close">✕</button>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>
          Holy Smokes BBQ Co is a small operation that builds tools for people
          who take barbecue seriously — the ones who track every cook, chase
          the best cuts, and remember what the brisket ran per pound last time.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
          BBQ Board is one of four apps in the family. They stand alone, but
          together they cover eating out, cooking at home, and shopping for
          the meat.
        </p>

        <div style={{ fontSize: 12, color: PAL.textDim, letterSpacing: 2, marginBottom: 12 }}>
          THE OTHER APPS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => openApp('com.holysmokesbbq.notebook', 'notebook')}
            style={crossPromoBtn}
          >
            <div style={{ fontWeight: 700, color: PAL.brass, fontSize: 15 }}>BBQ Notebook</div>
            <div style={{ fontSize: 12, color: PAL.textDim, marginTop: 2 }}>
              Cook log with rubs, sauces, weather, and what to change next time.
            </div>
          </button>
          <button
            onClick={() => openApp('com.holysmokesbbq.scorecard', 'scorecard')}
            style={crossPromoBtn}
          >
            <div style={{ fontWeight: 700, color: PAL.brass, fontSize: 15 }}>BBQ Scorecard</div>
            <div style={{ fontSize: 12, color: PAL.textDim, marginTop: 2 }}>
              Score restaurants on 10 categories. Composite scoring, side-by-side.
            </div>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <a
            href="https://holysmokesbbqco.com/privacy-board.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: PAL.brass, textDecoration: 'none' }}
          >
            Privacy Policy
          </a>
          <span style={{ color: PAL.textDim }}>&middot;</span>
          <a
            href="https://holysmokesbbqco.com/delete-account-board.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: PAL.brass, textDecoration: 'none' }}
          >
            Delete Account
          </a>
          <span style={{ color: PAL.textDim }}>&middot;</span>
          <button
            type="button"
            onClick={() => sendProblemReport({
              appName: 'BBQ Board',
              supportEmail: 'support@holysmokesbbqco.com',
              fallbackVersion: '2.3.3',
              context: { 'Signed in': !!user },
            })}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: PAL.brass,
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Report a Problem
          </button>
        </div>

        <div style={{ fontSize: 12, color: PAL.textDim, textAlign: 'center' }}>
          holysmokesbbqco.com
        </div>
      </div>
    </div>
  );
}

const crossPromoBtn = {
  background: PAL.panelDeep, border: `1px solid ${PAL.border}`, borderRadius: 8,
  padding: '12px 14px', cursor: 'pointer', textAlign: 'left', color: PAL.text,
  fontFamily: 'inherit',
};

// ─── Shop detail modal — tap a shop → see every cut on file ────
function ShopDetail({ row, onClose, onSubmit }) {
  const { shop, distance, allPrices } = row;
  const storeType = STORE_TYPES[shop.storeType] || STORE_TYPES.grocery;

  // Sort: fresh first, then by CUT_ORDER (brisket, ribs, etc.), so the
  // list reads like a butcher case rather than a database dump.
  const sorted = useMemo(() => {
    const priceList = allPrices || [];
    return [...priceList].sort((a, b) => {
      const freshA = isFresh(a.reportedAt) ? 0 : 1;
      const freshB = isFresh(b.reportedAt) ? 0 : 1;
      if (freshA !== freshB) return freshA - freshB;
      const oA = CUT_ORDER.indexOf(a.cut);
      const oB = CUT_ORDER.indexOf(b.cut);
      const idxA = oA === -1 ? 999 : oA;
      const idxB = oB === -1 ? 999 : oB;
      return idxA - idxB;
    });
  }, [allPrices]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 16, overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PAL.panel, border: `1px solid ${PAL.border}`, borderRadius: 12,
          maxWidth: 520, width: '100%', padding: 20, color: PAL.text, marginTop: 20,
        }}
      >
        {/* Header row: name + type chip + close */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20 }}>{storeType.icon}</span>
              <h2 style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700,
                letterSpacing: 1, color: PAL.brass, margin: 0,
              }}>
                {shop.name}
              </h2>
              <TypeBadge type={shop.storeType} />
            </div>
            <div style={{ fontSize: 12, color: PAL.textDim, marginTop: 4 }}>
              {shop.location}
              {distance !== undefined && distance !== null && (
                <span> · {Math.round(distance)} mi</span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ ...secondaryBtn, padding: '4px 10px' }} aria-label="Close">✕</button>
        </div>

        {shop.note && (
          <div style={{ fontSize: 12, color: PAL.textDim, fontStyle: 'italic', marginBottom: 14 }}>
            {shop.note}
          </div>
        )}

        <div style={{ height: 1, background: PAL.border, margin: '14px 0' }} />

        {/* Prices list */}
        {sorted.length === 0 ? (
          <div style={{
            padding: '20px 0', textAlign: 'center',
            color: PAL.textDim, fontSize: 13, lineHeight: 1.5,
          }}>
            No prices on file for this shop yet.<br />
            Be the first to add one.
          </div>
        ) : (
          <div>
            <div style={{
              fontSize: 11, color: PAL.textDim, letterSpacing: 2,
              marginBottom: 10, textTransform: 'uppercase',
            }}>
              {sorted.length} {sorted.length === 1 ? 'cut' : 'cuts'} on file
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sorted.map((p) => {
                const cut = CUTS[p.cut];
                const days = ageInDays(p.reportedAt);
                const fresh = isFresh(p.reportedAt);
                return (
                  <div
                    key={p.id || `${p.shopId}::${p.cut}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: PAL.panelDeep,
                      border: `1px solid ${PAL.border}`,
                      borderRadius: 6,
                      opacity: fresh ? 1 : 0.7,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: PAL.text }}>
                        {cut?.label || p.cut}
                      </div>
                      <div style={{
                        fontSize: 11, color: fresh ? PAL.green : PAL.amber,
                        marginTop: 2,
                      }}>
                        {fresh ? '● ' : '○ '}
                        {days === 0 ? 'reported today' : `${days} ${days === 1 ? 'day' : 'days'} ago`}
                        {!fresh && ' · stale'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700,
                        color: PAL.brass, lineHeight: 1,
                      }}>
                        ${p.pricePerLb.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10, color: PAL.textDim, marginTop: 2 }}>
                        per lb
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ height: 1, background: PAL.border, margin: '16px 0' }} />

        <button
          onClick={() => onSubmit(shop.id)}
          style={{
            ...primaryBtn,
            width: '100%', padding: '12px 16px',
            fontSize: 14,
          }}
        >
          + SUBMIT A PRICE FOR THIS SHOP
        </button>
      </div>
    </div>
  );
}

const secondaryBtn = {
  background: 'transparent', color: PAL.textDim, border: `1px solid ${PAL.border}`,
  padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
};

// ─── Intro card ────────────────────────────────────────────────
function IntroCard() {
  return (
    <div style={{
      background: PAL.panel, border: `1px solid ${PAL.border}`, borderRadius: 8,
      padding: 14, marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, color: PAL.text, lineHeight: 1.5 }}>
        Every butcher and meat counter we know about, ranked by best price on file.
        See a shop with no price? Submit what you paid — it takes 20 seconds and
        helps the next pitmaster save a few bucks per pound.
      </div>
    </div>
  );
}

// ─── Location picker (city + radius) ───────────────────────────
function LocationPicker({ cityId, radius, onCityChange, onRadiusChange }) {
  const [detecting, setDetecting] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [browseState, setBrowseState] = useState('');
  const searchedRef = useRef(false); // fires board_city_searched once per typing session

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Location not supported on this device.');
      return;
    }
    setDetecting(true);
    setMessage('');
    track('board_location_detect_requested');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const { id, distance } = nearestCity(latitude, longitude);
        onCityChange(id);
        setDetecting(false);
        setMessage(`Nearest city: ${CITIES[id].label} (${Math.round(distance)} mi away).`);
        track('board_location_detect_success', { city: id, distance: Math.round(distance) });
        track('board_city_changed', { city: id, source: 'near_me' });
      },
      (err) => {
        setDetecting(false);
        setMessage(err.code === 1
          ? 'Location permission denied.'
          : "Couldn't get your location. Pick a city below.");
        track('board_location_detect_failed', { code: err.code });
      },
      { timeout: 8000, maximumAge: 300000 },
    );
  };

  // Search matches: prefix on the city label OR the state's full name OR
  // the state's two-letter code. Case-insensitive. Cap at 8 results.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits = [];
    for (const id of CITY_ORDER) {
      const city = CITIES[id];
      if (!city) continue;
      const label = city.label.toLowerCase();
      const stateLabel = (STATE_LABELS[city.state] || '').toLowerCase();
      const stateCode = city.state.toLowerCase();
      if (
        label.startsWith(q) ||
        label.includes(` ${q}`) ||
        stateLabel.startsWith(q) ||
        stateCode === q
      ) {
        hits.push(id);
        if (hits.length >= 8) break;
      }
    }
    return hits;
  }, [query]);

  const commitSearch = (id) => {
    if (!searchedRef.current) {
      track('board_city_searched', { query_length: query.trim().length, hit_count: results.length });
      searchedRef.current = true;
    }
    onCityChange(id);
    setQuery('');
    setMessage('');
    track('board_city_changed', { city: id, source: 'search' });
  };

  const commitStateBrowse = (id) => {
    onCityChange(id);
    setMessage('');
    track('board_city_changed', { city: id, source: 'state_browse' });
  };

  const onStateChange = (e) => {
    const code = e.target.value;
    setBrowseState(code);
    if (code) track('board_state_browsed', { state: code });
  };

  const stateOptions = useMemo(() => {
    return Object.values(STATES).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const activeCity = CITIES[cityId];
  const activeLabel = activeCity ? activeCity.label : cityId;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label style={{ fontSize: 12, color: PAL.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Near
        </label>
        <button
          type="button"
          onClick={detectLocation}
          disabled={detecting}
          style={{
            background: 'transparent', color: PAL.brass, border: 'none',
            fontSize: 12, cursor: detecting ? 'default' : 'pointer',
            padding: 0, fontWeight: 700, opacity: detecting ? 0.6 : 1,
            textDecoration: 'underline',
          }}
        >
          {detecting ? 'Detecting…' : '📍 Use my location'}
        </button>
      </div>

      {/* Currently selected line */}
      <div style={{ fontSize: 12, color: PAL.textDim, marginBottom: 6 }}>
        Currently: <strong style={{ color: PAL.text }}>{activeLabel}</strong>
      </div>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              e.preventDefault();
              commitSearch(results[0]);
            } else if (e.key === 'Escape') {
              setQuery('');
            }
          }}
          placeholder="Search cities…"
          style={{
            width: '100%',
            background: PAL.panel, color: PAL.text,
            border: `1px solid ${PAL.border}`, padding: '10px 12px',
            borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
          }}
        />
        {query.trim() && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: PAL.panelDeep, border: `1px solid ${PAL.border}`,
              borderTop: 'none', borderRadius: '0 0 6px 6px',
              zIndex: 5, maxHeight: 320, overflowY: 'auto',
            }}
          >
            {results.length === 0 ? (
              <div style={{ padding: '10px 12px', color: PAL.textDim, fontSize: 13 }}>
                No matches — try a state name or browse below.
              </div>
            ) : (
              results.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => commitSearch(id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'transparent', color: PAL.text,
                    border: 'none', padding: '10px 12px',
                    fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {CITIES[id].label}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{
        fontSize: 11, color: PAL.textDim, textAlign: 'center',
        margin: '6px 0 4px', letterSpacing: 1, textTransform: 'uppercase',
      }}>
        or browse by state
      </div>

      {/* State selector + state's cities */}
      <select
        value={browseState}
        onChange={onStateChange}
        style={{
          width: '100%',
          background: PAL.panel, color: PAL.text,
          border: `1px solid ${PAL.border}`, padding: '10px 12px',
          borderRadius: 6, fontSize: 14, marginBottom: browseState ? 6 : 0,
          boxSizing: 'border-box',
        }}
      >
        <option value="">Choose a state…</option>
        {stateOptions.map(s => (
          <option key={s.code} value={s.code}>{s.label}</option>
        ))}
      </select>

      {browseState && STATES[browseState] && (
        <div style={{
          background: PAL.panelDeep, border: `1px solid ${PAL.border}`,
          borderRadius: 6, padding: '6px 0', marginBottom: 8,
        }}>
          {STATES[browseState].cityIds.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => commitStateBrowse(id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: cityId === id ? PAL.panel : 'transparent',
                color: PAL.text, border: 'none',
                padding: '8px 14px', fontSize: 14, cursor: 'pointer',
              }}
            >
              {CITIES[id].label}
            </button>
          ))}
        </div>
      )}

      {/* Radius selector (unchanged behavior) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: PAL.textDim }}>Radius</label>
        <select
          value={radius}
          onChange={(e) => {
            onRadiusChange(Number(e.target.value));
            track('board_radius_changed', { radius: Number(e.target.value) });
          }}
          style={{
            background: PAL.panel, color: PAL.text,
            border: `1px solid ${PAL.border}`, padding: '10px 12px',
            borderRadius: 6, fontSize: 14,
          }}
        >
          {RADIUS_OPTIONS.map(r => (
            <option key={r} value={r}>{r} mi</option>
          ))}
        </select>
      </div>

      {message && (
        <div style={{ fontSize: 12, color: PAL.textDim, marginTop: 6 }}>
          {message}
        </div>
      )}
    </div>
  );
}

// ─── Store type filter chips ───────────────────────────────────
// Sits under the meat chips so someone who wants to "support local"
// picks Butchers and the chains drop out. Order: All → Butchers first
// (the concept's north star), warehouse, grocery, farm.
const TYPE_ORDER = ['butcher', 'warehouse', 'grocery', 'farm'];
function StoreTypeFilter({ available, value, onChange }) {
  const chip = (id, label) => {
    const active = value === id;
    return (
      <button
        key={id}
        onClick={() => { onChange(id); track('board_type_filter', { type: id }); }}
        style={{
          background: active ? PAL.butcherRed : 'transparent',
          color: active ? '#fff' : PAL.text,
          border: `1px solid ${active ? PAL.butcherRed : PAL.border}`,
          padding: '6px 12px', borderRadius: 999, fontSize: 13,
          cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: active ? 700 : 400,
        }}
      >{label}</button>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 4 }}>
      {chip('all', 'All types')}
      {TYPE_ORDER.map(t => {
        const cfg = STORE_TYPES[t];
        return chip(t, `${cfg.icon} ${t === 'butcher' ? 'Butchers' : t === 'warehouse' ? 'Warehouse' : t === 'grocery' ? 'Grocery' : t === 'farm' ? 'Direct / Farm' : cfg.label}`);
      })}
    </div>
  );
}

// ─── Meat filter chips ─────────────────────────────────────────
// Top 5 meats are always shown so people can click into an empty state
// and submit the first price for that meat. Anything above the top 5
// that has at least one price also gets a chip.
function MeatFilter({ extraMeats, value, onChange }) {
  const chip = (id, label) => {
    const active = value === id;
    return (
      <button
        key={id}
        onClick={() => { onChange(id); track('board_meat_filter', { meat: id }); }}
        style={{
          background: active ? PAL.brass : 'transparent',
          color: active ? '#111' : PAL.text,
          border: `1px solid ${active ? PAL.brass : PAL.border}`,
          padding: '6px 12px', borderRadius: 999, fontSize: 13,
          cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: active ? 700 : 400,
        }}
      >{label}</button>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 4 }}>
      {chip('all', 'All meats')}
      {TOP_MEATS.map(id => chip(id, MEATS[id].short))}
      {extraMeats.map(id => chip(id, MEATS[id]?.short || id))}
    </div>
  );
}

// ─── Shop card ─────────────────────────────────────────────────
function ShopCard({ shop, price, distance, onSubmit, onOpen }) {
  const storeType = STORE_TYPES[shop.storeType] || STORE_TYPES.grocery;
  const cut = price ? CUTS[price.cut] : null;
  const days = price ? ageInDays(price.reportedAt) : null;
  const fresh = price ? isFresh(price.reportedAt) : false;
  // "Verified" trust badge derives ONLY from the server-validated
  // `source` field. The docId-prefix fallback below used to also grant
  // Verified when the id started with 'seed_' — but a user could mint
  // that docId themselves and forge the badge on a $0.01 fake price
  // (SECURITY-AUDIT-BOARD-DEEP.md Finding B-2). Removed the fallback.
  const isSeed = price && price.source === 'operator_verified';

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      style={{
      background: PAL.panel,
      border: `1px solid ${price ? PAL.border : PAL.border + '99'}`,
      borderLeft: shop.storeType === 'butcher' ? `3px solid ${PAL.butcherRed}` : `1px solid ${PAL.border}`,
      borderRadius: 8,
      padding: 14,
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
      alignItems: 'center',
      opacity: price ? 1 : 0.85,
      cursor: onOpen ? 'pointer' : 'default',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16 }}>{storeType.icon}</span>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{shop.name}</div>
          <TypeBadge type={shop.storeType} />
          {isSeed && <VerifiedBadge />}
        </div>
        {price && (
          <div style={{ fontSize: 13, color: PAL.textDim, marginBottom: 2 }}>
            {cut?.label || price.cut}
          </div>
        )}
        {shop.location && (
          <div style={{ fontSize: 12, color: PAL.textDim, marginTop: 2 }}>
            {shop.location}
            {distance !== undefined && distance !== null && (
              <span style={{ color: PAL.textDim, opacity: 0.7 }}> · {Math.round(distance)} mi</span>
            )}
          </div>
        )}
        {shop.note && !price && (
          <div style={{ fontSize: 11, color: PAL.textDim, marginTop: 4, fontStyle: 'italic' }}>
            {shop.note}
          </div>
        )}
        {price && (
          <div style={{ fontSize: 11, color: fresh ? PAL.green : PAL.amber, marginTop: 6 }}>
            {days === 0 ? 'Reported today' : `Reported ${days} ${days === 1 ? 'day' : 'days'} ago`}
            {!fresh && ' • stale'}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        {price ? (
          <>
            <div style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 700,
              color: PAL.brass, lineHeight: 1,
            }}>
              ${price.pricePerLb.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: PAL.textDim, marginTop: 2 }}>per lb</div>
          </>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onSubmit(); }}
            style={{
              background: 'transparent',
              color: PAL.brass,
              border: `1px dashed ${PAL.brass}`,
              padding: '10px 14px', borderRadius: 6,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              letterSpacing: 0.3, textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >Submit a price</button>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  if (type !== 'butcher') return null;
  return (
    <span style={{
      fontSize: 10, background: PAL.butcherRed + '22', color: PAL.butcherRed,
      padding: '2px 6px', borderRadius: 4, border: `1px solid ${PAL.butcherRed}55`,
      letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700,
    }}>Butcher</span>
  );
}

function VerifiedBadge() {
  return (
    <span style={{
      fontSize: 10, background: PAL.panelDeep, color: PAL.green,
      padding: '2px 6px', borderRadius: 4, border: `1px solid ${PAL.green}33`,
      letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700,
    }}>Verified</span>
  );
}

// ─── Circular OCR panel ───────────────────────────────────────
// Snap or drop a photo of a weekly ad. tesseract.js is lazy-loaded on
// first use so the initial Board bundle stays lean.
function CircularScrubPanel({ region, user, onSignIn, onSignInAnon }) {
  const [status, setStatus] = useState('idle'); // idle | loading-ocr | ocr-running | reviewing | submitting
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [proposals, setProposals] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // If the user pressed submit while signed out, fire the write as soon
  // as auth resolves.
  useEffect(() => {
    if (pendingSubmit && user) {
      setPendingSubmit(false);
      submitProposals(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSubmit, user]);

  const regionShops = useMemo(() => shopsForRegion(region), [region]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setProposals([]);
    setImageUrl(URL.createObjectURL(file));
    setStatus('loading-ocr');
    track('board_circular_upload_started', { fileType: file.type });
    try {
      const { createWorker } = await import('tesseract.js');
      setStatus('ocr-running');
      setProgress(0);
      // Self-host every Tesseract asset (worker script, core WASM,
      // language traineddata) from the app's own origin. Without these
      // explicit paths tesseract.js falls back to cdn.jsdelivr.net at
      // runtime, which is a Google Play policy risk and a supply-chain
      // RCE vector inside the CSP-less native WebView
      // (SECURITY-AUDIT-DEEP-PASS.md Finding H-1).
      // BASE_URL resolves per build target: '/' in native, '/board/' on
      // the web deploy — see vite.config.native.board.js / vite.config.board.js.
      const tessBase = `${import.meta.env.BASE_URL}tesseract/`;
      const worker = await createWorker('eng', 1, {
        workerPath: `${tessBase}worker.min.js`,
        corePath: tessBase,
        langPath: tessBase,
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const found = extractPricedPhrases(data.text);
      setStatus('reviewing');
      setProposals(found.map(p => ({ ...p, keep: true })));
      track('board_circular_ocr_done', { proposals: found.length });
      if (found.length === 0) setError('OCR ran, but no per-pound BBQ prices were detected. Try a sharper image.');
    } catch (err) {
      console.error('OCR failed', err);
      setError('Something went wrong reading that image. Try a smaller or sharper photo.');
      setStatus('idle');
      track('board_circular_ocr_failed', { error: err?.message || 'unknown' });
    }
  };

  const toggleProposal = (idx) => {
    setProposals(prev => prev.map((p, i) => i === idx ? { ...p, keep: !p.keep } : p));
  };

  const submitProposals = async (submittingUser = user) => {
    if (!submittingUser) {
      setShowAuthGate(true);
      return;
    }
    const shop = getShop(selectedShopId);
    if (!shop) {
      setError('Pick which shop the ad is from before submitting.');
      return;
    }
    const kept = proposals.filter(p => p.keep);
    if (kept.length === 0) return;
    setStatus('submitting');
    setError('');
    // Track per-proposal outcomes so partial failure surfaces to the user
    // instead of silently resetting the panel to a false "success" state
    // (SECURITY-AUDIT-BOARD-DEEP.md Finding B-4).
    const outcomes = kept.map(() => ({ ok: false, error: null }));
    for (let i = 0; i < kept.length; i++) {
      const p = kept[i];
      try {
        await addDoc(collection(db, 'board_prices'), {
          userId: submittingUser.uid,
          shopId: shop.id,
          store: shop.name,
          storeType: shop.storeType,
          region: shop.region,
          location: shop.location || '',
          cut: p.cut,
          pricePerLb: p.pricePerLb,
          // Sanitize raw OCR text before storing — Tesseract output can
          // contain anything, and Finding B-8 flags this as a stored
          // XSS vector if a future admin view forgets to escape.
          notes: sanitizeNote(`From weekly ad. OCR context: "${p.context.slice(0, 200)}"`),
          source: 'community',
          reportedAt: serverTimestamp(),
        });
        outcomes[i].ok = true;
      } catch (err) {
        console.error('proposal submit failed', err);
        outcomes[i].error = err?.code || err?.message || 'unknown';
      }
    }
    const successCount = outcomes.filter(o => o.ok).length;
    const failCount = outcomes.length - successCount;
    track('board_circular_submitted', { proposalCount: kept.length, successCount, failCount });

    if (failCount === 0) {
      // Full success — safe to reset the panel.
      setStatus('idle');
      setProposals([]);
      setImageUrl(null);
      setSelectedShopId('');
      return;
    }

    // Partial or total failure — keep the review UI open with only the
    // failed items still marked "keep", and surface a real error message.
    const failedProposals = kept
      .map((p, idx) => ({ ...p, keep: !outcomes[idx].ok, lastError: outcomes[idx].error }))
      .filter(p => p.keep);
    setProposals(failedProposals);
    setStatus('reviewing');
    const permDenied = outcomes.some(o => o.error === 'permission-denied');
    if (successCount === 0) {
      setError(permDenied
        ? `None of the ${failCount} prices could be saved (permission denied — the shop's region may not be enabled yet). Nothing was posted.`
        : `None of the ${failCount} prices could be saved. Check your connection and try again.`);
    } else {
      setError(`Saved ${successCount} of ${kept.length}. ${failCount} failed — still shown above so you can retry.`);
    }
    return;
  };

  const reset = () => {
    setStatus('idle');
    setProposals([]);
    setImageUrl(null);
    setSelectedShopId('');
    setError('');
  };

  return (
    <div style={{
      marginTop: 20, padding: 16,
      background: PAL.panel, border: `1px solid ${PAL.border}`,
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>📄</span>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: 1, color: PAL.brass }}>
          SCAN A WEEKLY AD
        </div>
      </div>
      <div style={{ fontSize: 13, color: PAL.textDim, marginBottom: 12, lineHeight: 1.5 }}>
        Snap a photo of a store&rsquo;s printed or PDF weekly ad. We&rsquo;ll pull the
        per-pound BBQ prices out for you to confirm and post.
      </div>

      {status === 'idle' && (
        <label style={{
          display: 'inline-block', background: PAL.brass, color: '#111',
          padding: '10px 16px', borderRadius: 6, fontWeight: 700,
          fontSize: 14, cursor: 'pointer', letterSpacing: 0.3,
        }}>
          Choose photo or PDF page
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </label>
      )}

      {(status === 'loading-ocr' || status === 'ocr-running') && (
        <div style={{ fontSize: 13, color: PAL.text }}>
          {status === 'loading-ocr' ? 'Loading OCR engine…' : `Reading text — ${progress}%`}
          <div style={{ marginTop: 8, height: 6, background: PAL.panelDeep, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: PAL.brass, transition: 'width 120ms' }} />
          </div>
        </div>
      )}

      {status === 'reviewing' && (
        <div>
          {imageUrl && (
            <img
              src={imageUrl} alt="Ad preview"
              style={{ maxWidth: '100%', maxHeight: 200, marginBottom: 12, borderRadius: 6, opacity: 0.6 }}
            />
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: PAL.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              Which shop is this ad from?
            </label>
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              style={{
                width: '100%', background: PAL.panelDeep, color: PAL.text,
                border: `1px solid ${PAL.border}`, padding: '10px 12px',
                borderRadius: 6, fontSize: 14,
              }}
            >
              <option value="">— pick a shop —</option>
              {regionShops.map(s => (
                <option key={s.id} value={s.id}>
                  {STORE_TYPES[s.storeType]?.icon} {s.name} — {s.location}
                </option>
              ))}
            </select>
          </div>

          {proposals.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: PAL.textDim, marginBottom: 8 }}>
                {proposals.filter(p => p.keep).length} of {proposals.length} prices selected — tap to toggle
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {proposals.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleProposal(idx)}
                    style={{
                      background: p.keep ? PAL.panelDeep : 'transparent',
                      color: p.keep ? PAL.text : PAL.textDim,
                      border: `1px solid ${p.keep ? PAL.brass : PAL.border}`,
                      padding: 10, borderRadius: 6, textAlign: 'left',
                      cursor: 'pointer',
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
                      opacity: p.keep ? 1 : 0.55,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.cutLabel || p.cut}</div>
                      <div style={{ fontSize: 11, color: PAL.textDim, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        "{p.context}"
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 700, color: PAL.brass,
                    }}>${p.pricePerLb.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: PAL.textDim, marginBottom: 12 }}>
              No prices detected — try a sharper image, or add prices manually via the Submit form.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={reset} style={{ ...secondaryBtn, flex: 1, padding: 10 }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submitProposals()}
              disabled={proposals.filter(p => p.keep).length === 0 || !selectedShopId}
              style={{
                flex: 2, background: PAL.brass, color: '#111', border: 'none',
                padding: 10, borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                opacity: (proposals.filter(p => p.keep).length === 0 || !selectedShopId) ? 0.5 : 1,
              }}
            >
              Post {proposals.filter(p => p.keep).length} price{proposals.filter(p => p.keep).length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {status === 'submitting' && (
        <div style={{ fontSize: 13, color: PAL.text }}>Submitting…</div>
      )}

      {error && (
        <div style={{ color: PAL.red, fontSize: 12, marginTop: 10 }}>{error}</div>
      )}

      {showAuthGate && (
        <AuthGate
          busy={authBusy}
          onSignIn={async () => {
            setAuthBusy(true);
            try { await onSignIn(); setPendingSubmit(true); setShowAuthGate(false); }
            catch { setError('Sign in failed. Try again.'); }
            finally { setAuthBusy(false); }
          }}
          onSignInAnon={async () => {
            setAuthBusy(true);
            try { await onSignInAnon(); setPendingSubmit(true); setShowAuthGate(false); }
            catch { setError('Anonymous sign-in failed. Try again.'); }
            finally { setAuthBusy(false); }
          }}
          onCancel={() => setShowAuthGate(false)}
        />
      )}
    </div>
  );
}

// ─── Missing shop CTA ──────────────────────────────────────────
function MissingShopCTA({ onSubmit }) {
  return (
    <div style={{
      marginTop: 20, padding: 16,
      background: PAL.panelDeep, border: `1px dashed ${PAL.border}`,
      borderRadius: 8, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, color: PAL.text, marginBottom: 6 }}>
        Missing a butcher or meat counter?
      </div>
      <div style={{ fontSize: 12, color: PAL.textDim, marginBottom: 12 }}>
        Submit a price for a shop that isn&rsquo;t on the list yet — we&rsquo;ll add
        the shop when the first price comes in.
      </div>
      <button onClick={onSubmit} style={primaryBtn}>Submit a price for a new shop</button>
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────────
function Footer() {
  return (
    <div style={{
      marginTop: 32, padding: '20px 8px', borderTop: `1px solid ${PAL.border}`,
      color: PAL.textDim, fontSize: 12, lineHeight: 1.6,
    }}>
      <div style={{ marginBottom: 6 }}>
        <strong style={{ color: PAL.text }}>BBQ Board</strong> is part of the Holy Smokes BBQ Co portfolio.
      </div>
      <div style={{ marginBottom: 6 }}>
        Prices change constantly — always confirm at the counter before you drive.
        Shop directory sourced from public listings; report corrections via the submit form.
      </div>
      <div>
        <a href="/scorecard/" style={{ color: PAL.brassDim, marginRight: 12 }}>Scorecard</a>
        <a href="/notebook/" style={{ color: PAL.brassDim, marginRight: 12 }}>Notebook</a>
        <a href="/calculator/" style={{ color: PAL.brassDim }}>Calculator</a>
      </div>
    </div>
  );
}

// ─── Auth gate — shown when a signed-out user tries to submit ─────
// Gives users two paths: sign in with Google (recommended — lets us
// attribute + let them delete their own submissions later), or continue
// anonymously (Firebase anon auth, no Google account needed). Either
// path satisfies the isSignedIn() Firestore rules check.
function AuthGate({ onSignIn, onSignInAnon, onCancel, busy }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, zIndex: 200,
    }}>
      <div style={{
        background: PAL.panel, border: `1px solid ${PAL.border}`,
        borderRadius: 10, padding: 22, width: '100%', maxWidth: 400,
      }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700, color: PAL.brass, marginBottom: 10 }}>
          One quick thing
        </div>
        <div style={{ fontSize: 14, color: PAL.text, marginBottom: 18, lineHeight: 1.5 }}>
          BBQ Board attaches every price to an account so real submissions
          stand out from noise. Pick how you'd like to submit:
        </div>
        <button
          type="button"
          onClick={onSignIn}
          disabled={busy}
          style={{
            width: '100%', background: PAL.brass, color: '#111', border: 'none',
            padding: '12px', borderRadius: 6, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            fontSize: 15, marginBottom: 10, opacity: busy ? 0.6 : 1,
          }}
        >
          Sign in with Google
        </button>
        <button
          type="button"
          onClick={onSignInAnon}
          disabled={busy}
          style={{
            width: '100%', background: 'transparent', color: PAL.text,
            border: `1px solid ${PAL.border}`,
            padding: '12px', borderRadius: 6, cursor: busy ? 'default' : 'pointer',
            fontSize: 14, marginBottom: 10, opacity: busy ? 0.6 : 1,
          }}
        >
          Continue without an account
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            width: '100%', background: 'transparent', color: PAL.textDim,
            border: 'none', padding: '8px', cursor: busy ? 'default' : 'pointer',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
        <div style={{ fontSize: 11, color: PAL.textDim, lineHeight: 1.5, marginTop: 10 }}>
          Anonymous submissions can't be edited or deleted later. Signing
          in with Google lets you manage yours.
        </div>
      </div>
    </div>
  );
}

// ─── Submit modal ──────────────────────────────────────────────
function SubmitModal({ region, user, prefillShopId, prefillCut, onClose, onSignIn, onSignInAnon }) {
  const knownShop = prefillShopId ? getShop(prefillShopId) : null;
  const [shopMode, setShopMode] = useState(knownShop ? 'existing' : 'new');
  const [existingShopId, setExistingShopId] = useState(prefillShopId || '');
  const [newStore, setNewStore] = useState('');
  const [newStoreType, setNewStoreType] = useState('butcher');
  const [newLocation, setNewLocation] = useState('');
  const [cut, setCut] = useState(prefillCut || 'brisket_choice');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const regionShops = useMemo(() => shopsForRegion(region), [region]);

  // If the user pressed submit while signed out, fire the write as soon
  // as the parent's onAuthStateChanged flips `user` from null to real.
  useEffect(() => {
    if (pendingSubmit && user) {
      setPendingSubmit(false);
      doSubmit(user);
    }
  }, [pendingSubmit, user]);

  const doSubmit = async (submittingUser) => {
    setError('');
    const priceNum = parseFloat(price);
    if (!(priceNum > 0) || priceNum > 100) return setError('Price must be between $0.01 and $100.00 per pound.');

    let store, storeType, location, shopId;
    if (shopMode === 'existing') {
      const shop = getShop(existingShopId);
      if (!shop) return setError('Pick a shop from the list, or add a new one.');
      store = shop.name;
      storeType = shop.storeType;
      location = shop.location || '';
      shopId = shop.id;
    } else {
      if (!newStore.trim()) return setError('Store name is required.');
      store = newStore.trim().slice(0, 80);
      storeType = newStoreType;
      location = newLocation.trim().slice(0, 120);
      // Append per-user suffix so two users submitting the same store
      // name get distinct shopIds. Prevents deliberate collision + false
      // attribution attacks (SECURITY-AUDIT-BOARD.md Finding B-7).
      const storeSlug = store.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
      shopId = `user_${storeSlug}_${submittingUser.uid.slice(0, 8)}`;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'board_prices'), {
        userId: submittingUser.uid,
        shopId,
        store,
        storeType,
        region,
        location,
        cut,
        pricePerLb: priceNum,
        notes: sanitizeNote(notes),
        source: 'community',
        reportedAt: serverTimestamp(),
      });
      track('board_price_submitted', { cut, storeType, region, shopMode, anon: submittingUser.isAnonymous === true });
      onClose();
    } catch (err) {
      console.error('submit failed', err);
      setError('Something went wrong. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Cheap up-front validation so the auth-gate doesn't pop for
    // invalid forms.
    const priceNum = parseFloat(price);
    if (!(priceNum > 0) || priceNum > 100) return setError('Price must be between $0.01 and $100.00 per pound.');
    if (shopMode === 'existing' && !getShop(existingShopId)) return setError('Pick a shop from the list, or add a new one.');
    if (shopMode === 'new' && !newStore.trim()) return setError('Store name is required.');

    if (!user) {
      setShowAuthGate(true);
      return;
    }
    doSubmit(user);
  };

  const gateSignIn = async () => {
    setAuthBusy(true);
    try {
      await onSignIn();
      setPendingSubmit(true);
      setShowAuthGate(false);
    } catch {
      setError('Sign in failed. Try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const gateSignInAnon = async () => {
    setAuthBusy(true);
    try {
      await onSignInAnon();
      setPendingSubmit(true);
      setShowAuthGate(false);
    } catch {
      setError('Anonymous sign-in failed. Try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 100,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: PAL.panel, border: `1px solid ${PAL.border}`,
          borderRadius: 10, padding: 20, width: '100%', maxWidth: 480,
          maxHeight: '92vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700, color: PAL.brass }}>
            Submit a price
          </div>
          <button type="button" onClick={onClose} style={{ ...secondaryBtn, padding: '4px 10px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <ToggleBtn active={shopMode === 'existing'} onClick={() => setShopMode('existing')}>Shop from list</ToggleBtn>
          <ToggleBtn active={shopMode === 'new'} onClick={() => setShopMode('new')}>New shop</ToggleBtn>
        </div>

        {shopMode === 'existing' ? (
          <Field label="Shop">
            <select value={existingShopId} onChange={(e) => setExistingShopId(e.target.value)} style={input} required>
              <option value="">— pick a shop —</option>
              {regionShops.map(s => (
                <option key={s.id} value={s.id}>
                  {STORE_TYPES[s.storeType]?.icon} {s.name} — {s.location}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="New shop name">
              <input
                value={newStore} onChange={(e) => setNewStore(e.target.value)}
                placeholder="e.g. Nolechek's Meats"
                style={input} maxLength={80} required
              />
            </Field>
            <Field label="Shop type">
              <select value={newStoreType} onChange={(e) => setNewStoreType(e.target.value)} style={input}>
                {Object.entries(STORE_TYPES).map(([id, t]) => (
                  <option key={id} value={id}>{t.icon} {t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Location (city or address)">
              <input
                value={newLocation} onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g. Thorp, WI"
                style={input} maxLength={120}
              />
            </Field>
          </>
        )}

        <Field label="Cut">
          <select value={cut} onChange={(e) => setCut(e.target.value)} style={input}>
            {CUT_ORDER.map(id => <option key={id} value={id}>{CUTS[id].label}</option>)}
          </select>
        </Field>

        <Field label="Price per pound">
          <input
            type="number" step="0.01" min="0.01" max="100"
            value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder="5.99" style={input} required
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Sale vs regular price, grade, cut variation, etc."
            style={{ ...input, minHeight: 60, resize: 'vertical' }}
            maxLength={300}
          />
        </Field>

        {error && (
          <div style={{ color: PAL.red, fontSize: 13, marginBottom: 10 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{ ...secondaryBtn, flex: 1, padding: '10px' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{
            flex: 2, background: PAL.brass, color: '#111', border: 'none',
            padding: '10px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Submitting…' : 'Submit price'}
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: PAL.textDim, lineHeight: 1.5 }}>
          {user?.isAnonymous
            ? 'Submitting anonymously. Prices are public and community-visible.'
            : user
              ? <>Submitting as <strong style={{ color: PAL.text }}>{user.displayName || user.email}</strong>. Prices are public and community-visible.</>
              : 'You\'ll be asked how to submit before the price posts. Prices are public and community-visible.'}
        </div>
      </form>
      {showAuthGate && (
        <AuthGate
          busy={authBusy}
          onSignIn={gateSignIn}
          onSignInAnon={gateSignInAnon}
          onCancel={() => setShowAuthGate(false)}
        />
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? PAL.brass : 'transparent',
        color: active ? '#111' : PAL.textDim,
        border: `1px solid ${active ? PAL.brass : PAL.border}`,
        padding: '8px 12px', borderRadius: 6, fontSize: 13,
        fontWeight: active ? 700 : 400, cursor: 'pointer',
      }}
    >{children}</button>
  );
}

const input = {
  width: '100%', background: PAL.panelDeep, color: PAL.text,
  border: `1px solid ${PAL.border}`, padding: '10px 12px',
  borderRadius: 6, fontSize: 14, fontFamily: 'inherit',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 11, color: PAL.textDim,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}
