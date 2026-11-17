import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X
} from 'lucide-react';
import {
  CrmOutreachLog,
  CrmOutreachSummary,
  Lead,
  OutreachDeliveryStatus
} from '../types';
import {
  generateCrmLeadPitch,
  getCrmOutreachLogs,
  sendOrLogCrmLeadOutreach,
  updateCrmOutreachLogStatus
} from '../lib/api';
import { buildMailtoUrl, buildWhatsAppUrl } from '../lib/prospects';

const DELIVERY_STATUS_OPTIONS: OutreachDeliveryStatus[] = [
  'DRAFT_OPENED',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'FAILED',
  'BOUNCED',
  'REPLIED'
];

const DELIVERY_STATUS_LABELS: Record<OutreachDeliveryStatus, string> = {
  DRAFT_OPENED: 'Draft Opened',
  QUEUED: 'Queued',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  BOUNCED: 'Bounced',
  REPLIED: 'Replied'
};

const DELIVERY_STATUS_STYLES: Record<OutreachDeliveryStatus, string> = {
  DRAFT_OPENED: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30',
  QUEUED: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30',
  SENT: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30',
  DELIVERED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30',
  BOUNCED: 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30',
  REPLIED: 'bg-[#C58A52]/15 text-[#9A6532] dark:text-[#E0A96D] border-[#C58A52]/40'
};

const PROVIDER_LABELS: Record<string, string> = {
  resend: 'Resend API',
  mailto: 'Email Client (mailto)',
  whatsapp_web: 'WhatsApp Web',
  manual: 'Manual Log'
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

interface CrmOutreachLogsViewProps {
  leadFilterId?: string | null;
  leadFilterName?: string | null;
  onClearLeadFilter?: () => void;
  onToast?: (message: string, type?: 'success' | 'error') => void;
  refreshTrigger?: number;
}

export const CrmOutreachLogsView: React.FC<CrmOutreachLogsViewProps> = ({
  leadFilterId,
  leadFilterName,
  onClearLeadFilter,
  onToast,
  refreshTrigger = 0
}) => {
  const [logs, setLogs] = useState<CrmOutreachLog[]>([]);
  const [summary, setSummary] = useState<CrmOutreachSummary>({
    total: 0,
    email_count: 0,
    whatsapp_count: 0,
    draft_opened_count: 0,
    sent_count: 0,
    delivered_count: 0,
    failed_count: 0,
    replied_count: 0
  });
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [channelFilter, setChannelFilter] = useState<'ALL' | 'email' | 'whatsapp'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [inspectedLog, setInspectedLog] = useState<CrmOutreachLog | null>(null);
  const [failureNoteDraft, setFailureNoteDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [leadFilterId, channelFilter, statusFilter]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getCrmOutreachLogs({
        channel: channelFilter,
        delivery_status: statusFilter,
        lead_id: leadFilterId || undefined,
        search: debouncedSearch || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      setLogs(res.logs || []);
      setSummary(
        res.summary || {
          total: res.total || 0,
          email_count: 0,
          whatsapp_count: 0,
          draft_opened_count: 0,
          sent_count: 0,
          delivered_count: 0,
          failed_count: 0,
          replied_count: 0
        }
      );
      setEmailConfigured(Boolean(res.emailConfigured));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load outreach delivery logs.');
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter, leadFilterId, debouncedSearch, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, refreshTrigger]);

  const handleStatusUpdate = async (
    log: CrmOutreachLog,
    nextStatus: OutreachDeliveryStatus,
    customError?: string | null
  ) => {
    setUpdatingId(log.id);
    try {
      const res = await updateCrmOutreachLogStatus(log.id, {
        delivery_status: nextStatus,
        error_message:
          customError !== undefined
            ? customError
            : nextStatus === 'FAILED' || nextStatus === 'BOUNCED'
            ? log.error_message || 'Marked failed by administrator'
            : null
      });
      const updated = res.log;
      setLogs((prev) =>
        prev.map((item) =>
          item.id === log.id
            ? {
                ...item,
                delivery_status: (updated.delivery_status as OutreachDeliveryStatus) || nextStatus,
                error_message: updated.error_message ?? null,
                updated_at: updated.updated_at || new Date().toISOString()
              }
            : item
        )
      );
      if (inspectedLog?.id === log.id) {
        setInspectedLog((prev) =>
          prev
            ? {
                ...prev,
                delivery_status: (updated.delivery_status as OutreachDeliveryStatus) || nextStatus,
                error_message: updated.error_message ?? null,
                updated_at: updated.updated_at || new Date().toISOString()
              }
            : null
        );
      }
      onToast?.(`Delivery status updated to ${DELIVERY_STATUS_LABELS[nextStatus]}`, 'success');
      loadLogs();
    } catch (err: any) {
      onToast?.(err?.message || 'Failed to update delivery status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCopyBody = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      onToast?.('Clipboard copy unavailable', 'error');
    }
  };

  const totalPages = Math.max(1, Math.ceil((summary.total || 0) / pageSize));

  return (
    <div className="space-y-6">
      {/* Header & Email Provider Status */}
      <div className="bg-white dark:bg-[#141619] border border-black/10 dark:border-[#262B30] rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-black tracking-tight uppercase text-slate-900 dark:text-[#F2F1ED]">
                Outreach Delivery Log
              </h2>
              {leadFilterId && (
                <button
                  type="button"
                  onClick={onClearLeadFilter}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#C58A52]/15 text-[#9A6532] dark:text-[#E0A96D] border border-[#C58A52]/30 text-xs font-semibold cursor-pointer"
                >
                  <span>Filtered Lead: {leadFilterName || leadFilterId}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#A3A9AF] mt-1">
              Persistent audit ledger for AI-generated Email and WhatsApp outreach pitches across CRM leads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-medium text-slate-600 dark:text-[#A3A9AF]">
              Server Email API:{' '}
              <span className={emailConfigured ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-300 font-semibold'}>
                {emailConfigured ? 'Resend Active' : 'Client Mailto / WhatsApp Web'}
              </span>
            </div>
            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1D2126] border border-black/10 dark:border-[#30363B] text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-[#F2F1ED] hover:border-[#C58A52] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1A1D21] border border-black/5 dark:border-[#262B30]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#8E969E]">Total Dispatches</div>
            <div className="text-2xl font-black text-slate-900 dark:text-[#F2F1ED] mt-1 tabular-nums">{summary.total}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1A1D21] border border-black/5 dark:border-[#262B30]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">Email Pitches</div>
            <div className="text-2xl font-black text-slate-900 dark:text-[#F2F1ED] mt-1 tabular-nums">{summary.email_count}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1A1D21] border border-black/5 dark:border-[#262B30]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">WhatsApp Pitches</div>
            <div className="text-2xl font-black text-slate-900 dark:text-[#F2F1ED] mt-1 tabular-nums">{summary.whatsapp_count}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1A1D21] border border-black/5 dark:border-[#262B30]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Sent / Delivered</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {summary.sent_count + summary.delivered_count}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1A1D21] border border-black/5 dark:border-[#262B30]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-300">Drafts / Replies</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-300 mt-1 tabular-nums">
              {summary.draft_opened_count} / {summary.replied_count}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1A1D21] border border-black/5 dark:border-[#262B30]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-500">Failed / Bounced</div>
            <div className="text-2xl font-black text-red-500 mt-1 tabular-nums">{summary.failed_count}</div>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by business, recipient email/phone, subject, or operator..."
            className="w-full min-h-[44px] bg-white dark:bg-[#141619] border border-black/10 dark:border-[#262B30] rounded-xl pl-11 pr-4 py-2.5 text-base sm:text-sm font-medium text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 outline-none focus:border-[#C58A52]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-white dark:bg-[#141619] border border-black/10 dark:border-[#262B30] rounded-xl p-1">
            {(['ALL', 'email', 'whatsapp'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  channelFilter === ch
                    ? 'bg-[#C58A52] text-[#111315]'
                    : 'text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {ch === 'ALL' ? 'All Channels' : ch === 'email' ? 'Email' : 'WhatsApp'}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by delivery status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[44px] bg-white dark:bg-[#141619] border border-black/10 dark:border-[#262B30] rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52]"
          >
            <option value="ALL">All Statuses</option>
            {DELIVERY_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {DELIVERY_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Ledger */}
      <div className="bg-white dark:bg-[#141619] border border-black/10 dark:border-[#262B30] rounded-3xl overflow-hidden shadow-sm">
        {loading && logs.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-[#A3A9AF]">
            <Loader2 className="w-6 h-6 animate-spin text-[#C58A52]" />
            <span className="text-xs font-semibold uppercase tracking-widest">Loading outreach delivery history...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700 dark:text-[#F2F1ED]">
              No outreach delivery records match the current filters.
            </p>
            <p className="text-xs text-slate-500 dark:text-[#A3A9AF]">
              Open an Email or WhatsApp composer from CRM Leads Ledger or Prospecting Engine to log your first outreach pitch.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/10 dark:border-[#262B30] text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-[#8E969E]">
                    <th className="py-4 px-5">Business / Lead</th>
                    <th className="py-4 px-4">Channel &amp; Route</th>
                    <th className="py-4 px-4">Recipient &amp; Pitch</th>
                    <th className="py-4 px-4">Delivery Status</th>
                    <th className="py-4 px-4">Dispatched</th>
                    <th className="py-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-[#262B30] text-xs">
                  {logs.map((log) => {
                    const isWhatsApp = String(log.channel).toLowerCase() === 'whatsapp';
                    const statusStyle =
                      DELIVERY_STATUS_STYLES[log.delivery_status] || DELIVERY_STATUS_STYLES.DRAFT_OPENED;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-[#1A1D21] transition-colors">
                        <td className="py-4 px-5 align-top">
                          <div className="font-bold text-slate-900 dark:text-[#F2F1ED]">
                            {log.business_name || 'CRM Contact'}
                          </div>
                          {log.lead_contact_name && log.lead_contact_name !== log.business_name && (
                            <div className="text-[11px] text-slate-500 dark:text-[#A3A9AF] mt-0.5">
                              Contact: {log.lead_contact_name}
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-slate-400 dark:text-[#747C84] mt-1">
                            {log.crm_lead_id || log.prospect_id || log.id}
                          </div>
                        </td>

                        <td className="py-4 px-4 align-top">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-[#F2F1ED]">
                            {isWhatsApp ? (
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Mail className="w-3.5 h-3.5 text-sky-500" />
                            )}
                            <span>{isWhatsApp ? 'WhatsApp' : 'Email'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-[#A3A9AF] mt-1">
                            {PROVIDER_LABELS[log.provider || ''] || log.provider || 'Direct'}
                          </div>
                          {log.ai_generated && (
                            <div className="text-[10px] font-semibold text-[#C58A52] mt-0.5 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span>AI Pitch</span>
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top max-w-md">
                          <div className="font-mono text-[11px] text-slate-800 dark:text-[#F2F1ED] truncate">
                            {log.recipient}
                          </div>
                          {log.subject && (
                            <div className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5 truncate">
                              {log.subject}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-[#A3A9AF] mt-0.5 line-clamp-2">
                            {log.message_body}
                          </div>
                          {log.error_message && (
                            <div className="text-[11px] text-red-500 mt-1 font-medium">
                              Error: {log.error_message}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top">
                          <select
                            aria-label={`Delivery status for ${log.business_name || log.recipient}`}
                            value={log.delivery_status}
                            disabled={updatingId === log.id}
                            onChange={(e) => handleStatusUpdate(log, e.target.value as OutreachDeliveryStatus)}
                            className={`min-h-[36px] px-3 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wider outline-none cursor-pointer ${statusStyle}`}
                          >
                            {DELIVERY_STATUS_OPTIONS.map((st) => (
                              <option key={st} value={st} className="bg-white dark:bg-[#171A1D] text-slate-900 dark:text-[#F2F1ED]">
                                {DELIVERY_STATUS_LABELS[st]}
                              </option>
                            ))}
                          </select>
                          {log.provider_message_id && (
                            <div className="text-[10px] font-mono text-slate-400 mt-1 truncate max-w-[160px]" title={log.provider_message_id}>
                              Ref: {log.provider_message_id}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top whitespace-nowrap">
                          <div className="text-[11px] font-medium text-slate-700 dark:text-[#F2F1ED] tabular-nums">
                            {formatDateTime(log.dispatched_at)}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-[#A3A9AF] mt-0.5">
                            {log.operator_email}
                          </div>
                        </td>

                        <td className="py-4 px-5 align-top text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedLog(log);
                              setFailureNoteDraft(log.error_message || '');
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#202428] border border-black/10 dark:border-[#30363B] text-xs font-semibold text-slate-800 dark:text-[#F2F1ED] hover:border-[#C58A52] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="lg:hidden divide-y divide-black/10 dark:divide-[#262B30]">
              {logs.map((log) => {
                const isWhatsApp = String(log.channel).toLowerCase() === 'whatsapp';
                const statusStyle =
                  DELIVERY_STATUS_STYLES[log.delivery_status] || DELIVERY_STATUS_STYLES.DRAFT_OPENED;

                return (
                  <div key={log.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-[#F2F1ED] truncate">
                          {log.business_name || 'CRM Contact'}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-[#A3A9AF] truncate mt-0.5">
                          {log.recipient}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider shrink-0 ${statusStyle}`}>
                        {DELIVERY_STATUS_LABELS[log.delivery_status]}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-[#A3A9AF]">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-[#F2F1ED]">
                        {isWhatsApp ? (
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-sky-500" />
                        )}
                        {isWhatsApp ? 'WhatsApp' : 'Email'}
                      </span>
                      <span>{PROVIDER_LABELS[log.provider || ''] || log.provider || 'Direct'}</span>
                      <span className="tabular-nums">{formatDateTime(log.dispatched_at)}</span>
                    </div>

                    {log.subject && (
                      <div className="text-xs font-semibold text-slate-800 dark:text-[#F2F1ED]">
                        {log.subject}
                      </div>
                    )}
                    <p className="text-xs text-slate-600 dark:text-[#A3A9AF] line-clamp-2">
                      {log.message_body}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-red-500 font-medium">Error: {log.error_message}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <select
                        aria-label={`Update status for ${log.business_name || log.recipient}`}
                        value={log.delivery_status}
                        disabled={updatingId === log.id}
                        onChange={(e) => handleStatusUpdate(log, e.target.value as OutreachDeliveryStatus)}
                        className="min-h-[44px] flex-1 bg-slate-50 dark:bg-[#1A1D21] border border-black/10 dark:border-[#30363B] rounded-xl px-3 text-xs font-bold uppercase text-slate-900 dark:text-[#F2F1ED]"
                      >
                        {DELIVERY_STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {DELIVERY_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedLog(log);
                          setFailureNoteDraft(log.error_message || '');
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-slate-100 dark:bg-[#202428] border border-black/10 dark:border-[#30363B] text-xs font-bold text-slate-900 dark:text-[#F2F1ED] inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-black/10 dark:border-[#262B30]">
            <div className="text-xs text-slate-500 dark:text-[#A3A9AF] tabular-nums">
              Page {page} of {totalPages} ({summary.total} records)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-[40px] px-3 rounded-xl border border-black/10 dark:border-[#30363B] text-xs font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-[40px] px-3 rounded-xl border border-black/10 dark:border-[#30363B] text-xs font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Outreach Log Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#171A1D] border border-black/10 dark:border-[#30363B] w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/10 dark:border-[#30363B]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-[#F2F1ED]">
                    {inspectedLog.business_name || 'CRM Outreach Record'}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${DELIVERY_STATUS_STYLES[inspectedLog.delivery_status]}`}>
                    {DELIVERY_STATUS_LABELS[inspectedLog.delivery_status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#A3A9AF] mt-1 tabular-nums">
                  Dispatched {formatDateTime(inspectedLog.dispatched_at)} by {inspectedLog.operator_email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#202428] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111315] border border-black/5 dark:border-[#262B30]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Channel &amp; Provider</div>
                <div className="font-semibold text-slate-900 dark:text-[#F2F1ED] mt-1">
                  {String(inspectedLog.channel).toUpperCase()} via {PROVIDER_LABELS[inspectedLog.provider || ''] || inspectedLog.provider || 'Direct'}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111315] border border-black/5 dark:border-[#262B30]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recipient</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-[#F2F1ED] mt-1 break-all">
                  {inspectedLog.recipient}
                </div>
              </div>
            </div>

            {inspectedLog.subject && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111315] border border-black/5 dark:border-[#262B30]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Subject</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-[#F2F1ED] mt-1">{inspectedLog.subject}</div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {inspectedLog.ai_generated ? 'AI-Generated Pitch Copy' : 'Outreach Message Copy'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyBody(
                      inspectedLog.subject
                        ? `Subject: ${inspectedLog.subject}\n\n${inspectedLog.message_body}`
                        : inspectedLog.message_body,
                      inspectedLog.id
                    )
                  }
                  className="text-xs font-semibold text-[#C58A52] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === inspectedLog.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === inspectedLog.id ? 'Copied' : 'Copy Copy'}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed p-4 rounded-2xl bg-slate-50 dark:bg-[#111315] border border-black/10 dark:border-[#262B30] text-slate-800 dark:text-[#F2F1ED] max-h-64 overflow-y-auto">
                {inspectedLog.message_body}
              </pre>
            </div>

            <div className="space-y-2 pt-2 border-t border-black/10 dark:border-[#30363B]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                Delivery Diagnostic / Failure Note (Optional)
              </label>
              <input
                type="text"
                value={failureNoteDraft}
                onChange={(e) => setFailureNoteDraft(e.target.value)}
                placeholder="e.g. Confirmed reply on WhatsApp, or SMTP bounce reason..."
                className="w-full min-h-[44px] bg-slate-50 dark:bg-[#111315] border border-black/10 dark:border-[#30363B] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52]"
              />
              <div className="flex flex-wrap gap-2 pt-2">
                {(['SENT', 'DELIVERED', 'REPLIED', 'FAILED'] as OutreachDeliveryStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={updatingId === inspectedLog.id}
                    onClick={() =>
                      handleStatusUpdate(
                        inspectedLog,
                        st,
                        st === 'FAILED' ? failureNoteDraft.trim() || 'Marked failed by operator' : failureNoteDraft.trim() || null
                      )
                    }
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      inspectedLog.delivery_status === st
                        ? DELIVERY_STATUS_STYLES[st]
                        : 'bg-slate-100 dark:bg-[#202428] border-black/10 dark:border-[#30363B] text-slate-700 dark:text-[#F2F1ED] hover:border-[#C58A52]'
                    }`}
                  >
                    Mark {DELIVERY_STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CrmLeadOutreachModalProps {
  lead: Lead;
  initialChannel: 'email' | 'whatsapp';
  emailConfigured: boolean;
  onClose: () => void;
  onLogged: (message: string, type?: 'success' | 'error') => void;
}

export const CrmLeadOutreachModal: React.FC<CrmLeadOutreachModalProps> = ({
  lead,
  initialChannel,
  emailConfigured,
  onClose,
  onLogged
}) => {
  const [channel, setChannel] = useState<'email' | 'whatsapp'>(initialChannel);
  const [recipient, setRecipient] = useState(
    initialChannel === 'email' ? lead.user_email || '' : lead.user_phone || ''
  );
  const [subject, setSubject] = useState(
    `Digital Growth & Web Modernization Proposal for ${lead.business_name || lead.contact_name || 'Your Business'}`
  );
  const [message, setMessage] = useState('');
  const [aiGenerated, setAiGenerated] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadAiPitch = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await generateCrmLeadPitch(lead.id);
      setSubject(res.email.subject);
      setMessage(channel === 'email' ? res.email.body : res.whatsappMessage);
      setAiGenerated(true);
    } catch {
      const target = lead.business_name || lead.contact_name || 'there';
      setMessage(
        channel === 'email'
          ? `Hi ${target},\n\nFollowing up on your enquiry with Avartah Solutions regarding ${lead.requested_service || 'your digital presence'}.\n\nBest regards,\nHarrison Oyeghe\nAvartah Solutions`
          : `Hi ${target}, Harrison here from Avartah Solutions following up on ${lead.requested_service || 'your website project'}. Let me know a good time to connect.`
      );
    } finally {
      setGenerating(false);
    }
  }, [lead.id, lead.business_name, lead.contact_name, lead.requested_service, channel]);

  useEffect(() => {
    loadAiPitch();
  }, [lead.id, channel]);

  const handleChannelSwitch = (next: 'email' | 'whatsapp') => {
    setChannel(next);
    setRecipient(next === 'email' ? lead.user_email || '' : lead.user_phone || '');
  };

  const handleSendViaResend = async () => {
    if (!recipient.trim() || !message.trim()) {
      onLogged('Recipient and pitch copy are required.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await sendOrLogCrmLeadOutreach(lead.id, {
        channel: 'email',
        recipient: recipient.trim(),
        subject: subject.trim(),
        message: message.trim(),
        ai_generated: aiGenerated,
        send_via_email: true
      });
      if (res.delivery_status === 'SENT') {
        onLogged('Email pitch sent via Resend & logged in CRM.', 'success');
        onClose();
      } else {
        onLogged(res.error || 'Email send failed (failure logged in CRM).', 'error');
      }
    } catch (err: any) {
      onLogged(err?.message || 'Unable to send email pitch.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunchClientAndLog = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    statusToRecord: OutreachDeliveryStatus = 'DRAFT_OPENED'
  ) => {
    if (!recipient.trim() || !message.trim()) {
      e.preventDefault();
      onLogged('Recipient contact and pitch copy are required.', 'error');
      return;
    }
    const url =
      channel === 'email'
        ? buildMailtoUrl(recipient.trim(), subject.trim(), message.trim())
        : buildWhatsAppUrl(recipient.trim(), message.trim());
    if (!url) {
      e.preventDefault();
      onLogged(`Invalid ${channel === 'email' ? 'email address' : 'phone number'} for launch.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await sendOrLogCrmLeadOutreach(lead.id, {
        channel,
        recipient: recipient.trim(),
        subject: channel === 'email' ? subject.trim() : undefined,
        message: message.trim(),
        delivery_status: statusToRecord,
        ai_generated: aiGenerated
      });
      onLogged(
        `${channel === 'email' ? 'Email' : 'WhatsApp'} composer opened & logged (${DELIVERY_STATUS_LABELS[statusToRecord]}).`,
        'success'
      );
      onClose();
    } catch (err: any) {
      onLogged(err?.message || 'Failed to log outreach entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkSentManual = async () => {
    if (!recipient.trim() || !message.trim()) {
      onLogged('Recipient and pitch copy are required.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await sendOrLogCrmLeadOutreach(lead.id, {
        channel,
        recipient: recipient.trim(),
        subject: channel === 'email' ? subject.trim() : undefined,
        message: message.trim(),
        delivery_status: 'SENT',
        ai_generated: aiGenerated
      });
      onLogged(`Recorded ${channel} pitch as Sent in CRM Outreach Log.`, 'success');
      onClose();
    } catch (err: any) {
      onLogged(err?.message || 'Failed to log outreach entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const externalHref =
    channel === 'email'
      ? buildMailtoUrl(recipient.trim(), subject.trim(), message.trim()) || '#'
      : buildWhatsAppUrl(recipient.trim(), message.trim()) || '#';

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#171A1D] border border-black/10 dark:border-[#30363B] w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/10 dark:border-[#30363B]">
          <div>
            <h3 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-[#F2F1ED]">
              CRM Pitch &amp; Delivery Composer
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A3A9AF] mt-1">
              {lead.business_name || lead.contact_name || 'CRM Lead'} — tracked in persistent Outreach Delivery Log
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-[#202428] text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="inline-flex bg-slate-100 dark:bg-[#111315] p-1 rounded-xl border border-black/5 dark:border-[#262B30]">
          <button
            type="button"
            onClick={() => handleChannelSwitch('email')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
              channel === 'email' ? 'bg-[#C58A52] text-[#111315]' : 'text-slate-600 dark:text-[#A3A9AF]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Pitch</span>
          </button>
          <button
            type="button"
            onClick={() => handleChannelSwitch('whatsapp')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
              channel === 'whatsapp' ? 'bg-emerald-500 text-[#111315]' : 'text-slate-600 dark:text-[#A3A9AF]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Pitch</span>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
              {channel === 'email' ? 'Recipient Email' : 'Recipient Phone (E.164)'}
            </label>
            <input
              type={channel === 'email' ? 'email' : 'text'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={channel === 'email' ? 'founder@company.com' : '+447911123456'}
              className="w-full min-h-[44px] bg-slate-50 dark:bg-[#111315] border border-black/10 dark:border-[#30363B] rounded-xl px-3.5 py-2 text-base sm:text-sm font-mono text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52]"
            />
          </div>

          {channel === 'email' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full min-h-[44px] bg-slate-50 dark:bg-[#111315] border border-black/10 dark:border-[#30363B] rounded-xl px-3.5 py-2 text-base sm:text-sm text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52]"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                AI-Generated Pitch Copy
              </label>
              <button
                type="button"
                onClick={loadAiPitch}
                disabled={generating}
                className="text-xs font-semibold text-[#C58A52] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{generating ? 'Generating...' : 'Regenerate AI Pitch'}</span>
              </button>
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#111315] border border-black/10 dark:border-[#30363B] rounded-xl p-3.5 text-sm text-slate-900 dark:text-[#F2F1ED] leading-relaxed outline-none focus:border-[#C58A52]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-black/10 dark:border-[#30363B]">
          <button
            type="button"
            disabled={submitting}
            onClick={handleMarkSentManual}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#202428] border border-black/10 dark:border-[#30363B] text-xs font-bold text-slate-800 dark:text-[#F2F1ED] hover:border-[#C58A52] flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Log as Sent</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {channel === 'email' && emailConfigured && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSendViaResend}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-[#111315] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Send via Resend</span>
              </button>
            )}

            <a
              href={externalHref}
              target={channel === 'whatsapp' ? '_blank' : undefined}
              rel={channel === 'whatsapp' ? 'noopener noreferrer' : undefined}
              onClick={(e) => handleLaunchClientAndLog(e, 'DRAFT_OPENED')}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                channel === 'whatsapp'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-[#111315]'
                  : 'bg-[#C58A52] hover:bg-[#D99B62] text-[#111315]'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>{channel === 'whatsapp' ? 'Open WhatsApp & Log' : 'Open Email Client & Log'}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrmOutreachLogsView;
