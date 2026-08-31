import { lazy, Suspense } from 'react';
import AppProvider, { useAppContext } from './context/AppContext.jsx';
import { NAV_V2 } from './featureFlags.js';

// Site (landing page) is loaded eagerly — it's what new visitors see first
// and we want LCP to be as fast as possible.
import Site from './components/Site.jsx';
import NotebookLaunchModal from './components/NotebookLaunchModal.jsx';
import AppNav from './components/AppNav.jsx';
import DeleteConfirmModal from './components/DeleteConfirmModal.jsx';
import Paywall from './components/Paywall.jsx';

// Everything else loads on demand. Each lazy import becomes its own JS chunk
// that the browser fetches the first time the route is needed.
// Reduces the initial bundle from ~140 KB gzip to ~25 KB and shaves ~600 KiB
// of unused JavaScript off the landing page load (Lighthouse finding).
//
// Note: cook + recipe routes used to live here for the legacy dual-mode
// build that also served as the BBQ Notebook. As of v3.1.12, the Notebook
// is a standalone Play Store app (com.holysmokesbbq.notebook) with its
// own build (vite.config.notebook.js) — those routes have been removed
// from the Scorecard. The cook + recipe component files still live in
// src/components/ for the Notebook build to import.
const Home          = lazy(() => import('./components/Home.jsx'));
const MVP           = lazy(() => import('./components/MVP.jsx'));
const Map           = lazy(() => import('./components/Map.jsx'));
const Nearby        = lazy(() => import('./components/Nearby.jsx'));
const Stats         = lazy(() => import('./components/Stats.jsx'));
const Compare       = lazy(() => import('./components/Compare.jsx'));
const Detail        = lazy(() => import('./components/Detail.jsx'));
const ReviewForm    = lazy(() => import('./components/ReviewForm.jsx'));
const Profile       = lazy(() => import('./components/Profile.jsx'));
const Settings      = lazy(() => import('./components/Settings.jsx'));
const Leaderboard   = lazy(() => import('./components/Leaderboard.jsx'));
const Achievements  = lazy(() => import('./components/Achievements.jsx'));

function LoadingFallback() {
  const { S } = useAppContext();
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: S.muted, fontSize: '13px', letterSpacing: '1px' }}>
      Loading...
    </div>
  );
}

function AppRouter() {
  const { view, currentReview, loaded, S } = useAppContext();

  if (!loaded) {
    return <div style={{ padding: '40px', textAlign: 'center', color: S.muted }}>Loading...</div>;
  }

  // Site is eager — no Suspense needed. Skip the Notebook launch modal
  // on Site because that's the pre-signin landing page.
  if (view === 'site') return <Site />;

  // Everything else gets a Suspense boundary so React can render the
  // fallback while the chunk downloads (typically <200ms on broadband).
  let node = null;
  if (view === 'home') node = <Home />;
  else if (view === 'mvp') node = <MVP />;
  else if (view === 'map') node = <Map />;
  else if (view === 'nearby') node = <Nearby />;
  else if (view === 'stats') node = <Stats />;
  else if (view === 'compare') node = <Compare />;
  else if (view === 'detail' && currentReview) node = <Detail />;
  else if ((view === 'new' || view === 'edit') && currentReview) node = <ReviewForm />;
  else if (view === 'profile' || view === 'settings') node = NAV_V2 ? <Settings /> : <Profile />;
  else if (view === 'leaderboard') node = <Leaderboard />;
  else if (view === 'achievements') node = <Achievements />;

  return (
    <>
      <Suspense fallback={<LoadingFallback />}>{node}</Suspense>
      {/* Persistent ☰ menu on every in-app screen (NAV_V2). Sub-screens
          rely on this instead of their own Back buttons. */}
      {NAV_V2 && <AppNav />}
      <DeleteConfirmModal />
      <Paywall />
      <NotebookLaunchModal />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
