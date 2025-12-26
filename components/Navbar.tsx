import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon, ArrowRight, ShieldCheck, MessageSquare } from 'lucide-react';
import { Link as ScrollLink, animateScroll as scroll } from 'react-scroll';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { SectionId } from '../types';
import { analytics } from '../lib/analytics';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
      }}
      className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-400 hover:text-sunset hover:border-sunset/30 transition-all shadow-sm flex items-center justify-center min-w-[42px] min-h-[42px] relative z-[150]"
      aria-label="Toggle Theme"
    >
      <AnimatePresence mode="wait">
        {theme === 'light' ? (
          <motion.div
            key="sun"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
          >
            <Sun size={18} />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
          >
            <Moon size={18} />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogoClick = () => {
    scroll.scrollToTop({ duration: 800 });
    if (window.location.hash !== '#/' && window.location.pathname !== '/') {
      navigate('/');
    }
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { name: 'AUDIT ENTRY', to: SectionId.Hero },
    { name: 'SERVICE LOGIC', to: SectionId.Services },
    { name: 'THE PIPELINE', to: SectionId.Process },
    { name: 'SECURE BOOKING', to: SectionId.Booking },
  ];

  const whatsappUrl = "https://wa.me/2347039723596?text=I'm%20interested%20in%20an%20immediate%20discussion%20about%20website%20conversion%20optimization.";

  return (
    <nav className={`fixed top-0 left-0 w-full z-[120] transition-all duration-300 ${
      isScrolled 
        ? 'py-4 bg-white/90 dark:bg-[#020617]/90 backdrop-blur-md border-b border-slate-100 dark:border-white/5 shadow-lab' 
        : 'py-6 bg-transparent'
    }`}>
      <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between relative z-[130]">
        <div className="flex items-center gap-2 cursor-pointer group shrink-0" onClick={handleLogoClick}>
          <span className="text-xl font-[900] tracking-[-0.08em] uppercase text-slate-900 dark:text-white transition-all">
            AVARTAH
          </span>
          <div className="w-2 h-2 bg-sunset rounded-full group-hover:animate-ping" />
        </div>

        {/* Desktop & Tablet Links (Visible from md breakpoint upwards) */}
        <div className="hidden md:flex items-center gap-4 xl:gap-10 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((link) => (
            <ScrollLink
              key={link.to}
              to={link.to}
              smooth={true}
              offset={-80}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 hover:text-sunset dark:hover:text-white cursor-pointer transition-all whitespace-nowrap"
            >
              {link.name}
            </ScrollLink>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle />
          
          <div className="hidden sm:flex items-center gap-3">
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.logCTAClick('navbar')}
              className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-400 hover:text-sunset hover:border-sunset/30 transition-all shadow-sm flex items-center justify-center min-w-[42px] min-h-[42px]"
              aria-label="Contact via WhatsApp"
            >
              <MessageSquare size={18} />
            </a>

            <ScrollLink
              to={SectionId.Audit}
              smooth={true}
              offset={-80}
              onClick={() => analytics.logCTAClick('navbar')}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-midnight rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-sunset dark:hover:bg-sunset dark:hover:text-white transition-all shadow-lg cursor-pointer whitespace-nowrap"
            >
              Get Free Audit <ArrowRight size={14} />
            </ScrollLink>
          </div>

          {/* Mobile Menu Toggle (Visible ONLY on mobile, hidden from md breakpoint upwards) */}
          <button 
            className="md:hidden p-2 text-slate-900 dark:text-white bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 transition-all ml-1"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 w-screen h-screen md:hidden bg-white dark:bg-[#020617] z-[125] flex flex-col pt-24 pb-12 px-8"
          >
            <div className="flex flex-col items-center justify-center space-y-8 flex-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Laboratory Directory</span>
              {navLinks.map((link) => (
                <ScrollLink
                  key={link.to}
                  to={link.to}
                  smooth={true}
                  offset={-80}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white hover:text-sunset transition-colors"
                >
                  {link.name}
                </ScrollLink>
              ))}
              <div className="w-full max-w-xs pt-8 flex flex-col gap-4">
                <ScrollLink
                  to={SectionId.Audit}
                  smooth={true}
                  offset={-80}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full py-4 bg-sunset text-white rounded-xl font-black text-center text-xs uppercase tracking-widest"
                >
                  GET FREE AUDIT
                </ScrollLink>
                <a href={whatsappUrl} className="w-full py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl font-black text-center text-xs uppercase tracking-widest">
                  WHATSAPP CONTACT
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;