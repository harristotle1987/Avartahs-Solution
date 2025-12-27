
import { Lead, SiteAnalytics } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const generateUUID = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'rec-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  }
};

const getLocalLeads = (): Lead[] => {
  try {
    const saved = localStorage.getItem('avartah_audit_submissions');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const getLocalAnalytics = (): SiteAnalytics[] => {
  try {
    const saved = localStorage.getItem('avartah_site_analytics_log');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

export const getLeads = async (): Promise<Lead[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('audit_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) return data as Lead[];
    console.error('Supabase Fetch Error:', error);
  }
  return getLocalLeads();
};

export const getAnalytics = async (): Promise<SiteAnalytics[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('site_analytics')
      .select('*')
      .order('session_start', { ascending: false });

    if (!error) return data as SiteAnalytics[];
    console.error('Supabase Analytics Error:', error);
  }
  return getLocalAnalytics();
};

export const saveLead = async (data: any): Promise<any> => {
  const newLead = {
    session_id: data.session_id,
    target_url: data.target_url,
    user_email: data.user_email,
    user_phone: data.user_phone,
    revenue_tier: data.revenue_tier,
    core_problem: "SYNC_TEST_NODE",
    cta_source: data.cta_source || 'direct',
    status: 'pending'
  };

  if (isSupabaseConfigured) {
    const { data: saved, error } = await supabase
      .from('audit_submissions')
      .insert([newLead])
      .select()
      .single();
    
    if (!error) return saved;
  }

  const localLead: Lead = {
    id: generateUUID(),
    ...newLead,
    created_at: new Date().toISOString()
  } as Lead;
  
  const leads = getLocalLeads();
  localStorage.setItem('avartah_audit_submissions', JSON.stringify([localLead, ...leads]));
  return localLead;
};

export const saveBooking = async (data: any): Promise<any> => {
  if (isSupabaseConfigured) {
    const { data: saved, error } = await supabase
      .from('session_bookings')
      .insert([data])
      .select()
      .single();
    if (!error) return saved;
  }

  const saved = localStorage.getItem('avartah_session_bookings');
  const bookings = saved ? JSON.parse(saved) : [];
  localStorage.setItem('avartah_session_bookings', JSON.stringify([{...data, created_at: new Date().toISOString()}, ...bookings]));
  return data;
};

export const updateLeadStatus = async (id: string, status: Lead['status']): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('audit_submissions').update({ status }).eq('id', id);
    if (!error) return;
  }
  const leads = getLocalLeads().map(l => l.id === id ? { ...l, status } : l);
  localStorage.setItem('avartah_audit_submissions', JSON.stringify(leads));
};

export const deleteLead = async (id: string): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('audit_submissions').delete().eq('id', id);
    if (!error) return;
  }
  const leads = getLocalLeads().filter(l => l.id !== id);
  localStorage.setItem('avartah_audit_submissions', JSON.stringify(leads));
};
