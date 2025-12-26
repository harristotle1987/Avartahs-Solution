import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Calendar, Shield, ChevronRight, CheckCircle, Zap } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { saveLead } from '../lib/mockApi';
import { analytics } from '../lib/analytics';
import { generateAuditReport, AuditReport } from '../lib/gemini';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';
import CorrectionDocument from './CorrectionDocument';

const TypewriterLabel: React.FC<{ text: string }> = ({ text }) => {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.substring(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 15);
    return () => clearInterval(interval);
  }, [text]);
  return <span>{displayed}<span className="animate-pulse text-sunset">|</span></span>;
};

const AuditForm: React.FC = () => {
  const [sessionID] = useState(() => `AUD-${Math.floor(1000 + Math.random() * 8999)}`);
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const loadingMessages = ["Syncing...", "Analyzing Logic...", "Generating Audit...", "Finalizing..."];

  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length);
      }, 400);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  const [formData, setFormData] = useState({
    website: '', email: '', phone: '', budget: '', blocker: ''
  });

  const steps = [
    { id: 1, field: "website", prompt: "YOUR WEBSITE", directive: "Domain URL?", placeholder: "yourcompany.com", type: "url", valid: formData.website.length > 3 },
    { id: 2, field: "email", prompt: "YOUR EMAIL", directive: "Contact email?", placeholder: "name@company.com", type: "email", valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) },
    { id: 3, field: "phone", prompt: "PHONE NUMBER", directive: "Best contact?", placeholder: "+1 (555) 000-0000", type: "tel", valid: formData.phone.length > 7 },
    { id: 4, field: "budget", prompt: "PROJECT BUDGET", directive: "Investment tier?", type: "segmented", valid: formData.budget !== "" },
    { id: 5, field: "blocker", prompt: "MAIN CHALLENGE", directive: "Biggest hurdle?", placeholder: "e.g. Low sales...", type: "text", valid: formData.blocker.length > 5 },
  ];

  const current = steps[step - 1];

  const handleNextStep = () => {
    if (step < 5) {
      setStep(step + 1);
      analytics.updateFormProgress(step + 1);
    } else {
      setStep(6);
    }
  };

  const handleReset = () => {
    setStep(1);
    setIsSuccess(false);
    setReport(null);
    setShowFullReport(false);
    setFormData({ website: '', email: '', phone: '', budget: '', blocker: '' });
  };

  const sendEmailNotification = async (auditData?: AuditReport) => {
    const SERVICE_ID = process.env.EMAILJS_SERVICE_ID; 
    const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID; 
    const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY; 

    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return;

    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        title: "Forensic Audit Logged",
        name: formData.website, 
        time: new Date().toLocaleString(), 
        message: `AUDIT_LOG\nDomain: ${formData.website}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nBudget: ${formData.budget}\nProblem: ${formData.blocker}\nID: ${sessionID}\nAI_SCORE: ${auditData?.score || 'N/A'}` 
      }, PUBLIC_KEY);
    } catch (error) {
      console.error('Email Relay Error:', error);
    }
  };

  const handleSubmit = async (escalated = false) => {
    setIsProcessing(true);
    try {
      if (escalated) analytics.logHandshake('whatsapp');
      analytics.setSubmitted();

      // Trigger AI Audit Generation in Parallel
      const aiReport = await generateAuditReport(formData.website, formData.blocker);
      setReport(aiReport);

      await Promise.all([
        saveLead({
          session_id: sessionID,
          target_url: formData.website,
          user_email: formData.email,
          user_phone: formData.phone,
          revenue_tier: formData.budget,
          core_problem: formData.blocker,
          cta_source: 'website_audit_form'
        }),
        sendEmailNotification(aiReport)
      ]);
      
      if (escalated) {
        const message = `I just requested a website audit for ${formData.website}. Let's chat.`;
        window.open(`https://wa.me/2347039723596?text=${encodeURIComponent(message)}`, '_blank');
      }

      setIsProcessing(false);
      setIsSuccess(true);
    } catch (e) {
      console.error("Audit Engine Failure:", e);
      setIsProcessing(false);
      setIsSuccess(true);
    }
  };

  if (showFullReport && report) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-sm">
        <CorrectionDocument report={report} url={formData.website} onClose={() => setShowFullReport(false)} />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full lg:w-4/5 mx-auto bg-[#020617] rounded-[2rem] border-[4px] md:border-[10px] border-white p-6 md:p-10 flex flex-col gap-4 shadow-2xl text-center">
        <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-2">
          <CheckCircle size={28} />
        </div>
        <h3 className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter">SUBMISSION SECURED</h3>
        <p className="text-slate-400 font-medium text-xs md:text-base leading-tight">Your AI-generated forensic audit for <span className="text-white">{formData.website}</span> is ready.</p>
        
        <div className="flex flex-col gap-3 mt-4">
          <button onClick={() => setShowFullReport(true)} className="w-full py-4 bg-sunset text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg">
            VIEW FORENSIC REPORT
          </button>
          <ScrollLink to={SectionId.Booking} smooth={true} offset={-100} className="w-full py-4 bg-white text-midnight rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 cursor-pointer shadow-lg">
            <Calendar size={18} /> BOOK PRIORITY DEBRIEF
          </ScrollLink>
          <button onClick={handleReset} className="w-full py-3 text-slate-500 font-black uppercase text-[9px] tracking-widest">START NEW SESSION</button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full lg:w-4/5 mx-auto bg-[#020617] rounded-[1.5rem] md:rounded-[2.5rem] border-[3px] md:border-[10px] border-white overflow-hidden relative flex flex-col shadow-2xl my-4">
      <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
        <motion.div animate={{ width: `${(Math.min(step, 5) / 5) * 100}%` }} className="h-full bg-sunset shadow-[0_0_15px_rgba(249,115,22,0.6)]" />
      </div>

      <div className="flex items-center justify-between px-5 pt-5 md:pt-8 mb-2">
        <div className="bg-sunset px-2 py-0.5 rounded">
          <span className="text-white font-black text-[8px] tracking-[0.2em]">P_{step}</span>
        </div>
        <span className="text-slate-500 font-black text-[8px] tracking-widest uppercase">ID: {sessionID}</span>
      </div>

      <div className="flex-1 px-5 md:px-10 pb-6 flex flex-col justify-center min-h-[280px] md:min-h-[400px]">
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div key="processing" className="text-center space-y-4 py-8">
              <Loader2 size={40} className="text-sunset animate-spin mx-auto opacity-80" />
              <div className="text-white font-black uppercase tracking-[0.3em] text-[10px]">{loadingMessages[loadingMsgIdx]}</div>
            </motion.div>
          ) : step === 6 ? (
            <motion.div key="noted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <h2 className="text-2xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">REQUEST NOTED.<br/><span className="text-sunset">AUDIT ONGOING.</span></h2>
                <p className="text-slate-500 font-medium text-xs md:text-base max-w-xs mx-auto leading-relaxed">Engine active. Select dispatch preference to finalize the handshake.</p>
              </div>
              <button onClick={() => setStep(7)} className="w-full py-5 bg-white text-midnight rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-sunset hover:text-white transition-all">CONTINUE <ChevronRight size={18} /></button>
            </motion.div>
          ) : step === 7 ? (
            <motion.div key="choice" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h2 className="text-lg md:text-2xl font-black text-white uppercase tracking-tighter">DISPATCH PROTOCOL</h2>
              <div className="flex flex-col gap-3">
                <button onClick={() => handleSubmit(true)} className="w-full py-5 bg-sunset text-white rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2">WHATSAPP (INSTANT) <Zap size={14} /></button>
                <button onClick={() => handleSubmit(false)} className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-xl font-black text-[10px] uppercase">SEND TO EMAIL</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl md:text-4xl font-[900] text-white uppercase tracking-tighter leading-none"><TypewriterLabel text={current.prompt} /></h2>
                <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{current.directive}</p>
              </div>

              {current.type === 'segmented' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[{ val: "$300-$1.5k", label: "STARTER" }, { val: "$1.5k-$5k", label: "BUSINESS" }, { val: "$5k-$10k+", label: "ENTERPRISE" }].map((tier) => (
                    <button key={tier.val} onClick={() => setFormData({...formData, budget: tier.val})} className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${formData.budget === tier.val ? 'bg-white text-midnight border-white' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                      <span className="text-lg font-black tracking-tighter">{tier.val}</span>
                      <span className="text-[8px] font-black uppercase opacity-60">{tier.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <input ref={inputRef} type={current.type} name={current.field} value={formData[current.field as keyof typeof formData]} onChange={e => setFormData({...formData, [e.target.name]: e.target.value})} placeholder={current.placeholder} autoFocus onKeyDown={e => e.key === 'Enter' && current.valid && handleNextStep()} className="w-full bg-transparent border-b-2 border-white/10 focus:border-sunset text-white font-black text-xl md:text-4xl py-2 outline-none transition-all placeholder:text-white/5 tracking-tighter" />
              )}

              <button onClick={handleNextStep} disabled={!current.valid} className={`w-full py-4 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-3 transition-all tracking-[0.2em] ${current.valid ? 'bg-white text-midnight' : 'bg-white/5 text-slate-800 cursor-not-allowed'}`}>NEXT STEP <ChevronRight size={18} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-black/40 border-t border-white/5 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={10} className="text-slate-600" />
          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">TLS_SECURED</span>
        </div>
      </div>
    </div>
  );
};

export default AuditForm;