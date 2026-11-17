import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Receipt,
  Users,
  TrendingUp,
  ShieldCheck,
  Zap,
  Globe2,
  Building2,
  ChevronRight,
  HelpCircle,
  Scissors,
  Utensils,
  ShoppingBag,
  Briefcase,
  Scale,
  Wrench,
  Armchair
} from 'lucide-react';

export const LandingPageOS: React.FC = () => {
  const [selectedIndustry, setSelectedIndustry] = useState<'salon' | 'restaurant' | 'retail' | 'legal' | 'automotive' | 'furniture'>('salon');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const industries = [
    { id: 'salon', label: 'Salon & Spa', icon: Scissors, clientTerm: 'Client', feature: 'Appointment styling packages & treatment receipts' },
    { id: 'restaurant', label: 'Restaurant & Lounge', icon: Utensils, clientTerm: 'Guest / Diner', feature: 'Firewood jollof & VIP room reservations billing' },
    { id: 'retail', label: 'Retail & Fashion', icon: ShoppingBag, clientTerm: 'Customer', feature: 'Merchandise inventory tracking & barcode SKUs' },
    { id: 'legal', label: 'Law Firm', icon: Scale, clientTerm: 'Client', feature: 'CAC corporate retainers & dispute litigation quotes' },
    { id: 'automotive', label: 'Auto Workshop', icon: Wrench, clientTerm: 'Vehicle Owner', feature: 'Computer diagnostics & engine overhaul invoicing' },
    { id: 'furniture', label: 'Furniture Showroom', icon: Armchair, clientTerm: 'Buyer', feature: 'Interior space renders & custom teak woodwork bills' }
  ];

  const faqs = [
    {
      q: 'Can I start using Avartah Business OS for free?',
      a: 'Yes! The Free Starter tier is 100% free with no credit card required. You can manage up to 30 customers and issue 15 invoices every month.'
    },
    {
      q: 'Does it support Nigerian bank transfers and local payment instructions?',
      a: 'Absolutely. Every invoice and quotation displays your designated Nigerian bank account details (Zenith, GTBank, Access, etc.) along with direct WhatsApp receipt sharing.'
    },
    {
      q: 'Can I customize the terminology for my specific industry?',
      a: 'Yes! When you onboard as a Law Firm, your contacts are called "Clients" and catalog items are "Legal Practices". If you run a restaurant, they become "Guests" and "Menu Items".'
    },
    {
      q: 'Is my data secure and isolated from other businesses?',
      a: 'Every business has strict tenant isolation backed by dedicated PostgreSQL foreign keys and Row Level Security policies. Only authorized staff members can view your records.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#111315] text-[#ECEEEF] selection:bg-[#C58A52]/30 selection:text-[#E5A96A]">
      {/* Top Bar / Navigation */}
      <nav className="border-b border-[#202327] bg-[#141619]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C58A52] to-[#8C5D30] flex items-center justify-center font-bold text-black text-sm shadow-md shadow-[#C58A52]/20">
              A
            </div>
            <span className="font-semibold text-base tracking-tight text-white flex items-center gap-2">
              Avartah <span className="text-[#C58A52] font-mono text-xs uppercase px-1.5 py-0.5 rounded bg-[#C58A52]/10 border border-[#C58A52]/30">Business OS</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-xs text-[#9CA3AF]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#industries" className="hover:text-white transition-colors">Industries</a>
            <Link to="/business-os/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/business-os/dashboard"
              className="text-xs text-[#ECEEEF] hover:text-[#C58A52] px-3 py-1.5 rounded-lg border border-[#2B2F36] hover:border-[#C58A52]/40 transition-colors"
            >
              Demo Workspace
            </Link>
            <Link
              to="/business-os/register"
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#C58A52] hover:bg-[#D4985F] text-black shadow-md shadow-[#C58A52]/20 transition-all flex items-center gap-1.5"
            >
              <span>Start Free</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-8 overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#C58A52]/10 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C1F24] border border-[#2B2F36] text-xs text-[#C58A52] font-medium mb-6">
            <Sparkles size={14} />
            <span>Next-Generation Operating System for Nigerian & Global Small Businesses</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.15]">
            Run Your Business. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C58A52] via-[#E5A96A] to-[#C58A52]">
              Grow With Confidence.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-[#9CA3AF] max-w-2xl mx-auto mb-10 leading-relaxed">
            Eliminate disorganized WhatsApp receipts and lost paper invoices. Avartah Business OS combines adaptive CRM, automated quotations, bank transfer tracking, and custom industry workflows into one elegant workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link
              to="/business-os/register"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-sm shadow-xl shadow-[#C58A52]/25 transition-all flex items-center justify-center gap-2"
            >
              <span>Start Free Now</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/business-os/dashboard"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#181B1F] hover:bg-[#202328] text-white border border-[#2B2F36] font-medium text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Explore Live Dashboard</span>
              <ChevronRight size={16} className="text-[#8E959E]" />
            </Link>
          </div>

          {/* Interactive Live Preview Mockup Card */}
          <div className="rounded-2xl border border-[#282C33] bg-[#14161A] shadow-2xl p-4 sm:p-6 text-left relative overflow-hidden">
            {/* Window Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#22252A] mb-5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-2 text-xs font-mono text-[#8E959E]">workspace.avartah.os / apex-luxe-spa</span>
              </div>
              <div className="text-xs px-2.5 py-0.5 rounded-full bg-[#C58A52]/10 border border-[#C58A52]/30 text-[#E5A96A] font-mono">
                LIVE DEMO
              </div>
            </div>

            {/* Dashboard Content Mockup */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[#1A1D21] border border-[#262A30]">
                <div className="text-xs text-[#8E959E] mb-1">Total Revenue Collected</div>
                <div className="text-xl font-bold text-white font-mono">₦2,450,000</div>
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <TrendingUp size={12} /> +18.4% from last month
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#1A1D21] border border-[#262A30]">
                <div className="text-xs text-[#8E959E] mb-1">Active Clients Tracked</div>
                <div className="text-xl font-bold text-white font-mono">142</div>
                <div className="text-[11px] text-[#8E959E] mt-1">28 booked this week</div>
              </div>
              <div className="p-4 rounded-xl bg-[#1A1D21] border border-[#262A30]">
                <div className="text-xs text-[#8E959E] mb-1">Pending Invoice Balances</div>
                <div className="text-xl font-bold text-[#E5A96A] font-mono">₦185,000</div>
                <div className="text-[11px] text-amber-400 mt-1">3 awaiting transfer confirmation</div>
              </div>
            </div>

            {/* Recent Live Transactions inside mockup */}
            <div className="rounded-xl bg-[#171A1E] border border-[#24272D] p-4">
              <div className="text-xs font-semibold text-white mb-3">Recent Invoices & WhatsApp Receipts</div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1D2025]">
                  <div>
                    <span className="font-medium text-white">Amara Kalu</span>
                    <span className="text-[#8E959E] ml-2 font-mono text-[11px]">APX-INV-1001</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#8E959E]">Bridal Glam Package</span>
                    <span className="font-mono font-semibold text-emerald-400">₦250,000</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PAID</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1D2025]">
                  <div>
                    <span className="font-medium text-white">Tunde Adeleke</span>
                    <span className="text-[#8E959E] ml-2 font-mono text-[11px]">APX-INV-1002</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#8E959E]">Hydrafacial & Grooming</span>
                    <span className="font-mono font-semibold text-amber-400">₦185,000</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">PARTIAL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Industries Section */}
      <section id="industries" className="py-20 border-t border-[#202327] bg-[#131518] px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Adaptive Workflows for Every Industry
            </h2>
            <p className="text-xs sm:text-sm text-[#8E959E] max-w-xl mx-auto">
              No generic jargon. When you choose your industry, Avartah Business OS reconfigures your labels, catalog presets, and invoice templates automatically.
            </p>
          </div>

          {/* Industry Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {industries.map(ind => {
              const Icon = ind.icon;
              const isSelected = selectedIndustry === ind.id;
              return (
                <button
                  key={ind.id}
                  onClick={() => setSelectedIndustry(ind.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#C58A52] text-black shadow-lg shadow-[#C58A52]/20'
                      : 'bg-[#181B1F] text-[#8E959E] hover:text-white border border-[#25282D]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{ind.label}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Industry Card Preview */}
          {(() => {
            const current = industries.find(i => i.id === selectedIndustry) || industries[0];
            return (
              <div className="p-6 sm:p-8 rounded-2xl bg-[#171A1E] border border-[#282B31] max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#C58A52]/15 border border-[#C58A52]/30 flex items-center justify-center text-[#E5A96A]">
                    <current.icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{current.label} Configuration</h3>
                    <p className="text-xs text-[#8E959E]">Terminology: Contacts are labeled as <span className="text-[#E5A96A] font-semibold">"{current.clientTerm}"</span></p>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-[#9CA3AF] mb-6">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#C58A52] shrink-0 mt-0.5" />
                    <span>Specialized feature: {current.feature}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#C58A52] shrink-0 mt-0.5" />
                    <span>Instant catalogue items ready to bill immediately upon registration</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#C58A52] shrink-0 mt-0.5" />
                    <span>Automated payment tracking via Zenith, GTBank, and local transfer references</span>
                  </div>
                </div>
                <Link
                  to={`/business-os/register?industry=${current.id}`}
                  className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-[#C58A52]/20 hover:bg-[#C58A52]/30 text-[#E5A96A] border border-[#C58A52]/40 transition-colors"
                >
                  <span>Launch {current.label} Workspace</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Engineered for Modern Commerce
          </h2>
          <p className="text-xs sm:text-sm text-[#8E959E] max-w-lg mx-auto">
            Everything your team needs to sell, bill, collect, and retain high-value clients.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#16181C] border border-[#25282D]">
            <div className="w-10 h-10 rounded-xl bg-[#C58A52]/15 text-[#E5A96A] flex items-center justify-center mb-4">
              <Receipt size={20} />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Quotations to Invoices</h3>
            <p className="text-xs text-[#8E959E] leading-relaxed">
              Draft professional estimates and convert them into official invoices in one click. Calculate VAT (7.5%) and volume discounts effortlessly.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#16181C] border border-[#25282D]">
            <div className="w-10 h-10 rounded-xl bg-[#C58A52]/15 text-[#E5A96A] flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Customer Ledger & Balances</h3>
            <p className="text-xs text-[#8E959E] leading-relaxed">
              Track lifetime spend and outstanding balances per customer. Never wonder which client has an unsettled tab or pending payment.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#16181C] border border-[#25282D]">
            <div className="w-10 h-10 rounded-xl bg-[#C58A52]/15 text-[#E5A96A] flex items-center justify-center mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-white text-base mb-2">Multi-User RBAC & Staff Seats</h3>
            <p className="text-xs text-[#8E959E] leading-relaxed">
              Grant cashiers, front desk personnel, and managers distinct permission levels. Ensure business owners maintain full audit oversight.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20 border-t border-[#202327] bg-[#14161A] px-4 sm:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Transparent Pricing Designed for African Growth
          </h2>
          <p className="text-xs sm:text-sm text-[#8E959E] max-w-lg mx-auto mb-10">
            Start completely free. Upgrade seamlessly as your team, client volume, and revenue scale.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            <div className="p-5 rounded-xl bg-[#181B1F] border border-[#25282D]">
              <div className="text-xs font-semibold text-[#8E959E] uppercase tracking-wider mb-1">Free</div>
              <div className="text-xl font-bold text-white font-mono mb-2">₦0<span className="text-xs text-[#8E959E]">/mo</span></div>
              <p className="text-[11px] text-[#8E959E] mb-4">Up to 30 clients & 15 invoices/mo</p>
              <Link to="/business-os/register?plan=free" className="block text-center text-xs py-2 rounded-lg bg-[#25282D] hover:bg-[#2E3238] text-white font-medium">
                Select Free
              </Link>
            </div>

            <div className="p-5 rounded-xl bg-[#181B1F] border border-[#25282D]">
              <div className="text-xs font-semibold text-[#8E959E] uppercase tracking-wider mb-1">Starter</div>
              <div className="text-xl font-bold text-white font-mono mb-2">₦15,000<span className="text-xs text-[#8E959E]">/mo</span></div>
              <p className="text-[11px] text-[#8E959E] mb-4">200 clients & 2 staff accounts</p>
              <Link to="/business-os/register?plan=starter" className="block text-center text-xs py-2 rounded-lg bg-[#25282D] hover:bg-[#2E3238] text-white font-medium">
                Choose Starter
              </Link>
            </div>

            <div className="p-5 rounded-xl bg-[#1C1F24] border border-[#C58A52]/40 relative shadow-lg shadow-[#C58A52]/10">
              <span className="absolute -top-2.5 right-4 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C58A52] text-black">
                POPULAR
              </span>
              <div className="text-xs font-semibold text-[#E5A96A] uppercase tracking-wider mb-1">Growth Pro</div>
              <div className="text-xl font-bold text-white font-mono mb-2">₦35,000<span className="text-xs text-[#8E959E]">/mo</span></div>
              <p className="text-[11px] text-[#8E959E] mb-4">1,000 clients & unlimited staff seats</p>
              <Link to="/business-os/register?plan=growth" className="block text-center text-xs py-2 rounded-lg bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold">
                Choose Growth
              </Link>
            </div>

            <div className="p-5 rounded-xl bg-[#181B1F] border border-[#25282D]">
              <div className="text-xs font-semibold text-[#8E959E] uppercase tracking-wider mb-1">Enterprise Scale</div>
              <div className="text-xl font-bold text-white font-mono mb-2">₦75,000<span className="text-xs text-[#8E959E]">/mo</span></div>
              <p className="text-[11px] text-[#8E959E] mb-4">Unlimited everything & staff seats</p>
              <Link to="/business-os/register?plan=pro" className="block text-center text-xs py-2 rounded-lg bg-[#25282D] hover:bg-[#2E3238] text-white font-medium">
                Choose Enterprise
              </Link>
            </div>
          </div>

          <div className="mt-8">
            <Link to="/business-os/pricing" className="text-xs text-[#C58A52] hover:underline flex items-center justify-center gap-1 font-medium">
              <span>View full feature comparison matrix</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-8 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Frequently Asked Questions</h2>
          <p className="text-xs sm:text-sm text-[#8E959E]">Everything you need to know about getting started</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={`faq-os-${index}-${faq.q.slice(0, 15)}`}
              className="rounded-xl border border-[#25282D] bg-[#16181C] overflow-hidden transition-all"
            >
              <button
                onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-semibold text-white hover:text-[#C58A52] transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronRight
                  size={16}
                  className={`text-[#8E959E] transition-transform ${faqOpen === index ? 'rotate-90' : ''}`}
                />
              </button>
              {faqOpen === index && (
                <div className="px-4 pb-4 text-xs text-[#9CA3AF] leading-relaxed border-t border-[#202327] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA Footer */}
      <footer className="py-16 border-t border-[#202327] bg-[#111315] px-4 sm:px-8 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Upgrade Your Business Operations?
          </h2>
          <p className="text-xs sm:text-sm text-[#8E959E] mb-8">
            Create your business profile in 60 seconds. No credit card required.
          </p>
          <Link
            to="/business-os/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-sm shadow-xl shadow-[#C58A52]/25 transition-all"
          >
            <span>Register Your Business Free</span>
            <ArrowRight size={16} />
          </Link>
          <div className="mt-12 text-[11px] text-[#555C66]">
            Avartah Business OS © {new Date().getFullYear()} · Multi-Tenant Cloud Architecture powered by Neon PostgreSQL
          </div>
        </div>
      </footer>
    </div>
  );
};
