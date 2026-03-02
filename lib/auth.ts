
/**
 * Security Protocol: Auth Logic
 * Implementation of session management and credential verification.
 */

// In a production environment, this would verify against a backend or Supabase Auth
const ADMIN_SECRET_HASH = "admin123"; // Placeholder for demo

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

export const login = (password: string): boolean => {
  // Verifying credentials against security protocol
  if (password === ADMIN_SECRET_HASH) {
    localStorage.setItem('avartah_admin_session', 'active_authenticated_secure');
    // Set 2 hour expiry for the session
    const twoHours = 2 * 60 * 60 * 1000;
    localStorage.setItem('avartah_session_expiry', (Date.now() + twoHours).toString());
    return true;
  }
  return false;
};

export const logout = (): void => {
  localStorage.removeItem('avartah_admin_session');
  localStorage.removeItem('avartah_session_expiry');
};
