import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BusinessOSLayout } from '../../components/business-os/BusinessOSLayout';
import { useBusinessOS } from '../../context/BusinessOSContext';
import { businessOSApi } from '../../lib/businessOSApi';
import { SubscriptionPlan } from '../../types';
import {
  CreditCard,
  Sparkles,
  Check,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  invalid_reference: 'Invalid or missing payment reference returned from checkout. No subscription was activated.',
  not_found: 'No pending payment record was found for that reference.',
  abandoned: 'Payment checkout was abandoned before completion. No subscription was activated.',
  failed: 'Payment transaction failed verification. No subscription was activated.',
  pending: 'Payment is still pending confirmation from Paystack. Your plan will activate once confirmed.',
  amount_mismatch: 'Payment verification rejected due to an amount mismatch.',
  currency_mismatch: 'Payment verification rejected due to a currency mismatch.',
  reference_mismatch: 'Payment verification rejected due to a reference mismatch.',
  tenant_mismatch: 'Payment verification rejected due to a workspace mismatch.',
  plan_mismatch: 'Payment verification rejected due to a subscription plan mismatch.',
  customer_mismatch: 'Payment verification rejected due to a customer mismatch.',
  verification_unavailable: 'Payment provider verification is temporarily unavailable. Please refresh or retry shortly.'
};

export const BillingOS: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeTenant, setActiveTenant, refreshTenants, refreshActiveTenant, formatCurrency, plans } = useBusinessOS();

  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>(plans);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processedRefKey = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const p = await businessOSApi.getPlans();
        setAvailablePlans(p);
      } catch (err) {}
    }
    load();
  }, []);

  // Handle Paystack callback redirect verification (always verifies server-side, never trusts query flags)
  useEffect(() => {
    const rawRef = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('ref');
    const paymentError = searchParams.get('payment_error');

    if (!rawRef && !paymentError) return;

    const dedupeKey = `${rawRef || ''}|${paymentError || ''}`;
    if (processedRefKey.current === dedupeKey) return;
    processedRefKey.current = dedupeKey;

    const cleanupParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('ref');
      next.delete('reference');
      next.delete('trxref');
      next.delete('payment_status');
      next.delete('payment_error');
      next.delete('tenant');
      setSearchParams(next, { replace: true });
    };

    if (!rawRef && paymentError) {
      setErrorMessage(
        CALLBACK_ERROR_MESSAGES[paymentError.toLowerCase()] ||
          'Payment could not be verified. No subscription was activated.'
      );
      cleanupParams();
      return;
    }

    const reference = rawRef!;
    let isMounted = true;

    async function verifyReturnPayment() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await businessOSApi.verifyPayment(reference);
        if (isMounted) {
          if (res.success) {
            setSuccessMessage(res.message || 'Payment verified! Your subscription is now active.');
            if (res.tenant) {
              setActiveTenant(res.tenant);
            }
            await refreshTenants();
            await refreshActiveTenant();
          } else {
            setErrorMessage(res.message || 'Payment verification failed.');
          }
          cleanupParams();
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(
            err.message ||
              (paymentError ? CALLBACK_ERROR_MESSAGES[paymentError.toLowerCase()] : null) ||
              'Failed to verify transaction with payment provider.'
          );
          cleanupParams();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyReturnPayment();
    return () => { isMounted = false; };
  }, [searchParams, setSearchParams, setActiveTenant, refreshTenants, refreshActiveTenant]);

  const currentPlanId = activeTenant?.plan_id || 'free';
  const currentPlan = availablePlans.find(p => p.id === currentPlanId) || {
    id: 'free',
    name: 'Free Starter',
    tagline: 'Standard solo operating tier',
    price_ngn: 0,
    price_usd: 0,
    max_customers: 30,
    max_invoices_per_month: 15,
    max_catalog_items: 15,
    max_staff_seats: 1,
    features: ['Up to 30 Customers', '15 Invoices & Quotes /mo', 'Standard Receipt Generation', 'Mobile Responsive Dashboard']
  };

  const handleUpgrade = async (planId: string) => {
    if (!activeTenant) return;
    if (planId === currentPlanId) return;

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await businessOSApi.initializePayment({
        tenant_id: activeTenant.id,
        plan_id: planId
      });

      if (res.isFreePlan) {
        await refreshActiveTenant();
        setSuccessMessage('Successfully switched to the Free tier.');
        setLoading(false);
        return;
      }

      if (res.authorization_url) {
        // Redirect to Paystack's secure checkout page
        window.location.href = res.authorization_url;
      } else {
        throw new Error(res.message || 'Unable to retrieve checkout gateway URL.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate secure payment.');
      setLoading(false);
    }
  };

  return (
    <BusinessOSLayout
      title="Subscription & Plan Limits"
      subtitle="View your operational limits, invoice quotas, and available scaling tiers."
    >
      {successMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading && (
        <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span>Processing payment transaction...</span>
        </div>
      )}

      {/* Current Plan Overview Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1C1F25] to-[#15171A] border border-[#2B2F36] mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#C58A52]/20 text-[#E5A96A] border border-[#C58A52]/30 mb-2 inline-block">
              Current Active Tier
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">{currentPlan.name}</h2>
            <p className="text-xs text-[#8E959E]">{currentPlan.tagline}</p>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-2xl font-bold text-white font-mono">
              {Number(currentPlan.price_ngn) === 0 ? 'Free' : formatCurrency(currentPlan.price_ngn)}
              <span className="text-xs text-[#8E959E] font-sans">/month</span>
            </div>
            <div className="text-[11px] text-[#8E959E]">Active recurring cycle</div>
          </div>
        </div>

        {/* Quota meters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-[#141619] border border-[#24272D]">
            <div className="flex justify-between text-xs text-[#8E959E] mb-1.5">
              <span>Customer Cap</span>
              <span className="font-semibold text-white">
                {currentPlan.max_customers > 9999 ? 'Unlimited' : `${currentPlan.max_customers} Max`}
              </span>
            </div>
            <div className="w-full bg-[#202328] h-2 rounded-full overflow-hidden">
              <div className="bg-[#C58A52] h-full rounded-full w-2/5" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141619] border border-[#24272D]">
            <div className="flex justify-between text-xs text-[#8E959E] mb-1.5">
              <span>Monthly Invoices</span>
              <span className="font-semibold text-white">
                {currentPlan.max_invoices_per_month > 9999 ? 'Unlimited' : `${currentPlan.max_invoices_per_month} /mo`}
              </span>
            </div>
            <div className="w-full bg-[#202328] h-2 rounded-full overflow-hidden">
              <div className="bg-[#C58A52] h-full rounded-full w-1/4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141619] border border-[#24272D]">
            <div className="flex justify-between text-xs text-[#8E959E] mb-1.5">
              <span>Catalogue Items</span>
              <span className="font-semibold text-white">
                {currentPlan.max_catalog_items > 9999 ? 'Unlimited' : `${currentPlan.max_catalog_items} Items`}
              </span>
            </div>
            <div className="w-full bg-[#202328] h-2 rounded-full overflow-hidden">
              <div className="bg-[#C58A52] h-full rounded-full w-1/3" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141619] border border-[#24272D]">
            <div className="flex justify-between text-xs text-[#8E959E] mb-1.5">
              <span>Staff Accounts</span>
              <span className="font-semibold text-white">
                {currentPlan.max_staff_seats >= 999999 ? 'Unlimited' : `${currentPlan.max_staff_seats} Seat${currentPlan.max_staff_seats > 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="w-full bg-[#202328] h-2 rounded-full overflow-hidden">
              <div className="bg-[#C58A52] h-full rounded-full w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans Switcher */}
      <div>
        <h3 className="text-base font-bold text-white mb-2">Upgrade or Switch Plan</h3>
        <p className="text-xs text-[#8E959E] mb-6">
          Upgrading expands customer caps, unlocks unlimited invoicing, and adds team accounts instantly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {availablePlans.map(plan => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <div
                key={plan.id}
                className={`p-5 rounded-2xl flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'bg-[#181B1F] border-2 border-[#C58A52] shadow-lg shadow-[#C58A52]/10'
                    : 'bg-[#16181C] border border-[#25282D] hover:border-[#353A42]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-sm">{plan.name}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C58A52] text-black">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-white font-mono mb-4">
                    {Number(plan.price_ngn) === 0 ? 'Free' : formatCurrency(plan.price_ngn)}
                    <span className="text-[10px] text-[#8E959E] font-sans">/mo</span>
                  </div>

                  <div className="space-y-1.5 text-xs mb-6 text-[#A6ADB5]">
                    <div className="flex items-center gap-1.5">
                      <Check size={13} className="text-[#C58A52]" />
                      <span>{plan.max_customers > 9999 ? 'Unlimited' : plan.max_customers} Customers</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check size={13} className="text-[#C58A52]" />
                      <span>{plan.max_invoices_per_month > 9999 ? 'Unlimited' : plan.max_invoices_per_month} Invoices / Mo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check size={13} className="text-[#C58A52]" />
                      <span>{plan.max_staff_seats >= 999999 ? 'Unlimited Staff Seats' : `${plan.max_staff_seats} Staff Seat${plan.max_staff_seats > 1 ? 's' : ''}`}</span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={isCurrent || loading}
                  onClick={() => handleUpgrade(plan.id)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    isCurrent
                      ? 'bg-[#22252A] text-[#8E959E] cursor-default'
                      : 'bg-[#C58A52] hover:bg-[#D4985F] text-black shadow-md shadow-[#C58A52]/20'
                  }`}
                >
                  {isCurrent ? (
                    <span>Current Plan</span>
                  ) : (
                    <>
                      <span>Upgrade to {plan.name}</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </BusinessOSLayout>
  );
};
