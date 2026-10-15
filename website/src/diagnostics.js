// Shared "Report a Problem" diagnostics for all Holy Smokes apps
// (Scorecard, Notebook, Board). One module, imported by each app —
// each just calls initDiagnostics() once at startup and wires a button
// to sendProblemReport({ appName, supportEmail, context }).
//
// Why this exists: Crashlytics only fires on crashes, and TestFlight
// feedback is iOS-only and lacks in-app state. Most bugs (layout,
// sync, "it looked wrong") never crash. This gives a beta tester a
// one-tap way to send a real error log plus device/app context to
// support@holysmokesbbqco.com — the only channel to get information
// off an iPhone the developer doesn't own.

// ── Rolling error buffer ─────────────────────────────────────────
// Captures the last N errors from app start: console.error calls,
// uncaught errors, and unhandled promise rejections. In memory only —
// nothing is sent anywhere until the user taps Report a Problem.

const MAX_ENTRIES = 120;
const errorLog = [];
let installed = false;

function push(kind, msg) {
  try {
    errorLog.push({ t: new Date().toISOString(), kind, msg: String(msg).slice(0, 1000) });
    if (errorLog.length > MAX_ENTRIES) errorLog.shift();
  } catch { /* never let logging throw */ }
}

export function initDiagnostics() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Wrap console.error without swallowing it — original still runs.
  const origError = console.error?.bind(console);
  console.error = (...args) => {
    push('console.error', args.map(a => (a?.stack || a?.message || a)).join(' '));
    origError?.(...args);
  };

  window.addEventListener('error', (e) => {
    push('error', e?.error?.stack || e?.message || 'unknown error');
  });
  window.addEventListener('unhandledrejection', (e) => {
    push('unhandledrejection', e?.reason?.stack || e?.reason?.message || String(e?.reason));
  });
}

export function getErrorLog() {
  return errorLog.slice();
}

// ── Report assembly ──────────────────────────────────────────────

async function nativeAppVersion(fallback) {
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return `${info.version} (${info.build})`;
  } catch {
    return fallback || 'unknown';
  }
}

function platform() {
  try {
    if (window.Capacitor?.getPlatform) return window.Capacitor.getPlatform();
    return window.Capacitor?.isNativePlatform?.() ? 'native' : 'web';
  } catch { return 'web'; }
}

function buildReportText({ appName, version, context }) {
  const lines = [];
  lines.push(`${appName} — problem report`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('— App & device —');
  lines.push(`App version: ${version}`);
  lines.push(`Platform: ${platform()}`);
  lines.push(`Online: ${navigator.onLine}`);
  lines.push(`Screen: ${window.screen?.width}×${window.screen?.height} @${window.devicePixelRatio || 1}x`);
  lines.push(`Viewport: ${window.innerWidth}×${window.innerHeight}`);
  lines.push(`User agent: ${navigator.userAgent}`);
  lines.push(`Language: ${navigator.language}`);
  // Caller-supplied app state (sign-in, counts, etc.)
  for (const [k, v] of Object.entries(context || {})) {
    lines.push(`${k}: ${v}`);
  }
  lines.push('');
  lines.push(`— Error log (${errorLog.length} entries) —`);
  if (errorLog.length === 0) {
    lines.push('(no errors captured this session)');
  } else {
    for (const e of errorLog) lines.push(`[${e.t}] ${e.kind}: ${e.msg}`);
  }
  lines.push('');
  lines.push('— From the tester —');
  lines.push('(describe what you were doing and what looked wrong)');
  return lines.join('\n');
}

// ── Send ─────────────────────────────────────────────────────────
// Native: write a .txt log to the Documents dir and open the share
// sheet with it attached, so the tester can email it (with the file)
// to support. Web: download the .txt and open a pre-addressed mail
// draft with a summary — mailto can't attach, so the file downloads
// alongside for the tester to attach.

export async function sendProblemReport({ appName, supportEmail, fallbackVersion, context }) {
  const version = await nativeAppVersion(fallbackVersion);
  const text = buildReportText({ appName, version, context });
  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${slug}-report-${stamp}.txt`;
  const subject = `${appName} problem report (${version})`;
  const summary = `Problem report attached. Please describe the issue below.\n\nSend to: ${supportEmail}\n\n`;

  const isNative = window.Capacitor?.isNativePlatform?.();

  if (isNative) {
    try {
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ]);
      const written = await Filesystem.writeFile({
        path: filename,
        data: text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      await Share.share({
        title: subject,
        text: `${summary}Send this file to ${supportEmail}`,
        url: written.uri,
        dialogTitle: 'Send problem report',
      });
      return { ok: true, method: 'share' };
    } catch (e) {
      // Fall through to web path so the tester still gets something.
      console.error('Native report share failed, falling back:', e);
    }
  }

  // Web / fallback: download the log file, then open a pre-addressed draft.
  try {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { /* download best-effort */ }

  // Pre-addressed mail draft with the summary in the body (attach the
  // just-downloaded file). Body is kept short so it doesn't overflow.
  const body = encodeURIComponent(`${summary}Attach the file "${filename}" that just downloaded.\n\n---\n${text.slice(0, 1500)}`);
  window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${body}`;
  return { ok: true, method: 'mailto' };
}
