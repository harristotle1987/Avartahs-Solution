import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Globe, Layers, TrendingUp, Cpu } from 'lucide-react';
import { AGENCY_SERVICES, getServiceBySlug, ServiceItem } from '../lib/servicesData';
import { SectionId } from '../types';

interface PillarConfig {
  displayTitle: string;
  outcomeDescription: string;
  slug: string;
  icon: React.ReactNode;
}

const FEATURED_PILLARS: PillarConfig[] = [
  {
    displayTitle: 'Websites & Digital Experiences',
    outcomeDescription:
      'Responsive, fast-loading business websites and commercial storefronts structured to turn visitors into enquiries.',
    slug: 'website-design-development',
    icon: <Globe className="w-5 h-5 text-[#C58A52]" aria-hidden="true" />,
  },
  {
    displayTitle: 'Custom Business Platforms',
    outcomeDescription:
      'Tailored portals, internal dashboards, invoicing, and e-commerce platforms engineered around how your team actually works.',
    slug: 'business-software-applications',
    icon: <Layers className="w-5 h-5 text-[#C58A52]" aria-hidden="true" />,
  },
  {
    displayTitle: 'Customer Acquisition Systems',
    outcomeDescription:
      'Structured lead intake, website diagnostic audits, and CRM outreach pipelines built for consistent client acquisition.',
    slug: 'digital-business-solutions',
    icon: <TrendingUp className="w-5 h-5 text-[#C58A52]" aria-hidden="true" />,
  },
  {
    displayTitle: 'AI & Business Automation',
    outcomeDescription:
      'Practical workflow automation and AI-assisted drafting that reduces manual admin and speeds up customer response times.',
    slug: 'ai-integration-automation',
    icon: <Cpu className="w-5 h-5 text-[#C58A52]" aria-hidden="true" />,
  },
];

export const Services: React.FC = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const handleRequestQuote = (service: ServiceItem) => {
    const element = document.getElementById(SectionId.Audit);
    if (element) {
      element.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    } else {
      navigate(`/?service=${service.slug}#${SectionId.Audit}`);
    }
  };

  const handleBookConsultation = (service: ServiceItem) => {
    const element = document.getElementById(SectionId.Booking);
    if (element) {
      element.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    } else {
      navigate(`/?service=${service.slug}#${SectionId.Booking}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
      {/* Left Intro Column */}
      <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
        <div className="text-xs font-semibold text-[#C58A52] tracking-[0.14em] uppercase">
          Services
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] leading-tight">
          What we build
        </h2>
        <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
          Focused digital platforms and software systems designed to help businesses attract customers, streamline daily operations, and scale cleanly.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-[#C58A52]/60 text-slate-900 dark:text-[#F2F1ED] hover:bg-[#C58A52] hover:text-[#111315] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
          >
            <span>Explore Full Catalogue</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Right 2x2 Prioritized Pillars Grid */}
      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {FEATURED_PILLARS.map((pillar, index) => {
          const service = getServiceBySlug(pillar.slug) || AGENCY_SERVICES[index];
          if (!service) return null;

          return (
            <motion.article
              key={pillar.slug}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col justify-between p-6 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] hover:border-[#C58A52]/60 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-[#202428] border border-slate-200 dark:border-[#30363B] flex items-center justify-center">
                    {pillar.icon}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-[#747C84]">
                    {service.typicalTimeline}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-[#F2F1ED] mb-2">
                  {pillar.displayTitle}
                </h3>

                <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed mb-6">
                  {pillar.outcomeDescription}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-[#30363B] flex flex-wrap items-center justify-between gap-3 text-xs">
                <Link
                  to={`/services/${service.slug}`}
                  className="inline-flex items-center gap-1 font-semibold text-[#C58A52] hover:text-[#D99B62] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52] rounded"
                >
                  <span>Specification</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleRequestQuote(service)}
                    className="text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] font-medium transition-colors"
                  >
                    Request Audit
                  </button>
                  <span className="text-slate-300 dark:text-[#30363B]" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => handleBookConsultation(service)}
                    className="text-slate-900 dark:text-[#F2F1ED] hover:text-[#C58A52] font-semibold transition-colors"
                  >
                    Consult
                  </button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
};

export default Services;