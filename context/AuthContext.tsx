import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { checkSession, logout as authLogout } from '../lib/auth';
import { LoginModal } from '../components/LoginModal';

export interface UserSession {
  email?: string;
  role?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: UserSession | null;
  isVerifying: boolean;
  isLoginModalOpen: boolean;
  openLogin: (options?: { returnTo?: string; mode?: 'login' | 'register' | 'forgot' }) => void;
  closeLogin: () => void;
  refreshAuth: () => Promise<{ authenticated: boolean; role?: string; email?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [user, setUser] = useState<UserSession | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);

  // Single application-wide LoginModal state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginReturnTo, setLoginReturnTo] = useState<string | undefined>(undefined);
  const [loginMode, setLoginMode] = useState<'login' | 'register' | 'forgot'>('login');

  const refreshAuth = useCallback(async () => {
    try {
      const auth = await checkSession();
      // Strict Boolean verification: checkSession returns an object with `authenticated` boolean
      if (auth && auth.authenticated) {
        setIsAuthenticated(true);
        setIsAdmin(auth.role === 'admin');
        setUser({ email: auth.email, role: auth.role });
        return auth;
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setUser(null);
        return { authenticated: false };
      }
    } catch (err) {
      console.warn('[AuthContext] Verification failed:', err);
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUser(null);
      return { authenticated: false };
    } finally {
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const openLogin = useCallback((options?: { returnTo?: string; mode?: 'login' | 'register' | 'forgot' }) => {
    setLoginReturnTo(options?.returnTo);
    if (options?.mode) setLoginMode(options.mode);
    setIsLoginModalOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setIsLoginModalOpen(false);
    setLoginReturnTo(undefined);
  }, []);

  const handleLoginSuccess = useCallback(async () => {
    setIsLoginModalOpen(false);
    await refreshAuth();
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    setIsVerifying(true);
    try {
      await authLogout();
    } finally {
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUser(null);
      setIsVerifying(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAdmin,
        user,
        isVerifying,
        isLoginModalOpen,
        openLogin,
        closeLogin,
        refreshAuth,
        logout,
      }}
    >
      {children}
      {/* Sole, Authoritative LoginModal for the Entire Application */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLogin}
        onSuccess={handleLoginSuccess}
        defaultMode={loginMode}
        returnTo={loginReturnTo}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
