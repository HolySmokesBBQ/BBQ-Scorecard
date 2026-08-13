import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { CATEGORIES, DESCRIPTORS, MEATS, SIDES_LIST, SAUCE_DEP_OPTIONS, RETURN_OPTIONS } from '../constants.js';
import { calcScores, track } from '../scoring.js';

// One row per BBQ / Family category. Nine tappable number buttons —
// tap a number to set the score directly. The radial ScoreWheel that
// briefly landed in v3.4.6 was removed in v3.4.7: Scorecard scores are
// integer 1–9 (no fractional precision), so the wheel added ceremony
// without benefit. The wheel still lives in the codebase for Notebook's
// cook ratings, which DO want fractional values like 7.25.
function CategoryScoreRow({ c, value, onPick, S }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: S.accent }}>{value || '—'}</span>
      </div>
      {value > 0 && DESCRIPTORS[c.key]?.[value] && (
        <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic', marginBottom: '6px' }}>
          {DESCRIPTORS[c.key][value]}
        </div>
      )}
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => onPick(n)} style={{
            flex: 1, padding: '8px 0', background: value === n ? S.accent : S.dark,
            color: value === n ? '#fff' : S.muted,
            border: `1px solid ${value === n ? S.accent : S.border}`,
            borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>{n}</button>
        ))}
      </div>
    </div>
  );
}

export default function ReviewForm() {
  const {
    S, sBtn, sInput, sLabel,
    view, setView, setDirty, dirty,
    currentReview, setCurrentReview,
    update, updateScore, toggleChip,
    saveCurrentReview, handlePhoto, removePhoto,
    addFriend, removeFriend, updateFriendScore,
    friendName, setFriendName, friendsList,
    addTimestampedNote,
    fileInputRef, galleryInputRef,
    trips, reviews,
  } = useAppContext();

  // Autocomplete: dedupe restaurant names from every prior review so the
  // native <datalist> can offer them as you type. Case-insensitive dedupe
  // via lowercased key, but we keep whichever casing you first entered
  // (usually the correct one) as the display value.
  const restaurantSuggestions = (() => {
    const seen = new Map();
    for (const r of (reviews || [])) {
      const name = (r?.restaurant || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  })();

  // Custom restaurant autocomplete. Replaces the native <datalist>, which
  // rendered as a half-transparent, sticky overlay in the Android WebView
  // and always offered the entire list. We only surface suggestions once
  // what's typed actually resembles an existing name, and the dropdown is
  // a plain positioned element we fully control and can hide cleanly.
  const [showRestaurantList, setShowRestaurantList] = useState(false);
  const restaurantMatches = (() => {
    const q = (currentReview.restaurant || '').trim().toLowerCase();
    if (!q) return [];
    const hits = restaurantSuggestions.filter(n => n.toLowerCase().includes(q));
    // Nothing to offer if the only hit is the exact name already typed.
    if (hits.length === 1 && hits[0].toLowerCase() === q) return [];
    // Prefix matches first (the closest "similar name"), then the rest.
    hits.sort((a, b) => {
      const ap = a.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.toLowerCase().startsWith(q) ? 0 : 1;
      return ap - bp || a.localeCompare(b);
    });
    return hits.slice(0, 6);
  })();

  const sc = calcScores(currentReview.scores);

  return (
    <div className="bbq-container-form">
      <button onClick={() => {
        if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
        setView('home'); setCurrentReview(null); setDirty(false);
      }} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>
        Back
      </button>

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>
        {view === 'new' ? 'New Review' : 'Edit Review'}
      </h2>

      {/* Info Fields */}
      <div style={{ marginBottom: '20px' }}>
        <div className="bbq-form-fields">
        <div style={{ marginBottom: '10px', position: 'relative' }}>
          <label style={sLabel()}>RESTAURANT</label>
          <input type="text"
            value={currentReview.restaurant}
            onChange={e => { update('restaurant', e.target.value); setShowRestaurantList(true); }}
            onFocus={() => setShowRestaurantList(true)}
            // Delay the hide so a tap on a suggestion (which fires onMouseDown
            // first) still registers before the list closes.
            onBlur={() => setTimeout(() => setShowRestaurantList(false), 150)}
            autoComplete="off"
            placeholder="Name" style={sInput()} />
          {showRestaurantList && restaurantMatches.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
              marginTop: '2px', background: S.card, border: `1px solid ${S.border}`,
              borderRadius: '6px', overflow: 'hidden', boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
            }}>
              {restaurantMatches.map((name, i) => (
                <div key={name}
                  // onMouseDown (not onClick) so it fires before the input's
                  // blur; preventDefault keeps focus from bouncing.
                  onMouseDown={(e) => { e.preventDefault(); update('restaurant', name); setShowRestaurantList(false); }}
                  style={{
                    padding: '10px 12px', fontSize: '14px', color: S.text, cursor: 'pointer',
                    borderTop: i === 0 ? 'none' : `1px solid ${S.border}`,
                  }}>
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={sLabel()}>DATE</label>
          <input type="date" value={currentReview.date} onChange={e => update('date', e.target.value)} style={sInput()} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={sLabel()}>LOCATION</label>
          <input type="text" value={currentReview.location} onChange={e => update('location', e.target.value)} placeholder="City, State" style={sInput()} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={sLabel()}>TRIP</label>
          <input type="text" value={currentReview.trip || ''} onChange={e => update('trip', e.target.value)} placeholder="e.g. San Antonio 2026" style={sInput()}
            list="trip-suggestions" />
          {trips.length > 0 && (
            <datalist id="trip-suggestions">
              {trips.map(t => <option key={t} value={t} />)}
            </datalist>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ flex: 2 }}>
            <label style={sLabel()}>PRICE ($)</label>
            <input type="number" inputMode="decimal" value={currentReview.price || ''} onChange={e => update('price', e.target.value)} placeholder="Total" style={sInput()} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={sLabel()}>SPLIT</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button onClick={() => update('priceSplit', String(Math.max(1, Number(currentReview.priceSplit || 1) - 1)))}
                style={{ width: '40px', height: '42px', background: S.dark, border: `1px solid ${S.border}`,
                  borderRadius: '6px 0 0 6px', color: S.text, fontSize: '20px', fontWeight: '700',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
              <div style={{ height: '42px', minWidth: '36px', padding: '0 8px', background: S.card,
                border: `1px solid ${S.border}`, borderLeft: 'none', borderRight: 'none',
                color: S.text, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center',
                justifyContent: 'center' }}>{currentReview.priceSplit || '1'}</div>
              <button onClick={() => update('priceSplit', String(Number(currentReview.priceSplit || 1) + 1))}
                style={{ width: '40px', height: '42px', background: S.dark, border: `1px solid ${S.border}`,
                  borderRadius: '0 6px 6px 0', color: S.text, fontSize: '20px', fontWeight: '700',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>
          {currentReview.price > 0 && currentReview.priceSplit > 1 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: S.accent, fontWeight: '600' }}>
                ${(Number(currentReview.price) / Number(currentReview.priceSplit)).toFixed(2)}/ea
              </span>
            </div>
          )}
        </div>
        </div>{/* end bbq-form-fields */}

        <div style={{ marginBottom: '10px' }}>
          <label style={sLabel()}>PHOTOS ({(currentReview.photos || []).length}/3)</label>
          {(currentReview.photos || []).length > 0 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '8px', padding: '4px 0' }}>
              {(currentReview.photos || []).map((p, i) => (
                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={p} alt={`Photo ${i + 1}`} style={{ width: '100px', height: '100px', borderRadius: '6px', objectFit: 'cover' }} />
                  <button onClick={() => removePhoto(i)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'✕'}</button>
                </div>
              ))}
            </div>
          )}
          {(currentReview.photos || []).length < 3 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => fileInputRef.current?.click()}
                style={{ ...sBtn(false, false), flex: 1 }}>Camera</button>
              <button onClick={() => galleryInputRef.current?.click()}
                style={{ ...sBtn(false, false), flex: 1 }}>Gallery</button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
          <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={sLabel()}>GOOGLE REVIEW URL</label>
          <input type="url" value={currentReview.googleReviewUrl || ''} onChange={e => update('googleReviewUrl', e.target.value)} placeholder="https://..." style={sInput()} />
        </div>
      </div>

      {/* Meats */}
      <div style={{ marginBottom: '16px' }}>
        <label style={sLabel()}>MEATS ORDERED</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
          {MEATS.map(m => (
            <button key={m} onClick={() => toggleChip('meats', m)}
              style={sBtn((currentReview.meats || []).includes(m), true)}>{m}</button>
          ))}
        </div>
        <input type="text" value={currentReview.meatOther || ''} onChange={e => update('meatOther', e.target.value)} placeholder="Other meat..." style={{ ...sInput(), fontSize: '12px' }} />
      </div>

      {/* Sides */}
      <div style={{ marginBottom: '16px' }}>
        <label style={sLabel()}>SIDES ORDERED</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
          {SIDES_LIST.map(s => (
            <button key={s} onClick={() => toggleChip('sides', s)}
              style={sBtn((currentReview.sides || []).includes(s), true)}>{s}</button>
          ))}
        </div>
        <input type="text" value={currentReview.sideOther || ''} onChange={e => update('sideOther', e.target.value)} placeholder="Other side..." style={{ ...sInput(), fontSize: '12px' }} />
      </div>

      {/* Dessert */}
      <div style={{ marginBottom: '20px' }}>
        <label style={sLabel()}>DESSERT</label>
        <input type="text" value={currentReview.dessert || ''} onChange={e => update('dessert', e.target.value)} placeholder="What'd you have?" style={sInput()} />
      </div>

      {/* Friends */}
      <div style={{ marginBottom: '20px' }}>
        <label style={sLabel()}>FRIENDS AT THIS MEAL</label>
        {(currentReview.friends || []).length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {(currentReview.friends || []).map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                background: S.dark, borderRadius: '12px', border: `1px solid ${S.border}`, fontSize: '12px' }}>
                <span>{f.name}</span>
                <button onClick={() => removeFriend(f.name)}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}>{'✕'}</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="text" value={friendName} onChange={e => setFriendName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFriend(); } }}
            placeholder="Add a friend..." style={{ ...sInput(), flex: 1 }} list="friend-suggestions" />
          <button onClick={addFriend} disabled={!friendName.trim()}
            style={{ ...sBtn(!!friendName.trim(), true), whiteSpace: 'nowrap' }}>+ Add</button>
        </div>
        {friendsList.length > 0 && (
          <datalist id="friend-suggestions">
            {friendsList.filter(f => !(currentReview.friends || []).find(fr => fr.name === f)).map(f => (
              <option key={f} value={f} />
            ))}
          </datalist>
        )}
      </div>

      {/* BBQ + Family Scoring — side by side on desktop */}
      <div className="bbq-form-tracks">
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: S.accent, marginBottom: '12px' }}>BBQ Quality Track</div>
        {CATEGORIES.bbq.map(c => (
          <CategoryScoreRow
            key={c.key} c={c} S={S}
            value={currentReview.scores[c.key]}
            onPick={(n) => updateScore(c.key, n)}
          />
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: S.accent, marginBottom: '12px' }}>Family Experience Track</div>
        {CATEGORIES.family.map(c => (
          <CategoryScoreRow
            key={c.key} c={c} S={S}
            value={currentReview.scores[c.key]}
            onPick={(n) => updateScore(c.key, n)}
          />
        ))}
      </div>
      </div>{/* end bbq-form-tracks */}

      {/* Friend Scoring (collapsed per friend) */}
      {(currentReview.friends || []).length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: S.accent, marginBottom: '12px' }}>
            Friend Scores
          </div>
          <div style={{ fontSize: '11px', color: S.muted, marginBottom: '10px' }}>
            Tap a category number to set each friend's score
          </div>
          {(currentReview.friends || []).map(friend => (
            <div key={friend.name} style={{ background: S.dark, borderRadius: '8px', padding: '12px', marginBottom: '8px', border: `1px solid ${S.border}` }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px', color: S.accent }}>{friend.name}</div>
              {[...CATEGORIES.bbq, ...CATEGORIES.family].map(c => (
                <div key={c.key} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: S.muted }}>{c.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: S.accent }}>{friend.scores[c.key] || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[1,2,3,4,5,6,7,8,9].map(n => (
                      <button key={n} onClick={() => updateFriendScore(friend.name, c.key, n)} style={{
                        flex: 1, padding: '5px 0', background: friend.scores[c.key] === n ? S.accent : S.card,
                        color: friend.scores[c.key] === n ? '#fff' : S.muted,
                        border: `1px solid ${friend.scores[c.key] === n ? S.accent : S.border}`,
                        borderRadius: '3px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      }}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
              {(() => {
                const fsc = calcScores(friend.scores);
                return fsc.bbqAvg > 0 ? (
                  <div style={{ textAlign: 'center', padding: '8px 0', borderTop: `1px solid ${S.border}`, marginTop: '4px' }}>
                    <span style={{ color: '#fbbf24', fontSize: '13px' }}>{'★'.repeat(fsc.stars)}{'☆'.repeat(5 - fsc.stars)}</span>
                    <span style={{ marginLeft: '8px', fontWeight: '700', color: S.accent }}>{fsc.composite.toFixed(2)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Live score */}
      <div style={{ background: S.dark, borderRadius: '8px', padding: '14px', marginBottom: '16px', textAlign: 'center', border: `1px solid ${S.border}` }}>
        <div style={{ color: '#fbbf24', fontSize: '18px' }}>{'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}</div>
        <div style={{ fontSize: '24px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>{sc.composite.toFixed(2)}</div>
        <div style={{ fontSize: '11px', color: S.muted }}>BBQ {sc.bbqAvg.toFixed(2)} + Bonus {sc.bonus.toFixed(2)}</div>
        {(currentReview.friends || []).length > 0 && (() => {
          const allScorers = [{ name: 'You', scores: currentReview.scores }, ...(currentReview.friends || [])];
          const avgScores = {};
          [...CATEGORIES.bbq, ...CATEGORIES.family].forEach(c => {
            const vals = allScorers.map(s => s.scores[c.key]).filter(v => v > 0);
            avgScores[c.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          });
          const gsc = calcScores(avgScores);
          return (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${S.border}` }}>
              <div style={{ fontSize: '11px', color: S.muted }}>Group Avg: {gsc.composite.toFixed(2)} ({gsc.stars}{'★'})</div>
            </div>
          );
        })()}
      </div>

      {/* Sauce dependency + Would return — side by side on desktop */}
      <div className="bbq-form-selects">
      <div style={{ marginBottom: '16px' }}>
        <label style={sLabel()}>SAUCE DEPENDENCY</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SAUCE_DEP_OPTIONS.map(opt => (
            <button key={opt} onClick={() => update('sauceDep', opt)}
              style={sBtn(currentReview.sauceDep === opt, true)}>{opt}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={sLabel()}>WOULD WE RETURN?</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {RETURN_OPTIONS.map(opt => (
            <button key={opt} onClick={() => update('wouldReturn', opt)}
              style={sBtn(currentReview.wouldReturn === opt, true)}>{opt}</button>
          ))}
        </div>
      </div>
      </div>{/* end bbq-form-selects */}

      {/* Notes with timestamp */}
      <div style={{ marginBottom: '20px' }}>
        <label style={sLabel()}>NOTES</label>
        {(currentReview.notesLog || []).length > 0 && (
          <div style={{ marginBottom: '8px', background: S.dark, borderRadius: '6px', padding: '10px' }}>
            {currentReview.notesLog.map((n, i) => (
              <div key={i} style={{ fontSize: '12px', color: S.text, padding: '3px 0', borderBottom: i < currentReview.notesLog.length - 1 ? `1px solid ${S.border}` : 'none' }}>{n}</div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          <textarea value={currentReview.notes || ''} onChange={e => update('notes', e.target.value)}
            placeholder="Add a note..." rows={2}
            style={{ ...sInput(), resize: 'vertical', flex: 1 }} />
          <button onClick={addTimestampedNote} disabled={!currentReview.notes?.trim()}
            style={{ ...sBtn(!!currentReview.notes?.trim(), true), alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </div>
      </div>

      {/* Save */}
      <button onClick={saveCurrentReview} disabled={!currentReview.restaurant.trim()}
        style={{
          width: '100%', padding: '14px', fontFamily: "'Oswald', sans-serif", fontSize: '16px',
          fontWeight: '700', letterSpacing: '1px', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: currentReview.restaurant.trim() ? S.accent : '#333',
          color: currentReview.restaurant.trim() ? '#fff' : '#666',
        }}>Save</button>
    </div>
  );
}
