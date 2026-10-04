import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import Page from './components/Page.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// Placeholder until the login and register forms are wired (next Phase 1 step).
function ComingSoon({ title }) {
  return (
    <Page title={title}>
      <p>This page is being built.</p>
    </Page>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<ComingSoon title="Log in" />} />
        <Route path="register" element={<ComingSoon title="Create an account" />} />

        <Route path="candidate" element={<ProtectedRoute role="candidate" />}>
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>
        <Route path="employer" element={<ProtectedRoute role="employer" />}>
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>
        <Route path="admin" element={<ProtectedRoute role="admin" />}>
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
