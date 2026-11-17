import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export const PricingOS: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const navigate = useNavigate();

  const plans = [
    {
      id: 'free',
      name: 'Free Starter',
      tagline: 'Ideal for solo practitioners and nascent startups',
      priceNGN: 0,
      priceUSD: 0,
      popular: false,
      customers: '30 Customers',
      invoices: '15 Invoices & Quotes /mo',
      catalog: '15 Items',
      staff: '1 Seat',
      features: [
        'Automated Invoice & Quotation Generation',
        'Standard PDF & Print Receipts',
        'Nigerian Bank Transfer Details Display',
        'Customer Directory & Balances',
        'Mobile-Optimized Dashboard'
      ]
    },
    {
      id: 'starter',
      name: 'Growth Starter',
      tagline: 'Designed for active salons, retail stores and clinics',
      priceNGN: billingCycle === 'yearly' ? 12000 : 15000,
      priceUSD: billingCycle === 'yearly' ? 15 : 19,
      popular: false,
      customers: '200 Customers',
      invoices: '100 Invoices & Quotes /mo',
      catalog: '75 Items',
      staff: '2 Seats',
      features: [
        'Everything in Free Starter',
        'WhatsApp Shareable Payment Links',
        'Custom Invoice & Quotation Prefixes',
        'Tax & VAT (7.5%) Auto Calculation',
        'Payment Reconciliations & Receipts',
        '2 Staff Accounts with Basic Permissions'
      ]
    },
    {
      id: 'growth',
      name: 'Business Pro',
      tagline: 'For fast-growing restaurants, workshops & consultancies',
      priceNGN: billingCycle === 'yearly' ? 28000 : 35000,
      priceUSD: billingCycle === 'yearly' ? 36 : 45,
      popular: true,
      customers: '1,000 Customers',
      invoices: 'Unlimited Invoices',
      catalog: '500 Items',
      staff: 'Unlimited Seats',
      features: [
        'Everything in Growth Starter',
        'Unlimited Invoices & Quotations',
        'Stock & Inventory Level Tracking',
        'Unlimited Multi-User RBAC Staff Accounts',
        'Monthly Sales & Revenue Analytics Charts',
        'Custom Business Logo on Invoices',
        'Priority Technical Support'
      ]
    },
    {
      id: 'pro',
      name: 'Enterprise Scale',
      tagline: 'For law firms, corporate chains & high-volume merchants',
      priceNGN: billingCycle === 'yearly' ? 60000 : 75000,
      priceUSD: billingCycle === 'yearly' ? 76 : 95,
      popular: false,
      customers: 'Unlimited',
      invoices: 'Unlimited',
      catalog: 'Unlimited',
      staff: 'Unlimited Seats',
      features: [
        'Everything in Business Pro',
        'Unlimited Staff Accounts (Multi-Seat RBAC)',
        'Full Tenant Audit & Activity Logs',
        'Advanced Financial Export (CSV/Excel)',
        'Dedicated Account Manager',
        'Custom Feature Integrations & API Access'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#111315] text-[#ECEEEF] selection:bg-[#C58A52]/30 selection:text-[#E5A96A]">
      {/* Header */}
      <header className="border-b border-[#202327] bg-[#141619] px-4 sm:px-8 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/business-os" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C58A52] to-[#8C5D30] flex items-center justify-center font-bold text-black text-xs">
              A
            </div>
            <span className="font-semibold text-sm text-white">Avartah Business OS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/business-os/dashboard" className="text-xs text-[#8E959E] hover:text-white transition-colors">
              Go to Workspace
            </Link>
            <Link
              to="/business-os/register"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#C58A52] hover:bg-[#D4985F] text-black transition-colors"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* Main Pricing Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C1F24] border border-[#2B2F36] text-xs text-[#C58A52] font-medium mb-4">
            <Sparkles size={13} />
            <span>Scale Without Friction</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
            Predictable Plans for Ambitious Businesses
          </h1>
          <p className="text-xs sm:text-sm text-[#8E959E] leading-relaxed">
            Zero hidden charges. Switch plans anytime. Enjoy local Nigerian Naira billing or global USD currency options.
          </p>

          {/* Toggles */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
            {/* Currency toggle */}
            <div className="inline-flex rounded-lg bg-[#181B1F] p-1 border border-[#25282D]">
              <button
                onClick={() => setCurrency('NGN')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  currency === 'NGN' ? 'bg-[#C58A52] text-black shadow-sm' : 'text-[#8E959E] hover:text-white'
                }`}
              >
                NGN (₦)
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  currency === 'USD' ? 'bg-[#C58A52] text-black shadow-sm' : 'text-[#8E959E] hover:text-white'
                }`}
              >
                USD ($)
              </button>
            </div>

            {/* Monthly / Yearly cycle */}
            <div className="inline-flex rounded-lg bg-[#181B1F] p-1 border border-[#25282D]">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  billingCycle === 'monthly' ? 'bg-[#2B2F36] text-white' : 'text-[#8E959E] hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  billingCycle === 'yearly' ? 'bg-[#2B2F36] text-white' : 'text-[#8E959E] hover:text-white'
                }`}
              >
                <span>Yearly</span>
                <span className="text-[10px] text-[#C58A52] font-bold bg-[#C58A52]/15 px-1 rounded">Save 20%</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {plans.map(plan => {
            const price = currency === 'NGN' ? `₦${plan.priceNGN.toLocaleString()}` : `$${plan.priceUSD}`;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 flex flex-col justify-between transition-all ${
                  plan.popular
                    ? 'bg-[#181B1F] border-2 border-[#C58A52] shadow-2xl shadow-[#C58A52]/15 relative'
                    : 'bg-[#16181B] border border-[#25282D] hover:border-[#353A42]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#C58A52] text-black text-[10px] font-bold uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="text-base font-bold text-white mb-1">{plan.name}</div>
                  <p className="text-[11px] text-[#8E959E] min-h-[32px] mb-4">{plan.tagline}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-extrabold text-white font-mono">{price}</span>
                    <span className="text-xs text-[#8E959E]">/{billingCycle === 'yearly' ? 'mo (billed yrly)' : 'month'}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#1C1F24] border border-[#25282D] mb-6 space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#8E959E]">
                      <span>Customer Limit:</span>
                      <span className="font-semibold text-white">{plan.customers}</span>
                    </div>
                    <div className="flex justify-between text-[#8E959E]">
                      <span>Invoices / Mo:</span>
                      <span className="font-semibold text-white">{plan.invoices}</span>
                    </div>
                    <div className="flex justify-between text-[#8E959E]">
                      <span>Catalog Items:</span>
                      <span className="font-semibold text-white">{plan.catalog}</span>
                    </div>
                    <div className="flex justify-between text-[#8E959E]">
                      <span>Staff Seats:</span>
                      <span className="font-semibold text-white">{plan.staff}</span>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-white mb-3">Included Capabilities:</div>
                  <ul className="space-y-2 mb-8">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#A6ADB5]">
                        <Check size={14} className="text-[#C58A52] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => navigate(`/business-os/register?plan=${plan.id}`)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    plan.popular
                      ? 'bg-[#C58A52] hover:bg-[#D4985F] text-black shadow-lg shadow-[#C58A52]/20'
                      : 'bg-[#25282D] hover:bg-[#2F343B] text-white'
                  }`}
                >
                  <span>Select {plan.name}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
