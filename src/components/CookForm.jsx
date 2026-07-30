import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { MEATS, WOOD_TYPES, FUEL_SOURCES, WRAP_METHODS } from '../constants.js';
import { computeHumidity } from '../pitHumidity.js';
import { DEFAULT_PRESSURE_KPA } from '../pressureResolver.js';
import RatingWheel from './RatingWheel.jsx';

export default function CookForm() {
  const {
    S, sBtn, sInput, sLabel,
    view, setView, dirty, setDirty, setCurrentReview,
  } = useAppContext();
  const {
    currentCook, updateCook, saveCookEntry,
    handleCookPhoto, removeCookPhoto, addCookNote,
    addCookTag, removeCookTag,
    rubRecipes, sauceRecipes, fullCookRecipes,
    uniqueSmokerTypes, uniqueMeatTypes, uniqueTags,
    previousCooksOfMeat,
    cookPhotoRef, cookGalleryRef,
    setCurrentCook,
  } = useCookContext();

  const [tagInput, setTagInput] = useState('');
  const [customMeat, setCustomMeat] = useState('');
  const [customWood, setCustomWood] = useState('');
  const [customFuel, setCustomFuel] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);

  const fetchWeather = async () => {
    setWeatherLoading(true);
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      const { latitude, longitude } = pos.coords;

      // Find nearest observation stations via NWS
      const pointResp = await fetch(
        `https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`
      );
      if (!pointResp.ok) throw new Error(`NWS points: ${pointResp.status}`);
      const pointData = await pointResp.json();
      const stationsUrl = pointData.properties?.observationStations;
      if (!stationsUrl) throw new Error('No stations URL');

      const stationsResp = await fetch(stationsUrl);
      if (!stationsResp.ok) throw new Error(`NWS stations: ${stationsResp.status}`);
      const stationsData = await stationsResp.json();
      const stations = (stationsData.features || []).slice(0, 5);
      if (stations.length === 0) throw new Error('No nearby stations');

      // Try each station until one has fresh data
      for (const station of stations) {
        const id = station.properties?.stationIdentifier;
        if (!id) continue;
        try {
          const obsResp = await fetch(
            `https://api.weather.gov/stations/${id}/observations/latest`
          );
          if (!obsResp.ok) continue;
          const obsData = await obsResp.json();
          const p = obsData.properties;
          if (p?.temperature?.value == null) continue;

          const tempF = Math.round(p.temperature.value * 9 / 5 + 32);
          // NWS returns wind in km/h (wmoUnit:km_h-1)
          const windKmh = p.windSpeed?.value;
          const gustKmh = p.windGust?.value;
          const windMph = windKmh != null ? Math.round(windKmh * 0.6214) : null;
          const gustMph = gustKmh != null ? Math.round(gustKmh * 0.6214) : null;
          let windText = '';
          if (windMph != null) {
            windText = windMph < 2 ? 'Calm' : `${windMph} mph`;
            if (gustMph && gustMph > windMph + 3) windText += `, gusts ${gustMph} mph`;
          }
          const rh = p.relativeHumidity?.value;
          const humText = rh != null ? `${Math.round(rh)}%` : '';

          setCurrentCook(prev => ({
            ...prev,
            weatherTemp: String(tempF),
            weatherWind: windText || prev.weatherWind,
            weatherHumidity: humText || prev.weatherHumidity,
          }));
          setDirty(true);
          setWeatherLoading(false);
          return;
        } catch { continue; }
      }
      throw new Error('No observation data from any nearby station');
    } catch (e) {
      console.error('Weather fetch failed:', e);
      alert('Could not get weather. Check location permissions and try again.');
    }
    setWeatherLoading(false);
  };

  if (!currentCook) return null;

  const allMeats = uniqueMeatTypes;
  const showCustomMeat = currentCook.meatType === '__custom__';
  const showCustomFuel = currentCook.fuelSource === '__custom__';

  const handleMeatChange = (val) => {
    if (val === '__custom__') {
      updateCook('meatType', '__custom__');
    } else {
      setCustomMeat('');
      updateCook('meatType', val);
    }
  };

  const handleCustomMeatBlur = () => {
    if (customMeat.trim()) {
      updateCook('meatType', customMeat.trim());
    }
  };

  const handleFuelChange = (val) => {
    if (val === '__custom__') {
      updateCook('fuelSource', '__custom__');
    } else {
      setCustomFuel('');
      updateCook('fuelSource', val);
    }
  };

  const handleCustomFuelBlur = () => {
    if (customFuel.trim()) {
      updateCook('fuelSource', customFuel.trim());
    }
  };

  const handleRubRecipeSelect = (recipeId) => {
    if (!recipeId) {
      updateCook('rubRecipeId', null);
      return;
    }
    const recipe = rubRecipes.find(r => r.id === recipeId);
    if (recipe) {
      setCurrentCook({ ...currentCook, rubRecipeId: recipeId, rub: recipe.name });
      setDirty(true);
    }
  };

  const handleSauceRecipeSelect = (recipeId) => {
    if (!recipeId) {
      updateCook('sauceRecipeId', null);
      return;
    }
    const recipe = sauceRecipes.find(r => r.id === recipeId);
    if (recipe) {
      setCurrentCook({ ...currentCook, sauceRecipeId: recipeId, sauce: recipe.name });
      setDirty(true);
    }
  };

  const isEdit = view === 'cookEdit';
  const meatValue = allMeats.includes(currentCook.meatType) ? currentCook.meatType
    : (currentCook.meatType && currentCook.meatType !== '__custom__') ? currentCook.meatType : '';
  const displayMeatInSelect = MEATS.includes(currentCook.meatType) || !currentCook.meatType;

  return (
    <div className="bbq-container-form">
      <button onClick={() => {
        if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
        setView('home'); setCurrentCook(null); setCurrentReview(null); setDirty(false);
      }} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>
        Back
      </button>

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>
        {isEdit ? 'Edit Cook' : 'Log a Cook'}
      </h2>

      {/* Basic Info */}
      <div style={{ marginBottom: '20px' }}>
        <div className="bbq-form-fields">
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>COOK NAME</label>
            <input type="text" value={currentCook.name} onChange={e => updateCook('name', e.target.value)}
              placeholder="Saturday Brisket" style={sInput()} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>DATE</label>
            <input type="date" value={currentCook.date} onChange={e => updateCook('date', e.target.value)} style={sInput()} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>MEAT TYPE</label>
            <select value={displayMeatInSelect ? currentCook.meatType : '__custom__'}
              onChange={e => handleMeatChange(e.target.value)}
              style={{ ...sInput(), marginBottom: showCustomMeat || (!displayMeatInSelect && currentCook.meatType !== '__custom__') ? '6px' : 0 }}>
              <option value="">Select...</option>
              {MEATS.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__custom__">Custom...</option>
            </select>
            {(showCustomMeat || (!displayMeatInSelect && currentCook.meatType)) && (
              <input type="text"
                value={showCustomMeat ? customMeat : currentCook.meatType}
                onChange={e => {
                  if (showCustomMeat) setCustomMeat(e.target.value);
                  else updateCook('meatType', e.target.value);
                }}
                onBlur={showCustomMeat ? handleCustomMeatBlur : undefined}
                placeholder="Enter meat type..." style={{ ...sInput(), fontSize: '12px' }} />
            )}
            <PreviousCookTips
              S={S}
              meatType={currentCook.meatType}
              currentCookId={currentCook.id}
              previousCooksOfMeat={previousCooksOfMeat}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>CUT</label>
            <input type="text" value={currentCook.cut || ''} onChange={e => updateCook('cut', e.target.value)}
              placeholder="Whole packer, spare ribs, etc." style={sInput()} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>WEIGHT (LBS)</label>
            <input type="number" inputMode="decimal" step="0.1" value={currentCook.weight || ''}
              onChange={e => updateCook('weight', e.target.value)} placeholder="0.0" style={sInput()} />
          </div>
        </div>
      </div>

      {/* Rub & Sauce */}
      <div style={{ marginBottom: '20px' }}>
        <div className="bbq-form-fields">
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>RUB</label>
            {rubRecipes.length > 0 && (
              <select value={currentCook.rubRecipeId || ''} onChange={e => handleRubRecipeSelect(e.target.value)}
                style={{ ...sInput(), marginBottom: '6px', fontSize: '12px' }}>
                <option value="">Select saved recipe...</option>
                {rubRecipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
            <input type="text" value={currentCook.rub || ''} onChange={e => updateCook('rub', e.target.value)}
              placeholder="Rub name or description" style={sInput()} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>SAUCE</label>
            {sauceRecipes.length > 0 && (
              <select value={currentCook.sauceRecipeId || ''} onChange={e => handleSauceRecipeSelect(e.target.value)}
                style={{ ...sInput(), marginBottom: '6px', fontSize: '12px' }}>
                <option value="">Select saved recipe...</option>
                {sauceRecipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
            <input type="text" value={currentCook.sauce || ''} onChange={e => updateCook('sauce', e.target.value)}
              placeholder="Sauce name or description" style={sInput()} />
          </div>
        </div>
      </div>

      {/* Smoker, Fuel, Wood */}
      <div style={{ marginBottom: '20px' }}>
        <div className="bbq-form-fields">
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>SMOKER TYPE</label>
            <input type="text" value={currentCook.smokerType || ''} onChange={e => updateCook('smokerType', e.target.value)}
              placeholder="Weber Smokey Mountain, Traeger, etc." style={sInput()} list="smoker-suggestions" />
            {uniqueSmokerTypes.length > 0 && (
              <datalist id="smoker-suggestions">
                {uniqueSmokerTypes.map(s => <option key={s} value={s} />)}
              </datalist>
            )}
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>FUEL SOURCE</label>
            <select value={FUEL_SOURCES.includes(currentCook.fuelSource) ? currentCook.fuelSource : (currentCook.fuelSource ? '__custom__' : '')}
              onChange={e => handleFuelChange(e.target.value)}
              style={{ ...sInput(), marginBottom: (showCustomFuel || (currentCook.fuelSource && !FUEL_SOURCES.includes(currentCook.fuelSource))) ? '6px' : 0 }}>
              <option value="">Select...</option>
              {FUEL_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="__custom__">Custom...</option>
            </select>
            {(showCustomFuel || (currentCook.fuelSource && !FUEL_SOURCES.includes(currentCook.fuelSource) && currentCook.fuelSource !== '__custom__')) && (
              <input type="text"
                value={showCustomFuel ? customFuel : currentCook.fuelSource}
                onChange={e => {
                  if (showCustomFuel) setCustomFuel(e.target.value);
                  else updateCook('fuelSource', e.target.value);
                }}
                onBlur={showCustomFuel ? handleCustomFuelBlur : undefined}
                placeholder="Enter fuel source..." style={{ ...sInput(), fontSize: '12px' }} />
            )}
          </div>
        </div>

        {/* Wood Type — multi-select chips */}
        <div style={{ marginTop: '10px' }}>
          <label style={sLabel()}>WOOD TYPE</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            {WOOD_TYPES.map(w => (
              <button key={w} onClick={() => {
                const woods = [...(currentCook.woodType || [])];
                if (woods.includes(w)) updateCook('woodType', woods.filter(x => x !== w));
                else updateCook('woodType', [...woods, w]);
              }} style={sBtn((currentCook.woodType || []).includes(w), true)}>{w}</button>
            ))}
          </div>
          <input type="text" value={customWood} onChange={e => setCustomWood(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customWood.trim()) {
                e.preventDefault();
                const woods = [...(currentCook.woodType || [])];
                if (!woods.includes(customWood.trim())) updateCook('woodType', [...woods, customWood.trim()]);
                setCustomWood('');
              }
            }}
            placeholder="Other wood..." style={{ ...sInput(), fontSize: '12px' }} />
        </div>
      </div>

      {/* Temps & Times */}
      <div style={{ marginBottom: '20px' }}>
        <div className="bbq-form-fields">
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>COOK TEMP (F)</label>
            <input type="number" inputMode="numeric" value={currentCook.cookTemp || ''}
              onChange={e => updateCook('cookTemp', e.target.value)} placeholder="225" style={sInput()} />
          </div>

          {/* Pit humidity — wet-bulb reading + live RH%/dew point. Optional field;
              empty when unused, only computes when both cookTemp (dry-bulb) and
              pitWetBulbF are numeric. Uses DEFAULT_PRESSURE_KPA (Waukesha ~98.3)
              since we don't fetch station pressure from CookForm. */}
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>WET BULB (F) — optional</label>
            <input type="number" inputMode="numeric" value={currentCook.pitWetBulbF || ''}
              onChange={e => updateCook('pitWetBulbF', e.target.value)}
              placeholder="Read from wet probe"
              style={sInput()} />
            {(() => {
              const dryF = parseFloat(currentCook.cookTemp);
              const wetF = parseFloat(currentCook.pitWetBulbF);
              if (!Number.isFinite(dryF) || !Number.isFinite(wetF)) return null;
              const { rh, dewpointF, warning } = computeHumidity({
                dryF, wetF, pressureKPa: DEFAULT_PRESSURE_KPA,
              });
              if (warning === 'inverted') {
                return <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                  Wet bulb can't exceed dry bulb — probes may be swapped.
                </div>;
              }
              if (warning === 'above_boiling') {
                return <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                  Wet bulb above boiling — shoelace has boiled dry.
                </div>;
              }
              if (rh == null) return null;
              const rhText = `${Math.round(rh * 100)}%`;
              const dpText = dewpointF != null ? `${Math.round(dewpointF)}°F` : '—';
              return (
                <div style={{ fontSize: 11, color: S.muted, marginTop: 4, letterSpacing: 1 }}>
                  Pit RH <span style={{ color: S.accent, fontWeight: 600 }}>{rhText}</span>
                  {'  ·  '}Dew point <span style={{ color: S.text }}>{dpText}</span>
                  {warning === 'dry_wick' && (
                    <span style={{ color: '#fbbf24', marginLeft: 8 }}>· wick may be dry</span>
                  )}
                </div>
              );
            })()}
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>WRAP METHOD</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {WRAP_METHODS.map(w => (
                <button key={w} onClick={() => updateCook('wrapMethod', w)}
                  style={sBtn(currentCook.wrapMethod === w, true)}>{w}</button>
              ))}
            </div>
          </div>

          {currentCook.wrapMethod && currentCook.wrapMethod !== 'No wrap' && (
            <div style={{ marginBottom: '10px' }}>
              <label style={sLabel()}>WRAP TEMP (F)</label>
              <input type="number" inputMode="numeric" value={currentCook.wrapTemp || ''}
                onChange={e => updateCook('wrapTemp', e.target.value)} placeholder="165" style={sInput()} />
            </div>
          )}

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>TARGET INTERNAL TEMP (F)</label>
            <input type="number" inputMode="numeric" value={currentCook.targetInternalTemp || ''}
              onChange={e => updateCook('targetInternalTemp', e.target.value)} placeholder="203" style={sInput()} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>TOTAL COOK TIME</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="number" inputMode="numeric" value={currentCook.cookTimeHours || ''}
                onChange={e => updateCook('cookTimeHours', e.target.value)}
                placeholder="0" style={{ ...sInput(), width: '80px', textAlign: 'center' }} />
              <span style={{ fontSize: '12px', color: S.muted }}>hrs</span>
              <input type="number" inputMode="numeric" value={currentCook.cookTimeMinutes || ''}
                onChange={e => updateCook('cookTimeMinutes', e.target.value)}
                placeholder="0" style={{ ...sInput(), width: '80px', textAlign: 'center' }} />
              <span style={{ fontSize: '12px', color: S.muted }}>min</span>
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>REST TIME (MINUTES)</label>
            <input type="number" inputMode="numeric" value={currentCook.restTime || ''}
              onChange={e => updateCook('restTime', e.target.value)} placeholder="60" style={sInput()} />
          </div>
        </div>
      </div>

      {/* Weather */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: S.accent }}>
            Weather Conditions
          </div>
          <button onClick={fetchWeather} disabled={weatherLoading}
            style={{ ...sBtn(false, true), fontSize: '11px', padding: '4px 10px', opacity: weatherLoading ? 0.5 : 1 }}>
            {weatherLoading ? 'Getting...' : 'Get Current Weather'}
          </button>
        </div>
        <div className="bbq-form-fields">
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>TEMP (F)</label>
            <input type="number" inputMode="numeric" value={currentCook.weatherTemp || ''}
              onChange={e => updateCook('weatherTemp', e.target.value)} placeholder="75" style={sInput()} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>WIND</label>
            <input type="text" value={currentCook.weatherWind || ''} onChange={e => updateCook('weatherWind', e.target.value)}
              placeholder="Calm, 10mph gusts, etc." style={sInput()} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>HUMIDITY</label>
            <input type="text" value={currentCook.weatherHumidity || ''} onChange={e => updateCook('weatherHumidity', e.target.value)}
              placeholder="Low, 60%, etc." style={sInput()} />
          </div>
        </div>
      </div>

      {/* Photos */}
      <div style={{ marginBottom: '20px' }}>
        <label style={sLabel()}>PHOTOS ({(currentCook.photos || []).length}/3)</label>
        {(currentCook.photos || []).length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '8px', padding: '4px 0' }}>
            {(currentCook.photos || []).map((p, i) => (
              <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                <img src={p} alt={`Photo ${i + 1}`} style={{ width: '100px', height: '100px', borderRadius: '6px', objectFit: 'cover' }} />
                <button onClick={() => removeCookPhoto(i)}
                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'✕'}</button>
              </div>
            ))}
          </div>
        )}
        {(currentCook.photos || []).length < 3 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => cookPhotoRef.current?.click()}
              style={{ ...sBtn(false, false), flex: 1 }}>Camera</button>
            <button onClick={() => cookGalleryRef.current?.click()}
              style={{ ...sBtn(false, false), flex: 1 }}>Gallery</button>
          </div>
        )}
        <input ref={cookPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleCookPhoto} style={{ display: 'none' }} />
        <input ref={cookGalleryRef} type="file" accept="image/*" onChange={handleCookPhoto} style={{ display: 'none' }} />
      </div>

      {/* Timestamped Notes */}
      <div style={{ marginBottom: '20px' }}>
        <label style={sLabel()}>COOK NOTES</label>
        {(currentCook.notesLog || []).length > 0 && (
          <div style={{ marginBottom: '8px', background: S.dark, borderRadius: '6px', padding: '10px' }}>
            {currentCook.notesLog.map((n, i) => (
              <div key={i} style={{ fontSize: '12px', color: S.text, padding: '3px 0', borderBottom: i < currentCook.notesLog.length - 1 ? `1px solid ${S.border}` : 'none' }}>{n}</div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          <textarea value={currentCook.notes || ''} onChange={e => updateCook('notes', e.target.value)}
            placeholder="Add a timestamped note..." rows={2}
            style={{ ...sInput(), resize: 'vertical', flex: 1 }} />
          <button onClick={addCookNote} disabled={!currentCook.notes?.trim()}
            style={{ ...sBtn(!!currentCook.notes?.trim(), true), alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </div>
      </div>

      {/* What I'd Change */}
      <div style={{ marginBottom: '20px' }}>
        <label style={sLabel()}>WHAT I'D CHANGE NEXT TIME</label>
        <textarea value={currentCook.whatIdChange || ''} onChange={e => updateCook('whatIdChange', e.target.value)}
          placeholder="Higher temp? Different wood? More rest time?" rows={3}
          style={{ ...sInput(), resize: 'vertical' }} />
      </div>

      {/* Rating */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={sLabel()}>OVERALL RATING</label>
        </div>
        <RatingWheel
          value={currentCook.rating || 0}
          onChange={v => updateCook('rating', v)}
          accent={S.accent}
          muted={S.muted}
          trackBg={S.dark}
          labelColor={S.text || '#f5e6d3'}
        />
      </div>

      {/* Tags */}
      <div style={{ marginBottom: '20px' }}>
        <label style={sLabel()}>TAGS</label>
        {(currentCook.tags || []).length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {(currentCook.tags || []).map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                background: S.dark, borderRadius: '12px', border: `1px solid ${S.border}`, fontSize: '12px' }}>
                <span>{t}</span>
                <button onClick={() => removeCookTag(t)}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}>{'✕'}</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCookTag(tagInput); setTagInput(''); } }}
            placeholder="competition prep, weeknight, etc."
            list="cook-tag-suggestions"
            style={{ ...sInput(), flex: 1 }} />
          <datalist id="cook-tag-suggestions">
            {uniqueTags.map(t => <option key={t} value={t} />)}
          </datalist>
          <button onClick={() => { addCookTag(tagInput); setTagInput(''); }} disabled={!tagInput.trim()}
            style={{ ...sBtn(!!tagInput.trim(), true), whiteSpace: 'nowrap' }}>+ Add</button>
        </div>
      </div>

      {/* Share with friends — defaults off; Firestore rule gates friend reads on this flag */}
      <div style={{ marginBottom: '20px', padding: '14px', background: S.dark, borderRadius: '8px', border: `1px solid ${S.border}` }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!currentCook.shared}
            onChange={(e) => updateCook('shared', e.target.checked)}
            style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#4A6741', cursor: 'pointer', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: S.text, marginBottom: '2px' }}>
              Share with friends
            </div>
            <div style={{ fontSize: '11px', color: S.muted, lineHeight: '1.4' }}>
              When on, accepted friends can see this cook in their feed. Off by default — cooks are private unless you opt in.
            </div>
          </div>
        </label>
      </div>

      {/* Save */}
      <button onClick={saveCookEntry} disabled={!currentCook.name.trim()}
        style={{
          width: '100%', padding: '14px', fontFamily: "'Oswald', sans-serif", fontSize: '16px',
          fontWeight: '700', letterSpacing: '1px', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: currentCook.name.trim() ? S.accent : '#333',
          color: currentCook.name.trim() ? '#fff' : '#666',
        }}>Save Cook</button>
    </div>
  );
}

// Surfaces "what I'd change" notes from the user's last few cooks of the
// same meat. Closes the feedback loop on their own past lessons before
// they make the same mistake twice. Collapsed by default to stay out of
// the way; expands on tap. Only renders when there's at least one
// previous cook of this meat that has whatIdChange notes.
function PreviousCookTips({ S, meatType, currentCookId, previousCooksOfMeat }) {
  const [open, setOpen] = useState(false);
  if (!meatType) return null;
  const past = previousCooksOfMeat(meatType, currentCookId).slice(0, 3);
  const withTips = past.filter(c => (c.whatIdChange || '').trim().length > 0);
  if (!withTips.length) return null;
  return (
    <div style={{
      marginTop: '6px', background: S.dark, border: `1px solid ${S.border}`,
      borderRadius: '6px', overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px 12px', color: '#d4a64a',
          fontFamily: "'Oswald', sans-serif", fontSize: '11px',
          letterSpacing: '1.5px', fontWeight: '700',
        }}>
        {open ? '▾' : '▸'} TIPS FROM YOUR LAST {withTips.length} {meatType.toUpperCase()} COOK{withTips.length === 1 ? '' : 'S'}
      </button>
      {open && (
        <div style={{ padding: '0 12px 10px' }}>
          {withTips.map(c => (
            <div key={c.id} style={{
              marginBottom: '8px', paddingBottom: '8px',
              borderBottom: `1px solid ${S.border}`,
              fontSize: '12px', lineHeight: 1.5, color: S.text,
            }}>
              <div style={{ fontSize: '10px', color: S.muted, marginBottom: '2px', letterSpacing: '1px' }}>
                {c.date}{c.rating != null ? ` · ${c.rating}/9` : ''}
              </div>
              {c.whatIdChange}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
