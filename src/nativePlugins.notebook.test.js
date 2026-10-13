// Notebook's Android project is wired by hand. android-notebook's
// capacitor.settings.gradle and app/capacitor.build.gradle say "DO NOT EDIT,
// IT IS GENERATED", but nothing regenerates them: `npx cap sync android`
// targets Scorecard (root capacitor.config.ts is Scorecard's, and
// capacitor.notebook.config.ts declares no android.path), and
// scripts/sync-notebook.mjs only copies the web bundle.
//
// The two drift directions are not symmetric, which is the whole reason this
// file exists. A plugin listed in gradle but not installed fails the build
// loudly ("Could not resolve project :capacitor-*") — we have caught that one
// before, by being told. A plugin the app imports but gradle omits builds
// fine and fails on the device, and every native call site here wraps itself
// in try/catch with a web fallback, so it degrades in silence. Report a
// Problem, PDF export and share took the browser-download path instead of a
// real share sheet in every Notebook build through 3.0.9 for exactly that
// reason: @capacitor/filesystem and @capacitor/share were imported by
// src/diagnostics.js, src/reviewPdf.js and src/context/AppContext.jsx and
// were in neither gradle file. Ten shipped versions never flagged it.
//
// Pattern adopted from the Board session's src/board/nativePlugins.test.js.

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { NOTEBOOK_NATIVE_PLUGINS, gradleName } from '../scripts/notebook-native-plugins.mjs';

const ROOT = resolve(__dirname, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

// Every @capacitor/* and @capacitor-firebase/* package reachable by import
// from the Notebook entry, static or dynamic.
function importedCapacitorPlugins() {
  const seen = new Set();
  const pkgs = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (/^@capacitor(-firebase)?\/[\w-]+$/.test(spec)) { pkgs.add(spec); continue; }
      if (!spec.startsWith('.')) continue;
      const base = resolve(dirname(f), spec);
      const hit = [base, base + '.js', base + '.jsx', join(base, 'index.js'), join(base, 'index.jsx')]
        .find((c) => existsSync(c) && statSync(c).isFile());
      if (hit) walk(hit);
    }
  };
  walk(resolve(ROOT, 'src/main.notebook.jsx'));
  // The bridge itself, not a plugin.
  pkgs.delete('@capacitor/core');
  return [...pkgs].sort();
}

// assets/capacitor.plugins.json is a generated build artifact and gitignored
// (it lives beside the copied web bundle), so a fresh clone has none until
// `npm run sync:notebook` runs. Returning null lets the registry tests pass
// on a clean checkout instead of going red for a missing artifact. That is
// safe because the registry is also checked at build time: the pre-gradle
// verification step reads it, and the build flow is always sync -> verify ->
// gradle. If you are debugging a plugin problem and these tests look quiet,
// run the sync first.
const REGISTRY = 'android-notebook/app/src/main/assets/capacitor.plugins.json';
function readRegistry() {
  if (!existsSync(resolve(ROOT, REGISTRY))) return null;
  return JSON.parse(read(REGISTRY));
}

const listed = NOTEBOOK_NATIVE_PLUGINS.map((p) => p.pkg).sort();
const listedGradle = NOTEBOOK_NATIVE_PLUGINS.map((p) => gradleName(p.pkg)).sort();

test('the import walk actually reaches Notebook, not just its entry file', () => {
  // Guards every assertion below: a resolver regression would empty the graph
  // and the missing-plugin test would pass by inspecting nothing.
  const found = importedCapacitorPlugins();
  expect(found).toContain('@capacitor-firebase/authentication');
  expect(found.length).toBeGreaterThanOrEqual(3);
});

test('every Capacitor plugin Notebook imports is compiled into the Android build', () => {
  const missing = importedCapacitorPlugins().filter((p) => !listed.includes(p));
  expect(
    missing,
    'add to NOTEBOOK_NATIVE_PLUGINS and both android-notebook gradle files',
  ).toEqual([]);
});

test('capacitor.settings.gradle includes exactly the listed plugins', () => {
  const included = [...read('android-notebook/capacitor.settings.gradle')
    .matchAll(/include ':(capacitor-[\w-]+)'/g)]
    .map((m) => m[1])
    // capacitor-android is the bridge project, present in every build.
    .filter((n) => n !== 'capacitor-android')
    .sort();
  expect(included).toEqual(listedGradle);
});

test('app/capacitor.build.gradle implements exactly the listed plugins', () => {
  const impl = [...read('android-notebook/app/capacitor.build.gradle')
    .matchAll(/implementation project\(':(capacitor-[\w-]+)'\)/g)]
    .map((m) => m[1])
    .sort();
  expect(impl).toEqual(listedGradle);
});

test('the plugin registry matches the manifest exactly', () => {
  // THE leg that was broken, and the one the gradle checks cannot see.
  // assets/capacitor.plugins.json is what Capacitor actually reads at startup.
  // It was a committed leftover from the last real `cap add` and nothing
  // regenerated it, so it kept listing @capacitor-firebase/app-check after
  // ea11c9c dropped that plugin from the build in July 2026.
  //
  // PluginManager.loadPluginClasses() walks the whole registry inside ONE try
  // block and rethrows ClassNotFoundException as PluginLoadException;
  // BridgeActivity catches it, logs "Error loading plugins." and never calls
  // addPlugins. So ONE bad entry registers ZERO plugins, not n-1. app-check
  // sorted first, so every Notebook build from 3.0.5 to 3.0.17 loaded no
  // native plugins at all: no native Google sign-in on a fresh install, and
  // the filesystem/share fix was dead at runtime even though the classes were
  // in the dex. scripts/sync-notebook.mjs now generates this file from the
  // manifest on every sync.
  const registry = readRegistry();
  if (!registry) return;   // see readRegistry: generated artifact, may be absent
  expect(registry.map((e) => e.pkg).sort()).toEqual(listed);
  const byPkg = Object.fromEntries(NOTEBOOK_NATIVE_PLUGINS.map((p) => [p.pkg, p.classpath]));
  for (const entry of registry) {
    expect(entry.classpath, `registry classpath for ${entry.pkg}`).toBe(byPkg[entry.pkg]);
  }
});

test('every registry classpath belongs to a plugin the build compiles', () => {
  // The fresh-install invariant, stated the way the device experiences it:
  // anything named in the registry must be compiled in, or startup registers
  // nothing. Checked against the gradle files rather than the manifest, so
  // this still bites if the manifest and gradle drift together.
  const registry = readRegistry();
  if (!registry) return;
  const compiled = [...read('android-notebook/app/capacitor.build.gradle')
    .matchAll(/implementation project\(':(capacitor-[\w-]+)'\)/g)].map((m) => m[1]);
  const orphans = registry
    .map((e) => e.pkg)
    .filter((pkg) => !compiled.includes(gradleName(pkg)));
  expect(
    orphans,
    'these are in the startup registry but not compiled -- ZERO plugins will register',
  ).toEqual([]);
});

test('Notebook does not use viewport-fit=cover while relying on bare env() insets', () => {
  // A tripwire, not a fix. Capacitor's SystemBars injects --safe-area-inset-*
  // only when the page sets viewport-fit=cover (SystemBars.java gates on
  // hasViewportCover), and pads the WebView natively on Android 15+ either
  // way. Notebook does not set viewport-fit=cover, so native padding keeps
  // content clear of the status bar and the bare env() calls in
  // NotebookHome.jsx correctly contribute 0 -- verified against Capacitor's
  // source 2026-10-12, which is why no change was made there.
  //
  // Add viewport-fit=cover and that stops being true: env() stays 0 in the
  // Android WebView while the real inset arrives only in the CSS variable, and
  // the floating menu button slides under the status bar. That is the bug
  // Board hit (f92b0fa). If this fails, switch NotebookHome's insets to
  // SAFE_TOP / belowTop from src/safeArea.js in the same change.
  const html = read('index.notebook.html');
  if (/viewport-fit\s*=\s*cover/.test(html)) {
    const home = read('src/components/NotebookHome.jsx');
    const bare = [...home.matchAll(/env\(safe-area-inset-[a-z]+/g)].length;
    expect(
      bare,
      'index.notebook.html now uses viewport-fit=cover, so bare env() insets read 0 on Android -- use src/safeArea.js',
    ).toBe(0);
  }
});

test('each listed plugin is installed and its classpath names a real plugin class', () => {
  for (const { pkg, classpath } of NOTEBOOK_NATIVE_PLUGINS) {
    const androidDir = resolve(ROOT, 'node_modules', pkg, 'android');
    expect(existsSync(androidDir), `${pkg} has no android/ project`).toBe(true);
    const className = classpath.split('.').pop();
    const found = (function search(dir) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (search(p)) return true; }
        else if (e.name === `${className}.java` || e.name === `${className}.kt`) return true;
      }
      return false;
    })(androidDir);
    expect(found, `${classpath} not found in ${pkg}`).toBe(true);
  }
});

test('the gradle project paths point at real plugin directories', () => {
  // A wrong projectDir fails the build loudly, but it fails it 10 minutes into
  // a queue rather than here.
  const settings = read('android-notebook/capacitor.settings.gradle');
  for (const m of settings.matchAll(/project\(':(capacitor-[\w-]+)'\)\.projectDir = new File\('([^']+)'\)/g)) {
    const [, name, rel] = m;
    if (name === 'capacitor-android') continue;
    const abs = resolve(ROOT, 'android-notebook', rel);
    expect(existsSync(abs), `${name} projectDir does not exist: ${rel}`).toBe(true);
  }
});

test("Notebook's build scripts parse", () => {
  // Nothing else imports these, so a syntax error in one passes the whole
  // suite and only surfaces mid-queue-rebuild.
  for (const f of [
    'scripts/sync-notebook.mjs',
    'scripts/notebook-native-plugins.mjs',
    'vite.config.native.notebook.js',
  ]) {
    expect(
      () => execFileSync(process.execPath, ['--check', resolve(ROOT, f)], { stdio: 'pipe' }),
      f,
    ).not.toThrow();
  }
});
