import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.holysmokesbbq.scorecard',
  appName: 'BBQ Scorecard',
  // Populated by `npm run build:native` (vite.config.native.js).
  // Web Scorecard builds to dist/scorecard/ with /scorecard/ prefixed
  // asset paths — Capacitor's webview can't use that layout because
  // it loads from https://localhost/ via WebViewLocalServer. The native
  // build uses base='/' so the bundle's references work inside the
  // Android assets folder.
  webDir: 'dist-native',
  server: {
    allowNavigation: [
      'holy-smokes-bbq-scorecard.firebaseapp.com',
      'accounts.google.com',
      '*.googleapis.com',
      '*.overpass-api.de',
    ],
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com", "apple.com"],
    },
  },
};

export default config;
