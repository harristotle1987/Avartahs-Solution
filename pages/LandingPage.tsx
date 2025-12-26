import React, { useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link as ScrollLink } from 'react-scroll';
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
import { TechBackground } from '../components/Visuals';
import { SectionId } from '../types';
import { Star } from 'lucide-react';
import { analytics } from '../lib/analytics';

const KineticShortcuts: React.FC = () => {
  const shortcuts = [
    { label: 'A', to: SectionId.Hero, title: 'Audit entry' },
    { label: 'S', to: SectionId.Services, title: 'Service logic' },
    { label: 'P', to: SectionId.Process, title: 'The pipeline' },
    { label: 'B', to: SectionId.Booking, title: 'Secure booking' },
  ];

  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[60] hidden xl:flex flex-col gap-6">
      {shortcuts.map((s, i) => (
        <ScrollLink
          key={s.label}
          to={s.to}
          smooth={true}
          offset={-100}
          className="group relative flex items-center"
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 + (i * 0.1) }}
            whileHover={{ 
              scale: 1.25, 
              rotate: 360,
              backgroundColor: '#F97316',
              color: '#FFFFFF'
            }}
            className="w-12 h-12 bg-white dark:bg-[#1e293b]/60 backdrop-blur-md border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-center font-black text-xs text-slate-900 dark:text-gray-100 shadow-premium cursor-pointer transition-all duration-500"
          >
            {s.label}
          </motion.div>
          <span className="absolute left-16 px-4 py-2 bg-slate-900 dark:bg-gray-100 text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-[0.3em] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-15px] group-hover:translate-x-0 whitespace-nowrap shadow-xl">
            {s.title}
          </span>
        </ScrollLink>
      ))}
    </div>
  );
};

const BackgroundGlyphs: React.FC = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 2000], [0, -100]);
  const y2 = useTransform(scrollY, [0, 2000], [0, 100]);
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none hidden md:block">
      <motion.span style={{ y: y1 }} className="absolute top-[15%] left-[5%] text-[15rem] font-black text-slate-400/5 dark:text-white/5 -rotate-12">A</motion.span>
      <motion.span style={{ y: y2 }} className="absolute top-[45%] right-[2%] text-[12rem] font-black text-slate-400/5 dark:text-white/5 rotate-6">V</motion.span>
    </div>
  );
};

const LandingPage: React.FC = () => {
  useEffect(() => {
    analytics.init();
    
    const handleExit = () => analytics.flush();
    window.addEventListener('pagehide', handleExit);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleExit();
    });

    return () => {
      window.removeEventListener('pagehide', handleExit);
    };
  }, []);

  return (
    <div className="relative bg-white dark:bg-[#020617] text-slate-900 dark:text-gray-100 overflow-x-hidden transition-colors duration-300">
      <Navbar />
      <KineticShortcuts />
      <BackgroundGlyphs />
      
      <main className="relative z-10">
        <section id={SectionId.Hero}>
          <Hero />
        </section>

        <section id={SectionId.Services} className="py-12 md:py-16 px-6 bg-white dark:bg-[#020617]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start mb-10 md:mb-12">
              <div className="lg:w-1/2">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 bg-electric rounded-full animate-ping" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Technical Solution Suite</p>
                </div>
                <h2 className="text-4xl md:text-7xl lg:text-[7rem] font-[900] tracking-tighter uppercase leading-[0.85] mb-8 text-slate-900 dark:text-gray-100">
                  Logic over <br/>
                  <span className="text-electric italic">Varnish</span>
                </h2>
                <p className="text-slate-600 dark:text-gray-400 text-lg md:text-2xl leading-tight font-medium mb-8 max-w-xl">
                  Rebuilds from <span className="text-slate-900 dark:text-gray-100 font-black">$300</span> to scale-tier <span className="text-slate-900 dark:text-gray-100 font-black">$10,000+</span> custom ecosystems.
                </p>
              </div>
              <div className="lg:w-1/2 flex lg:justify-end">
                <div className="max-w-md lg:text-right">
                  <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-300 dark:text-slate-600 mb-4 md:mb-6">Commitment to Efficiency</p>
                  <p className="text-slate-500 dark:text-gray-400 font-medium italic text-base">"Avartah replaces creative guesswork with engineered revenue systems that typical agencies cannot replicate."</p>
                </div>
              </div>
            </div>
            <Services />
          </div>
        </section>

        <section id={SectionId.Process} className="py-12 md:py-16 px-6 bg-gray-50 dark:bg-[#1e293b]/60 backdrop-blur-md border-y border-slate-100 dark:border-white/5 transition-colors duration-500">
          <div className="max-w-7xl mx-auto">
            <div className="text-left md:text-center mb-10 md:mb-16">
               <h2 className="text-5xl md:text-8xl lg:text-[8rem] font-[900] tracking-tighter uppercase mb-4 leading-[0.8] text-slate-900 dark:text-gray-100">The <span className="text-sunset italic">Pipeline</span></h2>
               <p className="text-slate-500 dark:text-gray-400 text-base md:text-2xl font-medium tracking-tight">Engineering results in exactly 10 business days.</p>
            </div>
            <Process />
          </div>
        </section>

        <TechMarquee />

        <section className="py-12 md:py-16 px-6 bg-white dark:bg-[#020617]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-16">
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 dark:text-slate-700 mb-6 block">Proof of Performance</span>
               <h2 className="text-5xl md:text-8xl lg:text-[8rem] font-[900] tracking-tighter uppercase mb-8 leading-[0.85] text-slate-900 dark:text-gray-100">
                 Proven <br/>
                 <span className="text-sunset italic">Architecture</span>
               </h2>
               <p className="text-slate-500 dark:text-gray-400 text-lg md:text-2xl font-medium max-w-2xl mx-auto">A forensic look at recent high-conversion rebuilds for global partners.</p>
            </div>
            <Portfolio />
          </div>
        </section>

        <section className="py-12 md:py-16 px-6 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#020617]">
           <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16">
             <div className="order-2 lg:order-1">
                <h2 className="text-4xl md:text-6xl font-[900] tracking-tighter uppercase leading-[0.9] mb-12 text-slate-900 dark:text-gray-100">Verified <br/><span className="text-electric italic">Outcomes</span></h2>
                <Reviews />
             </div>
             <div className="order-1 lg:order-2">
                <h2 className="text-4xl md:text-6xl font-[900] tracking-tighter uppercase leading-[0.9] mb-12 text-slate-900 dark:text-gray-100">Common <br/><span className="text-sunset italic">Queries</span></h2>
                <FAQ />
             </div>
           </div>
        </section>

        <section id={SectionId.Booking} className="relative py-12 md:py-16 px-6 bg-blue-50 dark:bg-[#172554] transition-colors duration-500 overflow-hidden">
           <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none">
              <TechBackground />
           </div>
           
           <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="text-left">
                  <div className="flex items-center gap-1 mb-8">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={18} className="fill-sunset text-sunset" />
                    ))}
                    <span className="ml-2 text-slate-900 dark:text-gray-100 font-bold text-sm tracking-tight">4.9/5 Customer Ratings</span>
                  </div>

                  <h2 className="text-4xl md:text-7xl font-[900] tracking-tighter uppercase text-slate-900 dark:text-gray-100 mb-8 leading-[0.9]">
                    Get up to <span className="text-sunset">3X more leads</span>
                  </h2>
                  
                  <p className="text-slate-600 dark:text-gray-400 text-base md:text-xl font-medium mb-12 max-w-xl leading-relaxed">
                    Turn your landing page into a 24/7 sales machine. Rebuild projects start at $300 and scale to $10,000 for full enterprise infrastructure.
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 pt-8 border-t border-slate-200 dark:border-white/10">
                    <div>
                      <div className="text-3xl md:text-4xl font-black text-slate-900 dark:text-gray-100 mb-1 tracking-tighter">64%</div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 leading-tight">Average Increase</p>
                    </div>
                    <div>
                      <div className="text-3xl md:text-4xl font-black text-slate-900 dark:text-gray-100 mb-1 tracking-tighter">400+</div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 leading-tight">Pages built</p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <div className="text-3xl md:text-4xl font-black text-slate-900 dark:text-gray-100 mb-1 tracking-tighter">98%</div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 leading-tight">Retention rate</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center lg:justify-end">
                   <div className="w-full max-w-lg">
                      <BookingCalendar />
                   </div>
                </div>
              </div>
           </div>
        </section>

        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;