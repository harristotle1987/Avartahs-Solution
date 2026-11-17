import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useBusinessOS } from '../../context/BusinessOSContext';
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Settings,
  CreditCard,
  Building2,
  ChevronDown,
  Plus,
  ArrowUpRight,
  Menu,
  X,
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface BusinessOSLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export const BusinessOSLayout: React.FC<BusinessOSLayoutProps> = ({
  children,
  title,
  subtitle,
  actionButton
}) => {
  const { tenants, activeTenant, selectTenantById, isLoading } = useBusinessOS();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const customerLabel = activeTenant?.settings?.customer_label || 'Customers';
  const catalogLabel = activeTenant?.settings?.catalog_label || 'Catalogue';

  const navItems = [
    { label: 'Dashboard', path: '/business-os/dashboard', icon: LayoutDashboard },
    { label: customerLabel, path: '/business-os/customers', icon: Users },
    { label: catalogLabel, path: '/business-os/catalogue', icon: Package },
    { label: 'Invoices & Quotes', path: '/business-os/invoices', icon: Receipt },
    { label: 'Settings', path: '/business-os/settings', icon: Settings },
    { label: 'Billing & Plan', path: '/business-os/billing', icon: CreditCard }
  ];

  const planName = activeTenant?.plan?.name || (activeTenant?.plan_id ? activeTenant.plan_id.toUpperCase() : 'FREE');

  return (
    <div className="min-h-screen bg-[#111315] text-[#ECEEEF] flex flex-col font-sans selection:bg-[#C58A52]/30 selection:text-[#E5A96A]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#16181B]/95 backdrop-blur-md border-b border-[#25282D] px-4 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Brand & Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-[#1C1F23] hover:bg-[#25282D] text-[#ECEEEF] border border-[#2B2F36] focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link to="/business-os" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C58A52] to-[#8C5D30] flex items-center justify-center font-bold text-black text-sm shadow-md shadow-[#C58A52]/20">
                A
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                  Avartah <span className="text-[#C58A52] font-mono text-xs uppercase px-1.5 py-0.5 rounded bg-[#C58A52]/10 border border-[#C58A52]/30">OS</span>
                </span>
                <span className="text-[10px] text-[#8E959E] font-medium tracking-wide">Multi-Tenant Business OS</span>
              </div>
            </Link>
          </div>

          {/* Center: Business Switcher */}
          <div className="relative">
            {activeTenant ? (
              <button
                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#1C1F23] border border-[#2B2F36] hover:border-[#C58A52]/50 text-left transition-all"
              >
                <div className="w-6 h-6 rounded bg-[#C58A52]/20 border border-[#C58A52]/40 text-[#E5A96A] flex items-center justify-center text-xs font-bold">
                  {activeTenant.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-xs">
                  <div className="font-medium text-white truncate max-w-[150px]">{activeTenant.name}</div>
                  <div className="text-[10px] text-[#8E959E] capitalize">{activeTenant.industry} · {activeTenant.currency}</div>
                </div>
                <ChevronDown size={14} className="text-[#8E959E]" />
              </button>
            ) : (
              <div className="text-xs text-[#8E959E]">Loading workspace...</div>
            )}

            {/* Switcher Dropdown */}
            {isSwitcherOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-64 bg-[#1A1D21] border border-[#2B2F36] rounded-xl shadow-2xl py-2 z-50">
                <div className="px-3 py-1 text-[11px] font-semibold text-[#8E959E] uppercase tracking-wider">
                  Switch Business
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {tenants.map((t, tIdx) => (
                    <button
                      key={`tenant-${t.id || 'id'}-${tIdx}`}
                      onClick={() => {
                        selectTenantById(t.id);
                        setIsSwitcherOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#25282D] transition-colors ${
                        activeTenant?.id === t.id ? 'bg-[#25282D] text-[#E5A96A] font-semibold' : 'text-[#ECEEEF]'
                      }`}
                    >
                      <div className="truncate">
                        <div>{t.name}</div>
                        <div className="text-[10px] text-[#8E959E] capitalize">{t.industry}</div>
                      </div>
                      {activeTenant?.id === t.id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C58A52]"></span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#25282D] pt-1 mt-1">
                  <button
                    onClick={() => {
                      setIsSwitcherOpen(false);
                      navigate('/business-os/register');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#C58A52] hover:bg-[#25282D] transition-colors"
                  >
                    <Plus size={14} />
                    <span>Register New Business</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Plan badge and Link back */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#1F2227] border border-[#2B2F36] text-[#A6ADB5]">
              <Sparkles size={12} className="text-[#C58A52]" />
              <span className="capitalize">{planName}</span>
            </span>

            <Link
              to="/"
              className="text-xs text-[#8E959E] hover:text-white flex items-center gap-1 px-2.5 py-1 rounded hover:bg-[#1C1F23] transition-colors"
              title="Return to Avartah Main Website"
            >
              <span>Avartah Main</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main App Body */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-[#141619] border-r border-[#202327] p-4 shrink-0">
          <nav className="space-y-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#C58A52]/15 text-[#E5A96A] border border-[#C58A52]/30 shadow-sm'
                      : 'text-[#9CA3AF] hover:bg-[#1B1E22] hover:text-white'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-[#C58A52]' : 'text-[#8E959E]'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-[#202327]">
            <div className="p-3.5 rounded-xl bg-gradient-to-b from-[#1C1F24] to-[#17191C] border border-[#2B2F36]/80 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-white">Current Tier</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#C58A52]/20 text-[#E5A96A] border border-[#C58A52]/30">
                  {activeTenant?.plan_id || 'Free'}
                </span>
              </div>
              <p className="text-[11px] text-[#8E959E] mb-3">
                Need more seats or unlimited invoices?
              </p>
              <Link
                to="/business-os/billing"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs transition-colors"
              >
                <span>Upgrade Plan</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-down Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#16181B] border-b border-[#25282D] p-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#C58A52]/15 text-[#E5A96A] border border-[#C58A52]/30'
                      : 'text-[#9CA3AF] hover:bg-[#1C1F23]'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {!isLoading && !activeTenant ? (
            <div className="py-16 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#C58A52]/10 border border-[#C58A52]/30 text-[#E5A96A] flex items-center justify-center mx-auto mb-4">
                <Building2 size={28} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No Business Workspace Found</h2>
              <p className="text-xs text-[#8E959E] mb-6 leading-relaxed">
                You are authenticated, but you do not belong to an active business organization yet. Register your business to start issuing invoices, managing clients, and tracking payments.
              </p>
              <Link
                to="/business-os/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs shadow-lg transition-all"
              >
                <span>Register Your Business</span>
                <Plus size={15} />
              </Link>
            </div>
          ) : (
            <>
              {(title || actionButton) && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-[#202327]">
                  <div>
                    {title && <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white">{title}</h1>}
                    {subtitle && <p className="text-xs lg:text-sm text-[#8E959E] mt-0.5">{subtitle}</p>}
                  </div>
                  {actionButton && <div>{actionButton}</div>}
                </div>
              )}
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
