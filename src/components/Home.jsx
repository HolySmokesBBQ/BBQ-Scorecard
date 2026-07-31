import { useRef, useCallback, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { calcScores, exportCSV, track } from '../scoring.js';
import { SAMPLE_REVIEW } from '../sampleData.js';
import { NAV_V2 } from '../featureFlags.js';
import Avatar from './Avatar.jsx';
import NotebookAdCard from './NotebookAdCard.jsx';
import ScorecardOnboarding from './ScorecardOnboarding.jsx';
import NavDrawer from './NavDrawer.jsx';
import AboutScreen from './AboutScreen.jsx';
import {
  sendFriendRequest, getFriendsList,
  loadMyCloudReviews, mergeReviews, syncReviewsUp,
} from '../firebaseSync.js';
import { saveLocal } from '../storage.js';

export default function Home() {
  const {
    S, sBtn, sInput,
    reviews, ranked, rankMap,
    search, setSearch,
    tripFilter, setTripFilter,
    cityFilter, setCityFilter,
    quickFilter, setQuickFilter,
    trips, cities,
    sort, setSort,
    compareMode, setCompareMode,
    compareIds, setCompareIds,
    navigateTo, startNew, viewDetail, deleteReview, setView,
    fbUser, userProfile,
    fbFriends, setFbFriends,
    friendCodeInput, setFriendCodeInput,
    friendMsg, setFriendMsg,
    syncStatus, setSyncStatus,
    fbSyncing, setFbSyncing,
    setReviews,
    exportBackup, handleImport, publishReviews,
    importInputRef,
    showOnboarding, setShowOnboarding,
    showInAppWarning, setShowInAppWarning,
    pullRefreshing,
    theme, themePref, setThemePref,
    attemptSignIn,
    OfflineBanner,
    view,
  } = useAppContext();

  // NAV_V2: hamburger drawer + About modal state.
  const [showMenu, setShowMenu] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const menuGroups = [
    { title: 'BBQ SCORECARD', items: [{ label: 'Home', key: 'home' }] },
    { title: 'REVIEWS & MAP', items: [{ label: 'Map', key: 'map' }, { label: 'BBQ Near Me', key: 'nearby' }] },
    { title: 'COMPARE & PROGRESS', items: [{ label: 'Compare', key: 'compare' }, { label: 'Stats', key: 'stats' }, { label: 'MVP', key: 'mvp' }, { label: 'Rewards', key: 'achievements' }, { label: 'Leaderboard', key: 'leaderboard' }] },
    { title: 'ACCOUNT', items: [{ label: 'Settings', key: 'settings' }] },
  ];
  const onMenuSelect = (key) => {
    if (key === 'compare') { setCompareMode(true); setCompareIds([]); setView('home'); return; }
    navigateTo(key);
  };

  // Notebook removed in v3.1.12 — useCookContext / startNewCook /
  // deleteCook no longer needed on the Scorecard side.

  // Long-press handler for delete
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const startLongPress = useCallback((callback) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      callback();
    }, 600);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  return (
    <>
      <header style={{ background: theme === 'dark' ? '#1a1510' : '#ede5dc', borderBottom: `1px solid ${S.border}`, padding: '14px 16px' }}>
        <div className="bbq-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0 }}>
          {/* No "Back" on Home — the home screen is the app's root; iOS
              users navigate via the hamburger menu, not a web-style back
              button. (Sub-screens keep their own Back-to-home link.) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1, color: S.accent }}>
                BBQ SCORECARD
              </div>
              <div style={{ fontSize: 11, color: S.muted, marginTop: -2 }}>
                Rate and rank BBQ restaurants
              </div>
            </div>
          </div>
          {NAV_V2 ? (
            <button onClick={() => { setShowMenu(true); track('hamburger_opened'); }} aria-label="Open menu"
              style={{ background: 'none', border: `1px solid ${S.border}`,
                borderRadius: '8px', width: '40px', height: '40px', fontSize: '18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.text }}>
              ☰
            </button>
          ) : (
            <button onClick={() => setThemePref(t => t === 'dark' ? 'light' : t === 'light' ? 'system' : 'dark')}
              style={{ background: 'none', border: `1px solid ${S.border}`,
                borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.text }}>
              {themePref === 'dark' ? '☀' : themePref === 'light' ? '☽' : '◐'}
            </button>
          )}
        </div>
      </header>
    <div className="bbq-container" style={{ paddingBottom: '80px' }}>
      <OfflineBanner />

      {/* Pull-to-refresh indicator */}
      {pullRefreshing && (
        <div style={{
          textAlign: 'center', padding: '12px', fontSize: '13px', color: S.accent,
          background: S.dark, borderBottom: `1px solid ${S.border}`,
        }}>Syncing...</div>
      )}

      {/* In-app browser warning */}
      {showInAppWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: S.card, borderRadius: '16px', padding: '32px 24px', maxWidth: '360px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', color: S.accent, marginBottom: '12px', letterSpacing: '1px' }}>Open in Your Browser</h3>
            <p style={{ fontSize: '14px', color: S.text, lineHeight: 1.6, marginBottom: '20px' }}>
              Google sign-in doesn't work inside app browsers like Facebook or Instagram. Tap the menu (look for <strong>⋯</strong> or <strong>⋮</strong>) and choose <strong>"Open in Safari"</strong> or <strong>"Open in Chrome"</strong>.
            </p>
            <button onClick={() => {
              try { navigator.clipboard.writeText('https://holysmokesbbqco.com'); } catch {}
              setShowInAppWarning(false);
            }} style={{ ...sBtn(true, false), width: '100%', marginBottom: '10px' }}>
              Copy Link
            </button>
            <button onClick={() => setShowInAppWarning(false)} style={{ ...sBtn(false, false), width: '100%', fontSize: '13px' }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showOnboarding && view === 'home' && (
        <ScorecardOnboarding onDismiss={() => setShowOnboarding(false)} />
      )}

      <div style={{ padding: '0 16px' }}>
      {/* Brand block */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <img src={`${import.meta.env.BASE_URL}bbq-scorecard-logo.png`}
          alt="BBQ Scorecard"
          style={{ width: '150px', height: '150px', borderRadius: '50%', marginBottom: '8px' }}
          onError={(e) => { e.target.style.display = 'none'; }} />
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', fontWeight: '700', letterSpacing: '2px', color: S.accent }}>
          BBQ Scorecard
        </h1>
        <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '3px' }}>by Holy Smokes BBQ Co</div>
      </div>

      {/* Notebook cross-promo — shown until dismissed, then hidden for
          30 days. Lives above the search/filter row so it's visible
          without scrolling but doesn't block primary actions. */}
      <NotebookAdCard />

      <>
      {/* Search */}
      <input type="text" placeholder="Search restaurants..." value={search} onChange={e => setSearch(e.target.value)}
        style={{ ...sInput(), marginBottom: '10px' }} />

      {/* Quick filter chips — one at a time, tap active to clear. */}
      {reviews.length > 3 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {[
            { key: 'top',    label: 'Top rated' },
            { key: 'recent', label: 'Last 30 days' },
            { key: 'photos', label: 'With photos' },
          ].map(chip => {
            const active = quickFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => {
                  const next = active ? '' : chip.key;
                  setQuickFilter(next);
                  if (next) track('quick_filter_applied', { filter: next });
                }}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px', fontWeight: 600,
                  borderRadius: '999px',
                  border: `1px solid ${active ? S.accent : S.border}`,
                  background: active ? S.accent : 'transparent',
                  color: active ? '#fff' : S.muted,
                  cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {trips.length > 0 && (
          <select value={tripFilter} onChange={e => { setTripFilter(e.target.value); if (e.target.value) track('filter_applied', { type: 'trip' }); }}
            style={{ ...sInput(), width: 'auto', flex: 1, fontSize: '12px', padding: '8px' }}>
            <option value="">All Trips</option>
            {trips.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {cities.length > 0 && (
          <select value={cityFilter} onChange={e => { setCityFilter(e.target.value); if (e.target.value) track('filter_applied', { type: 'city' }); }}
            style={{ ...sInput(), width: 'auto', flex: 1, fontSize: '12px', padding: '8px' }}>
            <option value="">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Sort + actions */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {['date', 'score'].map(s => (
          <button key={s} onClick={() => { setSort(s); if (sort !== s) track('sort_changed', { sort: s }); }} style={sBtn(sort === s, true)}>
            {s === 'date' ? 'Date' : 'Score'}
          </button>
        ))}
        {!NAV_V2 && <>
          <button onClick={() => navigateTo('stats')} style={sBtn(false, true)}>Stats</button>
          <button onClick={() => navigateTo('mvp')} style={sBtn(false, true)}>MVP</button>
          <button onClick={() => navigateTo('map')} style={sBtn(false, true)}>Map</button>
          <button onClick={() => navigateTo('nearby')} style={sBtn(false, true)}>Nearby</button>
          <button onClick={() => navigateTo('achievements')} style={sBtn(false, true)}>Rewards</button>
          <button onClick={() => { setCompareMode(!compareMode); setCompareIds([]); }}
            style={sBtn(compareMode, true)}>
            {compareMode ? '✕ Cancel' : 'Compare'}
          </button>
        </>}
      </div>

      {compareMode && (
        <div style={{ padding: '8px', background: S.dark, borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: S.muted }}>
          Tap 2 restaurants to compare. Selected: {compareIds.length}/2
          {compareIds.length === 2 && (
            <button onClick={() => { navigateTo('compare'); }}
              style={{ ...sBtn(true, true), marginLeft: '8px' }}>Go</button>
          )}
        </div>
      )}

      {/* Review list.
          Empty-state + example show ONLY when the user has zero real reviews.
          Once they log one, the example disappears permanently — even if a
          filter currently matches nothing (we show a "no matches" hint in
          that case instead of falling back to the example). */}
      {reviews.length === 0 ? (
        <div style={{ marginTop: '32px' }}>
          <div style={{ textAlign: 'center', background: S.card, borderRadius: '12px', padding: '32px 20px', border: `1px solid ${S.border}`, marginBottom: '16px' }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: '700', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>No Reviews Yet</div>
            <div style={{ fontSize: '13px', color: S.muted, marginBottom: '20px', lineHeight: '1.6' }}>
              Hit the button and get eating.
            </div>
            <button onClick={startNew} style={{ ...sBtn(true, false), padding: '12px 32px', fontSize: '15px', fontWeight: '600' }}>
              New Review
            </button>
            {!fbUser && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${S.border}` }}>
                <div style={{ fontSize: '12px', color: S.muted, marginBottom: '8px' }}>Sign in to sync and add friends</div>
                {NAV_V2 ? (
                  <button onClick={() => navigateTo('settings')} style={{ ...sBtn(false, true), fontSize: '12px' }}>
                    Sign In or Create Account
                  </button>
                ) : (
                  <button onClick={async () => {
                    setSyncStatus('connecting');
                    const user = await attemptSignIn();
                    setSyncStatus(user ? 'done' : 'error');
                    setTimeout(() => setSyncStatus(''), 2000);
                  }} style={{ ...sBtn(false, true), fontSize: '12px' }}>
                    {syncStatus === 'connecting' ? 'Connecting...' : 'Sign In with Google'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Example review */}
          {(() => {
            const sc = calcScores(SAMPLE_REVIEW.scores);
            return (
              <div>
                <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '8px', textAlign: 'center' }}>
                  EXAMPLE REVIEW · TAP TO SEE HOW IT WORKS
                </div>
                <div onClick={() => viewDetail(SAMPLE_REVIEW)}
                  style={{ padding: '14px', background: S.dark, borderRadius: '8px', cursor: 'pointer',
                    border: `1px dashed ${S.border}`, opacity: 0.85 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', color: S.accent, background: S.card, padding: '2px 6px', borderRadius: '4px', fontWeight: '700', letterSpacing: '0.5px' }}>EXAMPLE</span>
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>{SAMPLE_REVIEW.restaurant}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>
                        {SAMPLE_REVIEW.location} · {SAMPLE_REVIEW.date}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: '#fbbf24', fontSize: '14px', letterSpacing: '1px' }}>
                        {'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: S.accent }}>{sc.composite.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : ranked.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: S.muted, fontSize: '13px' }}>
          No reviews match your filters.
          {(search || tripFilter || cityFilter || quickFilter) && (
            <div style={{ marginTop: '12px' }}>
              <button onClick={() => { setSearch(''); setTripFilter(''); setCityFilter(''); setQuickFilter(''); }}
                style={sBtn(false, true)}>Clear filters</button>
            </div>
          )}
        </div>
      ) : (
        <div className="bbq-review-grid">
        {ranked.map((r) => {
          const sc = calcScores(r.scores);
          const rank = rankMap[r.id];
          const isSelected = compareIds.includes(r.id);
          return (
            <div key={r.id}
              onClick={() => {
                if (longPressTriggered.current) return;
                if (compareMode) {
                  if (isSelected) setCompareIds(compareIds.filter(id => id !== r.id));
                  else if (compareIds.length < 2) setCompareIds([...compareIds, r.id]);
                  return;
                }
                viewDetail(r);
              }}
              onTouchStart={() => startLongPress(() => deleteReview(r.id))}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onContextMenu={(e) => { e.preventDefault(); deleteReview(r.id); }}
              style={{
                padding: '14px', background: isSelected ? (theme === 'dark' ? '#2a2015' : '#fff3e0') : S.card, borderRadius: '8px',
                marginBottom: '8px', cursor: 'pointer', border: `1px solid ${isSelected ? S.accent : S.border}`,
                transition: 'all 0.15s', WebkitTouchCallout: 'none', userSelect: 'none',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: S.accent, fontWeight: '700', fontFamily: "'Oswald', sans-serif" }}>
                      #{rank}
                    </span>
                    <span style={{ fontWeight: '600', fontSize: '15px' }}>{r.restaurant}</span>
                    {rank === 1 && <span style={{ fontSize: '13px' }}>{'👑'}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>
                    {r.location || 'No location'}{r.trip ? ` · ${r.trip}` : ''} · {r.date}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#fbbf24', fontSize: '14px', letterSpacing: '1px' }}>
                    {'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: S.accent }}>{sc.composite.toFixed(2)}</div>
                  {r.price && (
                    <div style={{ fontSize: '11px', color: S.muted }}>
                      ${r.price}{r.priceSplit > 1 ? ` · $${(r.price / r.priceSplit).toFixed(0)}/ea` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      </>

      {/* Account & Sync, Export, Share, Privacy.
          NAV_V2 relocates all of this into the hamburger → Settings
          screen, leaving Home as a clean reviews list + FAB. Pre-NAV_V2
          keeps the inline footer so the old build is unchanged. */}
      {!NAV_V2 && (<>
      <div style={{ marginTop: '20px' }}>
        {!fbUser ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: S.card, borderRadius: '10px', padding: '20px', border: `1px solid ${S.border}`, marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', marginBottom: '8px' }}>Sign In</div>
              <div style={{ fontSize: '12px', color: S.muted, marginBottom: '12px' }}>
                Sync reviews, add friends, see the leaderboard.
              </div>
              <button onClick={async () => {
                setSyncStatus('connecting');
                const user = await attemptSignIn();
                setSyncStatus(user ? 'done' : 'error');
                setTimeout(() => setSyncStatus(''), 2000);
              }} style={{ ...sBtn(true, false), width: '100%', maxWidth: '280px' }}>
                {syncStatus === 'connecting' ? 'Connecting...' : 'Sign In with Google'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Signed-in user card with friend code + add friend */}
            <div style={{ background: S.card, borderRadius: '10px', padding: '16px', border: `1px solid ${S.border}`, marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Avatar src={fbUser.photoURL} name={fbUser.displayName} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{fbUser.displayName}</div>
                  <div style={{ fontSize: '11px', color: S.muted }}>{fbUser.email}</div>
                </div>
                <button onClick={() => navigateTo('profile')} style={{ ...sBtn(false, true), padding: '4px 10px' }}>Profile</button>
              </div>

              {/* Friend Code + Share */}
              {userProfile && (
                <div style={{ background: S.dark, borderRadius: '8px', padding: '12px', marginBottom: '12px', textAlign: 'center', border: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: '10px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>Your Friend Code</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '22px', fontWeight: '700', fontFamily: "'Oswald', sans-serif",
                      color: S.accent, letterSpacing: '3px',
                    }}>{userProfile.friendCode}</span>
                    <button onClick={() => {
                      const url = `${window.location.origin}/#add-friend/${userProfile.friendCode}`;
                      if (navigator.share) navigator.share({ title: 'Join me on Holy Smokes BBQ', text: `Add me on BBQ Scorecard! My friend code is ${userProfile.friendCode}`, url });
                      else { navigator.clipboard?.writeText(userProfile.friendCode); alert('Friend code copied!'); }
                    }} style={{ ...sBtn(true, true), padding: '4px 10px', fontSize: '11px' }}>Share</button>
                  </div>
                </div>
              )}

              {/* Add Friend inline — sends a request; they must accept */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '6px' }}>Add a Friend</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" value={friendCodeInput} onChange={e => { const v = e.target.value.toUpperCase(); setFriendCodeInput(v.startsWith('BBQ-') ? v : 'BBQ-'); }}
                    placeholder="BBQ-XXXXXX" maxLength={10}
                    onKeyDown={e => { if (e.key === 'Enter') {
                      e.preventDefault();
                      (async () => {
                        setFriendMsg('Sending...');
                        const result = await sendFriendRequest(fbUser.uid, friendCodeInput);
                        setFriendMsg(result.ok ? 'Request sent. They still have to accept.' : result.error);
                        if (result.ok) {
                          track('friend_request_sent');
                          setFriendCodeInput('BBQ-');
                        }
                        setTimeout(() => setFriendMsg(''), 4000);
                      })();
                    }}}
                    style={{ ...sInput(), flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', textAlign: 'center', padding: '8px' }} />
                  <button onClick={async () => {
                    setFriendMsg('Sending...');
                    const result = await sendFriendRequest(fbUser.uid, friendCodeInput);
                    setFriendMsg(result.ok ? 'Request sent. They still have to accept.' : result.error);
                    if (result.ok) {
                      track('friend_request_sent');
                      setFriendCodeInput('BBQ-');
                    }
                    setTimeout(() => setFriendMsg(''), 4000);
                  }} disabled={friendCodeInput.length < 8} style={sBtn(friendCodeInput.length >= 8, false)}>Send</button>
                </div>
                {friendMsg && (
                  <div style={{ fontSize: '12px', color: friendMsg.includes('sent') ? '#4ade80' : '#f87171', marginTop: '6px', textAlign: 'center' }}>{friendMsg}</div>
                )}
              </div>

              {/* Friends count or empty state */}
              {fbFriends.length > 0 ? (
                <div style={{ fontSize: '11px', color: S.muted, textAlign: 'center', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${S.border}` }}>
                  {fbFriends.length} friend{fbFriends.length !== 1 ? 's' : ''} connected
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: '11px', color: S.muted, marginBottom: '6px' }}>No friends yet. Share your code above.</div>
                </div>
              )}
            </div>

            {/* Action buttons row */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
              <button onClick={async () => {
                setFbSyncing(true);
                try {
                  const cloud = await loadMyCloudReviews(fbUser.uid);
                  const merged = mergeReviews(reviews, cloud);
                  setReviews(merged);
                  saveLocal(merged);
                  await syncReviewsUp(fbUser.uid, merged);
                  setSyncStatus('done');
                } catch { setSyncStatus('error'); }
                setFbSyncing(false);
                setTimeout(() => setSyncStatus(''), 2000);
              }} disabled={fbSyncing} style={{ ...sBtn(false, true), opacity: fbSyncing ? 0.5 : 1 }}>
                {fbSyncing ? 'Syncing...' : syncStatus === 'done' ? 'Synced' : 'Sync'}
              </button>
              <button onClick={() => navigateTo('leaderboard')} style={sBtn(false, true)}>Leaderboard</button>
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => exportCSV(reviews)} style={sBtn(false, true)}>Export CSV</button>
          <button onClick={exportBackup} style={sBtn(false, true)}>Export Backup</button>
          <button onClick={() => importInputRef.current?.click()} style={sBtn(false, true)}>Import Backup</button>
          <input ref={importInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </div>
      </div>

      {/* Share App */}
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button onClick={() => {
          const shareData = {
            title: 'BBQ Scorecard by Holy Smokes BBQ Co',
            text: 'Score BBQ restaurants across 10 categories, track visits, and compare with friends.',
            url: 'https://holysmokesbbqco.com/scorecard',
          };
          if (navigator.share) navigator.share(shareData).catch(() => {});
          else { navigator.clipboard?.writeText(shareData.url); alert('Link copied!'); }
        }} style={{ ...sBtn(false, true), fontSize: '12px', padding: '8px 16px' }}>
          Share BBQ Scorecard
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <a href="https://holysmokesbbqco.com/privacy.html" style={{ fontSize: '11px', color: S.muted, textDecoration: 'none' }}>Privacy Policy</a>
        <span style={{ fontSize: '11px', color: S.border, margin: '0 6px' }}>{'·'}</span>
        <a href={`${import.meta.env.BASE_URL}changelog.html`} style={{ fontSize: '11px', color: S.muted, textDecoration: 'none' }}>Changelog</a>
        <span style={{ fontSize: '11px', color: S.border, margin: '0 6px' }}>{'·'}</span>
        <a href={`${import.meta.env.BASE_URL}delete-account.html`} style={{ fontSize: '11px', color: S.muted, textDecoration: 'none' }}>Delete Account</a>
      </div>
      </>)}
      </div>

      {/* FAB — Add a new review. Notebook removed in v3.1.12 so this
          always starts a new restaurant review. */}
      <button onClick={startNew} style={{
        position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px',
        borderRadius: '50%', background: S.accent, color: '#fff', border: 'none',
        fontSize: '28px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>+</button>
    </div>
    {NAV_V2 && (
      <NavDrawer
        open={showMenu}
        onClose={() => setShowMenu(false)}
        groups={menuGroups}
        onSelect={onMenuSelect}
        onAbout={() => setShowAbout(true)}
        S={S}
        theme={theme}
      />
    )}
    {showAbout && <AboutScreen onClose={() => setShowAbout(false)} />}
    </>
  );
}
