import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Edit2,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  LogOut,
  Power
} from 'lucide-react';
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getRegisteredUsers,
  updateRegisteredUser,
  revokeRegisteredUserSessions,
  type RegisteredUserAccount
} from '../lib/api';

type UserSectionTab = 'admins' | 'registered';

export const UsersManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<UserSectionTab>('admins');

  // Administrators (admin_users)
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', role: 'admin' });
  const [editFormData, setEditFormData] = useState({ role: 'admin', is_active: true, password: '' });

  // Registered Ordinary Users (users)
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserAccount[]>([]);
  const [registeredLoading, setRegisteredLoading] = useState(false);
  const [registeredSearch, setRegisteredSearch] = useState('');
  const [registeredStatusFilter, setRegisteredStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [busyUserId, setBusyUserId] = useState<string | number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showTempSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const fetchAdmins = useCallback(async () => {
    setAdminLoading(true);
    try {
      const data = await getAdminUsers();
      setAdminUsers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator accounts');
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const fetchRegistered = useCallback(async () => {
    setRegisteredLoading(true);
    try {
      const data = await getRegisteredUsers({
        search: registeredSearch,
        status: registeredStatusFilter
      });
      setRegisteredUsers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load registered user accounts');
    } finally {
      setRegisteredLoading(false);
    }
  }, [registeredSearch, registeredStatusFilter]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  useEffect(() => {
    if (activeTab === 'registered') {
      fetchRegistered();
    }
  }, [activeTab, fetchRegistered]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      await createAdminUser(formData);
      showTempSuccess('Administrator account provisioned successfully');
      setFormData({ email: '', password: '', role: 'admin' });
      setIsAddModalOpen(false);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || 'Failed to provision administrator');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await updateAdminUser(editingUser.id, editFormData);
      showTempSuccess('Administrator permissions updated');
      setEditingUser(null);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || 'Failed to update account');
    }
  };

  const handleDelete = async (id: number | string) => {
    if (!window.confirm('Are you sure you want to revoke this administrator account? All active sessions for this account will be terminated.')) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await deleteAdminUser(id);
      showTempSuccess('Administrator revoked and active sessions terminated');
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke administrator');
    }
  };

  const handleToggleRegisteredUserActive = async (user: RegisteredUserAccount) => {
    const nextActive = !user.is_active;
    if (!nextActive && !window.confirm(`Disable ${user.email} and revoke all active sessions?`)) {
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setBusyUserId(user.id);
    try {
      await updateRegisteredUser(user.id, { is_active: nextActive });
      showTempSuccess(nextActive ? `${user.email} activated` : `${user.email} disabled and sessions revoked`);
      await fetchRegistered();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRevokeRegisteredSessions = async (user: RegisteredUserAccount) => {
    setError(null);
    setSuccessMsg(null);
    setBusyUserId(user.id);
    try {
      const res = await revokeRegisteredUserSessions(user.id);
      showTempSuccess(`Revoked ${res.revoked_count || 0} active session(s) for ${user.email}`);
      await fetchRegistered();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke user sessions');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
            Access Control & Account Governance
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#747C84] mt-0.5">
            Administrators and ordinary registered users are strictly isolated across separate Neon tables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-[#111315] p-1 rounded-lg border border-slate-200 dark:border-[#30363B]">
            <button
              type="button"
              onClick={() => { setError(null); setActiveTab('admins'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'admins'
                  ? 'bg-[#C58A52] text-[#111315]'
                  : 'text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED]'
              }`}
            >
              <Shield size={13} />
              <span>Administrators ({adminUsers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setError(null); setActiveTab('registered'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'registered'
                  ? 'bg-[#C58A52] text-[#111315]'
                  : 'text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED]'
              }`}
            >
              <Users size={13} />
              <span>Registered Users</span>
            </button>
          </div>

          {activeTab === 'admins' && (
            <button
              onClick={() => { setError(null); setIsAddModalOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-lg transition-colors shadow-sm"
            >
              <UserPlus size={14} />
              <span>Provision Admin User</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-xs">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs">
          <CheckCircle size={14} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === 'admins' ? (
        <div className="bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg shadow-sm overflow-hidden">
          {adminLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#C58A52]" />
            </div>
          ) : adminUsers.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-[#747C84] text-xs">
              No administrator accounts located in database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#30363B] text-[11px] font-semibold uppercase text-slate-500 dark:text-[#747C84] bg-slate-50 dark:bg-[#111315]">
                    <th className="py-3 px-5">ID</th>
                    <th className="py-3 px-5">Administrator Email</th>
                    <th className="py-3 px-5">Privileged Role</th>
                    <th className="py-3 px-5">State</th>
                    <th className="py-3 px-5">Provisioned</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#30363B] font-medium">
                  {adminUsers.map((u, uIdx) => (
                    <tr key={`admin-row-${u.id || 'usr'}-${uIdx}`} className="hover:bg-slate-50/60 dark:hover:bg-[#202428]/40 transition-colors">
                      <td className="py-3.5 px-5 text-slate-400 dark:text-[#747C84] font-mono tabular-nums">#{u.id}</td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-[#F2F1ED]">{u.email}</td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-1.5 text-xs text-[#C58A52]">
                          <Shield size={13} />
                          <span className="capitalize">{u.role}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`text-[11px] font-medium ${u.is_active !== false ? 'text-emerald-500' : 'text-red-400'}`}>
                          {u.is_active !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 dark:text-[#747C84] font-mono tabular-nums text-[11px]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Initial'}
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setEditFormData({ role: u.role, is_active: u.is_active !== false, password: '' });
                          }}
                          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED] rounded"
                          title="Edit Permissions"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                          title="Revoke Administrator"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search & Status Filters for Registered Users */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg p-4 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={registeredSearch}
                onChange={(e) => setRegisteredSearch(e.target.value)}
                placeholder="Search registered users by email..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-xs text-slate-900 dark:text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={registeredStatusFilter}
                onChange={(e) => setRegisteredStatusFilter(e.target.value as 'all' | 'active' | 'disabled')}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
              >
                <option value="all">All Accounts</option>
                <option value="active">Active Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg shadow-sm overflow-hidden">
            {registeredLoading ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[#C58A52]" />
              </div>
            ) : registeredUsers.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-[#747C84] text-xs">
                No registered ordinary user accounts found matching the current filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#30363B] text-[11px] font-semibold uppercase text-slate-500 dark:text-[#747C84] bg-slate-50 dark:bg-[#111315]">
                      <th className="py-3 px-5">ID</th>
                      <th className="py-3 px-5">User Email</th>
                      <th className="py-3 px-5">Account Type</th>
                      <th className="py-3 px-5">State</th>
                      <th className="py-3 px-5">Active Sessions</th>
                      <th className="py-3 px-5">Registered</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#30363B] font-medium">
                    {registeredUsers.map((u, uIdx) => (
                      <tr key={`reg-user-row-${u.id || 'usr'}-${uIdx}`} className="hover:bg-slate-50/60 dark:hover:bg-[#202428]/40 transition-colors">
                        <td className="py-3.5 px-5 text-slate-400 dark:text-[#747C84] font-mono tabular-nums">#{u.id}</td>
                        <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-[#F2F1ED]">{u.email}</td>
                        <td className="py-3.5 px-5">
                          <span className="text-slate-600 dark:text-[#A3A9AF] capitalize">{u.role || 'user'}</span>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={`text-[11px] font-medium ${u.is_active !== false ? 'text-emerald-500' : 'text-red-400'}`}>
                            {u.is_active !== false ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-mono tabular-nums text-[11px] text-slate-600 dark:text-[#A3A9AF]">
                          {typeof u.active_sessions === 'number' ? u.active_sessions : 0}
                        </td>
                        <td className="py-3.5 px-5 text-slate-500 dark:text-[#747C84] font-mono tabular-nums text-[11px]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyUserId === u.id}
                              onClick={() => handleToggleRegisteredUserActive(u)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                                u.is_active !== false
                                  ? 'border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-500/10'
                                  : 'border-emerald-200 dark:border-emerald-900/40 text-emerald-500 hover:bg-emerald-500/10'
                              }`}
                              title={u.is_active !== false ? 'Deactivate Account' : 'Activate Account'}
                            >
                              <Power size={11} />
                              <span>{u.is_active !== false ? 'Disable' : 'Activate'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyUserId === u.id || (u.active_sessions || 0) === 0}
                              onClick={() => handleRevokeRegisteredSessions(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-200 dark:border-[#30363B] text-slate-600 dark:text-[#A3A9AF] hover:text-[#C58A52] hover:border-[#C58A52]/40 disabled:opacity-40 transition-colors"
                              title="Revoke Active Sessions"
                            >
                              <LogOut size={11} />
                              <span>Revoke Sessions</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddModalOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-[#30363B]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F2F1ED]">
                  Provision Administrator
                </h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-[#F2F1ED]">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="admin@avartah.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                  >
                    <option value="admin">Administrator</option>
                    <option value="editor">Editor / Reviewer</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold rounded-lg shadow-sm"
                  >
                    Provision Account
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Admin Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingUser(null)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-[#30363B]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F2F1ED]">
                  Edit Administrator: {editingUser.email}
                </h3>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-[#F2F1ED]">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                    System Role
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                  >
                    <option value="admin">Administrator</option>
                    <option value="editor">Editor / Reviewer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                    Reset Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    placeholder="Leave blank to preserve current"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                    className="rounded bg-white dark:bg-[#111315] border-slate-300 dark:border-[#30363B] text-[#C58A52] focus:ring-0"
                  />
                  <label htmlFor="isActiveCheck" className="text-slate-700 dark:text-[#A3A9AF] font-medium cursor-pointer">
                    Account Enabled (Active)
                  </label>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-[#747C84]">
                  Demoting, disabling, or updating passwords revokes existing sessions for this account. The last active admin cannot be removed.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-3.5 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold rounded-lg shadow-sm"
                  >
                    Update Account
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UsersManagement;
