
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

const getLocalData = (key: string) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const setLocalData = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) { console.error('Local Storage Fault:', e); }
};

let projectsCache: Project[] | null = null;

/**
 * FETCH: PROJECTS
 */
export const getProjects = async (): Promise<Project[]> => {
  if (projectsCache) return projectsCache;

  let apiProjects: Project[] = [];
  try {
    const response = await fetch('/api/projects');
    if (response.ok) {
      apiProjects = await response.json();
    }
  } catch (e) {
    console.error('API Fetch Error (Projects):', e);
  }
  
  const localProjects = getLocalData('avartah_projects') as Project[];
  
  // Merge, preferring API projects
  const merged = [...apiProjects];
  const apiIds = new Set(apiProjects.map(p => p.id));
  
  for (const lp of localProjects) {
    if (!apiIds.has(lp.id)) {
      merged.push(lp);
      // Sync to backend in the background
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lp)
      }).catch(() => {});
    }
  }
  
  // Sort by created_at descending
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  projectsCache = merged;
  return merged;
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

  projectsCache = null;

  // Always save to local storage as a backup
  const projects = getLocalData('avartah_projects');
  const index = projects.findIndex((p: any) => p.id === newProject.id);
  if (index >= 0) {
    projects[index] = newProject;
  } else {
    projects.unshift(newProject);
  }
  setLocalData('avartah_projects', projects);

  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    });
    if (response.ok) return newProject;
  } catch (e) {
    console.error('API Save Error (Project):', e);
  }

  return newProject;
};

/**
 * DELETE: PROJECT
 */
export const deleteProject = async (id: string): Promise<void> => {
  projectsCache = null;

  const projects = getLocalData('avartah_projects').filter((p: any) => p.id !== id);
  setLocalData('avartah_projects', projects);

  try {
    const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (response.ok) return;
  } catch (e) {
    console.error('API Delete Error (Project):', e);
  }
};

/**
 * FETCH: LEADS
 */
export const getLeads = async (): Promise<Lead[]> => {
  let apiLeads: Lead[] = [];
  try {
    const response = await fetch('/api/leads');
    if (response.ok) {
      apiLeads = await response.json();
    }
  } catch (e) {
    console.error('API Fetch Error (Leads):', e);
  }
  
  const localLeads = getLocalData('avartah_audit_submissions') as Lead[];
  const merged = [...apiLeads];
  const apiIds = new Set(apiLeads.map(l => l.id));
  
  for (const ll of localLeads) {
    if (!apiIds.has(ll.id)) {
      merged.push(ll);
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ll)
      }).catch(() => {});
    }
  }
  
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return merged;
};

/**
 * FETCH: ANALYTICS
 */
export const getAnalytics = async (): Promise<SiteAnalytics[]> => {
  let apiAnalytics: SiteAnalytics[] = [];
  try {
    const response = await fetch('/api/analytics');
    if (response.ok) {
      apiAnalytics = await response.json();
    }
  } catch (e) {
    console.error('API Fetch Error (Analytics):', e);
  }
  
  const localAnalytics = getLocalData('avartah_site_analytics_log') as SiteAnalytics[];
  const merged = [...apiAnalytics];
  const apiIds = new Set(apiAnalytics.map(a => a.visitor_id));
  
  for (const la of localAnalytics) {
    if (!apiIds.has(la.visitor_id)) {
      merged.push(la);
    }
  }
  
  merged.sort((a, b) => new Date(b.session_start).getTime() - new Date(a.session_start).getTime());
  return merged;
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

  const leads = getLocalData('avartah_audit_submissions');
  setLocalData('avartah_audit_submissions', [newLead, ...leads]);

  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLead)
    });
    if (response.ok) return newLead;
  } catch (e) {
    console.error('API Save Error (Lead):', e);
  }

  return newLead;
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

  const bookings = getLocalData('avartah_session_bookings');
  setLocalData('avartah_session_bookings', [bookingEntry, ...bookings]);

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingEntry)
    });
    if (response.ok) return bookingEntry;
  } catch (e) {
    console.error('API Save Error (Booking):', e);
  }

  return bookingEntry;
};

/**
 * UPDATE: LEAD DATA
 */
export const updateLead = async (id: string, updates: Partial<Lead>): Promise<void> => {
  const leads = getLocalData('avartah_audit_submissions').map((l: any) => 
    l.id === id ? { ...l, ...updates } : l
  );
  setLocalData('avartah_audit_submissions', leads);

  try {
    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (response.ok) return;
  } catch (e) {
    console.error('API Update Error (Lead):', e);
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
  const leads = getLocalData('avartah_audit_submissions').filter((l: any) => l.id !== id);
  setLocalData('avartah_audit_submissions', leads);

  try {
    const response = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    if (response.ok) return;
  } catch (e) {
    console.error('API Delete Error (Lead):', e);
  }
};
