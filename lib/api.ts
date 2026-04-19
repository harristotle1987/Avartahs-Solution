
import { Lead, SiteAnalytics, Project } from '../types';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * FETCH: PROJECTS
 */
export const getProjects = async (limit: number = 50, offset: number = 0): Promise<Project[]> => {
  console.log('[Frontend] Fetching projects...');
  try {
    const response = await fetch(`/api/projects?limit=${limit}&offset=${offset}`);
    console.log('[Frontend] Projects response status:', response.status);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  } catch (e) {
    console.error('API Fetch Error (Projects):', e);
    return [];
  }
};

/**
 * FETCH: PROJECT COUNT
 */
export const getProjectsCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/projects/count');
    if (response.ok) {
      const data = await response.json();
      return parseInt(data.count) || 0;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

/**
 * SAVE: PROJECT
 */
export const saveProject = async (project: Partial<Project>): Promise<Project> => {
  const newProject = {
    ...project,
    id: project.id || generateUUID(),
    created_at: project.created_at || new Date().toISOString(),
    media: project.media || [],
    tags: project.tags || [],
  } as Project;

  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    });
    if (response.ok) return newProject;
    throw new Error('Failed to save project');
  } catch (e) {
    console.error('API Save Error (Project):', e);
    throw e;
  }
};

/**
 * DELETE: PROJECT
 */
export const deleteProject = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete project');
  } catch (e) {
    console.error('API Delete Error (Project):', e);
    throw e;
  }
};

/**
 * AUTH: LOGIN
 */
export const apiLogin = async (password: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return response.ok;
  } catch (e) {
    console.error('API Auth Error:', e);
    return false;
  }
};

/**
 * ANALYTICS: INIT
 */
export const initAnalytics = async (session: any): Promise<void> => {
  try {
    await fetch('/api/analytics/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
  } catch (e) {
    console.warn('Analytics Init Failed (Backend):', e);
  }
};

/**
 * ANALYTICS: SYNC
 */
export const syncAnalytics = async (session: any): Promise<void> => {
  try {
    await fetch('/api/analytics/sync', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
  } catch (e) {
    console.warn('Analytics Sync Failed (Backend):', e);
  }
};

/**
 * FETCH: DB HEALTH
 */
export const getDbHealth = async (): Promise<{ status: string; error?: string; isIpBlocked?: boolean }> => {
  try {
    const response = await fetch('/api/db-health');
    return await response.json();
  } catch (e) {
    return { status: 'error', error: 'Network error' };
  }
};

/**
 * FETCH: ADMIN SUMMARY (Aggregated Stats)
 */
export const getAdminSummary = async (): Promise<{ 
  analytics: { total_visitors: number; avg_duration: number; recent_visitors: number };
  revenue: number;
}> => {
  try {
    const response = await fetch('/api/admin/summary');
    if (response.ok) return await response.json();
    throw new Error('Summary fetch failed');
  } catch (e) {
    return { 
      analytics: { total_visitors: 0, avg_duration: 0, recent_visitors: 0 }, 
      revenue: 0 
    };
  }
};

/**
 * FETCH: LEADS
 */
export const getLeads = async (limit: number = 100, offset: number = 0): Promise<Lead[]> => {
  try {
    const response = await fetch(`/api/leads?limit=${limit}&offset=${offset}`);
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to fetch leads');
  } catch (e) {
    console.error('API Fetch Error (Leads):', e);
    return [];
  }
};

/**
 * FETCH: LEADS COUNT
 */
export const getLeadsCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/leads/count');
    if (response.ok) {
      const data = await response.json();
      return parseInt(data.count) || 0;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

/**
 * FETCH: ANALYTICS
 */
export const getAnalytics = async (limit: number = 100, offset: number = 0): Promise<SiteAnalytics[]> => {
  try {
    const response = await fetch(`/api/analytics?limit=${limit}&offset=${offset}`);
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to fetch analytics');
  } catch (e) {
    console.error('API Fetch Error (Analytics):', e);
    return [];
  }
};

/**
 * FETCH: ANALYTICS COUNT
 */
export const getAnalyticsCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/analytics/count');
    if (response.ok) {
      const data = await response.json();
      return parseInt(data.count) || 0;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

/**
 * SAVE: LEAD DATA
 */
export const saveLead = async (data: any): Promise<any> => {
  const newLead = {
    id: generateUUID(),
    session_id: data.session_id,
    target_url: data.target_url,
    user_email: data.user_email,
    user_phone: data.user_phone,
    revenue_tier: data.revenue_tier,
    core_problem: data.core_problem || "Initial scan pending",
    cta_source: data.cta_source || 'direct v4',
    status: 'pending',
    created_at: new Date().toISOString()
  };

  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLead)
    });
    if (response.ok) return newLead;
    throw new Error('Failed to save lead');
  } catch (e) {
    console.error('API Save Error (Lead):', e);
    throw e;
  }
};

/**
 * SAVE: SESSION BOOKING
 */
export const saveBooking = async (data: any): Promise<any> => {
  const bookingEntry = {
    id: generateUUID(),
    ...data,
    created_at: new Date().toISOString()
  };

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingEntry)
    });
    if (response.ok) return bookingEntry;
    throw new Error('Failed to save booking');
  } catch (e) {
    console.error('API Save Error (Booking):', e);
    throw e;
  }
};

/**
 * UPDATE: LEAD DATA
 */
export const updateLead = async (id: string, updates: Partial<Lead>): Promise<void> => {
  try {
    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update lead');
  } catch (e) {
    console.error('API Update Error (Lead):', e);
    throw e;
  }
};

/**
 * UPDATE: LEAD STATUS
 */
export const updateLeadStatus = async (id: string, status: Lead['status']): Promise<void> => {
  return updateLead(id, { status });
};

/**
 * DELETE: LEAD RECORD
 */
export const deleteLead = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete lead');
  } catch (e) {
    console.error('API Delete Error (Lead):', e);
    throw e;
  }
};
