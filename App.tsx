import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/AdminDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import BlogPage from './pages/BlogPage';
import ArticlePage from './pages/ArticlePage';
import JobFinderPage from './pages/JobFinderPage';
import ServiceCataloguePage from './pages/ServiceCataloguePage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import ClientPortalPage from './pages/ClientPortalPage';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessOSProvider } from './context/BusinessOSContext';
import { BackButton } from './components/BackButton';

// Avartah Business OS SaaS Pages
import { LandingPageOS } from './pages/business-os/LandingPageOS';
import { PricingOS } from './pages/business-os/PricingOS';
import { RegisterOS } from './pages/business-os/RegisterOS';
import { OnboardingOS } from './pages/business-os/OnboardingOS';
import { DashboardOS } from './pages/business-os/DashboardOS';
import { CustomersOS } from './pages/business-os/CustomersOS';
import { CatalogueOS } from './pages/business-os/CatalogueOS';
import { InvoicesOS } from './pages/business-os/InvoicesOS';
import { SettingsOS } from './pages/business-os/SettingsOS';
import { BillingOS } from './pages/business-os/BillingOS';

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full min-h-screen flex flex-col relative"
    >
      {location.pathname !== '/' && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-1 flex items-center justify-between">
          <BackButton />
        </div>
      )}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </motion.div>
  );
};

const ScrollToHash = () => {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.slice(1));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash, pathname]);
  return null;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isVerifying, openLogin } = useAuth();
  const location = useLocation();

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111315] text-[#F2F1ED]">
        <Loader2 className="animate-spin w-8 h-8 text-emerald-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111315] text-[#F2F1ED] px-6">
        <div className="text-center max-w-md bg-[#15191C] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-black uppercase tracking-tight text-[#F2F1ED] mb-2">Authentication Required</h2>
          <p className="text-xs text-[#A3A9AF] uppercase tracking-widest mb-6">Please sign in to access client workspaces and private content.</p>
          <button
            onClick={() => openLogin({ returnTo: location.pathname })}
            className="px-6 py-3 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all cursor-pointer"
          >
            Sign In Now
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, isVerifying, openLogin } = useAuth();
  const location = useLocation();

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111315] text-[#F2F1ED]">
        <Loader2 className="animate-spin w-8 h-8 text-emerald-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111315] text-[#F2F1ED] px-6">
        <div className="text-center max-w-md bg-[#15191C] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-black uppercase tracking-tight text-[#F2F1ED] mb-2">Administrator Access Required</h2>
          <p className="text-xs text-[#A3A9AF] uppercase tracking-widest mb-6">This restricted command center strictly requires verified administrator credentials.</p>
          <button
            onClick={() => openLogin({ returnTo: location.pathname })}
            className="px-6 py-3 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all cursor-pointer"
          >
            Sign In as Admin
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111315] text-[#F2F1ED] px-6">
        <div className="text-center max-w-md bg-[#15191C] border border-red-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2 text-red-400">Access Denied</h2>
          <p className="text-xs text-[#A3A9AF] uppercase tracking-widest mb-6">
            Administrator privileges are strictly required. Your account does not have admin permissions.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/client/projects"
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-[#F2F1ED] rounded-xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Client Portal
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] rounded-xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <>
      <ScrollToHash />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
          <Route path="/services" element={<PageTransition><ServiceCataloguePage /></PageTransition>} />
          <Route path="/services/:slug" element={<PageTransition><ServiceDetailPage /></PageTransition>} />
          <Route path="/jobs" element={<AdminRoute><PageTransition><JobFinderPage /></PageTransition></AdminRoute>} />
          <Route path="/blog" element={<ProtectedRoute><PageTransition><BlogPage /></PageTransition></ProtectedRoute>} />
          <Route path="/blog/:slug" element={<ProtectedRoute><PageTransition><ArticlePage /></PageTransition></ProtectedRoute>} />
          <Route path="/privacy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
          <Route path="/terms" element={<PageTransition><TermsOfService /></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
          <Route path="/client/projects" element={<ProtectedRoute><PageTransition><ClientPortalPage /></PageTransition></ProtectedRoute>} />
          <Route path="/client/portal" element={<ProtectedRoute><PageTransition><ClientPortalPage /></PageTransition></ProtectedRoute>} />
          <Route path="/portal" element={<Navigate to="/client/projects" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/login" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/users" element={<Navigate to="/admin/dashboard?tab=users" replace />} />
          <Route path="/admin/delivery" element={<Navigate to="/admin/dashboard?tab=delivery" replace />} />
          <Route path="/admin/dashboard" element={<AdminRoute><PageTransition><AdminDashboard /></PageTransition></AdminRoute>} />
          {/* Avartah Business OS SaaS Routes */}
          <Route path="/business-os" element={<PageTransition><LandingPageOS /></PageTransition>} />
          <Route path="/business-os/pricing" element={<PageTransition><PricingOS /></PageTransition>} />
          <Route path="/business-os/register" element={<PageTransition><RegisterOS /></PageTransition>} />
          <Route path="/business-os/onboarding" element={<ProtectedRoute><PageTransition><OnboardingOS /></PageTransition></ProtectedRoute>} />
          <Route path="/business-os/dashboard" element={<ProtectedRoute><PageTransition><DashboardOS /></PageTransition></ProtectedRoute>} />
          <Route path="/business-os/customers" element={<ProtectedRoute><PageTransition><CustomersOS /></PageTransition></ProtectedRoute>} />
          <Route path="/business-os/catalogue" element={<ProtectedRoute><PageTransition><CatalogueOS /></PageTransition></ProtectedRoute>} />
          <Route path="/business-os/invoices" element={<ProtectedRoute><PageTransition><InvoicesOS /></PageTransition></ProtectedRoute>} />
          <Route path="/business-os/settings" element={<ProtectedRoute><PageTransition><SettingsOS /></PageTransition></ProtectedRoute>} />
          <Route path="/business-os/billing" element={<ProtectedRoute><PageTransition><BillingOS /></PageTransition></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <BusinessOSProvider>
            <div className="flex flex-col min-h-screen">
              <AnimatedRoutes />
            </div>
          </BusinessOSProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
