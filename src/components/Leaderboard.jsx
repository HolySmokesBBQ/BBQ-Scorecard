import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { calcScores, track } from '../scoring.js';
import { getAllFriendReviews } from '../firebaseSync.js';
import Avatar from './Avatar.jsx';

export default function Leaderboard() {
  const {
    S, sBtn,
    setView, navigateTo,
    reviews,
    fbUser, fbFriends,
    leaderboardData, setLeaderboardData,
    leaderboardSort, setLeaderboardSort,
    fbSyncing, setFbSyncing,
    theme,
  } = useAppContext();

  useEffect(() => { track('leaderboard_viewed', { friends: fbFriends?.length || 0 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeaderboard = async () => {
    if (!fbUser || fbFriends.length === 0) return;
    setFbSyncing(true);
    try {
      const friendIds = fbFriends.map(f => f.id);
      const allFR = await getAllFriendReviews(friendIds);

      // Group reviews by userId
      const byUser = {};
      // Add my reviews
      byUser[fbUser.uid] = { name: 'You', reviews: reviews, photoURL: fbUser.photoURL };
      // Add friend reviews
      for (const f of fbFriends) {
        byUser[f.id] = { name: f.displayName, reviews: [], photoURL: f.photoURL };
      }
      for (const r of allFR) {
        if (byUser[r.userId]) byUser[r.userId].reviews.push(r);
      }

      // Calculate stats per user
      const stats = Object.entries(byUser).map(([uid, data]) => {
        const scores = data.reviews.map(r => calcScores(r.scores));
        const avgComposite = scores.length ? scores.reduce((a, s) => a + s.composite, 0) / scores.length : 0;
        const avgBbq = scores.length ? scores.reduce((a, s) => a + s.bbqAvg, 0) / scores.length : 0;
        const avgStars = scores.length ? scores.reduce((a, s) => a + s.stars, 0) / scores.length : 0;
        const highestReview = data.reviews.length ? data.reviews.reduce((a, b) => calcScores(a.scores).composite > calcScores(b.scores).composite ? a : b) : null;
        const lowestReview = data.reviews.length ? data.reviews.reduce((a, b) => calcScores(a.scores).composite < calcScores(b.scores).composite ? a : b) : null;
        return {
          uid, name: data.name, photoURL: data.photoURL,
          reviewCount: data.reviews.length, avgComposite, avgBbq, avgStars,
          highestReview, lowestReview, isMe: uid === fbUser.uid,
        };
      }).sort((a, b) => b.avgComposite - a.avgComposite);

      // Find shared restaurants (reviewed by 2+ people)
      const restMap = {};
      for (const [uid, data] of Object.entries(byUser)) {
        for (const r of data.reviews) {
          const key = `${(r.restaurant || '').toLowerCase()}|${(r.location || '').toLowerCase()}`;
          if (!restMap[key]) restMap[key] = { restaurant: r.restaurant, location: r.location, reviews: [] };
          restMap[key].reviews.push({ ...r, userName: data.name, uid });
        }
      }
      const sharedRestaurants = Object.values(restMap)
        .filter(r => {
          const uniqueUsers = new Set(r.reviews.map(rv => rv.uid));
          return uniqueUsers.size > 1;
        })
        .sort((a, b) => b.reviews.length - a.reviews.length);

      setLeaderboardData({ stats, sharedRestaurants });
    } catch (e) {
      console.error('Leaderboard error:', e);
    }
    setFbSyncing(false);
  };

  // Load on mount
  if (!leaderboardData && !fbSyncing && fbUser && fbFriends.length > 0) {
    loadLeaderboard();
  }

  return (
    <div className="bbq-container" style={{ padding: '16px' }}>
      <button onClick={() => { setView('home'); setLeaderboardData(null); }}
        style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '4px' }}>Leaderboard</h2>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '16px' }}>Rankings across your group</div>

      {!fbUser ? (
        <div style={{ textAlign: 'center', color: S.muted, padding: '40px 0' }}>Sign in to see the leaderboard.</div>
      ) : fbFriends.length === 0 ? (
        <div style={{ textAlign: 'center', color: S.muted, padding: '40px 0' }}>
          Add friends to see the leaderboard.<br />
          <button onClick={() => navigateTo('profile')} style={{ ...sBtn(true, true), marginTop: '12px' }}>Go to Profile</button>
        </div>
      ) : fbSyncing ? (
        <div style={{ textAlign: 'center', color: S.muted, padding: '40px 0' }}>Loading leaderboard...</div>
      ) : leaderboardData ? (
        <>
          {/* Overall Rankings */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Overall Rankings</div>
              <select value={leaderboardSort} onChange={e => setLeaderboardSort(e.target.value)}
                style={{ background: S.dark, color: S.text, border: `1px solid ${S.border}`, borderRadius: '6px', padding: '4px 8px', fontSize: '11px' }}>
                <option value="reviews">Most Restaurants</option>
                <option value="composite">Avg Overall Score</option>
                <option value="bbq">Avg BBQ Score</option>
                <option value="stars">Avg Star Rating</option>
              </select>
            </div>
            {[...leaderboardData.stats].sort((a, b) => {
              if (leaderboardSort === 'composite') return b.avgComposite - a.avgComposite;
              if (leaderboardSort === 'bbq') return b.avgBbq - a.avgBbq;
              if (leaderboardSort === 'reviews') return b.reviewCount - a.reviewCount;
              if (leaderboardSort === 'stars') return b.avgStars - a.avgStars;
              return 0;
            }).map((s, idx) => (
              <div key={s.uid} style={{
                background: s.isMe ? (theme === 'dark' ? '#2a2015' : '#fff3e0') : S.card,
                borderRadius: '8px', padding: '12px', marginBottom: '8px',
                border: `1px solid ${s.isMe ? S.accent : S.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif", width: '28px' }}>
                    {idx === 0 ? '👑' : `#${idx + 1}`}
                  </span>
                  <Avatar src={s.photoURL} name={s.name} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: S.muted }}>{s.reviewCount} review{s.reviewCount !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', fontSize: '16px', color: S.accent }}>
                      {leaderboardSort === 'reviews' ? s.reviewCount : leaderboardSort === 'stars' ? s.avgStars.toFixed(1) : leaderboardSort === 'bbq' ? s.avgBbq.toFixed(2) : s.avgComposite.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11px', color: S.muted }}>
                      {leaderboardSort === 'reviews' ? 'reviews' : leaderboardSort === 'stars' ? 'avg stars' : leaderboardSort === 'bbq' ? 'bbq avg' : 'avg score'}
                    </div>
                  </div>
                </div>
                {s.highestReview && (
                  <div style={{ fontSize: '11px', color: S.muted, marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Best: {s.highestReview.restaurant} ({calcScores(s.highestReview.scores).composite.toFixed(2)})</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Shared Restaurants — Head to Head */}
          {leaderboardData.sharedRestaurants.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', marginBottom: '10px' }}>
                Head to Head ({leaderboardData.sharedRestaurants.length})
              </div>
              <div style={{ fontSize: '11px', color: S.muted, marginBottom: '10px' }}>Restaurants reviewed by multiple people</div>
              <div className="bbq-leaderboard-grid">
              {leaderboardData.sharedRestaurants.map((rest, idx) => (
                <div key={idx} style={{ background: S.card, borderRadius: '8px', padding: '12px', marginBottom: '8px', border: `1px solid ${S.border}` }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>{rest.restaurant}</div>
                  <div style={{ fontSize: '11px', color: S.muted, marginBottom: '8px' }}>{rest.location}</div>
                  {rest.reviews
                    .sort((a, b) => calcScores(b.scores).composite - calcScores(a.scores).composite)
                    .map((rv, i) => {
                      const rsc = calcScores(rv.scores);
                      return (
                        <div key={`${rv.uid}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < rest.reviews.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                          <span style={{ fontSize: '13px' }}>
                            {i === 0 && rest.reviews.length > 1 ? '👑 ' : ''}{rv.userName}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#fbbf24', fontSize: '12px' }}>{'★'.repeat(rsc.stars)}</span>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: S.accent }}>{rsc.composite.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                  })}
                </div>
              ))}
              </div>{/* end bbq-leaderboard-grid */}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
