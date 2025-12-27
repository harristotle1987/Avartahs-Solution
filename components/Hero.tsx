import React from 'react';
import { motion } from 'framer-motion';
import AuditForm from './AuditForm';
import { SectionId } from '../types';
import { analytics } from '../lib/analytics';
import { ArrowDownRight } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <div 
      onMouseEnter={() => analytics.logCTAClick('hero')}
      className="relative min-h-[500px] sm:min-h-[85vh] md:min-h-screen flex items-start sm:items-center justify-center px-4 md:px-8 pt-24 sm:pt-24 md:pt-32 lg:pt-40 pb-16 md:pb-24 overflow-hidden bg-white dark:bg-[#020617] transition-colors duration-500"
    >
      <div className="absolute inset-0 cyber-grid pointer-events-none opacity-50" />
      
      <div className="max-w-[1500px] mx-auto w-full z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 lg:gap-20 items-start sm:items-center">
          
          {/* Main Headline Pillar */}
          <div className="lg:col-span-8 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 mb-3 md:mb-6"
            >
              <div className="w-6 md:w-8 h-px bg-sunset" />
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
                DATA DRIVEN AUDIT SYSTEM // V4.2
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[4.2rem] xl:text-[5rem] font-[900] leading-[1.1] tracking-[-0.03em] text-midnight dark:text-white mb-6 md:mb-8 lg:mb-10"
            >
              From <span className="font-serif-italic text-sunset">Sketch</span> to Scale <br />
              I Build the Web <br />
              You <span className="font-serif-italic text-electric">Imagine</span>
            </motion.h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 lg:gap-12 items-start">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.4 }}
                className="order-2 md:order-1"
              >
                <p className="text-sm md:text-base lg:text-lg text-slate-500 dark:text-slate-400 leading-relaxed font-medium mb-6 md:mb-8 lg:mb-10 max-w-sm">
                  Stop losing customers to bad design. Get a logic-based audit and transform your digital presence today.
                </p>
                
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 md:border-4 border-white dark:border-midnight bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm">
                        <img src={`https://i.pravatar.cc/100?img=${i+25}`} alt="user" className="w-full h-full object-cover grayscale" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[8px] md:text-[10px] font-black text-midnight dark:text-white leading-none">500+ AUDITS</div>
                    <div className="text-[7px] md:text-[8px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest mt-1">SUCCESS RATE 100%</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                id={SectionId.Audit} 
                className="scroll-mt-32 w-full order-1 md:order-2"
              >
                <div className="relative">
                  <div className="absolute -top-6 -left-6 md:-top-8 md:-left-8 opacity-10 pointer-events-none dark:opacity-5">
                    <ArrowDownRight size={60} className="text-midnight dark:text-white md:w-[80px] md:h-[80px]" />
                  </div>
                  <AuditForm />
                </div>
              </motion.div>
            </div>
          </div>
          
          {/* Status Sidebar (Hidden on mobile/tablet until lg) */}
          <div className="hidden lg:col-span-4 lg:flex flex-col justify-start border-l border-slate-100 dark:border-white/5 pl-12 h-full py-10">
            <div className="space-y-12">
               <motion.div 
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 0.6 }}
               >
                 <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-300 dark:text-slate-700 mb-3 block">Node Protocol</span>
                 <div className="text-xl font-black text-midnight dark:text-white">$1.2M+ Recovered</div>
                 <div className="text-[8px] font-bold text-electric uppercase tracking-widest mt-2">STATUS: AGGREGATING...</div>
               </motion.div>

               <motion.div 
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 0.7 }}
               >
                 <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-300 dark:text-slate-700 mb-3 block">Efficiency Rating</span>
                 <div className="text-xl font-black text-midnight dark:text-white">98.4% Precision</div>
                 <div className="text-[8px] font-bold text-sunset uppercase tracking-widest mt-2">SYSTEM: OPTIMIZED</div>
               </motion.div>

               <div className="pt-10 border-t border-slate-100 dark:border-white/5">
                 <div className="font-mono text-[9px] leading-loose text-slate-300 dark:text-slate-700">
                    {`>> SYSTEM_INITIALIZED`} <br/>
                    {`>> ANALYZING_PIPELINE`} <br/>
                    {`>> OPTIMIZING_LOADS`} <br/>
                    {`>> STATUS: READY`}
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;