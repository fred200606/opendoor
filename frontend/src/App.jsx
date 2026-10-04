import { Route, Routes } from 'react-router-dom';
import GuestRoute from './auth/GuestRoute.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import HomePage from './pages/HomePage.jsx';
import CandidateApplicationPage from './pages/candidate/CandidateApplicationPage.jsx';
import CandidateDashboardPage from './pages/candidate/CandidateDashboardPage.jsx';
import CandidateProfilePage from './pages/candidate/CandidateProfilePage.jsx';
import FeedbackPage from './pages/candidate/FeedbackPage.jsx';
import MyApplicationsPage from './pages/candidate/MyApplicationsPage.jsx';
import SavedJobsPage from './pages/candidate/SavedJobsPage.jsx';
import EmployerPublicPage from './pages/jobs/EmployerPublicPage.jsx';
import JobDetailsPage from './pages/jobs/JobDetailsPage.jsx';
import JobSearchPage from './pages/jobs/JobSearchPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="jobs" element={<JobSearchPage />} />
        <Route path="jobs/:id" element={<JobDetailsPage />} />
        <Route path="employers/:id" element={<EmployerPublicPage />} />
        <Route element={<GuestRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        <Route path="candidate" element={<ProtectedRoute role="candidate" />}>
          <Route path="dashboard" element={<CandidateDashboardPage />} />
          <Route path="profile" element={<CandidateProfilePage />} />
          <Route path="jobs" element={<JobSearchPage />} />
          <Route path="jobs/:id" element={<JobDetailsPage />} />
          <Route path="applications" element={<MyApplicationsPage />} />
          <Route path="applications/:id" element={<CandidateApplicationPage />} />
          <Route path="applications/:id/feedback" element={<FeedbackPage />} />
          <Route path="saved-jobs" element={<SavedJobsPage />} />
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
