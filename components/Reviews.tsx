import React from 'react';
import { Check } from 'lucide-react';

const engineeringStandards = [
  {
    category: 'Ownership',
    title: 'Complete Repository & Data Ownership',
    summary:
      'Every bespoke engagement delivers full source code ownership, documented schemas, and clean handoff without proprietary vendor lock-in.',
  },
  {
    category: 'Delivery',
    title: 'Milestone-Tracked Client Portal',
    summary:
      'Clients follow sprint progress, inspect staging builds, and approve deliverables directly inside a dedicated workspace.',
  },
  {
    category: 'Reliability',
    title: 'Type-Safe Full-Stack Engineering',
    summary:
      'Interfaces, API validation, and relational PostgreSQL storage are engineered together to prevent fragile patchwork integrations.',
  },
];

const Reviews: React.FC = () => {
  return (
    <div className="space-y-4">
      {engineeringStandards.map((item) => (
        <div
          key={item.title}
          className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] transition-colors"
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-mono font-semibold text-[#C58A52] uppercase tracking-wider">
              {item.category}
            </span>
            <Check size={14} className="text-[#C58A52]" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
            {item.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
            {item.summary}
          </p>
        </div>
      ))}
    </div>
  );
};

export default Reviews;
