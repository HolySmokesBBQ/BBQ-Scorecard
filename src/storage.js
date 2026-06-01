const STORAGE_KEY = 'muiller-bbq-reviews';
const DRIVE_FILE_NAME = 'muiller-bbq-scorecard-data.json';
const CLIENT_ID = '109928096278-4v26g0ku6ij989laqnt0bcnalm8iojgd.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let accessToken = null;
let tokenClient = null;

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocal(reviews) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  } catch (e) {
    console.error('localStorage save failed:', e);
  }
}

function loadGsi() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export async function signInGoogle() {
  const loaded = await loadGsi();
  if (!loaded) return false;
  accessToken = null;

  // Detect standalone PWA mode (installed to homescreen)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  return new Promise((resolve) => {
    let resolved = false;
    const done = (ok) => { if (!resolved) { resolved = true; resolve(ok); } };

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.access_token) {
          accessToken = resp.access_token;
          done(true);
        } else {
          done(false);
        }
      },
      error_callback: () => done(false),
    });

    try {
      tokenClient.requestAccessToken({ prompt: '' });
    } catch {
      // Popup blocked — try with consent prompt (opens in new tab on standalone)
      try {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch {
        done(false);
        return;
      }
    }

    // Fallback: if first attempt silently fails, retry with consent
    setTimeout(() => {
      if (!accessToken && !resolved) {
        try {
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch {
          done(false);
        }
      }
    }, 2000);

    // Safety timeout — don't hang forever
    setTimeout(() => done(false), 30000);
  });
}

async function findDriveFile() {
  try {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}'+and+trashed=false&spaces=drive&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const d = await r.json();
    return d.files?.[0]?.id || null;
  } catch {
    return null;
  }
}

export async function loadFromDrive() {
  try {
    const fileId = await findDriveFile();
    if (!fileId) return null;
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return await r.json();
  } catch {
    return null;
  }
}

export async function saveToDrive(data) {
  try {
    const fileId = await findDriveFile();
    const body = JSON.stringify(data);
    const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const method = fileId ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}` }, body: form });
    return r.ok;
  } catch {
    return false;
  }
}

export function isAuthenticated() {
  return !!accessToken;
}

export async function autoSync(data) {
  if (!accessToken) return false;
  return saveToDrive(data);
}
