
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    q: "How much does a landing page project cost?",
    a: "Our entry-tier technical performance rebuilds start at just $300 USD. This covers core speed optimization and critical UX logic fixes. For high-conversion custom architecture, full-funnel builds, and premium UI/UX, projects range between $1,000 and $10,000+. We tailor the scope to your specific revenue goals."
  },
  {
    q: "What exactly will I get on the strategy call?",
    a: "We perform a live forensic review of your current landing page. We identify 'revenue leaks', analyze user friction points, and provide a clear engineering roadmap to 2X or 3X your current conversion rate, regardless of your budget tier."
  },
  {
    q: "Do you guarantee results?",
    a: "While market conditions vary, our logic-driven methodology typically yields a 40-64% conversion lift within the first 30 days. Our 98% client retention rate is built on the fact that our $300 - $10,000 systems consistently out-perform standard agency builds."
  },
  {
    q: "How long does it take to build a landing page?",
    a: "We deliver launch-ready, high-performance builds in exactly 10 business days. Our automated internal framework allows us to maintain extreme speed without sacrificing the technical quality required for high-scale conversion."
  },
  {
    q: "Will I own the landing page after it's built?",
    a: "Yes. 100% intellectual property ownership is transferred to you upon completion. You own the code, the design assets, and the logic layers, whether we deploy to your infrastructure or ours."
  },
  {
    q: "What tech stack do you use?",
    a: "We utilize the modern 'Performance Stack': Next.js for sub-second rendering, Tailwind CSS for lightweight styling, and Supabase or PostgreSQL for secure, real-time data persistence. This ensures top-tier Lighthouse scores."
  },
  {
    q: "Do you offer ongoing optimization?",
    a: "Yes. Most of our partners who start with a $300 audit move into a monthly growth retainer. We provide continuous A/B testing, heatmap analysis, and iterative logic updates to maximize your ROI as you scale."
  },
  {
    q: "What industries do you work with?",
    a: "From B2B SaaS and high-ticket coaching to Fintech and E-commerce. If your business depends on a user taking a specific action on a website, our behavioral engineering will work for you."
  }
];

const FAQ: React.FC = () => {
  const [open, setOpen] = useState<string | null>(faqs[0].q);

  return (
    <div className="space-y-4">
      {faqs.map((faq) => (
        <div key={faq.q} className="border-b border-slate-100 dark:border-white/5 last:border-0">
          <button 
            onClick={() => setOpen(open === faq.q ? null : faq.q)}
            className="w-full py-6 flex items-center justify-between text-left group transition-all"
          >
            <span className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-gray-100 group-hover:text-sunset transition-colors">{faq.q}</span>
            <div className="p-2 rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-600 group-hover:text-sunset transition-all shrink-0 ml-6">
              {open === faq.q ? <Minus size={16} /> : <Plus size={16} />}
            </div>
          </button>
          <AnimatePresence>
            {open === faq.q && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="pb-8 text-slate-600 dark:text-gray-400 text-base leading-relaxed font-medium max-w-2xl">
                  {faq.a}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

export default FAQ;
