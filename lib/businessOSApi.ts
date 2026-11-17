import type {
  Tenant,
  TenantSettings,
  TenantMember,
  Customer,
  CatalogItem,
  Quotation,
  Invoice,
  Payment,
  SubscriptionPlan,
  BusinessOSMetrics
} from '../types.js';

const API_BASE = '/api/os';

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const csrfToken = getCsrfTokenFromCookie();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const businessOSApi = {
  // Plans
  async getPlans(): Promise<SubscriptionPlan[]> {
    return request<SubscriptionPlan[]>('/plans');
  },

  // Tenants
  async getTenants(): Promise<Tenant[]> {
    return request<Tenant[]>('/tenants');
  },

  async getTenant(tenantId: string): Promise<Tenant> {
    return request<Tenant>(`/tenants/${tenantId}`);
  },

  async registerBusiness(data: {
    name: string;
    industry: string;
    owner_email: string;
    phone?: string;
    plan_id?: string;
    country?: string;
    currency?: string;
  }): Promise<{ tenant: Tenant; redirect: string }> {
    return request<{ tenant: Tenant; redirect: string }>('/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async completeOnboarding(
    tenantId: string,
    data: {
      industry: string;
      customer_label?: string;
      catalog_label?: string;
      bank_name?: string;
      bank_account_number?: string;
      bank_account_name?: string;
      payment_instructions?: string;
      seed_catalog?: boolean;
    }
  ): Promise<{ success: boolean; tenant: Tenant }> {
    return request<{ success: boolean; tenant: Tenant }>(`/${tenantId}/onboarding`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTenant(
    tenantId: string,
    data: Partial<Tenant>
  ): Promise<Tenant> {
    return request<Tenant>(`/tenants/${tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async updateSettings(
    tenantId: string,
    data: Partial<TenantSettings>
  ): Promise<TenantSettings> {
    return request<TenantSettings>(`/${tenantId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  // Dashboard Metrics
  async getMetrics(tenantId: string): Promise<BusinessOSMetrics> {
    return request<BusinessOSMetrics>(`/${tenantId}/dashboard`);
  },

  // Customers
  async getCustomers(tenantId: string, search?: string): Promise<Customer[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<Customer[]>(`/${tenantId}/customers${query}`);
  },

  async saveCustomer(
    tenantId: string,
    data: Partial<Customer>
  ): Promise<Customer> {
    const isEdit = !!data.id;
    return request<Customer>(`/${tenantId}/customers${isEdit ? `/${data.id}` : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteCustomer(tenantId: string, customerId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${tenantId}/customers/${customerId}`, {
      method: 'DELETE'
    });
  },

  // Catalogue
  async getCatalog(
    tenantId: string,
    params?: { search?: string; category?: string; type?: string }
  ): Promise<CatalogItem[]> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.type) searchParams.set('type', params.type);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<CatalogItem[]>(`/${tenantId}/catalog${qs}`);
  },

  async saveCatalogItem(
    tenantId: string,
    data: Partial<CatalogItem>
  ): Promise<CatalogItem> {
    const isEdit = !!data.id;
    return request<CatalogItem>(`/${tenantId}/catalog${isEdit ? `/${data.id}` : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteCatalogItem(tenantId: string, itemId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${tenantId}/catalog/${itemId}`, {
      method: 'DELETE'
    });
  },

  // Quotations
  async getQuotations(tenantId: string, status?: string): Promise<Quotation[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<Quotation[]>(`/${tenantId}/quotations${qs}`);
  },

  async saveQuotation(
    tenantId: string,
    data: Partial<Quotation> & { items: any[] }
  ): Promise<Quotation> {
    const isEdit = !!data.id;
    return request<Quotation>(`/${tenantId}/quotations${isEdit ? `/${data.id}` : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify(data)
    });
  },

  async convertQuotationToInvoice(tenantId: string, quotationId: string): Promise<Invoice> {
    return request<Invoice>(`/${tenantId}/quotations/${quotationId}/convert`, {
      method: 'POST'
    });
  },

  // Invoices
  async getInvoices(tenantId: string, status?: string): Promise<Invoice[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<Invoice[]>(`/${tenantId}/invoices${qs}`);
  },

  async getInvoice(tenantId: string, invoiceId: string): Promise<Invoice> {
    return request<Invoice>(`/${tenantId}/invoices/${invoiceId}`);
  },

  async saveInvoice(
    tenantId: string,
    data: Partial<Invoice> & { items: any[] }
  ): Promise<Invoice> {
    const isEdit = !!data.id;
    return request<Invoice>(`/${tenantId}/invoices${isEdit ? `/${data.id}` : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteInvoice(tenantId: string, invoiceId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${tenantId}/invoices/${invoiceId}`, {
      method: 'DELETE'
    });
  },

  // Payments & Receipts
  async recordPayment(
    tenantId: string,
    invoiceId: string,
    data: {
      amount: number;
      payment_method: 'BANK_TRANSFER' | 'CASH' | 'POS_CARD' | 'ONLINE';
      reference?: string;
      notes?: string;
    }
  ): Promise<{ payment: Payment; invoice: Invoice }> {
    return request<{ payment: Payment; invoice: Invoice }>(`/${tenantId}/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Staff
  async getStaff(tenantId: string): Promise<TenantMember[]> {
    return request<TenantMember[]>(`/${tenantId}/staff`);
  },

  async inviteStaff(
    tenantId: string,
    data: { name: string; email: string; role: string; phone?: string }
  ): Promise<TenantMember> {
    return request<TenantMember>(`/${tenantId}/staff`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async removeStaff(tenantId: string, memberId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${tenantId}/staff/${memberId}`, {
      method: 'DELETE'
    });
  },

  // Subscriptions & Paystack Payments
  async initializePayment(data: {
    tenant_id: string;
    plan_id: string;
    callback_url?: string;
  }): Promise<{
    success: boolean;
    authorization_url?: string;
    access_code?: string;
    reference?: string;
    isFreePlan?: boolean;
    message?: string;
  }> {
    return request('/payments/initialize', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async verifyPayment(reference: string): Promise<{
    success: boolean;
    message: string;
    tenant: Tenant;
    alreadyProcessed?: boolean;
  }> {
    return request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ reference })
    });
  }
};
