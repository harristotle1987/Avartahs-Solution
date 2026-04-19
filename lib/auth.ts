import { apiLogin } from './api';

// Security Protocol: Auth Logic
// Implementation of session management and credential verification.

export const isAuthenticated = (): boolean => {
  try {
    const session = localStorage.getItem('avartah_admin_session');
    const expiry = localStorage.getItem('avartah_session_expiry');
    
    if (!session || !expiry) return false;
    
    // Check if session has expired (2 hour TTL)
    if (Date.now() > parseInt(expiry)) {
      logout();
      return false;
    }
    
    return session === 'active_authenticated_secure';
  } catch (e) {
    return false;
  }
};

export const login = async (password: string): Promise<boolean> => {
  // Check against server-side auth (Neon or Master Password)
  try {
    const success = await apiLogin(password);
    if (success) {
      createSession();
      return true;
    }
  } catch (e) {
    console.error('API Auth Error:', e);
  }

  return false;
};

const createSession = () => {
  localStorage.setItem('avartah_admin_session', 'active_authenticated_secure');
  // Set 2 hour expiry for the session
  const twoHours = 2 * 60 * 60 * 1000;
  localStorage.setItem('avartah_session_expiry', (Date.now() + twoHours).toString());
};

export const logout = (): void => {
  localStorage.removeItem('avartah_admin_session');
  localStorage.removeItem('avartah_session_expiry');
};
