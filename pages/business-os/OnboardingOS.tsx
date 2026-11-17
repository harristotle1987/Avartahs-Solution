import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { businessOSApi } from '../../lib/businessOSApi';
import { useBusinessOS } from '../../context/BusinessOSContext';
import {
  CheckCircle2,
  Building2,
  CreditCard,
  Package,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const OnboardingOS: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshTenants, activeTenant, selectTenantById } = useBusinessOS();

  const tenantId = searchParams.get('tenant') || activeTenant?.id || '';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields - Real empty defaults
  const [industry, setIndustry] = useState('salon');
  const [customerLabel, setCustomerLabel] = useState('Client');
  const [catalogLabel, setCatalogLabel] = useState('Treatments & Services');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('Please include your invoice number as transfer reference.');
  const [seedCatalog, setSeedCatalog] = useState(true);

  // Load tenant info
  useEffect(() => {
    if (!tenantId) return;
    async function load() {
      try {
        const t = await businessOSApi.getTenant(tenantId);
        setIndustry(t.industry || 'salon');
        if (t.settings) {
          setCustomerLabel(t.settings.customer_label || 'Client');
          setCatalogLabel(t.settings.catalog_label || 'Treatments & Services');
          if (t.settings.bank_name) setBankName(t.settings.bank_name);
          if (t.settings.bank_account_number) setAccountNumber(t.settings.bank_account_number);
          if (t.settings.bank_account_name) setAccountName(t.settings.bank_account_name);
        }
        if (!accountName) setAccountName(t.name);
      } catch (err) {}
    }
    load();
  }, [tenantId]);

  const handleFinish = async () => {
    if (!tenantId) {
      setError('Please select or register a business first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await businessOSApi.completeOnboarding(tenantId, {
        industry,
        customer_label: customerLabel,
        catalog_label: catalogLabel,
        bank_name: bankName,
        bank_account_number: accountNumber,
        bank_account_name: accountName,
        payment_instructions: paymentInstructions,
        seed_catalog: seedCatalog
      });

      await refreshTenants();
      selectTenantById(tenantId);
      navigate('/business-os/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111315] text-[#ECEEEF] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-[#C58A52]/30 selection:text-[#E5A96A]">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C1F24] border border-[#2B2F36] text-xs text-[#C58A52] font-medium mb-3">
          <Sparkles size={14} />
          <span>Quick 3-Step Setup</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Configure Your Business OS
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[#8E959E]">
          Tailor custom terminology, bank accounts, and initial inventory presets.
        </p>

        {/* Stepper indicator */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 1 ? 'text-[#E5A96A]' : 'text-[#5A606A]'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-[#C58A52] text-black font-bold' : 'bg-[#1C1F24] text-[#8E959E]'}`}>1</span>
            <span>Terminology</span>
          </div>
          <div className="w-8 h-[1px] bg-[#2B2F36]" />
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 2 ? 'text-[#E5A96A]' : 'text-[#5A606A]'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-[#C58A52] text-black font-bold' : 'bg-[#1C1F24] text-[#8E959E]'}`}>2</span>
            <span>Bank & Payments</span>
          </div>
          <div className="w-8 h-[1px] bg-[#2B2F36]" />
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 3 ? 'text-[#E5A96A]' : 'text-[#5A606A]'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-[#C58A52] text-black font-bold' : 'bg-[#1C1F24] text-[#8E959E]'}`}>3</span>
            <span>Catalogue</span>
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-[#16181B] border border-[#25282D] py-8 px-6 sm:px-10 rounded-2xl shadow-2xl">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Industry & Terminology */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#22252A]">
                <Building2 className="text-[#C58A52]" size={20} />
                <div>
                  <h2 className="text-sm font-bold text-white">Adaptive Terminology</h2>
                  <p className="text-[11px] text-[#8E959E]">Customize how customers and offerings appear in menus and receipts.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">
                  What do you call your clients/buyers?
                </label>
                <input
                  type="text"
                  value={customerLabel}
                  onChange={e => setCustomerLabel(e.target.value)}
                  placeholder="e.g. Client, Guest, Patient, Buyer, Member"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
                <span className="text-[10px] text-[#8E959E] mt-1 block">
                  Replaces the default "Customer" label across navigation and forms.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">
                  What do you call your catalogue offerings?
                </label>
                <input
                  type="text"
                  value={catalogLabel}
                  onChange={e => setCatalogLabel(e.target.value)}
                  placeholder="e.g. Treatments, Menu Items, Legal Services, Spare Parts"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs transition-colors flex items-center gap-2"
                >
                  <span>Continue to Bank Details</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Bank & Payments */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#22252A]">
                <CreditCard className="text-[#C58A52]" size={20} />
                <div>
                  <h2 className="text-sm font-bold text-white">Bank Details for Invoices</h2>
                  <p className="text-[11px] text-[#8E959E]">Your clients will see this on every generated quotation and invoice.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. Zenith Bank, GTBank, Access Bank"
                    className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    placeholder="10-digit NUBAN account number"
                    className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  placeholder="Official Account Name"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">Payment Instructions</label>
                <textarea
                  rows={2}
                  value={paymentInstructions}
                  onChange={e => setPaymentInstructions(e.target.value)}
                  placeholder="Instructions displayed on bottom of invoice"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-[#1C1F24] hover:bg-[#25282D] text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs transition-colors flex items-center gap-2"
                >
                  <span>Continue to Catalogue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Default Catalogue Seeding */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#22252A]">
                <Package className="text-[#C58A52]" size={20} />
                <div>
                  <h2 className="text-sm font-bold text-white">Starter Catalogue Items</h2>
                  <p className="text-[11px] text-[#8E959E]">Start with curated, ready-to-bill products and services.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#1A1D21] border border-[#282C32] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-white">Seed Recommended Industry Items</div>
                  <div className="text-[11px] text-[#8E959E] mt-0.5">
                    Pre-populate standard offerings for immediate billing. You can edit or delete them anytime.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedCatalog}
                    onChange={e => setSeedCatalog(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#25282D] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C58A52]"></div>
                </label>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-xl bg-[#1C1F24] hover:bg-[#25282D] text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFinish}
                  className="px-6 py-2.5 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs shadow-lg shadow-[#C58A52]/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving Preferences...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Launch Business Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
