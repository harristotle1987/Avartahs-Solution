import React from 'react';
import { motion } from 'framer-motion';
import AuditForm from './AuditForm';
import { SectionId } from '../types';
import { analytics } from '../lib/analytics';

const DataStream: React.FC = () => {
  return (
    <div className="relative w-full h-[400px] lg:h-[500px] overflow-hidden rounded-[3rem] bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 shadow-lab group">
      <div className="absolute inset-0 cyber-grid opacity-50 dark:opacity-20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center p-8">
          <div className="relative w-full h-full border border-electric/10 rounded-3xl flex items-center justify-center overflow-hidden">
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -200, opacity: 0 }}
                animate={{ 
                  y: [0, 600], 
                  opacity: [0, 0.4, 0],
                  transition: { 
                    duration: 1.5 + Math.random() * 4, 
                    repeat: Infinity, 
                    delay: Math.random() * 3,
                    ease: "linear"
                  }
                }}
                className="absolute w-[1px] bg-gradient-to-b from-transparent via-electric/30 to-transparent"
                style={{ left: `${(i + 1) * 6}%`, height: '200px' }}
              />
            ))}
            
            <div className="relative z-10">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                className="w-44 h-44 border border-dashed border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center relative"
              >
                <div className="absolute inset-0 bg-sunset/5 blur-3xl rounded-full" />
                <div className="w-32 h-32 border border-electric/10 rounded-full flex items-center justify-center">
                   <div className="w-20 h-20 border border-slate-100 dark:border-white/10 rounded-full bg-white dark:bg-slate-900/40 backdrop-blur-md flex items-center justify-center shadow-sm">
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-3 h-3 bg-sunset rounded-full" 
                      />
                   </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Hero: React.FC = () => {
  return (
    <div 
      onMouseEnter={() => analytics.logCTAClick('hero')}
      className="relative pt-16 md:pt-24 pb-12 md:pb-20 px-6 flex items-center justify-center bg-transparent overflow-hidden"
    >
      <div className="max-w-[1600px] mx-auto w-full z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="text-left flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 mb-4 font-mono text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-electric"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sunset opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sunset"></span>
              </span>
              FOR BUSINESS OWNERS TIRED OF WEBSITES THAT DON'T SELL
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-5xl lg:text-[58px] xl:text-[72px] font-[900] leading-[1.05] text-midnight dark:text-white uppercase tracking-tighter mb-6"
            >
              Generate <span className="text-sunset">2.5X More Leads</span> <br className="hidden xl:block" />
              and Scale With <span className="text-sunset italic">Confidence</span> in <span className="text-midnight dark:text-white">10 Days</span> <br className="hidden xl:block" />
              Using Our <span className="text-midnight dark:text-white">Data-Driven Audit</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="text-base md:text-xl text-[#94A3B8] max-w-xl leading-relaxed font-medium mb-8"
            >
              Stop losing customers to bad design. Get a logic-based audit & 2X your sales in 10 days.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              id={SectionId.Audit} 
              className="scroll-mt-32 w-full"
            >
              <AuditForm />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="hidden lg:block w-full"
          >
            <DataStream />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Hero;