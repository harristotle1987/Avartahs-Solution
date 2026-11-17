import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Layers, Compass, Sparkles } from 'lucide-react';
import { SectionId } from '../types';
import { analytics } from '../lib/analytics';
import { AuditReport } from '../lib/gemini';

interface HeroProps {
  onAuditComplete?: (report: AuditReport, url: string) => void;
}

type ShowcaseView = 'platforms' | 'operations' | 'acquisition';

const SHOWCASE_MODES: Record<
  ShowcaseView,
  {
    label: string;
    heading: string;
    summary: string;
    pillars: { title: string; subtitle: string; icon: React.ReactNode }[];
    highlights: { label: string; detail: string }[];
  }
> = {
  platforms: {
    label: 'Web Platforms',
    heading: 'Websites & Digital Platforms',
    summary: 'Responsive storefronts, editorial sites, and web apps built for clarity, speed, and conversion.',
    pillars: [
      {
        title: 'Web Platforms',
        subtitle: 'Conversion-ready storefronts & web apps',
        icon: <Globe size={15} className="text-[#C58A52]" />,
      },
      {
        title: 'Custom Software',
        subtitle: 'Tailored internal tools & client portals',
        icon: <Layers size={15} className="text-[#C58A52]" />,
      },
      {
        title: 'Acquisition Systems',
        subtitle: 'Lead intake, audit & CRM workflows',
        icon: <Compass size={15} className="text-[#C58A52]" />,
      },
    ],
    highlights: [
      { label: 'Interface Layer', detail: 'Mobile-first responsive architecture' },
      { label: 'Conversion Flow', detail: 'Structured consultation & audit capture' },
    ],
  },
  operations: {
    label: 'Business OS',
    heading: 'Custom Business Operations',
    summary: 'Centralized quoting, invoicing, client records, and delivery portals built around your workflows.',
    pillars: [
      {
        title: 'Client Portals',
        subtitle: 'Milestones, approvals & file handovers',
        icon: <Layers size={15} className="text-[#C58A52]" />,
      },
      {
        title: 'Billing & Quotes',
        subtitle: 'Automated invoices & payment verification',
        icon: <Globe size={15} className="text-[#C58A52]" />,
      },
      {
        title: 'Team Governance',
        subtitle: 'Role-based permissions & audit logs',
        icon: <Compass size={15} className="text-[#C58A52]" />,
      },
    ],
    highlights: [
      { label: 'Data Persistence', detail: 'Relational schemas with clean audit trails' },
      { label: 'Workspace Control', detail: 'Unified staff, client & service operations' },
    ],
  },
  acquisition: {
    label: 'Acquisition',
    heading: 'Customer Acquisition & AI',
    summary: 'Structured discovery workflows, automated qualification, and CRM outreach built without guesswork.',
    pillars: [
      {
        title: 'Site Audits',
        subtitle: 'Actionable friction & funnel reviews',
        icon: <Sparkles size={15} className="text-[#C58A52]" />,
      },
      {
        title: 'Prospect Pipeline',
        subtitle: 'Verified public contact enrichment',
        icon: <Compass size={15} className="text-[#C58A52]" />,
      },
      {
        title: 'CRM Dispatch',
        subtitle: 'Tracked email & WhatsApp follow-ups',
        icon: <Layers size={15} className="text-[#C58A52]" />,
      },
    ],
    highlights: [
      { label: 'Enquiry Routing', detail: 'Direct synchronization from web to CRM' },
      { label: 'AI Drafting', detail: 'Human-reviewed outreach preparation' },
    ],
  },
};

const DISCIPLINES = ['STRATEGY', 'DESIGN', 'ENGINEERING', 'GROWTH'];

const Hero: React.FC<HeroProps> = () => {
  const [activeView, setActiveView] = useState<ShowcaseView>('platforms');
  const shouldReduceMotion = useReducedMotion();
  const mode = SHOWCASE_MODES[activeView];

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <section
      onMouseEnter={() => analytics.logCTAClick('hero')}
      className="relative bg-slate-50 dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] pt-28 sm:pt-32 lg:pt-36 pb-10 border-b border-slate-200 dark:border-[#30363B] overflow-hidden"
    >
      {/* Subtle warm bronze radial ambient lighting on desktop right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-12 right-[-8%] w-[520px] h-[420px] rounded-full bg-[#C58A52]/10 dark:bg-[#C58A52]/14 blur-[120px]"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center pb-14 lg:pb-16">
          {/* Left Column: Primary Copy & Actions */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 text-left"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] leading-[1.06] mb-6 [text-wrap:balance]">
              Build the systems that{' '}
              <span className="text-[#C58A52]">move your business forward.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-[#A3A9AF] leading-relaxed mb-8 max-w-xl">
              Custom web platforms, business software and customer acquisition systems designed for real growth.
            </p>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <button
                type="button"
                onClick={() => handleScrollTo(SectionId.Booking)}
                className="min-h-[46px] px-6 py-3 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-sm rounded-md transition-colors inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111315]"
              >
                <span>Book a Consultation</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleScrollTo(SectionId.Work)}
                className="min-h-[46px] px-2 py-2 text-sm font-semibold text-slate-800 dark:text-[#F2F1ED] hover:text-[#C58A52] dark:hover:text-[#C58A52] border-b border-slate-400 dark:border-[#747C84] hover:border-[#C58A52] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52] rounded-sm"
              >
                Explore Our Work
              </button>
            </div>
          </motion.div>

          {/* Right Column: Obsidian & Bronze Product System Visual */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 w-full"
          >
            <div className="rounded-xl bg-[#111315] border border-[#30363B] shadow-2xl overflow-hidden text-[#F2F1ED]">
              {/* Workstation Frame Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#30363B] bg-[#171A1D]">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#111315] border border-[#30363B] flex items-center justify-center text-[#C58A52] font-bold text-[10px]">
                    A
                  </div>
                  <span className="text-[11px] font-semibold tracking-[0.14em] text-[#F2F1ED] uppercase">
                    AVARTAH PLATFORM
                  </span>
                </div>

                {/* Interactive Workspace Mode Switcher */}
                <div className="flex items-center gap-1 bg-[#111315] p-1 rounded-md border border-[#30363B]" role="tablist" aria-label="Platform capabilities preview">
                  {(Object.keys(SHOWCASE_MODES) as ShowcaseView[]).map((key) => {
                    const isSelected = activeView === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => setActiveView(key)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                          isSelected
                            ? 'bg-[#202428] text-[#C58A52]'
                            : 'text-[#A3A9AF] hover:text-[#F2F1ED]'
                        }`}
                      >
                        {SHOWCASE_MODES[key].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Workspace Body */}
              <div className="p-5 sm:p-6 bg-gradient-to-br from-[#171A1D] via-[#14171A] to-[#111315] space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
                  {/* Left Sub-panel: System Architecture & Trajectory Curve */}
                  <div className="sm:col-span-8 rounded-lg border border-[#30363B] bg-[#111315]/90 p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[#C58A52] mb-1">
                        System Architecture
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-[#F2F1ED]">
                        {mode.heading}
                      </h2>
                      <p className="text-xs text-[#A3A9AF] mt-1.5 leading-relaxed">
                        {mode.summary}
                      </p>
                    </div>

                    {/* Restrained Architectural Vector Progression Line */}
                    <div className="mt-5 pt-3 border-t border-[#30363B]/70">
                      <svg
                        viewBox="0 0 320 74"
                        className="w-full h-16 overflow-visible"
                        role="img"
                        aria-label="Illustration of structured digital platform growth progression"
                      >
                        <defs>
                          <linearGradient id="avartah-bronze-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C58A52" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#C58A52" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="62" x2="320" y2="62" stroke="#30363B" strokeWidth="1" />
                        <line x1="0" y1="36" x2="320" y2="36" stroke="#30363B" strokeWidth="0.75" strokeDasharray="3 4" />
                        <path
                          d="M 4 58 C 68 54, 118 46, 172 34 C 224 22, 268 15, 316 8 L 316 62 L 4 62 Z"
                          fill="url(#avartah-bronze-area)"
                        />
                        <path
                          d="M 4 58 C 68 54, 118 46, 172 34 C 224 22, 268 15, 316 8"
                          fill="none"
                          stroke="#C58A52"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle cx="316" cy="8" r="3.5" fill="#D99B62" />
                      </svg>
                    </div>
                  </div>

                  {/* Right Sub-panel: Core Technical Focus */}
                  <div className="sm:col-span-4 rounded-lg border border-[#30363B] bg-[#111315]/90 p-4 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      {mode.highlights.map((item) => (
                        <div key={item.label} className="pb-3 border-b border-[#30363B]/70 last:border-b-0 last:pb-0">
                          <div className="text-[11px] font-mono text-[#C58A52] uppercase tracking-wider">
                            {item.label}
                          </div>
                          <div className="text-xs text-[#F2F1ED] mt-1 leading-snug">
                            {item.detail}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Link
                      to="/business-os"
                      className="inline-flex items-center justify-between text-[11px] font-semibold text-[#C58A52] hover:text-[#D99B62] pt-2 border-t border-[#30363B] transition-colors"
                    >
                      <span>View Business OS</span>
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {/* Bottom Module Strip inside Preview Frame */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {mode.pillars.map((pillar) => (
                    <div
                      key={pillar.title}
                      className="rounded-lg border border-[#30363B] bg-[#111315]/75 p-3.5 flex items-start gap-2.5"
                    >
                      <div className="w-7 h-7 rounded bg-[#171A1D] border border-[#30363B] flex items-center justify-center shrink-0 mt-0.5">
                        {pillar.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#F2F1ED] truncate">
                          {pillar.title}
                        </div>
                        <div className="text-[11px] text-[#A3A9AF] leading-snug mt-0.5">
                          {pillar.subtitle}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Hairline Discipline Strip */}
        <div className="pt-2 flex items-center gap-4">
          <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-[#30363B] to-[#C58A52]/60" />
          <div className="w-full sm:w-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold tracking-[0.26em] text-slate-500 dark:text-[#A3A9AF] uppercase">
            {DISCIPLINES.map((item, idx) => (
              <React.Fragment key={item}>
                <span>{item}</span>
                {idx < DISCIPLINES.length - 1 && (
                  <span className="text-[#C58A52]" aria-hidden="true">
                    ·
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="hidden sm:block flex-1 h-px bg-gradient-to-l from-transparent via-slate-300 dark:via-[#30363B] to-[#C58A52]/60" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
