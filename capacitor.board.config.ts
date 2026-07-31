import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor config for the standalone BBQ Board app (Android + iOS).
//
// Distinct from:
//   - capacitor.config.ts          (BBQ Scorecard, android/ + ios/)
//   - capacitor.notebook.config.ts (BBQ Notebook, android-notebook/)
//
// Native project locations:
//   Android → android-board/  (synced via `npm run sync:board`)
//   iOS     → ios-board/      (built by Codemagic from GitHub)
// Both consume the web bundle at dist-board-native/, produced by
// `npm run build:board-native`.

const config: CapacitorConfig = {
  appId: 'com.holysmokesbbq.board',
  appName: 'BBQ Board',
  webDir: 'dist-board-native',
  server: {
    allowNavigation: [
      'holy-smokes-bbq-board.firebaseapp.com',
      'accounts.google.com',
      '*.googleapis.com',
    ],
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
  ios: {
    // Board's iOS native project. Codemagic builds from this path.
    path: 'ios-board',
    // Web content is bundled into the .ipa. server.url must NOT be set for
    // App Store builds — that would load remote content, which Apple rejects.
    contentInset: 'automatic',
    // Prevents the WebView from zooming when the user taps an input.
    scrollEnabled: true,
  },
};

export default config;
