import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Tenant, SubscriptionPlan } from '../types';
import { businessOSApi } from '../lib/businessOSApi';

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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenantState] = useState<Tenant | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const planData = await businessOSApi.getPlans();
      setPlans(planData);
    } catch (err: any) {
      console.warn('Could not load plans:', err);
    }
  }, []);

  const refreshTenants = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await businessOSApi.getTenants();
      setTenants(data);

      const savedId = localStorage.getItem('avartah_active_tenant_id');
      let current = data.find(t => t.id === savedId);

      if (!current && data.length > 0) {
        current = data[0];
      }

      if (current) {
        // Fetch full tenant details with settings
        const fullTenant = await businessOSApi.getTenant(current.id);
        setActiveTenantState(fullTenant);
        localStorage.setItem('avartah_active_tenant_id', fullTenant.id);
      } else {
        setActiveTenantState(null);
        localStorage.removeItem('avartah_active_tenant_id');
      }
    } catch (err: any) {
      console.warn('Tenant session initialization:', err.message || err);
      // If unauthenticated or no tenants, set activeTenantState to null safely
      setActiveTenantState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    localStorage.setItem('avartah_active_tenant_id', tenant.id);
  };

  const selectTenantById = async (tenantId: string) => {
    try {
      const full = await businessOSApi.getTenant(tenantId);
      setActiveTenantState(full);
      localStorage.setItem('avartah_active_tenant_id', full.id);
    } catch (err) {
      console.error('Error selecting tenant:', err);
    }
  };

  useEffect(() => {
    fetchPlans();
    refreshTenants();
  }, [fetchPlans, refreshTenants]);

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
