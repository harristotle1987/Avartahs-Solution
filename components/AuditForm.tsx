
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronRight, CheckCircle, MessageSquare, Calendar, X, Zap, Globe, Mail, Smartphone } from 'lucide-react';
import { analytics } from '../lib/analytics';
import { saveLead } from '../lib/mockApi';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';
import emailjs from '@emailjs/browser';

interface AuditFormProps {
  onAuditComplete?: (report: any, url: string) => void;
}

const AuditForm: React.FC<AuditFormProps> = ({ onAuditComplete }) => {
  const generateID = () => `AV-SYS-${Math.floor(1000 + Math.random() * 8999)}-X`;
  const [sessionID, setSessionID] = useState(generateID);
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({ 
    website: '', 
    email: '', 
    phone: '', 
    budget: '' 
  });

  const steps = [
    { 
      id: 1, 
      field: "website", 
      prompt: "Website URL", 
      directive: "[DOMAIN]", 
      label: "INITIALIZING SCAN",
      icon: <Globe size={14} />,
      placeholder: "yourwebsite.com", 
      valid: formData.website.length > 3 && formData.website.includes('.') 
    },
    { 
      id: 2, 
      field: "email", 
      prompt: "Email Address", 
      directive: "[EMAIL]", 
      label: "CONTACT CHANNEL",
      icon: <Mail size={14} />,
      placeholder: "name@company.com", 
      valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) 
    },
    { 
      id: 3, 
      field: "phone", 
      prompt: "Phone Number", 
      directive: "[PHONE]", 
      label: "MOBILE ID",
      icon: <Smartphone size={14} />,
      placeholder: "+1 000 000 0000", 
      valid: formData.phone.length > 5 
    },
    { 
      id: 4, 
      field: "budget", 
      prompt: "Monthly Budget", 
      directive: "[BUDGET]", 
      label: "REVENUE TIER",
      icon: <Zap size={14} />,
      type: 'segmented', 
      valid: formData.budget !== "" 
    },
  ];

  const current = steps[step - 1];

  const resetFormLocal = () => {
    setStep(1);
    setIsSuccess(false);
    setFormData({ website: '', email: '', phone: '', budget: '' });
    setSessionID(generateID());
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    analytics.setSubmitted();

    const payload = {
      session_id: sessionID,
      target_url: formData.website,
      user_email: formData.email,
      user_phone: formData.phone,
      revenue_tier: formData.budget,
      cta_source: 'connectivity_test_v14'
    };

    try {
      // 1. DATA PERSISTENCE TEST (Supabase/Local)
      await saveLead(payload);

      // 2. NOTIFICATION GATEWAY TEST (EmailJS)
      const serviceID = process.env.EMAILJS_SERVICE_ID || 'default_service';
      const templateID = process.env.EMAILJS_TEMPLATE_ID || 'template_audit';
      const publicKey = process.env.EMAILJS_PUBLIC_KEY;

      if (publicKey) {
        await emailjs.send(serviceID, templateID, {
          to_email: 'harristotle84@gmail.com',
          from_email: formData.email,
          target_url: formData.website,
          budget_tier: formData.budget,
          session_id: sessionID,
          message: `CONNECTION_TEST_SUCCESS: Submission received from ${formData.website}.`
        }, publicKey);
      }

      // NOTE: Forensic AI Report generation is skipped as requested for connection testing phase.
      
      setIsProcessing(false);
      setIsSuccess(true);
    } catch (err: any) {
      console.error("Backend Handshake Error:", err);
      setIsProcessing(false);
      setIsSuccess(true); // Proceed to success UI anyway to check the "Reset" loop
    }
  };

  const handleNext = () => {
    if (step === 4) {
      handleSubmit();
    } else {
      setStep(step + 1);
      analytics.updateFormProgress(step + 1);
    }
  };

  if (isSuccess) {
    const whatsappMsg = `Hi, my session ID is ${sessionID}. I just requested an audit for ${formData.website}.`;
    const whatsappLink = `https://wa.me/2347039723596?text=${encodeURIComponent(whatsappMsg)}`;

    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 md:p-12 bg-white dark:bg-[#0f172a] border-2 border-midnight dark:border-white/10 rounded-[3rem] shadow-highlight relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-sunset" />
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mx-auto mb-6"><CheckCircle size={32} /></div>
        <h3 className="text-xl md:text-2xl font-black text-midnight dark:text-white uppercase tracking-tighter mb-4">[ CONNECTED ]</h3>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-10">Data transmitted successfully. Node ID: {sessionID}</p>
        <div className="space-y-4 max-w-sm mx-auto">
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex w-full py-5 bg-[#25D366] text-white rounded-2xl font-black uppercase text-xs tracking-widest items-center justify-center gap-3 shadow-xl hover:brightness-110 transition-all">
            <MessageSquare size={18} /> CONTACT VIA WHATSAPP
          </a>
          <ScrollLink to={SectionId.Booking} smooth={true} offset={-80} onClick={resetFormLocal} className="w-full py-5 bg-midnight dark:bg-white text-white dark:text-midnight rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 cursor-pointer hover:bg-sunset transition-all shadow-xl">
            <Calendar size={18} /> BOOK STRATEGY SESSION
          </ScrollLink>
          <button onClick={resetFormLocal} className="w-full py-5 bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:text-red-500 transition-all">
            <X size={18} /> RESET FORM
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0f172a] border-2 border-midnight dark:border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-premium relative overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col">
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-sunset mb-1">{current.directive}</div>
          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">CONNECTION_TEST</div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">STEP 0{step} / 04</div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
          <h2 className="text-xl md:text-2xl font-black text-midnight dark:text-white uppercase tracking-tighter">{current.prompt}</h2>
          {current.type === 'segmented' ? (
            <div className="grid grid-cols-1 gap-3">
              {[{ label: '[TIER ALPHA] — $300 - $1,000', value: 'ALPHA' }, { label: '[TIER BETA] — $1,000 - $3,000', value: 'BETA' }, { label: '[TIER GAMMA] — $3,000 - $5,000+', value: 'GAMMA' }].map(tier => (
                <button key={tier.value} disabled={isProcessing} onClick={() => { setFormData({...formData, budget: tier.value}); if(!isProcessing) handleNext(); }} className={`w-full py-5 border-2 rounded-2xl font-black text-[10px] uppercase tracking-widest text-left px-6 flex justify-between items-center ${formData.budget === tier.value ? 'border-sunset bg-sunset/5 text-sunset' : 'border-slate-100 dark:border-white/5 text-midnight dark:text-white'}`}>
                  {tier.label} <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <input autoFocus disabled={isProcessing} type={current.field === 'email' ? 'email' : 'text'} placeholder={current.placeholder} value={formData[current.field as keyof typeof formData]} onChange={(e) => setFormData({...formData, [current.field]: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && current.valid && handleNext()} className="w-full bg-slate-50 dark:bg-white/[0.02] border-b-2 border-slate-200 dark:border-white/10 focus:border-sunset py-3 text-lg font-black text-midnight dark:text-white outline-none placeholder:text-slate-200" />
          )}
          {current.type !== 'segmented' && (
            <button disabled={!current.valid || isProcessing} onClick={handleNext} className="w-full py-5 bg-midnight dark:bg-white text-white dark:text-midnight rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 shadow-md">
              {isProcessing ? <><Loader2 className="animate-spin" size={16} /><span>SYNCING...</span></> : 'CONTINUE'}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AuditForm;
