import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Services from '../components/Services';
import WhyAvartah from '../components/WhyAvartah';
import Process from '../components/Process';
import Portfolio from '../components/Portfolio';
import { BlogGrid } from '../components/BlogGrid';
import FAQ from '../components/FAQ';
import AuditForm from '../components/AuditForm';
import BookingCalendar from '../components/BookingCalendar';
import TechMarquee from '../components/TechMarquee';
import FinalCTA from '../components/FinalCTA';
import Footer from '../components/Footer';
import { SectionId } from '../types';
import { analytics } from '../lib/analytics';

const LandingPage: React.FC = () => {
  useEffect(() => {
    analytics.init();
    const handleExit = () => analytics.flush();
    window.addEventListener('pagehide', handleExit);

    return () => {
      window.removeEventListener('pagehide', handleExit);
    };
  }, []);

  const handleAuditComplete = () => {
    console.log('Audit logged into Neon pipeline.');
  };

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      <Navbar />

      <main>
        {/* 1. Hero Presentation */}
        <section id={SectionId.Hero}>
          <Hero onAuditComplete={handleAuditComplete} />
        </section>

        {/* 2. Services Section */}
        <section
          id={SectionId.Services}
          className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-[#30363B]"
        >
          <div className="max-w-7xl mx-auto">
            <Services />
          </div>
        </section>

        {/* Engineering Stack Strip */}
        <TechMarquee />

        {/* 3. Process Section */}
        <section
          id={SectionId.Process}
          className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-[#30363B] bg-slate-50/60 dark:bg-[#171A1D]/35"
        >
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              <div className="lg:col-span-3 space-y-3">
                <div className="text-xs font-semibold text-[#C58A52] tracking-[0.14em] uppercase">
                  Process
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED]">
                  How it works
                </h2>
                <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                  A structured four-stage delivery cycle designed for transparent progress from initial scoping to live operation.
                </p>
              </div>
              <div className="lg:col-span-9">
                <Process />
              </div>
            </div>
          </div>
        </section>

        {/* 4. Portfolio / Our Work */}
        <section
          id={SectionId.Work}
          className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-[#30363B]"
        >
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <div className="text-xs font-semibold text-[#C58A52] tracking-[0.14em] uppercase">
                  Selected Work
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED]">
                  Our work
                </h2>
                <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                  Web platforms, storefronts, and custom software built for real business workflows.
                </p>
              </div>

              <Link
                to="/services"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#C58A52]/60 text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] hover:bg-[#C58A52] hover:text-[#111315] transition-colors w-fit shrink-0"
              >
                <span>View Service Capabilities</span>
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>

            <Portfolio />
          </div>
        </section>

        {/* 5. Why Work With Avartah (Solutions & Value Proposition) */}
        <section
          id={SectionId.Solutions}
          className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-[#30363B] bg-slate-50/60 dark:bg-[#171A1D]/35"
        >
          <div className="max-w-7xl mx-auto">
            <WhyAvartah />
          </div>
        </section>

        {/* 6. Insights & Articles (#insights and #blog compatibility) */}
        <section
          id={SectionId.Insights}
          className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-[#30363B]"
        >
          <div id="blog" className="max-w-7xl mx-auto space-y-10 scroll-mt-24">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <div className="text-xs font-semibold text-[#C58A52] tracking-[0.14em] uppercase">
                  Insights & Articles
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED]">
                  Engineering & Growth Research
                </h2>
                <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                  Practical articles on platform architecture, conversion design, and business automation.
                </p>
              </div>

              <Link
                to="/blog"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C58A52] hover:underline w-fit shrink-0"
              >
                <span>Open Insights Hub</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <BlogGrid />
          </div>
        </section>

        {/* 7. FAQ Section */}
        <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-[#30363B] bg-slate-50/60 dark:bg-[#171A1D]/35">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-4 space-y-3">
              <div className="text-xs font-semibold text-[#C58A52] tracking-[0.14em] uppercase">
                Frequently Asked Questions
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED]">
                Common questions
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                Straightforward answers covering project scoping, timelines, code ownership, and support.
              </p>
            </div>

            <div className="lg:col-span-8">
              <FAQ />
            </div>
          </div>
        </section>

        {/* 8. Dedicated Website & Growth Audit Section (Separated from Hero & Booking) */}
        <section
          id={SectionId.Audit}
          className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-[#30363B]"
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-5 space-y-5">
              <div className="text-xs font-semibold text-[#C58A52] tracking-[0.14em] uppercase">
                Website & Growth Audit
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] leading-tight">
                Request a structured review of your site or system
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                Share your current URL or project goals to receive a practical diagnostic evaluation covering usability friction, conversion clarity, and technical readiness.
              </p>

              <ul className="pt-2 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF]">
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-[#C58A52] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Review of mobile layout, navigation flow, and page structure</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-[#C58A52] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Identification of lead capture and checkout drop-off points</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-[#C58A52] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Prioritized recommendations you can act on immediately</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-7">
              <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D]">
                <AuditForm onAuditComplete={handleAuditComplete} />
              </div>
            </div>
          </div>
        </section>

        {/* 9. Dedicated Strategy Consultation Booking Section */}
        <section
          id={SectionId.Booking}
          className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-[#30363B] bg-slate-50/60 dark:bg-[#171A1D]/35"
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div className="text-xs font-semibold text-[#C58A52] tracking-[0.14em] uppercase">
                Book a Consultation
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] leading-tight">
                Discuss your platform requirements, scope, and timeline
              </h2>

              <p className="text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed max-w-xl">
                Schedule a direct session to walk through your goals, review existing systems, and map out a clear delivery plan.
              </p>

              <ul className="pt-2 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF]">
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-[#C58A52] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>30-minute focused consultation tailored to your business</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-[#C58A52] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Direct review of your current site, workflow, or product brief</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-[#C58A52] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Clear scope breakdown and milestone estimates after the call</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <BookingCalendar />
            </div>
          </div>
        </section>

        {/* 10. Final CTA */}
        <FinalCTA onAuditComplete={handleAuditComplete} />
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
