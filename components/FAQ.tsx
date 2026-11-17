import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    id: 'scope-investment',
    q: 'How are project scopes and investment tiers structured?',
    a: 'Projects are scoped around clear deliverables and milestone phases. Focused website optimizations start from $350, custom web platforms and storefronts are quoted by scope, and larger business applications are structured into transparent sprint stages.',
  },
  {
    id: 'consultation',
    q: 'What happens during the initial strategy consultation?',
    a: 'We review your current website or operational workflow, identify conversion or technical bottlenecks, and outline practical architecture options and realistic delivery timelines.',
  },
  {
    id: 'timelines',
    q: 'What is a typical project delivery timeline?',
    a: 'Focused websites and redesigns typically take 2 to 3 weeks, while custom multi-role web software and integrated business platforms range from 3 to 8 weeks depending on scope.',
  },
  {
    id: 'ownership',
    q: 'Will we own the source code and infrastructure?',
    a: 'Yes. Upon project completion, your organization receives full repository access, database schemas, and deployment configurations with no proprietary lock-in.',
  },
  {
    id: 'tech-stack',
    q: 'What technology stack does Avartah build with?',
    a: 'We build primarily with React, TypeScript, Tailwind CSS, Node.js/Express, and relational PostgreSQL databases, integrating vetted payment and communication providers where required.',
  },
  {
    id: 'maintenance',
    q: 'Do you provide ongoing maintenance after launch?',
    a: 'Yes. We offer ongoing support retainers covering dependency updates, security patches, uptime monitoring, and iterative feature improvements.',
  },
];

const FAQ: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>(faqs[0].id);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] divide-y divide-slate-200 dark:divide-[#30363B] overflow-hidden">
      {faqs.map((faq) => {
        const isOpen = openId === faq.id;
        const buttonId = `faq-trigger-${faq.id}`;
        const panelId = `faq-panel-${faq.id}`;

        return (
          <div key={faq.id}>
            <h3>
              <button
                id={buttonId}
                type="button"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full min-h-[52px] px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-[#202428]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C58A52]"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-[#F2F1ED]">
                  {faq.q}
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`text-[#C58A52] shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-4 pt-1 text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                    {faq.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export default FAQ;
