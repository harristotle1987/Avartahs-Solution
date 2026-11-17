import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const PrivacyPolicy: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      <Helmet>
        <title>Privacy Policy | Avartah Solutions</title>
        <meta name="description" content="Avartah Solutions privacy policy and data governance practices." />
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
            <Shield size={16} />
            <span>Data Protection & Privacy Policy</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] mb-3">
            Privacy Policy & Data Governance
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#747C84]">
            Effective Date: October 2026 · Version 2.4
          </p>
        </div>

        <div className="space-y-8 text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
              1. Information Collection & Ingestion
            </h2>
            <p>
              When you submit a growth audit request or book a strategy consultation, we collect standard commercial contact parameters including your full name, work email address, telephone contact, and website domain. This information is utilized exclusively to generate forensic architecture reviews, prepare sprint quotations, and coordinate direct client communications.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
              2. Data Storage & Relational Persistence
            </h2>
            <p>
              All customer relationship management (CRM) records, booking logs, and project deliverables are persisted strictly within our Neon PostgreSQL serverless database. All data is encrypted at rest using AES-256 standards and encrypted in transit via Transport Layer Security (TLS 1.3).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
              3. Non-Disclosure & Third-Party Disclosure
            </h2>
            <p>
              Avartah Solutions does not sell, rent, or monetize your identifying data to advertising networks or external data brokers. Client records are accessible strictly by authorized engineering and administrative personnel bound by confidentiality agreements.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
              4. Data Subject Rights & Inquiries
            </h2>
            <p>
              You maintain the legal right to request inspection, rectification, or complete deletion of your submitted contact records and consultation history at any time. Inquiries should be directed to our operations desk at <a href="mailto:harristotle84@gmail.com" className="text-[#C58A52] hover:underline">harristotle84@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
