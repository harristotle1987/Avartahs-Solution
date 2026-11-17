import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Plus, CheckCircle, Clock, AlertTriangle, AlertCircle, 
  ExternalLink, Trash2, Edit2, Archive, ArrowUp, ArrowDown, 
  FileText, Link2, MessageSquare, Shield, Eye, EyeOff, Loader2,
  ChevronRight, Calendar, User, Check, RefreshCw, Sparkles
} from 'lucide-react';
import { 
  ClientProject, ProjectMilestone, ProjectDeliverable, ProjectActivity,
  ProjectStatus, MilestoneStatus, DeliverableType, DeliverableVisibility
} from '../types';
import { 
  getDeliveryProjects, createDeliveryProject, getDeliveryProjectDetail,
  updateDeliveryProject, deleteDeliveryProject, createMilestone,
  updateMilestone, deleteMilestone, reorderMilestones, createDeliverable,
  deleteDeliverable, addProjectActivity, runAiProjectReporter
} from '../lib/api';

const STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
  'Planning': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  'In Progress': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'Awaiting Client': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  'Revision Required': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  'Completed': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  'On Hold': { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' }
};

const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, { bg: string; text: string }> = {
  'Not Started': { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
  'In Progress': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'Blocked': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'Completed': { bg: 'bg-green-500/20', text: 'text-green-400' }
};

export const ClientDeliveryHub: React.FC = () => {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ClientProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [isDeliverableModalOpen, setIsDeliverableModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);

  // Forms
  const [projectForm, setProjectForm] = useState({
    name: '',
    client_name: '',
    client_email: '',
    description: '',
    scope: '',
    status: 'Planning' as ProjectStatus,
    start_date: '',
    target_date: '',
    assigned_admin_name: ''
  });

  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    due_date: '',
    status: 'Not Started' as MilestoneStatus,
    client_notes: '',
    notes: ''
  });

  const [deliverableForm, setDeliverableForm] = useState({
    title: '',
    description: '',
    type: 'Document' as DeliverableType,
    resource_url: '',
    visibility: 'client_visible' as DeliverableVisibility,
    milestone_id: ''
  });

  const [activityForm, setActivityForm] = useState({
    message: '',
    visibility: 'client_visible' as 'client_visible' | 'internal_only',
    type: 'general_update'
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await getDeliveryProjects({
        status: statusFilter,
        include_archived: showArchived,
        client_email: searchQuery || undefined
      });
      setProjects(data);
      if (selectedProjectId) {
        loadProjectDetail(selectedProjectId);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await getDeliveryProjectDetail(id);
      setActiveProject(detail);
      setSelectedProjectId(id);
    } catch (err: any) {
      showToast(err.message || 'Failed to load project details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter, showArchived]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createDeliveryProject(projectForm);
      showToast('Project initialized successfully!');
      setIsCreateModalOpen(false);
      setProjectForm({
        name: '',
        client_name: '',
        client_email: '',
        description: '',
        scope: '',
        status: 'Planning',
        start_date: '',
        target_date: '',
        assigned_admin_name: ''
      });
      await fetchProjects();
      setSelectedProjectId(created.id);
      loadProjectDetail(created.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to create project', 'error');
    }
  };

  const handleUpdateProjectStatus = async (status: ProjectStatus) => {
    if (!activeProject) return;
    try {
      const updated = await updateDeliveryProject(activeProject.id, { status });
      showToast(`Project status updated to ${status}`);
      loadProjectDetail(activeProject.id);
      fetchProjects();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleToggleArchive = async () => {
    if (!activeProject) return;
    try {
      const updated = await updateDeliveryProject(activeProject.id, { 
        is_archived: !activeProject.is_archived 
      });
      showToast(updated.is_archived ? 'Project archived' : 'Project unarchived');
      loadProjectDetail(activeProject.id);
      fetchProjects();
    } catch (err: any) {
      showToast(err.message || 'Failed to update archive status', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (!activeProject) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${activeProject.name}" and all associated milestones, deliverables, and updates?`)) {
      return;
    }
    try {
      await deleteDeliveryProject(activeProject.id);
      showToast('Project deleted successfully');
      setActiveProject(null);
      setSelectedProjectId(null);
      fetchProjects();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project', 'error');
    }
  };

  // Milestone Actions
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      if (editingMilestone) {
        await updateMilestone(activeProject.id, editingMilestone.id, milestoneForm);
        showToast('Milestone updated');
      } else {
        await createMilestone(activeProject.id, milestoneForm);
        showToast('Milestone added');
      }
      setIsMilestoneModalOpen(false);
      setEditingMilestone(null);
      setMilestoneForm({
        title: '',
        description: '',
        due_date: '',
        status: 'Not Started',
        client_notes: '',
        notes: ''
      });
      loadProjectDetail(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to save milestone', 'error');
    }
  };

  const handleToggleMilestoneComplete = async (m: ProjectMilestone) => {
    if (!activeProject) return;
    const newStatus: MilestoneStatus = m.status === 'Completed' ? 'In Progress' : 'Completed';
    try {
      await updateMilestone(activeProject.id, m.id, { status: newStatus });
      showToast(`Milestone marked as ${newStatus}`);
      loadProjectDetail(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to update milestone', 'error');
    }
  };

  const handleDeleteMilestone = async (mId: string) => {
    if (!activeProject) return;
    if (!window.confirm('Delete this milestone?')) return;
    try {
      await deleteMilestone(activeProject.id, mId);
      showToast('Milestone removed');
      loadProjectDetail(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete milestone', 'error');
    }
  };

  const handleMoveMilestone = async (index: number, direction: 'up' | 'down') => {
    if (!activeProject || !activeProject.milestones) return;
    const list = [...activeProject.milestones];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const ids = list.map(m => m.id);
    try {
      await reorderMilestones(activeProject.id, ids);
      loadProjectDetail(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to reorder milestones', 'error');
    }
  };

  // Deliverables Actions
  const handleSaveDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      await createDeliverable(activeProject.id, deliverableForm);
      showToast('Deliverable added successfully');
      setIsDeliverableModalOpen(false);
      setDeliverableForm({
        title: '',
        description: '',
        type: 'Document',
        resource_url: '',
        visibility: 'client_visible',
        milestone_id: ''
      });
      loadProjectDetail(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to add deliverable', 'error');
    }
  };

  const handleDeleteDeliverable = async (dId: string) => {
    if (!activeProject) return;
    if (!window.confirm('Delete this deliverable?')) return;
    try {
      await deleteDeliverable(activeProject.id, dId);
      showToast('Deliverable deleted');
      loadProjectDetail(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete deliverable', 'error');
    }
  };

  // Activity / Admin Note
  const handlePostActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      await addProjectActivity(activeProject.id, activityForm);
      showToast('Timeline activity recorded');
      setIsActivityModalOpen(false);
      setActivityForm({ message: '', visibility: 'client_visible', type: 'general_update' });
      loadProjectDetail(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to post activity', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-black uppercase tracking-wider ${
              toast.type === 'success' 
                ? 'bg-emerald-500 text-slate-950 border border-emerald-400' 
                : 'bg-red-500 text-white border border-red-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-black/60 border border-black/10 dark:border-white/10 rounded-[2rem] p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Briefcase size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Client Project Delivery Hub
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Manage client deliverables, milestone roadmaps, progress calculations, and client-visible status.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg"
          >
            <Plus size={16} />
            <span>New Client Project</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'Planning', 'In Progress', 'Awaiting Client', 'Revision Required', 'Completed', 'On Hold'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFilter === status
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded text-emerald-500 focus:ring-emerald-400"
            />
            <span>Show Archived</span>
          </label>

          <button
            onClick={fetchProjects}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid: Projects List + Active Project Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Project List */}
        <div className="lg:col-span-5 space-y-3">
          {loading ? (
            <div className="p-12 text-center bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-3xl">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-3">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-3xl">
              <Briefcase className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">No Projects Found</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Create your first client delivery project to begin tracking milestones.</p>
            </div>
          ) : (
            projects.map((project, idx) => {
              const isSelected = selectedProjectId === project.id;
              const statusStyle = STATUS_COLORS[project.status] || STATUS_COLORS['Planning'];
              const progress = project.progress_percentage || 0;

              return (
                <div
                  key={`project-${project.id || 'id'}-${idx}`}
                  onClick={() => loadProjectDetail(project.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500 shadow-md'
                      : 'bg-white dark:bg-black/40 border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                          {project.status}
                        </span>
                        {project.is_archived && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-zinc-500/20 text-zinc-400">
                            Archived
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                        {project.name}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500">
                        {project.client_name ? `${project.client_name} • ` : ''}{project.client_email}
                      </p>
                    </div>
                    <ChevronRight size={18} className={`shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      <span>Progress</span>
                      <span className="text-emerald-400 font-bold">{progress}% ({project.completed_milestones || 0}/{project.total_milestones || 0} Milestones)</span>
                    </div>
                    <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Date details */}
                  <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-slate-500">
                    {project.target_date && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> Target: {project.target_date}
                      </span>
                    )}
                    {project.assigned_admin_name && (
                      <span className="flex items-center gap-1">
                        <User size={12} /> {project.assigned_admin_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Project Detail Pane */}
        <div className="lg:col-span-7">
          {detailLoading ? (
            <div className="p-16 text-center bg-white dark:bg-black/60 border border-black/10 dark:border-white/10 rounded-3xl">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-3">Loading details...</p>
            </div>
          ) : !activeProject ? (
            <div className="p-16 text-center bg-white dark:bg-black/60 border border-black/10 dark:border-white/10 rounded-3xl">
              <FileText className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Select a Project</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1 max-w-sm mx-auto">
                Select a project from the left panel to review milestones, upload deliverables, log activity, and manage client collaboration.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-black/60 border border-black/10 dark:border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
              {/* Project Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-black/10 dark:border-white/10 pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-slate-400">ID: {activeProject.id}</span>
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${STATUS_COLORS[activeProject.status]?.bg} ${STATUS_COLORS[activeProject.status]?.text} ${STATUS_COLORS[activeProject.status]?.border}`}>
                      {activeProject.status}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                    {activeProject.name}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    Client: <span className="text-slate-900 dark:text-white">{activeProject.client_name || 'Direct Client'}</span> ({activeProject.client_email})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!activeProject) return;
                      showToast('Generating AI progress report draft...', 'success');
                      try {
                        const res = await runAiProjectReporter({ project_id: activeProject.id });
                        setActivityForm({
                          message: res.progress_report || '',
                          visibility: 'client_visible',
                          type: 'general_update'
                        });
                        setIsActivityModalOpen(true);
                        showToast('AI progress report generated as editable draft!');
                      } catch (err: any) {
                        showToast(err.message || 'AI generation failed', 'error');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 text-xs font-black uppercase tracking-wider transition-all"
                    title="Generate AI Client Progress Report"
                  >
                    <Sparkles size={16} />
                    <span>AI Report Draft</span>
                  </button>
                  <button
                    onClick={handleToggleArchive}
                    className="p-2.5 rounded-xl border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title={activeProject.is_archived ? "Unarchive" : "Archive"}
                  >
                    <Archive size={16} />
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    className="p-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Status Transition Control */}
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                  Update Project Status:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(['Planning', 'In Progress', 'Awaiting Client', 'Revision Required', 'Completed', 'On Hold'] as ProjectStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleUpdateProjectStatus(s)}
                      disabled={activeProject.status === s}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                        activeProject.status === s
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope & Description */}
              {(activeProject.scope || activeProject.description) && (
                <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2">
                  {activeProject.scope && (
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Agreed Project Scope</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{activeProject.scope}</p>
                    </div>
                  )}
                  {activeProject.description && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Overview / Notes</span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{activeProject.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Milestones Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Milestones ({activeProject.milestones?.length || 0})
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500">
                      Progress computed from completed items: {activeProject.progress_percentage || 0}%
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingMilestone(null);
                      setMilestoneForm({
                        title: '',
                        description: '',
                        due_date: '',
                        status: 'Not Started',
                        client_notes: '',
                        notes: ''
                      });
                      setIsMilestoneModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    <Plus size={14} /> Add Milestone
                  </button>
                </div>

                <div className="space-y-2">
                  {(!activeProject.milestones || activeProject.milestones.length === 0) ? (
                    <p className="text-xs text-slate-500 py-3 italic">No milestones defined yet. Click "Add Milestone" to structure this delivery roadmap.</p>
                  ) : (
                    activeProject.milestones.map((m, idx) => {
                      const isCompleted = m.status === 'Completed';
                      const mStyle = MILESTONE_STATUS_COLORS[m.status] || MILESTONE_STATUS_COLORS['Not Started'];

                      return (
                        <div
                          key={`milestone-${m.id || 'id'}-${idx}`}
                          className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => handleToggleMilestoneComplete(m)}
                              className={`mt-0.5 p-1 rounded-lg border transition-colors ${
                                isCompleted
                                  ? 'bg-green-500 border-green-500 text-slate-950'
                                  : 'border-slate-400 dark:border-slate-600 hover:border-emerald-400'
                              }`}
                              title={isCompleted ? "Mark in progress" : "Mark completed"}
                            >
                              <Check size={14} className={isCompleted ? 'opacity-100' : 'opacity-0'} />
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-black ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                  {m.title}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${mStyle.bg} ${mStyle.text}`}>
                                  {m.status}
                                </span>
                                {m.due_date && (
                                  <span className="text-[9px] font-bold text-slate-400">
                                    Due: {m.due_date}
                                  </span>
                                )}
                              </div>
                              {m.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5">{m.description}</p>
                              )}
                              {m.client_notes && (
                                <p className="text-[10px] text-blue-400 mt-1 font-semibold">
                                  Client Note: {m.client_notes}
                                </p>
                              )}
                              {m.notes && (
                                <p className="text-[10px] text-amber-400/80 mt-0.5 font-mono">
                                  Internal: {m.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMoveMilestone(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Move up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => handleMoveMilestone(idx, 'down')}
                              disabled={idx === (activeProject.milestones?.length || 1) - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Move down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingMilestone(m);
                                setMilestoneForm({
                                  title: m.title,
                                  description: m.description || '',
                                  due_date: m.due_date || '',
                                  status: m.status,
                                  client_notes: m.client_notes || '',
                                  notes: m.notes || ''
                                });
                                setIsMilestoneModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-400"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteMilestone(m.id)}
                              className="p-1 text-slate-400 hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Deliverables Section */}
              <div className="space-y-4 pt-4 border-t border-black/10 dark:border-white/10">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Deliverables ({activeProject.deliverables?.length || 0})
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500">
                      Safe verified links, staging deployments, and design assets.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDeliverableModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    <Plus size={14} /> Add Deliverable
                  </button>
                </div>

                <div className="space-y-2">
                  {(!activeProject.deliverables || activeProject.deliverables.length === 0) ? (
                    <p className="text-xs text-slate-500 py-3 italic">No deliverables published yet.</p>
                  ) : (
                    activeProject.deliverables.map((deliv, idx) => (
                      <div
                        key={`deliv-${deliv.id || 'id'}-${idx}`}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <Link2 size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {deliv.title}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400">
                                {deliv.type}
                              </span>
                              {deliv.visibility === 'client_visible' ? (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-500/20 text-green-400">
                                  <Eye size={10} /> Client Visible
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-400">
                                  <EyeOff size={10} /> Internal Draft
                                </span>
                              )}
                            </div>
                            {deliv.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{deliv.description}</p>
                            )}
                            <a
                              href={deliv.resource_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono text-emerald-400 hover:underline flex items-center gap-1 mt-1"
                            >
                              <span>{deliv.resource_url}</span>
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteDeliverable(deliv.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete deliverable"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Activities & Timeline Section */}
              <div className="space-y-4 pt-4 border-t border-black/10 dark:border-white/10">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Activity Log & Timeline ({activeProject.activities?.length || 0})
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500">
                      Audit trail of status transitions, milestone completions, client feedback, and notes.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsActivityModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-white border border-black/10 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    <Plus size={14} /> Post Note / Update
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(!activeProject.activities || activeProject.activities.length === 0) ? (
                    <p className="text-xs text-slate-500 py-3 italic">No timeline entries yet.</p>
                  ) : (
                    activeProject.activities.map((act, actIdx) => {
                      const isClient = act.author_role === 'client';
                      const isInternal = act.visibility === 'internal_only';

                      return (
                        <div
                          key={`activity-${act.id || 'act'}-${actIdx}`}
                          className={`p-3 rounded-xl border text-xs ${
                            isClient
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                              : isInternal
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                              : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mb-1">
                            <span className="uppercase tracking-wider">
                              {isClient ? '👤 Client Message' : isInternal ? '🔒 Internal Admin Note' : '⚡ System / Admin Update'} • {act.author_email}
                            </span>
                            <span>{new Date(act.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap">{act.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE PROJECT MODAL */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-4">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  Create Client Project
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    placeholder="e.g. Apex Core Systems Re-Platforming"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Client Contact Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={projectForm.client_email}
                      onChange={(e) => setProjectForm({ ...projectForm, client_email: e.target.value })}
                      placeholder="client@enterprise.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Client Name / Company
                    </label>
                    <input
                      type="text"
                      value={projectForm.client_name}
                      onChange={(e) => setProjectForm({ ...projectForm, client_name: e.target.value })}
                      placeholder="e.g. Acme Health Corp"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Initial Status
                    </label>
                    <select
                      value={projectForm.status}
                      onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as ProjectStatus })}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="Planning">Planning</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Awaiting Client">Awaiting Client</option>
                      <option value="Revision Required">Revision Required</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={projectForm.start_date}
                      onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Target Completion Date
                    </label>
                    <input
                      type="date"
                      value={projectForm.target_date}
                      onChange={(e) => setProjectForm({ ...projectForm, target_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Agreed Scope of Work
                  </label>
                  <textarea
                    rows={3}
                    value={projectForm.scope}
                    onChange={(e) => setProjectForm({ ...projectForm, scope: e.target.value })}
                    placeholder="List core deliverables, sprints, and specifications agreed with the client..."
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Internal Overview / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    placeholder="Key operational details, repository links, or internal notes..."
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-lg"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MILESTONE MODAL */}
      <AnimatePresence>
        {isMilestoneModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-4">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  {editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
                </h3>
                <button
                  onClick={() => setIsMilestoneModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveMilestone} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Milestone Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={milestoneForm.title}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                    placeholder="e.g. Design System & Wireframes Complete"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Status
                    </label>
                    <select
                      value={milestoneForm.status}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, status: e.target.value as MilestoneStatus })}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Blocked">Blocked</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={milestoneForm.due_date}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Client Visible Notes
                  </label>
                  <textarea
                    rows={2}
                    value={milestoneForm.client_notes}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, client_notes: e.target.value })}
                    placeholder="Notes visible directly to the client in their portal..."
                    className="w-full px-4 py-2 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-amber-500 mb-1">
                    Private Admin Notes (Omitted from Client View)
                  </label>
                  <textarea
                    rows={2}
                    value={milestoneForm.notes}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, notes: e.target.value })}
                    placeholder="Internal developer/admin notes (never leaked to client)..."
                    className="w-full px-4 py-2 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsMilestoneModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-emerald-400"
                  >
                    Save Milestone
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELIVERABLE MODAL */}
      <AnimatePresence>
        {isDeliverableModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-4">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  Add Deliverable
                </h3>
                <button
                  onClick={() => setIsDeliverableModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveDeliverable} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Deliverable Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliverableForm.title}
                    onChange={(e) => setDeliverableForm({ ...deliverableForm, title: e.target.value })}
                    placeholder="e.g. Staging Preview Environment"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Deliverable Type
                    </label>
                    <select
                      value={deliverableForm.type}
                      onChange={(e) => setDeliverableForm({ ...deliverableForm, type: e.target.value as DeliverableType })}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="Design">Design</option>
                      <option value="Staging Link">Staging Link</option>
                      <option value="Deployment">Deployment</option>
                      <option value="Final Handover">Final Handover</option>
                      <option value="Document">Document</option>
                      <option value="Code Repository">Code Repository</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Visibility
                    </label>
                    <select
                      value={deliverableForm.visibility}
                      onChange={(e) => setDeliverableForm({ ...deliverableForm, visibility: e.target.value as DeliverableVisibility })}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="client_visible">Client Visible</option>
                      <option value="internal_draft">Internal Draft</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Resource / Asset URL * (Safe HTTP/HTTPS only)
                  </label>
                  <input
                    type="url"
                    required
                    value={deliverableForm.resource_url}
                    onChange={(e) => setDeliverableForm({ ...deliverableForm, resource_url: e.target.value })}
                    placeholder="https://staging.avartah.com or https://drive.google.com/..."
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Description / Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={deliverableForm.description}
                    onChange={(e) => setDeliverableForm({ ...deliverableForm, description: e.target.value })}
                    placeholder="Instructions or credentials notes for client review..."
                    className="w-full px-4 py-2 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsDeliverableModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-emerald-400"
                  >
                    Publish Deliverable
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACTIVITY / NOTE MODAL */}
      <AnimatePresence>
        {isActivityModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-4">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  Post Update or Note
                </h3>
                <button
                  onClick={() => setIsActivityModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handlePostActivity} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Visibility
                  </label>
                  <select
                    value={activityForm.visibility}
                    onChange={(e) => setActivityForm({ ...activityForm, visibility: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="client_visible">Client Visible Update</option>
                    <option value="internal_only">🔒 Internal Admin Note Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={activityForm.message}
                    onChange={(e) => setActivityForm({ ...activityForm, message: e.target.value })}
                    placeholder="Enter milestone update, sprint note, or administrative log..."
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-black border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsActivityModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-emerald-400"
                  >
                    Post Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
