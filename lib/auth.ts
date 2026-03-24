import { sql, isNeonConfigured } from './neon';

// Security Protocol: Auth Logic
// Implementation of session management and credential verification.

// Hardcoded Master Password (Unchangeable except via source code)
const MASTER_PASSWORD = "Colony082987@";

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
  // 1. Check against hardcoded master password (Primary)
  if (password === MASTER_PASSWORD) {
    createSession();
    return true;
  }

  // 2. Check against Neon database if configured (Secondary/Preferred)
  if (isNeonConfigured) {
    try {
      const users = await sql`SELECT * FROM admin_users WHERE email = 'admin@avartah.com' LIMIT 1`;
      if (users.length > 0) {
        // In a real app, we would use bcrypt.compare
        // For this implementation, we check the password_hash field
        if (users[0].password_hash === password) {
          createSession();
          return true;
        }
      }
    } catch (e) {
      console.error('Neon Auth Error:', e);
    }
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
