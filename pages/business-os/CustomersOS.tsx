import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BusinessOSLayout } from '../../components/business-os/BusinessOSLayout';
import { useBusinessOS } from '../../context/BusinessOSContext';
import { businessOSApi } from '../../lib/businessOSApi';
import { Customer } from '../../types';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Building,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowUpRight,
  Receipt,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

export const CustomersOS: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeTenant, formatCurrency } = useBusinessOS();

  const customerLabel = activeTenant?.settings?.customer_label || 'Customer';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCustomers = async (searchQuery?: string) => {
    if (!activeTenant) return;
    try {
      const data = await businessOSApi.getCustomers(activeTenant.id, searchQuery);
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTenant) {
      fetchCustomers();
    }
    if (searchParams.get('action') === 'new') {
      openAddModal();
    }
  }, [activeTenant?.id, searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(search);
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormCompany('');
    setFormAddress('');
    setFormNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormName(cust.name);
    setFormEmail(cust.email || '');
    setFormPhone(cust.phone || '');
    setFormCompany(cust.company_name || '');
    setFormAddress(cust.address || '');
    setFormNotes(cust.notes || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError(`Please enter a valid ${customerLabel} name.`);
      return;
    }
    if (!activeTenant) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await businessOSApi.saveCustomer(activeTenant.id, {
        id: editingCustomer?.id,
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        company_name: formCompany.trim() || undefined,
        address: formAddress.trim() || undefined,
        notes: formNotes.trim() || undefined
      });

      setModalOpen(false);
      fetchCustomers(search);
    } catch (err: any) {
      setFormError(err.message || `Failed to save ${customerLabel}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeTenant) return;
    if (!confirm(`Are you sure you want to remove this ${customerLabel}?`)) return;

    try {
      await businessOSApi.deleteCustomer(activeTenant.id, id);
      fetchCustomers(search);
      if (detailCustomer?.id === id) setDetailCustomer(null);
    } catch (err: any) {
      alert(err.message || 'Error deleting customer');
    }
  };

  const totalOutstanding = customers.reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0);
  const totalSpent = customers.reduce((sum, c) => sum + Number(c.total_spent || 0), 0);

  return (
    <BusinessOSLayout
      title={`${customerLabel} Management`}
      subtitle={`Manage your client relationships, phone contacts, lifetime spend, and balances.`}
      actionButton={
        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-[#C58A52]/20 transition-all"
        >
          <Plus size={15} />
          <span>Add {customerLabel}</span>
        </button>
      }
    >
      {/* Metric summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[#16181C] border border-[#25282D]">
          <div className="text-xs text-[#8E959E] mb-1">Total {customerLabel} Count</div>
          <div className="text-xl font-bold text-white font-mono">{customers.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#16181C] border border-[#25282D]">
          <div className="text-xs text-[#8E959E] mb-1">Total Lifetime Spent</div>
          <div className="text-xl font-bold text-emerald-400 font-mono">{formatCurrency(totalSpent)}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#16181C] border border-[#25282D]">
          <div className="text-xs text-[#8E959E] mb-1">Total Unsettled Balances</div>
          <div className="text-xl font-bold text-[#E5A96A] font-mono">{formatCurrency(totalOutstanding)}</div>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E959E]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${customerLabel} by name, phone, email, or company...`}
            className="w-full bg-[#16181C] border border-[#25282D] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5A606A] focus:outline-none focus:border-[#C58A52] transition-colors"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-[#1C1F24] hover:bg-[#25282D] border border-[#2B2F36] text-xs font-semibold text-white transition-colors"
        >
          Filter
        </button>
      </form>

      {/* Customer Directory Table */}
      <div className="rounded-2xl bg-[#16181C] border border-[#25282D] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141619] text-[#8E959E] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3 font-semibold">{customerLabel} Name</th>
                <th className="px-5 py-3 font-semibold">Contact Info</th>
                <th className="px-5 py-3 font-semibold">Company</th>
                <th className="px-5 py-3 font-semibold">Total Spent</th>
                <th className="px-5 py-3 font-semibold">Balance Due</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202327]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[#8E959E]">
                    <Loader2 size={18} className="animate-spin inline mr-2 text-[#C58A52]" />
                    Loading {customerLabel} records...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[#8E959E]">
                    No {customerLabel.toLowerCase()} records found. Click "Add {customerLabel}" to create your first contact.
                  </td>
                </tr>
              ) : (
                customers.map((cust, cIdx) => (
                  <tr
                    key={`cust-${cust.id || 'id'}-${cIdx}`}
                    onClick={() => setDetailCustomer(cust)}
                    className="hover:bg-[#1A1D21] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{cust.name}</div>
                      {cust.notes && <div className="text-[10px] text-[#8E959E] truncate max-w-[200px]">{cust.notes}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-[#A6ADB5]">
                      {cust.phone && <div className="flex items-center gap-1.5"><Phone size={12} className="text-[#8E959E]" /><span>{cust.phone}</span></div>}
                      {cust.email && <div className="flex items-center gap-1.5 text-[11px] text-[#8E959E]"><Mail size={12} /><span>{cust.email}</span></div>}
                    </td>
                    <td className="px-5 py-3.5 text-[#A6ADB5]">
                      {cust.company_name || '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-emerald-400 font-medium">
                      {formatCurrency(cust.total_spent)}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      {Number(cust.outstanding_balance) > 0 ? (
                        <span className="text-[#E5A96A] font-semibold">{formatCurrency(cust.outstanding_balance)}</span>
                      ) : (
                        <span className="text-[#8E959E]">₦0</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/business-os/invoices?action=new&customer_id=${cust.id}&customer_name=${encodeURIComponent(cust.name)}`)}
                          title="Generate Invoice"
                          className="p-1.5 rounded-lg bg-[#1C1F24] hover:bg-[#25282D] text-[#ECEEEF] hover:text-[#C58A52] transition-colors"
                        >
                          <Receipt size={14} />
                        </button>
                        <button
                          onClick={() => openEditModal(cust)}
                          title="Edit"
                          className="p-1.5 rounded-lg bg-[#1C1F24] hover:bg-[#25282D] text-[#ECEEEF] hover:text-white transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(cust.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg bg-[#1C1F24] hover:bg-red-500/20 text-[#8E959E] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#181B1F] border border-[#2B2F36] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#25282D] mb-5">
              <h3 className="text-base font-bold text-white">
                {editingCustomer ? `Edit ${customerLabel}` : `Add New ${customerLabel}`}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[#8E959E] hover:text-white hover:bg-[#22262C]"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Amara Kalu"
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="client@mail.com"
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+234..."
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Company / Organization</label>
                <input
                  type="text"
                  value={formCompany}
                  onChange={e => setFormCompany(e.target.value)}
                  placeholder="Optional company name"
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Physical Delivery / Office Address</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  placeholder="Street, City, State"
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Notes / Preferences</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Special preferences, VIP details..."
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#22252A] hover:bg-[#2B2F36] text-xs font-medium text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>{editingCustomer ? 'Save Changes' : `Create ${customerLabel}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </BusinessOSLayout>
  );
};
