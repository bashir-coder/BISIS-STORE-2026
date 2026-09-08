import { createContext, useContext, useState, useEffect } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  role?: string;
  persona_id?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<unknown>;
  loginWithGoogle: () => Promise<unknown>;
  logout: () => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<unknown>;
  updateProfile: (newData: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const mapUser = (authUser: SupabaseUser): AuthUser => ({
    id: authUser.id,
    email: authUser.email,
    fullName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
    avatarUrl: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '',
    role: authUser.app_metadata?.role || authUser.user_metadata?.role || 'client',
    persona_id: authUser.user_metadata?.persona_id || null,
  });

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapUser(session.user));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // تحقق أولي
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(mapUser(session.user));
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const loginWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('bisis_user');
    localStorage.removeItem('bisis_token');
  };

  const register = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  };

  const updateProfile = (newData: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...newData } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        logout,
        register,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
