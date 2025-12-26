import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { FileSearch, Workflow, Layers, Activity } from 'lucide-react';

const steps = [
  { 
    step: '01', 
    title: 'Discovery & Audit', 
    description: 'We perform a forensic review of your current conversion logic to determine immediate ROI. No guesswork, just raw data metrics.', 
    icon: <FileSearch size={24} />,
    breakdown: [
      'Conversion Leak Mapping',
      'Revenue-per-Visitor (RPV) Analysis',
      'Competitive Logic Benchmarking'
    ],
    codeSnippet: 'const audit = analyze(target_url);\nif (audit.score < 80) {\n  identifyLeaks(audit.path);\n}'
  },
  { 
    step: '02', 
    title: 'Core Logic Mapping', 
    description: 'Our engineers extract the DNA of your business into a high-performance behavioral framework designed for maximum LTV.', 
    icon: <Workflow size={24} />,
    breakdown: [
      'Behavioral UX Architecture',
      'Information Flow Design',
      'Predictive User Journey Modeling'
    ],
    codeSnippet: 'graph { \n  User -> Discovery;\n  Discovery -> Desire;\n  Desire -> Conversion;\n}'
  },
  { 
    step: '03', 
    title: 'Engineered Build', 
    description: 'We deploy your new environment using a modern performance stack optimized for sub-second mobile rendering.', 
    icon: <Layers size={24} />,
    breakdown: [
      'Next.js Edge Runtime Optimization',
      'Headless Infrastructure',
      '100/100 Lighthouse Performance Scoring'
    ],
    codeSnippet: 'export const config = {\n  runtime: "edge",\n  regions: ["iad1", "sfo1"]\n};'
  },
  { 
    step: '04', 
    title: 'Live Telemetry', 
    description: 'Live telemetry tracks every interaction. We refine the logic-layer in real-time to maximize revenue output.', 
    icon: <Activity size={24} />,
    breakdown: [
      'Real-Time ROI Tracking',
      'A/B Logic Experimentation',
      '24/7 Conversion Guardrails'
    ],
    codeSnippet: 'stream.on("event", (e) => {\n  optimize(e.params);\n  log("ROI_TICK");\n});'
  }
];

const Process: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refined scroll tracking for better sensitivity - covers entry and exit
  const { scrollYProgress } = useScroll({ 
    target: containerRef, 
    offset: ["start 0.8", "end 0.2"] 
  });

  // Snappier spring configuration for responsive visual feedback
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const smoothProgress = useSpring(scrollYProgress, springConfig);
  
  // Transform progress into height and position for the "active" line
  const lineHeight = useTransform(smoothProgress, [0, 1], ["0%", "100%"]);
  const orbPos = useTransform(smoothProgress, [0, 1], ["0%", "100%"]);

  return (
    <div ref={containerRef} className="relative py-12 md:py-24 px-6 overflow-hidden bg-transparent">
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden -z-10">
        <div className="absolute top-[10%] right-[5%] text-[8px] font-mono text-slate-400 opacity-10 dark:opacity-[0.05] whitespace-pre-wrap leading-tight rotate-12">
          {`SELECT * FROM growth_metrics\nWHERE conversion_rate < optimal_threshold;`}
        </div>
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Background static track line (Gray) */}
        <div className="absolute left-6 md:left-8 top-0 bottom-0 w-[2px] bg-slate-200 dark:bg-white/5 rounded-full" />
        
        {/* Dynamic progress fill line (Orange) */}
        <motion.div 
          style={{ height: lineHeight }} 
          className="absolute left-6 md:left-8 top-0 w-[4px] bg-sunset origin-top z-10 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]" 
        />

        {/* Dynamic tracking orb - Following the scroll path */}
        <motion.div
          style={{ top: orbPos }}
          className="absolute left-6 md:left-8 w-6 h-6 bg-sunset rounded-full -translate-x-1/2 -translate-y-1/2 z-20 shadow-[0_0_25px_rgba(249,115,22,1)] border-4 border-white dark:border-midnight"
        >
           <div className="absolute inset-0 rounded-full animate-ping bg-sunset/30 scale-150" />
        </motion.div>

        <div className="space-y-24 md:space-y-40">
          {steps.map((item, index) => (
            <div key={index} className="relative pl-12 md:pl-24">
               {/* Large Background Numbers */}
               <div className="absolute top-0 left-20 md:left-28 hidden lg:block select-none pointer-events-none -z-10 opacity-[0.03]">
                  <span className="text-[14rem] font-black leading-none text-slate-900 dark:text-white" style={{ WebkitTextStroke: '2px currentColor', color: 'transparent' }}>
                    {item.step}
                  </span>
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-20">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex-1 w-full"
                  >
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200 dark:border-white/10 p-8 md:p-12 rounded-[2.5rem] shadow-lab hover:border-sunset/30 transition-all duration-500 group">
                      <div className="flex items-center gap-5 mb-8">
                        <div className="p-4 bg-midnight dark:bg-white text-white dark:text-midnight rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
                          {item.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-sunset mb-1">Phase {item.step}</span>
                          <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-midnight dark:text-white leading-none">{item.title}</h3>
                        </div>
                      </div>
                      
                      <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg leading-relaxed font-medium mb-8">{item.description}</p>

                      <div className="space-y-4">
                        {item.breakdown.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-4">
                             <div className="w-2 h-2 bg-electric rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                             <span className="text-[11px] md:text-xs font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest leading-none">{bullet}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="flex-1 hidden lg:block"
                  >
                    <div className="bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/10 p-10 rounded-[3rem] font-mono text-[11px] text-slate-400 dark:text-slate-500 shadow-inner">
                       <div className="flex items-center gap-3 mb-6">
                          <span className="w-2.5 h-2.5 rounded-full bg-electric animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                          <span className="tracking-[0.4em] uppercase font-black text-[9px]">Pipeline_Execution_Unit</span>
                       </div>
                       <div className="bg-white dark:bg-black/40 p-8 rounded-2xl border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden whitespace-pre font-mono leading-relaxed">
                          <code className="text-slate-600 dark:text-slate-400">{item.codeSnippet}</code>
                       </div>
                    </div>
                  </motion.div>
                </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Process;