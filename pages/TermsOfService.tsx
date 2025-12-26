
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfService: React.FC = () => {
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
              <FileText size={32} />
            </div>
            <div>
              <h1 className="text-4xl md:text-6xl font-[900] tracking-tighter uppercase leading-none">Service Logic Terms</h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-2">Legal Protocol v2.1</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none space-y-12">
            <section>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4">1. Engagement Framework</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                The forensic growth audit provided by Avartah Solutions is a strategic assessment and does not constitute a guaranteed revenue outcome. All engineering rebuilds are performed under individual Statements of Work (SOW) which define specific technical deliverables and KPIs.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4">2. Intellectual Property Nodes</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                Upon final payment for any rebuild project, 100% of the developed logic layer and design assets are transferred to the client. Avartah Solutions retains the right to utilize generic architectural patterns and proprietary internal frameworks developed independently of specific client engagements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4">3. Performance Thresholds</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                While we target 100/100 Lighthouse scores and sub-second rendering, these metrics are subject to third-party scripts and external integrations (tracking pixels, chatbots, etc.) that the client may choose to implement post-launch.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4">4. Liability Limitation</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                Avartah Solutions is not liable for indirect, incidental, or consequential damages resulting from the implementation of our strategic audits or engineering builds. Our liability is limited to the fees paid for the specific engagement in question.
              </p>
            </section>
          </div>
        </motion.div>
      </main>
      
      <footer className="py-12 border-t border-slate-100 text-center">
        <p className="text-slate-300 font-black text-[9px] uppercase tracking-[0.4em]">© AVARTAH SOLUTIONS LEGAL OPERATIONS</p>
      </footer>
    </div>
  );
};

export default TermsOfService;
