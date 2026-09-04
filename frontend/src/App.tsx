import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import SupportWidget from './components/SupportWidget';
import { PublicOnlyRoute, RequireAdmin, RequireAuth, RequireSubscription } from './lib/auth';

const AdminCreatorsPage = lazy(() => import('./components/AdminCreatorsPage'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const ProjectPage = lazy(() => import('./components/ProjectPage'));
const ProjectRenderPage = lazy(() => import('./components/ProjectRenderPage'));
const CampaignWorkspacePage = lazy(() => import('./components/CampaignWorkspacePage'));
const ProjectsPage = lazy(() => import('./components/ProjectsPage'));
const BillingPage = lazy(() => import('./components/BillingPage'));
const AdminSupportPage = lazy(() => import('./components/AdminSupportPage'));
const AdminDashboardPage = lazy(() => import('./components/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./components/AdminUsersPage'));
const AdminProjectsPage = lazy(() => import('./components/AdminProjectsPage'));
const AdminProjectDetailPage = lazy(() => import('./components/AdminProjectDetailPage'));
const AdminUserDetailPage = lazy(() => import('./components/AdminUserDetailPage'));
const AdminJobsPage = lazy(() => import('./components/AdminJobsPage'));
const OnboardingPage = lazy(() => import('./components/OnboardingPage'));

function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#fafafc] text-sm font-medium text-[#686872]">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <><Suspense fallback={<RouteFallback />}><Routes>
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
          <Route path="/projects/:id/demos" element={<CampaignWorkspacePage />} />
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
    </Routes></Suspense><SupportWidget /></>
  );
}
