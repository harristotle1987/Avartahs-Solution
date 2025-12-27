import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
// Added Terminal to imports to fix error on line 144
import { FileSearch, Workflow, Layers, Activity, Terminal } from 'lucide-react';

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
  
  const { scrollYProgress } = useScroll({ 
    target: containerRef, 
    offset: ["start 0.8", "end 0.2"] 
  });

  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const smoothProgress = useSpring(scrollYProgress, springConfig);
  
  const lineHeight = useTransform(smoothProgress, [0, 1], ["0%", "100%"]);
  const orbPos = useTransform(smoothProgress, [0, 1], ["0%", "100%"]);

  return (
    <div ref={containerRef} className="relative py-12 md:py-32 px-6 overflow-hidden bg-transparent">
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden -z-10">
        <div className="absolute top-[10%] right-[5%] text-[8px] font-mono text-slate-400 opacity-10 dark:opacity-[0.05] whitespace-pre-wrap leading-tight rotate-12">
          {`SELECT * FROM growth_metrics\nWHERE conversion_rate < optimal_threshold;`}
        </div>
      </div>

      <div className="max-w-7xl mx-auto relative">
        <div className="absolute left-6 md:left-8 top-0 bottom-0 w-[2px] bg-slate-200 dark:bg-white/5 rounded-full" />
        
        <motion.div 
          style={{ height: lineHeight }} 
          className="absolute left-6 md:left-8 top-0 w-[4px] bg-sunset origin-top z-10 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)]" 
        />

        <motion.div
          style={{ top: orbPos }}
          className="absolute left-6 md:left-8 w-6 h-6 bg-sunset rounded-full -translate-x-1/2 -translate-y-1/2 z-20 shadow-[0_0_30px_#F97316] border-4 border-white dark:border-midnight"
        >
           <div className="absolute inset-0 rounded-full animate-ping bg-sunset/30 scale-150" />
        </motion.div>

        <div className="space-y-32 md:space-y-56">
          {steps.map((item, index) => (
            <div key={index} className="relative pl-14 md:pl-28">
               <div className="absolute top-0 left-24 md:left-32 hidden lg:block select-none pointer-events-none -z-10 opacity-[0.03]">
                  <span className="text-[18rem] font-black leading-none text-slate-900 dark:text-white" style={{ WebkitTextStroke: '2px currentColor', color: 'transparent' }}>
                    {item.step}
                  </span>
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex-1 w-full"
                  >
                    <div className="bg-white dark:bg-[#020617] border border-slate-200 dark:border-white/10 p-10 md:p-14 rounded-[3.5rem] shadow-lab hover:border-sunset/40 transition-all duration-500 group">
                      <div className="flex items-center gap-6 mb-10">
                        <div className="p-5 bg-midnight dark:bg-white text-white dark:text-midnight rounded-2xl shadow-xl group-hover:scale-110 transition-transform">
                          {item.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-sunset mb-2">Phase {item.step}</span>
                          <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-midnight dark:text-white leading-none">{item.title}</h3>
                        </div>
                      </div>
                      
                      <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl leading-relaxed font-medium mb-10">{item.description}</p>

                      <div className="space-y-5">
                        {item.breakdown.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-5">
                             <div className="w-2.5 h-2.5 bg-electric rounded-full shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                             <span className="text-xs md:text-sm font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest leading-none">{bullet}</span>
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
                    <div className="bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-white/10 p-12 rounded-[4rem] font-mono shadow-lab relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                         <Terminal className="text-midnight dark:text-white" size={120} />
                       </div>
                       <div className="flex items-center gap-3 mb-8">
                          <span className="w-3 h-3 rounded-full bg-electric animate-pulse shadow-[0_0_15px_#3B82F6]" />
                          <span className="tracking-[0.5em] uppercase font-black text-[10px] text-slate-400 dark:text-slate-600">PIPELINE_EXECUTION_UNIT</span>
                       </div>
                       <div className="bg-white dark:bg-midnight p-10 rounded-3xl border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden whitespace-pre font-mono leading-relaxed relative z-10">
                          <code className="text-slate-600 dark:text-electric font-bold text-sm">
                            {item.codeSnippet.split('\n').map((line, i) => (
                              <div key={i} className="flex">
                                <span className="mr-6 text-slate-300 dark:text-slate-800 select-none">{String(i + 1).padStart(2, '0')}</span>
                                <span>{line}</span>
                              </div>
                            ))}
                          </code>
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
