import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Handshake } from 'lucide-react';
import { analytics } from '../lib/analytics';
import { SectionId } from '../types';

interface FinalCTAProps {
  onAuditComplete?: (report: any, url: string) => void;
}

const FinalCTA: React.FC<FinalCTAProps> = () => {
  const shouldReduceMotion = useReducedMotion();

  const handleBookScroll = () => {
    const el = document.getElementById(SectionId.Booking);
    if (el) {
      el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <section
      onMouseEnter={() => analytics.logCTAClick('footer')}
      className="py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#111315] border-t border-slate-200 dark:border-[#30363B]"
    >
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="p-7 sm:p-10 rounded-xl border border-slate-200 dark:border-[#30363B] bg-slate-50 dark:bg-[#171A1D] flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        >
          <div className="flex items-start sm:items-center gap-4 sm:gap-5 max-w-2xl">
            <div className="w-12 h-12 rounded-xl border border-[#C58A52]/40 bg-[#C58A52]/10 flex items-center justify-center shrink-0">
              <Handshake size={22} className="text-[#C58A52]" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED]">
                Ready to move your business forward?
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                Let us discuss the web platform, business software, or customer acquisition system your team needs next.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleBookScroll}
              className="min-h-[44px] px-5 py-2.5 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-md transition-colors inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
            >
              <span>Book a Consultation</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>

            <Link
              to="/services"
              className="min-h-[44px] px-5 py-2.5 border border-slate-200 dark:border-[#30363B] hover:border-[#C58A52]/60 text-slate-800 dark:text-[#F2F1ED] font-semibold text-xs rounded-md transition-colors inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
            >
              Explore Our Services
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
