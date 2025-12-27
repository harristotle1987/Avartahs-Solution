import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Menu, X, ArrowRight, Sun, Moon } from 'lucide-react';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';
import { useTheme } from '../context/ThemeContext';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Audit', to: SectionId.Hero },
    { name: 'Toolbox', to: SectionId.Services },
    { name: 'Pipeline', to: SectionId.Process },
    { name: 'Booking', to: SectionId.Booking },
  ];

  return (
    <nav className={`fixed top-0 left-0 w-full z-[100] transition-all duration-300 ${
      isScrolled 
        ? 'py-4 bg-white/90 dark:bg-[#020617]/90 backdrop-blur-md border-b border-slate-100 dark:border-white/5 shadow-sm' 
        : 'py-8 bg-transparent'
    }`}>
      <div className="max-w-[1500px] mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-midnight dark:bg-white flex items-center justify-center text-white dark:text-midnight font-black text-[10px]">A</div>
          <span className="text-xl font-black tracking-tighter uppercase text-midnight dark:text-white">AVARTAH</span>
        </div>

        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => (
            <ScrollLink
              key={link.to}
              to={link.to}
              smooth={true}
              offset={-80}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-sunset cursor-pointer transition-all"
            >
              {link.name}
            </ScrollLink>
          ))}
          
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-sunset transition-all border border-transparent dark:border-white/5"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <ScrollLink
          to={SectionId.Audit}
          smooth={true}
          offset={-80}
          className="hidden sm:flex items-center gap-2 px-6 py-2.5 bg-midnight dark:bg-white text-white dark:text-midnight rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-sunset dark:hover:bg-sunset dark:hover:text-white transition-all cursor-pointer shadow-lg"
        >
          Free Audit <ArrowRight size={14} />
        </ScrollLink>
      </div>
    </nav>
  );
};

export default Navbar;