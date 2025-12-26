import React, { useState, useEffect } from 'react';
import { Mail, Linkedin, Twitter, ArrowUpRight, ShieldCheck, Globe, Zap, HardDrive, MessageSquare } from 'lucide-react';
import { Link as ScrollLink } from 'react-scroll';
import { Link } from 'react-router-dom';
import { SectionId } from '../types';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navLinks = [
    { name: 'Audit Entry', to: SectionId.Hero },
    { name: 'Service Logic', to: SectionId.Services },
    { name: 'The Pipeline', to: SectionId.Process },
    { name: 'Secure Booking', to: SectionId.Booking },
  ];

  const socialLinks = [
    { Icon: Twitter, href: "https://twitter.com/harrisonoyeghe", label: "Twitter" },
    { Icon: Linkedin, href: "https://www.linkedin.com/in/harrison-oyeghe-aaa0001a9", label: "LinkedIn" },
    { Icon: Mail, href: "mailto:harristotle84@gmail.com", label: "Email" },
    { Icon: MessageSquare, href: "https://wa.me/2347039723596", label: "WhatsApp" },
  ];

  return (
    <footer className="pt-24 pb-8 px-6 md:px-12 lg:px-24 bg-black border-t border-white/5 overflow-hidden relative font-sans text-slate-400">
      {/* Background visual element */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-sunset/50 to-transparent opacity-20" />
      
      <div className="max-w-[1450px] mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 mb-20">
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-3xl font-[900] tracking-[-0.08em] text-white uppercase">AVARTAH</span>
              <div className="px-2 py-0.5 bg-sunset/10 border border-sunset/20 rounded text-[8px] font-black text-sunset uppercase tracking-widest">LAB_v4.2</div>
            </div>
            <p className="text-slate-400 text-lg md:text-xl font-medium leading-tight mb-10 max-w-lg">Engineering high-conversion revenue systems through technical precision and behavioral science protocols.</p>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((social, i) => (
                <a 
                  key={i} 
                  href={social.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white hover:bg-sunset hover:border-sunset transition-all shadow-sm group"
                >
                  <social.Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 border-l border-white/5 pl-8">
            <h4 className="font-black text-[9px] uppercase tracking-[0.4em] text-slate-600 mb-8">Navigation</h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {navLinks.map((link, lIdx) => (
                <li key={lIdx}>
                  <ScrollLink 
                    to={link.to} 
                    smooth={true} 
                    className="text-slate-400 hover:text-sunset transition-all cursor-pointer text-[10px] font-black uppercase tracking-widest flex items-center justify-between group"
                  >
                    {link.name} <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-all text-sunset" />
                  </ScrollLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-10 border-y border-white/5 mb-10">
          {[
            { icon: <ShieldCheck size={14} className="text-electric" />, label: 'Security', value: 'LAB_ENCRYPTED' },
            { icon: <Zap size={14} className="text-sunset" />, label: 'Speed', value: 'SUB-SECOND_EDGE' },
            { icon: <HardDrive size={14} className="text-slate-400" />, label: 'Architecture', value: 'REACT_V19' },
            { icon: <Globe size={14} className="text-slate-400" />, label: 'Feed', value: time }
          ].map((item, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">{item.label}</span>
              </div>
              <p className="text-[10px] font-black text-white">{item.value}</p>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center text-slate-600 text-[8px] font-black tracking-[0.4em] uppercase gap-6 py-4">
          <p>© {currentYear} AVARTAH SOLUTIONS. ALL PROTOCOLS RESERVED.</p>
          <div className="flex gap-10">
            <Link to="/privacy" className="hover:text-sunset transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-sunset transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;