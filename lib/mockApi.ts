
import { Lead, SiteAnalytics } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const generateUUID = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  }
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

/**
 * FETCH: LEADS (Supabase Priority)
 */
export const getLeads = async (): Promise<Lead[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('audit_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) return data as Lead[];
    console.warn('Supabase Fetch Node Offline, falling back to local.');
  }
  return getLocalData('avartah_audit_submissions');
};

/**
 * FETCH: ANALYTICS (Supabase Priority)
 */
export const getAnalytics = async (): Promise<SiteAnalytics[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('site_analytics')
      .select('*')
      .order('session_start', { ascending: false });

    if (!error && data) return data as SiteAnalytics[];
  }
  return getLocalData('avartah_site_analytics_log');
};

/**
 * SAVE: LEAD DATA
 */
export const saveLead = async (data: any): Promise<any> => {
  const newLead = {
    session_id: data.session_id,
    target_url: data.target_url,
    user_email: data.user_email,
    user_phone: data.user_phone,
    revenue_tier: data.revenue_tier,
    core_problem: data.core_problem || "PENDING_ANALYSIS",
    cta_source: data.cta_source || 'direct',
    status: 'pending',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    const { data: saved, error } = await supabase
      .from('audit_submissions')
      .insert([newLead])
      .select()
      .single();
    
    if (!error) return saved;
  }

  // Local Failover
  const localLead = { id: generateUUID(), ...newLead };
  const leads = getLocalData('avartah_audit_submissions');
  setLocalData('avartah_audit_submissions', [localLead, ...leads]);
  return localLead;
};

/**
 * SAVE: SESSION BOOKING
 */
export const saveBooking = async (data: any): Promise<any> => {
  const bookingEntry = {
    ...data,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    const { data: saved, error } = await supabase
      .from('session_bookings')
      .insert([bookingEntry])
      .select()
      .single();
    if (!error) return saved;
  }

  const bookings = getLocalData('avartah_session_bookings');
  setLocalData('avartah_session_bookings', [bookingEntry, ...bookings]);
  return bookingEntry;
};

/**
 * UPDATE: LEAD STATUS
 */
export const updateLeadStatus = async (id: string, status: Lead['status']): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('audit_submissions')
      .update({ status })
      .match({ id });
    if (!error) return;
  }
  
  const leads = getLocalData('avartah_audit_submissions').map((l: any) => 
    l.id === id ? { ...l, status } : l
  );
  setLocalData('avartah_audit_submissions', leads);
};

/**
 * DELETE: LEAD RECORD
 */
export const deleteLead = async (id: string): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('audit_submissions')
      .delete()
      .match({ id });
    if (!error) return;
  }
  
  const leads = getLocalData('avartah_audit_submissions').filter((l: any) => l.id !== id);
  setLocalData('avartah_audit_submissions', leads);
};
