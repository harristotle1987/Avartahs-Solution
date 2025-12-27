
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Search, Terminal, Activity, ArrowUpDown, Clock, 
  CheckCircle2, BarChart3, History, Zap, ChevronDown, ChevronUp, 
  ExternalLink, Trash2, Loader2, Globe, Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Lead, SiteAnalytics } from '../types';
import { getLeads, updateLeadStatus, getAnalytics, deleteLead } from '../lib/mockApi';
import { isAuthenticated, logout } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';

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
    
    // Revenue projection logic based on Tier Handshake
    const projectedRevenue = leads.reduce((acc, curr) => {
      const tier = curr.revenue_tier?.toUpperCase() || '';
      if (tier.includes('GAMMA')) return acc + 5000;
      if (tier.includes('BETA')) return acc + 2000;
      return acc + 500;
    }, 0);

    return {
      total_visitors: totalVisitors,
      avg_duration: avgDuration,
      projected_revenue: projectedRevenue
    };
  }, [data, leads]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 mb-8 font-mono relative overflow-hidden shadow-lab">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
        <div>
          <div className="text-electric font-black text-[10px] tracking-[0.4em] mb-6 uppercase border-b border-slate-100 dark:border-white/5 pb-2">
            OPS STATUS: LIVE METRICS
          </div>
          <div className="space-y-4 text-xs text-midnight dark:text-white">
            <p>- Active Network Nodes: <span className="text-electric font-bold">{stats.total_visitors}</span></p>
            <p>- Median Session Time: <span className="text-electric font-bold">{stats.avg_duration}s</span></p>
          </div>
        </div>
        <div>
          <div className="text-sunset font-black text-[10px] tracking-[0.4em] mb-6 uppercase border-b border-slate-100 dark:border-white/5 pb-2">
            REVENUE PIPELINE
          </div>
          <div className="text-2xl font-black text-midnight dark:text-white tracking-tighter">
            Forecasted Yield: <span className="text-sunset">${stats.projected_revenue.toLocaleString()}</span>
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
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
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
      console.error("Backend Sync Protocol Fault:", err);
      showToast("LEDGER_SYNC_ERROR", "error");
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
      showToast("STATUS_COMMITTED");
      fetchData();
    } catch (e) {
      showToast("UPDATE_PROTOCOL_FAULT", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('CONFIRM_PERMANENT_RECORD_PURGE?')) {
      try {
        await deleteLead(id);
        showToast("DATA_NODE_DELETED");
        fetchData();
      } catch (e) {
        showToast("PURGE_PROTOCOL_FAULT", "error");
      }
    }
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
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing_Ledger...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-600 font-mono p-4 md:p-10 transition-colors">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`fixed bottom-10 right-10 z-[200] px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl border ${toast.type === 'success' ? 'bg-midnight dark:bg-white text-white dark:text-midnight border-white/10' : 'bg-red-500 text-white border-red-400'}`}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 border-b border-slate-200 dark:border-white/5 pb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Database size={22} className="text-electric" />
            <h1 className="text-midnight dark:text-white text-2xl font-black tracking-tighter uppercase">AVARTAH // OPS_LEDGER</h1>
          </div>
          <div className="flex items-center gap-4">
             <div className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-electric'}`} />
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                NODE_PROTOCOL: {isSupabaseConfigured ? 'REMOTE_SYNC_ACTIVE' : 'LOCAL_PERSISTENCE_MODE'}
             </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/5 hover:text-midnight dark:hover:text-white transition-all shadow-sm"
          >
            <Globe size={14} /> VIEW_LIVE_NODE
          </button>
          <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
            <button onClick={() => setActiveTab('leads')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === 'leads' ? 'bg-midnight dark:bg-white text-white dark:text-midnight' : 'text-slate-400'}`}>DATA_LEDGER</button>
            <button onClick={() => setActiveTab('analytics')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === 'analytics' ? 'bg-midnight dark:bg-white text-white dark:text-midnight' : 'text-slate-400'}`}>NETWORK_METRICS</button>
          </div>
          <button onClick={() => { logout(); navigate('/admin/login'); }} className="px-6 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">LOGOUT</button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto">
        <WeeklySummary data={analyticsData} leads={leads} />

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="SEARCH_BY_EMAIL_OR_ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl pl-12 pr-4 py-4 text-midnight dark:text-white text-[11px] font-bold tracking-widest outline-none focus:border-sunset transition-all shadow-sm"
            />
          </div>
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-4 text-midnight dark:text-white text-[10px] font-black uppercase tracking-widest outline-none">
            <option value="ALL">ALL_TIERS</option>
            <option value="ALPHA">ALPHA</option>
            <option value="BETA">BETA</option>
            <option value="GAMMA">GAMMA</option>
          </select>
          <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-4 text-midnight dark:text-white text-[10px] font-black uppercase tracking-widest transition-all">
            <ArrowUpDown size={14} /> SORT_ORDER ({sortOrder})
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">SESSION_ID</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">TARGET_DOMAIN</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">EMAIL_CONTACT</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">TIER</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">STATUS</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-8 py-6 text-[10px] font-black text-electric uppercase">{lead.session_id}</td>
                    <td className="px-8 py-6 text-[11px] font-bold text-midnight dark:text-white uppercase truncate max-w-[200px]">{lead.target_url}</td>
                    <td className="px-8 py-6 text-[11px] font-bold text-midnight dark:text-white">{lead.user_email}</td>
                    <td className="px-8 py-6">
                      <span className="text-[9px] font-black px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-widest">{lead.revenue_tier}</span>
                    </td>
                    <td className="px-8 py-6">
                       <select value={lead.status} onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])} className="text-[9px] font-black bg-transparent border-none outline-none text-sunset uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded transition-all">
                         <option value="pending">PENDING</option>
                         <option value="contacted">CONTACTED</option>
                         <option value="closed">CLOSED</option>
                       </select>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <a href={`https://${lead.target_url}`} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-300 hover:text-electric transition-all"><ExternalLink size={14} /></a>
                        <button onClick={() => handleDelete(lead.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                      </div>
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
