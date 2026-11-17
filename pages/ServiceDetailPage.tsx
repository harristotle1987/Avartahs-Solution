import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, Check, Clock, Users, Shield, 
  ChevronRight, Calendar, ArrowRight, Layers
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { AGENCY_SERVICES } from '../lib/servicesData';
import { SectionId } from '../types';

export const ServiceDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const service = AGENCY_SERVICES.find(s => s.slug === slug);

  if (!service) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans">
        <Navbar />
        <main className="pt-32 pb-24 px-4 sm:px-6 max-w-3xl mx-auto text-center">
          <div className="p-8 rounded-lg bg-slate-50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B]">
            <h1 className="text-xl font-bold mb-2">Service Specification Not Found</h1>
            <p className="text-xs text-slate-500 dark:text-[#747C84] mb-6">
              The requested service specification does not exist in our active commercial catalogue.
            </p>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-lg transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to Services Catalogue</span>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handleRequestQuote = () => {
    navigate(`/?service=${service.slug}#${SectionId.Audit}`);
  };

  const handleBookConsultation = () => {
    navigate(`/?service=${service.slug}#${SectionId.Booking}`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      <Helmet>
        <title>{`${service.title} | Avartah Solutions`}</title>
        <meta name="description" content={service.summary} />
      </Helmet>

      <Navbar />

      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#747C84] mb-8 overflow-x-auto">
          <Link to="/" className="hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors">Home</Link>
          <ChevronRight size={12} />
          <Link to="/services" className="hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors">Services</Link>
          <ChevronRight size={12} />
          <span className="text-slate-900 dark:text-[#F2F1ED] font-medium">{service.title}</span>
        </nav>

        {/* Header Hero Box */}
        <div className="p-6 sm:p-8 rounded-lg bg-slate-50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] mb-10">
          <div className="text-xs text-slate-500 dark:text-[#747C84] mb-3">
            <span>{service.category}</span>
            <span className="mx-2">·</span>
            <span className="text-[#C58A52] font-medium">{service.badge}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] mb-4">
            {service.title}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-[#A3A9AF] leading-relaxed max-w-3xl mb-8">
            {service.summary}
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-200 dark:border-[#30363B] text-xs">
            <div className="flex items-center gap-3 p-3.5 rounded-md bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B]/60">
              <Clock className="w-4 h-4 text-[#C58A52] shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-[#747C84]">Typical Delivery Sprints</span>
                <span className="font-semibold text-slate-900 dark:text-[#F2F1ED] font-mono tabular-nums">{service.typicalTimeline}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-md bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B]/60">
              <Shield className="w-4 h-4 text-[#C58A52] shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-[#747C84]">Investment Scope</span>
                <span className="font-semibold text-slate-900 dark:text-[#F2F1ED] font-mono tabular-nums">{service.pricingEstimate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Problem Solved & Target Clients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <section className="p-6 rounded-lg bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B]">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider mb-3">
              Business Problem Addressed
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
              {service.businessProblem}
            </p>
          </section>

          <section className="p-6 rounded-lg bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B]">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider mb-3">
              Target Client Profiles
            </h2>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF]">
              {service.targetClients.map((client, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#C58A52] font-mono">0{i + 1}.</span>
                  <span>{client}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Deliverables & Technology Stack */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          <section className="lg:col-span-8 p-6 rounded-lg bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B]">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider mb-4">
              Detailed Scope & Deliverables
            </h2>
            <div className="space-y-3">
              {service.keyDeliverables.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-[#A3A9AF]">
                  <Check className="w-4 h-4 text-[#C58A52] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-4 p-6 rounded-lg bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider mb-4">
                Architecture & Tech Stack
              </h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {service.techStack.map((tech, techIdx) => (
                  <span 
                    key={`tech-${tech}-${techIdx}`} 
                    className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#202428] text-slate-800 dark:text-[#F2F1ED] font-mono text-[11px] border border-slate-200 dark:border-[#30363B]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-[#30363B]">
              <button
                onClick={handleRequestQuote}
                className="w-full py-2.5 px-4 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-lg transition-colors shadow-sm text-center"
              >
                Request Scope Proposal
              </button>
              <button
                onClick={handleBookConsultation}
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-[#202428] hover:bg-slate-200 dark:hover:bg-[#30363B] text-slate-800 dark:text-[#F2F1ED] font-semibold text-xs rounded-lg transition-colors border border-slate-200 dark:border-[#30363B] text-center"
              >
                Schedule Consultation
              </button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ServiceDetailPage;
