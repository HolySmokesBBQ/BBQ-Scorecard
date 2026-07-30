import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { computeHumidity } from '../pitHumidity.js';
import { resolvePressure, DEFAULT_PRESSURE_KPA } from '../pressureResolver.js';
import { track } from '../scoring.js';

// Pit Humidity Calculator — dry-bulb + wet-bulb + station pressure
// → relative humidity, humidity ratio, dew point. Standalone tool,
// no persistence. See docs/superpowers/specs/2026-07-28-pit-humidity-
// calculator-design.md for the reasoning.

const ACCENT = '#4A6741';
const WARN_BG = '#3d3220';
const WARN_BORDER = '#8a6b2f';
const WARN_TEXT = '#f0d998';

const WARNING_MESSAGES = {
  inverted:
    "Wet-bulb should read lower than dry-bulb. Check your probes — likely swapped, or the wet probe isn't wicking.",
  dry_wick:
    'Wet-bulb has converged on dry-bulb. The shoelace may be dry — check the water jar.',
  above_boiling:
    'At this pressure, water boils around 212°F at sea level (lower at altitude). Above that, 100% humidity is physically impossible — reading clamped.',
};

const SOURCE_LABEL = {
  weather: 'weather station',
  elevation: 'elevation estimate',
  manual: 'you set this',
  default: 'default (Waukesha)',
};

function fetchWeatherPressureKPa() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timeoutId = setTimeout(() => resolve(null), 15000);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const pointResp = await fetch(
            `https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`,
          );
          if (!pointResp.ok) throw new Error();
          const pointData = await pointResp.json();
          const stationsUrl = pointData.properties?.observationStations;
          if (!stationsUrl) throw new Error();
          const stationsResp = await fetch(stationsUrl);
          if (!stationsResp.ok) throw new Error();
          const stations = (await stationsResp.json()).features?.slice(0, 5) ?? [];
          for (const s of stations) {
            const id = s.properties?.stationIdentifier;
            if (!id) continue;
            try {
              const obs = await fetch(
                `https://api.weather.gov/stations/${id}/observations/latest`,
              );
              if (!obs.ok) continue;
              const p = (await obs.json()).properties;
              // barometricPressure is in Pa per NWS wmoUnit:Pa.
              const pa = p?.barometricPressure?.value;
              if (Number.isFinite(pa) && pa > 0) {
                clearTimeout(timeoutId);
                resolve(pa / 1000);
                return;
              }
            } catch { /* try next station */ }
          }
        } catch { /* fall through */ }
        clearTimeout(timeoutId);
        resolve(null);
      },
      () => { clearTimeout(timeoutId); resolve(null); },
      { timeout: 12000, maximumAge: 15 * 60 * 1000 },
    );
  });
}

export default function NotebookPitHumidity() {
  const { S, sBtn, sInput, navigateTo } = useAppContext();

  const [dryStr, setDryStr] = useState('');
  const [wetStr, setWetStr] = useState('');
  const [manualPressureStr, setManualPressureStr] = useState('');
  const [weatherPressureKPa, setWeatherPressureKPa] = useState(null);
  const [pressureLoading, setPressureLoading] = useState(true);
  const [showOverride, setShowOverride] = useState(false);

  useEffect(() => {
    track('humidity_calculator_opened');
    let cancelled = false;
    (async () => {
      const p = await fetchWeatherPressureKPa();
      if (!cancelled) {
        setWeatherPressureKPa(p);
        setPressureLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dryF = parseFloat(dryStr);
  const wetF = parseFloat(wetStr);
  const manualPressureKPa = parseFloat(manualPressureStr);

  const pressure = useMemo(
    () =>
      resolvePressure({
        manualPressureKPa: Number.isFinite(manualPressureKPa) ? manualPressureKPa : null,
        weatherPressureKPa,
        // Elevation-derived pressure requires GPS elevation, which we
        // don't cache separately. If the weather fetch failed we skip
        // to the default (Waukesha) — good enough for v1.
        elevationFt: null,
      }),
    [manualPressureKPa, weatherPressureKPa],
  );

  const result = useMemo(
    () => computeHumidity({ dryF, wetF, pressureKPa: pressure.valueKPa }),
    [dryF, wetF, pressure.valueKPa],
  );

  const hasInputs = Number.isFinite(dryF) && Number.isFinite(wetF);

  useEffect(() => {
    if (result.rh == null || !hasInputs) return;
    const rhPct = result.rh * 100;
    const bucket = rhPct < 2 ? '0-2' : rhPct < 5 ? '2-5' : rhPct < 10 ? '5-10' : '10+';
    track('humidity_calculated', { rh_bucket: bucket, pressure_source: pressure.source });
  }, [result.rh, hasInputs, pressure.source]);

  return (
    <>
      <header
        style={{
          background: '#121a14',
          borderBottom: `1px solid ${S.border}`,
          padding: '14px 16px',
        }}
      >
        <div
          className="bbq-container"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0 }}
        >
          <button
            onClick={() => navigateTo('home')}
            style={{
              background: 'none',
              border: 'none',
              color: S.muted,
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ← Home
          </button>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 1, color: ACCENT }}>
            PIT HUMIDITY
          </div>
          <div style={{ width: 60 }} />
        </div>
      </header>

      <div className="bbq-container" style={{ padding: '20px 16px', maxWidth: 520 }}>
        <p style={{ fontSize: 13, color: S.muted, lineHeight: 1.5, marginTop: 0 }}>
          Enter the two probe readings from your wet-bulb rig. Wet-bulb is the
          probe wicking water from the mason jar. Dry-bulb is the exposed
          ambient probe. Pressure is fetched automatically from your local
          weather station.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>
              DRY BULB (°F)
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={dryStr}
              onChange={(e) => setDryStr(e.target.value)}
              placeholder="e.g. 275"
              style={{ ...sInput, fontSize: 18 }}
            />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>
              WET BULB (°F)
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={wetStr}
              onChange={(e) => setWetStr(e.target.value)}
              placeholder="e.g. 160"
              style={{ ...sInput, fontSize: 18 }}
            />
          </label>
        </div>

        <div
          style={{
            background: S.dark,
            border: `1px solid ${S.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 16,
            fontSize: 13,
            color: S.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: S.muted, letterSpacing: 1, marginBottom: 2 }}>
              STATION PRESSURE
            </div>
            <div style={{ fontWeight: 600 }}>
              {pressureLoading ? 'Fetching…' : `${pressure.valueKPa.toFixed(2)} kPa`}
              <span style={{ color: S.muted, fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                ({SOURCE_LABEL[pressure.source]})
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowOverride((v) => !v)}
            style={{
              background: 'none',
              border: `1px solid ${S.border}`,
              borderRadius: 6,
              color: S.text,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {showOverride ? 'Cancel' : 'Override'}
          </button>
        </div>

        {showOverride && (
          <div style={{ marginBottom: 16 }}>
            <input
              type="number"
              inputMode="decimal"
              value={manualPressureStr}
              onChange={(e) => setManualPressureStr(e.target.value)}
              placeholder={`kPa (default ${DEFAULT_PRESSURE_KPA})`}
              style={{ ...sInput, fontSize: 15 }}
            />
            <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>
              Sea level = 101.325 kPa. Waukesha ≈ 98.3 kPa. Denver ≈ 83 kPa.
            </div>
          </div>
        )}

        <div
          style={{
            background: S.card,
            border: `1px solid ${S.border}`,
            borderRadius: 10,
            padding: '20px 16px',
            marginBottom: 12,
            textAlign: 'center',
            opacity: hasInputs ? 1 : 0.4,
          }}
        >
          <div style={{ fontSize: 11, color: S.muted, letterSpacing: 2, marginBottom: 6 }}>
            RELATIVE HUMIDITY
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: ACCENT,
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            {result.rh != null ? `${(result.rh * 100).toFixed(1)}%` : '—'}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              fontSize: 12,
              color: S.muted,
            }}
          >
            <div>
              <div style={{ letterSpacing: 1, marginBottom: 2 }}>HUMIDITY RATIO</div>
              <div style={{ color: S.text, fontWeight: 600, fontSize: 15 }}>
                {result.wKgPerKg != null
                  ? `${(result.wKgPerKg * 1000).toFixed(0)} g/kg`
                  : '—'}
              </div>
            </div>
            <div>
              <div style={{ letterSpacing: 1, marginBottom: 2 }}>DEW POINT</div>
              <div style={{ color: S.text, fontWeight: 600, fontSize: 15 }}>
                {result.dewpointF != null ? `${result.dewpointF.toFixed(0)}°F` : '—'}
              </div>
            </div>
          </div>
        </div>

        {result.warning && (
          <div
            style={{
              background: WARN_BG,
              border: `1px solid ${WARN_BORDER}`,
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              color: WARN_TEXT,
              lineHeight: 1.5,
            }}
          >
            {WARNING_MESSAGES[result.warning]}
          </div>
        )}
      </div>
    </>
  );
}
