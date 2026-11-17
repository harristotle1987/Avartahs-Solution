import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { businessOSApi } from '../../lib/businessOSApi';
import { useBusinessOS } from '../../context/BusinessOSContext';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Mail,
  Phone,
  Briefcase,
  Globe,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Lock
} from 'lucide-react';

export const RegisterOS: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshTenants } = useBusinessOS();
  const { isAuthenticated, user, openLogin } = useAuth();

  const initialPlan = searchParams.get('plan') || 'free';
  const initialIndustry = searchParams.get('industry') || 'salon';

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState(initialIndustry);
  const [ownerEmail, setOwnerEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('NG');
  const [currency, setCurrency] = useState('NGN');
  const [planId, setPlanId] = useState(initialPlan);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      setOwnerEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openLogin({ returnTo: '/business-os/register' });
      return;
    }
    if (!name.trim()) {
      setError('Please enter your business name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await businessOSApi.registerBusiness({
        name,
        industry,
        owner_email: user?.email || ownerEmail,
        phone,
        country,
        currency,
        plan_id: 'free' // Registration creates free workspace
      });

      await refreshTenants();

      if (planId && planId !== 'free') {
        // Paid plan selected: initialize Paystack checkout for newly registered tenant
        try {
          const payRes = await businessOSApi.initializePayment({
            tenant_id: res.tenant.id,
            plan_id: planId
          });
          if (payRes.authorization_url) {
            window.location.href = payRes.authorization_url;
            return;
          }
        } catch (payErr: any) {
          console.warn('[Checkout Redirect Warning]:', payErr.message);
          // If Paystack is unconfigured or fails, redirect to onboarding with notice
          navigate(`/business-os/billing?tenant=${res.tenant.id}&notice=payment_pending`);
          return;
        }
      }

      navigate(res.redirect || `/business-os/onboarding?tenant=${res.tenant.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to register business. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111315] text-[#ECEEEF] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-[#C58A52]/30 selection:text-[#E5A96A]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/business-os" className="inline-flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C58A52] to-[#8C5D30] flex items-center justify-center font-bold text-black text-sm shadow-md shadow-[#C58A52]/20">
            A
          </div>
          <span className="font-semibold text-lg text-white">Avartah Business OS</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Create Your Business Workspace
        </h2>
        <p className="mt-1 text-xs text-[#8E959E]">
          Set up multi-tenant invoicing, CRM, and payments in 60 seconds.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-[#16181B] border border-[#25282D] py-8 px-6 sm:px-10 rounded-2xl shadow-2xl">
          {!isAuthenticated ? (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-amber-400 shrink-0" />
                <span>You need an Avartah account to register and own a business.</span>
              </div>
              <button
                type="button"
                onClick={() => openLogin({ returnTo: '/business-os/register', mode: 'register' })}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors shrink-0 cursor-pointer"
              >
                Sign In / Register
              </button>
            </div>
          ) : (
            <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>Verified Account: <strong>{user?.email}</strong> (Will become Business Owner)</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Business Name */}
            <div>
              <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">
                Business Legal / Trading Name *
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E959E]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Apex Luxe Salon & Spa"
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5A606A] focus:outline-none focus:border-[#C58A52] transition-colors"
                />
              </div>
            </div>

            {/* Industry Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">
                Industry Category *
              </label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E959E]" />
                <select
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C58A52] transition-colors"
                >
                  <option value="salon">Salon & Spa (Treatments & Styling)</option>
                  <option value="restaurant">Restaurant & Eatery (Dining & Food)</option>
                  <option value="retail">Retail & Fashion Shop (Merchandise & Inventory)</option>
                  <option value="consulting">Professional Consultant & Agency</option>
                  <option value="legal">Law Firm & Legal Practice</option>
                  <option value="furniture">Furniture Showroom & Manufacturing</option>
                  <option value="automotive">Auto Workshop & Mechanical Repairs</option>
                  <option value="other">Other Commercial Business</option>
                </select>
              </div>
              <p className="text-[10px] text-[#8E959E] mt-1">
                Your selection automatically configures your terminology and seeds initial catalog items.
              </p>
            </div>

            {/* Owner Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">
                  Owner Email *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E959E]" />
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={e => setOwnerEmail(e.target.value)}
                    placeholder="director@company.com"
                    className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5A606A] focus:outline-none focus:border-[#C58A52] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">
                  Business Phone / WhatsApp
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E959E]" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+234 801 234 5678"
                    className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5A606A] focus:outline-none focus:border-[#C58A52] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Currency & Plan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">
                  Default Currency
                </label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E959E]" />
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  >
                    <option value="NGN">Nigerian Naira (₦)</option>
                    <option value="USD">US Dollar ($)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1.5">
                  Initial Subscription Tier
                </label>
                <select
                  value={planId}
                  onChange={e => setPlanId(e.target.value)}
                  className="w-full bg-[#1A1D21] border border-[#2B2F36] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                >
                  <option value="free">Free Starter (₦0/mo)</option>
                  <option value="starter">Growth Starter (₦15,000/mo)</option>
                  <option value="growth">Business Pro (₦35,000/mo)</option>
                  <option value="pro">Enterprise Scale (₦75,000/mo)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3 px-4 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs shadow-lg shadow-[#C58A52]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Provisioning Secure Workspace...</span>
                </>
              ) : (
                <>
                  <span>Create Business Workspace</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#8E959E]">
            Already have a registered business?{' '}
            <Link to="/business-os/dashboard" className="text-[#E5A96A] hover:underline font-medium">
              Access Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
