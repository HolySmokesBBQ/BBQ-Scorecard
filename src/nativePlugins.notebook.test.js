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
