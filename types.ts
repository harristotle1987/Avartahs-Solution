
export interface Lead {
  id: string;
  session_id: string;
  target_url: string;
  user_email: string;
  user_phone: string;
  revenue_tier: string;
  core_problem: string;
  cta_source: string;
  status: 'pending' | 'contacted' | 'audit_delivered' | 'closed';
  created_at: string;
  // Behavioral Telemetry
  friction_score?: number;
  is_pricing_sensitive?: boolean;
}

export interface SiteAnalytics {
  visitor_id: string;
  session_start: string;
  duration_seconds: number;
  cta_clicks: Record<string, number>;
  form_progress: number;
  submitted: boolean;
  exit_page: string;
  // Enhanced Telemetry
  step_durations?: Record<number, number>;
  is_pricing_sensitive?: boolean;
  whatsapp_handshake?: boolean;
  calendly_handshake?: boolean;
}

export interface AuditFormData {
  name: string;
  email: string;
  company: string;
  website: string;
  serviceInterest: string;
  budget: string;
  phoneNumber?: string;
}

export enum SectionId {
  Hero = 'hero',
  Services = 'services',
  Process = 'process',
  Audit = 'audit',
  Booking = 'booking'
}
