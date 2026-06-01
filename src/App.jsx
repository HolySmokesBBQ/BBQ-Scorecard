import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadLocal, saveLocal } from './storage.js';
import {
  firebaseSignIn, firebaseSignOut, onAuthChange, getOrCreateProfile,
  syncReviewsUp, loadMyCloudReviews, mergeReviews, deleteCloudReview,
  addFriendByCode, removeFriendConnection, getFriendsList,
  getFriendReviewsForRestaurant, getAllFriendReviews, getUserProfile,
  handleRedirectResult, isInAppBrowser,
} from './firebaseSync.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ── Analytics helper ── */
function track(event, params) {
  if (typeof window.gtag === 'function') window.gtag('event', event, params);
}

/* ── Constants ── */
const CATEGORIES = {
  bbq: [
    { key: 'appearance', label: 'Appearance' },
    { key: 'taste', label: 'Taste / Flavor' },
    { key: 'tenderness', label: 'Tenderness / Texture' },
    { key: 'smoke', label: 'Smoke' },
    { key: 'sides', label: 'Sides' },
    { key: 'sauce', label: 'Sauce' },
    { key: 'portions', label: 'Portions / Value' },
  ],
  family: [
    { key: 'service', label: 'Service' },
    { key: 'cleanliness', label: 'Cleanliness' },
    { key: 'amenities', label: 'Family Amenities' },
  ],
};

const DESCRIPTORS = {
  appearance: { 1:'Inedible looking',2:'Sloppy, no care',3:'Below average',4:'Passable',5:'Standard BBQ',6:'Attention to plating',7:'Appetizing on sight',8:'Photo-worthy',9:'Competition-level' },
  taste: { 1:'Spit-it-out bad',2:'Struggle to finish',3:'Bland or off-putting',4:'Forgettable',5:'Solid, no complaints',6:'Well balanced',7:'Keeps you reaching back',8:'Complex and layered',9:'Best ever' },
  tenderness: { 1:"Can't chew it",2:'Tough or dry',3:'Chewy or dried out',4:'Needs work',5:'Standard for the cut',6:'Good moisture and pull',7:'Clean bite, rendered fat',8:'Perfect moisture balance',9:'Every bite perfect' },
  smoke: { 1:'Zero smoke presence',2:'Barely detectable',3:'Faint hint',4:'Present but flat',5:'Noticeable ring and flavor',6:'Good balance with meat',7:'Clean wood flavor throughout',8:'Deep penetration, clean finish',9:'Masterclass smoke profile' },
  sides: { 1:'Inedible',2:'Gas station quality',3:'Below average',4:'Forgettable',5:'Standard, does the job',6:'A step above',7:'Would order on their own',8:'Standout, memorable',9:'Best sides anywhere' },
  sauce: { 1:'Awful',2:'Bottom shelf',3:'Generic',4:'Passable',5:'Solid house sauce',6:'Good flavor, complements meat',7:'Distinctive and balanced',8:'Complex, craveable',9:'Hall of fame sauce' },
  portions: { 1:'Insulting',2:'Left hungry',3:'Skimpy for the price',4:'Below average',5:'Fair for the price',6:'Good value',7:'Generous portions',8:'Outstanding value',9:'Absurd amount of food' },
  service: { 1:'Hostile',2:'Rude or ignored',3:'Slow and indifferent',4:'Below average',5:'Fine, nothing notable',6:'Friendly',7:'Attentive and warm',8:'Went above and beyond',9:'Made the experience' },
  cleanliness: { 1:'Health hazard',2:'Dirty, sticky',3:'Needs attention',4:'Below average',5:'Acceptable',6:'Clean',7:'Well maintained',8:'Spotless',9:'Immaculate' },
  amenities: { 1:'Hostile to families',2:'No accommodations',3:'Bare minimum',4:'Below average',5:'Standard setup',6:'Kid-friendly touches',7:'Good for families',8:'Family destination',9:'Built for families' },
};

const MEATS = ['Brisket','Smoked Turkey','Sausage','Pulled Pork','Ribs','Chicken','Pork Chop','Burnt Ends'];
const SIDES_LIST = ['Potato Salad','Mac & Cheese','Beans','Rice','Coleslaw','Corn','Green Beans','Bread'];
const SAUCE_DEP_OPTIONS = ['No — meat stood on its own','Helped but not necessary','Yes — meat needed sauce'];
const RETURN_OPTIONS = ['Absolutely','Probably','Maybe','Probably not','No'];

const THEMES = {
  dark: { bg: '#1a1a1a', card: '#222', border: '#333', accent: '#d4782f', text: '#f5e6d3', muted: '#888', dark: '#111' },
  light: { bg: '#f5f0eb', card: '#ffffff', border: '#ddd', accent: '#c06820', text: '#2a2420', muted: '#777', dark: '#ede5dc' },
};

const STAR_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#22c55e' };
const GEOCODE_CACHE_KEY = 'muiller-bbq-geocache';

let S = THEMES.dark;

/* ── Scoring ── */
function calcScores(scores) {
  const bbqKeys = CATEGORIES.bbq.map(c => c.key);
  const famKeys = CATEGORIES.family.map(c => c.key);
  const bbqVals = bbqKeys.map(k => scores[k]).filter(v => v > 0);
  const famVals = famKeys.map(k => scores[k]).filter(v => v > 0);
  const bbqAvg = bbqVals.length ? bbqVals.reduce((a,b) => a+b, 0) / bbqVals.length : 0;
  const famAvg = famVals.length ? famVals.reduce((a,b) => a+b, 0) / famVals.length : 0;
  let bonus = 0;
  if (famAvg >= 8) bonus = 1.25;
  else if (famAvg >= 7) bonus = 1.00;
  else if (famAvg >= 6) bonus = 0.75;
  else if (famAvg >= 5) bonus = 0.50;
  else if (famAvg >= 4) bonus = 0.25;
  const composite = bbqAvg + bonus;
  let stars = 1;
  if (composite >= 5.75) stars = 5;
  else if (composite >= 4.75) stars = 4;
  else if (composite >= 3.75) stars = 3;
  else if (composite >= 2.75) stars = 2;
  return { bbqAvg, famAvg, bonus, composite, stars };
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function emptyReview() {
  return {
    id: genId(), restaurant: '', date: new Date().toISOString().split('T')[0],
    location: '', meats: [], meatOther: '', sides: [], sideOther: '', dessert: '',
    scores: {}, sauceDep: '', wouldReturn: '', notes: '', notesLog: [],
    price: '', priceSplit: '1', trip: '', googleReviewUrl: '', photo: null,
    photos: [], friends: [], lastEdited: null,
  };
}

/* ── Migrate old reviews (photo → photos) ── */
function migrateReview(r) {
  const migrated = { ...r };
  if (!migrated.photos) migrated.photos = [];
  if (!migrated.friends) migrated.friends = [];
  // Convert single photo to photos array
  if (migrated.photo && migrated.photos.length === 0) {
    migrated.photos = [migrated.photo];
  }
  return migrated;
}

/* ── Share Card Generator (Canvas API) ── */
function generateShareCard(r) {
  return new Promise((resolve) => {
    const sc = calcScores(r.scores);
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // Accent bar at top
    ctx.fillStyle = '#d4782f';
    ctx.fillRect(0, 0, W, 8);

    const drawContent = () => {
      let y = 80;

      // Logo/brand
      ctx.fillStyle = '#d4782f';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HOLY SMOKES BBQ', W / 2, y);
      y += 24;
      ctx.fillStyle = '#888';
      ctx.font = '16px sans-serif';
      ctx.fillText('BBQ SCORECARD BY HOLY SMOKES BBQ CO', W / 2, y);
      y += 60;

      // Restaurant name
      ctx.fillStyle = '#f5e6d3';
      ctx.font = 'bold 52px sans-serif';
      const name = r.restaurant.toUpperCase();
      // Word wrap if too long
      const words = name.split(' ');
      let line = '';
      const lines = [];
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > W - 120) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      for (const l of lines) {
        ctx.fillText(l, W / 2, y);
        y += 62;
      }
      y += 10;

      // Location & date
      ctx.fillStyle = '#888';
      ctx.font = '24px sans-serif';
      const locDate = [r.location, r.date].filter(Boolean).join('  |  ');
      ctx.fillText(locDate, W / 2, y);
      y += 60;

      // Stars
      ctx.font = '64px sans-serif';
      ctx.fillStyle = '#fbbf24';
      const starStr = '★'.repeat(sc.stars) + '☆'.repeat(5 - sc.stars);
      ctx.fillText(starStr, W / 2, y);
      y += 50;

      // Composite score
      ctx.fillStyle = '#d4782f';
      ctx.font = 'bold 80px sans-serif';
      ctx.fillText(sc.composite.toFixed(2), W / 2, y);
      y += 30;
      ctx.fillStyle = '#888';
      ctx.font = '20px sans-serif';
      ctx.fillText(`BBQ ${sc.bbqAvg.toFixed(2)}  +  Family Bonus ${sc.bonus.toFixed(2)}`, W / 2, y);
      y += 60;

      // Divider
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, y);
      ctx.lineTo(W - 100, y);
      ctx.stroke();
      y += 40;

      // Category scores
      ctx.textAlign = 'left';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#d4782f';
      ctx.fillText('BBQ TRACK', 100, y);
      ctx.textAlign = 'right';
      ctx.fillText('FAMILY TRACK', W - 100, y);
      y += 35;

      const bbqCats = CATEGORIES.bbq;
      const famCats = CATEGORIES.family;
      const maxRows = Math.max(bbqCats.length, famCats.length);

      ctx.font = '22px sans-serif';
      for (let i = 0; i < maxRows; i++) {
        if (i < bbqCats.length) {
          const c = bbqCats[i];
          const v = r.scores[c.key] || 0;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#ccc';
          ctx.fillText(c.label.split(' /')[0], 100, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = v >= 7 ? '#4ade80' : v >= 5 ? '#f5e6d3' : v > 0 ? '#f87171' : '#555';
          ctx.fillText(v > 0 ? `${v}/9` : '-', W / 2 - 40, y);
        }
        if (i < famCats.length) {
          const c = famCats[i];
          const v = r.scores[c.key] || 0;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#ccc';
          ctx.fillText(c.label, W / 2 + 40, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = v >= 7 ? '#4ade80' : v >= 5 ? '#f5e6d3' : v > 0 ? '#f87171' : '#555';
          ctx.fillText(v > 0 ? `${v}/9` : '-', W - 100, y);
        }
        y += 34;
      }
      y += 20;

      // Would return
      if (r.wouldReturn) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.font = '22px sans-serif';
        ctx.fillText(`Would return: ${r.wouldReturn}`, W / 2, y);
        y += 40;
      }

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#444';
      ctx.font = '16px sans-serif';
      ctx.fillText('holysmokesbbqco.com', W / 2, H - 40);

      // Bottom accent bar
      ctx.fillStyle = '#d4782f';
      ctx.fillRect(0, H - 8, W, 8);

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };

    // If there's a photo, draw it at the top
    const photos = r.photos?.length ? r.photos : (r.photo ? [r.photo] : []);
    if (photos.length > 0) {
      const img = new Image();
      img.onload = () => {
        // Draw photo as background strip
        const imgH = 400;
        ctx.drawImage(img, 0, 0, W, imgH);
        // Gradient overlay
        const grad = ctx.createLinearGradient(0, imgH - 150, 0, imgH);
        grad.addColorStop(0, 'rgba(26,26,26,0)');
        grad.addColorStop(1, 'rgba(26,26,26,1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, imgH - 150, W, 150);
        drawContent();
      };
      img.onerror = drawContent;
      img.src = photos[0];
    } else {
      drawContent();
    }
  });
}

/* ── Photo compression ── */
function compressPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── Styles ── */
const sBtn = (active, small) => ({
  padding: small ? '6px 12px' : '10px 16px',
  background: active ? S.accent : S.card,
  color: active ? '#fff' : S.muted,
  border: `1px solid ${active ? S.accent : S.border}`,
  borderRadius: '6px', cursor: 'pointer',
  fontSize: small ? '12px' : '13px', fontWeight: '600',
  transition: 'all 0.15s',
});

const sInput = () => ({
  width: '100%', padding: '10px', background: S.card, border: `1px solid ${S.border}`,
  borderRadius: '6px', color: S.text, fontFamily: 'inherit', fontSize: '14px', boxSizing: 'border-box',
});

const sLabel = () => ({
  display: 'block', fontSize: '11px', color: S.muted, marginBottom: '4px', letterSpacing: '1px',
});

/* ── Google Review Draft Generator ── */
function generateGoogleDraft(r) {
  const sc = calcScores(r.scores);
  const toGoogle = (val) => val > 0 ? Math.max(1, Math.min(5, Math.round(val * 5 / 9))) : 3;

  const foodRating = sc.bbqAvg > 0 ? toGoogle(sc.bbqAvg) : 3;
  const serviceRating = r.scores.service ? toGoogle(r.scores.service) : 3;
  const cleanVals = [r.scores.cleanliness, r.scores.amenities].filter(Boolean);
  const cleanVal = cleanVals.length ? cleanVals.reduce((a, b) => a + b, 0) / cleanVals.length : 0;
  const atmoRating = cleanVal > 0 ? toGoogle(cleanVal) : 3;

  let verdict;
  if (sc.composite >= 8) verdict = 'Top tier. Go here.';
  else if (sc.composite >= 7) verdict = 'Really solid spot.';
  else if (sc.composite >= 6) verdict = 'Good BBQ, does the job.';
  else if (sc.composite >= 5) verdict = 'Middle of the road.';
  else if (sc.composite >= 4) verdict = 'Below average.';
  else if (sc.composite >= 3) verdict = 'Disappointing.';
  else verdict = 'Hard pass.';

  const lines = [`TL;DR: ${sc.stars}/5. ${verdict}`, ''];

  const ordered = [...(r.meats || [])];
  if (r.meatOther) ordered.push(r.meatOther);
  const sidesList = [...(r.sides || [])];
  if (r.sideOther) sidesList.push(r.sideOther);

  let orderLine = '';
  if (ordered.length) orderLine = `Had the ${ordered.join(', ').replace(/, ([^,]*)$/, ' and $1')}`;
  if (sidesList.length) orderLine += `${orderLine ? ' with ' : 'Sides: '}${sidesList.join(', ').replace(/, ([^,]*)$/, ' and $1')}`;
  if (r.dessert) orderLine += `. ${r.dessert} for dessert`;
  if (orderLine) lines.push(orderLine + '.', '');

  const bbqCats = CATEGORIES.bbq;
  const highs = bbqCats.filter(c => (r.scores[c.key] || 0) >= 7);
  const lows = bbqCats.filter(c => (r.scores[c.key] || 0) > 0 && (r.scores[c.key] || 0) <= 4);

  if (highs.length > 0) {
    const parts = highs.map(c => {
      const desc = DESCRIPTORS[c.key]?.[r.scores[c.key]];
      return `${c.label.split(' /')[0].split(' ·')[0].toLowerCase()}${desc ? ` (${desc.toLowerCase()})` : ''}`;
    });
    lines.push(`Standouts: ${parts.join(', ')}.`);
  }

  if (lows.length > 0) {
    const parts = lows.map(c => {
      const desc = DESCRIPTORS[c.key]?.[r.scores[c.key]];
      return `${c.label.split(' /')[0].toLowerCase()}${desc ? ` — ${desc.toLowerCase()}` : ''}`;
    });
    lines.push(`Needs work: ${parts.join(', ')}.`);
  }

  if (highs.length === 0 && lows.length === 0) {
    lines.push('Everything was middle of the pack — nothing stood out, nothing was bad.');
  }

  lines.push('');

  if (r.sauceDep) lines.push(`Sauce dependency: ${r.sauceDep.charAt(0).toLowerCase() + r.sauceDep.slice(1)}.`);

  const svc = r.scores.service || 0;
  const clean = r.scores.cleanliness || 0;
  if (svc >= 7) lines.push('Service was great — friendly and attentive.');
  else if (svc > 0 && svc <= 4) lines.push('Service was lacking.');
  if (clean >= 7) lines.push('Place was clean and well-kept.');
  else if (clean > 0 && clean <= 4) lines.push('Cleanliness could use some work.');

  lines.push('');

  if (r.wouldReturn) lines.push(`Would we come back? ${r.wouldReturn}.`, '');

  lines.push(`Food: ${foodRating}/5 | Service: ${serviceRating}/5 | Atmosphere: ${atmoRating}/5`);

  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

/* ── CSV Export ── */
function exportCSV(reviews) {
  const headers = [
    'Restaurant','Date','Location','Trip','Price','Split','Price Per Person',
    'Appearance','Taste','Tenderness','Smoke','Sides','Sauce','Portions',
    'Service','Cleanliness','Amenities',
    'BBQ Avg','Family Avg','Bonus','Composite','Stars',
    'Sauce Dependency','Would Return','Meats Ordered','Sides Ordered','Dessert','Notes',
  ];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = reviews.map(r => {
    const sc = calcScores(r.scores);
    const pp = r.price && r.priceSplit > 0 ? (Number(r.price) / Number(r.priceSplit)).toFixed(2) : '';
    return [
      r.restaurant, r.date, r.location || '', r.trip || '', r.price || '', r.priceSplit || '1', pp,
      r.scores.appearance || '', r.scores.taste || '', r.scores.tenderness || '',
      r.scores.smoke || '', r.scores.sides || '', r.scores.sauce || '', r.scores.portions || '',
      r.scores.service || '', r.scores.cleanliness || '', r.scores.amenities || '',
      sc.bbqAvg.toFixed(2), sc.famAvg.toFixed(2), sc.bonus.toFixed(2), sc.composite.toFixed(2), sc.stars,
      r.sauceDep || '', r.wouldReturn || '',
      (r.meats || []).join('; '), (r.sides || []).join('; '),
      r.dessert || '', (r.notesLog || []).join(' | ') || r.notes || '',
    ].map(esc).join(',');
  });
  const csv = [headers.map(esc).join(','), ...rows].join('\n');
  track('csv_exported', { review_count: reviews.length });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bbq-reviews-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ══════════════════════ APP ══════════════════════ */
export default function App() {
  const [reviews, setReviews] = useState([]);
  const [view, setView] = useState(() => {
    if (window.location.hash === '#scorecard') return 'home';
    return 'site';
  });
  const [currentReview, setCurrentReview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [sort, setSort] = useState('date');
  const [search, setSearch] = useState('');
  const [tripFilter, setTripFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [dirty, setDirty] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [themePref, setThemePref] = useState(() => localStorage.getItem('muiller-bbq-theme') || 'system');
  const [systemTheme, setSystemTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const theme = themePref === 'system' ? systemTheme : themePref;
  const [draftText, setDraftText] = useState('');
  const [mapLoading, setMapLoading] = useState(false);
  const [publishedReviews, setPublishedReviews] = useState([]);
  const [expandedPublic, setExpandedPublic] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [friendName, setFriendName] = useState('');
  const [friendsList, setFriendsList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('muiller-bbq-friends') || '[]'); } catch { return []; }
  });
  const [shareGenerating, setShareGenerating] = useState(false);
  const [fbUser, setFbUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [fbFriends, setFbFriends] = useState([]);
  const [friendCodeInput, setFriendCodeInput] = useState('BBQ-');
  const [friendMsg, setFriendMsg] = useState('');
  const [friendReviewsMap, setFriendReviewsMap] = useState({});
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardSort, setLeaderboardSort] = useState('reviews');
  const [fbSyncing, setFbSyncing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('bbq-onboarded'));
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const addPhotoInputRef = useRef(null);
  const importInputRef = useRef(null);
  const savedSnapshot = useRef(null);
  const mapRef = useRef(null);

  S = THEMES[theme] || THEMES.dark;

  const attemptSignIn = async () => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
      return null;
    }
    return await firebaseSignIn();
  };

  // Inject responsive CSS (once)
  useEffect(() => {
    const id = 'bbq-responsive-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      /* ── Desktop Responsive Layout ── */
      .bbq-container { max-width: 480px; margin: 0 auto; padding: 0; }
      .bbq-container-wide { max-width: 720px; margin: 0 auto; padding: 0; }
      .bbq-container-form { max-width: 480px; margin: 0 auto; padding: 16px; padding-bottom: 100px; }
      .bbq-review-grid { display: flex; flex-direction: column; }
      .bbq-detail-layout { }
      .bbq-detail-hero { }
      .bbq-detail-scores { }
      .bbq-score-tracks { }
      .bbq-landing-reviews { }
      .bbq-landing-hero { padding: 32px 0 24px; }
      .bbq-landing-story { }
      .bbq-profile-grid { }
      .bbq-leaderboard-grid { }
      .bbq-form-tracks { }
      .bbq-form-fields { }
      .bbq-stats-grid { display: flex; justify-content: space-around; text-align: center; }
      .bbq-form-selects { }

      @media (min-width: 768px) {
        .bbq-container { max-width: 900px; }
        .bbq-container-wide { max-width: 1100px; }
        .bbq-container-form { max-width: 860px; }
        .bbq-review-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .bbq-review-grid > div { margin-bottom: 0 !important; }
        .bbq-detail-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          align-items: start;
        }
        .bbq-detail-hero { position: sticky; top: 16px; }
        .bbq-score-tracks {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .bbq-landing-reviews {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .bbq-landing-reviews > div { margin-bottom: 0 !important; }
        .bbq-landing-hero { padding: 48px 0 36px; }
        .bbq-landing-hero img { width: 160px !important; height: 160px !important; }
        .bbq-landing-hero h1 { font-size: 42px !important; }
        .bbq-landing-story { }
        .bbq-profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .bbq-profile-grid > div { margin-bottom: 0 !important; }
        .bbq-leaderboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .bbq-form-tracks {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .bbq-form-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 16px;
        }
        .bbq-form-fields > div { margin-bottom: 0 !important; }
        .bbq-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .bbq-form-selects {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
      }

      @media (min-width: 1200px) {
        .bbq-container { max-width: 1100px; }
        .bbq-container-wide { max-width: 1300px; }
        .bbq-container-form { max-width: 1000px; }
        .bbq-review-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        .bbq-landing-reviews {
          grid-template-columns: repeat(3, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const raw = loadLocal();
    const migrated = raw.map(migrateReview);
    setReviews(migrated);
    setLoaded(true);
    fetch(`${import.meta.env.BASE_URL}published-reviews.json`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPublishedReviews(Array.isArray(data) ? data : []))
      .catch(() => {});
    // Handle Firebase redirect result (mobile sign-in flow)
    handleRedirectResult().catch(() => {});
    // Track PWA install
    window.addEventListener('appinstalled', () => track('app_installed'));
  }, []);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      if (fbUser) {
        syncReviewsUp(fbUser.uid, reviews).then(() => {
          setSyncStatus('done');
          setTimeout(() => setSyncStatus(''), 2000);
        }).catch(() => {});
      }
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [reviews, fbUser]);

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      const wasSignedOut = !fbUser;
      setFbUser(user);
      if (user) {
        if (wasSignedOut) track('sign_in', { method: 'google' });
        try {
          const profile = await getOrCreateProfile(user);
          setUserProfile(profile);
          const friends = await getFriendsList(user.uid);
          setFbFriends(friends);

          // Merge cloud reviews with local
          const cloudReviews = await loadMyCloudReviews(user.uid);
          const local = loadLocal();
          const merged = mergeReviews(local, cloudReviews);
          setReviews(merged);
          saveLocal(merged);

          // Push merged set back to cloud
          await syncReviewsUp(user.uid, merged);
        } catch (e) {
          console.error('Firebase init error:', e);
        }
      } else {
        setUserProfile(null);
        setFbFriends([]);
      }
    });
    return unsub;
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('muiller-bbq-theme', themePref);
    document.body.style.background = S.bg;
    document.body.style.color = S.text;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', S.bg);
  }, [theme, themePref]);

  useEffect(() => {
    const handler = (e) => {
      if (view !== 'home') {
        e.preventDefault();
        if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) {
          window.history.pushState(null, '', '');
          return;
        }
        setView('home');
        setCurrentReview(null);
        setDirty(false);
        setDraftText('');
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [view, dirty]);

  // Map initialization
  useEffect(() => {
    if (view !== 'map' || !mapRef.current) return;

    let cancelled = false;
    setMapLoading(true);

    const map = L.map(mapRef.current).setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 100);

    const geocodeCache = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}');

    (async () => {
      const bounds = [];
      const locations = [...new Set(reviews.filter(r => r.location).map(r => r.location))];

      for (const loc of locations) {
        if (cancelled) return;

        let coords = geocodeCache[loc];
        if (!coords) {
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`
            );
            const data = await resp.json();
            if (data[0]) {
              coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
              geocodeCache[loc] = coords;
            }
            await new Promise(r => setTimeout(r, 1100));
          } catch { continue; }
        }

        if (!coords) continue;

        const locReviews = reviews.filter(r => r.location === loc);
        locReviews.forEach((r, idx) => {
          const sc = calcScores(r.scores);
          const offset = idx * 0.003;
          L.circleMarker([coords.lat + offset * 0.5, coords.lng + offset], {
            radius: 10,
            fillColor: STAR_COLORS[sc.stars] || '#888',
            color: '#fff',
            weight: 2,
            fillOpacity: 0.9,
          })
            .bindPopup(
              `<div style="font-family:Inter,sans-serif;font-size:13px">` +
              `<b>${r.restaurant}</b><br>${r.location}<br>` +
              `<span style="color:#fbbf24">${'★'.repeat(sc.stars)}${'☆'.repeat(5 - sc.stars)}</span> ` +
              `<b>${sc.composite.toFixed(2)}</b></div>`
            )
            .addTo(map);

          bounds.push([coords.lat + offset * 0.5, coords.lng + offset]);
        });
      }

      localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache));
      if (!cancelled) {
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
        setMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      map.remove();
    };
  }, [view]);

  /* Pull-to-refresh for mobile */
  const [pullRefreshing, setPullRefreshing] = useState(false);
  useEffect(() => {
    if (view !== 'home' || !fbUser) return;
    let startY = 0;
    let pulling = false;
    const onTouchStart = (e) => {
      if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
    };
    const onTouchEnd = async (e) => {
      if (!pulling) return;
      const diff = e.changedTouches[0].clientY - startY;
      pulling = false;
      if (diff > 100) {
        setPullRefreshing(true);
        track('pull_refresh_sync');
        try {
          const cloud = await loadMyCloudReviews(fbUser.uid);
          const merged = mergeReviews(reviews, cloud);
          setReviews(merged);
          saveLocal(merged);
          await syncReviewsUp(fbUser.uid, merged);
          const friends = await getFriendsList(fbUser.uid);
          setFbFriends(friends);
        } catch (e) { console.error('Pull refresh error:', e); }
        setPullRefreshing(false);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [view, fbUser, reviews]);

  function navigateTo(v) {
    window.history.pushState(null, '', '');
    setView(v);
    setDraftText('');
    const viewEvents = { stats: 'view_stats', map: 'view_map', leaderboard: 'view_leaderboard', mvp: 'view_mvp', compare: 'comparison_viewed', home: 'scorecard_launched' };
    if (viewEvents[v]) track(viewEvents[v]);
  }

  const save = useCallback((updated) => {
    setReviews(updated);
    saveLocal(updated);
  }, []);

  const startNew = () => {
    const nr = emptyReview();
    setCurrentReview(nr);
    savedSnapshot.current = JSON.stringify(nr);
    setDirty(false);
    navigateTo('new');
  };

  const editReview = (r) => {
    const migrated = migrateReview(r);
    setCurrentReview({ ...migrated });
    savedSnapshot.current = JSON.stringify(migrated);
    setDirty(false);
    navigateTo('edit');
  };

  const viewDetail = async (r) => {
    setCurrentReview(migrateReview(r));
    setGalleryIndex(0);
    setDirty(false);
    navigateTo('detail');
    // Fetch friend reviews for this restaurant
    if (fbUser && fbFriends.length > 0 && r.restaurant && r.location) {
      try {
        const friendIds = fbFriends.map(f => f.id);
        const fReviews = await getFriendReviewsForRestaurant(friendIds, r.restaurant, r.location);
        // Group by userId and attach display name
        const byUser = {};
        for (const fr of fReviews) {
          const friend = fbFriends.find(f => f.id === fr.userId);
          if (friend) {
            byUser[fr.userId] = { ...fr, displayName: friend.displayName };
          }
        }
        setFriendReviewsMap(byUser);
      } catch { setFriendReviewsMap({}); }
    } else {
      setFriendReviewsMap({});
    }
  };

  const duplicateReview = (r) => {
    const dup = {
      ...r,
      id: genId(),
      date: new Date().toISOString().split('T')[0],
      restaurant: r.restaurant + ' (copy)',
      photo: null,
      photos: [],
      friends: [],
      lastEdited: null,
      notesLog: [],
      notes: '',
    };
    setCurrentReview(dup);
    savedSnapshot.current = JSON.stringify(dup);
    setDirty(false);
    navigateTo('new');
  };

  const update = (key, val) => {
    const updated = { ...currentReview, [key]: val };
    setCurrentReview(updated);
    setDirty(JSON.stringify(updated) !== savedSnapshot.current);
  };

  const updateScore = (key, val) => {
    const scores = { ...currentReview.scores, [key]: val };
    const updated = { ...currentReview, scores };
    setCurrentReview(updated);
    setDirty(JSON.stringify(updated) !== savedSnapshot.current);
  };

  const toggleChip = (key, val) => {
    const arr = currentReview[key] || [];
    const updated = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
    update(key, updated);
  };

  const saveCurrentReview = () => {
    if (!currentReview.restaurant.trim()) return;
    const exists = reviews.find(r => r.id === currentReview.id);
    const reviewToSave = exists
      ? { ...currentReview, lastEdited: new Date().toISOString().split('T')[0] }
      : currentReview;
    const updated = exists
      ? reviews.map(r => r.id === currentReview.id ? reviewToSave : r)
      : [reviewToSave, ...reviews];
    save(updated);
    const sc = calcScores(reviewToSave.scores);
    if (exists) {
      track('review_edited', { restaurant: reviewToSave.restaurant, location: reviewToSave.location || '', stars: sc.stars, composite: sc.composite.toFixed(2) });
    } else {
      track('review_created', { restaurant: reviewToSave.restaurant, location: reviewToSave.location || '', stars: sc.stars, composite: sc.composite.toFixed(2), review_count: updated.length });
    }
    setDirty(false);
    setView('home');
    setCurrentReview(null);
    if (fbUser) {
      syncReviewsUp(fbUser.uid, updated).then(() => {
        setSyncStatus('done');
        setTimeout(() => setSyncStatus(''), 2000);
      }).catch(() => {});
    }
  };

  const deleteReview = (id) => {
    if (!window.confirm('Delete this review?')) return;
    save(reviews.filter(r => r.id !== id));
    setView('home');
    setCurrentReview(null);
    setDirty(false);
  };

  // Firebase sync is handled via the auth listener and save functions

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressPhoto(file);
    // Add to photos array (cap at 6 photos to manage localStorage limits)
    const photos = [...(currentReview.photos || [])];
    if (photos.length >= 6) {
      alert('Maximum 6 photos per review (localStorage limit).');
      return;
    }
    photos.push(compressed);
    const updated = { ...currentReview, photos, photo: photos[0] };
    setCurrentReview(updated);
    setDirty(true);
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    const photos = [...(currentReview.photos || [])];
    photos.splice(idx, 1);
    const updated = { ...currentReview, photos, photo: photos[0] || null };
    setCurrentReview(updated);
    setDirty(true);
  };

  // Friends management
  const addFriend = () => {
    const name = friendName.trim();
    if (!name) return;
    const friends = [...(currentReview.friends || [])];
    if (friends.find(f => f.name.toLowerCase() === name.toLowerCase())) return;
    friends.push({ name, scores: {} });
    const updated = { ...currentReview, friends };
    setCurrentReview(updated);
    setDirty(true);
    setFriendName('');
    // Save to master friends list
    if (!friendsList.includes(name)) {
      const newList = [...friendsList, name];
      setFriendsList(newList);
      localStorage.setItem('muiller-bbq-friends', JSON.stringify(newList));
    }
  };

  const removeFriend = (name) => {
    const friends = (currentReview.friends || []).filter(f => f.name !== name);
    const updated = { ...currentReview, friends };
    setCurrentReview(updated);
    setDirty(true);
  };

  const updateFriendScore = (friendName, key, val) => {
    const friends = (currentReview.friends || []).map(f => {
      if (f.name === friendName) return { ...f, scores: { ...f.scores, [key]: val } };
      return f;
    });
    const updated = { ...currentReview, friends };
    setCurrentReview(updated);
    setDirty(true);
  };

  const exportBackup = () => {
    track('backup_exported', { review_count: reviews.length });
    const json = JSON.stringify(reviews, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bbq-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid');
        const merged = new Map();
        for (const r of reviews) merged.set(r.id, r);
        for (const r of data) merged.set(r.id, r);
        const latest = Array.from(merged.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        save(latest);
        track('backup_imported', { review_count: latest.length });
        alert(`Imported! ${latest.length} total reviews.`);
      } catch {
        alert('Import failed — invalid file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const publishReviews = () => {
    const pubData = reviews.map(r => {
      const { photo, photos, ...rest } = r;
      return { ...rest, photo: photo ? '(photo)' : null, photos: (photos || []).length > 0 ? ['(photos)'] : [] };
    });
    const json = JSON.stringify(pubData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'published-reviews.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addTimestampedNote = () => {
    if (!currentReview.notes.trim()) return;
    const stamp = new Date().toISOString().split('T')[0];
    const entry = `${stamp}: ${currentReview.notes.trim()}`;
    const log = [...(currentReview.notesLog || []), entry];
    const updated = { ...currentReview, notesLog: log, notes: '' };
    setCurrentReview(updated);
    setDirty(true);
  };

  /* ── Derived data ── */
  const ranked = useMemo(() => {
    let list = [...reviews];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.restaurant.toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q));
    }
    if (tripFilter) list = list.filter(r => r.trip === tripFilter);
    if (cityFilter) list = list.filter(r => r.location === cityFilter);
    if (sort === 'score') list.sort((a, b) => calcScores(b.scores).composite - calcScores(a.scores).composite);
    else list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [reviews, search, tripFilter, cityFilter, sort]);

  const rankMap = useMemo(() => {
    const byScore = [...reviews].sort((a, b) => calcScores(b.scores).composite - calcScores(a.scores).composite);
    const map = {};
    byScore.forEach((r, i) => { map[r.id] = i + 1; });
    return map;
  }, [reviews]);

  const trips = useMemo(() => [...new Set(reviews.map(r => r.trip).filter(Boolean))], [reviews]);
  const cities = useMemo(() => [...new Set(reviews.map(r => r.location).filter(Boolean))], [reviews]);

  const meatMvps = useMemo(() => {
    const allMeats = new Set();
    reviews.forEach(r => {
      (r.meats || []).forEach(m => allMeats.add(m));
      if (r.meatOther) r.meatOther.split(',').map(m => m.trim()).filter(Boolean).forEach(m => allMeats.add(m));
    });
    const mvps = [];
    for (const meat of allMeats) {
      const matching = reviews.filter(r =>
        (r.meats || []).includes(meat) ||
        (r.meatOther || '').split(',').map(m => m.trim()).includes(meat)
      );
      if (matching.length === 0) continue;
      const best = matching.reduce((a, b) =>
        calcScores(a.scores).bbqAvg > calcScores(b.scores).bbqAvg ? a : b
      );
      mvps.push({ meat, restaurant: best.restaurant, review: best, score: calcScores(best.scores), count: matching.length });
    }
    return mvps.sort((a, b) => b.score.bbqAvg - a.score.bbqAvg);
  }, [reviews]);

  const shareReview = async (r) => {
    const sc = calcScores(r.scores);
    const text = `${r.restaurant} — ${'★'.repeat(sc.stars)}${'☆'.repeat(5 - sc.stars)} (${sc.composite.toFixed(2)})\n${r.location || ''}${r.wouldReturn ? `\nWould return: ${r.wouldReturn}` : ''}`;

    setShareGenerating(true);
    try {
      const blob = await generateShareCard(r);
      const file = new File([blob], `${r.restaurant.replace(/[^a-zA-Z0-9]/g, '-')}-review.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: r.restaurant, text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: r.restaurant, text });
      } else {
        // Desktop fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        navigator.clipboard?.writeText(text);
      }
    } catch {
      // Fallback to text-only share
      if (navigator.share) navigator.share({ title: r.restaurant, text });
      else navigator.clipboard?.writeText(text);
    }
    setShareGenerating(false);
    track('share_card_generated', { restaurant: r.restaurant });
  };

  const exportText = (r) => {
    const sc = calcScores(r.scores);
    const lines = [
      `═══ ${r.restaurant} ═══`,
      `Date: ${r.date}  |  Location: ${r.location || 'N/A'}`,
      r.trip ? `Trip: ${r.trip}` : '',
      `Price: $${r.price || '?'}${r.priceSplit > 1 ? ` ($${(r.price / r.priceSplit).toFixed(2)}/person × ${r.priceSplit})` : ''}`,
      '',
      '— BBQ Track —',
      ...CATEGORIES.bbq.map(c => `  ${c.label}: ${r.scores[c.key] || '-'}/9`),
      `  BBQ Average: ${sc.bbqAvg.toFixed(2)}`,
      '',
      '— Family Track —',
      ...CATEGORIES.family.map(c => `  ${c.label}: ${r.scores[c.key] || '-'}/9`),
      `  Family Average: ${sc.famAvg.toFixed(2)}  |  Bonus: +${sc.bonus.toFixed(2)}`,
      '',
      `COMPOSITE: ${sc.composite.toFixed(2)}  |  ${'★'.repeat(sc.stars)}${'☆'.repeat(5 - sc.stars)}`,
      '',
      r.sauceDep ? `Sauce: ${r.sauceDep}` : '',
      r.wouldReturn ? `Return: ${r.wouldReturn}` : '',
      ...(r.notesLog?.length ? ['', '— Notes —', ...r.notesLog] : []),
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(lines);
  };

  if (!loaded) return <div style={{ padding: '40px', textAlign: 'center', color: S.muted }}>Loading...</div>;

  /* ── Offline Banner (shared across views) ── */
  const OfflineBanner = () => !isOnline ? (
    <div style={{
      background: '#7c2d12', color: '#fed7aa', padding: '8px 16px', textAlign: 'center',
      fontSize: '12px', fontWeight: '600', letterSpacing: '1px', position: 'sticky', top: 0, zIndex: 100,
      borderBottom: `1px solid #9a3412`,
    }}>
      Offline — changes saved locally
    </div>
  ) : syncStatus === 'done' ? (
    <div style={{
      background: '#14532d', color: '#bbf7d0', padding: '6px 16px', textAlign: 'center',
      fontSize: '12px', fontWeight: '600', letterSpacing: '1px', position: 'sticky', top: 0, zIndex: 100,
    }}>
      {'✓'} Synced to Google Drive
    </div>
  ) : null;

  /* ══════════ LANDING PAGE ══════════ */
  if (view === 'site') {
    const pubRanked = [...publishedReviews]
      .map(r => ({ ...r, _sc: calcScores(r.scores) }))
      .sort((a, b) => b._sc.composite - a._sc.composite);

    return (
      <div className="bbq-container-wide" style={{ paddingBottom: '64px' }}>
        <OfflineBanner />
        <div style={{ padding: '0 16px' }}>
        {/* Theme toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0' }}>
          <button onClick={() => setThemePref(t => t === 'dark' ? 'light' : t === 'light' ? 'system' : 'dark')}
            style={{ background: 'none', border: `1px solid ${S.border}`,
              borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.text }}>
            {themePref === 'dark' ? '☀' : themePref === 'light' ? '☽' : '◐'}
          </button>
        </div>

        {/* Hero */}
        <div className="bbq-landing-hero" style={{ textAlign: 'center' }}>
          <img src={`${import.meta.env.BASE_URL}Holy Smokes Logo Final.png`} alt="Holy Smokes"
            style={{ width: '120px', height: '120px', borderRadius: '50%', marginBottom: '16px' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '32px', fontWeight: '700',
            letterSpacing: '3px', color: S.accent }}>HOLY SMOKES BBQ</h1>
          <div style={{ fontSize: '14px', color: S.muted, marginTop: '8px', letterSpacing: '2px' }}>
            FAITH, FAMILY & FIRE
          </div>
        </div>

        {/* Story */}
        <div style={{ background: S.card, borderRadius: '12px', padding: '24px', marginBottom: '24px',
          border: `1px solid ${S.border}`, maxWidth: '720px', margin: '0 auto 24px' }}>
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', letterSpacing: '2px',
            color: S.accent, marginBottom: '12px', textAlign: 'center' }}>The Journey</h2>
          <p style={{ fontSize: '14px', lineHeight: '1.8', color: S.text, marginBottom: '12px' }}>
            Born and raised in the greater Kansas City area, so BBQ was never a hobby I picked
            up. It was just how we ate. When we got our first smoker a few years back, it was
            mine. Nobody else was touching it. Now the family's bigger, the smoker's bigger,
            and we needed a way to keep track of all the places we're hitting on the road.
          </p>
          <p style={{ fontSize: '14px', lineHeight: '1.8', color: S.text, marginBottom: '12px' }}>
            As a United Methodist pastor, currently in seminary, a lot of the best conversations
            I've had about God and about life happened around either a meat smoker or a table
            with smoked meat. I don't believe that's an accident.
          </p>
          <p style={{ fontSize: '14px', lineHeight: '1.8', color: S.text }}>
            The scorecard runs on a KCBS-style system: appearance, taste, tenderness, smoke,
            sides, sauce, portions, and how the place treats families. Every review on here
            uses it. If the food's bad, the score says so.
          </p>
        </div>

        {/* Sign In / Friends — right on the landing page */}
        <div style={{ maxWidth: '720px', margin: '0 auto 24px' }}>
          {!fbUser ? (
            <div style={{ background: S.dark, borderRadius: '12px', padding: '24px', textAlign: 'center',
              border: `1px solid ${S.border}` }}>
              <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', letterSpacing: '2px',
                color: S.accent, marginBottom: '8px' }}>Sign In</h2>
              <p style={{ fontSize: '13px', color: S.muted, marginBottom: '16px' }}>
                Sync reviews, add friends, see the leaderboard.
              </p>
              <button onClick={async () => {
                setSyncStatus('connecting');
                const user = await attemptSignIn();
                setSyncStatus(user ? 'done' : 'error');
                setTimeout(() => setSyncStatus(''), 2000);
              }} style={{
                padding: '12px 32px', background: S.accent, color: '#fff', border: 'none',
                borderRadius: '8px', fontFamily: "'Oswald', sans-serif", fontSize: '16px',
                fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
              }}>
                {syncStatus === 'connecting' ? 'Connecting...' : 'Sign In with Google'}
              </button>
            </div>
          ) : (
            <div style={{ background: S.dark, borderRadius: '12px', padding: '20px',
              border: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', justifyContent: 'center' }}>
                {fbUser.photoURL && <img src={fbUser.photoURL} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />}
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700' }}>{fbUser.displayName}</div>
                  <div style={{ fontSize: '11px', color: S.muted }}>Signed in</div>
                </div>
              </div>
              {userProfile && (
                <div style={{ textAlign: 'center', marginBottom: '12px', padding: '10px', background: S.card, borderRadius: '8px', border: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: '10px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>Your Friend Code</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '22px', fontWeight: '700', fontFamily: "'Oswald', sans-serif",
                      color: S.accent, letterSpacing: '3px',
                    }}>{userProfile.friendCode}</span>
                    <button onClick={() => {
                      const url = `${window.location.origin}/#add-friend/${userProfile.friendCode}`;
                      if (navigator.share) navigator.share({ title: 'Join me on Holy Smokes BBQ', text: `Add me on the BBQ Scorecard! My friend code is ${userProfile.friendCode}`, url });
                      else { navigator.clipboard?.writeText(userProfile.friendCode); alert('Friend code copied!'); }
                    }} style={{ ...sBtn(true, true), padding: '4px 10px', fontSize: '11px' }}>Share</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => navigateTo('home')} style={{
                  padding: '10px 24px', background: S.accent, color: '#fff', border: 'none',
                  borderRadius: '8px', fontFamily: "'Oswald', sans-serif", fontSize: '14px',
                  fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
                }}>Launch Scorecard</button>
                <button onClick={() => navigateTo('leaderboard')} style={sBtn(false, false)}>Leaderboard</button>
                <button onClick={() => navigateTo('profile')} style={sBtn(false, false)}>Profile</button>
              </div>
            </div>
          )}
        </div>

        {/* Published Reviews */}
        {pubRanked.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', letterSpacing: '2px',
              color: S.accent, marginBottom: '16px', textAlign: 'center' }}>
              Our Reviews ({pubRanked.length})
            </h2>
            <div className="bbq-landing-reviews">
            {pubRanked.map((r, idx) => {
              const sc = r._sc;
              const isExpanded = expandedPublic === r.id;
              return (
                <div key={r.id} onClick={() => { setExpandedPublic(isExpanded ? null : r.id); if (!isExpanded) track('public_review_expanded', { restaurant: r.restaurant }); }}
                  style={{ background: S.card, borderRadius: '10px', padding: '16px', marginBottom: '10px',
                    border: `1px solid ${S.border}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: S.accent, fontWeight: '700',
                          fontFamily: "'Oswald', sans-serif" }}>#{idx + 1}</span>
                        <span style={{ fontWeight: '700', fontSize: '16px' }}>{r.restaurant}</span>
                        {idx === 0 && pubRanked.length > 1 && <span style={{ fontSize: '13px' }}>{'👑'}</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: S.muted, marginTop: '3px' }}>
                        {r.location || 'Unknown'}{r.trip ? ` · ${r.trip}` : ''} · {r.date}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: '#fbbf24', fontSize: '15px', letterSpacing: '1px' }}>
                        {'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: S.accent }}>{sc.composite.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${S.border}` }}>
                      {/* What was ordered */}
                      {(() => {
                        const parts = [...(r.meats || []), r.meatOther, ...(r.sides || []), r.sideOther,
                          r.dessert ? `Dessert: ${r.dessert}` : ''].filter(Boolean);
                        return parts.length > 0 ? (
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>Ordered</div>
                            <div style={{ fontSize: '13px' }}>{parts.join(', ')}</div>
                          </div>
                        ) : null;
                      })()}

                      {/* Score breakdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: '10px' }}>
                        {[...CATEGORIES.bbq, ...CATEGORIES.family].map(c => {
                          const v = r.scores[c.key];
                          return v > 0 ? (
                            <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0',
                              borderBottom: `1px solid ${S.border}`, fontSize: '12px' }}>
                              <span style={{ color: S.muted }}>{c.label}</span>
                              <span style={{ fontWeight: '600', color: v >= 7 ? '#4ade80' : v >= 5 ? S.text : '#f87171' }}>{v}/9</span>
                            </div>
                          ) : null;
                        })}
                      </div>

                      {/* Summary line */}
                      <div style={{ fontSize: '12px', color: S.muted, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>BBQ: {sc.bbqAvg.toFixed(2)}</span>
                        <span>Family: {sc.famAvg.toFixed(2)}</span>
                        <span>Bonus: +{sc.bonus.toFixed(2)}</span>
                      </div>

                      {r.sauceDep && <div style={{ fontSize: '12px', color: S.muted, marginTop: '6px' }}>Sauce: {r.sauceDep}</div>}
                      {r.wouldReturn && <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>Would return: {r.wouldReturn}</div>}

                      {/* Notes */}
                      {r.notesLog?.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>Notes</div>
                          {r.notesLog.map((n, i) => (
                            <div key={i} style={{ fontSize: '12px', color: S.text, padding: '2px 0' }}>{n}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>{/* end bbq-landing-reviews */}
          </div>
        )}

        {publishedReviews.length === 0 && (
          <div style={{ textAlign: 'center', color: S.muted, padding: '32px 0', fontSize: '14px' }}>
            Reviews coming soon. We're out eating.
          </div>
        )}

        {/* Scorecard CTA — only for signed-out users who skipped sign-in */}
        {!fbUser && (
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <button onClick={() => { track('skip_sign_in'); navigateTo('home'); }} style={{
              padding: '10px 24px', background: 'none', color: S.accent, border: `1px solid ${S.accent}`,
              borderRadius: '8px', fontFamily: "'Oswald', sans-serif", fontSize: '14px',
              fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
            }}>Or Skip Sign-In and Launch Scorecard {'→'}</button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '16px 0', borderTop: `1px solid ${S.border}` }}>
          <a href="https://holysmokesbbqco.com/privacy.html"
            style={{ fontSize: '11px', color: S.muted, textDecoration: 'none' }}>Privacy Policy</a>
          <span style={{ fontSize: '11px', color: S.border, margin: '0 6px' }}>{'·'}</span>
          <a href={`${import.meta.env.BASE_URL}changelog.html`}
            style={{ fontSize: '11px', color: S.muted, textDecoration: 'none' }}>Changelog</a>
          <div style={{ fontSize: '10px', color: S.border, marginTop: '6px' }}>
            {'©'} {new Date().getFullYear()} Holy Smokes BBQ
          </div>
        </div>
        </div>
      </div>
    );
  }

  /* ══════════ HOME ══════════ */
  if (view === 'home') {
    return (
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

        {/* Onboarding overlay */}
        {showOnboarding && view === 'home' && (() => {
          const steps = [
            { icon: '', title: 'Score Restaurants', desc: '10 categories. 1 to 9 scale. Honest scores only.' },
            { icon: '', title: 'Add Friends', desc: 'Sign in, share your friend code, compare scores.' },
            { icon: '', title: 'Leaderboard', desc: 'See who ranks where. Head-to-head on shared spots.' },
          ];
          const step = steps[onboardingStep];
          return (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{
                background: S.card, borderRadius: '16px', padding: '40px 28px', maxWidth: '360px', width: '100%',
                textAlign: 'center', border: `1px solid ${S.border}`,
              }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>{step.icon}</div>
                <div style={{
                  fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: '700',
                  letterSpacing: '2px', color: S.accent, marginBottom: '12px',
                }}>{step.title}</div>
                <div style={{ fontSize: '14px', color: S.muted, lineHeight: '1.6', marginBottom: '28px' }}>{step.desc}</div>

                {/* Step dots */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                  {steps.map((_, i) => (
                    <div key={i} style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: i === onboardingStep ? S.accent : S.border,
                    }} />
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  {onboardingStep < steps.length - 1 ? (
                    <>
                      <button onClick={() => {
                        setShowOnboarding(false);
                        localStorage.setItem('bbq-onboarded', '1');
                      }} style={{ ...sBtn(false, true), padding: '10px 20px', fontSize: '13px' }}>Skip</button>
                      <button onClick={() => setOnboardingStep(s => s + 1)}
                        style={{ ...sBtn(true, false), padding: '10px 28px', fontSize: '13px' }}>Next →</button>
                    </>
                  ) : (
                    <button onClick={() => {
                      setShowOnboarding(false);
                      localStorage.setItem('bbq-onboarded', '1');
                    }} style={{ ...sBtn(true, false), padding: '12px 36px', fontSize: '15px', fontWeight: '600' }}>Let's Eat</button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ padding: '0 16px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '16px 0', position: 'relative' }}>
          <button onClick={() => setView('site')}
            style={{ position: 'absolute', top: '16px', left: '0', background: 'none', border: 'none',
              color: S.accent, fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
            {'←'} Site
          </button>
          <button onClick={() => setThemePref(t => t === 'dark' ? 'light' : t === 'light' ? 'system' : 'dark')}
            style={{ position: 'absolute', top: '16px', right: '0', background: 'none', border: `1px solid ${S.border}`,
              borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.text }}>
            {themePref === 'dark' ? '☀' : themePref === 'light' ? '☽' : '◐'}
          </button>
          <img src={`${import.meta.env.BASE_URL}Holy Smokes Logo Final.png`} alt="Holy Smokes" style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '8px' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', fontWeight: '700', letterSpacing: '2px', color: S.accent }}>
            BBQ Scorecard
          </h1>
          <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '3px' }}>by Holy Smokes BBQ Co</div>
        </div>

        {/* Search */}
        <input type="text" placeholder="Search restaurants..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...sInput(), marginBottom: '10px' }} />

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {trips.length > 0 && (
            <select value={tripFilter} onChange={e => setTripFilter(e.target.value)}
              style={{ ...sInput(), width: 'auto', flex: 1, fontSize: '12px', padding: '8px' }}>
              <option value="">All Trips</option>
              {trips.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {cities.length > 0 && (
            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              style={{ ...sInput(), width: 'auto', flex: 1, fontSize: '12px', padding: '8px' }}>
              <option value="">All Cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* Sort + actions */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['date', 'score'].map(s => (
            <button key={s} onClick={() => setSort(s)} style={sBtn(sort === s, true)}>
              {s === 'date' ? 'Date' : 'Score'}
            </button>
          ))}
          <button onClick={() => navigateTo('stats')} style={sBtn(false, true)}>Stats</button>
          <button onClick={() => navigateTo('mvp')} style={sBtn(false, true)}>MVP</button>
          <button onClick={() => navigateTo('map')} style={sBtn(false, true)}>Map</button>
          <button onClick={() => { setCompareMode(!compareMode); setCompareIds([]); }}
            style={sBtn(compareMode, true)}>
            {compareMode ? '✕ Cancel' : 'Compare'}
          </button>
          <button onClick={() => exportCSV(reviews)} style={sBtn(false, true)}>CSV</button>
        </div>

        {compareMode && (
          <div style={{ padding: '8px', background: S.dark, borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: S.muted }}>
            Tap 2 restaurants to compare. Selected: {compareIds.length}/2
            {compareIds.length === 2 && (
              <button onClick={() => { navigateTo('compare'); }}
                style={{ ...sBtn(true, true), marginLeft: '8px' }}>Go →</button>
            )}
          </div>
        )}

        {/* Review list */}
        {ranked.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <div style={{ background: S.card, borderRadius: '12px', padding: '32px 20px', border: `1px solid ${S.border}` }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: '700', letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>No Reviews Yet</div>
              <div style={{ fontSize: '13px', color: S.muted, marginBottom: '20px', lineHeight: '1.6' }}>
                Hit the button and get eating.
              </div>
              <button onClick={startNew} style={{ ...sBtn(true, false), padding: '12px 32px', fontSize: '15px', fontWeight: '600' }}>
                New Review
              </button>
              {!fbUser && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: '12px', color: S.muted, marginBottom: '8px' }}>Sign in to add friends</div>
                  <button onClick={async () => {
                    setSyncStatus('connecting');
                    const user = await attemptSignIn();
                    setSyncStatus(user ? 'done' : 'error');
                    setTimeout(() => setSyncStatus(''), 2000);
                  }} style={{ ...sBtn(false, true), fontSize: '12px' }}>
                    {syncStatus === 'connecting' ? 'Connecting...' : 'Sign In with Google'}
                  </button>
                </div>
              )}
            </div>
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
                  if (compareMode) {
                    if (isSelected) setCompareIds(compareIds.filter(id => id !== r.id));
                    else if (compareIds.length < 2) setCompareIds([...compareIds, r.id]);
                    return;
                  }
                  viewDetail(r);
                }}
                style={{
                  padding: '14px', background: isSelected ? (theme === 'dark' ? '#2a2015' : '#fff3e0') : S.card, borderRadius: '8px',
                  marginBottom: '8px', cursor: 'pointer', border: `1px solid ${isSelected ? S.accent : S.border}`,
                  transition: 'all 0.15s',
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

        {/* Account & Sync */}
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
                  {fbUser.photoURL && <img src={fbUser.photoURL} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />}
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
                        if (navigator.share) navigator.share({ title: 'Join me on Holy Smokes BBQ', text: `Add me on the BBQ Scorecard! My friend code is ${userProfile.friendCode}`, url });
                        else { navigator.clipboard?.writeText(userProfile.friendCode); alert('Friend code copied!'); }
                      }} style={{ ...sBtn(true, true), padding: '4px 10px', fontSize: '11px' }}>Share</button>
                    </div>
                  </div>
                )}

                {/* Add Friend inline */}
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '6px' }}>Add a Friend</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" value={friendCodeInput} onChange={e => { const v = e.target.value.toUpperCase(); setFriendCodeInput(v.startsWith('BBQ-') ? v : 'BBQ-'); }}
                      placeholder="BBQ-XXXX" maxLength={8}
                      onKeyDown={e => { if (e.key === 'Enter') {
                        e.preventDefault();
                        (async () => {
                          setFriendMsg('Adding...');
                          const result = await addFriendByCode(fbUser.uid, friendCodeInput);
                          setFriendMsg(result.ok ? `Added ${result.friend.displayName}!` : result.error);
                          if (result.ok) {
                            track('friend_added');
                            setFriendCodeInput('BBQ-');
                            const friends = await getFriendsList(fbUser.uid);
                            setFbFriends(friends);
                          }
                          setTimeout(() => setFriendMsg(''), 3000);
                        })();
                      }}}
                      style={{ ...sInput(), flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', textAlign: 'center', padding: '8px' }} />
                    <button onClick={async () => {
                      setFriendMsg('Adding...');
                      const result = await addFriendByCode(fbUser.uid, friendCodeInput);
                      setFriendMsg(result.ok ? `Added ${result.friend.displayName}!` : result.error);
                      if (result.ok) {
                        track('friend_added');
                        setFriendCodeInput('BBQ-');
                        const friends = await getFriendsList(fbUser.uid);
                        setFbFriends(friends);
                      }
                      setTimeout(() => setFriendMsg(''), 3000);
                    }} disabled={friendCodeInput.length < 8} style={sBtn(friendCodeInput.length >= 8, false)}>Add</button>
                  </div>
                  {friendMsg && (
                    <div style={{ fontSize: '12px', color: friendMsg.includes('Added') ? '#4ade80' : '#f87171', marginTop: '6px', textAlign: 'center' }}>{friendMsg}</div>
                  )}
                </div>

                {/* Friends count or empty state */}
                {fbFriends.length > 0 ? (
                  <div style={{ fontSize: '11px', color: S.muted, textAlign: 'center', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${S.border}` }}>
                    {fbFriends.length} friend{fbFriends.length !== 1 ? 's' : ''} connected
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${S.border}` }}>
                    <div style={{ fontSize: '11px', color: S.muted, marginBottom: '6px' }}>No friends yet — share your code</div>
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
            <button onClick={exportBackup} style={sBtn(false, true)}>Export Backup</button>
            <button onClick={() => importInputRef.current?.click()} style={sBtn(false, true)}>Import Backup</button>
            <button onClick={publishReviews} style={sBtn(false, true)}>Publish to Site</button>
            <input ref={importInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Share App */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={() => {
            const shareData = {
              title: 'BBQ Scorecard by Holy Smokes BBQ Co',
              text: 'Score BBQ restaurants across 10 categories, track visits, and compare with friends.',
              url: 'https://holysmokesbbqco.com',
            };
            if (navigator.share) navigator.share(shareData).catch(() => {});
            else { navigator.clipboard?.writeText('https://holysmokesbbqco.com'); alert('Link copied!'); }
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
        </div>

        {/* FAB */}
        <button onClick={startNew} style={{
          position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px',
          borderRadius: '50%', background: S.accent, color: '#fff', border: 'none',
          fontSize: '28px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>
    );
  }

  /* ══════════ MEAT MVP ══════════ */
  if (view === 'mvp') {
    return (
      <div className="bbq-container" style={{ padding: '16px' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '4px' }}>Meat MVP</h2>
        <div style={{ fontSize: '12px', color: S.muted, marginBottom: '16px' }}>Best restaurant for each meat, ranked by BBQ score</div>

        {meatMvps.length === 0 ? (
          <div style={{ textAlign: 'center', color: S.muted, marginTop: '48px', fontSize: '14px' }}>
            No meat data yet. Start reviewing!
          </div>
        ) : (
          meatMvps.map(({ meat, restaurant, review, score, count }) => (
            <div key={meat}
              onClick={() => viewDetail(review)}
              style={{
                padding: '14px', background: S.card, borderRadius: '8px', marginBottom: '8px',
                border: `1px solid ${S.border}`, cursor: 'pointer', transition: 'all 0.15s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>
                    Best {meat}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginTop: '2px' }}>{restaurant}</div>
                  <div style={{ fontSize: '11px', color: S.muted, marginTop: '2px' }}>
                    {review.location}{review.date ? ` · ${review.date}` : ''} · {count} review{count !== 1 ? 's' : ''} with {meat.toLowerCase()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#fbbf24', fontSize: '13px' }}>
                    {'★'.repeat(score.stars)}{'☆'.repeat(5 - score.stars)}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: S.accent }}>
                    {score.bbqAvg.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: S.muted }}>BBQ avg</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  /* ══════════ MAP ══════════ */
  if (view === 'map') {
    return (
      <div className="bbq-container" style={{ padding: '16px' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '12px' }}>BBQ Map</h2>

        {mapLoading && (
          <div style={{ textAlign: 'center', color: S.muted, fontSize: '13px', marginBottom: '8px' }}>
            Locating restaurants...
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[5, 4, 3, 2, 1].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: S.muted }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: STAR_COLORS[s], border: '2px solid #fff' }} />
              {s}{'★'}
            </div>
          ))}
        </div>

        <div ref={mapRef} style={{
          width: '100%', height: '60vh', borderRadius: '8px', border: `1px solid ${S.border}`,
          background: S.dark,
        }} />

        {reviews.filter(r => r.location).length === 0 && (
          <div style={{ textAlign: 'center', color: S.muted, fontSize: '13px', marginTop: '12px' }}>
            Add locations to your reviews to see them on the map.
          </div>
        )}
      </div>
    );
  }

  /* ══════════ STATS ══════════ */
  if (view === 'stats') {
    const allScores = reviews.map(r => calcScores(r.scores));
    const total = reviews.length;
    const avgComposite = total ? allScores.reduce((a, s) => a + s.composite, 0) / total : 0;
    const avgBbq = total ? allScores.reduce((a, s) => a + s.bbqAvg, 0) / total : 0;
    const avgFam = total ? allScores.reduce((a, s) => a + s.famAvg, 0) / total : 0;
    const best = total ? reviews.reduce((a, b) => calcScores(a.scores).composite > calcScores(b.scores).composite ? a : b) : null;
    const worst = total ? reviews.reduce((a, b) => calcScores(a.scores).composite < calcScores(b.scores).composite ? a : b) : null;
    const starDist = [1,2,3,4,5].map(s => allScores.filter(sc => sc.stars === s).length);
    const priced = reviews.filter(r => r.price > 0);
    const avgPrice = priced.length ? priced.reduce((a, r) => a + Number(r.price), 0) / priced.length : 0;
    const pricedPP = priced.filter(r => r.priceSplit > 0);
    const avgPP = pricedPP.length ? pricedPP.reduce((a, r) => a + (Number(r.price) / Number(r.priceSplit)), 0) / pricedPP.length : 0;

    const allCats = [...CATEGORIES.bbq, ...CATEGORIES.family];
    const catAvgs = allCats.map(c => {
      const vals = reviews.map(r => r.scores[c.key]).filter(v => v > 0);
      return { label: c.label, avg: vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0, count: vals.length };
    });

    const StatRow = ({ label, value }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
        <span style={{ color: S.muted, fontSize: '13px' }}>{label}</span>
        <span style={{ fontWeight: '600', fontSize: '13px' }}>{value}</span>
      </div>
    );

    return (
      <div className="bbq-container" style={{ padding: '16px' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>Stats Dashboard</h2>

        <div style={{ background: S.card, borderRadius: '8px', padding: '16px', marginBottom: '12px', border: `1px solid ${S.border}` }}>
          <StatRow label="Total Reviews" value={total} />
          <StatRow label="Avg Composite" value={avgComposite.toFixed(2)} />
          <StatRow label="Avg BBQ Track" value={avgBbq.toFixed(2)} />
          <StatRow label="Avg Family Track" value={avgFam.toFixed(2)} />
          <StatRow label="Avg Price" value={avgPrice ? `$${avgPrice.toFixed(0)}` : '—'} />
          <StatRow label="Avg Price/Person" value={avgPP ? `$${avgPP.toFixed(0)}` : '—'} />
          {best && <StatRow label="Best" value={`${best.restaurant} (${calcScores(best.scores).composite.toFixed(2)})`} />}
          {worst && total > 1 && <StatRow label="Worst" value={`${worst.restaurant} (${calcScores(worst.scores).composite.toFixed(2)})`} />}
        </div>

        {/* Star distribution */}
        <div style={{ background: S.card, borderRadius: '8px', padding: '16px', marginBottom: '12px', border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Star Distribution</div>
          {[5,4,3,2,1].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '24px', fontSize: '12px', color: '#fbbf24' }}>{s}{'★'}</span>
              <div style={{ flex: 1, height: '16px', background: S.dark, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${total ? (starDist[s-1] / total) * 100 : 0}%`, height: '100%', background: S.accent, borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
              <span style={{ width: '20px', fontSize: '12px', color: S.muted, textAlign: 'right' }}>{starDist[s-1]}</span>
            </div>
          ))}
        </div>

        {/* Category averages */}
        <div style={{ background: S.card, borderRadius: '8px', padding: '16px', border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Category Averages</div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, marginBottom: '6px', letterSpacing: '1px' }}>BBQ Track</div>
          {catAvgs.slice(0, 7).map(c => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span style={{ color: S.muted }}>{c.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '60px', height: '6px', background: S.dark, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(c.avg / 9) * 100}%`, height: '100%', background: S.accent, borderRadius: '3px' }} />
                </div>
                <span style={{ fontWeight: '600', width: '32px', textAlign: 'right' }}>{c.avg ? c.avg.toFixed(1) : '—'}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, marginTop: '12px', marginBottom: '6px', letterSpacing: '1px' }}>Family Track</div>
          {catAvgs.slice(7).map(c => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span style={{ color: S.muted }}>{c.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '60px', height: '6px', background: S.dark, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(c.avg / 9) * 100}%`, height: '100%', background: S.accent, borderRadius: '3px' }} />
                </div>
                <span style={{ fontWeight: '600', width: '32px', textAlign: 'right' }}>{c.avg ? c.avg.toFixed(1) : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ══════════ COMPARE ══════════ */
  if (view === 'compare') {
    const r1 = reviews.find(r => r.id === compareIds[0]);
    const r2 = reviews.find(r => r.id === compareIds[1]);
    if (!r1 || !r2) { setView('home'); return null; }
    const sc1 = calcScores(r1.scores);
    const sc2 = calcScores(r2.scores);
    const allCats = [...CATEGORIES.bbq, ...CATEGORIES.family];

    return (
      <div className="bbq-container" style={{ padding: '16px' }}>
        <button onClick={() => { setView('home'); setCompareMode(false); setCompareIds([]); }}
          style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', letterSpacing: '2px', marginBottom: '16px' }}>Side by Side</h2>

        {/* Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[r1, r2].map((r, i) => {
            const sc = i === 0 ? sc1 : sc2;
            return (
              <div key={r.id} style={{ background: S.card, borderRadius: '8px', padding: '12px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
                {r.photo && <img src={r.photo} alt="" style={{ width: '100%', borderRadius: '6px', marginBottom: '8px', maxHeight: '120px', objectFit: 'cover' }} />}
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{r.restaurant}</div>
                <div style={{ color: '#fbbf24', fontSize: '13px' }}>{'★'.repeat(sc.stars)}{'☆'.repeat(5 - sc.stars)}</div>
                <div style={{ color: S.accent, fontWeight: '700', fontSize: '16px' }}>{sc.composite.toFixed(2)}</div>
                <div style={{ fontSize: '11px', color: S.muted }}>{r.location}</div>
              </div>
            );
          })}
        </div>

        {/* Category comparison */}
        {allCats.map(c => {
          const v1 = r1.scores[c.key] || 0;
          const v2 = r2.scores[c.key] || 0;
          const winner = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
          return (
            <div key={c.key} style={{ marginBottom: '6px', background: S.card, borderRadius: '6px', padding: '10px', border: `1px solid ${S.border}` }}>
              <div style={{ textAlign: 'center', fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>{c.label.toUpperCase()}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', color: winner === 1 ? '#4ade80' : winner === 2 ? '#f87171' : S.text }}>
                  {v1 || '—'}
                </div>
                <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', color: winner === 2 ? '#4ade80' : winner === 1 ? '#f87171' : S.text }}>
                  {v2 || '—'}
                </div>
              </div>
            </div>
          );
        })}

        {/* Summary row */}
        <div style={{ marginTop: '8px', background: S.dark, borderRadius: '6px', padding: '12px', border: `1px solid ${S.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: S.muted }}>BBQ Track</div>
              <div style={{ fontWeight: '700', color: sc1.bbqAvg >= sc2.bbqAvg ? '#4ade80' : '#f87171' }}>{sc1.bbqAvg.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: S.muted }}>BBQ Track</div>
              <div style={{ fontWeight: '700', color: sc2.bbqAvg >= sc1.bbqAvg ? '#4ade80' : '#f87171' }}>{sc2.bbqAvg.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center', marginTop: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', color: S.muted }}>Family Bonus</div>
              <div style={{ fontWeight: '600' }}>+{sc1.bonus.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: S.muted }}>Family Bonus</div>
              <div style={{ fontWeight: '600' }}>+{sc2.bonus.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════ DETAIL ══════════ */
  if (view === 'detail' && currentReview) {
    const r = currentReview;
    const sc = calcScores(r.scores);
    const allCats = [...CATEGORIES.bbq, ...CATEGORIES.family];
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

        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', marginBottom: '4px' }}>{r.restaurant}</h2>
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
            View Google Review {'→'}
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button onClick={() => editReview(r)} style={sBtn(true, false)}>Edit</button>
          <button onClick={() => duplicateReview(r)} style={sBtn(false, false)}>Duplicate</button>
          <button onClick={() => shareReview(r)} disabled={shareGenerating}
            style={{ ...sBtn(false, false), opacity: shareGenerating ? 0.5 : 1 }}>
            {shareGenerating ? 'Generating...' : 'Share Card'}
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
        </div>
      </div>
    );
  }

  /* ══════════ NEW / EDIT ══════════ */
  if ((view === 'new' || view === 'edit') && currentReview) {
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
          <div style={{ marginBottom: '10px' }}>
            <label style={sLabel()}>RESTAURANT</label>
            <input type="text" value={currentReview.restaurant} onChange={e => update('restaurant', e.target.value)} placeholder="Name" style={sInput()} />
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
            <label style={sLabel()}>PHOTOS ({(currentReview.photos || []).length}/6)</label>
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
            {(currentReview.photos || []).length < 6 && (
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
            <div key={c.key} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: S.accent }}>{currentReview.scores[c.key] || '—'}</span>
              </div>
              {currentReview.scores[c.key] > 0 && DESCRIPTORS[c.key]?.[currentReview.scores[c.key]] && (
                <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic', marginBottom: '6px' }}>
                  {DESCRIPTORS[c.key][currentReview.scores[c.key]]}
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => updateScore(c.key, n)} style={{
                    flex: 1, padding: '8px 0', background: currentReview.scores[c.key] === n ? S.accent : S.dark,
                    color: currentReview.scores[c.key] === n ? '#fff' : S.muted,
                    border: `1px solid ${currentReview.scores[c.key] === n ? S.accent : S.border}`,
                    borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '14px', letterSpacing: '2px', color: S.accent, marginBottom: '12px' }}>Family Experience Track</div>
          {CATEGORIES.family.map(c => (
            <div key={c.key} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>{c.label}</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: S.accent }}>{currentReview.scores[c.key] || '—'}</span>
              </div>
              {currentReview.scores[c.key] > 0 && DESCRIPTORS[c.key]?.[currentReview.scores[c.key]] && (
                <div style={{ fontSize: '11px', color: S.muted, fontStyle: 'italic', marginBottom: '6px' }}>
                  {DESCRIPTORS[c.key][currentReview.scores[c.key]]}
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => updateScore(c.key, n)} style={{
                    flex: 1, padding: '8px 0', background: currentReview.scores[c.key] === n ? S.accent : S.dark,
                    color: currentReview.scores[c.key] === n ? '#fff' : S.muted,
                    border: `1px solid ${currentReview.scores[c.key] === n ? S.accent : S.border}`,
                    borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
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

  /* ══════════ PROFILE ══════════ */
  if (view === 'profile') {
    return (
      <div className="bbq-container" style={{ padding: '16px' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>Your Profile</h2>

        {fbUser && userProfile ? (
          <>
            <div className="bbq-profile-grid">
            {/* Profile card */}
            <div style={{ background: S.card, borderRadius: '10px', padding: '20px', border: `1px solid ${S.border}`, marginBottom: '16px', textAlign: 'center' }}>
              {fbUser.photoURL && <img src={fbUser.photoURL} alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '10px' }} />}
              <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{fbUser.displayName}</div>
              <div style={{ fontSize: '12px', color: S.muted, marginBottom: '12px' }}>{fbUser.email}</div>
              <div style={{ fontSize: '12px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>Your Friend Code</div>
              <div style={{
                fontSize: '28px', fontWeight: '700', fontFamily: "'Oswald', sans-serif",
                color: S.accent, letterSpacing: '4px', padding: '8px 0',
              }}>{userProfile.friendCode}</div>
              <button onClick={() => {
                const url = `${window.location.origin}/#add-friend/${userProfile.friendCode}`;
                if (navigator.share) navigator.share({ title: 'Join me on Holy Smokes BBQ', text: `Add me on the BBQ Scorecard! My friend code is ${userProfile.friendCode}`, url });
                else { navigator.clipboard?.writeText(userProfile.friendCode); alert('Friend code copied!'); }
              }} style={{ ...sBtn(true, true), marginTop: '8px' }}>Share Code</button>
            </div>

            {/* Add Friend */}
            <div style={{ background: S.card, borderRadius: '10px', padding: '16px', border: `1px solid ${S.border}`, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Add a Friend</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={friendCodeInput} onChange={e => setFriendCodeInput(e.target.value.toUpperCase())}
                  placeholder="BBQ-XXXX" maxLength={9}
                  onKeyDown={e => { if (e.key === 'Enter') {
                    e.preventDefault();
                    (async () => {
                      setFriendMsg('Adding...');
                      const result = await addFriendByCode(fbUser.uid, friendCodeInput);
                      setFriendMsg(result.ok ? `Added ${result.friend.displayName}!` : result.error);
                      if (result.ok) {
                        track('friend_added');
                        setFriendCodeInput('BBQ-');
                        const friends = await getFriendsList(fbUser.uid);
                        setFbFriends(friends);
                      }
                      setTimeout(() => setFriendMsg(''), 3000);
                    })();
                  }}}
                  style={{ ...sInput(), flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: '16px', letterSpacing: '2px', textAlign: 'center' }} />
                <button onClick={async () => {
                  setFriendMsg('Adding...');
                  const result = await addFriendByCode(fbUser.uid, friendCodeInput);
                  setFriendMsg(result.ok ? `Added ${result.friend.displayName}!` : result.error);
                  if (result.ok) {
                    setFriendCodeInput('BBQ-');
                    const friends = await getFriendsList(fbUser.uid);
                    setFbFriends(friends);
                  }
                  setTimeout(() => setFriendMsg(''), 3000);
                }} disabled={friendCodeInput.length < 8} style={sBtn(friendCodeInput.length >= 8, false)}>Add</button>
              </div>
              {friendMsg && (
                <div style={{ fontSize: '12px', color: friendMsg.includes('Added') ? '#4ade80' : '#f87171', marginTop: '8px', textAlign: 'center' }}>{friendMsg}</div>
              )}
            </div>

            {/* Friends list */}
            <div style={{ background: S.card, borderRadius: '10px', padding: '16px', border: `1px solid ${S.border}`, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>
                Friends ({fbFriends.length})
              </div>
              {fbFriends.length === 0 ? (
                <div style={{ fontSize: '13px', color: S.muted, textAlign: 'center', padding: '16px 0' }}>
                  No friends yet. Share your code or enter a friend's code above.
                </div>
              ) : (
                fbFriends.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${S.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {f.photoURL && <img src={f.photoURL} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />}
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>{f.displayName}</div>
                        <div style={{ fontSize: '11px', color: S.muted }}>{f.friendCode || ''}</div>
                      </div>
                    </div>
                    <button onClick={async () => {
                      if (!window.confirm(`Remove ${f.displayName}?`)) return;
                      await removeFriendConnection(fbUser.uid, f.id);
                      const friends = await getFriendsList(fbUser.uid);
                      setFbFriends(friends);
                    }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '18px' }}>{'✕'}</button>
                  </div>
                ))
              )}
            </div>

            </div>{/* end bbq-profile-grid */}

            {/* Stats */}
            <div style={{ background: S.card, borderRadius: '10px', padding: '16px', border: `1px solid ${S.border}`, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Your Stats</div>
              <div className="bbq-stats-grid">
                <div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>{reviews.length}</div>
                  <div style={{ fontSize: '11px', color: S.muted }}>Reviews</div>
                </div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>{fbFriends.length}</div>
                  <div style={{ fontSize: '11px', color: S.muted }}>Friends</div>
                </div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
                    {reviews.length ? (reviews.map(r => calcScores(r.scores).composite).reduce((a, b) => a + b, 0) / reviews.length).toFixed(1) : '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: S.muted }}>Avg Score</div>
                </div>
              </div>
            </div>

            {/* Sign out */}
            <button onClick={async () => { await firebaseSignOut(); setView('home'); }}
              style={{ ...sBtn(false, true), width: '100%', color: '#f87171', borderColor: '#f87171' }}>Sign Out</button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '14px', color: S.muted, marginBottom: '16px' }}>Sign in to create your profile and add friends.</div>
            <button onClick={async () => { await attemptSignIn(); }}
              style={{ ...sBtn(true, false), padding: '14px 32px' }}>Sign In with Google</button>
          </div>
        )}
      </div>
    );
  }

  /* ══════════ LEADERBOARD ══════════ */
  if (view === 'leaderboard') {
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
                    {s.photoURL && <img src={s.photoURL} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />}
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

  return null;
}
