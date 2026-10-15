import { lazy, Suspense } from 'react';
import AppProvider, { useAppContext } from './context/AppContext.jsx';
import CookProvider from './context/CookContext.jsx';

// Notebook landing page. Eager-loaded so it paints fast for first-time
// visitors landing on the app.
import NotebookSite from './components/NotebookSite.jsx';

// Cook-focused routes only. Restaurant-only routes (MVP, Map, Compare,
// Nearby, Detail, ReviewForm) are intentionally NOT imported — that
// prunes ~30 KB of unused code from this build.
//
// Home + Leaderboard are Notebook-specific forks (NotebookHome,
// NotebookLeaderboard) — the shared components were restaurant-themed
// at their core and could not be cleanly conditional. The forks keep
// the Notebook bundle free of every Scorecard code path at the source.
const Home          = lazy(() => import('./components/NotebookHome.jsx'));
const Settings      = lazy(() => import('./components/NotebookSettings.jsx'));
const Leaderboard   = lazy(() => import('./components/NotebookLeaderboard.jsx'));
const Stats         = lazy(() => import('./components/NotebookStats.jsx'));
const PitHumidity   = lazy(() => import('./components/NotebookPitHumidity.jsx'));
const Import        = lazy(() => import('./components/NotebookImport.jsx'));
const Rewards       = lazy(() => import('./components/NotebookRewards.jsx'));
const CookForm      = lazy(() => import('./components/CookForm.jsx'));
const CookDetail    = lazy(() => import('./components/CookDetail.jsx'));
const Recipes       = lazy(() => import('./components/Recipes.jsx'));
const RecipeForm    = lazy(() => import('./components/RecipeForm.jsx'));
const RecipeDetail  = lazy(() => import('./components/RecipeDetail.jsx'));

function LoadingFallback() {
  const { S } = useAppContext();
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: S.muted, fontSize: '13px', letterSpacing: '1px' }}>
      Loading...
    </div>
  );
}

function NotebookRouter() {
  const { view, loaded, S } = useAppContext();

  if (!loaded) {
    return <div style={{ padding: '40px', textAlign: 'center', color: S.muted }}>Loading...</div>;
  }

  // Landing page is eager, no Suspense needed.
  if (view === 'site') return <NotebookSite />;

  // Map a view name to a component. Anything not in this list falls
  // through to NotebookSite — a soft graceful fallback rather than a
  // blank screen if a stray navigation lands on an unknown view name.
  let node = null;
  if (view === 'home') node = <Home />;
  // v3.0.0: 'profile' route removed; anything still asking for it goes to Settings.
  else if (view === 'settings' || view === 'profile') node = <Settings />;
  else if (view === 'leaderboard') node = <Leaderboard />;
  else if (view === 'stats') node = <Stats />;
  else if (view === 'humidity') node = <PitHumidity />;
  else if (view === 'import') node = <Import />;
  else if (view === 'rewards') node = <Rewards />;
  else if (view === 'cookNew' || view === 'cookEdit') node = <CookForm />;
  else if (view === 'cookDetail') node = <CookDetail />;
  else if (view === 'recipes') node = <Recipes />;
  else if (view === 'recipeNew' || view === 'recipeEdit') node = <RecipeForm />;
  else if (view === 'recipeDetail') node = <RecipeDetail />;
  else node = <NotebookSite />;

  return <Suspense fallback={<LoadingFallback />}>{node}</Suspense>;
}

export default function NotebookApp() {
  return (
    <AppProvider>
      <CookProvider>
        <NotebookRouter />
      </CookProvider>
    </AppProvider>
  );
}
