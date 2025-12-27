
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

const saveLocalLead = (lead: Lead) => {
  const leads = getLocalLeads();
  localStorage.setItem('avartah_audit_submissions', JSON.stringify([lead, ...leads]));
};

const saveLocalBooking = (booking: any) => {
  const saved = localStorage.getItem('avartah_session_bookings');
  const bookings = saved ? JSON.parse(saved) : [];
  localStorage.setItem('avartah_session_bookings', JSON.stringify([booking, ...bookings]));
};

export const getLeads = async (): Promise<Lead[]> => {
  if (!isSupabaseConfigured) {
    return getLocalLeads();
  }

  try {
    const { data, error } = await supabase
      .from('audit_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Lead[];
  } catch (err) {
    console.warn('Supabase Fetch Failed, falling back to LocalStorage:', err);
    return getLocalLeads();
  }
};

export const getAnalytics = async (): Promise<SiteAnalytics[]> => {
  if (!isSupabaseConfigured) {
    return getLocalAnalytics();
  }

  try {
    const { data, error } = await supabase
      .from('site_analytics')
      .select('*')
      .order('session_start', { ascending: false });

    if (error) throw error;
    return data as SiteAnalytics[];
  } catch (err) {
    console.warn('Supabase Analytics Fetch Failed:', err);
    return getLocalAnalytics();
  }
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

  try {
    const { data: savedData, error } = await supabase
      .from('audit_submissions')
      .insert([newLead])
      .select()
      .single();

    if (error) throw error;
    return savedData;
  } catch (err) {
    const localLead: Lead = {
      id: generateUUID(),
      ...newLead,
      status: 'pending',
      created_at: new Date().toISOString()
    } as Lead;
    saveLocalLead(localLead);
    return localLead;
  }
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

  try {
    const { data: savedData, error } = await supabase
      .from('session_bookings')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return savedData;
  } catch (err) {
    const localBooking = {
      id: generateUUID(),
      ...data,
      created_at: new Date().toISOString()
    };
    saveLocalBooking(localBooking);
    return localBooking;
  }
};

export const updateLeadStatus = async (id: string, status: Lead['status']): Promise<void> => {
  if (!isSupabaseConfigured) {
    const leads = getLocalLeads().map(l => l.id === id ? { ...l, status } : l);
    localStorage.setItem('avartah_audit_submissions', JSON.stringify(leads));
    return;
  }

  try {
    const { error } = await supabase
      .from('audit_submissions')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Update Status Failed:', err);
  }
};

export const deleteLead = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) {
    const leads = getLocalLeads().filter(l => l.id !== id);
    localStorage.setItem('avartah_audit_submissions', JSON.stringify(leads));
    return;
  }

  try {
    const { error } = await supabase
      .from('audit_submissions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Delete Lead Failed:', err);
  }
};
