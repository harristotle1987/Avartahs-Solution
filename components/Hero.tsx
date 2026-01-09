
import React from 'react';
import { motion } from 'framer-motion';
import AuditForm from './AuditForm';
import { SectionId } from '../types';
import { analytics } from '../lib/analytics';
import { ArrowDownRight } from 'lucide-react';
import { AuditReport } from '../lib/gemini';

interface HeroProps {
  onAuditComplete?: (report: AuditReport, url: string) => void;
}

const Hero: React.FC<HeroProps> = ({ onAuditComplete }) => {
  return (
    <div 
      onMouseEnter={() => analytics.logCTAClick('hero')}
      className="relative min-h-[85dvh] lg:min-h-[100dvh] w-full flex flex-col items-center px-4 md:px-8 lg:px-12 overflow-hidden bg-white dark:bg-[#020617] transition-colors duration-500 pb-12 lg:pb-0"
    >
      {/* Visual Background Pattern */}
      <div className="absolute inset-0 cyber-grid pointer-events-none opacity-20" />
      
      {/* Main Container: Shifted pt-32 for navbar clearance, flex-1 for center logic */}
      <div className="max-w-[1500px] mx-auto w-full z-10 relative flex-1 flex flex-col justify-start lg:justify-center pt-28 md:pt-36 lg:pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 lg:gap-16 items-start lg:items-center">
          
          {/* Main Content Pillar - Extreme Compression */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-1.5"
            >
              <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em] text-electric">
                FOR BUSINESS OWNERS TIRED OF WEBSITES THAT DON'T SELL
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-[1.85rem] sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-[900] leading-[1.05] tracking-tighter text-midnight dark:text-white mb-2 md:mb-4"
            >
              Generate <span className="text-sunset">2.5X More Leads</span> and <span className="text-sunset font-serif-italic">Scale With Confidence</span> in 10 Days Using Our Data-Driven Audit
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-xs sm:text-sm md:text-lg lg:text-xl text-slate-500 dark:text-slate-400 leading-tight font-medium mb-5 md:mb-8 max-w-2xl"
            >
              Stop losing customers to bad design. Get a logic-based audit & 2X your sales in 10 days.
            </motion.p>

            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-6 h-6 md:w-9 md:h-9 rounded-full border-2 border-white dark:border-midnight bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm">
                    <img src={`https://i.pravatar.cc/100?img=${i+25}`} alt="user" className="w-full h-full object-cover grayscale" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="text-[7px] md:text-[10px] font-black text-midnight dark:text-white leading-none">500+ AUDITS COMPLETED</div>
                <div className="text-[6px] md:text-[9px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest mt-0.5">SUCCESS RATE: 100% PRECISION</div>
              </div>
            </div>
          </div>
          
          {/* Audit Form Pillar - Perfectly Proximity-Aligned */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end mt-2 lg:mt-0">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              id={SectionId.Audit} 
              className="w-full max-w-[22rem] md:max-w-md relative"
            >
              <AuditForm onAuditComplete={onAuditComplete} />
            </motion.div>
          </div>

        </div>
      </div>

      {/* Extreme Edge Visual Elements */}
      <div className="absolute bottom-4 left-6 hidden xl:block">
        <div className="font-mono text-[8px] leading-tight text-slate-300 dark:text-slate-700 opacity-30">
          {`>> STATUS: DEPLOYED`} <br/>
          {`>> VIEWPORT: OPTIMIZED`}
        </div>
      </div>
    </div>
  );
};

export default Hero;
