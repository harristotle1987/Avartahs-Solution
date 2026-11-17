import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const TermsOfService: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      <Helmet>
        <title>Terms of Service | Avartah Solutions</title>
        <meta name="description" content="Avartah Solutions commercial engagement and service terms." />
      </Helmet>

      <Navbar />

      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-[#747C84] dark:hover:text-[#F2F1ED] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Return to Home</span>
          </Link>
        </div>

        <div className="p-8 sm:p-10 rounded-lg bg-slate-50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] mb-12">
          <div className="flex items-center gap-2.5 text-xs text-[#C58A52] font-semibold uppercase tracking-wider mb-3">
            <FileText size={16} />
            <span>Commercial Engagement Agreement</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] mb-3">
            Terms of Service & Engagement
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#747C84]">
            Effective Date: October 2026 · Version 2.2
          </p>
        </div>

        <div className="space-y-8 text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
              1. Engagement Framework & Statements of Work
            </h2>
            <p>
              All software engineering, digital transformation, and website redesign projects undertaken by Avartah Solutions are governed by agreed sprint scopes and technical Statements of Work (SOW). Each milestone outlines specific architectural deliverables, test requirements, and acceptance standards.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
              2. Intellectual Property & Code Ownership
            </h2>
            <p>
              Upon receipt of final milestone payments, complete intellectual property rights for custom frontend repositories, backend routes, database schema designs, and bespoke business algorithms transfer unconditionally to the client.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
              3. Performance & Delivery Benchmarks
            </h2>
            <p>
              We engineer web applications to meet Core Web Vitals standards, targeting fast load times and clean architectural patterns. Post-launch modifications made by third-party scripts or customer content changes are not covered by initial sprint guarantees unless retained under ongoing maintenance agreements.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
              4. Governing Law & Dispute Resolution
            </h2>
            <p>
              These terms are construed in accordance with the commercial laws of Nigeria and applicable international commercial standards. Any formal inquiries or disputes should be directed to our operations desk at <a href="mailto:harristotle84@gmail.com" className="text-[#C58A52] hover:underline">harristotle84@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService;
