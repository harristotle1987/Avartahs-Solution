import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  LogOut, 
  Search, 
  Terminal,
  Activity,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  BarChart3,
  History,
  ShieldAlert,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Trash2,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Lead, SiteAnalytics } from '../types';
import { getLeads, updateLeadStatus, getAnalytics, deleteLead } from '../lib/mockApi';
import { isAuthenticated, logout } from '../lib/auth';

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
    
    const ctaTriggers = last7Days.filter(d => Object.values(d.cta_clicks || {}).some(v => (v as number) > 0)).length;
    const ctaRate = totalVisitors > 0 ? Math.round((ctaTriggers / totalVisitors) * 100) : 0;
    
    const formSubmissions = last7Days.filter(d => d.submitted).length;
    const successRate = totalVisitors > 0 ? Math.round((formSubmissions / totalVisitors) * 100) : 0;
    
    const whatsappCount = last7Days.filter(d => d.whatsapp_handshake).length;
    const calendlyCount = last7Days.filter(d => d.calendly_handshake).length;
    
    const projectedRevenue = leads.reduce((acc, curr) => {
      if (curr.revenue_tier?.includes('ULTRA')) return acc + 10000;
      if (curr.revenue_tier?.includes('PRO')) return acc + 5000;
      return acc + 1500;
    }, 0);

    return {
      total_visitors: totalVisitors,
      avg_duration: avgDuration,
      cta_rate: ctaRate,
      form_submissions: formSubmissions,
      conversion_percentage: successRate,
      whatsapp_count: whatsappCount,
      calendly_count: calendlyCount,
      projected_revenue: projectedRevenue
    };
  }, [data, leads]);

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-8 mb-12 font-mono relative overflow-hidden shadow-lab">
      <div className="scanline opacity-[0.02]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
        <div>
          <div className="text-electric font-black text-[10px] tracking-[0.4em] mb-6 uppercase border-b border-slate-100 pb-2">
            SYSTEM STATUS: OPERATIONAL SUMMARY<br/>
            CYCLE PERIOD: 168 HOURS
          </div>
          
          <div className="space-y-6">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">[TRAFFIC METRICS]</div>
              <div className="text-midnight text-xs">
                - Unique Connection Nodes: <span className="text-electric font-bold">{stats.total_visitors}</span><br/>
                - Median Interaction Duration: <span className="text-electric font-bold">{stats.avg_duration}s</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">[CONVERSION LOGIC]</div>
              <div className="text-midnight text-xs">
                - Interaction Trigger Rate: <span className="text-sunset font-bold">{stats.cta_rate}%</span><br/>
                - Data Ingestion Success: <span className="text-sunset font-bold">{stats.form_submissions}</span><br/>
                - Throughput Efficiency: <span className="text-sunset font-bold">{stats.conversion_percentage}%</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-electric font-black text-[10px] tracking-[0.4em] mb-6 uppercase border-b border-slate-100 pb-2">
            [ESCALATION PROTOCOLS]
          </div>
          <div className="space-y-6">
            <div className="text-midnight text-xs">
              - Handshake Initiations (WhatsApp): <span className="text-green-600 font-bold">{stats.whatsapp_count}</span><br/>
              - Scheduled Sessions: <span className="text-electric font-bold">{stats.calendly_count}</span>
            </div>
            
            <div className="pt-4 border-t border-slate-100">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">[REVENUE PIPELINE]</div>
              <div className="text-2xl font-black text-midnight tracking-tighter">
                Projected Value: <span className="text-sunset">${stats.projected_revenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnalyticsView: React.FC<{ data: SiteAnalytics[] }> = ({ data }) => {
  const stats = useMemo(() => {
    const total = data.length;
    if (total === 0) return { total: 0, avgDuration: 0, completionRate: 0, whatsappRate: 0 };
    
    const avgDuration = data.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0) / total;
    const completed = data.filter(d => d.submitted).length;
    const completionRate = (completed / total) * 100;
    
    const whatsappClicks = data.filter(d => d.cta_clicks?.navbar > 0 || d.cta_clicks?.hero > 0).length;
    const whatsappRate = (whatsappClicks / total) * 100;
    
    return {
      total,
      avgDuration: Math.round(avgDuration),
      completionRate: Math.round(completionRate),
      whatsappRate: Math.round(whatsappRate)
    };
  }, [data]);

  const funnelData = useMemo(() => {
    const steps = [1, 2, 3, 4, 5];
    return steps.map(step => ({
      step,
      count: data.filter(d => (d.form_progress || 0) >= step).length
    }));
  }, [data]);

  const maxStepCount = Math.max(...funnelData.map(d => d.count), 1);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Network Nodes', value: stats.total, icon: <Users size={20} />, color: 'electric' },
          { label: 'Avg Latency', value: `${stats.avgDuration}s`, icon: <Clock size={20} />, color: 'sunset' },
          { label: 'Success Rate', value: `${stats.completionRate}%`, icon: <CheckCircle2 size={20} />, color: 'green-500' },
          { label: 'Escalation Node', value: `${stats.whatsappRate}%`, icon: <Zap size={20} />, color: 'electric' }
        ].map((kpi, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 bg-white border border-slate-200 rounded-[2rem] relative overflow-hidden group hover:border-sunset/30 transition-all shadow-sm"
          >
            <div className="text-electric mb-4">{kpi.icon}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">{kpi.label}</div>
            <div className="text-4xl font-black text-midnight tracking-tighter">{kpi.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[2.5rem] p-10 relative overflow-hidden shadow-sm">
          <div className="scanline opacity-[0.01]" />
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-midnight text-lg font-black tracking-tighter uppercase mb-1">Conversion Funnel Data</h3>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.4em] uppercase">User distribution across audit modules</p>
            </div>
            <BarChart3 className="text-sunset" size={24} />
          </div>

          <div className="flex items-end justify-between gap-4 h-64 px-4">
            {funnelData.map((d, i) => {
              const height = (d.count / maxStepCount) * 100;
              return (
                <div key={d.step} className="flex-1 flex flex-col items-center gap-4 group">
                  <div className="relative w-full flex-1 flex flex-col justify-end">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="w-full rounded-t-xl transition-all relative bg-slate-100 border-t-2 border-slate-300 group-hover:bg-sunset/10 group-hover:border-sunset"
                    />
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Module 0{d.step}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[2.5rem] p-8 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-midnight text-sm font-black tracking-tighter uppercase">Traffic Ledger</h3>
            <History size={16} className="text-electric animate-pulse" />
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {data.slice(0, 15).map((session, i) => (
              <motion.div 
                key={session.visitor_id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-2 hover:border-sunset/20 transition-all"
              >
                <span className="text-[9px] font-black text-electric uppercase tracking-widest">Node: {session.visitor_id.slice(0, 8)}</span>
                <div className="text-[10px] text-slate-600 font-medium">
                  {session.submitted ? (
                    <span className="text-green-600 font-black">[CONVERTED]</span>
                  ) : (session.form_progress as number) > 0 ? (
                    <span>Exited at Module {session.form_progress}</span>
                  ) : (
                    <span>Bounced from {session.exit_page}</span>
                  )}
                </div>
              </motion.div>
            ))}
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
  const [instanceID] = useState(() => {
    try { return crypto.randomUUID().slice(0, 8); } 
    catch(e) { return Math.random().toString(36).substr(2, 8); }
  });
  
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin/login');
      return;
    }
    fetchData();
  }, [navigate]);

  const handleStatusChange = async (id: string, status: Lead['status']) => {
    await updateLeadStatus(id, status);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('PERMANENTLY DELETE THIS RECORD?')) {
      await deleteLead(id);
      fetchData();
    }
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

  const formatDomain = (url: string) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-electric" size={32} />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Initializing Ops Ledger...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-600 font-mono p-4 md:p-8">
      <header className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Terminal size={20} className="text-electric" />
            <h1 className="text-midnight text-xl font-black tracking-tighter uppercase">AVARTAH // OPS_LEDGER_v4.2</h1>
          </div>
          <p className="text-[10px] font-bold text-slate-400 tracking-[0.4em] uppercase">INTERNAL PROTOCOLS // ANALYTICS & REVENUE DATA</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 mr-4 shadow-sm">
            <button 
              onClick={() => setActiveTab('leads')}
              className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${activeTab === 'leads' ? 'bg-midnight text-white' : 'text-slate-400 hover:text-midnight'}`}
            >
              <Users size={14} /> DATA_LEDGER
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-midnight text-white' : 'text-slate-400 hover:text-midnight'}`}
            >
              <Activity size={14} /> SYSTEM_METRICS
            </button>
          </div>
          <button onClick={() => { logout(); navigate('/admin/login'); }} className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all">
            <LogOut size={14} /> TERMINATE_SESSION
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto">
        <WeeklySummary data={analyticsData} leads={leads} />

        <AnimatePresence mode="wait">
          {activeTab === 'leads' ? (
            <motion.div 
              key="leads"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="relative col-span-1 md:col-span-2">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    type="text" 
                    placeholder="SEARCH_BY_NODE_OR_EMAIL..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-4 text-midnight text-[11px] font-bold tracking-widest outline-none focus:border-electric/50 transition-all shadow-sm"
                  />
                </div>
                
                <div className="flex gap-2">
                  <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-4 text-midnight text-[10px] font-black uppercase tracking-widest outline-none shadow-sm">
                    <option value="ALL">ALL_TIERS</option>
                    <option value="ULTRA">ULTRA</option>
                    <option value="PRO">PRO</option>
                    <option value="LITE">LITE</option>
                  </select>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-4 text-midnight text-[10px] font-black uppercase tracking-widest outline-none shadow-sm">
                    <option value="ALL">ALL_STATUS</option>
                    <option value="pending">PENDING</option>
                    <option value="contacted">CONTACTED</option>
                    <option value="audit_delivered">DELIVERED</option>
                    <option value="closed">CLOSED</option>
                  </select>
                </div>

                <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center justify-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-4 text-midnight text-[10px] font-black uppercase tracking-widest transition-all shadow-sm hover:bg-slate-50">
                  <ArrowUpDown size={14} /> SORT ({sortOrder.toUpperCase()})
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">ENTRY_NODE</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">EMAIL_CONTACT</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">DOMAIN</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">REVENUE_TIER</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">STATUS</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLeads.map((lead) => (
                        <React.Fragment key={lead.id}>
                          <tr 
                            className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedLeadId === lead.id ? 'bg-slate-50/50' : ''}`}
                            onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                          >
                            <td className="px-8 py-5">
                              <span className="text-[10px] font-black text-electric">#{lead.session_id?.split('-')[1] || lead.id.slice(0, 4)}</span>
                              <div className="text-[8px] font-bold text-slate-300 mt-1">{new Date(lead.created_at).toLocaleDateString()}</div>
                            </td>
                            <td className="px-8 py-5 text-[11px] font-bold text-midnight">{lead.user_email}</td>
                            <td className="px-8 py-5 text-[11px] font-bold text-midnight">
                              <div className="flex items-center gap-2">
                                {lead.target_url}
                                <a href={formatDomain(lead.target_url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-300 hover:text-sunset"><ExternalLink size={10} /></a>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className={`text-[9px] font-black px-2 py-1 rounded border ${
                                lead.revenue_tier?.includes('ULTRA') ? 'bg-purple-50 border-purple-100 text-purple-600' :
                                lead.revenue_tier?.includes('PRO') ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                'bg-slate-50 border-slate-200 text-slate-500'
                              }`}>
                                {lead.revenue_tier?.split(':')[1] || lead.revenue_tier || 'LITE'}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <select 
                                value={lead.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
                                className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border outline-none ${
                                  lead.status === 'pending' ? 'bg-orange-50 border-orange-100 text-orange-600' :
                                  lead.status === 'closed' ? 'bg-slate-100 border-slate-200 text-slate-500' :
                                  'bg-green-50 border-green-100 text-green-600'
                                }`}
                              >
                                <option value="pending">PENDING</option>
                                <option value="contacted">CONTACTED</option>
                                <option value="audit_delivered">AUDIT_DELIVERED</option>
                                <option value="closed">CLOSED</option>
                              </select>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                {expandedLeadId === lead.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(lead.id); }}
                                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          <AnimatePresence>
                            {expandedLeadId === lead.id && (
                              <tr>
                                <td colSpan={6} className="px-12 py-8 bg-slate-50/80 border-b border-slate-100">
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="grid grid-cols-1 md:grid-cols-2 gap-12"
                                  >
                                    <div>
                                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-200 pb-2">Technical Analysis</h4>
                                      <div className="space-y-4">
                                        <div>
                                          <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Identified Bottleneck:</div>
                                          <p className="text-xs text-midnight font-bold leading-relaxed">{lead.core_problem}</p>
                                        </div>
                                        <div>
                                          <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Source Interface:</div>
                                          <p className="text-xs text-midnight font-bold">{lead.cta_source}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-200 pb-2">Client Contact Interface</h4>
                                      <div className="space-y-4">
                                        <div>
                                          <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Phone Node:</div>
                                          <p className="text-xs text-midnight font-bold">{lead.user_phone}</p>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                          <a 
                                            href={`mailto:${lead.user_email}`} 
                                            className="px-4 py-2 bg-midnight text-white text-[9px] font-black rounded-lg hover:bg-electric transition-colors"
                                          >
                                            INITIATE EMAIL
                                          </a>
                                          <a 
                                            href={`https://wa.me/${lead.user_phone?.replace(/\D/g,'')}`} 
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-green-500 text-white text-[9px] font-black rounded-lg hover:bg-green-600 transition-colors"
                                          >
                                            WHATSAPP_COMMS
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <AnalyticsView data={analyticsData} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-[1600px] mx-auto mt-20 pt-8 border-t border-slate-200 flex justify-between items-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
        <span>© AVARTAH_OPS_INFRASTRUCTURE</span>
        <span>Secure Instance ID: {instanceID}</span>
      </footer>
    </div>
  );
};

export default AdminDashboard;