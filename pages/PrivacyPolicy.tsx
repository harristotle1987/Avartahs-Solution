
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0F172A] selection:bg-electric/10 selection:text-electric font-sans">
      <nav className="fixed top-0 left-0 w-full z-50 py-6 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 md:px-12">
        <div className="max-w-[1450px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <span className="text-2xl font-[900] tracking-[-0.08em] text-[#0F172A]">AVARTAH</span>
            <div className="w-2.5 h-2.5 bg-sunset rounded-full" />
          </div>
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-sunset transition-colors"
          >
            <ArrowLeft size={14} /> Back to Protocol
          </button>
        </div>
      </nav>

      <main className="pt-40 pb-24 px-6 md:px-12 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4 mb-12">
            <div className="p-4 bg-slate-50 text-[#0F172A] rounded-2xl border border-slate-100 shadow-sm">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h1 className="text-4xl md:text-6xl font-[900] tracking-tighter uppercase leading-none">Privacy Protocol</h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-2">Security Standard v4.0</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none space-y-12">
            <section>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4">1. Data Ingestion Architecture</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                Avartah Solutions operates on a privacy-first data ingestion model. When you submit an audit request, we collect specific parameters including your name, work email, business domain, and estimated budget. This data is utilized solely for the generation of forensic growth audits and technical roadmap synthesis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4">2. Forensic Security Measures</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                All telemetry data is encrypted at rest using AES-256 standards and in transit via TLS 1.3. We utilize high-fidelity cloud infrastructure to ensure that your business strategy remains isolated within our internal logic layers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4">3. Third-Party Node Integration</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                We do not sell, trade, or transfer your identifying metadata to outside parties. This excludes trusted third parties who assist us in operating our website and conducting our business, provided they adhere to strict non-disclosure protocols.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4">4. Strategic Consent</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                By utilizing the Avartah platform, you consent to our data collection protocols. We reserve the right to update this policy as new security technologies emerge. Major updates will be broadcast to the contact email provided in your last audit submission.
              </p>
            </section>
          </div>
        </motion.div>
      </main>
      
      <footer className="py-12 border-t border-slate-100 text-center">
        <p className="text-slate-300 font-black text-[9px] uppercase tracking-[0.4em]">© AVARTAH SOLUTIONS SECURITY DIVISION</p>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
