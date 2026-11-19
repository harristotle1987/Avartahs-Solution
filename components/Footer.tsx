import React from 'react';
import { Link } from 'react-router-dom';
import { SectionId } from '../types';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { isAdmin } = useAuth();

  const navLinks = [
    { name: 'Services', to: `/#${SectionId.Services}` },
    { name: 'Solutions', to: `/#${SectionId.Solutions}` },
    { name: 'Our Work', to: `/#${SectionId.Work}` },
    { name: 'Process', to: `/#${SectionId.Process}` },
    { name: 'Insights', to: `/#${SectionId.Insights}` },
    { name: 'Website Audit', to: `/#${SectionId.Audit}` },
    { name: 'Contact', to: `/#${SectionId.Booking}` },
  ];

  const workspaceLinks = [
    { name: 'Service Catalogue', to: '/services' },
    { name: 'Avartah Business OS', to: '/business-os' },
    { name: 'Client Delivery Hub', to: '/client/projects' },
    { name: 'Research & Articles', to: '/blog' },
    ...(isAdmin ? [{ name: 'Admin Console', to: '/admin/dashboard' }] : []),
  ];

  return (
    <footer className="bg-white dark:bg-[#111315] border-t border-slate-200 dark:border-[#30363B] text-slate-600 dark:text-[#A3A9AF] text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 mb-12">
          {/* Brand & Direct Contact */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-[#111315] dark:bg-[#171A1D] border border-slate-300 dark:border-[#30363B] flex items-center justify-center text-[#C58A52] font-bold text-sm">
                A
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold tracking-[0.14em] text-slate-900 dark:text-[#F2F1ED]">
                  AVARTAH
                </span>
                <span className="text-[9px] font-medium tracking-[0.26em] text-slate-500 dark:text-[#A3A9AF] uppercase mt-0.5">
                  SOLUTIONS
                </span>
              </div>
            </div>

            <p className="text-slate-600 dark:text-[#A3A9AF] text-sm leading-relaxed max-w-sm">
              Custom web platforms, business software, and customer acquisition systems built for sustainable business growth.
            </p>

            <div className="pt-1 flex flex-col gap-1.5 text-xs text-slate-500 dark:text-[#747C84]">
              <div>
                Direct email:{' '}
                <a
                  href="mailto:harristotle84@gmail.com"
                  className="text-slate-900 dark:text-[#F2F1ED] hover:text-[#C58A52] underline underline-offset-4 transition-colors"
                >
                  harristotle84@gmail.com
                </a>
              </div>
              <div>
                <a
                  href="https://wa.me/2347039723596"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#C58A52] hover:underline font-medium"
                >
                  <span>WhatsApp Direct Desk</span>
                  <ArrowUpRight size={12} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          {/* Landing Sections */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] tracking-wider uppercase">
              Navigation
            </h3>
            <ul className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.to}
                    className="hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platforms & Portals */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] tracking-wider uppercase">
              Platforms & Portals
            </h3>
            <ul className="space-y-2.5">
              {workspaceLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.to}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
                  >
                    <span>{link.name}</span>
                    <ArrowUpRight size={12} className="opacity-60" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="pt-6 border-t border-slate-200 dark:border-[#30363B] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-[#747C84]">
          <p>© {currentYear} Avartah Solutions. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;