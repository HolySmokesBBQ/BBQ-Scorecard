import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { CATEGORIES, DESCRIPTORS } from '../constants.js';
import { calcScores, generateGoogleDraft, track } from '../scoring.js';
import NotebookReviewBanner from './NotebookReviewBanner.jsx';

export default function Detail() {
  const {
    S, sBtn, sLabel,
    currentReview, setCurrentReview,
    setView, setDirty,
    galleryIndex, setGalleryIndex,
    draftText, setDraftText,
    editReview, duplicateReview, shareReview, shareReviewStory, exportText, deleteReview,
    shareGenerating,
    reviews, rankMap,
    friendReviewsMap,
    OfflineBanner,
  } = useAppContext();

  const r = currentReview;
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Fire a detail-view event each time we land on a new review id. Tells
  // us which restaurants get revisited — high-signal content engagement.
  useEffect(() => {
    if (r?.id) track('review_detail_viewed', { restaurant: r.restaurant || '', has_friends: (r.friends || []).length > 0 });
  }, [r?.id]);

  // PDF export — dynamic import keeps jsPDF (~240 KB gz) out of the
  // main bundle. Only loads when the user actually taps the button.
  const exportPdf = async () => {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    track('review_pdf_exported', { restaurant: r.restaurant || '' });
    try {
      const { exportReviewPdf } = await import('../reviewPdf.js');
      await exportReviewPdf(r, calcScores);
    } catch (e) {
      console.error('PDF export failed:', e);
      alert('PDF export failed. Try again or check console for details.');
    } finally {
      setPdfGenerating(false);
    }
  };
  const sc = calcScores(r.scores);
  const allCats = [...CATEGORIES.bbq, ...CATEGORIES.family];

  // Visit-count badge — how many times this restaurant appears in the
  // user's reviews. Match is case-insensitive on trimmed restaurant name.
  // Only interesting after visit 2, so the badge stays hidden on singles.
  const visitCount = (() => {
    const target = (r.restaurant || '').trim().toLowerCase();
    if (!target) return 0;
    return reviews.filter(x => (x.restaurant || '').trim().toLowerCase() === target).length;
  })();
  const orderParts = [
    ...(r.meats || []), r.meatOther, ...(r.sides || []), r.sideOther, r.dessert ? `Dessert: ${r.dessert}` : '',
  ].filter(Boolean);
  const photos = r.photos?.length ? r.photos : (r.photo ? [r.photo] : []);
  const hasFriends = (r.friends || []).length > 0;

  // Compute group average if friends exist
  const groupAvg = hasFriends ? (() => {
    const allScorers = [{ name: 'You', scores: r.scores }, ...(r.friends || [])];
    const avgScores = {};
    [...CATEGORIES.bbq, ...CATEGORIES.family].forEach(c => {
      const vals = allScorers.map(s => s.scores[c.key]).filter(v => v > 0);
      avgScores[c.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    return calcScores(avgScores);
  })() : null;

  return (
    <div className="bbq-container" style={{ paddingBottom: '16px' }}>
      <OfflineBanner />
      <div style={{ padding: '0 16px 16px' }}>
      <button onClick={() => { setView('home'); setCurrentReview(null); setDraftText(''); setGalleryIndex(0); }}
        style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px', marginTop: '16px' }}>Back</button>

      <div className="bbq-detail-layout">
      {/* Left column on desktop: photo + info + score */}
      <div className="bbq-detail-hero">
      {/* Photo Gallery */}
      {photos.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <img src={photos[galleryIndex] || photos[0]} alt="Food"
            style={{ width: '100%', borderRadius: '8px', maxHeight: '400px', objectFit: 'cover' }} />
          {photos.length > 1 && (
            <>
              <button onClick={() => setGalleryIndex((galleryIndex - 1 + photos.length) % photos.length)}
                style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%',
                  width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'‹'}</button>
              <button onClick={() => setGalleryIndex((galleryIndex + 1) % photos.length)}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%',
                  width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'›'}</button>
              <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: '6px' }}>
                {photos.map((_, i) => (
                  <div key={i} onClick={() => setGalleryIndex(i)} style={{
                    width: '8px', height: '8px', borderRadius: '50%', cursor: 'pointer',
                    background: i === galleryIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                  }} />
                ))}
              </div>
            </>
          )}
          {photos.length > 1 && (
            <div style={{ fontSize: '11px', color: S.muted, textAlign: 'center', marginTop: '4px' }}>
              {galleryIndex + 1} / {photos.length}
            </div>
          )}
        </div>
      )}

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', marginBottom: '4px' }}>
        {r.restaurant}
        {visitCount > 1 && (
          <span style={{
            marginLeft: '8px', fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
            padding: '2px 8px', borderRadius: '999px',
            background: S.accent, color: '#fff',
            verticalAlign: 'middle',
          }}>
            VISIT {visitCount}
          </span>
        )}
      </h2>
      <div style={{ fontSize: '13px', color: S.muted, marginBottom: '4px' }}>
        {r.location}{r.trip ? ` · ${r.trip}` : ''} · {r.date}
        {r.lastEdited && r.lastEdited !== r.date ? ` · edited ${r.lastEdited}` : ''}
      </div>
      {r.price && (
        <div style={{ fontSize: '13px', color: S.muted, marginBottom: '8px' }}>
          ${r.price} total{r.priceSplit > 1 ? ` · $${(Number(r.price) / Number(r.priceSplit)).toFixed(2)}/person (${r.priceSplit} people)` : ''}
        </div>
      )}

      {/* Score banner */}
      <div style={{ background: S.dark, borderRadius: '8px', padding: '16px', marginBottom: '16px', textAlign: 'center', border: `1px solid ${S.border}` }}>
        <div style={{ color: '#fbbf24', fontSize: '20px', letterSpacing: '2px' }}>{'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}</div>
        <div style={{ fontSize: '28px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>{sc.composite.toFixed(2)}</div>
        <div style={{ fontSize: '12px', color: S.muted }}>
          BBQ {sc.bbqAvg.toFixed(2)} + Family Bonus {sc.bonus.toFixed(2)}
        </div>
        <div style={{ fontSize: '11px', color: S.muted, marginTop: '2px' }}>Rank #{rankMap[r.id]} of {reviews.length}</div>
        {groupAvg && (
          <div style={{ fontSize: '11px', color: S.accent, marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${S.border}` }}>
            Group Avg: {groupAvg.composite.toFixed(2)} ({groupAvg.stars}{'★'})
          </div>
        )}
      </div>

      {/* Friends who ate here */}
      {hasFriends && (
        <div style={{ marginBottom: '12px' }}>
          <div style={sLabel()}>Who Ate</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', padding: '4px 10px', background: S.accent, color: '#fff', borderRadius: '12px', fontWeight: '600' }}>You</span>
            {r.friends.map(f => (
              <span key={f.name} style={{ fontSize: '12px', padding: '4px 10px', background: S.dark, color: S.text, borderRadius: '12px', border: `1px solid ${S.border}` }}>{f.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Order */}
      {orderParts.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={sLabel()}>Ordered</div>
          <div style={{ fontSize: '13px', color: S.text }}>{orderParts.join(', ')}</div>
        </div>
      )}
      </div>{/* end detail hero */}

      {/* Right column on desktop: scores */}
      <div className="bbq-detail-scores">
      {/* Category scores with descriptors + friend comparison */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ ...sLabel(), marginBottom: '8px' }}>BBQ Track</div>
        {CATEGORIES.bbq.map(c => {
          const v = r.scores[c.key];
          return (
            <div key={c.key} style={{ padding: '6px 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</div>
                  {v > 0 && DESCRIPTORS[c.key]?.[v] && (
                    <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic' }}>{DESCRIPTORS[c.key][v]}</div>
                  )}
                </div>
                <span style={{ fontWeight: '700', fontSize: '15px', color: v >= 7 ? '#4ade80' : v >= 5 ? S.text : v > 0 ? '#f87171' : S.muted }}>
                  {v || '—'}
                </span>
              </div>
              {hasFriends && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {r.friends.filter(f => f.scores[c.key] > 0).map(f => (
                    <span key={f.name} style={{ fontSize: '10px', color: S.muted, background: S.dark, padding: '2px 6px', borderRadius: '4px' }}>
                      {f.name}: <span style={{ fontWeight: '700', color: f.scores[c.key] >= 7 ? '#4ade80' : f.scores[c.key] >= 5 ? S.text : '#f87171' }}>{f.scores[c.key]}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ ...sLabel(), marginBottom: '8px' }}>Family Track</div>
        {CATEGORIES.family.map(c => {
          const v = r.scores[c.key];
          return (
            <div key={c.key} style={{ padding: '6px 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</div>
                  {v > 0 && DESCRIPTORS[c.key]?.[v] && (
                    <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic' }}>{DESCRIPTORS[c.key][v]}</div>
                  )}
                </div>
                <span style={{ fontWeight: '700', fontSize: '15px', color: v >= 7 ? '#4ade80' : v >= 5 ? S.text : v > 0 ? '#f87171' : S.muted }}>
                  {v || '—'}
                </span>
              </div>
              {hasFriends && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {r.friends.filter(f => f.scores[c.key] > 0).map(f => (
                    <span key={f.name} style={{ fontSize: '10px', color: S.muted, background: S.dark, padding: '2px 6px', borderRadius: '4px' }}>
                      {f.name}: <span style={{ fontWeight: '700', color: f.scores[c.key] >= 7 ? '#4ade80' : f.scores[c.key] >= 5 ? S.text : '#f87171' }}>{f.scores[c.key]}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {r.sauceDep && <div style={{ fontSize: '13px', color: S.muted, marginBottom: '4px' }}>Sauce: {r.sauceDep}</div>}
      {r.wouldReturn && <div style={{ fontSize: '13px', color: S.muted, marginBottom: '8px' }}>Would return: {r.wouldReturn}</div>}
      {r.googleReviewUrl && (
        <a href={r.googleReviewUrl} target="_blank" rel="noopener" style={{ fontSize: '12px', color: S.accent, display: 'block', marginBottom: '8px' }}>
          View Google Review
        </a>
      )}

      {/* Notes log */}
      {(r.notesLog?.length > 0 || r.notes) && (
        <div style={{ marginBottom: '12px' }}>
          <div style={sLabel()}>Notes</div>
          {r.notesLog?.map((n, i) => (
            <div key={i} style={{ fontSize: '13px', color: S.text, padding: '4px 0', borderBottom: `1px solid ${S.border}` }}>{n}</div>
          ))}
          {r.notes && !r.notesLog?.length && <div style={{ fontSize: '13px', color: S.text }}>{r.notes}</div>}
        </div>
      )}

      {/* Firebase Friend Reviews */}
      {Object.keys(friendReviewsMap).length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...sLabel(), marginBottom: '10px', fontSize: '12px' }}>Friend Scorecards</div>
          {Object.values(friendReviewsMap).map(fr => {
            const fsc = calcScores(fr.scores);
            return (
              <div key={fr.userId} style={{ background: S.dark, borderRadius: '8px', padding: '12px', marginBottom: '8px', border: `1px solid ${S.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: S.accent }}>{fr.displayName}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#fbbf24', fontSize: '13px' }}>{'★'.repeat(fsc.stars)}{'☆'.repeat(5 - fsc.stars)}</span>
                    <span style={{ marginLeft: '6px', fontWeight: '700', color: S.accent }}>{fsc.composite.toFixed(2)}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                  {[...CATEGORIES.bbq, ...CATEGORIES.family].map(c => {
                    const v = fr.scores[c.key];
                    return v > 0 ? (
                      <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px' }}>
                        <span style={{ color: S.muted }}>{c.label.split(' /')[0]}</span>
                        <span style={{ fontWeight: '600', color: v >= 7 ? '#4ade80' : v >= 5 ? S.text : '#f87171' }}>{v}</span>
                      </div>
                    ) : null;
                  })}
                </div>
                {fr.wouldReturn && (
                  <div style={{ fontSize: '11px', color: S.muted, marginTop: '6px' }}>Would return: {fr.wouldReturn}</div>
                )}
                {fr.date && (
                  <div style={{ fontSize: '10px', color: S.border, marginTop: '4px' }}>Visited {fr.date}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      </div>{/* end detail-scores */}
      </div>{/* end detail-layout */}

      {/* Action buttons */}
      {r._isExample ? (
        <div style={{ textAlign: 'center', padding: '16px', marginTop: '16px', background: S.dark, borderRadius: '8px', border: `1px dashed ${S.border}` }}>
          <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>THIS IS AN EXAMPLE REVIEW</div>
          <div style={{ fontSize: '13px', color: S.text }}>Your reviews will look just like this. Tap the + button to create your first one.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button onClick={() => editReview(r)} style={sBtn(true, false)}>Edit</button>
          <button onClick={() => duplicateReview(r)} style={sBtn(false, false)}>Review again</button>
          <button onClick={() => shareReview(r)} disabled={shareGenerating}
            style={{ ...sBtn(false, false), opacity: shareGenerating ? 0.5 : 1 }}>
            {shareGenerating ? 'Generating...' : 'Share Card'}
          </button>
          <button onClick={() => shareReviewStory(r)} disabled={shareGenerating}
            style={{ ...sBtn(false, false), opacity: shareGenerating ? 0.5 : 1 }}>
            {shareGenerating ? 'Generating...' : 'Story Card'}
          </button>
          <button onClick={exportPdf} disabled={pdfGenerating}
            style={{ ...sBtn(false, false), opacity: pdfGenerating ? 0.5 : 1 }}>
            {pdfGenerating ? 'Building PDF...' : 'Export PDF'}
          </button>
          <button onClick={() => exportText(r)} style={sBtn(false, false)}>Export</button>
          <button onClick={() => {
            const draft = generateGoogleDraft(r);
            setDraftText(draft);
            navigator.clipboard?.writeText(draft);
            track('google_draft_generated', { restaurant: r.restaurant });
          }} style={sBtn(false, false)}>Google Draft</button>
          <button onClick={() => deleteReview(r.id)} style={{ ...sBtn(false, false), color: '#f87171', borderColor: '#f87171' }}>Delete</button>
        </div>
      )}

      {/* Google Review Draft */}
      {draftText && (
        <div style={{ marginTop: '12px', background: S.dark, borderRadius: '8px', padding: '14px', border: `1px solid ${S.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: S.accent, letterSpacing: '1px', fontWeight: '600' }}>Google Review Draft (Copied)</span>
            <button onClick={() => setDraftText('')} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: '16px' }}>{'✕'}</button>
          </div>
          <pre style={{ fontSize: '12px', color: S.text, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6', margin: 0 }}>{draftText}</pre>
        </div>
      )}

      <NotebookReviewBanner />
      </div>
    </div>
  );
}
