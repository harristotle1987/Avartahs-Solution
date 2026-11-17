import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { SectionId } from '../types';

const VALUE_PILLARS = [
  {
    number: '01',
    title: 'Professional digital experiences',
    description:
      'Clean responsive interfaces designed for credibility, fast mobile browsing, and clear user pathways without visual clutter.',
  },
  {
    number: '02',
    title: 'Systems tailored to business operations',
    description:
      'Custom workflows, portals, and commercial tools shaped around how your team delivers work rather than rigid templates.',
  },
  {
    number: '03',
    title: 'Better customer acquisition',
    description:
      'Structured consultation scheduling, website diagnostic intake, and organized CRM tracking that reduce lost inbound enquiries.',
  },
  {
    number: '04',
    title: 'Automation and operational efficiency',
    description:
      'Automated notifications, client updates, and AI-assisted communication drafting that remove repetitive manual tasks.',
  },
  {
    number: '05',
    title: 'Scalable software architecture',
    description:
      'Type-safe React, Node.js, and relational PostgreSQL foundations engineered so new features can grow cleanly over time.',
  },
];

const WhyAvartah: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
      {/* Left Intro */}
      <div className="lg:col-span-5 space-y-5">
        <div className="text-xs font-semibold text-[#C58A52] tracking-[0.14em] uppercase">
          Why Avartah
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] leading-tight">
          Built around real business outcomes, not surface templates
        </h2>
        <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
          Every engagement combines interface design, full-stack engineering, and practical operational tooling so your digital presence works cohesively across sales and delivery.
        </p>

        {/* Flagship Business Software Highlight */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] space-y-3">
          <div className="text-xs font-semibold text-[#C58A52] uppercase tracking-wider">
            Avartah Business OS
          </div>
          <p className="text-xs text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
            Need ready-to-use operations software? Explore our multi-tenant business management suite for customer records, service catalogues, quotations, and invoicing.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
            <Link
              to="/business-os"
              className="inline-flex items-center gap-1.5 font-semibold text-[#C58A52] hover:text-[#D99B62] transition-colors"
            >
              <span>Explore Business OS</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
            <a
              href={`#${SectionId.Booking}`}
              className="font-medium text-slate-700 dark:text-[#F2F1ED] hover:text-[#C58A52] transition-colors"
            >
              Discuss Custom Scope
            </a>
          </div>
        </div>
      </div>

      {/* Right Value Proposition List */}
      <div className="lg:col-span-7 divide-y divide-slate-200 dark:divide-[#30363B] border-y border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] rounded-xl overflow-hidden border-x">
        {VALUE_PILLARS.map((item) => (
          <div
            key={item.number}
            className="p-5 sm:p-6 flex items-start gap-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-[#202428]/50"
          >
            <span className="font-mono text-xs font-semibold text-[#C58A52] tabular-nums pt-0.5 shrink-0">
              {item.number}
            </span>
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
                {item.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                {item.description}
              </p>
            </div>
            <Check size={16} className="text-[#C58A52] shrink-0 mt-1 hidden sm:block" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhyAvartah;
