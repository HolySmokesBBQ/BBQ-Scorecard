// Scorecard's Android plugin wiring, checked end to end (2026-10-12).
//
// Capacitor's Android PluginManager loads every entry in
// assets/capacitor.plugins.json inside ONE try block, so a single stale
// entry whose class is missing stops ALL native plugins from loading, and a
// plugin imported in JS but absent from the gradle files fails silently at
// its call site. Board shipped the first kind broken from August until a
// fresh install on Joel's new phone exposed it. Scorecard's registry and
// gradle files come from a real `npx cap sync android`, so it is the least
// exposed of the three apps, but neither failure shows up until a fresh
// install, so this checks every leg. Pattern from src/board/nativePlugins.test.js.
//
// The registry is generated and gitignored, so these tests read the state
// the last `cap sync` left behind. That is the state the next gradle build
// packages, which is the point.

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const REGISTRY = 'android/app/src/main/assets/capacitor.plugins.json';

// '@capacitor/share' -> 'capacitor-share', '@capgo/native-purchases' -> 'capgo-native-purchases'
const gradleName = (pkg) => pkg.replace(/^@/, '').replace('/', '-');
const PLUGIN_SPEC = /^@(capacitor|capacitor-firebase|capgo)\/[\w-]+$/;

function importedPlugins() {
  const seen = new Set();
  const pkgs = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (PLUGIN_SPEC.test(spec)) { pkgs.add(spec); continue; }
      if (!spec.startsWith('.')) continue;
      const base = resolve(dirname(f), spec);
      const hit = [base, base + '.js', base + '.jsx', join(base, 'index.js'), join(base, 'index.jsx')]
        .find((c) => existsSync(c) && statSync(c).isFile());
      if (hit) walk(hit);
    }
  };
  walk(resolve(ROOT, 'src/main.jsx'));
  pkgs.delete('@capacitor/core'); // the bridge itself, not a plugin
  return [...pkgs].sort();
}

const registry = () => JSON.parse(read(REGISTRY));
const registered = () => registry().map((e) => e.pkg).sort();

test('the import walk finds the plugins Scorecard is known to use', () => {
  // Guards the rest: a resolver regression would empty the list and every
  // check below would pass by comparing nothing.
  const found = importedPlugins();
  expect(found).toContain('@capacitor/app');
  expect(found).toContain('@capacitor/share');
  expect(found.length).toBeGreaterThan(3);
});

test('every plugin Scorecard imports is in the native plugin registry', () => {
  const missing = importedPlugins().filter((p) => !registered().includes(p));
  expect(missing, 'run `npx cap sync android` (the package may not be installed)').toEqual([]);
});

test('capacitor.settings.gradle includes exactly the registered plugins', () => {
  const included = [...read('android/capacitor.settings.gradle').matchAll(/include ':([\w-]+)'/g)]
    .map((m) => m[1]).filter((n) => n !== 'capacitor-android' && n !== 'capacitor-cordova-android-plugins').sort();
  expect(included).toEqual(registered().map(gradleName).sort());
});

test('app/capacitor.build.gradle implements exactly the registered plugins', () => {
  const impl = [...read('android/app/capacitor.build.gradle').matchAll(/implementation project\(':([\w-]+)'\)/g)]
    .map((m) => m[1]).filter((n) => n !== 'capacitor-cordova-android-plugins').sort();
  expect(impl).toEqual(registered().map(gradleName).sort());
});

test('every registry classpath names a class the installed package actually has', () => {
  // A stale entry here is the failure that blanks every plugin at startup.
  for (const { pkg, classpath } of registry()) {
    const androidDir = resolve(ROOT, 'node_modules', pkg, 'android');
    expect(existsSync(androidDir), `${pkg} has no android/ project in node_modules`).toBe(true);
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
