import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';

// Website-owned promo chrome for the WEB build of Scorecard. On the web
// /scorecard/ page we want to convert visitors into app installs, so the
// Home screen shows "Get the app" store buttons in place of the Notebook
// cross-promo card (which stays on native — see Home.jsx).
//
// WEB ONLY. Returns null inside the native Android/iOS binary:
//  - the user is already in the app, so store buttons are pointless there
//  - App Store Guideline 2.3.10 forbids a Google Play link inside the iOS
//    binary; rendering nothing on native sidesteps it entirely.
//
// (Lives under src/components for now; relocates to website/ when the
// Scorecard web source fork completes — see docs/planning/
// website-standalone-architecture.md.)

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.holysmokesbbq.scorecard';
const APP_STORE_URL = 'https://apps.apple.com/us/app/bbq-scorecard/id6796120225';

const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

export default function ScorecardStoreButtons() {
  const { S } = useAppContext();
  if (isNative) return null;

  const pill = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: '#000', color: '#fff', border: '1px solid #333',
    borderRadius: '8px', padding: '10px 16px', textDecoration: 'none',
    fontSize: '13px', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif",
  };

  return (
    <div style={{ textAlign: 'center', margin: '4px 0 16px' }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: '11px', letterSpacing: '2px',
        color: S.muted, marginBottom: '10px',
      }}>
        GET THE APP
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" style={pill}
          onClick={() => track('scorecard_store_click', { store: 'google_play' })}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M3 20.5V3.5C3 2.9 3.3 2.4 3.8 2.1L13.1 12L3.8 21.9C3.3 21.6 3 21.1 3 20.5" fill="#00d7fe"/>
            <path d="M16.8 15.7L3.8 21.9L13.1 12L16.8 15.7Z" fill="#00f076"/>
            <path d="M16.8 8.3L3.8 2.1L13.1 12L16.8 8.3Z" fill="#ff3a44"/>
            <path d="M20.2 10.5C20.7 10.8 21 11.4 21 12C21 12.6 20.7 13.2 20.2 13.5L16.8 15.7L13.1 12L16.8 8.3L20.2 10.5Z" fill="#ffce00"/>
          </svg>
          Google Play
        </a>
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" style={pill}
          onClick={() => track('scorecard_store_click', { store: 'app_store' })}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M17.05 12.04c-.03-2.9 2.37-4.29 2.48-4.36-1.35-1.98-3.45-2.25-4.2-2.28-1.79-.18-3.49 1.05-4.4 1.05-.9 0-2.3-1.03-3.78-1-1.95.03-3.75 1.13-4.75 2.87-2.02 3.51-.52 8.71 1.45 11.56.96 1.39 2.11 2.96 3.61 2.9 1.45-.06 2-.94 3.75-.94 1.74 0 2.24.94 3.77.91 1.56-.03 2.55-1.42 3.5-2.82 1.1-1.61 1.56-3.17 1.58-3.25-.03-.02-3.03-1.16-3.06-4.62zM14.28 4.2c.8-.97 1.34-2.32 1.19-3.66-1.15.05-2.54.77-3.37 1.73-.74.85-1.39 2.22-1.21 3.53 1.28.1 2.59-.65 3.39-1.6z"/>
          </svg>
          App Store
        </a>
      </div>
    </div>
  );
}
