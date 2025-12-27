
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Search, Terminal, Activity, ArrowUpDown, Clock, 
  CheckCircle2, BarChart3, History, Zap, ChevronDown, ChevronUp, 
  ExternalLink, Trash2, Loader2, Copy, Globe, Server, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Lead, SiteAnalytics } from '../types';
import { getLeads, updateLeadStatus, getAnalytics, deleteLead } from '../lib/mockApi';
import { isAuthenticated, logout } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const DiagnosticsNode: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  const runDiagnostics = async () => {
    setStatus('checking');
    setLogs(["INITIATING SYSTEM HANDSHAKE..."]);
    
    await new Promise(r => setTimeout(r, 800));

    // 1. Check Supabase
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('audit_submissions').select('count', { count: 'exact', head: true });
      if (error) {
        setLogs(prev => [...prev, `[ERR] SUPABASE_NODE_OFFLINE: ${error.message}`]);
        setStatus('failed');
        return;
      }
      setLogs(prev => [...prev, `[OK] SUPABASE_CONNECTION_SECURED (Nodes Found: ${data})`]);
    } else {
      setLogs(prev => [...prev, "[WARN] SUPABASE_ENV_MISSING: Using Local Storage Fallback"]);
    }

    // 2. Check EmailJS
    const eKey = process.env.EMAILJS_PUBLIC_KEY;
    if (eKey) {
      setLogs(prev => [...prev, `[OK] EMAILJS_GATEWAY_ACTIVE (Key: ${eKey.slice(0, 5)}...)`]);
    } else {
      setLogs(prev => [...prev, "[ERR] EMAILJS_KEY_NOT_FOUND: Notifications will fail"]);
      setStatus('failed');
      return;
    }

    setLogs(prev => [...prev, "ALL SYSTEMS OPERATIONAL."]);
    setStatus('passed');
  };

  return (
    <div className="bg-slate-950 border border-white/10 rounded-3xl p-6 mb-12 font-mono shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className={status === 'passed' ? 'text-green-500' : 'text-electric'} />
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Connectivity Diagnostics</h3>
        </div>
        <button 
          onClick={runDiagnostics}
          disabled={status === 'checking'}
          className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest"
        >
          {status === 'checking' ? 'Testing...' : 'Run Handshake'}
        </button>
      </div>

      <div className="bg-black/50 rounded-xl p-4 min-h-[100px] border border-white/5">
        {logs.length === 0 ? (
          <p className="text-[9px] text-slate-700 italic">Ready for system check...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`text-[9px] mb-1 ${log.includes('[ERR]') ? 'text-red-500' : log.includes('[OK]') ? 'text-green-500' : 'text-slate-400'}`}>
              {`> ${log}`}
            </div>
          ))
        )}
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
    
    const formSubmissions = last7Days.filter(d => d.submitted).length;
    const successRate = totalVisitors > 0 ? Math.round((formSubmissions / totalVisitors) * 100) : 0;
    
    const projectedRevenue = leads.reduce((acc, curr) => {
      if (curr.revenue_tier?.includes('GAMMA')) return acc + 5000;
      if (curr.revenue_tier?.includes('BETA')) return acc + 2000;
      return acc + 1000;
    }, 0);

    return {
      total_visitors: totalVisitors,
      avg_duration: avgDuration,
      form_submissions: formSubmissions,
      conversion_percentage: successRate,
      projected_revenue: projectedRevenue
    };
  }, [data, leads]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] p-8 mb-6 font-mono relative overflow-hidden shadow-lab transition-colors">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
        <div>
          <div className="text-electric font-black text-[10px] tracking-[0.4em] mb-6 uppercase border-b border-slate-100 dark:border-white/5 pb-2">
            OPS STATUS: LIVE METRICS
          </div>
          <div className="space-y-4 text-xs text-midnight dark:text-white">
            <p>- Total Unique Nodes: <span className="text-electric font-bold">{stats.total_visitors}</span></p>
            <p>- AVG Interaction Time: <span className="text-electric font-bold">{stats.avg_duration}s</span></p>
          </div>
        </div>
        <div>
          <div className="text-sunset font-black text-[10px] tracking-[0.4em] mb-6 uppercase border-b border-slate-100 dark:border-white/5 pb-2">
            REVENUE LOGIC
          </div>
          <div className="text-2xl font-black text-midnight dark:text-white tracking-tighter">
            Forecast: <span className="text-sunset">${stats.projected_revenue.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leads' | 'analytics'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analyticsData, setAnalyticsData] = useState<SiteAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [instanceID] = useState(() => Math.random().toString(36).substr(2, 8).toUpperCase());
  
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsRes, analyticsRes] = await Promise.all([
        getLeads(),
        getAnalytics()
      ]);
      setLeads(leadsRes);
      setAnalyticsData(analyticsRes);
    } catch (err) {
      console.error("Data Fetch Protocol Error:", err);
      showToast("SYSTEM DATA SYNC FAILED", "error");
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
      showToast("STATUS UPDATED");
      fetchData();
    } catch (e) {
      showToast("UPDATE FAILED", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('PERMANENTLY DELETE THIS RECORD?')) {
      try {
        await deleteLead(id);
        showToast("RECORD PURGED");
        fetchData();
      } catch (e) {
        showToast("DELETE FAILED", "error");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("COPIED");
  };

  const filteredLeads = useMemo(() => {
    return leads
      .filter(l => {
        const matchesSearch = l.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            l.session_id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTier = filterTier === 'ALL' || l.revenue_tier?.includes(filterTier);
        const matchesStatus = filterStatus === 'ALL' || l.status === filterStatus;
        return matchesSearch && matchesTier && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [leads, searchTerm, filterTier, filterStatus, sortOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-mono">
        <Loader2 className="animate-spin text-electric" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-600 font-mono p-4 md:p-8 transition-colors">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl border ${toast.type === 'success' ? 'bg-midnight dark:bg-white text-white dark:text-midnight border-white/10' : 'bg-red-500 text-white border-red-400'}`}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-slate-200 dark:border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Terminal size={20} className="text-electric" />
            <h1 className="text-midnight dark:text-white text-xl font-black tracking-tighter uppercase">AVARTAH // OPS_LEDGER</h1>
          </div>
          <div className="flex items-center gap-4">
             <div className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                DB_NODE: {isSupabaseConfigured ? 'REMOTE_READY' : 'LOCAL_ONLY'}
             </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/5 hover:text-midnight dark:hover:text-white transition-all shadow-sm"
          >
            <Globe size={14} /> VIEW_SITE
          </button>
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
            <button onClick={() => setActiveTab('leads')} className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all ${activeTab === 'leads' ? 'bg-midnight dark:bg-white text-white dark:text-midnight' : 'text-slate-400'}`}>DATA</button>
            <button onClick={() => setActiveTab('analytics')} className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all ${activeTab === 'analytics' ? 'bg-midnight dark:bg-white text-white dark:text-midnight' : 'text-slate-400'}`}>ANALYTICS</button>
          </div>
          <button onClick={() => { logout(); navigate('/admin/login'); }} className="px-5 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">LOGOUT</button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto">
        <DiagnosticsNode />
        <WeeklySummary data={analyticsData} leads={leads} />

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">SESSION_ID</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">DOMAIN</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">EMAIL</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">TIER</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">STATUS</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-8 py-5 text-[10px] font-black text-electric uppercase">{lead.session_id}</td>
                    <td className="px-8 py-5 text-[11px] font-bold text-midnight dark:text-white uppercase">{lead.target_url}</td>
                    <td className="px-8 py-5 text-[11px] font-bold text-midnight dark:text-white">{lead.user_email}</td>
                    <td className="px-8 py-5">
                      <span className="text-[9px] font-black px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-widest">{lead.revenue_tier}</span>
                    </td>
                    <td className="px-8 py-5">
                       <select value={lead.status} onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])} className="text-[9px] font-black bg-transparent border-none outline-none text-sunset uppercase tracking-widest cursor-pointer">
                         <option value="pending">PENDING</option>
                         <option value="contacted">CONTACTED</option>
                         <option value="closed">CLOSED</option>
                       </select>
                    </td>
                    <td className="px-8 py-5">
                      <button onClick={() => handleDelete(lead.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
