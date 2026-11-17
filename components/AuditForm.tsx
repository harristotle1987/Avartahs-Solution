import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { analytics } from '../lib/analytics';
import { saveLead, diagnoseWebsite } from '../lib/api';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';
import emailjs from '@emailjs/browser';
import { getServiceBySlug, ServiceItem } from '../lib/servicesData';
import { 
  Check, ArrowRight, ArrowLeft, Loader2, MessageSquare, Calendar,
  Globe, Rocket, Zap, ShieldCheck, TrendingUp, Sparkles, Smartphone,
  Search, Lock, CreditCard, LayoutDashboard, Bot, Layers, Activity,
  AlertCircle, RefreshCw, CheckCircle2, ShieldAlert
} from 'lucide-react';

interface AuditFormProps {
  onAuditComplete?: (report: any, url: string) => void;
  initialServiceSlug?: string;
}

export const AuditForm: React.FC<AuditFormProps> = ({ onAuditComplete, initialServiceSlug }) => {
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation();
  const generateID = () => `AV-SYS-${Math.floor(1000 + Math.random() * 8999)}-X`;
  const [sessionID, setSessionID] = useState(generateID);
  
  // Track Mode: 'existing' vs 'new_build'
  const [auditMode, setAuditMode] = useState<'existing' | 'new_build'>('existing');
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  // Real Website Diagnostics Engine state
  const [diagnosticStatus, setDiagnosticStatus] = useState<'idle' | 'scanning' | 'completed' | 'failed'>('idle');
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  // Submission state
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [formData, setFormData] = useState({ 
    website: '', 
    email: '', 
    phone: '', 
    description: '',
    referenceLink: '',
    budget: '$1,000 – $3,000',
    selectedBottlenecks: [] as string[],
    selectedFeatures: [] as string[],
    primaryGoal: 'High Lead Conversion & Sales'
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slug = initialServiceSlug || params.get('service');
    if (slug) {
      const found = getServiceBySlug(slug);
      if (found) {
        setSelectedService(found);
        setFormData(prev => ({
          ...prev,
          description: prev.description || `Inquiry for ${found.title}: `
        }));
      }
    }
  }, [location.search, initialServiceSlug]);

  const runLiveDiagnostics = async (targetDomain?: string) => {
    const raw = (targetDomain || formData.website || '').trim();
    if (!raw || raw.length < 4 || !raw.includes('.')) {
      setDiagnosticError('Please enter a valid website domain (e.g., example.com)');
      setDiagnosticStatus('failed');
      return;
    }

    setDiagnosticStatus('scanning');
    setDiagnosticError(null);

    try {
      const result = await diagnoseWebsite(raw);
      setDiagnosticResult(result);
      setDiagnosticStatus('completed');

      // Pre-select detected bottlenecks based on genuine findings
      const detected = [...formData.selectedBottlenecks];
      if (result.httpProbe?.ttfbMs && result.httpProbe.ttfbMs > 500 && !detected.includes('speed')) {
        detected.push('speed');
      }
      if (result.axeCore?.violationsCount > 0 && !detected.includes('mobile')) {
        detected.push('mobile');
      }
      if (!result.httpProbe?.hasMetaDescription && !detected.includes('seo')) {
        detected.push('seo');
      }
      if (detected.length !== formData.selectedBottlenecks.length) {
        setFormData(prev => ({ ...prev, selectedBottlenecks: detected }));
      }
    } catch (err: any) {
      console.warn('[AuditForm Diagnostic Error]:', err);
      setDiagnosticError(err.message || 'Unable to reach target host. Please verify the domain is online.');
      setDiagnosticStatus('failed');
    }
  };

  // Automatically trigger genuine diagnostic scan when prospect types a valid domain
  useEffect(() => {
    if (auditMode !== 'existing') {
      setDiagnosticStatus('idle');
      setDiagnosticResult(null);
      setDiagnosticError(null);
      return;
    }

    const trimmed = formData.website.trim();
    if (trimmed.length > 5 && trimmed.includes('.') && !trimmed.endsWith('.')) {
      const timer = setTimeout(() => {
        if (diagnosticResult?.targetUrl !== trimmed && diagnosticStatus !== 'scanning') {
          runLiveDiagnostics(trimmed);
        }
      }, 1400);
      return () => clearTimeout(timer);
    } else {
      setDiagnosticStatus('idle');
      setDiagnosticResult(null);
      setDiagnosticError(null);
    }
  }, [formData.website, auditMode]);

  // Existing Site Bottleneck Chips
  const bottleneckOptions = [
    { id: 'speed', label: 'Slow Mobile Load Time', icon: Zap, impact: 'Performance & Core Web Vitals' },
    { id: 'conversion', label: 'High Cart/Form Drop-off', icon: TrendingUp, impact: 'Funnel & UX Clarity' },
    { id: 'design', label: 'Outdated Visual Design', icon: Layers, impact: 'Modern Brand Architecture' },
    { id: 'seo', label: 'Weak Google Search Rankings', icon: Search, impact: 'Technical SEO Structure' },
    { id: 'mobile', label: 'Broken Mobile Navigation', icon: Smartphone, impact: 'Responsive Accessibility' },
    { id: 'automation', label: 'No Lead Capture Automation', icon: Bot, impact: 'Automated Intake & Routing' },
  ];

  // New Build Required Feature Chips
  const featureOptions = [
    { id: 'ecom', label: 'E-Commerce / Stripe Checkout', icon: CreditCard, benefit: 'Seamless Payments' },
    { id: 'dashboard', label: 'Custom Client Dashboard', icon: LayoutDashboard, benefit: 'Real-Time Insights' },
    { id: 'ai', label: 'AI Assistant & Automation', icon: Bot, benefit: '24/7 Automated Ops' },
    { id: 'booking', label: 'Booking & Appointment Engine', icon: Calendar, benefit: 'Direct Lead Calls' },
    { id: 'portal', label: 'User Auth & Role Control', icon: Lock, benefit: 'Enterprise Security' },
    { id: 'cms', label: 'High-Speed Headless CMS', icon: Sparkles, benefit: 'Instant Content Updates' },
  ];

  const toggleBottleneck = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedBottlenecks: prev.selectedBottlenecks.includes(id)
        ? prev.selectedBottlenecks.filter(b => b !== id)
        : [...prev.selectedBottlenecks, id]
    }));
  };

  const toggleFeature = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedFeatures: prev.selectedFeatures.includes(id)
        ? prev.selectedFeatures.filter(f => f !== id)
        : [...prev.selectedFeatures, id]
    }));
  };

  const isStep1Valid = auditMode === 'existing' 
    ? formData.website.length > 3 && formData.website.includes('.') 
    : formData.primaryGoal.length > 2;

  const isStep2Valid = true; // Optional or pre-populated with chips

  const isStep3Valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && formData.phone.length > 5;

  const resetFormLocal = () => {
    setStep(1);
    setIsSuccess(false);
    setFormData({ 
      website: '', 
      email: '', 
      phone: '', 
      description: '', 
      referenceLink: '', 
      budget: '$1,000 – $3,000',
      selectedBottlenecks: [],
      selectedFeatures: [],
      primaryGoal: 'High Lead Conversion & Sales'
    });
    setSessionID(generateID());
    setDiagnosticStatus('idle');
    setDiagnosticResult(null);
    setDiagnosticError(null);
    setSubmissionError(null);
  };

  const handleSubmit = async () => {
    if (isProcessing) return; // Prevent duplicate submissions while request is processing

    setIsProcessing(true);
    setSubmissionError(null);
    analytics.setSubmitted();

    const servicePrefix = selectedService ? `[Service: ${selectedService.title}] ` : '';
    const bottleneckSummary = formData.selectedBottlenecks.join(', ');
    const featureSummary = formData.selectedFeatures.join(', ');

    let diagnosticSummaryText = '';
    if (diagnosticResult) {
      const probe = diagnosticResult.httpProbe;
      const axe = diagnosticResult.axeCore;
      const ps = diagnosticResult.googlePageSpeed;
      diagnosticSummaryText = ` | Verified Telemetry: TTFB ${probe.ttfbMs || 'N/A'}ms (${probe.sslValid ? 'TLS Valid' : 'Insecure'}), axe-core: ${axe.score ?? 'N/A'}/100 (${axe.violationsCount} violations), PageSpeed: ${ps.status === 'COMPLETED' ? `${ps.performanceScore}/100` : ps.status}`;
    }

    const coreProblemText = auditMode === 'existing' 
      ? `${servicePrefix}Existing Audit: ${formData.website} | Bottlenecks: ${bottleneckSummary || 'General Audit'}${diagnosticSummaryText} | Notes: ${formData.description}`
      : `${servicePrefix}New Build Blueprint: Goal: ${formData.primaryGoal} | Features: ${featureSummary || 'Full Scope'} | Ref: ${formData.referenceLink} | Notes: ${formData.description}`;

    const payload = {
      session_id: sessionID,
      target_url: auditMode === 'existing' 
        ? formData.website 
        : (formData.referenceLink || (selectedService ? `Service: ${selectedService.slug}` : 'New Build Blueprint')),
      user_email: formData.email,
      user_phone: formData.phone,
      revenue_tier: formData.budget,
      core_problem: coreProblemText,
      cta_source: selectedService ? `service-catalog:${selectedService.slug}` : `growth-audit-${auditMode}`
    };

    try {
      // 1. Persist to Neon DB
      const leadResult = await saveLead(payload);

      // Construct actual audit report payload combining lead and telemetry
      const auditReport = {
        lead: leadResult,
        sessionId: sessionID,
        targetUrl: payload.target_url,
        diagnostics: diagnosticResult,
        submittedAt: new Date().toISOString()
      };

      // 2. Dispatch email notification if EmailJS key is configured
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      if (publicKey && publicKey !== 'undefined') {
        let emailTargetUrl = auditMode === 'existing' ? formData.website : `New Build (${formData.primaryGoal})`;
        try {
          await emailjs.send(
            import.meta.env.VITE_EMAILJS_SERVICE_ID || 'default service',
            import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template audit',
            {
              to_email: 'harristotle84@gmail.com',
              from_email: formData.email,
              target_url: emailTargetUrl,
              budget_tier: formData.budget,
              session_id: sessionID,
              message: coreProblemText
            },
            publicKey
          );
        } catch (emailErr) {
          console.warn('[AuditForm] Email dispatch warning (non-fatal):', emailErr);
        }
      }

      // 3. Confirm success ONLY after backend persistence succeeds
      setIsProcessing(false);
      setIsSuccess(true);
      if (onAuditComplete) {
        onAuditComplete(auditReport, auditMode === 'existing' ? formData.website : 'New Build');
      }
    } catch (err: any) {
      console.error("[AuditForm Submission Failure]:", err);
      setIsProcessing(false);
      setIsSuccess(false); // NEVER set success on failure!
      setSubmissionError(err?.message || 'Failed to submit audit request. Please check your connection and try again.');
    }
  };

  const handleNext = () => {
    if (step === 3) {
      handleSubmit();
    } else {
      const nextStep = step + 1;
      setStep(nextStep);
      analytics.updateFormProgress(nextStep);
      setAiFeedback('');
    }
  };

  if (isSuccess) {
    const whatsappMsg = `Hi Avartah team, my audit tracking ID is ${sessionID}. I have submitted our project scope for analysis.`;
    const whatsappLink = `https://wa.me/2347039723596?text=${encodeURIComponent(whatsappMsg)}`;

    return (
      <motion.div 
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
        className="text-center py-4 motion-reduce:transition-none motion-reduce:transform-none"
      >
        <div className="w-12 h-12 rounded-xl bg-[#171A1D] border border-[#C58A52]/50 text-[#C58A52] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#C58A52]/10">
          <Check size={24} />
        </div>

        <h4 className="text-lg font-bold text-slate-900 dark:text-[#F2F1ED] mb-2">
          {auditMode === 'existing' ? 'Forensic Audit Request Received' : 'Project Blueprint Received'}
        </h4>

        <p className="text-xs text-slate-600 dark:text-[#A3A9AF] leading-relaxed mb-4 max-w-md mx-auto">
          Your details are logged into our Neon engineering pipeline. Our lead systems architect will evaluate your target parameters and deliver an actionable report with fixed sprint quotes.
        </p>

        <div className="font-mono text-xs text-slate-500 dark:text-[#747C84] mb-6 p-2.5 rounded-lg bg-slate-100 dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] w-fit mx-auto">
          Tracking ID: <span className="text-[#C58A52] font-semibold">{sessionID}</span>
        </div>

        <div className="space-y-3 max-w-sm mx-auto">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-[#171A1D] hover:bg-[#202428] border border-[#30363B] text-[#F2F1ED] text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all hover:border-[#25D366]/60 shadow-sm"
          >
            <MessageSquare size={16} className="text-[#25D366]" />
            <span>Connect Directly on WhatsApp</span>
          </a>

          <ScrollLink
            to={SectionId.Booking}
            smooth={true}
            offset={-70}
            className="w-full py-3 px-4 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:shadow-[#C58A52]/20 cursor-pointer"
          >
            <Calendar size={16} />
            <span>Schedule Strategy Consultation</span>
          </ScrollLink>

          <button
            type="button"
            onClick={resetFormLocal}
            className="w-full py-2 text-slate-500 hover:text-slate-800 dark:hover:text-[#F2F1ED] text-xs transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dual Mode Switcher Header */}
      <div className="p-1 rounded-xl bg-slate-100 dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => {
            setAuditMode('existing');
            setStep(1);
          }}
          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            auditMode === 'existing'
              ? 'bg-white dark:bg-[#171A1D] text-[#C58A52] shadow-sm border border-slate-200 dark:border-[#C58A52]/40'
              : 'text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED]'
          }`}
        >
          <Globe size={14} />
          <span>Existing Site Audit</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAuditMode('new_build');
            setStep(1);
          }}
          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            auditMode === 'new_build'
              ? 'bg-white dark:bg-[#171A1D] text-[#C58A52] shadow-sm border border-slate-200 dark:border-[#C58A52]/40'
              : 'text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED]'
          }`}
        >
          <Rocket size={14} />
          <span>New Site Blueprint</span>
        </button>
      </div>

      {/* Step Tracker & Progress Line */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#747C84]">
          <span className="font-mono tabular-nums">Step {step} of 3</span>
          <span className="font-semibold text-slate-800 dark:text-[#F2F1ED]">
            {step === 1 && (auditMode === 'existing' ? 'Target URL & Scanner' : 'Project Goals & Type')}
            {step === 2 && (auditMode === 'existing' ? 'Select Priority Bottlenecks' : 'Required Key Capabilities')}
            {step === 3 && 'Contact & Sprint Investment'}
          </span>
        </div>

        <div className="w-full h-1.5 bg-slate-200 dark:bg-[#202428] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#C58A52] to-amber-500 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${auditMode}-${step}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {/* STEP 1: TARGET / URL & LIVE SCANNER */}
          {step === 1 && (
            <div className="space-y-4">
              {auditMode === 'existing' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5 flex items-center justify-between">
                      <span>Live Website Domain</span>
                      <span className="text-[10px] text-[#C58A52] font-mono flex items-center gap-1">
                        <Activity size={11} className="text-[#C58A52]" />
                        <span>Real Diagnostics Engine</span>
                      </span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="audit-website-input"
                        type="url"
                        placeholder="https://yourcompany.com"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            runLiveDiagnostics(formData.website);
                          }
                        }}
                        className="w-full pl-4 pr-24 py-3 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] text-base sm:text-xs placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {diagnosticStatus === 'scanning' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#C58A52] font-mono bg-[#C58A52]/10 border border-[#C58A52]/30 px-2.5 py-1 rounded-lg">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Probing...</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={formData.website.trim().length < 4}
                            onClick={() => runLiveDiagnostics(formData.website)}
                            className="px-3 py-1.5 rounded-lg bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] text-[11px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
                          >
                            Analyze
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-[#747C84] mt-1">
                      Executes real server-side HTTP/TLS latency probe, axe-core WCAG 2.2 accessibility audit, and Google PageSpeed checks.
                    </p>
                  </div>

                  {/* 1. Scanning State */}
                  {diagnosticStatus === 'scanning' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-[#111315]/90 border border-[#C58A52]/30 text-xs space-y-2 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#C58A52] font-semibold text-xs">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Executing Real Diagnostics Engine...</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C58A52]/10 text-[#C58A52] border border-[#C58A52]/20 font-mono">
                          Zero Simulation
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600 dark:text-[#A3A9AF]">
                        <div className="p-2 rounded-lg bg-white/40 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="truncate">HTTP Probe</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/40 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          <span className="truncate">axe-core</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/40 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span className="truncate">PageSpeed</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* 2. Failed State */}
                  {diagnosticStatus === 'failed' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-2 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between text-amber-500 font-semibold text-xs">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={14} />
                          <span>Target Diagnostics Offline or Unreachable</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => runLiveDiagnostics(formData.website)}
                          className="text-[10px] text-[#C58A52] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={10} />
                          <span>Retry Probe</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                        {diagnosticError || 'The target domain could not be connected to over public HTTP. Please ensure the domain is active.'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-[#747C84]">
                        You can still proceed with scope submission; our architecture team will execute manual forensic server triage.
                      </p>
                    </motion.div>
                  )}

                  {/* 3. Completed Real Diagnostics Card */}
                  {diagnosticStatus === 'completed' && diagnosticResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#111315]/80 border border-emerald-500/30 text-xs space-y-3 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          <span>Verified Diagnostic Telemetry</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                            {diagnosticResult.executionTimeMs}ms execution
                          </span>
                          <button
                            type="button"
                            onClick={() => runLiveDiagnostics(formData.website)}
                            title="Re-run diagnostic"
                            className="text-slate-400 hover:text-[#C58A52] transition-colors cursor-pointer"
                          >
                            <RefreshCw size={12} />
                          </button>
                        </div>
                      </div>

                      {/* 4 Measured Metric Pillars */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        {/* 1. Measured TTFB */}
                        <div className="p-2 rounded-lg bg-white/50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B]">
                          <span className="text-slate-400 block text-[10px] font-mono">Time To First Byte</span>
                          <span className={`font-bold font-mono text-xs ${
                            diagnosticResult.httpProbe.ttfbMs && diagnosticResult.httpProbe.ttfbMs < 300 
                              ? 'text-emerald-400' 
                              : diagnosticResult.httpProbe.ttfbMs && diagnosticResult.httpProbe.ttfbMs < 800 
                                ? 'text-amber-400' 
                                : 'text-red-400'
                          }`}>
                            {diagnosticResult.httpProbe.ttfbMs ? `${diagnosticResult.httpProbe.ttfbMs}ms` : 'Failed'}
                          </span>
                          <span className="text-[9px] text-slate-500 block truncate">
                            {diagnosticResult.httpProbe.compression !== 'none' 
                              ? `${diagnosticResult.httpProbe.compression}` 
                              : 'No compression'}
                          </span>
                        </div>

                        {/* 2. SSL & Protocol */}
                        <div className="p-2 rounded-lg bg-white/50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B]">
                          <span className="text-slate-400 block text-[10px] font-mono">Transport Security</span>
                          <span className={`font-bold text-xs ${diagnosticResult.httpProbe.sslValid ? 'text-emerald-400' : 'text-red-400'}`}>
                            {diagnosticResult.httpProbe.protocol || 'HTTP'}
                          </span>
                          <span className="text-[9px] text-slate-500 block truncate">
                            {diagnosticResult.httpProbe.securityHeaders?.hsts ? 'HSTS Active' : 'No HSTS Policy'}
                          </span>
                        </div>

                        {/* 3. axe-core Accessibility */}
                        <div className="p-2 rounded-lg bg-white/50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B]">
                          <span className="text-slate-400 block text-[10px] font-mono">axe-core WCAG</span>
                          <span className={`font-bold text-xs ${
                            diagnosticResult.axeCore.score == null 
                              ? 'text-slate-400' 
                              : diagnosticResult.axeCore.score >= 80 
                                ? 'text-emerald-400' 
                                : 'text-amber-400'
                          }`}>
                            {diagnosticResult.axeCore.score != null ? `${diagnosticResult.axeCore.score}/100` : 'Unavailable'}
                          </span>
                          <span className="text-[9px] text-slate-500 block truncate">
                            {diagnosticResult.axeCore.violationsCount === 0 
                              ? '0 violations' 
                              : `${diagnosticResult.axeCore.violationsCount} violation${diagnosticResult.axeCore.violationsCount > 1 ? 's' : ''}`}
                          </span>
                        </div>

                        {/* 4. Google PageSpeed */}
                        <div className="p-2 rounded-lg bg-white/50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B]">
                          <span className="text-slate-400 block text-[10px] font-mono">Google PageSpeed</span>
                          <span className="font-bold text-xs text-[#C58A52]">
                            {diagnosticResult.googlePageSpeed.status === 'COMPLETED' 
                              ? `${diagnosticResult.googlePageSpeed.performanceScore}/100` 
                              : diagnosticResult.googlePageSpeed.status === 'UNAVAILABLE' 
                                ? 'API Limited' 
                                : 'Failed'}
                          </span>
                          <span className="text-[9px] text-slate-500 block truncate" title={diagnosticResult.googlePageSpeed.error || 'Verified'}>
                            {diagnosticResult.googlePageSpeed.status === 'COMPLETED' 
                              ? `FCP: ${diagnosticResult.googlePageSpeed.coreWebVitals?.fcp || 'N/A'}` 
                              : diagnosticResult.googlePageSpeed.status === 'UNAVAILABLE'
                                ? 'Direct probe active'
                                : 'Service offline'}
                          </span>
                        </div>
                      </div>

                      {/* Verified Findings */}
                      {diagnosticResult.summary?.bottlenecksDetected?.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-1">
                          <span className="text-[10px] font-mono text-[#C58A52] uppercase tracking-wider block">Verified Findings:</span>
                          <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-[#A3A9AF]">
                            {diagnosticResult.summary.bottlenecksDetected.slice(0, 3).map((b: string, idx: number) => (
                              <li key={`finding-${idx}-${b.slice(0, 15)}`} className="flex items-start gap-1.5">
                                <span className="text-[#C58A52] font-bold">•</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
                      Core Business Objective or Challenge
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Current site loads slowly on mobile and leads drop off before contacting us..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] text-xs placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors resize-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
                      Primary Goal of New Site / System
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        'High Lead Conversion & Sales',
                        'SaaS / Client Application Portal',
                        'Commercial E-Commerce Storefront',
                        'Automated Business Operations'
                      ].map((goal, gIdx) => (
                        <button
                          key={`goal-opt-${gIdx}-${goal.slice(0, 10)}`}
                          type="button"
                          onClick={() => setFormData({ ...formData, primaryGoal: goal })}
                          className={`p-3 rounded-xl border text-left text-xs transition-all ${
                            formData.primaryGoal === goal
                              ? 'border-[#C58A52] bg-[#C58A52]/10 text-[#C58A52] font-semibold'
                              : 'border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-700 dark:text-[#A3A9AF] hover:border-slate-300 dark:hover:border-[#747C84]'
                          }`}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
                      Benchmark / Inspiration Link (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="https://reference-design.com"
                      value={formData.referenceLink}
                      onChange={(e) => setFormData({ ...formData, referenceLink: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] text-xs placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
                      Project Description & Key Requirements
                    </label>
                    <textarea
                      rows={2}
                      placeholder="We require a custom portal for client management, automated invoicing and real-time project tracking..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] text-xs placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors resize-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 2: INTERACTIVE CHIPS (BOTTLENECKS OR FEATURES) */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                  {auditMode === 'existing' 
                    ? 'Select Key Areas to Focus Diagnostic On' 
                    : 'Select Key Capabilities Needed in New System'}
                </label>
                <p className="text-[11px] text-slate-500 dark:text-[#747C84] mb-3">
                  Click chips to prioritize in your report.
                </p>

                {auditMode === 'existing' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {bottleneckOptions.map((item) => {
                      const Icon = item.icon;
                      const isSelected = formData.selectedBottlenecks.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleBottleneck(item.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                            isSelected
                              ? 'border-[#C58A52] bg-[#C58A52]/10 text-slate-900 dark:text-[#F2F1ED] ring-1 ring-[#C58A52]/50'
                              : 'border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-700 dark:text-[#A3A9AF] hover:border-slate-300 dark:hover:border-[#747C84]'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#C58A52] text-[#111315]' : 'bg-slate-100 dark:bg-[#171A1D] text-[#C58A52]'}`}>
                            <Icon size={14} />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold leading-tight">{item.label}</div>
                            <div className="text-[10px] text-[#C58A52] mt-0.5 font-medium">{item.impact}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {featureOptions.map((item) => {
                      const Icon = item.icon;
                      const isSelected = formData.selectedFeatures.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleFeature(item.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                            isSelected
                              ? 'border-[#C58A52] bg-[#C58A52]/10 text-slate-900 dark:text-[#F2F1ED] ring-1 ring-[#C58A52]/50'
                              : 'border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-700 dark:text-[#A3A9AF] hover:border-slate-300 dark:hover:border-[#747C84]'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#C58A52] text-[#111315]' : 'bg-slate-100 dark:bg-[#171A1D] text-[#C58A52]'}`}>
                            <Icon size={14} />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold leading-tight">{item.label}</div>
                            <div className="text-[10px] text-[#C58A52] mt-0.5 font-medium">{item.benefit}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dynamic Value Uplift Preview */}
              <div className="p-3 rounded-xl bg-[#171A1D] border border-white/10 flex items-center justify-between text-xs text-[#F2F1ED]">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-[#C58A52]" />
                  <span>Report Output Coverage:</span>
                </div>
                <span className="font-mono text-[#C58A52] font-semibold">
                  {auditMode === 'existing' 
                    ? `${formData.selectedBottlenecks.length || 'Full'} Key Diagnostics Selected`
                    : `${formData.selectedFeatures.length || 'Custom'} Core Modules Selected`}
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: CONTACT & BUDGET */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
                    Business Email
                  </label>
                  <input
                    id="audit-email-input"
                    type="email"
                    required
                    placeholder="founder@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] text-base sm:text-xs placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="audit-phone-input" className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
                    Mobile / WhatsApp Channel
                  </label>
                  <input
                    id="audit-phone-input"
                    type="tel"
                    required
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] text-base sm:text-xs placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5">
                  Investment Scope / Budget Tier
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '$350 – $1,000', detail: 'Speed Sprint / Landing Page' },
                    { label: '$1,000 – $3,000', detail: 'Full Storefront or Custom App' },
                    { label: '$3,000 – $5,000+', detail: 'Enterprise Portal & AI Engine' },
                    { label: 'Dedicated Retainer', detail: 'Multi-Month Engineering' },
                  ].map((tier) => (
                    <button
                      key={tier.label}
                      type="button"
                      onClick={() => setFormData({ ...formData, budget: tier.label })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formData.budget === tier.label
                          ? 'border-[#C58A52] bg-[#C58A52]/10 text-slate-900 dark:text-[#F2F1ED] font-semibold'
                          : 'border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-700 dark:text-[#A3A9AF] hover:border-slate-300 dark:hover:border-[#747C84]'
                      }`}
                    >
                      <div className="text-xs font-semibold">{tier.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-[#747C84]">{tier.detail}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submission Error Banner */}
              {submissionError && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs space-y-1 backdrop-blur-md"
                >
                  <div className="flex items-center gap-2 text-red-500 font-bold text-xs">
                    <AlertCircle size={15} />
                    <span>Submission Failed</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-[#A3A9AF] leading-relaxed">
                    {submissionError}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-[#747C84]">
                    Your details are preserved above. Please review your email and phone number, then click "Submit Audit Request" to retry.
                  </p>
                </motion.div>
              )}

              {/* Verified Forensic Report Execution Badge */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#C58A52]/10 text-[#C58A52] flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-[11px] text-slate-600 dark:text-[#A3A9AF] leading-tight">
                  <strong className="text-slate-900 dark:text-[#F2F1ED] block">
                    {diagnosticResult ? 'Verified Diagnostic Telemetry Attached:' : 'Forensic Engineering Execution Included:'}
                  </strong>
                  {diagnosticResult ? (
                    <span>
                      Live HTTP probe ({diagnosticResult.httpProbe.ttfbMs ? `${diagnosticResult.httpProbe.ttfbMs}ms TTFB` : 'measured'}), axe-core WCAG verification ({diagnosticResult.axeCore.passedRulesCount} passed, {diagnosticResult.axeCore.violationsCount} violations), and sprint proposal.
                    </span>
                  ) : (
                    <span>
                      Target architecture analysis, axe-core accessibility compliance check, and fixed sprint quote.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-[#30363B]">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED] inline-flex items-center gap-1 transition-colors py-2 px-3 rounded-lg"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        ) : <div />}

        <button
          type="button"
          disabled={(step === 1 && !isStep1Valid) || (step === 3 && !isStep3Valid) || isProcessing}
          onClick={handleNext}
          className="px-6 py-2.5 bg-[#C58A52] hover:bg-[#D99B62] disabled:opacity-50 text-[#111315] font-bold text-xs rounded-xl transition-all inline-flex items-center gap-2 shadow-md hover:shadow-lg hover:shadow-[#C58A52]/20 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Transmitting Scope...</span>
            </>
          ) : step === 3 ? (
            <>
              <span>Submit Audit Request</span>
              <Check size={14} />
            </>
          ) : (
            <>
              <span>Continue Step {step + 1}</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AuditForm;
