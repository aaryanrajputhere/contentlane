import { Navigate, Route, Routes } from 'react-router-dom';
import AdminCreatorsPage from './components/AdminCreatorsPage';
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import ProjectPage from './components/ProjectPage';
import ProjectRenderPage from './components/ProjectRenderPage';
import CampaignWorkspacePage from './components/CampaignWorkspacePage';
import ProjectsPage from './components/ProjectsPage';
import BillingPage from './components/BillingPage';
import AdminSupportPage from './components/AdminSupportPage';
import AdminDashboardPage from './components/AdminDashboardPage';
import AdminUsersPage from './components/AdminUsersPage';
import AdminProjectsPage from './components/AdminProjectsPage';
import AdminProjectDetailPage from './components/AdminProjectDetailPage';
import AdminUserDetailPage from './components/AdminUserDetailPage';
import AdminJobsPage from './components/AdminJobsPage';
import SupportWidget from './components/SupportWidget';
import OnboardingPage from './components/OnboardingPage';
import { PublicOnlyRoute, RequireAdmin, RequireAuth, RequireSubscription } from './lib/auth';

export default function App() {
  return (
    <><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={(
          <PublicOnlyRoute>
            <AuthPage mode="login" />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="/signup"
        element={(
          <PublicOnlyRoute>
            <AuthPage mode="signup" />
          </PublicOnlyRoute>
        )}
      />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/projects/:id/hooks" element={<ProjectPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/billing/success" element={<BillingPage success />} />
        <Route element={<RequireSubscription />}>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<CampaignWorkspacePage />} />
          <Route path="/projects/:id/brand" element={<CampaignWorkspacePage />} />
          <Route path="/projects/:id/content" element={<CampaignWorkspacePage />} />
          <Route path="/projects/:id/generate" element={<CampaignWorkspacePage />} />
          <Route path="/projects/:id/batches" element={<Navigate to="content" replace />} />
          <Route path="/projects/:id/workflow" element={<ProjectPage />} />
          <Route path="/projects/:id/demo" element={<ProjectPage />} />
          <Route path="/projects/:id/creator" element={<ProjectPage />} />
          <Route path="/projects/:id/export" element={<ProjectPage />} />
          <Route path="/projects/:id/render" element={<ProjectRenderPage />} />
          <Route path="/projects/:id/dashboard" element={<CampaignWorkspacePage />} />
        </Route>
      </Route>
      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
        <Route path="/admin/projects" element={<AdminProjectsPage />} />
        <Route path="/admin/projects/:id" element={<AdminProjectDetailPage />} />
        <Route path="/admin/jobs" element={<AdminJobsPage />} />
        <Route path="/admin/support" element={<AdminSupportPage />} />
        <Route path="/admin/creators" element={<AdminCreatorsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes><SupportWidget /></>
  );
}
