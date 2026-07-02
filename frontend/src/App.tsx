import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import AdminCreatorsPage from './components/AdminCreatorsPage';
import AdminHooksPage from './components/AdminHooksPage';
import BrandProfile from './components/BrandProfile';
import EditorPage from './components/EditorPage';
import LandingPage from './components/LandingPage';
import ScriptReview from './components/ScriptReview';
import { useAuth } from './context/AuthContext';

function Protected() { const { user, loading } = useAuth(); if (loading) return <div className="min-h-screen bg-[#050505]" />; return user ? <Outlet /> : <Navigate to="/auth" replace />; }
function AdminProtected() { const { user, loading } = useAuth(); if (loading) return <div className="min-h-screen bg-[#050505]" />; return user?.role === 'ADMIN' ? <Outlet /> : <Navigate to="/" replace />; }

export default function App() {
  const navigate = useNavigate(); const { user, refresh, logout } = useAuth();
  return <Routes>
    <Route path="/" element={<LandingPage user={user} onLogout={() => void logout()} onGetStarted={() => navigate(user ? '/' : '/auth')} />} />
    <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage onAuthSuccess={() => { void refresh(); navigate('/'); }} onBack={() => navigate('/')} />} />
    <Route element={<Protected />}>
      <Route path="/campaign/:id/brand-profile" element={<BrandProfile />} />
      <Route path="/campaign/:id/scripts" element={<ScriptReview />} />
      <Route path="/editor/:scriptId" element={<EditorPage />} />
    </Route>
    <Route element={<AdminProtected />}>
      <Route path="/admin/creators" element={<AdminCreatorsPage />} />
      <Route path="/admin/hooks" element={<AdminHooksPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
