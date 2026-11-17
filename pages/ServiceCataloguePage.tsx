import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Check, ChevronRight, Layout, 
  ShoppingCart, RefreshCw, Cpu, AppWindow, BarChart3, Layers
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { AGENCY_SERVICES, SERVICE_CATEGORIES, ServiceItem } from '../lib/servicesData';
import { SectionId } from '../types';

const iconMap: Record<string, React.ReactNode> = {
  Layout: <Layout className="w-5 h-5 text-[#C58A52]" />,
  ShoppingCart: <ShoppingCart className="w-5 h-5 text-[#C58A52]" />,
  RefreshCw: <RefreshCw className="w-5 h-5 text-[#C58A52]" />,
  Cpu: <Cpu className="w-5 h-5 text-[#C58A52]" />,
  AppWindow: <AppWindow className="w-5 h-5 text-[#C58A52]" />,
  BarChart3: <BarChart3 className="w-5 h-5 text-[#C58A52]" />,
  Layers: <Layers className="w-5 h-5 text-[#C58A52]" />
};

export const ServiceCataloguePage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All Services');
  const navigate = useNavigate();

  const filteredServices = selectedCategory === 'All Services'
    ? AGENCY_SERVICES
    : AGENCY_SERVICES.filter(s => s.category === selectedCategory);

  const handleRequestQuote = (service: ServiceItem) => {
    navigate(`/?service=${service.slug}#${SectionId.Audit}`);
  };

  const handleBookConsultation = (service: ServiceItem) => {
    navigate(`/?service=${service.slug}#${SectionId.Booking}`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      <Helmet>
        <title>Services & Solutions Catalogue | Avartah Solutions</title>
        <meta 
          name="description" 
          content="Explore Avartah Solutions' complete commercial service catalogue: custom web platforms, e-commerce storefronts, AI workflow automations, and bespoke enterprise software." 
        />
      </Helmet>

      <Navbar />

      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header Hero */}
        <div className="text-left max-w-3xl mb-12">
          <div className="text-xs font-semibold text-[#C58A52] uppercase tracking-wider mb-2">
            Commercial Offerings & Capabilities
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] leading-tight mb-4">
            Engineering Solutions & Capabilities Catalogue
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
            High-performance web architecture, e-commerce platforms, AI workflow automation, and custom business applications engineered for reliability, conversion, and international scalability.
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-10 no-scrollbar">
          {SERVICE_CATEGORIES.map((category, catIdx) => (
            <button
              key={`cat-filter-${category}-${catIdx}`}
              onClick={() => setSelectedCategory(category)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                selectedCategory === category
                  ? 'bg-slate-900 dark:bg-[#202428] text-white dark:text-[#F2F1ED] border-slate-900 dark:border-[#C58A52] font-semibold'
                  : 'bg-white dark:bg-[#171A1D] text-slate-600 dark:text-[#A3A9AF] border-slate-200 dark:border-[#30363B] hover:border-slate-400 dark:hover:border-[#747C84]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredServices.map((service, index) => {
              return (
                <motion.div
                  layout
                  key={service.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: index * 0.03 }}
                  className="flex flex-col justify-between bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg p-6 hover:border-slate-400 dark:hover:border-[#747C84] transition-colors group"
                >
                  <div>
                    {/* Header: Icon & Category */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-[#202428] border border-slate-200 dark:border-[#30363B] flex items-center justify-center">
                        {iconMap[service.iconName] || <Layout className="w-4 h-4 text-[#C58A52]" />}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-[#747C84]">
                        <span>{service.category}</span>
                        <span className="mx-1.5">·</span>
                        <span className="text-[#C58A52] font-medium">{service.badge}</span>
                      </div>
                    </div>

                    {/* Title & Summary */}
                    <h3 className="text-lg font-bold text-slate-900 dark:text-[#F2F1ED] mb-2 group-hover:text-[#C58A52] transition-colors">
                      {service.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-[#A3A9AF] leading-relaxed mb-5">
                      {service.summary}
                    </p>

                    {/* Problem Solved */}
                    <div className="p-3.5 rounded-md bg-slate-50 dark:bg-[#111315] border border-slate-100 dark:border-[#30363B]/60 mb-5 text-xs">
                      <div className="text-[11px] font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider mb-1">
                        Problem Addressed
                      </div>
                      <p className="text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                        {service.businessProblem}
                      </p>
                    </div>

                    {/* Key Deliverables */}
                    <div className="space-y-1.5 mb-6 text-xs text-slate-700 dark:text-[#A3A9AF]">
                      {service.keyDeliverables.slice(0, 3).map((item, dIdx) => (
                        <div key={dIdx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-[#C58A52] shrink-0 mt-0.5" />
                          <span className="line-clamp-2 text-[11px]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions & Pricing */}
                  <div className="pt-4 border-t border-slate-100 dark:border-[#30363B] space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-slate-500 dark:text-[#747C84]">{service.typicalTimeline}</span>
                      <span className="font-semibold text-slate-900 dark:text-[#F2F1ED]">{service.pricingEstimate}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleRequestQuote(service)}
                        className="py-2 px-3 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-lg transition-colors text-center shadow-sm"
                      >
                        Request Quote
                      </button>

                      <button
                        onClick={() => handleBookConsultation(service)}
                        className="py-2 px-3 bg-slate-100 dark:bg-[#202428] hover:bg-slate-200 dark:hover:bg-[#30363B] text-slate-800 dark:text-[#F2F1ED] font-semibold text-xs rounded-lg transition-colors border border-slate-200 dark:border-[#30363B] text-center"
                      >
                        Consultation
                      </button>
                    </div>

                    <Link
                      to={`/services/${service.slug}`}
                      className="flex items-center justify-center gap-1 py-1 text-xs text-slate-500 hover:text-slate-900 dark:text-[#747C84] dark:hover:text-[#F2F1ED] transition-colors"
                    >
                      <span>Complete Technical Specification</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ServiceCataloguePage;
