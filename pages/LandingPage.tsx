
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Services from '../components/Services';
import Process from '../components/Process';
import Portfolio from '../components/Portfolio';
import FinalCTA from '../components/FinalCTA';
import Footer from '../components/Footer';
import FAQ from '../components/FAQ';
import Reviews from '../components/Reviews';
import BookingCalendar from '../components/BookingCalendar';
import TechMarquee from '../components/TechMarquee';
import { SectionId } from '../types';
import { Star, ArrowRight, Zap, Target, BarChart3, Users } from 'lucide-react';
import { analytics } from '../lib/analytics';

const StatsBar: React.FC = () => {
  const stats = [
    { label: 'PROJECTS COMPLETED', value: '10+', icon: <Zap size={14} className="text-sunset" /> },
    { label: 'YEARS OF EXPERIENCE', value: '3+', icon: <Target size={14} className="text-electric" /> },
    { label: 'ACTIVE CLIENTS', value: '17+', icon: <Users size={14} className="text-sunset" /> },
    { label: 'PLATFORM USERS', value: '10K+', icon: <BarChart3 size={14} className="text-electric" /> },
  ];

  return (
    <div className="py-8 md:py-10 lg:py-12 border-y border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.01]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {stats.map((s, i) => (
          <div key={i} className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="flex items-center gap-2 mb-2">
              {s.icon}
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">{s.label}</span>
            </div>
            <div className="text-2xl md:text-3xl lg:text-4xl font-black text-midnight dark:text-white tracking-tighter">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LandingPage: React.FC = () => {
  useEffect(() => {
    analytics.init();
    const handleExit = () => analytics.flush();
    window.addEventListener('pagehide', handleExit);
    return () => window.removeEventListener('pagehide', handleExit);
  }, []);

  const handleAuditComplete = () => {
    // Scroll lock removed as we are no longer showing the document overlay
    console.log("Handshake Complete: User data saved to protocol.");
  };

  return (
    <div className="relative bg-white dark:bg-[#020617] text-midnight dark:text-gray-100 transition-colors duration-500 overflow-x-hidden">
      <Navbar />
      
      <main className="relative z-10">
        <section id={SectionId.Hero}>
          <Hero onAuditComplete={handleAuditComplete} />
        </section>

        <StatsBar />

        <section id={SectionId.Services} className="py-16 md:py-20 lg:py-24 px-6 bg-white dark:bg-[#020617]">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12 md:mb-16 lg:mb-20 text-center">
              <span className="text-[10px] font-black text-sunset uppercase tracking-[0.4em] mb-4 block">Skills & Tech Stack</span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight uppercase text-midnight dark:text-white">
                My Tech <span className="font-serif-italic text-sunset">Toolbox</span>
              </h2>
            </div>
            <Services />
          </div>
        </section>

        <TechMarquee />

        <section id={SectionId.Process} className="py-16 md:py-20 lg:py-24 px-6 bg-slate-50/50 dark:bg-white/[0.02] border-y border-slate-100 dark:border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 md:mb-20 lg:mb-24">
               <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase mb-6 leading-[0.8] text-midnight dark:text-white">The <span className="text-sunset italic">Pipeline</span></h2>
               <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg lg:text-xl font-medium tracking-tight">Rapid deployment from discovery to launch.</p>
            </div>
            <Process />
          </div>
        </section>

        <section className="py-16 md:py-20 lg:py-24 px-6 bg-white dark:bg-[#020617]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-16 lg:mb-20">
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 dark:text-slate-700 mb-6 block">Featured Projects</span>
               <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase mb-6 md:mb-8 leading-[1.1] text-midnight dark:text-white">
                 Design Brands That <br/>
                 <span className="text-sunset font-serif-italic">Speak</span> To Audiences
               </h2>
               <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base lg:text-lg font-medium max-w-2xl mx-auto leading-relaxed">High-conversion rebuilds for modern business partners.</p>
            </div>
            <Portfolio />
          </div>
        </section>

        <section className="py-16 md:py-20 lg:py-24 px-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.01]">
           <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-20 lg:gap-24 items-start">
             <div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter uppercase leading-[0.9] mb-12 md:mb-16 text-midnight dark:text-white">What <br/><span className="text-sunset italic">Clients Say</span></h2>
                <Reviews />
             </div>
             <div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter uppercase leading-[0.9] mb-12 md:mb-16 text-midnight dark:text-white">Common <br/><span className="text-electric italic">Questions</span></h2>
                <FAQ />
             </div>
           </div>
        </section>

        <section id={SectionId.Booking} className="relative py-16 md:py-20 lg:py-24 px-6 bg-white dark:bg-[#020617] overflow-hidden border-t border-slate-100 dark:border-white/5">
           <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 items-center">
                <div className="text-left">
                  <div className="flex items-center gap-1 mb-6 md:mb-8">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={14} className="fill-sunset text-sunset" />
                    ))}
                    <span className="ml-3 text-midnight dark:text-white font-black text-[10px] uppercase tracking-widest">VERIFIED 5-STAR RATING</span>
                  </div>

                  <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase text-midnight dark:text-white mb-6 md:mb-8 leading-[0.9]">
                    Let's Build <br/><span className="text-sunset italic">Something Amazing</span>
                  </h2>
                  
                  <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg font-medium mb-10 md:mb-12 max-w-lg leading-relaxed">
                    Have a project, idea, or collaboration in mind? I'd love to hear from you. Let's create something impactful together.
                  </p>

                  <button className="flex items-center gap-3 px-8 py-4 bg-midnight dark:bg-white text-white dark:text-midnight rounded-xl font-black text-xs uppercase tracking-widest hover:bg-sunset dark:hover:bg-sunset dark:hover:text-white transition-all">
                    Get In Touch <ArrowRight size={16} />
                  </button>
                </div>

                <div className="flex justify-center lg:justify-end">
                   <BookingCalendar />
                </div>
              </div>
           </div>
        </section>

        <FinalCTA onAuditComplete={handleAuditComplete} />
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
