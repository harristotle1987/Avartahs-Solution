
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Search, Terminal, Activity, ArrowUpDown, Clock, 
  CheckCircle2, BarChart3, History, Zap, ChevronDown, ChevronUp, 
  ExternalLink, Trash2, Loader2, Globe, Database, MousePointer2, TrendingUp,
  Plus, Image as ImageIcon, Video, X, Edit3, Save, Layout, Sun, Moon, Upload, AlertCircle,
  ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Lead, SiteAnalytics, Project } from '../types';
import { getLeads, updateLead, updateLeadStatus, getAnalytics, deleteLead, getProjects, saveProject, deleteProject } from '../lib/mockApi';
import { isAuthenticated, logout } from '../lib/auth';
import { isNeonConfigured } from '../lib/config';
import { useTheme } from '../context/ThemeContext';

// High-fidelity mapping for revenue tiers as defined in the Audit Protocol
const TIER_DISPLAY_MAP: Record<string, string> = {
  'ALPHA': 'TIER ALPHA ($300 - $1,000)',
  'BETA': 'TIER BETA ($1,000 - $3,000)',
  'GAMMA': 'TIER GAMMA ($3,000 - $5,000+)',
  'ALPHA TIER': 'TIER ALPHA ($300 - $1,000)',
  'BETA TIER': 'TIER BETA ($1,000 - $3,000)',
  'GAMMA TIER': 'TIER GAMMA ($3,000 - $5,000+)',
  'ULTRA': 'TIER ULTRA ($10,000+)'
};

const AnalyticsView: React.FC<{ data: SiteAnalytics[] }> = ({ data }) => {
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

  const funnelData = useMemo(() => {
    const steps = [1, 2, 3, 4];
    return steps.map(step => ({
      step,
      count: data.filter(d => (d.form_progress || 0) >= step).length
    }));
  }, [data]);

  const maxStepCount = Math.max(...funnelData.map(d => d.count), 1);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {[
          { label: 'Network Nodes', value: stats.total, icon: <Globe size={18} />, color: 'text-electric' },
          { label: 'Avg Latency', value: `${stats.avgDuration}s`, icon: <Clock size={18} />, color: 'text-sunset' },
          { label: 'Success Rate', value: `${stats.completionRate}%`, icon: <CheckCircle2 size={18} />, color: 'text-green-500' },
          { label: 'Escalation Node', value: `${stats.escalationRate}%`, icon: <Zap size={18} />, color: 'text-electric' }
        ].map((kpi, i) => (
          <div key={i} className="p-4 sm:p-5 md:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[1.25rem] sm:rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm">
            <div className={`${kpi.color} mb-3 md:mb-4`}>{kpi.icon}</div>
            <div className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{kpi.label}</div>
            <div className="text-lg sm:text-xl md:text-3xl font-black text-midnight dark:text-white tracking-tighter">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-8 md:mb-10">
            <div>
              <h3 className="text-midnight dark:text-white text-sm md:text-lg font-black tracking-tighter uppercase mb-1">Conversion Funnel</h3>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase">User distribution across audit modules</p>
            </div>
            <BarChart3 className="text-sunset" size={20} />
          </div>

          <div className="flex items-end justify-between gap-1.5 sm:gap-2 md:gap-4 h-40 sm:h-48 md:h-64 px-1 sm:px-2">
            {funnelData.map((d, i) => {
              const height = (d.count / maxStepCount) * 100;
              return (
                <div key={d.step} className="flex-1 flex flex-col items-center gap-2 md:gap-3">
                  <div className="relative w-full flex-1 flex flex-col justify-end bg-slate-50 dark:bg-white/5 rounded-t-lg sm:rounded-t-xl overflow-hidden">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="w-full bg-electric/20 border-t-2 border-electric"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-midnight/40 text-white text-[8px] sm:text-[10px] font-black">
                      {d.count}
                    </div>
                  </div>
                  <div className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Step 0{d.step}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 flex flex-col shadow-sm max-h-[400px] md:max-h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-midnight dark:text-white text-[10px] md:text-sm font-black tracking-tighter uppercase">Recent Activity</h3>
            <History size={16} className="text-electric animate-pulse" />
          </div>
          
          <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {data.slice(0, 10).map((session, i) => (
              <div 
                key={session.visitor_id + i}
                className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl flex flex-col gap-1"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-black text-electric uppercase">Node: {session.visitor_id.slice(0, 8)}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{session.duration_seconds}s</span>
                </div>
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">
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
    </div>
  );
};

const WeeklySummary: React.FC<{ data: SiteAnalytics[]; leads: Lead[] }> = ({ data, leads }) => {
  const stats = useMemo(() => {
    const last7Days = data.filter(d => {
      const dDate = new Date(d.session_start);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return dDate >= weekAgo;
    });

    const totalVisitors = last7Days.length || 0;
    const totalDuration = last7Days.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0);
    const avgDuration = totalVisitors > 0 ? Math.round(totalDuration / totalVisitors) : 0;
    
    const projectedRevenue = leads.reduce((acc, curr) => {
      if (curr.status === 'closed') return acc;
      const tier = curr.revenue_tier?.toUpperCase() || '';
      if (tier.includes('ULTRA')) return acc + 10000;
      if (tier.includes('PRO')) return acc + 5000;
      if (tier.includes('GAMMA')) return acc + 4000;
      if (tier.includes('BETA')) return acc + 2000;
      if (tier.includes('ALPHA')) return acc + 650;
      return acc + 150;
    }, 0);

    return {
      total_visitors: totalVisitors,
      avg_duration: avgDuration,
      projected_revenue: projectedRevenue
    };
  }, [data, leads]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 mb-8 font-mono relative overflow-hidden shadow-lab">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative z-10">
        <div>
          <div className="text-electric font-black text-[10px] tracking-[0.4em] mb-4 md:6 uppercase border-b border-slate-100 dark:border-white/5 pb-2">
            OPS STATUS: LIVE METRICS
          </div>
          <div className="space-y-4 text-xs text-midnight dark:text-white">
            <p>- Active Network Nodes: <span className="text-electric font-bold">{stats.total_visitors}</span></p>
            <p>- Median Session Time: <span className="text-electric font-bold">{stats.avg_duration}s</span></p>
          </div>
        </div>
        <div>
          <div className="text-sunset font-black text-[10px] tracking-[0.4em] mb-4 md:6 uppercase border-b border-slate-100 dark:border-white/5 pb-2">
            REVENUE PIPELINE
          </div>
          <div className="text-xl md:text-2xl font-black text-midnight dark:text-white tracking-tighter">
            Forecasted Yield: <span className="text-sunset">${stats.projected_revenue.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leads' | 'analytics' | 'projects'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analyticsData, setAnalyticsData] = useState<SiteAnalytics[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Lead Editor State
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);

  // Project Editor State
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);

  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Confirmation Modal State
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

  // Prompt Modal State
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    initialValue: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    initialValue: '',
    onConfirm: () => {},
  });

  // Image Modal State
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    url: string;
    description: string;
  }>({
    isOpen: false,
    url: '',
    description: '',
  });

  // ... (existing state)

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsRes, analyticsRes, projectsRes] = await Promise.all([
        getLeads(),
        getAnalytics(),
        getProjects()
      ]);
      setLeads(leadsRes);
      setAnalyticsData(analyticsRes);
      setProjects(projectsRes);
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

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin/login');
      return;
    }
    fetchData();
  }, [navigate]);

  const handleStatusChange = async (id: string, status: Lead['status']) => {
    try {
      await updateLeadStatus(id, status);
      showToast("Status Updated");
      fetchData();
    } catch (e) {
      showToast("Update Error", "error");
    }
  };

  const handleSaveLead = async () => {
    if (!editingLead || !editingLead.id) return;
    
    setIsSaving(true);
    try {
      await updateLead(editingLead.id, editingLead);
      showToast("Lead Updated");
      setIsEditingLead(false);
      setEditingLead(null);
      await fetchData();
    } catch (e) {
      showToast("Lead Update Error", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
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
          fetchData();
        } catch (e) {
          showToast("Deletion Error", "error");
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSaveProject = async () => {
    if (!editingProject) return;

    if (!editingProject.title?.trim() || !editingProject.description?.trim()) {
      showToast("Title and Description Required", "error");
      return;
    }

    setIsSaving(true);
    try {
      // Process tags from the tagInput string
      const processedTags = tagInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const cleanProject = {
        ...editingProject,
        tags: processedTags
      };

      await saveProject(cleanProject);
      showToast("Project Saved");
      setIsEditingProject(false);
      setEditingProject(null);
      setTagInput('');
      await fetchData();
    } catch (e) {
      console.error("Save Error:", e);
      const errorMsg = e instanceof Error ? e.message : "Save Error";
      showToast(errorMsg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
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
          fetchData();
        } catch (e) {
          showToast("Delete Error", "error");
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addMedia = () => {
    if (!newMediaUrl) return;
    
    // YouTube detection
    const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = newMediaUrl.match(youtubeRegex);
    
    let detectedType: 'image' | 'video' = newMediaType;
    let finalUrl = newMediaUrl;

    if (youtubeMatch) {
      detectedType = 'video';
      finalUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    } else {
      const urlLower = newMediaUrl.toLowerCase();
      if (urlLower.match(/\.(mp4|webm|ogg|mov)$/)) {
        detectedType = 'video';
      } else if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)$/)) {
        detectedType = 'image';
      }
    }

    const media = editingProject?.media || [];
    setEditingProject({
      ...editingProject,
      media: [...media, { url: finalUrl, type: detectedType, name: youtubeMatch ? 'YouTube Video' : `Media ${media.length + 1}` }]
    });
    setNewMediaUrl('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newMediaItems: { url: string, type: 'image' | 'video', name: string }[] = [];
    
    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
          showToast(`Invalid File: ${file.name}`, "error");
          continue;
        }

        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error("Read Failed"));
          reader.readAsDataURL(file);
        });

        newMediaItems.push({
          url,
          type: isVideo ? 'video' : 'image',
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
      console.error("Upload Error:", err);
      showToast("Upload Failed", "error");
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removeMedia = (index: number) => {
    const media = [...(editingProject?.media || [])];
    media.splice(index, 1);
    setEditingProject({ ...editingProject, media });
  };

  const filteredLeads = useMemo(() => {
    return leads
      .filter(l => {
        const email = l.user_email?.toLowerCase() || '';
        const sid = l.session_id?.toLowerCase() || '';
        const matchesSearch = email.includes(searchTerm.toLowerCase()) || sid.includes(searchTerm.toLowerCase());
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-electric" size={40} />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing Ledger...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 md:p-8 lg:p-10 transition-colors">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`fixed bottom-10 right-10 z-[200] px-6 py-4 rounded-2xl font-semibold text-xs uppercase tracking-widest shadow-2xl border ${toast.type === 'success' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-700' : 'bg-red-500 text-white border-red-400'}`}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12 border-b border-zinc-200 dark:border-zinc-800 pb-10">
        <div className="w-full lg:w-auto">
          <div className="flex items-center gap-3 mb-2">
            <Database size={24} className="text-indigo-600" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Control Center</h1>
          </div>
          <div className="flex items-center gap-4">
             <div className={`w-2 h-2 rounded-full ${isNeonConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`} />
             <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                System Status: {isNeonConfigured ? 'Connected' : 'Local Mode'}
             </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full lg:w-auto">
          <button 
            onClick={toggleTheme}
            className="p-3 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:text-indigo-600 transition-all shadow-sm"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button 
            onClick={() => navigate('/')} 
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-semibold uppercase tracking-wider border border-zinc-200 dark:border-zinc-800 hover:text-indigo-600 transition-all shadow-sm"
          >
            <Globe size={16} className="shrink-0" /> View Live Site
          </button>
          
          <div className="flex-1 lg:flex-none flex bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <button onClick={() => setActiveTab('leads')} className={`flex-1 px-6 py-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Data Ledger</button>
            <button onClick={() => setActiveTab('projects')} className={`flex-1 px-6 py-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'projects' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Projects</button>
            <button onClick={() => setActiveTab('analytics')} className={`flex-1 px-6 py-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Metrics</button>
          </div>

          <button onClick={() => { logout(); navigate('/admin/login'); }} className="flex-1 lg:flex-none px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-xs font-semibold uppercase tracking-wider border border-red-100 dark:border-red-900/30 whitespace-nowrap text-center">Logout</button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto">
        <WeeklySummary data={analyticsData} leads={leads} />

        <AnimatePresence mode="wait">
          {activeTab === 'leads' ? (
            <motion.div 
              key="leads-tab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                <div className="relative w-full lg:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search by ID or Email..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-electric transition-all shadow-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <select 
                    value={filterTier}
                    onChange={(e) => setFilterTier(e.target.value)}
                    className="flex-1 lg:flex-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-[9px] font-black uppercase tracking-widest outline-none shadow-sm"
                  >
                    <option value="ALL">All Tiers</option>
                    <option value="ALPHA">ALPHA</option>
                    <option value="BETA">BETA</option>
                    <option value="GAMMA">GAMMA</option>
                    <option value="ULTRA">ULTRA</option>
                  </select>

                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="flex-1 lg:flex-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-[9px] font-black uppercase tracking-widest outline-none shadow-sm"
                  >
                    <option value="ALL">All Status</option>
                    <option value="pending">PENDING</option>
                    <option value="contacted">CONTACTED</option>
                    <option value="closed">CLOSED</option>
                  </select>

                  <button 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl text-slate-400 hover:text-electric transition-all shadow-sm"
                  >
                    <ArrowUpDown size={18} />
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-lab">
                {/* Desktop Table View */}
                <div className="hidden xl:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/5">
                        <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Timestamp</th>
                        <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Node Identity</th>
                        <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Website</th>
                        <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Phone</th>
                        <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Revenue Tier</th>
                        <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                        <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              {new Date(lead.created_at || '').toLocaleDateString()}
                            </div>
                            <div className="text-[9px] font-black text-slate-300 uppercase">
                              {new Date(lead.created_at || '').toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-xs font-black text-midnight dark:text-white uppercase tracking-tight">{lead.user_email || 'Anonymous User'}</div>
                            <div className="text-[9px] font-bold text-electric uppercase tracking-widest">SID: {lead.session_id?.slice(0, 12)}...</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase truncate max-w-[150px]">
                              {lead.target_url || 'N/A'}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                              {lead.user_phone || 'N/A'}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                              lead.revenue_tier?.includes('GAMMA') ? 'bg-sunset/10 text-sunset' :
                              lead.revenue_tier?.includes('BETA') ? 'bg-electric/10 text-electric' :
                              'bg-slate-100 dark:bg-white/5 text-slate-400'
                            }`}>
                              {lead.revenue_tier || 'UNDETERMINED'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <select 
                              value={lead.status}
                              onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
                              className={`bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer ${
                                lead.status === 'closed' ? 'text-green-500' :
                                lead.status === 'contacted' ? 'text-electric' :
                                'text-slate-400'
                              }`}
                            >
                              <option value="pending">PENDING</option>
                              <option value="contacted">CONTACTED</option>
                              <option value="closed">CLOSED</option>
                            </select>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingLead(lead); setIsEditingLead(true); }}
                                className="p-2 text-slate-300 hover:text-electric transition-colors"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDelete(lead.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="xl:hidden divide-y divide-slate-50 dark:divide-white/5">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-midnight dark:text-white uppercase tracking-tight mb-1">{lead.user_email || 'Anonymous User'}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(lead.created_at || '').toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setEditingLead(lead); setIsEditingLead(true); }}
                            className="p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-slate-400 hover:text-electric transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(lead.id)}
                            className="p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Website</div>
                          <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{lead.target_url || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</div>
                          <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{lead.user_phone || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue Tier</div>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            lead.revenue_tier?.includes('GAMMA') ? 'bg-sunset/10 text-sunset' :
                            lead.revenue_tier?.includes('BETA') ? 'bg-electric/10 text-electric' :
                            'bg-slate-100 dark:bg-white/5 text-slate-400'
                          }`}>
                            {lead.revenue_tier || 'UNDETERMINED'}
                          </span>
                        </div>
                        <div>
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</div>
                          <select 
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
                            className={`bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer ${
                              lead.status === 'closed' ? 'text-green-500' :
                              lead.status === 'contacted' ? 'text-electric' :
                              'text-slate-400'
                            }`}
                          >
                            <option value="pending">PENDING</option>
                            <option value="contacted">CONTACTED</option>
                            <option value="closed">CLOSED</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredLeads.length === 0 && (
                  <div className="p-20 text-center">
                    <Terminal className="mx-auto text-slate-200 dark:text-white/5 mb-4" size={48} />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">No Data Found</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'projects' ? (
            <motion.div 
              key="projects-tab"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-midnight dark:text-white text-xl font-black uppercase tracking-tighter">Project Portfolio</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage your showcased work</p>
                </div>
                <button 
                  onClick={() => { 
                    setEditingProject({}); 
                    setTagInput('');
                    setIsEditingProject(true); 
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-electric text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-electric/90 transition-all shadow-lg shadow-electric/20"
                >
                  <Plus size={16} /> Add New Project
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {projects.map((project) => (
                  <motion.div 
                    key={project.id} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
                  >
                    <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden cursor-pointer" onClick={() => project.media?.[0] && setImageModal({ isOpen: true, url: project.media[0].url, description: project.description })}>
                      {project.media?.[0] ? (
                        project.media[0].type === 'image' ? (
                          <img src={project.media[0].url} alt={project.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : project.media[0].url.includes('youtube.com/embed') ? (
                          <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
                            <Video size={40} className="text-zinc-700" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white bg-red-600 px-3 py-1 rounded-full">YOUTUBE</span>
                            </div>
                          </div>
                        ) : (
                          <video src={project.media[0].url} className="w-full h-full object-cover" muted />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <ImageIcon size={40} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-zinc-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            setEditingProject(project); 
                            setTagInput(project.tags?.join(', ') || '');
                            setIsEditingProject(true); 
                          }} 
                          className="p-3 bg-white text-zinc-900 rounded-full hover:scale-110 transition-transform"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} className="p-3 bg-red-600 text-white rounded-full hover:scale-110 transition-transform"><Trash2 size={18} /></button>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{project.title}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4">{project.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {project.tags?.map(tag => (
                          <span key={tag} className="text-[10px] font-semibold px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {isEditingProject && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-midnight/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative"
                  >
                    <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                      <h3 className="text-midnight dark:text-white text-lg font-black uppercase tracking-tighter">
                        {editingProject?.id ? 'Edit Project' : 'New Project'}
                      </h3>
                      <button onClick={() => setIsEditingProject(false)} className="p-2 text-slate-400 hover:text-midnight dark:hover:text-white"><X size={24} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Project Title</label>
                            <input 
                              type="text" 
                              value={editingProject?.title || ''}
                              onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-electric transition-all"
                              placeholder="Enter project name..."
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
                            <textarea 
                              rows={4}
                              value={editingProject?.description || ''}
                              onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-electric transition-all resize-none"
                              placeholder="Describe the project logic and results..."
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tags (comma separated)</label>
                            <input 
                              type="text" 
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-electric transition-all"
                              placeholder="UI/UX, React, Revenue..."
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Project Website Link</label>
                            <input 
                              type="url" 
                              value={editingProject?.link || ''}
                              onChange={(e) => setEditingProject({ ...editingProject, link: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-electric transition-all"
                              placeholder="https://example.com"
                            />
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Media Assets</label>
                            <div className="flex flex-col gap-4 mb-4">
                              <div className="flex gap-2">
                                <select 
                                  value={newMediaType}
                                  onChange={(e) => setNewMediaType(e.target.value as 'image' | 'video')}
                                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-[10px] font-black uppercase outline-none"
                                >
                                  <option value="image">IMG</option>
                                  <option value="video">VID</option>
                                </select>
                                <input 
                                  type="text" 
                                  value={newMediaUrl}
                                  onChange={(e) => setNewMediaUrl(e.target.value)}
                                  className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                                  placeholder="Paste media URL..."
                                />
                                <button onClick={addMedia} className="p-3 bg-midnight dark:bg-white text-white dark:text-midnight rounded-xl hover:scale-105 transition-transform"><Plus size={18} /></button>
                              </div>
                              
                              <div className="relative">
                                <input 
                                  type="file" 
                                  id="media-upload"
                                  className="hidden" 
                                  accept="image/*,video/*"
                                  multiple
                                  onChange={handleFileUpload}
                                  disabled={isUploading}
                                />
                                <label 
                                  htmlFor="media-upload"
                                  className={`w-full flex items-center justify-center gap-3 px-4 py-4 bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl cursor-pointer hover:border-electric transition-all group ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 size={18} className="animate-spin text-electric" />
                                      <span className="text-[10px] font-black text-electric uppercase tracking-widest">Processing Files...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload size={18} className="text-slate-400 group-hover:text-electric transition-colors" />
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-electric transition-colors">Upload Images or Videos</span>
                                    </>
                                  )}
                                </label>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              {editingProject?.media?.map((m, idx) => (
                                <div key={idx} className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 group border border-slate-200 dark:border-white/5">
                                  {m.type === 'image' ? (
                                    <img src={m.url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                  ) : m.url.includes('youtube.com/embed') ? (
                                    <div className="w-full h-full bg-midnight flex items-center justify-center">
                                      <Video size={32} className="text-white/20" />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[8px] font-black text-white bg-red-600 px-2 py-1 rounded">YOUTUBE</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <video src={m.url} className="w-full h-full object-cover" muted />
                                  )}
                                  <div className="absolute inset-0 bg-midnight/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => {
                                        setPromptModal({
                                          isOpen: true,
                                          title: 'Rename Media Asset',
                                          initialValue: m.name,
                                          onConfirm: (newName) => {
                                            if (newName) {
                                              const media = [...(editingProject?.media || [])];
                                              media[idx] = { ...media[idx], name: newName };
                                              setEditingProject({ ...editingProject, media });
                                            }
                                            setPromptModal(prev => ({ ...prev, isOpen: false }));
                                          }
                                        });
                                      }}
                                      className="p-1.5 bg-white text-midnight rounded-lg hover:scale-110 transition-transform"
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                    <div className="flex flex-col gap-1">
                                      <button 
                                        onClick={() => {
                                          if (idx === 0) return;
                                          const media = [...(editingProject?.media || [])];
                                          // Move to top
                                          const item = media.splice(idx, 1)[0];
                                          media.unshift(item);
                                          setEditingProject({ ...editingProject, media });
                                        }}
                                        title="Set as Default (Move to Top)"
                                        className="p-1 bg-sunset text-white rounded-md hover:scale-110 transition-transform disabled:opacity-30"
                                        disabled={idx === 0}
                                      >
                                        <ArrowUpRight size={10} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          if (idx === 0) return;
                                          const media = [...(editingProject?.media || [])];
                                          [media[idx], media[idx - 1]] = [media[idx - 1], media[idx]];
                                          setEditingProject({ ...editingProject, media });
                                        }}
                                        className="p-1 bg-white text-midnight rounded-md hover:bg-electric hover:text-white transition-colors disabled:opacity-30"
                                        disabled={idx === 0}
                                      >
                                        <ChevronUp size={10} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const media = [...(editingProject?.media || [])];
                                          if (idx === media.length - 1) return;
                                          [media[idx], media[idx + 1]] = [media[idx + 1], media[idx]];
                                          setEditingProject({ ...editingProject, media });
                                        }}
                                        className="p-1 bg-white text-midnight rounded-md hover:bg-electric hover:text-white transition-colors disabled:opacity-30"
                                        disabled={idx === (editingProject?.media?.length || 0) - 1}
                                      >
                                        <ChevronDown size={10} />
                                      </button>
                                    </div>
                                    <button onClick={() => removeMedia(idx)} className="p-1.5 bg-red-500 text-white rounded-lg hover:scale-110 transition-transform"><X size={12} /></button>
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-midnight/40 backdrop-blur-sm">
                                    <div className="text-[8px] font-black text-white uppercase truncate">{m.name}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 border-t border-slate-100 dark:border-white/5 flex justify-end gap-4">
                      <button 
                        onClick={() => setIsEditingProject(false)} 
                        disabled={isSaving}
                        className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-midnight dark:hover:text-white transition-colors disabled:opacity-50"
                      >
                        CANCEL
                      </button>
                      <button 
                        onClick={handleSaveProject} 
                        disabled={isSaving}
                        className="flex items-center gap-2 px-8 py-3 bg-electric text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-electric/90 transition-all shadow-lg shadow-electric/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> SAVING...
                          </>
                        ) : (
                          <>
                            <Save size={16} /> Commit Changes
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          ) : (
            <AnalyticsView data={analyticsData} />
          )}
        </AnimatePresence>
      </main>
      
      {/* Lead Editor Modal */}
      <AnimatePresence>
        {isEditingLead && editingLead && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-midnight/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.02]">
                <div>
                  <h2 className="text-2xl font-black text-midnight dark:text-white uppercase tracking-tighter">Edit Lead Packet</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">ID: {editingLead.id}</p>
                </div>
                <button 
                  onClick={() => setIsEditingLead(false)}
                  className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">User Email</label>
                    <input 
                      type="email"
                      value={editingLead.user_email || ''}
                      onChange={(e) => setEditingLead({ ...editingLead, user_email: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl text-sm font-bold text-midnight dark:text-white focus:ring-2 focus:ring-electric/20 outline-none transition-all"
                      placeholder="Email Address"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">User Phone</label>
                    <input 
                      type="tel"
                      value={editingLead.user_phone || ''}
                      onChange={(e) => setEditingLead({ ...editingLead, user_phone: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl text-sm font-bold text-midnight dark:text-white focus:ring-2 focus:ring-electric/20 outline-none transition-all"
                      placeholder="Phone Number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Website URL</label>
                  <div className="relative">
                    <Globe className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="url"
                      value={editingLead.target_url || ''}
                      onChange={(e) => setEditingLead({ ...editingLead, target_url: e.target.value })}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl text-sm font-bold text-midnight dark:text-white focus:ring-2 focus:ring-electric/20 outline-none transition-all"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Revenue Tier</label>
                    <select 
                      value={editingLead.revenue_tier || ''}
                      onChange={(e) => setEditingLead({ ...editingLead, revenue_tier: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl text-sm font-bold text-midnight dark:text-white focus:ring-2 focus:ring-electric/20 outline-none transition-all appearance-none"
                    >
                      <option value="ALPHA">TIER ALPHA ($300 - $1,000)</option>
                      <option value="BETA">TIER BETA ($1,000 - $3,000)</option>
                      <option value="GAMMA">TIER GAMMA ($3,000 - $5,000+)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Process Status</label>
                    <select 
                      value={editingLead.status || 'pending'}
                      onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as Lead['status'] })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl text-sm font-bold text-midnight dark:text-white focus:ring-2 focus:ring-electric/20 outline-none transition-all appearance-none"
                    >
                      <option value="pending">PENDING</option>
                      <option value="contacted">CONTACTED</option>
                      <option value="delivered">Audit Delivered</option>
                      <option value="closed">CLOSED</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex justify-end gap-4">
                <button 
                  onClick={() => setIsEditingLead(false)}
                  className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-midnight dark:hover:text-white transition-colors"
                >
                  Abort Changes
                </button>
                <button 
                  onClick={handleSaveLead}
                  disabled={isSaving}
                  className="px-8 py-4 bg-electric hover:bg-electric/90 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-electric/20 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> SYNCING...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Commit Updates
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-midnight/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <AlertCircle className={confirmModal.isDestructive ? 'text-red-500' : 'text-electric'} size={24} />
                <h3 className="text-midnight dark:text-white text-lg font-black uppercase tracking-tighter">{confirmModal.title}</h3>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-8">
                {confirmModal.message}
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-midnight dark:hover:text-white transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg ${confirmModal.isDestructive ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-electric hover:bg-electric/90 shadow-electric/20'}`}
                >
                  {confirmModal.confirmText || 'CONFIRM'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Prompt Modal */}
      <AnimatePresence>
        {promptModal.isOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-midnight/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <Edit3 className="text-electric" size={24} />
                <h3 className="text-midnight dark:text-white text-lg font-black uppercase tracking-tighter">{promptModal.title}</h3>
              </div>
              <div className="mb-8">
                <input 
                  autoFocus
                  type="text"
                  defaultValue={promptModal.initialValue}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      promptModal.onConfirm((e.target as HTMLInputElement).value);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-electric transition-all"
                  id="prompt-input"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-midnight dark:hover:text-white transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={() => {
                    const input = document.getElementById('prompt-input') as HTMLInputElement;
                    promptModal.onConfirm(input.value);
                  }}
                  className="px-6 py-3 bg-electric text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-electric/90 transition-all shadow-lg shadow-electric/20"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Image Modal */}
        <AnimatePresence>
          {imageModal.isOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-midnight/90 backdrop-blur-md"
              onClick={() => setImageModal({ isOpen: false, url: '', description: '' })}
            >
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] max-w-2xl w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <img src={imageModal.url} alt="Project" className="w-full rounded-xl mb-4" referrerPolicy="no-referrer" />
                <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">{imageModal.description}</p>
                <button 
                  onClick={() => setImageModal({ isOpen: false, url: '', description: '' })}
                  className="mt-6 w-full py-3 bg-slate-100 dark:bg-white/5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
