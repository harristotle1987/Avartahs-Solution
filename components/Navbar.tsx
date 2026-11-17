import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Moon,
  Sun,
  UserCircle,
  LogOut,
  LayoutDashboard,
  Shield,
  Menu,
  X,
  ArrowRight,
  ArrowUpRight,
} from 'lucide-react';
import { SectionId } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  name: string;
  to: SectionId;
}

const NAV_LINKS: NavItem[] = [
  { name: 'Services', to: SectionId.Services },
  { name: 'Solutions', to: SectionId.Solutions },
  { name: 'Our Work', to: SectionId.Work },
  { name: 'Process', to: SectionId.Process },
  { name: 'Insights', to: SectionId.Insights },
  { name: 'Contact', to: SectionId.Booking },
];

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, isAdmin, user, openLogin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll, { passive: true });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [location.pathname, location.hash]);

  const scrollToSection = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
    if (!isHome) {
      navigate(`/#${sectionId}`);
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-colors duration-200 border-b ${
        isScrolled
          ? 'bg-white/95 dark:bg-[#111315]/95 backdrop-blur-md border-slate-200 dark:border-[#30363B]'
          : 'bg-white/85 dark:bg-[#111315]/85 backdrop-blur-md border-slate-200/70 dark:border-[#30363B]/60'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <RouterLink
          to="/"
          className="flex items-center gap-2.5 shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
          onClick={() => {
            if (isHome) {
              window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
            }
          }}
        >
          <div className="w-8 h-8 rounded-md bg-[#111315] dark:bg-[#171A1D] border border-slate-300 dark:border-[#30363B] flex items-center justify-center text-[#C58A52] font-bold text-sm tracking-tight">
            A
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-[0.14em] text-slate-900 dark:text-[#F2F1ED] whitespace-nowrap">
              AVARTAH
            </span>
            <span className="text-[9px] font-medium tracking-[0.26em] text-slate-500 dark:text-[#A3A9AF] uppercase mt-0.5 whitespace-nowrap">
              SOLUTIONS
            </span>
          </div>
        </RouterLink>

        {/* Desktop Navigation (lg+ prevents overlap at 768px tablet) */}
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-6 xl:gap-7">
          {NAV_LINKS.map((link) => (
            <button
              key={link.to + link.name}
              type="button"
              onClick={() => scrollToSection(link.to)}
              className="text-xs font-medium text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors whitespace-nowrap shrink-0 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
            >
              {link.name}
            </button>
          ))}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] hover:bg-slate-100 dark:hover:bg-[#171A1D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                aria-expanded={isDropdownOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 dark:border-[#30363B] bg-slate-50 dark:bg-[#171A1D] text-slate-800 dark:text-[#F2F1ED] text-xs font-medium hover:border-[#C58A52] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
              >
                <UserCircle size={15} className="text-[#C58A52] shrink-0" />
                <span className="hidden sm:inline max-w-[120px] truncate">{user?.email || 'Account'}</span>
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    role="menu"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 rounded-lg bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] shadow-xl py-1.5 z-50 text-xs"
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-[#30363B] text-[11px] text-slate-500 dark:text-[#747C84]">
                      Signed in as
                      <div className="font-semibold text-slate-900 dark:text-[#F2F1ED] truncate mt-0.5">
                        {user?.email}
                      </div>
                    </div>

                    {isAdmin ? (
                      <>
                        <RouterLink
                          to="/admin/dashboard"
                          onClick={() => setIsDropdownOpen(false)}
                          role="menuitem"
                          className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-[#A3A9AF] hover:bg-slate-100 dark:hover:bg-[#202428] hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
                        >
                          <LayoutDashboard size={14} className="text-[#C58A52]" />
                          <span>Admin Console</span>
                        </RouterLink>
                        <RouterLink
                          to="/jobs"
                          onClick={() => setIsDropdownOpen(false)}
                          role="menuitem"
                          className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-[#A3A9AF] hover:bg-slate-100 dark:hover:bg-[#202428] hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
                        >
                          <Shield size={14} className="text-[#C58A52]" />
                          <span>Job Intelligence</span>
                        </RouterLink>
                      </>
                    ) : (
                      <RouterLink
                        to="/client/projects"
                        onClick={() => setIsDropdownOpen(false)}
                        role="menuitem"
                        className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-[#A3A9AF] hover:bg-slate-100 dark:hover:bg-[#202428] hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
                      >
                        <LayoutDashboard size={14} className="text-[#C58A52]" />
                        <span>Client Delivery Hub</span>
                      </RouterLink>
                    )}

                    <RouterLink
                      to="/business-os"
                      onClick={() => setIsDropdownOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-[#A3A9AF] hover:bg-slate-100 dark:hover:bg-[#202428] hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
                    >
                      <ArrowUpRight size={14} />
                      <span>Business OS</span>
                    </RouterLink>

                    <RouterLink
                      to="/blog"
                      onClick={() => setIsDropdownOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-[#A3A9AF] hover:bg-slate-100 dark:hover:bg-[#202428] hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
                    >
                      <ArrowUpRight size={14} />
                      <span>Research & Articles</span>
                    </RouterLink>

                    <div className="border-t border-slate-100 dark:border-[#30363B] my-1" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      role="menuitem"
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 text-left transition-colors"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openLogin()}
              className="hidden sm:inline-flex items-center h-9 px-3 rounded-md text-xs font-medium text-slate-700 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => scrollToSection(SectionId.Booking)}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-md transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111315]"
          >
            <span>Book a Consultation</span>
            <ArrowRight size={13} aria-hidden="true" />
          </button>

          {/* Mobile & Tablet Menu Button (<1024px) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-md text-slate-700 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] hover:bg-slate-100 dark:hover:bg-[#171A1D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-navigation-drawer"
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] overflow-hidden"
          >
            <nav aria-label="Mobile navigation" className="px-4 sm:px-6 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={`mobile-${link.to}-${link.name}`}
                  type="button"
                  onClick={() => scrollToSection(link.to)}
                  className="w-full min-h-[44px] flex items-center justify-between px-2 text-left text-sm font-medium text-slate-700 dark:text-[#F2F1ED] hover:text-[#C58A52] dark:hover:text-[#C58A52] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
                >
                  <span>{link.name}</span>
                  <ArrowRight size={14} className="text-slate-400 dark:text-[#747C84]" aria-hidden="true" />
                </button>
              ))}

              <div className="pt-3 mt-2 border-t border-slate-200 dark:border-[#30363B] flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => scrollToSection(SectionId.Booking)}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-sm rounded-md transition-colors"
                >
                  <span>Book a Consultation</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>

                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openLogin();
                    }}
                    className="w-full min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 border border-slate-200 dark:border-[#30363B] text-slate-700 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] text-sm font-medium rounded-md transition-colors"
                  >
                    Sign In
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full min-h-[44px] inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400"
                  >
                    Sign Out ({user?.email})
                  </button>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
