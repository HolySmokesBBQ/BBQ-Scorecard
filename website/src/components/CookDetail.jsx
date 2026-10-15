import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { shareCookCard } from '../cookShareCard.js';
import { track } from '../scoring.js';
import { computeHumidity } from '../pitHumidity.js';
import { DEFAULT_PRESSURE_KPA } from '../pressureResolver.js';

export default function CookDetail() {
  const {
    S, sBtn, setView, setDirty, navigateTo, setCurrentReview,
  } = useAppContext();
  const {
    currentCook, editCook, deleteCook, duplicateCook,
    previousCooksOfMeat, recipes, setCurrentCook,
  } = useCookContext();

  const [galleryIdx, setGalleryIdx] = useState(0);

  if (!currentCook) return null;

  const prevCooks = previousCooksOfMeat(currentCook.meatType, currentCook.id);
  const photos = currentCook.photos || [];

  // Resolve linked recipes
  const rubRecipe = currentCook.rubRecipeId ? recipes.find(r => r.id === currentCook.rubRecipeId) : null;
  const sauceRecipe = currentCook.sauceRecipeId ? recipes.find(r => r.id === currentCook.sauceRecipeId) : null;

  const formatCookTime = () => {
    const h = currentCook.cookTimeHours;
    const m = currentCook.cookTimeMinutes;
    if (!h && !m) return null;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    return parts.join(' ');
  };

  const Row = ({ label, value, accent }) => {
    if (!value) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
        <span style={{ fontSize: '12px', color: S.muted, letterSpacing: '0.5px' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '600', color: accent ? S.accent : S.text, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
      </div>
    );
  };

  return (
    <div className="bbq-container" style={{ padding: '16px', paddingBottom: '80px' }}>
      <button onClick={() => { setView('home'); setCurrentCook(null); setCurrentReview(null); setDirty(false); }}
        style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>
        Back
      </button>

      {/* Previous cooks of this meat — the killer feature */}
      {prevCooks.length > 0 && (
        <div style={{ background: S.dark, borderRadius: '10px', padding: '14px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '10px' }}>
            Your Last {prevCooks.length} {currentCook.meatType} Cook{prevCooks.length !== 1 ? 's' : ''}
          </div>
          {prevCooks.map(pc => (
            <div key={pc.id} style={{ padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: S.text }}>{pc.name}</div>
                  <div style={{ fontSize: '11px', color: S.muted }}>{pc.date}{pc.cut ? ` - ${pc.cut}` : ''}</div>
                </div>
                {pc.rating > 0 && (
                  <div style={{ fontSize: '16px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
                    {pc.rating}/9
                  </div>
                )}
              </div>
              {pc.whatIdChange && (
                <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  Change: {pc.whatIdChange}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', letterSpacing: '1px', marginBottom: '4px' }}>
          {currentCook.name}
        </h2>
        <div style={{ fontSize: '13px', color: S.muted }}>
          {currentCook.date}
          {currentCook.meatType ? ` · ${currentCook.meatType}` : ''}
          {currentCook.cut ? ` · ${currentCook.cut}` : ''}
        </div>
        {currentCook.rating > 0 && (
          <div style={{ marginTop: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
              {currentCook.rating}/9
            </span>
          </div>
        )}
        {(currentCook.tags || []).length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {currentCook.tags.map(t => (
              <span key={t} style={{ fontSize: '11px', color: S.accent, background: S.dark, padding: '3px 8px', borderRadius: '4px', border: `1px solid ${S.border}` }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <img src={photos[galleryIdx]}
            alt={`Cook photo ${galleryIdx + 1}`}
            style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${S.border}` }} />
          {photos.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
              {photos.map((_, i) => (
                <button key={i} onClick={() => setGalleryIdx(i)}
                  style={{ width: '10px', height: '10px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: galleryIdx === i ? S.accent : S.border }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <div style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
        <Row label="Weight" value={currentCook.weight ? `${currentCook.weight} lbs` : null} />
        <Row label="Rub" value={currentCook.rub} accent={!!rubRecipe} />
        <Row label="Sauce" value={currentCook.sauce} accent={!!sauceRecipe} />
        <Row label="Wood" value={Array.isArray(currentCook.woodType) ? currentCook.woodType.join(', ') : currentCook.woodType} />
        <Row label="Smoker" value={currentCook.smokerType} />
        <Row label="Fuel" value={currentCook.fuelSource} />
        <Row label="Cook Temp" value={currentCook.cookTemp ? `${currentCook.cookTemp}F` : null} />
        {currentCook.pitWetBulbF && (() => {
          const dryF = parseFloat(currentCook.cookTemp);
          const wetF = parseFloat(currentCook.pitWetBulbF);
          const { rh, dewpointF, warning } = computeHumidity({
            dryF, wetF, pressureKPa: DEFAULT_PRESSURE_KPA,
          });
          const rhText = rh != null ? `${Math.round(rh * 100)}%` : null;
          const dpText = dewpointF != null ? `${Math.round(dewpointF)}F` : null;
          return (
            <>
              <Row label="Wet Bulb" value={`${currentCook.pitWetBulbF}F`} />
              {rhText && <Row label="Pit RH" value={rhText} />}
              {dpText && <Row label="Dew Point" value={dpText} />}
              {warning === 'inverted' && <Row label="Note" value="Probes may have been swapped" />}
              {warning === 'dry_wick' && <Row label="Note" value="Wick may have been dry" />}
            </>
          );
        })()}
        <Row label="Wrap" value={currentCook.wrapMethod !== 'No wrap' ? currentCook.wrapMethod : null } />
        {currentCook.wrapMethod !== 'No wrap' && <Row label="Wrap Temp" value={currentCook.wrapTemp ? `${currentCook.wrapTemp}F` : null} />}
        <Row label="Target Internal" value={currentCook.targetInternalTemp ? `${currentCook.targetInternalTemp}F` : null} />
        <Row label="Cook Time" value={formatCookTime()} />
        <Row label="Rest Time" value={currentCook.restTime ? `${currentCook.restTime} min` : null} />
      </div>

      {/* Weather */}
      {(currentCook.weatherTemp || currentCook.weatherWind || currentCook.weatherHumidity) && (
        <div style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>
            Weather
          </div>
          <Row label="Temperature" value={currentCook.weatherTemp ? `${currentCook.weatherTemp}F` : null} />
          <Row label="Wind" value={currentCook.weatherWind} />
          <Row label="Humidity" value={currentCook.weatherHumidity} />
        </div>
      )}

      {/* What I'd Change */}
      {currentCook.whatIdChange && (
        <div style={{ background: '#2a2015', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.accent}33` }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>
            What I'd Change Next Time
          </div>
          <div style={{ fontSize: '14px', color: S.text, lineHeight: '1.6' }}>{currentCook.whatIdChange}</div>
        </div>
      )}

      {/* Notes */}
      {(currentCook.notesLog || []).length > 0 && (
        <div style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '16px', border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>
            Cook Notes
          </div>
          {currentCook.notesLog.map((n, i) => (
            <div key={i} style={{ fontSize: '13px', color: S.text, padding: '6px 0', borderBottom: i < currentCook.notesLog.length - 1 ? `1px solid ${S.border}` : 'none', lineHeight: '1.5' }}>
              {n}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {currentCook._isExample ? (
        <div style={{ textAlign: 'center', padding: '16px', marginBottom: '16px', background: S.dark, borderRadius: '8px', border: `1px dashed ${S.border}` }}>
          <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>THIS IS AN EXAMPLE COOK LOG</div>
          <div style={{ fontSize: '13px', color: S.text }}>Your cook logs will look just like this. Tap the + button to log your first cook.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button onClick={() => editCook(currentCook)} style={{ ...sBtn(true, false), flex: '1 1 calc(50% - 4px)' }}>Edit</button>
          <button onClick={() => { track('cook_duplicated', { meat: currentCook.meatType }); duplicateCook(currentCook); }}
            style={{ ...sBtn(false, false), flex: '1 1 calc(50% - 4px)' }}>Cook this again</button>
          <button onClick={async () => {
            const ok = await shareCookCard(currentCook);
            if (ok) track('cook_shared', { meat: currentCook.meatType });
          }} style={{ ...sBtn(false, false), flex: '1 1 calc(33% - 6px)' }}>Share</button>
          <button onClick={async () => {
            const { exportCookToPdf } = await import('../cookPdf.js');
            const ok = await exportCookToPdf(currentCook);
            if (ok) track('cook_exported_pdf', { meat: currentCook.meatType });
          }} style={{ ...sBtn(false, false), flex: '1 1 calc(33% - 6px)' }}>Export PDF</button>
          <button onClick={() => deleteCook(currentCook.id)}
            style={{ ...sBtn(false, false), flex: '1 1 calc(33% - 6px)', color: '#f87171', borderColor: '#f8717133' }}>Delete</button>
        </div>
      )}
    </div>
  );
}
