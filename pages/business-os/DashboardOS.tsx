import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BusinessOSLayout } from '../../components/business-os/BusinessOSLayout';
import { useBusinessOS } from '../../context/BusinessOSContext';
import { businessOSApi } from '../../lib/businessOSApi';
import { BusinessOSMetrics } from '../../types';
import {
  TrendingUp,
  Receipt,
  Users,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  DollarSign,
  FileText,
  CreditCard,
  RefreshCw
} from 'lucide-react';

export const DashboardOS: React.FC = () => {
  const { activeTenant, formatCurrency, isLoading: tenantLoading } = useBusinessOS();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<BusinessOSMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchMetrics = async () => {
    if (!activeTenant) return;
    try {
      const data = await businessOSApi.getMetrics(activeTenant.id);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTenant) {
      setLoading(true);
      fetchMetrics();
    }
  }, [activeTenant?.id]);

  const customerLabel = activeTenant?.settings?.customer_label || 'Customers';
  const catalogLabel = activeTenant?.settings?.catalog_label || 'Catalogue';

  return (
    <BusinessOSLayout
      title={`${activeTenant?.name || 'Business'} Dashboard`}
      subtitle={`Live operational ledger and revenue telemetry for ${activeTenant?.name || 'your workspace'}.`}
      actionButton={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchMetrics();
            }}
            disabled={refreshing}
            className="p-2 rounded-xl bg-[#1C1F23] hover:bg-[#25282D] text-[#8E959E] hover:text-white border border-[#2B2F36] transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-[#C58A52]' : ''} />
          </button>
          <button
            onClick={() => navigate('/business-os/invoices?action=new')}
            className="px-3.5 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-[#C58A52]/20 transition-all"
          >
            <Plus size={15} />
            <span>Create Invoice</span>
          </button>
        </div>
      }
    >
      {/* Quick Action Toolbar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => navigate('/business-os/invoices?action=new')}
          className="p-3 rounded-xl bg-[#171A1E] hover:bg-[#1E2227] border border-[#26292F] hover:border-[#C58A52]/40 text-left transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#C58A52]/10 text-[#C58A52] flex items-center justify-center">
              <Receipt size={15} />
            </div>
            <ArrowUpRight size={13} className="text-[#8E959E] group-hover:text-[#C58A52] transition-colors" />
          </div>
          <div className="text-xs font-semibold text-white">New Invoice</div>
          <div className="text-[10px] text-[#8E959E]">Bill a client</div>
        </button>

        <button
          onClick={() => navigate('/business-os/invoices?tab=quotes&action=new')}
          className="p-3 rounded-xl bg-[#171A1E] hover:bg-[#1E2227] border border-[#26292F] hover:border-[#C58A52]/40 text-left transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileText size={15} />
            </div>
            <ArrowUpRight size={13} className="text-[#8E959E] group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="text-xs font-semibold text-white">Draft Quote</div>
          <div className="text-[10px] text-[#8E959E]">Send an estimate</div>
        </button>

        <button
          onClick={() => navigate('/business-os/customers?action=new')}
          className="p-3 rounded-xl bg-[#171A1E] hover:bg-[#1E2227] border border-[#26292F] hover:border-[#C58A52]/40 text-left transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users size={15} />
            </div>
            <ArrowUpRight size={13} className="text-[#8E959E] group-hover:text-blue-400 transition-colors" />
          </div>
          <div className="text-xs font-semibold text-white">Add {customerLabel}</div>
          <div className="text-[10px] text-[#8E959E]">Register contact</div>
        </button>

        <button
          onClick={() => navigate('/business-os/catalogue?action=new')}
          className="p-3 rounded-xl bg-[#171A1E] hover:bg-[#1E2227] border border-[#26292F] hover:border-[#C58A52]/40 text-left transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Plus size={15} />
            </div>
            <ArrowUpRight size={13} className="text-[#8E959E] group-hover:text-purple-400 transition-colors" />
          </div>
          <div className="text-xs font-semibold text-white">Add {catalogLabel} Item</div>
          <div className="text-[10px] text-[#8E959E]">Pricing & stock</div>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-[#16181C] border border-[#25282D] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#8E959E] mb-2">
            <span>Total Revenue Settled</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={14} />
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono mb-1">
            {formatCurrency(metrics?.totalRevenue || 0)}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <span>{formatCurrency(metrics?.paidThisMonth || 0)} received this month</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#16181C] border border-[#25282D] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#8E959E] mb-2">
            <span>Outstanding Balances</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock size={14} />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#E5A96A] font-mono mb-1">
            {formatCurrency(metrics?.outstandingBalance || 0)}
          </div>
          <div className="text-[11px] text-[#8E959E]">
            Across {metrics?.unpaidInvoicesCount || 0} unpaid or partial invoices
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#16181C] border border-[#25282D] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#8E959E] mb-2">
            <span>Total {customerLabel}</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Users size={14} />
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono mb-1">
            {metrics?.totalCustomers || 0}
          </div>
          <div className="text-[11px] text-[#8E959E]">
            +{metrics?.newCustomersThisMonth || 0} registered this month
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#16181C] border border-[#25282D] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#8E959E] mb-2">
            <span>Total Invoices Issued</span>
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Receipt size={14} />
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-mono mb-1">
            {metrics?.totalInvoices || 0}
          </div>
          <div className="text-[11px] text-[#8E959E]">
            Real-time multi-tenant database ledger
          </div>
        </div>
      </div>

      {/* Charts & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Performance Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#16181C] border border-[#25282D]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-white">Monthly Revenue History</h2>
              <p className="text-[11px] text-[#8E959E]">Recorded payment settlements over the last 6 months</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#1C1F24] border border-[#2B2F36] text-[#A6ADB5]">
              {activeTenant?.currency || 'NGN'}
            </span>
          </div>

          {/* Bar Chart Representation */}
          <div className="h-48 flex items-end justify-between gap-3 pt-6 border-b border-[#22252A] pb-3">
            {(metrics?.monthlySalesChart && metrics.monthlySalesChart.length > 0
              ? metrics.monthlySalesChart
              : [
                  { month: 'Past', revenue: 0 },
                  { month: '4m', revenue: 0 },
                  { month: '3m', revenue: 0 },
                  { month: '2m', revenue: 0 },
                  { month: 'Last', revenue: 0 },
                  { month: 'Now', revenue: 0 }
                ]
            ).map((item, idx) => {
              const maxRev = Math.max(
                ...(metrics?.monthlySalesChart?.map(m => m.revenue) || [100000]),
                100000
              );
              const heightPct = item.revenue > 0 ? Math.min(100, Math.max(12, Math.round((item.revenue / maxRev) * 100))) : 4;

              return (
                <div key={`chart-col-${item.month || 'm'}-${idx}`} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="text-[10px] text-[#8E959E] opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                    {formatCurrency(item.revenue)}
                  </div>
                  <div className="w-full max-w-[40px] bg-[#22262C] rounded-t-lg h-36 flex items-end overflow-hidden">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-gradient-to-t from-[#C58A52] to-[#E5A96A] rounded-t-lg transition-all duration-500 group-hover:brightness-125"
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-[#8E959E]">{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Activity Timeline */}
        <div className="p-5 rounded-2xl bg-[#16181C] border border-[#25282D]">
          <h2 className="text-sm font-bold text-white mb-1">Live Audit Activity</h2>
          <p className="text-[11px] text-[#8E959E] mb-4">Real-time actions in {activeTenant?.name}</p>

          <div className="space-y-3.5">
            {metrics?.recentActivities && metrics.recentActivities.length > 0 ? (
              metrics.recentActivities.map((act, actIdx) => (
                <div key={`act-${act.type || 'act'}-${act.id || 'id'}-${actIdx}`} className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-[#1C1F24] border border-[#282B31] flex items-center justify-center text-[#C58A52] shrink-0 mt-0.5">
                    {act.type === 'invoice' && <Receipt size={12} />}
                    {act.type === 'payment' && <DollarSign size={12} />}
                    {act.type === 'quotation' && <FileText size={12} />}
                    {act.type === 'customer' && <Users size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium truncate">{act.title}</div>
                    <div className="text-[10px] text-[#8E959E]">
                      {new Date(act.timestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-[#8E959E] py-6 text-center">
                No recorded actions yet. Generate an invoice or record a payment to see live telemetry.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="rounded-2xl bg-[#16181C] border border-[#25282D] overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-[#22252A]">
          <div>
            <h2 className="text-sm font-bold text-white">Recent Payment Transactions</h2>
            <p className="text-[11px] text-[#8E959E]">Latest customer settlements with receipt validation</p>
          </div>
          <button
            onClick={() => navigate('/business-os/invoices')}
            className="text-xs text-[#C58A52] hover:underline font-semibold"
          >
            View All Invoices →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141619] text-[#8E959E] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3 font-semibold">Receipt & Invoice</th>
                <th className="px-5 py-3 font-semibold">{customerLabel}</th>
                <th className="px-5 py-3 font-semibold">Payment Channel</th>
                <th className="px-5 py-3 font-semibold">Date Settled</th>
                <th className="px-5 py-3 font-semibold text-right">Amount Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202327]">
              {metrics?.recentSales && metrics.recentSales.length > 0 ? (
                metrics.recentSales.map((sale, saleIdx) => (
                  <tr key={`sale-${sale.id || 'id'}-${saleIdx}`} className="hover:bg-[#1A1D21] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-white">
                      <div className="font-mono text-xs">{sale.invoice_number}</div>
                      <div className="text-[10px] text-[#8E959E] font-mono">{(sale as any).receipt_number || sale.id}</div>
                    </td>
                    <td className="px-5 py-3.5 text-[#ECEEEF]">{sale.customer_name}</td>
                    <td className="px-5 py-3.5 text-[#8E959E]">
                      <span className="px-2 py-0.5 rounded bg-[#1C1F24] border border-[#282B31] text-[10px] font-mono uppercase">
                        {sale.payment_method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#8E959E]">
                      {new Date(sale.date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-emerald-400 text-right">
                      {formatCurrency(sale.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[#8E959E]">
                    No sales recorded yet. Click "New Invoice" to create your first bill and record payment!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </BusinessOSLayout>
  );
};
