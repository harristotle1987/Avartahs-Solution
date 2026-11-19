// Security Protocol: Auth Logic using HttpOnly Cookies, Bearer Auth, CSRF Double-Submit, and Server Validation

let cachedAuth = false;
let cachedCsrfToken: string | null = null;

export const getCsrfToken = (): string | null => {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      cachedCsrfToken = decoded;
      return decoded;
    }
  }
  return cachedCsrfToken;
};

export const setCsrfToken = (token?: string | null): void => {
  if (token && typeof token === 'string' && token.trim().length >= 16) {
    cachedCsrfToken = token.trim();
  }
};

export const buildAuthHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra
  };
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }
  return headers;
};

export const clearClientAuthCaches = (): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('avartah_admin_email');
    localStorage.removeItem('avartah_admin_role');
    localStorage.removeItem('avartah_session_expiry');
    localStorage.removeItem('avartah_active_tenant_id');
  }
};

export const checkSession = async (): Promise<{ authenticated: boolean; role?: string; email?: string; csrfToken?: string | null }> => {
  try {
    const res = await fetch('/api/auth/session', { 
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    setCsrfToken(res.headers.get('x-csrf-token'));

    if (res.ok) {
      const data = await res.json();
      setCsrfToken(data?.csrfToken);
      cachedAuth = !!data.authenticated;
      if (cachedAuth && data.user) {
        if (typeof localStorage !== 'undefined') {
          const prevEmail = localStorage.getItem('avartah_admin_email');
          if (prevEmail && data.user.email && prevEmail.toLowerCase() !== String(data.user.email).toLowerCase()) {
            localStorage.removeItem('avartah_active_tenant_id');
          }
          if (data.user.role) localStorage.setItem('avartah_admin_role', data.user.role);
          if (data.user.email) localStorage.setItem('avartah_admin_email', data.user.email);
        }
        return { authenticated: true, role: data.user.role, email: data.user.email, csrfToken: getCsrfToken() };
      }
      clearClientAuthCaches();
      return { authenticated: false, csrfToken: getCsrfToken() };
    }
    cachedAuth = false;
    clearClientAuthCaches();
    return { authenticated: false, csrfToken: getCsrfToken() };
  } catch (e) {
    cachedAuth = false;
    return { authenticated: false };
  }
};

export const ensureCsrfToken = async (): Promise<string | null> => {
  const existing = getCsrfToken();
  if (existing) return existing;
  await checkSession();
  return getCsrfToken();
};

export const isAuthenticated = (): boolean => {
  return cachedAuth;
};

export const login = async (email: string, password: string): Promise<{ success: boolean; user?: { email: string; role: string } }> => {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Accept': 'application/json' }),
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ email: email.trim(), password })
    });

    setCsrfToken(res.headers.get('x-csrf-token'));
    const data = await res.json().catch(() => null);
    setCsrfToken(data?.csrfToken);

    if (!res.ok || !data?.success) {
      cachedAuth = false;
      const errorMsg = data?.error || 'Invalid email or password';
      throw new Error(errorMsg);
    }

    clearClientAuthCaches();
    if (typeof localStorage !== 'undefined') {
      if (data.user?.email) localStorage.setItem('avartah_admin_email', data.user.email);
      if (data.user?.role) localStorage.setItem('avartah_admin_role', data.user.role);
    }

    cachedAuth = true;
    return { success: true, user: data.user };
  } catch (e: any) {
    cachedAuth = false;
    throw e;
  }
};

export const register = async (email: string, password: string): Promise<{ success: boolean; user?: { email: string; role: string } }> => {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Accept': 'application/json' }),
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ email: email.trim(), password })
    });

    setCsrfToken(res.headers.get('x-csrf-token'));
    const data = await res.json().catch(() => null);
    setCsrfToken(data?.csrfToken);

    if (!res.ok || !data?.success) {
      cachedAuth = false;
      const errorMsg = data?.error || 'Registration failed';
      throw new Error(errorMsg);
    }

    clearClientAuthCaches();
    if (typeof localStorage !== 'undefined') {
      if (data.user?.email) localStorage.setItem('avartah_admin_email', data.user.email);
      if (data.user?.role) localStorage.setItem('avartah_admin_role', data.user.role);
    }

    cachedAuth = true;
    return { success: true, user: data.user };
  } catch (e: any) {
    cachedAuth = false;
    throw e;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await ensureCsrfToken();
    await fetch('/api/auth/logout', { 
      method: 'POST', 
      credentials: 'include',
      cache: 'no-store',
      headers: buildAuthHeaders()
    });
  } catch (e) {
    console.error('Logout error:', e);
  } finally {
    cachedAuth = false;
    cachedCsrfToken = null;
    clearClientAuthCaches();
    window.location.href = '/';
  }
};

export const requestPasswordReset = async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders(),
      body: JSON.stringify({ email: email.trim() })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { success: false, error: data?.error || 'Password reset request failed' };
    }
    return { success: true, message: data?.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error occurred' };
  }
};

export const resetPassword = async (token: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders(),
      body: JSON.stringify({ token: token.trim(), newPassword })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { success: false, error: data?.error || 'Password reset failed' };
    }
    return { success: true, message: data?.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error occurred' };
  }
};


