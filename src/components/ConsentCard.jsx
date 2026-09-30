import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { getConsent, setConsent, onConsentChange } from '../consent.js';

// Usage-analytics consent (audit 2026-09-29, L-1). An inline Home card,
// not a modal: it never blocks scoring, and nothing is collected while it
// sits unanswered. Allow and No thanks carry identical styling so neither
// is the "easy" button. The wording is versioned in consent.js
// (CONSENT_TEXT_VERSION); change it materially and bump the version.

const PRIVACY_URL = 'https://holysmokesbbqco.com/privacy.html';

export const CONSENT_PURPOSE =
  'That covers which screens and features you use, plus the restaurant names on reviews you open, share, or compare. ' +
  "If you're signed in it's tied to your account ID, not your name or email.";

export function useConsent() {
  const [rec, setRec] = useState(() => getConsent());
  useEffect(() => onConsentChange(setRec), []);
  return rec;
}

export function openPrivacyPolicy() {
  window.open(PRIVACY_URL, '_blank', 'noopener,noreferrer');
}

export default function ConsentCard() {
  const { S } = useAppContext();
  const rec = useConsent();
  if (rec) return null;

  const choiceBtn = {
    flex: 1, padding: '10px 0', background: S.dark, color: S.text,
    border: `1px solid ${S.accent}`, borderRadius: '6px',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div role="region" aria-label="Usage analytics choice" style={{
      background: S.card, border: `1px solid ${S.border}`, borderLeft: `4px solid ${S.accent}`,
      borderRadius: '8px', padding: '12px 14px', marginBottom: '12px',
    }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '1px', color: S.accent, marginBottom: '4px' }}>
        USAGE ANALYTICS
      </div>
      <div style={{ fontSize: '12px', color: S.text, lineHeight: 1.5, marginBottom: '6px' }}>
        Can BBQ Scorecard send usage analytics to Google Analytics? {CONSENT_PURPOSE}
      </div>
      <div style={{ fontSize: '12px', color: S.muted, lineHeight: 1.5, marginBottom: '10px' }}>
        It helps decide what to build next. Nothing is sent unless you allow it, and you can change this in Settings any time.{' '}
        <button onClick={openPrivacyPolicy} style={{ background: 'none', border: 'none', padding: 0, color: S.accent, fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}>
          Privacy policy
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setConsent('denied')} style={choiceBtn}>No thanks</button>
        <button onClick={() => setConsent('granted')} style={choiceBtn}>Allow</button>
      </div>
    </div>
  );
}
