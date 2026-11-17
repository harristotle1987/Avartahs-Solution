
export type ContactEvidenceSourceType =
  | 'official_site'
  | 'public_directory'
  | 'public_social_profile'
  | 'public_map_listing'
  | 'search_result'
  | 'website_crawl'
  | 'contact_page'
  | 'osm_tag'
  | 'business_listing'
  | 'verified_search';

export type ContactEvidenceStatus =
  | 'FOUND'
  | 'FORMAT_VALID'
  | 'SOURCE_CONFIRMED'
  | 'INDEPENDENTLY_VERIFIED';

export interface Prospect {
  id: string;
  business_name: string;
  category?: string;
  niche?: string;
  location: string;
  address?: string;
  city?: string;
  country?: string;
  contact_info: string;
  phone?: string;
  email?: string;
  website_url?: string | null;
  whatsapp_link?: string | null;
  whatsapp_unconfirmed?: boolean;
  social_profiles?: {
    snapchat?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    [key: string]: string | undefined;
  };
  status: 'NO_WEBSITE' | 'BROKEN_WEBSITE' | 'OUTDATED_WEBSITE' | 'GOOD_WEBSITE' | 'NEEDS_REVIEW' | 'Draft Ready' | 'Draft Opened' | 'Sent' | 'discovered' | 'ready' | 'failed' | 'Ready for Outreach' | 'NEEDS_CONTACT';
  website_quality_category?: 'No website found' | 'Website inaccessible or apparently broken' | 'Website potentially outdated' | 'Website appears functional and current' | 'Assessment inconclusive';
  website_quality_score?: number;
  website_availability?: 'ONLINE' | 'PERSISTENT_FAILURE' | 'TEMPORARILY_UNAVAILABLE' | 'NONE' | 'UNVERIFIED';
  evidence?: string;
  source_url?: string;
  source?: string;
  source_provenance?: any;
  contact_evidence?: any[];
  sources_checked?: string[];
  has_public_email?: boolean;
  has_public_phone?: boolean;
  phone_only?: boolean;
  isTemporary?: boolean;
  verification_status?: string;
  reviewed_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROMOTED';
  crm_lead_id?: string | null;
  promoted_at?: string | null;
  rejection_reason?: string | null;
  notes?: string;
  ai_draft?: string;
  email_draft?: string;
  whatsapp_draft?: string;
  discovery_timestamp?: string;
  created_at: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  description: string;
  media: {
    url: string;
    type: 'image' | 'video';
    name: string;
  }[];
  image_url?: string;
  tags: string[];
  link?: string;
  live_url?: string;
  demo_url?: string;
  created_at: string;
}

export interface Lead {
  id: string;
  contact_name?: string;
  business_name?: string;
  user_email: string;
  user_phone: string;
  target_url?: string;
  website?: string;
  country?: string;
  city?: string;
  timezone?: string;
  requested_service?: string;
  lead_source?: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Won' | 'Lost' | 'pending' | 'contacted' | 'delivered' | 'closed';
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  assigned_admin?: string;
  notes?: string;
  follow_up_date?: string | null;
  last_contacted_at?: string | null;
  revenue_tier: string;
  core_problem: string;
  cta_source: string;
  session_id: string;
  created_at: string;
  updated_at?: string;
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

export interface Booking {
  id: string;
  name: string;
  email: string;
  booking_date: string;
  booking_time: string;
  message: string;
  created_at: string;
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
  Solutions = 'solutions',
  Work = 'work',
  Process = 'process',
  Insights = 'insights',
  Audit = 'audit',
  Booking = 'booking'
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Author {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  reading_time: number;
  published_at: string;
  category_id?: string;
  author_id?: string;
  created_at: string;
  updated_at: string;
  category?: Category;
  author?: Author;
  formatting_payload?: any;
  media_source_flag?: 'file' | 'external';
  has_website?: boolean;
  website_url?: string;
  project_description?: string;
}

export interface AdminUser {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ProjectStatus = 
  | 'Planning' 
  | 'In Progress' 
  | 'Awaiting Client' 
  | 'Revision Required' 
  | 'Completed' 
  | 'On Hold';

export type MilestoneStatus = 
  | 'Not Started' 
  | 'In Progress' 
  | 'Blocked' 
  | 'Completed';

export type DeliverableType = 
  | 'Design' 
  | 'Staging Link' 
  | 'Deployment' 
  | 'Final Handover' 
  | 'Document' 
  | 'Code Repository' 
  | 'Other';

export type DeliverableVisibility = 'client_visible' | 'internal_draft';

export type ActivityVisibility = 'client_visible' | 'internal_only';

export type ActivityType = 
  | 'status_change' 
  | 'milestone_update' 
  | 'deliverable_published' 
  | 'client_feedback' 
  | 'revision_request' 
  | 'internal_note' 
  | 'general_update';

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  due_date?: string | null;
  order_index: number;
  status: MilestoneStatus;
  notes?: string; // admin private notes
  client_notes?: string; // client visible notes
  completed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ProjectDeliverable {
  id: string;
  project_id: string;
  milestone_id?: string | null;
  title: string;
  description?: string;
  type: DeliverableType;
  deliverable_type?: string;
  resource_url: string;
  asset_url?: string;
  visibility: DeliverableVisibility;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  type: ActivityType;
  message: string;
  visibility: ActivityVisibility;
  author_email: string;
  author_role: 'admin' | 'client';
  metadata?: any;
  created_at: string;
}

export interface ClientProject {
  id: string;
  name: string;
  title?: string;
  client_user_id?: number | null;
  client_email: string;
  client_name?: string;
  description?: string;
  scope?: string;
  status: ProjectStatus;
  start_date?: string | null;
  target_date?: string | null;
  target_end_date?: string | null;
  completed_at?: string | null;
  assigned_admin_id?: number | null;
  assigned_admin_name?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Computed progress & relations
  total_milestones?: number;
  completed_milestones?: number;
  progress_percentage?: number;
  milestones?: ProjectMilestone[];
  deliverables?: ProjectDeliverable[];
  activities?: ProjectActivity[];
}

export type AIAutomationType = 
  | 'enquiry_summarizer' 
  | 'proposal_generator' 
  | 'audit_report_enhancer' 
  | 'project_reporter' 
  | 'outreach_generator';

export interface AIAutomationLog {
  id: string;
  automation_type: AIAutomationType;
  user_email: string;
  user_role: string;
  provider: string;
  model_used: string;
  input_summary?: string;
  output_summary?: string;
  status: 'SUCCESS' | 'FAILED' | 'RATE_LIMITED';
  error_message?: string;
  tokens_used: number;
  execution_time_ms: number;
  created_at: string;
}

// --------------------------------------------------------------------------
// AVARTAH BUSINESS OS SAAS TYPES
// --------------------------------------------------------------------------

export type BusinessOSIndustry = 
  | 'salon' 
  | 'restaurant' 
  | 'retail' 
  | 'consulting' 
  | 'legal' 
  | 'furniture' 
  | 'automotive' 
  | 'other';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tagline: string;
  price_ngn: number;
  price_usd: number;
  billing_interval: 'monthly' | 'yearly';
  max_customers: number;
  max_invoices_per_month: number;
  max_catalog_items: number;
  max_staff_seats: number;
  features: string[];
  is_active: boolean;
  created_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  industry: BusinessOSIndustry;
  owner_email: string;
  phone?: string;
  email?: string;
  country: string;
  currency: string;
  timezone: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  plan_id: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  created_at: string;
  updated_at: string;
  settings?: TenantSettings;
  plan?: SubscriptionPlan;
}

export interface TenantSettings {
  tenant_id: string;
  customer_label: string;
  catalog_label: string;
  invoice_prefix: string;
  quotation_prefix: string;
  tax_rate_percentage: number;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  payment_instructions?: string;
  whatsapp_notifications: boolean;
  email_notifications: boolean;
  receipt_footer_note: string;
  updated_at?: string;
}

export type TenantMemberRole = 'owner' | 'admin' | 'staff';

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_email: string;
  role: TenantMemberRole;
  name?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  notes?: string;
  total_spent: number;
  outstanding_balance: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at?: string;
}

export interface CatalogItem {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  type: 'service' | 'product';
  category: string;
  unit_price: number;
  cost_price: number;
  sku?: string;
  stock_quantity: number;
  track_inventory: boolean;
  is_available: boolean;
  created_at: string;
  updated_at?: string;
}

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'CONVERTED';

export interface QuotationItem {
  id?: string;
  quotation_id?: string;
  catalog_item_id?: string | null;
  title: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface Quotation {
  id: string;
  tenant_id: string;
  quotation_number: string;
  customer_id?: string | null;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  status: QuotationStatus;
  issue_date: string;
  expiry_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  items?: QuotationItem[];
}

export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  catalog_item_id?: string | null;
  title: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  quotation_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  created_at: string;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface Payment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  amount: number;
  payment_method: 'BANK_TRANSFER' | 'CASH' | 'POS_CARD' | 'ONLINE';
  reference?: string;
  receipt_number: string;
  payment_date: string;
  notes?: string;
  created_by?: string;
}

export interface BusinessOSMetrics {
  totalRevenue: number;
  outstandingBalance: number;
  paidThisMonth: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  totalInvoices: number;
  unpaidInvoicesCount: number;
  recentSales: {
    id: string;
    invoice_number: string;
    customer_name: string;
    amount: number;
    payment_method: string;
    date: string;
  }[];
  monthlySalesChart: {
    month: string;
    revenue: number;
  }[];
  recentActivities: {
    id: string;
    title: string;
    timestamp: string;
    type: 'invoice' | 'payment' | 'customer' | 'quotation';
  }[];
}

export type OutreachChannel = 'email' | 'whatsapp';

export type OutreachDeliveryStatus =
  | 'DRAFT_OPENED'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'BOUNCED'
  | 'REPLIED';

export interface CrmOutreachLog {
  id: string;
  prospect_id?: string | null;
  crm_lead_id?: string | null;
  business_name?: string | null;
  lead_contact_name?: string | null;
  lead_status?: string | null;
  channel: OutreachChannel | string;
  recipient: string;
  subject?: string | null;
  message_body: string;
  delivery_status: OutreachDeliveryStatus;
  provider?: string | null;
  provider_message_id?: string | null;
  error_message?: string | null;
  ai_generated: boolean;
  operator_email: string;
  dispatched_at: string;
  updated_at?: string | null;
}

export interface CrmOutreachSummary {
  total: number;
  email_count: number;
  whatsapp_count: number;
  draft_opened_count: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  replied_count: number;
}



