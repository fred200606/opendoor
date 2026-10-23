import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import GuestRoute from './auth/GuestRoute.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import RequireCompleteProfile from './auth/RequireCompleteProfile.jsx';
import AppLayout from './components/AppLayout.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import HomePage from './pages/HomePage.jsx';
import EmployerPublicPage from './pages/jobs/EmployerPublicPage.jsx';
import JobDetailsPage from './pages/jobs/JobDetailsPage.jsx';
import JobSearchPage from './pages/jobs/JobSearchPage.jsx';
import AccessibilityPage from './pages/info/AccessibilityPage.jsx';
import PrivacyPage from './pages/info/PrivacyPage.jsx';
import TrustScoresPage from './pages/info/TrustScoresPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// The signed-in portals load on demand (smaller first download); public and log-in pages stay in the main bundle.
const CandidateApplicationPage = lazy(() => import('./pages/candidate/CandidateApplicationPage.jsx'));
const CandidateDashboardPage = lazy(() => import('./pages/candidate/CandidateDashboardPage.jsx'));
const CandidateProfilePage = lazy(() => import('./pages/candidate/CandidateProfilePage.jsx'));
const CandidateSetupPage = lazy(() => import('./pages/candidate/CandidateSetupPage.jsx'));
const FeedbackPage = lazy(() => import('./pages/candidate/FeedbackPage.jsx'));
const MyApplicationsPage = lazy(() => import('./pages/candidate/MyApplicationsPage.jsx'));
const SavedJobsPage = lazy(() => import('./pages/candidate/SavedJobsPage.jsx'));
const AccountPage = lazy(() => import('./pages/account/AccountPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/account/NotificationsPage.jsx'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'));
const AdminEmployerPage = lazy(() => import('./pages/admin/AdminEmployerPage.jsx'));
const AdminEmployersPage = lazy(() => import('./pages/admin/AdminEmployersPage.jsx'));
const AdminFeedbackPage = lazy(() => import('./pages/admin/AdminFeedbackPage.jsx'));
const AdminMasterDataPage = lazy(() => import('./pages/admin/AdminMasterDataPage.jsx'));
const AdminPostingsPage = lazy(() => import('./pages/admin/AdminPostingsPage.jsx'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage.jsx'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx'));
const ApplicantsPage = lazy(() => import('./pages/employer/ApplicantsPage.jsx'));
const CompanyProfilePage = lazy(() => import('./pages/employer/CompanyProfilePage.jsx'));
const EmployerApplicationPage = lazy(() => import('./pages/employer/EmployerApplicationPage.jsx'));
const EmployerDashboardPage = lazy(() => import('./pages/employer/EmployerDashboardPage.jsx'));
const EmployerTrustScorePage = lazy(() => import('./pages/employer/EmployerTrustScorePage.jsx'));
const PostingFormPage = lazy(() => import('./pages/employer/PostingFormPage.jsx'));
const PostingsPage = lazy(() => import('./pages/employer/PostingsPage.jsx'));

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="jobs" element={<JobSearchPage />} />
        <Route path="jobs/:id" element={<JobDetailsPage />} />
        <Route path="employers/:id" element={<EmployerPublicPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="accessibility" element={<AccessibilityPage />} />
        <Route path="trust-scores" element={<TrustScoresPage />} />
        <Route element={<GuestRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route path="candidate" element={<ProtectedRoute role="candidate" />}>
          {/* Sign up → complete the profile → dashboard (decision 2026-10-21). */}
          <Route path="setup" element={<CandidateSetupPage />} />
          <Route element={<RequireCompleteProfile />}>
            <Route path="dashboard" element={<CandidateDashboardPage />} />
            <Route path="profile" element={<CandidateProfilePage />} />
            <Route path="jobs" element={<JobSearchPage />} />
            <Route path="jobs/:id" element={<JobDetailsPage />} />
            <Route path="applications" element={<MyApplicationsPage />} />
            <Route path="applications/:id" element={<CandidateApplicationPage />} />
            <Route path="applications/:id/feedback" element={<FeedbackPage />} />
            <Route path="saved-jobs" element={<SavedJobsPage />} />
          </Route>
        </Route>
        <Route path="employer" element={<ProtectedRoute role="employer" />}>
          <Route path="dashboard" element={<EmployerDashboardPage />} />
          <Route path="company" element={<CompanyProfilePage />} />
          <Route path="jobs" element={<PostingsPage />} />
          <Route path="jobs/new" element={<PostingFormPage />} />
          <Route path="jobs/:id/edit" element={<PostingFormPage />} />
          <Route path="jobs/:id/applicants" element={<ApplicantsPage />} />
          <Route path="applications/:id" element={<EmployerApplicationPage />} />
          <Route path="trust-score" element={<EmployerTrustScorePage />} />
        </Route>
        <Route path="admin" element={<ProtectedRoute role="admin" />}>
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="employers" element={<AdminEmployersPage />} />
          <Route path="employers/:id" element={<AdminEmployerPage />} />
          <Route path="job-postings" element={<AdminPostingsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="feedback" element={<AdminFeedbackPage />} />
          <Route path="master-data" element={<AdminMasterDataPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="account" element={<AccountPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
