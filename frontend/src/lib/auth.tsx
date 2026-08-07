import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api } from './api';
import { setAuthTokenProvider } from './api';
import type { AuthUser } from '../types/domain';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-[#fcfcfc] text-sm text-[#666666]">Loading...</div>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useClerkAuth();
  const { signOut } = useClerk();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();

  useEffect(() => setAuthTokenProvider(getToken), [getToken]);

  const status: AuthStatus = !isAuthLoaded || !isUserLoaded
    ? 'loading'
    : isSignedIn
      ? 'authenticated'
      : 'unauthenticated';

  const user = useMemo<AuthUser | null>(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
      name: clerkUser.fullName,
      role: clerkUser.publicMetadata.role === 'ADMIN' ? 'ADMIN' : 'USER',
    };
  }, [clerkUser]);

  return (
    <AuthContext.Provider value={{ status, user, logout: () => signOut({ redirectUrl: '/' }) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
}

export function RequireSubscription() {
  const { status, user } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (user?.role === 'ADMIN') {
      setHasAccess(true);
      setChecking(false);
      return;
    }
    let active = true;
    api<{ hasAccess: boolean }>('/billing/status')
      .then((result) => { if (active) setHasAccess(result.hasAccess); })
      .catch(() => { if (active) setHasAccess(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [status, user?.role]);

  if (status === 'loading' || checking) return <LoadingScreen />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (!hasAccess) return <Navigate to="/billing" replace />;
  return <Outlet />;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }
  return <>{children}</>;
}
