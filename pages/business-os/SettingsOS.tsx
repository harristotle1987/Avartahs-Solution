import React, { useState, useEffect } from 'react';
import { BusinessOSLayout } from '../../components/business-os/BusinessOSLayout';
import { useBusinessOS } from '../../context/BusinessOSContext';
import { businessOSApi } from '../../lib/businessOSApi';
import { TenantMember } from '../../types';
import {
  Settings,
  Building2,
  CreditCard,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  ShieldCheck,
  Save
} from 'lucide-react';

export const SettingsOS: React.FC = () => {
  const { activeTenant, refreshActiveTenant } = useBusinessOS();

  const [activeTab, setActiveTab] = useState<'profile' | 'billing_settings' | 'staff'>('profile');

  // Business Profile Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [currency, setCurrency] = useState('NGN');

  // Invoicing & Banking Fields
  const [customerLabel, setCustomerLabel] = useState('Customer');
  const [catalogLabel, setCatalogLabel] = useState('Catalogue');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [quotationPrefix, setQuotationPrefix] = useState('QTE');
  const [taxRate, setTaxRate] = useState<number>(7.5);
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');

  // Staff Members
  const [staff, setStaff] = useState<TenantMember[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<'admin' | 'staff'>('staff');

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeTenant) {
      setName(activeTenant.name || '');
      setEmail(activeTenant.email || activeTenant.owner_email || '');
      setPhone(activeTenant.phone || '');
      setAddress(activeTenant.address || '');
      setCity(activeTenant.city || '');
      setState(activeTenant.state || '');
      setCurrency(activeTenant.currency || 'NGN');

      if (activeTenant.settings) {
        setCustomerLabel(activeTenant.settings.customer_label || 'Customer');
        setCatalogLabel(activeTenant.settings.catalog_label || 'Catalogue');
        setInvoicePrefix(activeTenant.settings.invoice_prefix || 'INV');
        setQuotationPrefix(activeTenant.settings.quotation_prefix || 'QTE');
        setTaxRate(Number(activeTenant.settings.tax_rate_percentage || 7.5));
        setBankName(activeTenant.settings.bank_name || '');
        setBankAccount(activeTenant.settings.bank_account_number || '');
        setBankAccountName(activeTenant.settings.bank_account_name || '');
        setPaymentInstructions(activeTenant.settings.payment_instructions || '');
        setReceiptFooter(activeTenant.settings.receipt_footer_note || '');
      }

      loadStaff();
    }
  }, [activeTenant?.id]);

  const loadStaff = async () => {
    if (!activeTenant) return;
    try {
      const data = await businessOSApi.getStaff(activeTenant.id);
      setStaff(data);
    } catch (err) {
      console.warn('Failed to load staff members:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await businessOSApi.updateTenant(activeTenant.id, {
        name,
        email,
        phone,
        address,
        city,
        state,
        currency
      });
      await refreshActiveTenant();
      setStatusMessage('Business profile successfully updated.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await businessOSApi.updateSettings(activeTenant.id, {
        customer_label: customerLabel,
        catalog_label: catalogLabel,
        invoice_prefix: invoicePrefix,
        quotation_prefix: quotationPrefix,
        tax_rate_percentage: taxRate,
        bank_name: bankName,
        bank_account_number: bankAccount,
        bank_account_name: bankAccountName,
        payment_instructions: paymentInstructions,
        receipt_footer_note: receiptFooter
      });
      await refreshActiveTenant();
      setStatusMessage('Invoicing and banking settings saved.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail.trim() || !activeTenant) return;
    setSaving(true);
    try {
      await businessOSApi.inviteStaff(activeTenant.id, {
        name: staffName,
        email: staffEmail,
        role: staffRole
      });
      setInviteModalOpen(false);
      setStaffName('');
      setStaffEmail('');
      loadStaff();
      setStatusMessage('Staff member added.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add staff member.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStaff = async (memberId: string) => {
    if (!activeTenant) return;
    if (!confirm('Remove this staff account?')) return;
    try {
      await businessOSApi.removeStaff(activeTenant.id, memberId);
      loadStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to remove staff');
    }
  };

  return (
    <BusinessOSLayout
      title="Settings & Configuration"
      subtitle="Manage your business identity, bank accounts, custom terminology, and team accounts."
    >
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#202327]">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'profile'
              ? 'bg-[#C58A52] text-black shadow-md shadow-[#C58A52]/15'
              : 'bg-[#16181C] text-[#8E959E] hover:text-white border border-[#25282D]'
          }`}
        >
          <Building2 size={14} />
          <span>Business Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('billing_settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'billing_settings'
              ? 'bg-[#C58A52] text-black shadow-md shadow-[#C58A52]/15'
              : 'bg-[#16181C] text-[#8E959E] hover:text-white border border-[#25282D]'
          }`}
        >
          <CreditCard size={14} />
          <span>Banking & Terminology</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'staff'
              ? 'bg-[#C58A52] text-black shadow-md shadow-[#C58A52]/15'
              : 'bg-[#16181C] text-[#8E959E] hover:text-white border border-[#25282D]'
          }`}
        >
          <Users size={14} />
          <span>Staff Accounts ({staff.length})</span>
        </button>
      </div>

      {statusMessage && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Profile Form */}
      {activeTab === 'profile' && (
        <div className="p-6 rounded-2xl bg-[#16181C] border border-[#25282D] max-w-2xl">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Business Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Public Contact Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Official Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Operating Street Address</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Suite, Street, District"
                className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Lagos"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  placeholder="e.g. Lagos State"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                >
                  <option value="NGN">NGN (₦)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Banking & Terminology */}
      {activeTab === 'billing_settings' && (
        <div className="p-6 rounded-2xl bg-[#16181C] border border-[#25282D] max-w-2xl">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="border-b border-[#22252A] pb-3 mb-4">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Adaptive Terminology</h3>
              <p className="text-[11px] text-[#8E959E]">Customize terminology across the UI, invoice PDFs, and client receipts.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Customer Terminology</label>
                <input
                  type="text"
                  value={customerLabel}
                  onChange={e => setCustomerLabel(e.target.value)}
                  placeholder="Client, Guest, Patient, Buyer"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Catalogue Terminology</label>
                <input
                  type="text"
                  value={catalogLabel}
                  onChange={e => setCatalogLabel(e.target.value)}
                  placeholder="Treatments, Menu Items, Services"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>
            </div>

            <div className="border-b border-[#22252A] pb-3 pt-3 mb-4">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Invoice Banking Details</h3>
              <p className="text-[11px] text-[#8E959E]">This information will be printed on all invoices and quotations.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="Zenith Bank, GTBank, etc."
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Account Number</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  placeholder="10-digit NUBAN"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Account Beneficiary Name</label>
              <input
                type="text"
                value={bankAccountName}
                onChange={e => setBankAccountName(e.target.value)}
                placeholder="Official Company Bank Name"
                className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Payment Instructions</label>
              <textarea
                rows={2}
                value={paymentInstructions}
                onChange={e => setPaymentInstructions(e.target.value)}
                placeholder="Instructions on invoice footer..."
                className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Banking & Terminology</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Accounts Tab */}
      {activeTab === 'staff' && (
        <div className="p-6 rounded-2xl bg-[#16181C] border border-[#25282D] max-w-3xl">
          <div className="flex items-center justify-between pb-4 border-b border-[#22252A] mb-5">
            <div>
              <h3 className="font-bold text-white text-sm">Staff Team & Roles (RBAC)</h3>
              <p className="text-[11px] text-[#8E959E]">Control member access to invoicing, customer lists, and financial records.</p>
            </div>
            <button
              onClick={() => setInviteModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} />
              <span>Add Staff Account</span>
            </button>
          </div>

          <div className="divide-y divide-[#202327]">
            {staff.map((member, mIdx) => (
              <div key={`member-${member.id || 'id'}-${mIdx}`} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white text-xs">{member.name || 'Staff Member'}</div>
                  <div className="text-[11px] text-[#8E959E]">{member.user_email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                    member.role === 'owner' ? 'bg-[#C58A52]/20 text-[#E5A96A] border border-[#C58A52]/40' : 'bg-[#1C1F24] text-[#8E959E] border border-[#2B2F36]'
                  }`}>
                    {member.role}
                  </span>
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveStaff(member.id)}
                      className="p-1 rounded text-[#8E959E] hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Staff Modal */}
          {inviteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="bg-[#181B1F] border border-[#2B2F36] rounded-2xl max-w-sm w-full p-6 shadow-2xl">
                <h3 className="text-sm font-bold text-white mb-3">Add Staff Account</h3>
                <form onSubmit={handleInviteStaff} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[#8E959E] mb-1">Staff Member Name</label>
                    <input
                      type="text"
                      required
                      value={staffName}
                      onChange={e => setStaffName(e.target.value)}
                      placeholder="e.g. Tunde Adeyemi"
                      className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8E959E] mb-1">Staff Email *</label>
                    <input
                      type="email"
                      required
                      value={staffEmail}
                      onChange={e => setStaffEmail(e.target.value)}
                      placeholder="staff@company.com"
                      className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8E959E] mb-1">Role Permission</label>
                    <select
                      value={staffRole}
                      onChange={e => setStaffRole(e.target.value as any)}
                      className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3 py-2 text-white"
                    >
                      <option value="staff">Staff (Front Desk / Cashier)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                  </div>
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteModalOpen(false)}
                      className="px-3 py-1.5 rounded-lg bg-[#22252A] text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg bg-[#C58A52] text-black font-semibold"
                    >
                      Save Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </BusinessOSLayout>
  );
};
