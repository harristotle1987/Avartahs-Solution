import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Tenant, SubscriptionPlan } from '../types';
import { businessOSApi } from '../lib/businessOSApi';
import { useAuth } from './AuthContext';

interface BusinessOSContextType {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  plans: SubscriptionPlan[];
  isLoading: boolean;
  error: string | null;
  setActiveTenant: (tenant: Tenant) => void;
  selectTenantById: (tenantId: string) => void;
  refreshTenants: () => Promise<void>;
  refreshActiveTenant: () => Promise<void>;
  formatCurrency: (amount: number) => string;
}

const BusinessOSContext = createContext<BusinessOSContextType | undefined>(undefined);

export const BusinessOSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isVerifying, user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenantState] = useState<Tenant | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const lastAuthEmailRef = useRef<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const planData = await businessOSApi.getPlans();
      setPlans(planData);
    } catch (err: any) {
      console.warn('Could not load plans:', err);
    }
  }, []);

  const refreshTenants = useCallback(async () => {
    if (!isAuthenticated) {
      setTenants([]);
      setActiveTenantState(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('avartah_active_tenant_id');
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await businessOSApi.getTenants();
      setTenants(data);

      const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem('avartah_active_tenant_id') : null;
      let current = data.find(t => t.id === savedId);

      if (!current && data.length > 0) {
        current = data[0];
      }

      if (current) {
        // Fetch full tenant details with settings
        const fullTenant = await businessOSApi.getTenant(current.id);
        setActiveTenantState(fullTenant);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('avartah_active_tenant_id', fullTenant.id);
        }
      } else {
        setActiveTenantState(null);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('avartah_active_tenant_id');
        }
      }
    } catch (err: any) {
      console.warn('Tenant session initialization:', err.message || err);
      // If unauthenticated or no tenants, set activeTenantState to null safely
      setTenants([]);
      setActiveTenantState(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const refreshActiveTenant = useCallback(async () => {
    if (!activeTenant) return;
    try {
      const full = await businessOSApi.getTenant(activeTenant.id);
      setActiveTenantState(full);
    } catch (err: any) {
      console.warn('Failed to refresh active tenant', err);
    }
  }, [activeTenant]);

  const setActiveTenant = (tenant: Tenant) => {
    setActiveTenantState(tenant);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('avartah_active_tenant_id', tenant.id);
    }
  };

  const selectTenantById = async (tenantId: string) => {
    try {
      const full = await businessOSApi.getTenant(tenantId);
      setActiveTenantState(full);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('avartah_active_tenant_id', full.id);
      }
    } catch (err) {
      console.error('Error selecting tenant:', err);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (isVerifying) return;

    const currentEmail = (user?.email || '').toLowerCase() || null;
    if (!isAuthenticated) {
      lastAuthEmailRef.current = null;
      setTenants([]);
      setActiveTenantState(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('avartah_active_tenant_id');
      }
      setIsLoading(false);
      return;
    }

    if (lastAuthEmailRef.current && currentEmail && lastAuthEmailRef.current !== currentEmail) {
      setTenants([]);
      setActiveTenantState(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('avartah_active_tenant_id');
      }
    }

    lastAuthEmailRef.current = currentEmail;
    refreshTenants();
  }, [isVerifying, isAuthenticated, user?.email, user?.role, refreshTenants]);

  const formatCurrency = (amount: number = 0): string => {
    const currency = activeTenant?.currency || 'NGN';
    const symbol = currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : '₦';
    return `${symbol}${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <BusinessOSContext.Provider
      value={{
        tenants,
        activeTenant,
        plans,
        isLoading,
        error,
        setActiveTenant,
        selectTenantById,
        refreshTenants,
        refreshActiveTenant,
        formatCurrency
      }}
    >
      {children}
    </BusinessOSContext.Provider>
  );
};

export function useBusinessOS(): BusinessOSContextType {
  const context = useContext(BusinessOSContext);
  if (!context) {
    throw new Error('useBusinessOS must be used within a BusinessOSProvider');
  }
  return context;
}
