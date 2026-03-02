
import React from 'react';
import { motion } from 'framer-motion';
import { FileText, TrendingUp, AlertCircle, CheckCircle, Zap, Layout, Terminal, X } from 'lucide-react';
import { AuditReport } from '../lib/gemini';

interface CorrectionDocumentProps {
  report: AuditReport;
  url: string;
  onClose: () => void;
}

const CorrectionDocument: React.FC<CorrectionDocumentProps> = ({ report, url, onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white text-slate-900 rounded-[3rem] shadow-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col relative"
    >
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors z-50 text-slate-400"
      >
        <X size={24} />
      </button>

      {/* Header */}
      <div className="bg-[#020617] p-8 md:p-12 text-white flex flex-col md:flex-row justify-between items-start md:items-end shrink-0 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl font-[900] tracking-tighter">AVARTAH SOLUTIONS</span>
            <div className="w-2 h-2 bg-sunset rounded-full" />
          </div>
          <h1 className="text-3xl md:text-5xl font-[900] uppercase tracking-tighter">Forensic Audit</h1>
        </div>
        <div className="text-left md:text-right">
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">AUDIT_TARGET</p>
          <p className="text-lg font-bold truncate max-w-[300px]">{url}</p>
          <p className="text-sunset font-mono text-[10px] mt-1 font-black">CORE_ENGINE: AVARTAH_FORENSIC_v4.2</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-16 custom-scrollbar">
        {/* 1. EXECUTIVE SUMMARY */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-[#0F172A]">
              <FileText size={20} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">1. Executive Summary</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Logic Score</p>
              <div className={`text-7xl font-black tracking-tighter mb-2 ${['A', 'A-'].includes(report.score) ? 'text-green-500' : 'text-red-500'}`}>
                {report.score}
              </div>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">{report.summary}</p>
            </div>
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Estimated Revenue Leak</p>
              <div className="text-5xl font-black text-[#0F172A] tracking-tighter mb-2">~{report.revenueLeak} Loss</div>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">Based on industry benchmarks for your current conversion bottlenecks.</p>
            </div>
          </div>
        </section>

        {/* 2. THE DATA */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-[#0F172A]">
              <AlertCircle size={20} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">2. Logic Layer Faults</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-6 p-6 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-electric/30 transition-all">
              <Zap className="text-sunset shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-1">Performance Bottleneck</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{report.bottleneck}</p>
              </div>
            </div>
            <div className="flex gap-6 p-6 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-electric/30 transition-all">
              <Layout className="text-electric shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-1">UX/UI Logic Failure</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{report.uxFailure}</p>
              </div>
            </div>
            <div className="flex gap-6 p-6 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-electric/30 transition-all">
              <Terminal className="text-slate-400 shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-1">Messaging Inconsistency</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{report.messagingFailure}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. THE FIX */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-green-500">
              <CheckCircle size={20} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">3. Strategic Remediation</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-green-50/50 rounded-2xl border border-green-100">
              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-4 block">IMMEDIATE</span>
              <p className="font-bold text-slate-800 text-sm">{report.immediateFix}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">SHORT TERM</span>
              <p className="font-bold text-slate-800 text-sm">{report.shortTermFix}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">LONG TERM</span>
              <p className="font-bold text-slate-800 text-sm">{report.longTermFix}</p>
            </div>
          </div>
        </section>

        {/* 4. REBUILD OFFER */}
        <section className="bg-slate-900 p-8 md:p-12 rounded-[2.5rem] text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-sunset rounded-xl flex items-center justify-center text-white">
              <TrendingUp size={20} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">4. Execution Plan</h2>
          </div>
          <p className="text-lg md:text-xl text-slate-400 font-medium mb-10 leading-relaxed">
            We can resolve <span className="text-white">100% of these faults</span> in our next 10-day sprint. Stop the bleed and engineer your growth node.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="flex-1 py-5 bg-white text-[#020617] rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-sunset hover:text-white transition-all shadow-xl">
              Initiate Scale Rebuild
            </button>
            <button className="flex-1 py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
              Schedule Debrief
            </button>
          </div>
        </section>
      </div>

      <div className="p-6 border-t border-slate-100 bg-white flex justify-center items-center shrink-0">
        <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-[9px]">
          AVARTAH SOLUTIONS // PROPRIETARY LOGIC AUDIT
        </p>
      </div>
    </motion.div>
  );
};

export default CorrectionDocument;
