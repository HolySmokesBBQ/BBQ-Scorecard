import { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { BRANDS, getBrand } from '../parsers/index.js';
import { compressPhoto, track } from '../scoring.js';

// Universal Import page. User picks a thermometer brand → we route to
// either an OCR (screenshot) or CSV (file) flow → the parser returns a
// patch with confidence scores → user reviews and edits → save into
// CookForm. For OCR brands the screenshot becomes the cook's first
// photo; for CSV brands there's no photo attachment.

const ACCENT = '#4A6741';
const ACCENT_LIGHT = '#7a9670';
const GOLD = '#d4a64a';

export default function NotebookImport() {
  const { S, sBtn, sInput, setView } = useAppContext();
  const { startNewCook, setCurrentCook } = useCookContext();

  const [brandId, setBrandId] = useState(() => {
    try { return localStorage.getItem('bbq-import-last-brand') || null; } catch { return null; }
  });
  const [status, setStatus] = useState('idle');
  // 'idle' | 'loading' | 'reading' | 'review' | 'error'
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [photoData, setPhotoData] = useState([]);  // array of compressed dataURLs
  const [patch, setPatch] = useState(null);
  const [editable, setEditable] = useState({});
  const [error, setError] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const fileRef = useRef(null);

  const brand = brandId ? getBrand(brandId) : null;

  const onPickFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !brand) return;

    setStatus('loading');
    setProgress(0);
    setError(null);

    try {
      if (brand.method === 'ocr') {
        await runOcrFlow(files);
      } else {
        await runCsvFlow(files[0]);
      }
    } catch (err) {
      console.error(`${brand.label} import failed:`, err);
      setError(err?.message || 'Could not read the file. Try again.');
      setStatus('error');
      track('thermometer_import_failed', {
        brand: brand.id,
        method: brand.method,
        reason: err?.message?.slice(0, 80) || 'unknown',
      });
    }
  };

  const runOcrFlow = async (files) => {
    // First photo drives OCR + preview; any additional photos are
    // attached as bonus shots on the cook. Cap at 5 to avoid huge cooks.
    const ocrFile = files[0];
    const allFiles = files.slice(0, 5);

    const url = URL.createObjectURL(ocrFile);
    setPreviewUrl(url);

    // Compress every selected photo in parallel for attachment.
    const compressed = await Promise.all(allFiles.map(f => compressPhoto(f)));
    setPhotoData(compressed);

    setStatus('reading');
    const { default: Tesseract } = await import('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(ocrFile, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });

    const computed = brand.parse(text);
    finishReview(computed);
    track('thermometer_import_parsed', {
      brand: brand.id,
      method: 'ocr',
      photo_count: allFiles.length,
      meat_found: !!computed.fields.meatType,
      finish_found: !!computed.fields.targetInternalTemp,
      date_found: !!computed.fields.date,
      duration_found: !!computed.fields.cookTimeHours,
    });
  };

  const runCsvFlow = async (file) => {
    setStatus('reading');
    setProgress(50);
    const text = await file.text();
    const rows = parseCsvText(text);
    if (rows.length < 2) {
      setError('That CSV looks empty. Pick a file with a header row + data rows.');
      setStatus('error');
      return;
    }
    setProgress(90);
    const computed = brand.parse(rows);
    if (computed.error) {
      const why = humanizeCsvError(computed.error);
      setError(`We couldn't read that CSV — ${why}`);
      setStatus('error');
      track('thermometer_import_failed', { brand: brand.id, method: 'csv', reason: computed.error });
      return;
    }
    finishReview(computed);
    track('thermometer_import_parsed', {
      brand: brand.id,
      method: 'csv',
      finish_found: !!computed.fields.targetInternalTemp,
      date_found: !!computed.fields.date,
      duration_found: !!computed.fields.cookTimeHours,
      cook_temp_found: !!computed.fields.cookTemp,
    });
  };

  const finishReview = (computed) => {
    setPatch(computed);
    setEditable({
      name: computed.suggestedName,
      meatType: computed.fields.meatType || '',
      date: computed.fields.date || new Date().toISOString().split('T')[0],
      targetInternalTemp: computed.fields.targetInternalTemp || '',
      cookTemp: computed.fields.cookTemp || '',
      cookTimeHours: computed.fields.cookTimeHours || '',
      cookTimeMinutes: computed.fields.cookTimeMinutes || '',
      notes: computed.fields.notes || `Imported from ${brand?.label || 'thermometer'}.`,
    });
    setStatus('review');
  };

  const onSave = () => {
    startNewCook();
    queueMicrotask(() => {
      setCurrentCook(c => c ? ({
        ...c,
        name: editable.name?.trim() || 'Imported cook',
        meatType: editable.meatType,
        date: editable.date,
        targetInternalTemp: editable.targetInternalTemp,
        cookTemp: editable.cookTemp,
        cookTimeHours: editable.cookTimeHours,
        cookTimeMinutes: editable.cookTimeMinutes,
        notes: editable.notes,
        photos: Array.isArray(photoData) ? photoData : (photoData ? [photoData] : []),
        tags: [...(c.tags || []), brand?.id || 'imported'],
      }) : c);
      track('thermometer_import_saved', { brand: brand?.id });
    });
  };

  return (
    <div className="bbq-container" style={{ padding: '16px', paddingBottom: '64px' }}>
      <button onClick={() => {
        if (brandId && status === 'idle') {
          setBrandId(null);
          try { localStorage.removeItem('bbq-import-last-brand'); } catch {}
        } else {
          setView('home');
        }
      }}
        style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '14px',
          cursor: 'pointer', marginBottom: '12px' }}>← Back</button>

      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px',
        letterSpacing: '2px', marginBottom: '4px', color: ACCENT }}>Import a cook</h2>

      {!brandId && (
        <BrandPicker S={S} onPick={(id) => {
          setBrandId(id);
          try { localStorage.setItem('bbq-import-last-brand', id); } catch {}
          track('thermometer_brand_picked', { brand: id });
        }} />
      )}

      {brand && status === 'idle' && (
        <>
          <div style={{ fontSize: '12px', color: S.muted, marginBottom: '14px' }}>
            {brand.description}
          </div>
          <GuideExpander S={S} brand={brand} showGuide={showGuide} setShowGuide={setShowGuide} />
          <PickerCard S={S} method={brand.method} onClick={() => fileRef.current?.click()} />
        </>
      )}

      {(status === 'loading' || status === 'reading') && (
        <ProgressCard S={S} status={status} progress={progress} method={brand?.method} />
      )}

      {status === 'review' && patch && (
        <ReviewForm
          S={S} sBtn={sBtn} sInput={sInput}
          previewUrl={previewUrl}
          brand={brand}
          editable={editable} setEditable={setEditable}
          confidence={patch.confidence}
          error={error}
          onSave={onSave}
          onRestart={() => { setStatus('idle'); setPatch(null); setPreviewUrl(null); }}
        />
      )}

      {status === 'error' && (
        <div style={{
          background: '#3a1717', border: '1px solid #f87171', color: '#fca5a5',
          padding: '14px', borderRadius: '10px', marginBottom: '16px',
        }}>
          {error}
          <div style={{ marginTop: '10px' }}>
            <button onClick={() => { setStatus('idle'); setError(null); }} style={sBtn(true, true)}>Try again</button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file"
        accept={brand?.fileAccept || '*'}
        multiple={brand?.method === 'ocr'}
        onChange={onPickFile}
        style={{ display: 'none' }} />
    </div>
  );
}

function BrandPicker({ S, onPick }) {
  return (
    <div>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '14px' }}>
        Pick the brand of thermometer your cook came from.
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {BRANDS.map(b => (
          <button key={b.id} onClick={() => onPick(b.id)}
            style={{
              padding: '14px 16px',
              background: S.card, border: `1px solid ${S.border}`,
              borderRadius: '10px', cursor: 'pointer',
              color: S.text, textAlign: 'left',
            }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '16px',
              letterSpacing: '1px', fontWeight: '700', color: '#7a9670' }}>{b.label}</div>
            <div style={{ fontSize: '11px', color: S.muted, marginTop: '2px' }}>
              {b.method === 'csv' ? 'CSV import' : 'Screenshot import'} · {b.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GuideExpander({ S, brand, showGuide, setShowGuide }) {
  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderRadius: '10px', marginBottom: '16px',
    }}>
      <button onClick={() => setShowGuide(g => !g)}
        style={{
          width: '100%', textAlign: 'left',
          background: 'none', border: 'none', color: ACCENT_LIGHT,
          padding: '12px 14px', cursor: 'pointer',
          fontFamily: "'Oswald', sans-serif", fontSize: '13px',
          letterSpacing: '1px', fontWeight: '700',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
        <span>{showGuide ? '▾' : '▸'} HOW TO GET THE {brand.method === 'csv' ? 'CSV' : 'SCREENSHOT'}</span>
      </button>
      {showGuide && (
        <div style={{ padding: '0 16px 14px', fontSize: '13px', color: S.text, lineHeight: 1.7 }}>
          <ol style={{ paddingLeft: '20px', margin: 0 }}>
            {brand.guide.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

function PickerCard({ S, method, onClick }) {
  const label = method === 'csv' ? 'PICK CSV FILE' : 'PICK SCREENSHOT(S)';
  return (
    <button onClick={onClick}
      style={{
        width: '100%', padding: '32px 16px',
        background: S.card, border: `2px dashed ${ACCENT}`,
        borderRadius: '14px', cursor: 'pointer',
        color: ACCENT_LIGHT, fontFamily: "'Oswald', sans-serif",
        fontSize: '16px', fontWeight: '700', letterSpacing: '2px',
      }}>
      {label}
      <div style={{ fontSize: '12px', color: S.muted, marginTop: '8px', letterSpacing: '1px' }}>
        {method === 'csv'
          ? 'Tap to browse your files'
          : 'Tap to browse — pick the OCR shot plus up to 4 bonus photos'}
      </div>
    </button>
  );
}

function ProgressCard({ S, status, progress, method }) {
  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderRadius: '12px', padding: '24px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: '14px',
        letterSpacing: '2px', color: ACCENT_LIGHT, marginBottom: '8px',
      }}>{status === 'reading'
        ? (method === 'csv' ? 'PARSING CSV' : 'READING SCREENSHOT')
        : 'LOADING'}</div>
      <div style={{ fontSize: '12px', color: S.muted, marginBottom: '12px' }}>
        {status === 'reading' ? `${progress}% — extracting fields…` : 'Preparing…'}
      </div>
      <div style={{
        height: '6px', background: S.dark, borderRadius: '3px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${status === 'reading' ? progress : 8}%`,
          background: ACCENT_LIGHT, transition: 'width 0.2s',
        }} />
      </div>
    </div>
  );
}

function ReviewForm({ S, sBtn, sInput, previewUrl, brand, editable, setEditable, confidence, error, onSave, onRestart }) {
  const update = (k, v) => setEditable(e => ({ ...e, [k]: v }));
  return (
    <div>
      {error && (
        <div style={{
          background: '#3a2917', border: '1px solid #fbbf24', color: '#fcd34d',
          padding: '12px 14px', borderRadius: '8px', marginBottom: '14px',
          fontSize: '13px', lineHeight: 1.5,
        }}>
          ⚠️ {error}
        </div>
      )}

      {previewUrl && (
        <div style={{ marginBottom: '14px' }}>
          <img src={previewUrl} alt={`${brand?.label || 'Source'} screenshot`}
            style={{
              width: '100%', maxHeight: '320px', objectFit: 'contain',
              background: '#000', borderRadius: '10px', border: `1px solid ${S.border}`,
            }} />
        </div>
      )}

      <div style={{
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: '12px', padding: '16px', marginBottom: '16px',
      }}>
        <div style={{
          fontFamily: "'Oswald', sans-serif", fontSize: '11px',
          letterSpacing: '2px', color: ACCENT, marginBottom: '12px',
        }}>WHAT WE READ — REVIEW &amp; EDIT</div>

        <Field S={S} sInput={sInput} label="Cook name" value={editable.name}
          onChange={v => update('name', v)} />

        <Field S={S} sInput={sInput} label="Meat type" value={editable.meatType}
          onChange={v => update('meatType', v)} conf={confidence.meatType} />

        <Field S={S} sInput={sInput} label="Date" value={editable.date} type="date"
          onChange={v => update('date', v)} conf={confidence.date} />

        <Field S={S} sInput={sInput} label="Finish temp (°F)" value={editable.targetInternalTemp}
          type="number" onChange={v => update('targetInternalTemp', v)} conf={confidence.finishTemp} />

        <Field S={S} sInput={sInput} label="Avg cook temp (°F)" value={editable.cookTemp}
          type="number" onChange={v => update('cookTemp', v)} conf={confidence.cookTemp} />

        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <Field S={S} sInput={sInput} label="Cook hours" value={editable.cookTimeHours}
              type="number" onChange={v => update('cookTimeHours', v)} conf={confidence.duration} />
          </div>
          <div style={{ flex: 1 }}>
            <Field S={S} sInput={sInput} label="Cook minutes" value={editable.cookTimeMinutes}
              type="number" onChange={v => update('cookTimeMinutes', v)} conf={confidence.duration} />
          </div>
        </div>

        <div style={{ marginBottom: '4px', fontSize: '11px', color: S.muted, letterSpacing: '1px', marginTop: '8px' }}>NOTES</div>
        <textarea value={editable.notes} onChange={e => update('notes', e.target.value)}
          rows={5}
          style={{ ...sInput(), width: '100%', resize: 'vertical' }} />
      </div>

      <button onClick={onSave}
        style={{
          width: '100%', padding: '14px', background: ACCENT, color: '#fff',
          border: 'none', borderRadius: '10px', marginBottom: '8px',
          fontFamily: "'Oswald', sans-serif", fontSize: '15px',
          fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
        }}>
        Continue to cook form
      </button>
      <button onClick={onRestart}
        style={{ ...sBtn(false, true), width: '100%' }}>
        Pick a different file
      </button>
    </div>
  );
}

function Field({ S, sInput, label, value, type = 'text', onChange, conf }) {
  const lowConf = typeof conf === 'number' && conf > 0 && conf < 0.7;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '4px',
      }}>
        <span style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px' }}>
          {label.toUpperCase()}
        </span>
        {lowConf && (
          <span style={{
            fontSize: '9px', letterSpacing: '1.5px', fontWeight: '700',
            color: '#1a1a1a', background: GOLD,
            padding: '2px 6px', borderRadius: '3px',
          }}>DOUBLE CHECK</span>
        )}
      </div>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        style={{
          ...sInput(), width: '100%',
          border: lowConf ? `1px solid ${GOLD}` : sInput().border,
        }} />
    </div>
  );
}

// ── CSV helpers ─────────────────────────────────────────────────

// Minimal CSV row parser — handles double-quoted fields with embedded
// commas and "" escapes. Returns an array of arrays.
function parseCsvText(text) {
  const out = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); out.push(row); }
  return out.filter(r => r.length > 1 || (r[0] || '').trim() !== '');
}

function humanizeCsvError(code) {
  switch (code) {
    case 'empty_csv': return 'the file is empty or has no data rows.';
    case 'no_timestamp_column': return 'we couldn\'t find a timestamp column. Make sure the CSV has a column named like Time, Timestamp, or Date.';
    case 'no_temperature_columns': return 'we couldn\'t find any temperature columns. The CSV needs at least one column of numeric temperatures.';
    case 'unparseable_timestamps': return 'the timestamps in the file are in a format we don\'t recognize.';
    default: return 'we couldn\'t make sense of the data.';
  }
}
