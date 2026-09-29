import { lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { useRoute } from './state/router';
import { useSettings } from './state/settings';
import { Overview } from './pages/Overview';

const Transactions = lazy(() => import('./pages/Transactions'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Split = lazy(() => import('./pages/Split'));
const Convert = lazy(() => import('./pages/Convert'));
const Categorise = lazy(() => import('./pages/Categorise'));

export function App() {
  const route = useRoute();
  const { t } = useSettings();
  let page;
  switch (route.path) {
    case '/transactions':
      page = <Transactions key={route.params.toString()} params={route.params} />;
      break;
    case '/subscriptions':
      page = <Subscriptions />;
      break;
    case '/split':
      page = <Split />;
      break;
    case '/convert':
      page = <Convert />;
      break;
    case '/categorise':
      page = <Categorise />;
      break;
    default:
      page = <Overview />;
  }
  return (
    <Layout path={route.path === '/' || !route.path ? '/' : route.path}>
      <Suspense fallback={<p role="status">{t('tx.loading')}</p>}>{page}</Suspense>
    </Layout>
  );
}
