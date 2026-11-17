import React from 'react';
import { Lead } from '../types';
import { Loader2 } from 'lucide-react';

interface LeadEditFormProps {
  editingLead: Partial<Lead>;
  setEditingLead: (lead: Partial<Lead>) => void;
  editingRevenueTiers: string[];
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const PIPELINE_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'pending', 'delivered', 'closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export const LeadEditForm: React.FC<LeadEditFormProps> = ({ 
  editingLead, 
  setEditingLead, 
  editingRevenueTiers,
  onSave,
  onCancel,
  isSaving
}) => {
  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Contact Name
          </label>
          <input 
            type="text"
            value={editingLead.contact_name || ''}
            onChange={(e) => setEditingLead({ ...editingLead, contact_name: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52] transition-colors"
            placeholder="e.g. John Doe"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Business / Organization
          </label>
          <input 
            type="text"
            value={editingLead.business_name || ''}
            onChange={(e) => setEditingLead({ ...editingLead, business_name: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52] transition-colors"
            placeholder="e.g. Acme Health Clinic"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Email Address
          </label>
          <input 
            type="email"
            value={editingLead.user_email || ''}
            onChange={(e) => setEditingLead({ ...editingLead, user_email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52] transition-colors"
            placeholder="founder@company.com"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Telephone / Mobile
          </label>
          <input 
            type="text"
            value={editingLead.user_phone || ''}
            onChange={(e) => setEditingLead({ ...editingLead, user_phone: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52] transition-colors"
            placeholder="+1 (555) 000-0000"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Website URL
          </label>
          <input 
            type="url"
            value={editingLead.target_url || ''}
            onChange={(e) => setEditingLead({ ...editingLead, target_url: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52] transition-colors"
            placeholder="https://example.com"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Requested Offering
          </label>
          <input 
            type="text"
            value={editingLead.requested_service || ''}
            onChange={(e) => setEditingLead({ ...editingLead, requested_service: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52] transition-colors"
            placeholder="Website Design & Development"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Pipeline Stage
          </label>
          <select 
            value={editingLead.status || 'New'}
            onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as Lead['status'] })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52]"
          >
            {PIPELINE_STATUSES.map((s, sIdx) => (
              <option key={`pipe-status-${sIdx}-${s}`} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Priority Tier
          </label>
          <select 
            value={editingLead.priority || 'Medium'}
            onChange={(e) => setEditingLead({ ...editingLead, priority: e.target.value as any })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52]"
          >
            {PRIORITIES.map((p, pIdx) => (
              <option key={`prio-tier-${pIdx}-${p}`} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Scheduled Follow-Up
          </label>
          <input 
            type="datetime-local"
            value={editingLead.follow_up_date ? new Date(editingLead.follow_up_date).toISOString().slice(0, 16) : ''}
            onChange={(e) => setEditingLead({ ...editingLead, follow_up_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs font-medium text-slate-900 dark:text-[#F2F1ED] outline-none focus:border-[#C58A52]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
          Activity Notes & Client Brief
        </label>
        <textarea 
          rows={3}
          value={editingLead.notes || ''}
          onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
          className="w-full px-3 py-2 bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] rounded-lg text-xs text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 dark:placeholder:text-[#747C84] outline-none focus:border-[#C58A52] transition-colors resize-none"
          placeholder="Record notes, call summaries, or follow-up milestones..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#30363B]">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          className="px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] disabled:opacity-50 text-[#111315] font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          {isSaving ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Save Lead Changes</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default LeadEditForm;
