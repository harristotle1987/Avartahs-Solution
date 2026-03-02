
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ShieldCheck, Clock } from 'lucide-react';
import AuditForm from './AuditForm';
import { analytics } from '../lib/analytics';
import { AuditReport } from '../lib/gemini';

interface FinalCTAProps {
  onAuditComplete?: (report: AuditReport, url: string) => void;
}

const FinalCTA: React.FC<FinalCTAProps> = ({ onAuditComplete }) => {
  return (
    <div 
      onMouseEnter={() => analytics.logCTAClick('footer')}
      className="relative py-24 md:py-48 px-6 overflow-hidden bg-[#020617] transition-colors duration-500"
    >
      {/* Techy Background elements */}
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-electric/50 to-transparent opacity-50" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
      
      {/* Floating Blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sunset/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-electric/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16 md:mb-24"
        >
          <div className="inline-flex items-center gap-3 px-5 py-2 bg-white/5 border border-white/10 rounded-full mb-8 shadow-sm">
             <div className="w-2 h-2 bg-sunset rounded-full animate-ping" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Node Dispatch Active</span>
          </div>
          
          <h2 className="text-5xl md:text-8xl lg:text-[8rem] font-[900] tracking-tighter uppercase text-white mb-8 leading-[0.8]">
            Final <br/>
            <span className="text-sunset italic">Deployment</span>
          </h2>
          
          <p className="text-slate-400 text-lg md:text-2xl font-medium mb-12 max-w-2xl mx-auto leading-tight tracking-tight">
            Deploy your revenue-engineered architecture in exactly 10 business days. Stop the conversion leak today.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="w-full max-w-5xl mx-auto mb-16"
        >
          <div className="relative">
            <AuditForm onAuditComplete={onAuditComplete} />
          </div>
        </motion.div>

        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40">
          <div className="flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-[0.2em]">
            <CheckCircle2 size={16} className="text-sunset" /> 100% Encrypted
          </div>
          <div className="flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-[0.2em]">
            <ShieldCheck size={16} className="text-sunset" /> Secure Protocol
          </div>
          <div className="flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-[0.2em]">
            <Clock size={16} className="text-sunset" /> Rapid Turnaround
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalCTA;
