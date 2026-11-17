import React, { useState, useEffect } from 'react';
import { Building, Shield, ExternalLink, Plus, Users, CreditCard, Sparkles, CheckCircle, RefreshCw, ArrowRight, Store, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export interface TenantRecord {
  id: string;
  name: string;
  business_name?: string;
  slug: string;
  industry: string;
  owner_email: string;
  phone?: string;
  email?: string;
  country?: string;
  currency?: string;
  plan_id?: string;
  plan_name?: string;
  status?: string;
  customer_label?: string;
  catalog_label?: string;
  created_at?: string;
}

export const SaaSTenantsManager: React.FC<{
  tenants: TenantRecord[];
  onRefresh: () => void;
}> = ({ tenants, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('ALL');
  const navigate = useNavigate();

  const filteredTenants = tenants.filter(t => {
    const title = (t.name || t.business_name || '').toLowerCase();
    const owner = (t.owner_email || '').toLowerCase();
    const matchesSearch = title.includes(searchTerm.toLowerCase()) || owner.includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'ALL' || t.plan_id === filterPlan;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* SaaS Overview Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-[2.5rem] p-6 md:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-amber-500 font-mono text-[10px] font-black uppercase tracking-widest mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Multi-Tenant Business OS Management</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            SaaS Registered Businesses
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1 max-w-2xl">
            Monitor all onboarded small business tenants across Nigeria and international markets. Launch workspaces directly or register new customer accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/business-os"
            target="_blank"
            className="px-5 py-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:border-amber-500 transition-all flex items-center gap-2 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
            SaaS Public Landing
          </Link>
          <Link
            to="/business-os/register"
            className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register Business
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-500 dark:text-white/50 uppercase tracking-widest mb-1">Active Tenants</div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{tenants.length}</div>
          <div className="text-[10px] text-emerald-500 font-bold mt-1">Multi-tenant active</div>
        </div>
        <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-500 dark:text-white/50 uppercase tracking-widest mb-1">Growth & Enterprise Tiers</div>
          <div className="text-2xl md:text-3xl font-black text-amber-500">
            {tenants.filter(t => t.plan_id === 'growth' || t.plan_id === 'pro' || t.plan_id === 'starter').length}
          </div>
          <div className="text-[10px] text-slate-400 font-bold mt-1">Paid plans</div>
        </div>
        <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-500 dark:text-white/50 uppercase tracking-widest mb-1">Free Tier Businesses</div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
            {tenants.filter(t => !t.plan_id || t.plan_id === 'free').length}
          </div>
          <div className="text-[10px] text-slate-400 font-bold mt-1">Solo operators</div>
        </div>
        <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-500 dark:text-white/50 uppercase tracking-widest mb-1">Supported Regions</div>
          <div className="text-2xl md:text-3xl font-black text-emerald-400">NG / USD</div>
          <div className="text-[10px] text-slate-400 font-bold mt-1">NGN & USD Billing</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 p-4 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search business name or owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-black border border-black/10 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-amber-500 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="bg-slate-50 dark:bg-black border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-amber-500 text-slate-900 dark:text-white"
          >
            <option value="ALL">All Plans</option>
            <option value="free">Free Starter</option>
            <option value="starter">Growth Starter</option>
            <option value="growth">Business Pro</option>
            <option value="pro">Enterprise Scale</option>
          </select>

          <button
            onClick={onRefresh}
            className="p-2.5 bg-slate-50 dark:bg-black border border-black/10 dark:border-white/10 rounded-xl text-slate-600 dark:text-white hover:text-amber-500 transition-all cursor-pointer"
            title="Refresh tenants list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-[2.5rem] p-6 shadow-sm overflow-x-auto">
        {filteredTenants.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-10 h-10 text-slate-400 mx-auto mb-3 opacity-40" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No business tenants match the criteria.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="pb-4 px-4">Business / Industry</th>
                <th className="pb-4 px-4">Owner & Contact</th>
                <th className="pb-4 px-4">Subscription Plan</th>
                <th className="pb-4 px-4">Status</th>
                <th className="pb-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 text-xs">
              {filteredTenants.map((t) => {
                const bName = t.name || t.business_name || 'Business Tenant';
                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <span>{bName}</span>
                        {t.id === 'biz_demo_luxe' && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                            DEMO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-white/60 capitalize mt-0.5">
                        Industry: <span className="font-bold text-amber-500">{t.industry || 'general'}</span> • {t.country || 'NG'}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800 dark:text-white">{t.owner_email}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{t.phone || t.email || 'No phone'}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        t.plan_id === 'growth' || t.plan_id === 'pro'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : t.plan_id === 'starter'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60'
                      }`}>
                        {t.plan_name || t.plan_id || 'Free'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                        <CheckCircle className="w-3 h-3" />
                        {t.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/business-os/dashboard?tenant=${t.id}`)}
                          className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black font-black rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Open Business Workspace"
                        >
                          <span>Workspace</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
