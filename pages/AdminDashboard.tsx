import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  Edit2, Trash2, Plus, X, CheckCircle, AlertCircle, 
  Loader2, ChevronUp, ChevronDown, Lock, Target, Database, Settings,
  Search, TrendingUp, Calendar, Layers, FileText, Users, Server, RefreshCw, Building, Sparkles,
  Mail, MessageSquare, Globe, History
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lead, SiteAnalytics, Project, Post, Booking, Prospect } from '../types';
import { 
  getLeads, updateLead, updateLeadStatus, getAnalytics, deleteLead, 
  getProjects, saveProject, deleteProject, getLeadsCount, getAnalyticsCount, getProjectsCount,
  getAdminSummary, getDbHealth, getServicesHealth, changePassword, getFunnelData,
  getBlogs, getBlogsCount, getBookings, getProspects, getLeadStats, getCrmOutreachLogs
} from '../lib/api';
import { logout, checkSession } from '../lib/auth';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import BlogCMS from '../components/BlogCMS';
import { ProspectLocator } from '../components/ProspectLocator';
import { UsersManagement } from '../components/UsersManagement';
import { LeadEditForm } from '../components/LeadEditForm';
import { ClientDeliveryHub } from '../components/ClientDeliveryHub';
import { SaaSTenantsManager } from '../components/SaaSTenantsManager';
import { CrmOutreachLogsView, CrmLeadOutreachModal } from '../components/CrmOutreachLogsView';

const TIER_DISPLAY_MAP: Record<string, string> = {
  'ALPHA': 'TIER ALPHA ($300 - $1,000)',
  'BETA': 'TIER BETA ($1,000 - $3,000)',
  'GAMMA': 'TIER GAMMA ($3,000 - $5,000+)',
  'ALPHA TIER': 'TIER ALPHA ($300 - $1,000)',
  'BETA TIER': 'TIER BETA ($1,000 - $3,000)',
  'GAMMA TIER': 'TIER GAMMA ($3,000 - $5,000+)',
  'ULTRA': 'TIER ULTRA ($10,000+)'
};

const Pagination: React.FC<{ 
  current: number; 
  total: number; 
  onPageChange: (page: number) => void;
}> = ({ current, total, onPageChange }) => {
  if (total <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-8 py-4 border-t border-zinc-100 dark:border-white/5">
      <button 
        disabled={current === 1}
        onClick={() => onPageChange(current - 1)}
        className="px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-white/60 hover:text-emerald-400 disabled:opacity-50 transition-all shadow-sm"
      >
        Prev
      </button>
      <div className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest px-4">
        Page {current} of {total}
      </div>
      <button 
        disabled={current === total}
        onClick={() => onPageChange(current + 1)}
        className="px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-white/60 hover:text-emerald-400 disabled:opacity-50 transition-all shadow-sm"
      >
        Next
      </button>
    </div>
  );
};

const AnalyticsView: React.FC<{ 
  data: SiteAnalytics[]; 
  funnelData: { step: number; count: number }[];
  timeRange: '7D' | '30D' | 'ALL';
  onTimeRangeChange: (range: '7D' | '30D' | 'ALL') => void;
  pagination: { current: number; total: number; onPageChange: (p: number) => void } 
}> = ({ data, funnelData, timeRange, onTimeRangeChange, pagination }) => {

  const stats = useMemo(() => {
    const total = data.length;
    if (total === 0) return { total: 0, avgDuration: 0, completionRate: 0, escalationRate: 0 };
    
    const avgDuration = data.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0) / total;
    const completed = data.filter(d => d.submitted).length;
    const completionRate = (completed / total) * 100;
    
    const escalations = data.filter(d => d.whatsapp_handshake || d.calendly_handshake).length;
    const escalationRate = (escalations / total) * 100;
    
    return {
      total,
      avgDuration: Math.round(avgDuration),
      completionRate: Math.round(completionRate),
      escalationRate: Math.round(escalationRate)
    };
  }, [data]);

  const processedFunnelData = useMemo(() => {
    const steps = [1, 2, 3, 4];
    return steps.map(step => ({
      step,
      count: funnelData.filter(d => d.step >= step).reduce((acc, curr) => acc + curr.count, 0)
    }));
  }, [funnelData]);

  const maxStepCount = Math.max(...processedFunnelData.map(d => d.count), 1);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {[
          { label: 'Network Nodes', value: stats.total, color: 'text-emerald-400' },
          { label: 'Avg Latency', value: `${stats.avgDuration}s`, color: 'text-emerald-400' },
          { label: 'Success Rate', value: `${stats.completionRate}%`, color: 'text-green-500' },
          { label: 'Escalation Node', value: `${stats.escalationRate}%`, color: 'text-emerald-400' }
        ].map((kpi) => (
          <div key={kpi.label} className="p-4 sm:p-5 md:p-8 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-[1.25rem] sm:rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm">
            <div className={`${kpi.color} mb-3 md:mb-4`}><div className="w-4 h-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-sm"></div></div>
            <div className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-slate-500 dark:text-white/50 uppercase tracking-[0.2em] mb-1">{kpi.label}</div>
            <div className="text-lg sm:text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-8 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-10">
            <div>
              <h3 className="text-slate-900 dark:text-white text-sm md:text-lg font-black tracking-tighter uppercase mb-1">Conversion Funnel</h3>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-500 dark:text-white/50 tracking-[0.2em] uppercase">User distribution across audit modules</p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
              {(['7D', '30D', 'ALL'] as const).map(tr => (
                <button
                  key={tr}
                  onClick={() => onTimeRangeChange(tr)}
                  className={`px-3 py-1 text-[9px] font-black tracking-widest rounded-lg transition-all ${
                    timeRange === tr 
                      ? 'bg-emerald-500 text-black shadow-sm' 
                      : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between gap-1.5 sm:gap-2 md:gap-4 h-40 sm:h-48 md:h-64 px-1 sm:px-2">
            {processedFunnelData.map((d, i) => {
              const height = (d.count / maxStepCount) * 100;
              return (
                <div key={d.step} className="flex-1 flex flex-col items-center gap-2 md:gap-3">
                  <div className="relative w-full flex-1 flex flex-col justify-end bg-slate-100 dark:bg-white/5 rounded-t-lg sm:rounded-t-xl overflow-hidden">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="w-full bg-emerald-500/20 border-t-2 border-emerald-500"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-white/40 dark:bg-black/40 text-slate-900 dark:text-white text-[8px] sm:text-[10px] font-black">
                      {d.count}
                    </div>
                  </div>
                  <div className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-slate-500 dark:text-white/50 uppercase tracking-widest text-center">Step 0{d.step}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 flex flex-col shadow-sm max-h-[400px] md:max-h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-900 dark:text-white text-[10px] md:text-sm font-black tracking-tighter uppercase">Recent Activity</h3>
          </div>
          
          <div className="flex-1 space-y-3 overflow-y-auto pr-2">
            {data.slice(0, 50).map((session, i) => (
              <div 
                key={`${session.visitor_id}-${session.session_start}-${i}`}
                className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl flex flex-col gap-1"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-black text-emerald-400 uppercase">Node: {session.visitor_id.slice(0, 8)}</span>
                  <span className="text-[8px] font-bold text-slate-500 dark:text-white/50 uppercase">{session.duration_seconds}s</span>
                </div>
                <div className="text-[9px] text-slate-600 dark:text-white/70 font-bold uppercase tracking-tight">
                  {session.submitted ? (
                    <span className="text-green-500">[CONVERTED]</span>
                  ) : (session.form_progress || 0) > 0 ? (
                    <span>Exited Step {session.form_progress}</span>
                  ) : (
                    <span>Bounced</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Pagination 
        current={pagination.current} 
        total={pagination.total} 
        onPageChange={pagination.onPageChange} 
      />
    </div>
  );
};

const WeeklySummary: React.FC<{ 
  summary: { analytics: { total_visitors: number; avg_duration: number; recent_visitors: number }; revenue: number }
}> = ({ summary }) => {
  return (
    <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 mb-8 font-mono relative overflow-hidden shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative z-10">
        <div>
          <div className="text-emerald-400 font-black text-[10px] tracking-[0.4em] mb-4 uppercase border-b border-slate-100 dark:border-white/5 pb-2">
            OPS STATUS: LIVE METRICS
          </div>
          <div className="space-y-4 text-xs text-slate-900 dark:text-white">
            <p>- Active Network Nodes: <span className="text-emerald-400 font-bold">{summary.analytics.total_visitors}</span> (Total)</p>
            <p>- Recent Visitors (7d): <span className="text-emerald-400 font-bold">{summary.analytics.recent_visitors}</span></p>
            <p>- Median Session Time: <span className="text-emerald-400 font-bold">{summary.analytics.avg_duration}s</span></p>
          </div>
        </div>
        <div>
          <div className="text-emerald-400 font-black text-[10px] tracking-[0.4em] mb-4 uppercase border-b border-slate-100 dark:border-white/5 pb-2">
            REVENUE PIPELINE
          </div>
          <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
            Forecasted Yield: <span className="text-emerald-400">${summary.revenue.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

type PrimarySection = 'growth' | 'operations' | 'management';

const AdminDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = (searchParams.get('tab') || '').toLowerCase();

  const shouldReduceMotion = useReducedMotion();

  // Resolve 3 primary sections with backward compatible URL parameter support
  const initialSection: PrimarySection = useMemo(() => {
    if (['prospects', 'analytics', 'overview', 'jobs', 'growth'].includes(urlTab)) return 'growth';
    if (['operations', 'leads', 'outreach', 'outreach_logs', 'delivery', 'bookings', 'projects'].includes(urlTab)) return 'operations';
    if (['management', 'blogs', 'users', 'system'].includes(urlTab)) return 'management';
    return 'growth';
  }, [urlTab]);

  const [activeSection, setActiveSection] = useState<PrimarySection>(initialSection);

  // Sub-tabs per section
  const [growthSubTab, setGrowthSubTab] = useState<'prospects' | 'analytics' | 'jobs'>(
    (urlTab === 'overview' || urlTab === 'analytics') ? 'analytics' : (urlTab === 'jobs') ? 'jobs' : 'prospects'
  );
  const [opsSubTab, setOpsSubTab] = useState<'leads' | 'outreach' | 'delivery' | 'bookings' | 'projects'>(
    (urlTab === 'outreach' || urlTab === 'outreach_logs') ? 'outreach' : (urlTab === 'delivery') ? 'delivery' : (urlTab === 'bookings') ? 'bookings' : (urlTab === 'projects') ? 'projects' : 'leads'
  );
  const [mgmtSubTab, setMgmtSubTab] = useState<'saas' | 'blogs' | 'users' | 'system'>(
    (urlTab === 'blogs') ? 'blogs' : (urlTab === 'users') ? 'users' : (urlTab === 'system') ? 'system' : 'saas'
  );

  useEffect(() => {
    if (['prospects', 'analytics', 'overview', 'jobs', 'growth'].includes(urlTab)) {
      setActiveSection('growth');
      if (urlTab === 'overview' || urlTab === 'analytics') setGrowthSubTab('analytics');
      else if (urlTab === 'jobs') setGrowthSubTab('jobs');
      else setGrowthSubTab('prospects');
    } else if (['operations', 'leads', 'outreach', 'outreach_logs', 'delivery', 'bookings', 'projects'].includes(urlTab)) {
      setActiveSection('operations');
      if (urlTab === 'outreach' || urlTab === 'outreach_logs') setOpsSubTab('outreach');
      else if (urlTab === 'delivery') setOpsSubTab('delivery');
      else if (urlTab === 'bookings') setOpsSubTab('bookings');
      else if (urlTab === 'projects') setOpsSubTab('projects');
      else setOpsSubTab('leads');
    } else if (['management', 'saas', 'blogs', 'users', 'system'].includes(urlTab)) {
      setActiveSection('management');
      if (urlTab === 'blogs') setMgmtSubTab('blogs');
      else if (urlTab === 'users') setMgmtSubTab('users');
      else if (urlTab === 'system') setMgmtSubTab('system');
      else setMgmtSubTab('saas');
    }
  }, [urlTab]);

  const handleSectionChange = (sec: PrimarySection) => {
    setActiveSection(sec);
    let defaultTab = 'prospects';
    if (sec === 'growth') defaultTab = growthSubTab;
    else if (sec === 'operations') defaultTab = opsSubTab;
    else if (sec === 'management') defaultTab = mgmtSubTab;
    setSearchParams({ tab: defaultTab });
  };

  const handleSubTabChange = (tab: string) => {
    if (activeSection === 'growth') setGrowthSubTab(tab as any);
    else if (activeSection === 'operations') setOpsSubTab(tab as any);
    else if (activeSection === 'management') setMgmtSubTab(tab as any);
    setSearchParams({ tab });
  };

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadStats, setLeadStats] = useState({ total: 0, new_leads: 0, qualified: 0, won: 0, lost: 0, follow_ups_due: 0 });
  const [analyticsData, setAnalyticsData] = useState<SiteAnalytics[]>([]);
  const [funnelData, setFunnelData] = useState<{ step: number; count: number }[]>([]);
  const [funnelTimeRange, setFunnelTimeRange] = useState<'7D' | '30D' | 'ALL'>('7D');
  const [projects, setProjects] = useState<Project[]>([]);
  const [blogs, setBlogs] = useState<Post[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [outreachTotalCount, setOutreachTotalCount] = useState<number>(0);
  const [emailApiConfigured, setEmailApiConfigured] = useState<boolean>(false);
  const [outreachLeadModal, setOutreachLeadModal] = useState<{ lead: Lead; channel: 'email' | 'whatsapp' } | null>(null);
  const [outreachLeadFilter, setOutreachLeadFilter] = useState<{ id: string; name: string } | null>(null);
  const [outreachLogsRefreshTrigger, setOutreachLogsRefreshTrigger] = useState(0);

  const fetchTenantsList = async () => {
    try {
      const res = await fetch('/api/os/tenants', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (err) {
      console.error('Tenants Fetch Error:', err);
    }
  };
  
  const revenueTiers = useMemo(() => Array.from(new Set(leads.map(l => l.revenue_tier).filter(Boolean))).sort(), [leads]);
  const editingRevenueTiers = useMemo(() => Array.from(new Set([...['$300 - $1,000', '$1,000 - $5,000', '$5,000+'], ...leads.map(l => l.revenue_tier).filter(Boolean)])).sort(), [leads]);
  const [summary, setSummary] = useState<{ 
    analytics: { total_visitors: number; avg_duration: number; recent_visitors: number };
    revenue: number;
  }>({
    analytics: { total_visitors: 0, avg_duration: 0, recent_visitors: 0 },
    revenue: 0
  });

  const [loading, setLoading] = useState(true);
  const [dbHealth, setDbHealth] = useState<{ status: string; error?: string; isIpBlocked?: boolean; api_connections?: any } | null>(null);
  const [servicesHealth, setServicesHealth] = useState<Record<string, { status: string; latency?: number; message?: string }>>({});
  
  const [pages, setPages] = useState({
    leads: { current: 1, total: 1, limit: 50 },
    analytics: { current: 1, total: 1, limit: 100 },
    projects: { current: 1, total: 1, limit: 20 },
    blogs: { current: 1, total: 1, limit: 20 }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);

  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const [settingsForm, setSettingsForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { openLogin } = useAuth();
  const navigate = useNavigate();

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fetchLeads = async (page: number = 1) => {
    try {
      const limit = pages.leads.limit;
      const offset = (page - 1) * limit;
      const [data, countRes, statsRes] = await Promise.all([
        getLeads(limit, offset),
        getLeadsCount(),
        getLeadStats()
      ]);
      setLeads(data);
      setLeadStats(statsRes);
      setPages(prev => ({ 
        ...prev, 
        leads: { ...prev.leads, current: page, total: Math.ceil(countRes / limit) } 
      }));
    } catch (err) {
      console.error("Leads Fetch Error:", err);
    }
  };

  const fetchAnalytics = async (page: number = 1) => {
    try {
      const limit = pages.analytics.limit;
      const offset = (page - 1) * limit;
      const [data, countRes] = await Promise.all([
        getAnalytics(limit, offset),
        getAnalyticsCount()
      ]);
      setAnalyticsData(data);
      setPages(prev => ({ 
        ...prev, 
        analytics: { ...prev.analytics, current: page, total: Math.ceil(countRes / limit) } 
      }));
    } catch (err) {
      console.error("Analytics Fetch Error:", err);
    }
  };

  const fetchProjects = async (page: number = 1) => {
    try {
      const limit = pages.projects.limit;
      const offset = (page - 1) * limit;
      const [data, countRes] = await Promise.all([
        getProjects(limit, offset),
        getProjectsCount()
      ]);
      setProjects(data);
      setPages(prev => ({ 
        ...prev, 
        projects: { ...prev.projects, current: page, total: Math.ceil(countRes / limit) } 
      }));
    } catch (err) {
      console.error("Projects Fetch Error:", err);
    }
  };

  const fetchBlogs = async (page: number = 1) => {
    try {
      const limit = pages.blogs.limit;
      const offset = (page - 1) * limit;
      const [data, countRes] = await Promise.all([
        getBlogs(),
        getBlogsCount()
      ]);
      setBlogs(data);
      setPages(prev => ({ 
        ...prev, 
        blogs: { ...prev.blogs, current: page, total: Math.ceil(countRes / limit) } 
      }));
    } catch (err) {
      console.error("Blogs Fetch Error:", err);
    }
  };

  const fetchBookings = async () => {
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (err) {
      console.error("Bookings Fetch Error:", err);
    }
  };

  const fetchProspectsList = async () => {
    try {
      const data = await getProspects();
      setProspects(data);
    } catch (err) {
      console.error("Prospects Fetch Error:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const health = await getDbHealth();
      setDbHealth(health);

      const sHealth = await getServicesHealth();
      setServicesHealth(sHealth);

      const summaryRes = await getAdminSummary();
      setSummary(summaryRes);
      
      if (activeSection === 'growth') {
        if (growthSubTab === 'prospects') await fetchProspectsList();
        else if (growthSubTab === 'analytics') {
          await fetchAnalytics(1);
          const funnel = await getFunnelData(funnelTimeRange);
          setFunnelData(funnel);
        }
      } else if (activeSection === 'operations') {
        try {
          const outreachMeta = await getCrmOutreachLogs({ limit: 1 });
          setOutreachTotalCount(outreachMeta.total || 0);
          setEmailApiConfigured(Boolean(outreachMeta.emailConfigured));
        } catch {}
        if (opsSubTab === 'leads') await fetchLeads(pages.leads.current);
        else if (opsSubTab === 'bookings') await fetchBookings();
        else if (opsSubTab === 'projects') await fetchProjects(pages.projects.current);
      } else if (activeSection === 'management') {
        await fetchTenantsList();
        if (mgmtSubTab === 'blogs') await fetchBlogs(pages.blogs.current);
      }
    } catch (err) {
      console.error("Backend Ledger Sync Fault:", err);
      showToast("Sync Failure", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleButtonClick = (actionName: string) => {
    showToast(`${actionName} action triggered`);
  };

  useEffect(() => {
    let isMounted = true;
    checkSession().then(auth => {
      if (!isMounted) return;
      setIsVerifyingSession(false);
      if (!auth || !auth.authenticated || auth.role !== 'admin') {
        setIsAuth(false);
        return;
      }
      setIsAuth(true);
      fetchData();
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (isAuth) {
      fetchData();
    }
  }, [activeSection, growthSubTab, opsSubTab, mgmtSubTab, isAuth]);

  const handleStatusChange = async (id: string, status: Lead['status']) => {
    try {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      await updateLeadStatus(id, status);
      showToast("Status Updated");
      const summaryRes = await getAdminSummary();
      setSummary(summaryRes);
    } catch (e) {
      showToast("Update Error", "error");
      fetchData();
    }
  };

  const handleSaveLead = async () => {
    handleButtonClick("Lead save");
    if (!editingLead || !editingLead.id) return;
    
    setIsSaving(true);
    try {
      await updateLead(editingLead.id, editingLead);
      showToast("Lead Updated");
      setLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...editingLead } as Lead : l));
      setIsEditingLead(false);
      setEditingLead(null);
    } catch (e) {
      showToast("Lead Update Error", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    handleButtonClick("Delete lead");
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Permanent Deletion',
      message: 'Are you sure you want to permanently delete this lead record? This action cannot be undone.',
      confirmText: 'Delete Record',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteLead(id);
          showToast("Record Deleted");
          setLeads(prev => prev.filter(l => l.id !== id));
        } catch (e) {
          showToast("Deletion Error", "error");
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSaveProject = async () => {
    handleButtonClick("Project save");
    if (!editingProject) return;

    if (!editingProject.title?.trim() || !editingProject.description?.trim()) {
      showToast("Title and Description Required", "error");
      return;
    }

    setIsSaving(true);
    try {
      const processedTags = tagInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const cleanProject = {
        ...editingProject,
        tags: processedTags
      } as Project;

      await saveProject(cleanProject);
      showToast("Project Saved");
      setProjects(prev => {
        const index = prev.findIndex(p => p.id === cleanProject.id);
        if (index === -1) return [...prev, cleanProject];
        const next = [...prev];
        next[index] = cleanProject;
        return next;
      });

      setIsEditingProject(false);
      setEditingProject(null);
      setTagInput('');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Save Error";
      showToast(errorMsg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    handleButtonClick("Delete project");
    setConfirmModal({
      isOpen: true,
      title: 'Delete Project Permanently',
      message: 'Are you sure you want to delete this project? All associated media and data will be removed.',
      confirmText: 'Delete Project',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteProject(id);
          showToast("Project Deleted");
          setProjects(prev => prev.filter(p => p.id !== id));
        } catch (e) {
          showToast("Delete Error", "error");
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsForm.newPassword !== settingsForm.confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    setIsSaving(true);
    try {
      await changePassword({
        currentPassword: settingsForm.currentPassword,
        newPassword: settingsForm.newPassword
      });
      showToast("Password updated successfully");
      setSettingsForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsSettingsModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update Failed";
      showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMedia = () => {
    handleButtonClick("Add media");
    if (!newMediaUrl) return;
    
    const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = newMediaUrl.match(youtubeRegex);
    
    let detectedType: 'image' | 'video' = newMediaType;
    let finalUrl = newMediaUrl;

    if (youtubeMatch) {
      detectedType = 'video';
      finalUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    const media = editingProject?.media || [];
    setEditingProject({
      ...editingProject,
      media: [...media, { url: finalUrl, type: detectedType, name: youtubeMatch ? 'YouTube Video' : `Media ${media.length + 1}` }]
    });
    setNewMediaUrl('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    handleButtonClick("File upload");
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newMediaItems: { url: string, type: 'image' | 'video', name: string }[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error("Read Failed"));
          reader.readAsDataURL(file);
        });

        newMediaItems.push({
          url,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          name: file.name
        });
      }

      if (newMediaItems.length > 0) {
        const media = editingProject?.media || [];
        setEditingProject({
          ...editingProject,
          media: [...media, ...newMediaItems]
        });
        showToast(`${newMediaItems.length} Media Items Added`);
      }
    } catch (err) {
      showToast("Upload Failed", "error");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const filteredLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return leads
      .filter(l => {
        const email = l.user_email?.toLowerCase() || '';
        const sid = l.session_id?.toLowerCase() || '';
        const contact = l.contact_name?.toLowerCase() || '';
        const business = l.business_name?.toLowerCase() || '';
        const phone = l.user_phone?.toLowerCase() || '';
        const url = l.target_url?.toLowerCase() || '';
        const matchesSearch = !term || email.includes(term) || sid.includes(term) || contact.includes(term) || business.includes(term) || phone.includes(term) || url.includes(term);
        const matchesTier = filterTier === 'ALL' || l.revenue_tier?.includes(filterTier);
        const matchesStatus = filterStatus === 'ALL' || l.status === filterStatus;
        return matchesSearch && matchesTier && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [leads, searchTerm, filterTier, filterStatus, sortOrder]);

  if (isVerifyingSession) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Verifying Security Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#111315] flex items-center justify-center p-6 text-[#F2F1ED]">
        <div className="max-w-md w-full bg-[#15191C] border border-white/10 rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#C58A52] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">Admin Session Required</h2>
          <p className="text-sm text-[#A3A9AF] mb-6">
            You must be authenticated with verified administrative privileges to access the operational command center.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => openLogin({ returnTo: '/admin/dashboard' })}
              className="px-5 py-2.5 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] rounded-xl font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
            >
              Sign In as Admin
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-[#F2F1ED] border border-white/10 rounded-xl font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Syncing Command Center...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black/95 text-slate-900 dark:text-white p-4 sm:p-6 lg:p-8 font-sans selection:bg-emerald-500 selection:text-black">
      <Helmet>
        <title>Admin Command Center | Avartah Solutions</title>
        <meta name="description" content="Avartah Solutions administrative operations center." />
      </Helmet>

      {/* Header & Navigation */}
      <header className="max-w-[1600px] mx-auto mb-8 sm:mb-12 flex flex-col lg:flex-row items-center justify-between gap-4 bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-4 sm:p-6 rounded-[2rem] backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
              A
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black tracking-tighter uppercase">Avartah Admin</h1>
              <p className="text-[9px] font-bold text-slate-500 dark:text-white/50 tracking-widest uppercase">Secure Command Center</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          <button 
            onClick={toggleTheme}
            className="p-3 bg-white dark:bg-black/40 text-slate-600 dark:text-white/60 rounded-xl border border-black/10 dark:border-white/10 hover:text-emerald-400 transition-all text-xs font-bold"
            aria-label="Toggle Theme"
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>

          <button 
            onClick={() => navigate('/business-os/dashboard')} 
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <Building className="w-3.5 h-3.5" />
            SaaS Business OS
          </button>

          <button 
            onClick={() => navigate('/')} 
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-black/40 text-slate-600 dark:text-white/60 rounded-xl text-xs font-semibold uppercase tracking-wider border border-black/10 dark:border-white/10 hover:text-emerald-400 transition-all"
          >
            View Live Site
          </button>

          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-black/40 text-slate-600 dark:text-white/60 rounded-xl text-xs font-semibold uppercase tracking-wider border border-black/10 dark:border-white/10 hover:text-emerald-400 transition-all cursor-pointer"
          >
            Settings
          </button>
          
          <div className="lg:hidden w-full relative mt-2">
            <select
              value={activeSection}
              onChange={(e) => handleSectionChange(e.target.value as PrimarySection)}
              className="w-full appearance-none bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-emerald-500 transition-all text-slate-700 dark:text-white"
            >
              <option value="growth">1. Growth & Intelligence</option>
              <option value="operations">2. Client Operations</option>
              <option value="management">3. Platform Management</option>
            </select>
          </div>
          
          <div className="hidden lg:flex bg-white dark:bg-black/40 p-1.5 rounded-2xl border border-black/10 dark:border-white/10 gap-1.5">
            <button 
              onClick={() => handleSectionChange('growth')} 
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeSection === 'growth' ? 'bg-emerald-500 text-slate-900 shadow-sm' : 'text-slate-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <Target className="w-4 h-4" />
              1. Growth & Intelligence
            </button>
            <button 
              onClick={() => handleSectionChange('operations')} 
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeSection === 'operations' ? 'bg-emerald-500 text-slate-900 shadow-sm' : 'text-slate-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <Database className="w-4 h-4" />
              2. Client Operations
            </button>
            <button 
              onClick={() => handleSectionChange('management')} 
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeSection === 'management' ? 'bg-emerald-500 text-slate-900 shadow-sm' : 'text-slate-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <Settings className="w-4 h-4" />
              3. Platform Management
            </button>
          </div>

          <button 
            onClick={() => logout()} 
            className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-xs font-semibold uppercase tracking-wider border border-red-100 dark:border-red-900/30 whitespace-nowrap text-center hover:bg-red-100 transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto">
        {dbHealth?.isIpBlocked && (
          <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-red-500 font-black uppercase tracking-tighter text-sm">Database Connection Issue</h3>
              <p className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest mt-1">Unable to connect to the persistent PostgreSQL database.</p>
            </div>
          </div>
        )}

        {/* Section Sub-Navigation Toolbar */}
        <div className="mb-8 flex items-center justify-between gap-3 bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-3 rounded-2xl overflow-x-auto shadow-sm">
          {activeSection === 'growth' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubTabChange('prospects')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${growthSubTab === 'prospects' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Search className="w-3.5 h-3.5" />
                Prospecting Engine ({prospects.length})
              </button>
              <button
                onClick={() => handleSubTabChange('analytics')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${growthSubTab === 'analytics' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Overview & Analytics
              </button>
              <button
                onClick={() => handleSubTabChange('jobs')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${growthSubTab === 'jobs' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Job & Lead Finder
              </button>
            </div>
          )}

          {activeSection === 'operations' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubTabChange('leads')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${opsSubTab === 'leads' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Database className="w-3.5 h-3.5" />
                CRM Leads Ledger ({leads.length})
              </button>
              <button
                onClick={() => handleSubTabChange('outreach')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${opsSubTab === 'outreach' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <History className="w-3.5 h-3.5" />
                Outreach Delivery Log ({outreachTotalCount})
              </button>
              <button
                onClick={() => handleSubTabChange('delivery')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${opsSubTab === 'delivery' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Client Delivery Hub
              </button>
              <button
                onClick={() => handleSubTabChange('bookings')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${opsSubTab === 'bookings' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Audit Bookings ({bookings.length})
              </button>
              <button
                onClick={() => handleSubTabChange('projects')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${opsSubTab === 'projects' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                Portfolio Projects ({projects.length})
              </button>
            </div>
          )}

          {activeSection === 'management' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubTabChange('saas')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${mgmtSubTab === 'saas' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Building className="w-3.5 h-3.5" />
                SaaS Businesses ({tenants.length})
              </button>
              <button
                onClick={() => handleSubTabChange('blogs')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${mgmtSubTab === 'blogs' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                Content CMS ({blogs.length})
              </button>
              <button
                onClick={() => handleSubTabChange('users')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${mgmtSubTab === 'users' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Users className="w-3.5 h-3.5" />
                Admin User Roles
              </button>
              <button
                onClick={() => handleSubTabChange('system')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${mgmtSubTab === 'system' ? 'bg-emerald-500 text-slate-900' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Server className="w-3.5 h-3.5" />
                System Health & Security
              </button>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeSection === 'growth' && (
            <motion.div
              key="growth-section"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              className="space-y-8"
            >
              {growthSubTab === 'prospects' && (
                <ProspectLocator onSaved={fetchProspectsList} />
              )}

              {growthSubTab === 'analytics' && (
                <>
                  <WeeklySummary summary={summary} />
                  <AnalyticsView 
                    data={analyticsData} 
                    funnelData={funnelData}
                    timeRange={funnelTimeRange}
                    onTimeRangeChange={async (nextRange) => {
                      setFunnelTimeRange(nextRange);
                      const updatedFunnel = await getFunnelData(nextRange);
                      setFunnelData(updatedFunnel);
                    }}
                    pagination={{ current: pages.analytics.current, total: pages.analytics.total, onPageChange: fetchAnalytics }} 
                  />
                </>
              )}

              {growthSubTab === 'jobs' && (
                <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-6">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Job & Lead Finder</h3>
                      <p className="text-xs font-semibold text-slate-500 dark:text-white/50 tracking-wider uppercase mt-1">High-value client opportunity aggregation & contract intelligence</p>
                    </div>
                    <button
                      onClick={() => handleSubTabChange('prospects')}
                      className="px-5 py-2.5 bg-emerald-500 text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-400 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Search className="w-4 h-4" /> Run Deep Prospect Search
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                      <div className="text-emerald-500 font-black text-2xl mb-1">{prospects.length}</div>
                      <div className="text-xs font-bold uppercase text-slate-500">Active Prospect Targets</div>
                      <p className="text-[11px] text-slate-500 dark:text-white/60 mt-2">Verified small business targets with audited site vulnerabilities ready for outreach.</p>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                      <div className="text-emerald-500 font-black text-2xl mb-1">{leadStats.qualified}</div>
                      <div className="text-xs font-bold uppercase text-slate-500">Qualified Deals</div>
                      <p className="text-[11px] text-slate-500 dark:text-white/60 mt-2">Qualified inbound leads currently in negotiation or proposal phase.</p>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                      <div className="text-emerald-500 font-black text-2xl mb-1">${summary.revenue.toLocaleString()}</div>
                      <div className="text-xs font-bold uppercase text-slate-500">Pipeline Yield</div>
                      <p className="text-[11px] text-slate-500 dark:text-white/60 mt-2">Total forecasted value across active client proposals.</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'operations' && (
            <motion.div
              key="operations-section"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              className="space-y-8"
            >
              {opsSubTab === 'delivery' && (
                <ClientDeliveryHub />
              )}

              {opsSubTab === 'outreach' && (
                <CrmOutreachLogsView
                  leadFilterId={outreachLeadFilter?.id || null}
                  leadFilterName={outreachLeadFilter?.name || null}
                  onClearLeadFilter={() => setOutreachLeadFilter(null)}
                  onToast={showToast}
                  refreshTrigger={outreachLogsRefreshTrigger}
                />
              )}

              {opsSubTab === 'leads' && (
                <div className="space-y-8">
                  {/* CRM KPI Metrics Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-6 rounded-2xl shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Leads</div>
                      <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{leadStats.total}</div>
                    </div>
                    <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-6 rounded-2xl shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">New Leads</div>
                      <div className="text-3xl font-black text-blue-500 tracking-tighter">{leadStats.new_leads}</div>
                    </div>
                    <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-6 rounded-2xl shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Follow-ups Due</div>
                      <div className="text-3xl font-black text-amber-500 tracking-tighter">{leadStats.follow_ups_due}</div>
                    </div>
                    <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-6 rounded-2xl shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Qualified</div>
                      <div className="text-3xl font-black text-indigo-500 tracking-tighter">{leadStats.qualified}</div>
                    </div>
                    <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-6 rounded-2xl shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Won Deals</div>
                      <div className="text-3xl font-black text-emerald-500 tracking-tighter">{leadStats.won}</div>
                    </div>
                    <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-6 rounded-2xl shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Lost Deals</div>
                      <div className="text-3xl font-black text-red-500 tracking-tighter">{leadStats.lost}</div>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                    <div className="relative w-full lg:w-96">
                      <input
                        type="text"
                        placeholder="Search by contact, business, email, website..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm text-slate-900 dark:text-white placeholder-slate-400"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                      <select
                        value={filterTier}
                        onChange={(e) => setFilterTier(e.target.value)}
                        className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white shadow-sm"
                      >
                        <option value="ALL">All Revenue Tiers</option>
                        {revenueTiers.map(t => (
                          <option key={t} value={t}>{TIER_DISPLAY_MAP[t] || t}</option>
                        ))}
                      </select>

                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white shadow-sm"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Proposal Sent">Proposal Sent</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>

                      <button
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="px-5 py-4 bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-xs font-bold flex items-center gap-2 hover:text-emerald-400 transition-all shadow-sm text-slate-900 dark:text-white cursor-pointer"
                      >
                        Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                        {sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-sm overflow-x-auto">
                    {filteredLeads.length === 0 ? (
                      <div className="text-center py-16">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No leads match the current filters.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-black/10 dark:border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="pb-4 px-4">Contact / Organization</th>
                            <th className="pb-4 px-4">Source & Service</th>
                            <th className="pb-4 px-4">Pipeline Status</th>
                            <th className="pb-4 px-4">Details / Notes</th>
                            <th className="pb-4 px-4">Outreach & Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5 text-xs">
                          {filteredLeads.map((lead, idx) => (
                            <tr key={`${lead.id || 'lead'}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="py-4 px-4">
                                <div className="font-bold text-slate-900 dark:text-white">{lead.contact_name || lead.user_email || 'Anonymous Visitor'}</div>
                                {lead.business_name && <div className="text-[11px] font-semibold text-emerald-500 mt-0.5">{lead.business_name}</div>}
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{lead.user_phone || lead.user_email}</div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="font-bold text-slate-800 dark:text-white/90">{lead.lead_source || 'Website Enquiry'}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{lead.requested_service || lead.revenue_tier || 'General'}</div>
                              </td>
                              <td className="py-4 px-4">
                                <select
                                  value={lead.status || 'New'}
                                  onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
                                  className="bg-transparent border border-black/10 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                                >
                                  <option value="New" className="bg-white dark:bg-slate-900">New</option>
                                  <option value="Contacted" className="bg-white dark:bg-slate-900">Contacted</option>
                                  <option value="Qualified" className="bg-white dark:bg-slate-900">Qualified</option>
                                  <option value="Proposal Sent" className="bg-white dark:bg-slate-900">Proposal Sent</option>
                                  <option value="Negotiation" className="bg-white dark:bg-slate-900">Negotiation</option>
                                  <option value="Won" className="bg-white dark:bg-slate-900">Won</option>
                                  <option value="Lost" className="bg-white dark:bg-slate-900">Lost</option>
                                </select>
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-[11px] text-slate-600 dark:text-white/70 max-w-xs truncate" title={lead.notes || lead.core_problem || lead.target_url}>
                                  {lead.notes || lead.core_problem || lead.target_url || 'No summary'}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(lead.created_at || '').toLocaleDateString()}
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setOutreachLeadModal({ lead, channel: 'email' })}
                                    className="p-2 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/20 transition-all cursor-pointer"
                                    title="Compose & Log AI Email Pitch"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOutreachLeadModal({ lead, channel: 'whatsapp' })}
                                    className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all cursor-pointer"
                                    title="Compose & Log AI WhatsApp Pitch"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOutreachLeadFilter({
                                        id: lead.id,
                                        name: lead.business_name || lead.contact_name || lead.user_email || lead.id
                                      });
                                      handleSubTabChange('outreach');
                                    }}
                                    className="p-2 bg-[#C58A52]/15 text-[#C58A52] rounded-xl hover:bg-[#C58A52]/25 transition-all cursor-pointer"
                                    title="View Outreach Delivery Log"
                                  >
                                    <History className="w-4 h-4" />
                                  </button>
                                  {lead.target_url && (
                                    <a
                                      href={lead.target_url.startsWith('http') ? lead.target_url : `https://${lead.target_url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl hover:bg-indigo-500/20 transition-all"
                                      title="Visit Website"
                                    >
                                      <Globe className="w-4 h-4" />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingLead(lead);
                                      setIsEditingLead(true);
                                    }}
                                    className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all cursor-pointer"
                                    title="Edit Lead"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(lead.id)}
                                    className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all cursor-pointer"
                                    title="Delete Lead"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <Pagination 
                    current={pages.leads.current} 
                    total={pages.leads.total} 
                    onPageChange={(p) => fetchLeads(p)} 
                  />
                </div>
              )}

              {opsSubTab === 'bookings' && (
                <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-8 rounded-[2.5rem] shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black tracking-tighter uppercase">Session Bookings</h3>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total: {bookings.length}</div>
                  </div>
                  {bookings.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-xs">No bookings recorded yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {bookings.map((booking, idx) => (
                        <div key={`${booking.id || 'booking'}-${idx}`} className="p-6 bg-white dark:bg-black/60 border border-black/10 dark:border-white/10 rounded-2xl flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-xs font-black text-emerald-400 uppercase">{booking.name}</span>
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-md text-[10px] font-bold">Confirmed</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-white/70 mb-2">{booking.email}</p>
                            <p className="text-xs font-mono text-slate-500">Scheduled: {booking.booking_date} at {booking.booking_time}</p>
                            {booking.message && <p className="text-xs mt-3 p-3 bg-white dark:bg-white/5 rounded-xl text-slate-500 dark:text-white/60">"{booking.message}"</p>}
                          </div>
                          <div className="text-[10px] text-slate-400 pt-3 border-t border-black/5 dark:border-white/5 uppercase">
                            Booked on: {new Date(booking.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {opsSubTab === 'projects' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tighter">Project Portfolio</h2>
                      <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Manage showcase projects and case studies</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingProject({
                          id: `proj_${Date.now()}`,
                          title: '',
                          description: '',
                          tags: [],
                          media: []
                        });
                        setTagInput('');
                        setIsEditingProject(true);
                      }}
                      className="px-6 py-3 bg-emerald-500 text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Project
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project, pIdx) => (
                      <div key={`${project.id || 'project'}-${pIdx}`} className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-sm">
                        <div>
                          {project.media && project.media[0] && (
                            <div className="w-full h-48 rounded-2xl overflow-hidden mb-4 bg-white dark:bg-black/50">
                              {project.media[0].type === 'video' ? (
                                <iframe src={project.media[0].url} className="w-full h-full object-cover" title={project.title} />
                              ) : (
                                <img src={project.media[0].url} alt={project.title} className="w-full h-full object-cover" />
                              )}
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">{project.title}</h3>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-white/60 line-clamp-3 mb-4">{project.description}</p>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-black/10 dark:border-white/10">
                          <div className="flex gap-1 flex-wrap">
                            {project.tags?.map((t, tIdx) => (
                              <span key={`${t}-${tIdx}`} className="text-[9px] font-bold px-2 py-0.5 bg-white dark:bg-white/5 rounded-md text-slate-500">#{t}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingProject(project);
                                setTagInput(project.tags?.join(', ') || '');
                                setIsEditingProject(true);
                              }}
                              className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProject(project.id)}
                              className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pagination 
                    current={pages.projects.current} 
                    total={pages.projects.total} 
                    onPageChange={(p) => fetchProjects(p)} 
                  />
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'management' && (
            <motion.div
              key="management-section"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              className="space-y-8"
            >
              {mgmtSubTab === 'saas' && (
                <SaaSTenantsManager tenants={tenants} onRefresh={fetchTenantsList} />
              )}

              {mgmtSubTab === 'blogs' && (
                <BlogCMS blogs={blogs} onRefresh={() => fetchBlogs(pages.blogs.current)} />
              )}

              {mgmtSubTab === 'users' && (
                <UsersManagement />
              )}

              {mgmtSubTab === 'system' && (
                <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-6">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">System Health & Security Configuration</h3>
                      <p className="text-xs font-semibold text-slate-500 dark:text-white/50 tracking-wider uppercase mt-1">Infrastructure diagnostics, authentication state, and service node telemetry</p>
                    </div>
                    <button
                      onClick={fetchData}
                      className="px-5 py-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Database Service</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${dbHealth?.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
                          {dbHealth?.status === 'ok' ? 'ONLINE / CONNECTED' : 'DEGRADED / CHECK CONFIG'}
                        </span>
                      </div>
                      <div className="text-xs space-y-1 font-mono text-slate-600 dark:text-white/70">
                        <p>Persistence Engine: Neon PostgreSQL</p>
                        <p>Connection Pooling: Active</p>
                        {dbHealth?.error && <p className="text-red-500">Error: {dbHealth.error}</p>}
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Admin Security Session</span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                          VERIFIED ADMIN ROLE
                        </span>
                      </div>
                      <div className="text-xs space-y-1 font-mono text-slate-600 dark:text-white/70">
                        <p>Auth Verification: Centralized Session Token</p>
                        <p>RBAC Gatekeeper: Enabled</p>
                        <p>SSRF Scraper Guard: Strict Whitelist & Private IP Blocking</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Settings Modal / Drawer */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:text-emerald-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                <Edit2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight uppercase">Security Settings</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Manage admin credentials & session security</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Password</label>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={settingsForm.currentPassword}
                  onChange={(e) => setSettingsForm({ ...settingsForm, currentPassword: e.target.value })}
                  required
                  className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={settingsForm.newPassword}
                  onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                  required
                  minLength={8}
                  className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm New Password</label>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={settingsForm.confirmPassword}
                  onChange={(e) => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                  required
                  className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-6 py-3 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-900 text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-lg"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {isEditingLead && editingLead && (
        <LeadEditForm
          editingLead={editingLead}
          setEditingLead={setEditingLead}
          editingRevenueTiers={editingRevenueTiers}
          onSave={handleSaveLead}
          onCancel={() => {
            setIsEditingLead(false);
            setEditingLead(null);
          }}
          isSaving={isSaving}
        />
      )}

      {/* Edit Project Modal */}
      {isEditingProject && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl relative my-8">
            <button
              onClick={() => setIsEditingProject(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:text-emerald-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black tracking-tight uppercase mb-6">
              {editingProject.id?.startsWith('proj_') && !projects.some(p => p.id === editingProject.id) ? 'Add New Project' : 'Edit Project'}
            </h2>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Project Title</label>
                <input
                  type="text"
                  value={editingProject.title || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                  className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  placeholder="e.g. Apex Enterprise Redesign"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                <textarea
                  rows={4}
                  value={editingProject.description || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  placeholder="Describe the architectural solution and impact..."
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  placeholder="React, Next.js, Enterprise, FinTech"
                />
              </div>

              {/* Media Section */}
              <div className="space-y-3 pt-4 border-t border-black/10 dark:border-white/10">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Media Assets ({editingProject.media?.length || 0})</label>
                
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    placeholder="Paste image URL or YouTube link..."
                    className="flex-1 bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <select
                    value={newMediaType}
                    onChange={(e) => setNewMediaType(e.target.value as any)}
                    className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddMedia}
                    className="px-5 py-3 bg-emerald-500/10 text-emerald-500 rounded-2xl text-xs font-black uppercase hover:bg-emerald-500/20 transition-all"
                  >
                    Add
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  {editingProject.media?.map((m, idx) => (
                    <div key={idx} className="relative p-3 bg-white dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-2xl flex items-center justify-between gap-2">
                      <div className="truncate text-xs font-bold text-slate-700 dark:text-white/80">{m.name || m.url}</div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextMedia = [...(editingProject.media || [])];
                          nextMedia.splice(idx, 1);
                          setEditingProject({ ...editingProject, media: nextMedia });
                        }}
                        className="text-red-500 hover:text-red-400 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsEditingProject(false)}
                className="px-6 py-3 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProject}
                disabled={isSaving}
                className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-900 text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-lg"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-black tracking-tight uppercase mb-3">{confirmModal.title}</h3>
            <p className="text-xs text-slate-600 dark:text-white/70 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg ${confirmModal.isDestructive ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400'}`}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRM Lead AI Pitch & Delivery Modal */}
      {outreachLeadModal && (
        <CrmLeadOutreachModal
          lead={outreachLeadModal.lead}
          initialChannel={outreachLeadModal.channel}
          emailConfigured={emailApiConfigured}
          onClose={() => setOutreachLeadModal(null)}
          onLogged={(msg, type = 'success') => {
            showToast(msg, type);
            setOutreachTotalCount((c) => c + 1);
            setOutreachLogsRefreshTrigger((n) => n + 1);
            fetchLeads(pages.leads.current);
          }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-bold uppercase tracking-wider ${toast.type === 'error' ? 'bg-red-500 text-white border-red-600' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-emerald-500'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
