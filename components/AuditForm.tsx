import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronRight, CheckCircle, MessageSquare, Calendar, X, Zap } from 'lucide-react';
import { analytics } from '../lib/analytics';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';

const AuditForm: React.FC = () => {
  const [sessionID] = useState(() => `AUD-${Math.floor(1000 + Math.random() * 8999)}`);
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
      directive: "Identify the domain requiring conversion optimization.", 
      placeholder: "https://company.com", 
      valid: formData.website.length > 5 && formData.website.includes('.') 
    },
    { 
      id: 2, 
      field: "email", 
      prompt: "Email Address", 
      directive: "Where should we send the forensic report?", 
      placeholder: "architect@domain.com", 
      valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) 
    },
    { 
      id: 3, 
      field: "phone", 
      prompt: "Phone Number", 
      directive: "Direct mobile ID for priority status updates.", 
      placeholder: "+1 (000) 000-0000", 
      valid: formData.phone.length > 8 
    },
    { 
      id: 4, 
      field: "budget", 
      prompt: "Project Budget", 
      directive: "Select your project's capital allocation tier.", 
      type: 'segmented', 
      valid: formData.budget !== "" 
    },
  ];

  const current = steps[step - 1];

  const resetForm = () => {
    setIsSuccess(false);
    setStep(1);
    setFormData({ website: '', email: '', phone: '', budget: '' });
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    analytics.setSubmitted();
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
    }, 2000);
  };

  const handleNext = () => {
    if (step === 4) {
      handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 md:p-10 bg-white dark:bg-[#0f172a] border-2 border-slate-900 dark:border-white/10 rounded-[2rem] md:rounded-[2.5rem] shadow-highlight relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-sunset" />
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-6">
            <CheckCircle size={24} className="md:w-[32px] md:h-[32px]" />
          </div>
          
          <h3 className="text-xl md:text-2xl font-black text-midnight dark:text-white uppercase tracking-tighter mb-4">
            INGESTION SUCCESSFUL
          </h3>
          
          <p className="text-slate-500 dark:text-slate-400 font-medium text-[11px] md:text-sm leading-relaxed mb-8 max-w-sm">
            Session ID <span className="text-sunset font-bold">{sessionID}</span> is encrypted. Report dispatched to email.
          </p>

          <div className="w-full space-y-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap size={12} className="text-sunset animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Priority Review Active</p>
            </div>
            
            <a 
              href="https://wa.me/2347039723596"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.logHandshake('whatsapp')}
              className="w-full py-4 bg-[#25D366] text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition-all scale-105"
            >
              <MessageSquare size={16} /> Connect With Lead Architect
            </a>

            <div className="grid grid-cols-2 gap-2 md:gap-3 pt-2 md:pt-4">
              <ScrollLink 
                to={SectionId.Booking}
                smooth={true}
                offset={-100}
                className="py-3 md:py-4 bg-midnight dark:bg-white text-white dark:text-midnight rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Calendar size={14} /> Schedule
              </ScrollLink>
              
              <button 
                onClick={resetForm}
                className="py-3 md:py-4 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                <X size={14} /> End
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0f172a] border-2 border-slate-900 dark:border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-premium relative overflow-hidden transition-colors duration-500">
      <div className="flex items-center justify-between mb-8 md:mb-10">
        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">Step 0{step} / 04</div>
        <div className="text-[9px] font-black text-sunset uppercase tracking-widest">{current.prompt}</div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6 md:space-y-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-midnight dark:text-white uppercase tracking-tighter mb-2 leading-none">
              {current.prompt}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
              {current.directive}
            </p>
          </div>

          {current.type === 'segmented' ? (
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'ALPHA TIER — $300 - $1K', value: 'ALPHA' },
                { label: 'BETA TIER — $1K - $3K', value: 'BETA' },
                { label: 'GAMMA TIER — $3K - $5K+', value: 'GAMMA' }
              ].map(tier => (
                <button 
                  key={tier.value}
                  onClick={() => { setFormData({...formData, budget: tier.value}); handleSubmit(); }}
                  className="w-full py-4 border-2 border-slate-100 dark:border-white/5 rounded-xl text-midnight dark:text-white font-black text-[10px] uppercase tracking-widest hover:border-sunset dark:hover:border-sunset transition-all text-left px-4 md:px-6 flex justify-between items-center group"
                >
                  {tier.label} <ChevronRight size={16} className="text-slate-300 dark:text-slate-700 group-hover:text-sunset transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <input 
              autoFocus
              type={current.field === 'email' ? 'email' : 'text'}
              placeholder={current.placeholder}
              value={formData[current.field as keyof typeof formData]}
              onChange={(e) => setFormData({...formData, [current.field]: e.target.value})}
              onKeyDown={(e) => e.key === 'Enter' && current.valid && handleNext()}
              className="w-full bg-slate-50 dark:bg-white/[0.02] border-b-2 border-slate-200 dark:border-white/10 focus:border-sunset dark:focus:border-sunset py-2 md:py-3 text-base md:text-xl font-black text-midnight dark:text-white outline-none transition-all placeholder:text-slate-200 dark:placeholder:text-slate-800"
            />
          )}

          {current.type !== 'segmented' && (
            <button 
              disabled={!current.valid}
              onClick={handleNext}
              className="w-full py-4 md:py-5 bg-midnight dark:bg-white text-white dark:text-midnight rounded-xl font-black uppercase text-[10px] tracking-[0.2em] disabled:opacity-20 flex items-center justify-center gap-2 hover:bg-sunset dark:hover:bg-sunset dark:hover:text-white transition-all shadow-md"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={16} /> : (step === 4 ? 'Initiate Analysis' : 'Continue')}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AuditForm;