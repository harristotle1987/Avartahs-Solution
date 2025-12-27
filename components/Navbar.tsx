import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Sun, Moon, MessageCircle } from 'lucide-react';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';
import { useTheme } from '../context/ThemeContext';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  const closeMenu = () => setIsMobileMenuOpen(false);

  const whatsappUrl = "https://wa.me/2347039723596";

  return (
    <nav className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 ${
      isScrolled 
        ? 'py-3 bg-slate-950/95 backdrop-blur-xl border-b border-white/5 shadow-2xl' 
        : 'py-6 bg-slate-950/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none'
    }`}>
      <div className="max-w-[1500px] mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="w-8 h-8 rounded-lg bg-sunset flex items-center justify-center text-white font-black text-[10px] shadow-[0_0_15px_rgba(249,115,22,0.3)] group-hover:scale-110 transition-transform">A</div>
          <span className="text-xl font-black tracking-tighter uppercase text-white group-hover:text-sunset transition-colors">AVARTAH</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <ScrollLink
              key={link.to}
              to={link.to}
              smooth={true}
              offset={-80}
              className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-white cursor-pointer transition-all"
            >
              {link.name}
            </ScrollLink>
          ))}
          
          <div className="w-px h-4 bg-white/10 mx-1" />

          <div className="flex items-center gap-3">
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-[#25D366] transition-all border border-white/5"
              aria-label="WhatsApp Contact"
            >
              <MessageCircle size={16} />
            </a>

            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-sunset transition-all border border-white/5"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>

          <ScrollLink
            to={SectionId.Audit}
            smooth={true}
            offset={-80}
            className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-sunset hover:text-white transition-all cursor-pointer shadow-lg shadow-white/5"
          >
            Free Audit <ArrowRight size={14} />
          </ScrollLink>
        </div>

        {/* Mobile Toggle Group */}
        <div className="flex md:hidden items-center gap-3">
          <a 
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-white/5 text-slate-400 border border-white/5"
          >
            <MessageCircle size={18} />
          </a>

          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-white/5 text-slate-400 border border-white/5"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-white hover:text-sunset transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-slate-950 border-t border-white/5 overflow-hidden"
          >
            <div className="px-6 py-8 flex flex-col gap-6">
              {navLinks.map((link) => (
                <ScrollLink
                  key={link.to}
                  to={link.to}
                  smooth={true}
                  offset={-80}
                  onClick={closeMenu}
                  className="text-lg font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-all"
                >
                  {link.name}
                </ScrollLink>
              ))}
              <div className="pt-6 border-t border-white/5 space-y-4">
                <ScrollLink
                  to={SectionId.Audit}
                  smooth={true}
                  offset={-80}
                  onClick={closeMenu}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  Free Audit <ArrowRight size={16} />
                </ScrollLink>
                <a 
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-3 py-4 bg-[#25D366] text-white rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  WhatsApp Bridge <MessageCircle size={16} />
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