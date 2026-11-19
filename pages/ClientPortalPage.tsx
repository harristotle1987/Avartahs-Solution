import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Check, Clock, AlertCircle, 
  ExternalLink, Calendar, MessageSquare, RefreshCw, 
  Loader2, ArrowRight, Shield, FileText, X
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ClientProject, ProjectStatus
} from '../types';
import { 
  getClientDeliveryProjects, getClientDeliveryProjectDetail, submitClientFeedback 
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const STATUS_TEXT: Record<ProjectStatus, { text: string; color: string }> = {
  'Planning': { text: 'Planning', color: 'text-slate-400' },
  'In Progress': { text: 'In Progress', color: 'text-[#C58A52]' },
  'Awaiting Client': { text: 'Awaiting Client Review', color: 'text-amber-500' },
  'Revision Required': { text: 'Revision in Progress', color: 'text-purple-400' },
  'Completed': { text: 'Completed & Delivered', color: 'text-emerald-500' },
  'On Hold': { text: 'On Hold', color: 'text-slate-500' }
};

export const ClientPortalPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const routeState = (location.state || {}) as { adminAccessDenied?: boolean };
  const [showAccessBanner, setShowAccessBanner] = useState<boolean>(!!routeState.adminAccessDenied);
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ClientProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feedback & Revision Request Modal
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'client_feedback' | 'revision_request'>('client_feedback');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (routeState.adminAccessDenied) {
      setShowAccessBanner(true);
    }
  }, [routeState.adminAccessDenied]);

  const fetchClientProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClientDeliveryProjects();
      setProjects(data || []);
      if (data && data.length > 0) {
        const firstId = selectedProjectId && data.some(p => p.id === selectedProjectId)
          ? selectedProjectId 
          : data[0].id;
        setSelectedProjectId(firstId);
        await loadProjectDetail(firstId);
      } else {
        setSelectedProjectId(null);
        setActiveProject(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load client projects');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await getClientDeliveryProjectDetail(id);
      setActiveProject(detail);
      setSelectedProjectId(id);
    } catch (err: any) {
      showToast(err.message || 'Failed to load project details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    setProjects([]);
    setSelectedProjectId(null);
    setActiveProject(null);
    fetchClientProjects();
  }, [user?.email]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !feedbackMessage.trim()) return;
    setSubmitting(true);
    try {
      const res = await submitClientFeedback(activeProject.id, {
        message: feedbackMessage.trim(),
        type: feedbackType,
        milestone_id: selectedMilestoneId || undefined
      });
      showToast(res.message || 'Feedback submitted successfully');
      setFeedbackMessage('');
      setIsFeedbackOpen(false);
      await loadProjectDetail(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit feedback', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      <Helmet>
        <title>Client Delivery Workspace | Avartah Solutions</title>
        <meta name="description" content="Secure client delivery workspace for tracking project milestones, deliverables, and updates." />
      </Helmet>

      <Navbar />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-20 right-6 z-50 px-4 py-2.5 rounded-lg border text-xs font-semibold shadow-lg ${
              toast.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                : 'bg-red-50 dark:bg-red-950/80 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {showAccessBanner && (
          <div className="mb-6 p-3.5 rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Administrator console access is restricted. You are viewing your authorized client workspace.</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAccessBanner(false)}
              className="p-1 hover:opacity-75"
              aria-label="Dismiss notice"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Workspace Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200 dark:border-[#30363B]">
          <div>
            <div className="text-xs font-semibold text-[#C58A52] uppercase tracking-wider mb-1">
              Client Delivery Portal{user?.email ? ` · ${user.email}` : ''}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED]">
              Project Sprints & Deliverables
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/business-os/dashboard"
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] text-slate-700 dark:text-[#F2F1ED] hover:border-[#C58A52] text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              <FileText size={13} className="text-[#C58A52]" />
              <span>Quotations & Invoices</span>
            </Link>

            <button
              onClick={fetchClientProjects}
              className="p-2 rounded-lg border border-slate-200 dark:border-[#30363B] text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
              title="Refresh Deliverables"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {activeProject && (
              <button
                onClick={() => {
                  setFeedbackType('revision_request');
                  setIsFeedbackOpen(true);
                }}
                className="px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-lg transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <MessageSquare size={13} />
                <span>Submit Feedback or Revision</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 size={24} className="animate-spin mx-auto text-[#C58A52] mb-3" />
            <p className="text-xs text-slate-500 dark:text-[#747C84]">Loading project delivery records...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 rounded-lg border border-dashed border-slate-200 dark:border-[#30363B] text-center max-w-lg mx-auto">
            <Briefcase size={28} className="mx-auto text-slate-400 dark:text-[#747C84] mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F2F1ED] mb-1">No Active Project Sprints</h3>
            <p className="text-xs text-slate-500 dark:text-[#747C84] mb-6">
              Your account currently has no active delivery contracts assigned. Submit an audit or book a consultation to begin your engagement.
            </p>
            <a
              href="/#booking"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-lg transition-colors"
            >
              <span>Schedule Initial Sprint</span>
              <ArrowRight size={13} />
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Project Selector Sidebar */}
            <div className="lg:col-span-4 space-y-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-[#747C84] uppercase tracking-wider mb-2">
                Your Contracts ({projects.length})
              </div>

              {projects.map((p, pIdx) => {
                const isSelected = p.id === selectedProjectId;
                const statusMeta = STATUS_TEXT[p.status as ProjectStatus] || { text: p.status, color: 'text-slate-400' };
                const projectTitle = p.name || p.title || 'Delivery Project';
                const targetDate = p.target_date || p.target_end_date;

                return (
                  <button
                    key={`portal-proj-${p.id || 'p'}-${pIdx}`}
                    onClick={() => loadProjectDetail(p.id)}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-[#C58A52] bg-slate-50 dark:bg-[#171A1D] shadow-sm'
                        : 'border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D]/60 hover:border-slate-400 dark:hover:border-[#747C84]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-900 dark:text-[#F2F1ED] truncate max-w-[200px]">{projectTitle}</span>
                      <span className={`text-[11px] font-medium ${statusMeta.color}`}>{statusMeta.text}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#747C84] font-mono tabular-nums">
                      <span>Progress: {p.progress_percentage || 0}%</span>
                      <span>Target: {targetDate ? new Date(targetDate).toLocaleDateString() : 'TBD'}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1 bg-slate-200 dark:bg-[#202428] rounded-full overflow-hidden mt-2.5">
                      <div 
                        className="h-full bg-[#C58A52] transition-all duration-300"
                        style={{ width: `${p.progress_percentage || 0}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Active Project Detail */}
            <div className="lg:col-span-8">
              {detailLoading ? (
                <div className="py-20 text-center border border-slate-200 dark:border-[#30363B] rounded-lg">
                  <Loader2 size={20} className="animate-spin mx-auto text-[#C58A52] mb-2" />
                  <p className="text-xs text-slate-500 dark:text-[#747C84]">Loading sprint specification...</p>
                </div>
              ) : activeProject ? (
                <div className="space-y-6">
                  
                  {/* Overview Card */}
                  <div className="p-6 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D]">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-[#F2F1ED]">
                        {activeProject.name || activeProject.title}
                      </h2>
                      <div className="text-xs text-[#C58A52] font-semibold">
                        {activeProject.status}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed mb-6">
                      {activeProject.description || 'Custom software development contract deployed under Avartah engineering standards.'}
                    </p>

                    {/* Key Stats Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-[#30363B] text-xs font-mono tabular-nums">
                      <div>
                        <div className="text-slate-400 dark:text-[#747C84] text-[11px]">Sprint Progress</div>
                        <div className="font-bold text-slate-900 dark:text-[#F2F1ED] mt-0.5">{activeProject.progress_percentage || 0}%</div>
                      </div>
                      <div>
                        <div className="text-slate-400 dark:text-[#747C84] text-[11px]">Milestones</div>
                        <div className="font-bold text-slate-900 dark:text-[#F2F1ED] mt-0.5">{activeProject.milestones?.length || 0} Defined</div>
                      </div>
                      <div>
                        <div className="text-slate-400 dark:text-[#747C84] text-[11px]">Deliverables</div>
                        <div className="font-bold text-slate-900 dark:text-[#F2F1ED] mt-0.5">{activeProject.deliverables?.length || 0} Assets</div>
                      </div>
                      <div>
                        <div className="text-slate-400 dark:text-[#747C84] text-[11px]">Target Launch</div>
                        <div className="font-bold text-slate-900 dark:text-[#F2F1ED] mt-0.5">
                          {(activeProject.target_date || activeProject.target_end_date)
                            ? new Date(activeProject.target_date || activeProject.target_end_date || '').toLocaleDateString()
                            : 'Active Sprint'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Milestones List */}
                  <div className="p-6 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D]">
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider mb-4">
                      Sprint Milestones ({activeProject.milestones?.length || 0})
                    </h3>

                    {(!activeProject.milestones || activeProject.milestones.length === 0) ? (
                      <p className="text-xs text-slate-400 dark:text-[#747C84]">No milestones currently published for this sprint.</p>
                    ) : (
                      <div className="space-y-3">
                        {activeProject.milestones.map((m, idx) => (
                          <div 
                            key={`portal-milestone-${m.id || 'm'}-${idx}`} 
                            className="p-4 rounded-md bg-slate-50 dark:bg-[#111315] border border-slate-100 dark:border-[#30363B]/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[#C58A52] font-semibold">0{idx + 1}.</span>
                                <span className="font-semibold text-slate-900 dark:text-[#F2F1ED]">{m.title}</span>
                              </div>
                              {m.description && (
                                <p className="text-slate-500 dark:text-[#747C84] text-[11px] pl-6">
                                  {m.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 pl-6 sm:pl-0 shrink-0">
                              <span className="font-mono text-[11px] text-slate-400 dark:text-[#747C84] tabular-nums">
                                Due {m.due_date ? new Date(m.due_date).toLocaleDateString() : 'TBD'}
                              </span>
                              <span className={`text-[11px] font-semibold ${
                                m.status === 'Completed' ? 'text-emerald-500' : m.status === 'In Progress' ? 'text-[#C58A52]' : 'text-slate-400'
                              }`}>
                                {m.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Published Deliverables */}
                  <div className="p-6 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D]">
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider mb-4">
                      Verified Assets & Deliverables ({activeProject.deliverables?.length || 0})
                    </h3>

                    {(!activeProject.deliverables || activeProject.deliverables.length === 0) ? (
                      <p className="text-xs text-slate-400 dark:text-[#747C84]">Deliverables will appear here as each sprint milestone completes verification.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeProject.deliverables.map((deliv, dIdx) => {
                          const deliverableKind = deliv.type || deliv.deliverable_type || 'Asset';
                          const deliverableUrl = deliv.resource_url || deliv.asset_url;
                          return (
                            <div 
                              key={`portal-deliv-${deliv.id || 'deliv'}-${dIdx}`}
                              className="p-3.5 rounded-md bg-slate-50 dark:bg-[#111315] border border-slate-100 dark:border-[#30363B]/60 text-xs flex flex-col justify-between"
                            >
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">{deliv.title}</div>
                                {deliv.description && (
                                  <p className="text-slate-500 dark:text-[#747C84] text-[11px] mb-3">{deliv.description}</p>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-[#30363B] flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 dark:text-[#747C84] uppercase font-mono">{deliverableKind}</span>
                                {deliverableUrl && (
                                  <a
                                    href={deliverableUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#C58A52] hover:underline font-medium"
                                  >
                                    <span>Inspect Deliverable</span>
                                    <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Client-Visible Activity Updates */}
                  <div className="p-6 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D]">
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider mb-4">
                      Delivery Updates ({activeProject.activities?.length || 0})
                    </h3>

                    {(!activeProject.activities || activeProject.activities.length === 0) ? (
                      <p className="text-xs text-slate-400 dark:text-[#747C84]">No client-visible sprint updates posted yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {activeProject.activities.map((act, aIdx) => (
                          <div
                            key={`portal-act-${act.id || 'act'}-${aIdx}`}
                            className="p-3.5 rounded-md bg-slate-50 dark:bg-[#111315] border border-slate-100 dark:border-[#30363B]/60 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1 text-[11px] text-slate-400 dark:text-[#747C84]">
                              <span className="font-semibold text-[#C58A52]">
                                {act.author_role === 'admin' ? 'Delivery Team' : 'You'}
                              </span>
                              <span className="font-mono tabular-nums">
                                {act.created_at ? new Date(act.created_at).toLocaleString() : ''}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-[#F2F1ED] leading-relaxed">{act.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              ) : null}
            </div>

          </div>
        )}
      </main>

      {/* Feedback & Revision Request Modal */}
      <AnimatePresence>
        {isFeedbackOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsFeedbackOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg p-6 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-[#30363B]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider">
                  Client Revision / Feedback
                </h3>
                <button 
                  onClick={() => setIsFeedbackOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-[#F2F1ED] rounded"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                    Feedback Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFeedbackType('client_feedback')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        feedbackType === 'client_feedback'
                          ? 'border-[#C58A52] bg-[#C58A52]/10 text-slate-900 dark:text-[#F2F1ED] font-semibold'
                          : 'border-slate-200 dark:border-[#30363B] text-slate-600 dark:text-[#A3A9AF]'
                      }`}
                    >
                      General Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackType('revision_request')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        feedbackType === 'revision_request'
                          ? 'border-[#C58A52] bg-[#C58A52]/10 text-slate-900 dark:text-[#F2F1ED] font-semibold'
                          : 'border-slate-200 dark:border-[#30363B] text-slate-600 dark:text-[#A3A9AF]'
                      }`}
                    >
                      Revision Request
                    </button>
                  </div>
                </div>

                {activeProject?.milestones && activeProject.milestones.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                      Related Milestone (Optional)
                    </label>
                    <select
                      value={selectedMilestoneId}
                      onChange={(e) => setSelectedMilestoneId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-xs text-slate-900 dark:text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                    >
                      <option value="">Entire Project Scope</option>
                      {activeProject.milestones.map((m, optIdx) => (
                        <option key={`opt-m-${m.id || 'milestone'}-${optIdx}`} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                    Feedback Details
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Specify exact feedback, test observation, or revision requirements..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-xs text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackOpen(false)}
                    className="px-3.5 py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !feedbackMessage.trim()}
                    className="px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] disabled:opacity-50 text-[#111315] font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Dispatch to Engineers</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default ClientPortalPage;
