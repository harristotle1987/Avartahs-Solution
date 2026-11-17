import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

interface ProcessStage {
  id: string;
  number: string;
  title: string;
  summary: string;
  deliverables: string[];
}

const STAGES: ProcessStage[] = [
  {
    id: 'discover',
    number: '1',
    title: 'Discover',
    summary: 'Review conversion friction, workflows, and technical bottlenecks before scoping.',
    deliverables: [
      'Funnel & user-flow audit',
      'Core requirements & gap mapping',
      'Baseline speed & structure review',
    ],
  },
  {
    id: 'design',
    number: '2',
    title: 'Design',
    summary: 'Plan clear interfaces, data models, and structured customer journeys.',
    deliverables: [
      'Information architecture & wireframes',
      'Relational PostgreSQL schema design',
      'Responsive UI & conversion layout',
    ],
  },
  {
    id: 'build',
    number: '3',
    title: 'Build',
    summary: 'Develop type-safe web platforms, backend APIs, and tested integrations.',
    deliverables: [
      'React, TypeScript & Tailwind build',
      'Server-side validation & DB layer',
      'Security & accessibility implementation',
    ],
  },
  {
    id: 'improve',
    number: '4',
    title: 'Improve',
    summary: 'Verify real-world behaviour, deploy cleanly, and refine as usage grows.',
    deliverables: [
      'Cross-device & browser verification',
      'Conversion event instrumentation',
      'Full documentation & handover',
    ],
  },
];

const Process: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-12">
      {/* Desktop Horizontal Stepped Row */}
      <div className="hidden lg:grid lg:grid-cols-7 lg:items-start lg:gap-3">
        {STAGES.map((stage, idx) => (
          <React.Fragment key={stage.id}>
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: idx * 0.06 }}
              className="flex flex-col items-center text-center px-2"
            >
              <div className="w-11 h-11 rounded-full border border-[#C58A52]/70 bg-white dark:bg-[#171A1D] flex items-center justify-center font-mono text-sm font-bold text-[#C58A52] mb-4">
                {stage.number}
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
                {stage.title}
              </h3>

              <p className="text-xs text-slate-600 dark:text-[#A3A9AF] leading-relaxed mb-4">
                {stage.summary}
              </p>

              <ul className="w-full pt-3 border-t border-slate-200 dark:border-[#30363B] space-y-1.5 text-left">
                {stage.deliverables.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-[#A3A9AF]"
                  >
                    <Check size={12} className="text-[#C58A52] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {idx < STAGES.length - 1 && (
              <div
                aria-hidden="true"
                className="flex items-center justify-center pt-3.5 text-[#C58A52]/70"
              >
                <ArrowRight size={18} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile & Tablet Vertical Timeline (<1024px) */}
      <ol className="lg:hidden relative border-l border-slate-200 dark:border-[#30363B] ml-4 space-y-8">
        {STAGES.map((stage) => (
          <li key={`mobile-${stage.id}`} className="relative pl-8">
            <span className="absolute -left-[18px] top-0 w-9 h-9 rounded-full border border-[#C58A52] bg-white dark:bg-[#111315] flex items-center justify-center font-mono text-xs font-bold text-[#C58A52]">
              {stage.number}
            </span>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] space-y-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
                  {stage.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-[#A3A9AF] leading-relaxed mt-1">
                  {stage.summary}
                </p>
              </div>

              <ul className="pt-3 border-t border-slate-100 dark:border-[#30363B] space-y-1.5">
                {stage.deliverables.map((item) => (
                  <li
                    key={`m-${item}`}
                    className="flex items-start gap-2 text-xs text-slate-600 dark:text-[#A3A9AF]"
                  >
                    <Check size={13} className="text-[#C58A52] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default Process;
