import React from 'react';
import { track } from './analytics.js';

// First launch for BBQ Board: one screen that asks where the user buys
// meat. It used to be a three-card walkthrough that said "Pick your city"
// and then dropped everyone on Milwaukee, so anyone outside Milwaukee
// first saw shops hundreds of miles away (onboarding audit 2026-10-23,
// finding 1). Picking a city IS the onboarding now: Near me, search or
// state browse, all through the same LocationPicker the home screen uses.
// Skip keeps today's default. Dismissal persists to localStorage; the key
// starts with 'board', so account deletion's local wipe clears it.

const LS_KEY = 'board:onboarded';

// BBQ Board palette — brass + butcher-red, matching the app chrome.
const BRASS       = '#d4a64a';
const BUTCHER_RED = '#A85F52';
const TEXT_DIM    = '#9aa3ad';
const BG          = 'rgba(10, 10, 10, 0.97)';

export function hasOnboarded() {
  try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
}

export function markOnboarded() {
  try { localStorage.setItem(LS_KEY, '1'); } catch {}
}

// renderCityPicker(onPicked) returns the picker; the picker calls onPicked
// once a city is chosen, which finishes onboarding.
export default function Onboarding({ onDismiss, renderCityPicker }) {
  const finish = (how) => {
    // at_card stays at 1 so the GA4 history of this event keeps one meaning.
    track(how === 'skip' ? 'board_onboarding_skipped' : 'board_onboarding_completed', { at_card: 1 });
    markOnboarded();
    onDismiss?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: BG,
      display: 'flex', flexDirection: 'column',
      padding: 'calc(var(--sa-top, 0px) + 24px) 20px calc(var(--sa-bottom, 0px) + 24px)',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => finish('skip')}
          style={{
            background: 'none', border: 'none', color: TEXT_DIM,
            fontSize: 13, letterSpacing: 1, cursor: 'pointer',
          }}>Skip</button>
      </div>

      <div style={{ maxWidth: 520, width: '100%', margin: '0 auto', paddingTop: 12 }}>
        <div style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 14, fontWeight: 700,
          letterSpacing: 4, color: BRASS,
          marginBottom: 10, textAlign: 'center',
        }}>BBQ BOARD</div>

        <h2 style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 28, fontWeight: 700,
          letterSpacing: 1.5, color: BUTCHER_RED,
          margin: '0 0 12px', textAlign: 'center',
        }}>Where do you buy meat?</h2>

        <p style={{
          fontSize: 15, color: '#d6c4ad',
          lineHeight: 1.6, margin: '0 0 18px', textAlign: 'center',
        }}>
          Board shows what cooks paid at the butchers and meat counters near
          you. Pick your city to see them.
        </p>

        {renderCityPicker?.(() => finish('completed'))}

        <p style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5, marginTop: 14, textAlign: 'center' }}>
          See a shop with no price? Post what you paid. No account needed.
        </p>
      </div>
    </div>
  );
}
