import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RotateCcw, Info, Calendar, Shield, Activity, ChevronRight, X, CheckCircle, Clock, Zap } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { saveLead } from '../lib/mockApi';
import { analytics } from '../lib/analytics';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';

const TypewriterLabel: React.FC<{ text: string }> = ({ text }) => {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.substring(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [text]);
  return <span>{displayed}<span className="animate-pulse text-sunset">|</span></span>;
};

const AuditForm: React.FC = () => {
  const [sessionID] = useState(() => `AUD-${Math.floor(1000 + Math.random() * 8999)}`);
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const loadingMessages = [
    "Registering Node...",
    "Syncing Supabase...",
    "EmailJS Dispatch...",
    "Finalizing Protocol..."
  ];

  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length);
      }, 400); // Faster log cadence
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  const [formData, setFormData] = useState({
    website: '',
    email: '',
    phone: '',
    budget: '',
    blocker: ''
  });

  const steps = [
    { id: 1, field: "website", prompt: "YOUR WEBSITE", directive: "Website address?", placeholder: "yourcompany.com", type: "url", valid: formData.website.length > 3 },
    { id: 2, field: "email", prompt: "YOUR EMAIL", directive: "Where to send results?", placeholder: "name@company.com", type: "email", valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) },
    { id: 3, field: "phone", prompt: "PHONE NUMBER", directive: "Best contact number?", placeholder: "+1 (555) 000-0000", type: "tel", valid: formData.phone.length > 7 },
    { id: 4, field: "budget", prompt: "PROJECT BUDGET", directive: "Select investment tier.", type: "segmented", valid: formData.budget !== "" },
    { id: 5, field: "blocker", prompt: "MAIN CHALLENGE", directive: "Biggest bottleneck?", placeholder: "e.g. Low conversion...", type: "text", valid: formData.blocker.length > 5 },
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
    setFormData({ website: '', email: '', phone: '', budget: '', blocker: '' });
  };

  const sendEmailNotification = async () => {
    const SERVICE_ID = 'service_p8nzc1e'; 
    const TEMPLATE_ID = 'template_0z3an7z'; 
    const PUBLIC_KEY = 'DWkUt3MKWHqHToy7Q'; 

    try {
      return await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        title: "New Forensic Audit Request",
        name: formData.website, 
        time: new Date().toLocaleString(), 
        message: `AUDIT LOGGED\n\nDomain: ${formData.website}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nBudget: ${formData.budget}\nProblem: ${formData.blocker}\nSession: ${sessionID}` 
      }, PUBLIC_KEY);
    } catch (error) {
      console.error('EmailJS Sync Failed:', error);
    }
  };

  const handleSubmit = async (escalated = false) => {
    setIsProcessing(true);
    try {
      if (escalated) analytics.logHandshake('whatsapp');
      analytics.setSubmitted();

      // Parallel Execution: No artificial delays added
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
        sendEmailNotification()
      ]);
      
      if (escalated) {
        const message = `I just requested a website audit for ${formData.website}. Let's discuss.`;
        window.open(`https://wa.me/2347039723596?text=${encodeURIComponent(message)}`, '_blank');
      }

      // Immediate transition after API resolution
      setIsProcessing(false);
      setIsSuccess(true);
    } catch (e) {
      setIsProcessing(false);
      setIsSuccess(true); // Fail gracefully to success screen
    }
  };

  if (isSuccess) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full lg:w-4/5 mx-auto bg-[#020617] rounded-[2rem] border-[4px] md:border-[10px] border-white p-6 md:p-10 flex flex-col gap-6 shadow-2xl text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-xl mx-auto mb-2">
          <CheckCircle size={32} />
        </div>
        <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none">SUBMISSION SECURED</h3>
        <p className="text-slate-400 font-medium text-sm md:text-lg leading-tight">
          Audit for <span className="text-white">{formData.website}</span> is locked. Expect a debrief shortly.
        </p>
        <div className="flex flex-col gap-3 mt-4">
          <ScrollLink to={SectionId.Booking} smooth={true} offset={-100} className="w-full py-5 bg-sunset text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 cursor-pointer shadow-lg">
            <Calendar size={18} /> BOOK PRIORITY DEBRIEF
          </ScrollLink>
          <button onClick={handleReset} className="w-full py-4 bg-transparent border border-white/10 text-slate-500 rounded-xl font-black uppercase text-[9px] tracking-widest">
            RESTART SESSION
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full lg:w-4/5 mx-auto bg-[#020617] rounded-[2rem] border-[4px] md:border-[10px] border-white overflow-hidden relative flex flex-col shadow-2xl my-4">
      <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
        <motion.div animate={{ width: `${(Math.min(step, 5) / 5) * 100}%` }} className="h-full bg-sunset shadow-[0_0_15px_rgba(249,115,22,0.6)]" />
      </div>

      <div className="flex items-center justify-between px-6 pt-6 md:pt-8 mb-2">
        <div className="bg-sunset border border-sunset/20 px-2 py-1 rounded">
          <span className="text-white font-black text-[8px] tracking-[0.2em] uppercase">STEP_0{step}</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-slate-500 font-black text-[8px] tracking-widest uppercase">NODE: {sessionID}</span>
        </div>
      </div>

      <div className="flex-1 px-5 md:px-10 pb-8 flex flex-col justify-center min-h-[320px] md:min-h-[400px]">
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div key="processing" className="text-center space-y-4 py-8">
              <Loader2 size={44} className="text-sunset animate-spin mx-auto opacity-80" />
              <div className="text-white font-black uppercase tracking-[0.3em] text-[10px]">
                {loadingMessages[loadingMsgIdx]}
              </div>
            </motion.div>
          ) : step === 6 ? (
            <motion.div key="noted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-sunset/10 border border-sunset/20 rounded-full">
                  <Clock size={14} className="text-sunset animate-pulse" />
                  <span className="text-[9px] font-black text-sunset uppercase tracking-widest">Logic Registered</span>
                </div>
                <h2 className="text-2xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">
                  REQUEST NOTED.<br/><span className="text-sunset">AUDIT ONGOING.</span>
                </h2>
                <p className="text-slate-500 font-medium text-xs md:text-base max-w-xs mx-auto leading-relaxed">
                  Engine active. Select dispatch preference to finalize the handshake.
                </p>
              </div>
              <button onClick={() => setStep(7)} className="w-full py-5 bg-white text-midnight rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-sunset hover:text-white transition-all">
                CONTINUE TO DISPATCH <ChevronRight size={18} />
              </button>
            </motion.div>
          ) : step === 7 ? (
            <motion.div key="choice" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
               <div className="flex gap-3">
                <div className="w-1 h-8 bg-sunset shrink-0 mt-1" />
                <h2 className="text-lg md:text-2xl font-black text-white uppercase tracking-tighter">DISPATCH PROTOCOL</h2>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => handleSubmit(true)} className="w-full py-5 bg-sunset text-white rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2">
                  DISPATCH TO WHATSAPP <Zap size={14} />
                </button>
                <button onClick={() => handleSubmit(false)} className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-xl font-black text-[10px] uppercase">
                   DISPATCH TO EMAIL
                </button>
                <button onClick={() => setStep(5)} className="text-slate-600 font-black text-[8px] uppercase tracking-widest mt-2 hover:text-white">BACK TO EDIT</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="flex gap-3">
                <div className="w-1 h-10 bg-sunset shrink-0 mt-1" />
                <div className="space-y-1">
                  <h2 className="text-xl md:text-4xl font-[900] text-white uppercase tracking-tighter leading-none">
                    <TypewriterLabel text={current.prompt} />
                  </h2>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{current.directive}</p>
                </div>
              </div>

              {current.type === 'segmented' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[{ val: "$300-$1.5k", label: "STARTER" }, { val: "$1.5k-$5k", label: "BUSINESS" }, { val: "$5k-$10k+", label: "ENTERPRISE" }].map((tier) => (
                    <button key={tier.val} onClick={() => setFormData({...formData, budget: tier.val})} className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${formData.budget === tier.val ? 'bg-white text-midnight border-white' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                      <span className="text-lg md:text-xl font-black tracking-tighter">{tier.val}</span>
                      <span className="text-[8px] font-black uppercase opacity-60">{tier.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <input ref={inputRef} type={current.type} name={current.field} value={formData[current.field as keyof typeof formData]} onChange={e => setFormData({...formData, [e.target.name]: e.target.value})} placeholder={current.placeholder} autoFocus onKeyDown={e => e.key === 'Enter' && current.valid && handleNextStep()} className="w-full bg-transparent border-b-2 border-white/10 focus:border-sunset text-white font-black text-xl md:text-4xl py-3 outline-none transition-all placeholder:text-white/5 tracking-tighter" />
                </div>
              )}

              <button onClick={handleNextStep} disabled={!current.valid} className={`w-full py-4 md:py-5 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-3 transition-all tracking-[0.2em] ${current.valid ? 'bg-white text-midnight' : 'bg-white/5 text-slate-800 cursor-not-allowed'}`}>
                NEXT STEP <ChevronRight size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-black/40 border-t border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Shield size={10} className="text-slate-600" />
          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">TLS_SECURED</span>
        </div>
      </div>
    </div>
  );
};

export default AuditForm;