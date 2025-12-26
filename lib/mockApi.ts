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
  const saved = localStorage.getItem('avartah_audit_submissions');
  return saved ? JSON.parse(saved) : [];
};

const getLocalBookings = (): any[] => {
  const saved = localStorage.getItem('avartah_session_bookings');
  return saved ? JSON.parse(saved) : [];
};

const getLocalAnalytics = (): SiteAnalytics[] => {
  const saved = localStorage.getItem('avartah_site_analytics_log');
  return saved ? JSON.parse(saved) : [];
};

const saveLocalLead = (lead: Lead) => {
  const leads = getLocalLeads();
  localStorage.setItem('avartah_audit_submissions', JSON.stringify([lead, ...leads]));
};

const saveLocalBooking = (booking: any) => {
  const bookings = getLocalBookings();
  localStorage.setItem('avartah_session_bookings', JSON.stringify([booking, ...bookings]));
};

export const getLeads = async (): Promise<Lead[]> => {
  if (!isSupabaseConfigured) {
    return getLocalLeads();
  }

  const { data, error } = await supabase
    .from('audit_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase Error (getLeads):', error.message);
    return getLocalLeads();
  }

  return data as Lead[];
};

export const getAnalytics = async (): Promise<SiteAnalytics[]> => {
  if (!isSupabaseConfigured) {
    return getLocalAnalytics();
  }

  const { data, error } = await supabase
    .from('site_analytics')
    .select('*')
    .order('session_start', { ascending: false });

  if (error) {
    console.error('Supabase Error (getAnalytics):', error.message);
    return getLocalAnalytics();
  }

  return data as SiteAnalytics[];
};

export const saveLead = async (data: any): Promise<any> => {
  const newLead = {
    session_id: data.session_id,
    target_url: data.target_url,
    user_email: data.user_email,
    user_phone: data.user_phone,
    revenue_tier: data.revenue_tier,
    core_problem: data.core_problem,
    cta_source: data.cta_source,
    status: 'pending'
  };

  if (!isSupabaseConfigured) {
    const localLead: Lead = {
      id: generateUUID(),
      ...newLead,
      status: 'pending',
      created_at: new Date().toISOString()
    } as Lead;
    saveLocalLead(localLead);
    return localLead;
  }

  const { data: savedData, error } = await supabase
    .from('audit_submissions')
    .insert([newLead])
    .select()
    .single();

  if (error) {
    console.error('Supabase Error (saveLead):', error.message);
    throw new Error(error.message);
  }

  return savedData;
};

export const saveBooking = async (data: { email: string, phone: string, date: string, time: string, session_id: string }): Promise<any> => {
  if (!isSupabaseConfigured) {
    const localBooking = {
      id: generateUUID(),
      ...data,
      created_at: new Date().toISOString()
    };
    saveLocalBooking(localBooking);
    return localBooking;
  }

  const { data: savedData, error } = await supabase
    .from('session_bookings')
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error('Supabase Error (saveBooking):', error.message);
    throw new Error(error.message);
  }

  return savedData;
};

export const updateLeadStatus = async (id: string, status: Lead['status']): Promise<void> => {
  if (!isSupabaseConfigured) {
    const leads = getLocalLeads().map(l => l.id === id ? { ...l, status } : l);
    localStorage.setItem('avartah_audit_submissions', JSON.stringify(leads));
    return;
  }

  const { error } = await supabase
    .from('audit_submissions')
    .update({ status })
    .eq('id', id);

  if (error) console.error('Supabase Error (updateStatus):', error.message);
};

export const deleteLead = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) {
    const leads = getLocalLeads().filter(l => l.id !== id);
    localStorage.setItem('avartah_audit_submissions', JSON.stringify(leads));
    return;
  }

  const { error } = await supabase
    .from('audit_submissions')
    .delete()
    .eq('id', id);

  if (error) console.error('Supabase Error (deleteLead):', error.message);
};