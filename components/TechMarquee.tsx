import React from 'react';

const technologies = [
  'React',
  'TypeScript',
  'PostgreSQL',
  'Tailwind CSS',
  'Node.js & Express',
  'REST APIs',
  'AI Workflows',
  'Paystack & Stripe',
];

const TechMarquee: React.FC = () => {
  return (
    <div className="py-5 border-y border-slate-200 dark:border-[#30363B] bg-slate-50/70 dark:bg-[#171A1D]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6 text-xs text-slate-500 dark:text-[#747C84]">
          <span className="font-semibold text-slate-700 dark:text-[#A3A9AF] uppercase tracking-[0.14em] text-[11px]">
            Production Stack
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono">
            {technologies.map((tech, i) => (
              <React.Fragment key={tech}>
                <span className="text-slate-700 dark:text-[#A3A9AF]">{tech}</span>
                {i < technologies.length - 1 && (
                  <span className="text-slate-300 dark:text-[#30363B]" aria-hidden="true">
                    ·
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechMarquee;
