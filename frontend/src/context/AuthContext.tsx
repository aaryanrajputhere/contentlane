import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, post } from '../lib/api';
import type { AuthUser } from '../types/domain';

interface AuthValue { user: AuthUser | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null); const [loading, setLoading] = useState(true);
  const refresh = async () => { try { setUser((await api<{ user: AuthUser }>('/auth/me')).user); } catch { setUser(null); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const value = useMemo(() => ({ user, loading, refresh, logout: async () => { await post('/auth/logout'); setUser(null); } }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is missing'); return value; };
