/**
 * AVARTAH SOLUTIONS — PRODUCTION PAYSTACK CLIENT SERVICE
 * 
 * Strict Server-Side Paystack Integration:
 * - Transaction Initialization: generates hosted payment link for verified tenant subscription
 * - Server-to-Server Verification: calls https://api.paystack.co/transaction/verify/:reference
 * - Webhook Cryptographic Verification: HMAC-SHA512 using raw request body
 * - Fail-closed error handling with 15-second request timeouts
 */

import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export interface PaystackInitializeOptions {
  email: string;
  amountKobo: number; // Amount in kobo (NGN * 100)
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
  channels?: string[];
}

export interface PaystackInitializeResponse {
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference?: string;
  error?: string;
}

export interface PaystackVerifyResponse {
  success: boolean;
  status: 'success' | 'failed' | 'abandoned' | 'pending' | 'unknown';
  amountKobo: number;
  currency: string;
  reference: string;
  transactionId?: string | number;
  channel?: string;
  paidAt?: string;
  customerEmail?: string;
  metadata?: Record<string, any>;
  transientError?: boolean;
  error?: string;
}

export const PAYSTACK_CALLBACK_PATH = '/api/os/payments/paystack/callback';

export type PaystackMode = 'test' | 'live';

function isPlaceholderConfigValue(val?: string | null): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  return (
    trimmed.includes('replace_with_your_actual') ||
    trimmed.includes('YOUR_DOMAIN') ||
    trimmed.includes('your_paystack')
  );
}

function getAllowedPaystackCallbackHosts(): string[] {
  const hosts = new Set<string>();
  const isPublicHostname = (h: string) =>
    Boolean(h) &&
    h !== 'localhost' &&
    !h.endsWith('.local') &&
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(h) &&
    !h.includes(':');

  const appBase = process.env.APP_BASE_URL?.trim();
  if (appBase && !isPlaceholderConfigValue(appBase)) {
    try {
      const u = new URL(appBase);
      const h = u.hostname.toLowerCase();
      if (isPublicHostname(h)) {
        hosts.add(h);
        if (h.startsWith('www.')) hosts.add(h.slice(4));
        else hosts.add(`www.${h}`);
      }
    } catch {
      // Ignore malformed APP_BASE_URL here; validated elsewhere
    }
  }
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || [];
  for (const origin of allowedOrigins) {
    try {
      const u = new URL(origin);
      const h = u.hostname.toLowerCase();
      if (isPublicHostname(h)) hosts.add(h);
    } catch {
      // Ignore malformed origin entry
    }
  }
  return Array.from(hosts);
}

/**
 * Strictly validates PAYSTACK_MODE ('test' | 'live') against PAYSTACK_SECRET_KEY
 * (and VITE_PAYSTACK_PUBLIC_KEY when configured). Never exposes secret values.
 */
export function validatePaystackModeAndKey(): {
  valid: boolean;
  mode?: PaystackMode;
  secretKey?: string;
  error?: string;
} {
  const isProd = process.env.NODE_ENV === 'production';
  const rawMode = process.env.PAYSTACK_MODE?.trim().toLowerCase();

  if (rawMode && rawMode !== 'test' && rawMode !== 'live') {
    return {
      valid: false,
      error: 'PAYSTACK_CONFIGURATION_ERROR: Unknown PAYSTACK_MODE. Must be "test" or "live".'
    };
  }

  if (isProd && !rawMode) {
    return {
      valid: false,
      error: 'PAYSTACK_CONFIGURATION_ERROR: PAYSTACK_MODE ("test" or "live") must be explicitly configured in production.'
    };
  }

  const rawKey = process.env.PAYSTACK_SECRET_KEY;
  if (isPlaceholderConfigValue(rawKey)) {
    return {
      valid: false,
      error: 'PAYSTACK_CONFIGURATION_ERROR: Valid PAYSTACK_SECRET_KEY is not configured in environment variables.'
    };
  }
  const secretKey = rawKey!.trim();

  let resolvedMode: PaystackMode;
  if (rawMode === 'test' || rawMode === 'live') {
    resolvedMode = rawMode;
  } else if (secretKey.startsWith('sk_live_')) {
    resolvedMode = 'live';
  } else if (secretKey.startsWith('sk_test_')) {
    resolvedMode = 'test';
  } else {
    return {
      valid: false,
      error: 'PAYSTACK_CONFIGURATION_ERROR: PAYSTACK_SECRET_KEY must begin with sk_test_ or sk_live_.'
    };
  }

  if (resolvedMode === 'test' && !secretKey.startsWith('sk_test_')) {
    return {
      valid: false,
      error: 'PAYSTACK_CONFIGURATION_ERROR: PAYSTACK_MODE="test" requires an sk_test_ secret key.'
    };
  }

  if (resolvedMode === 'live' && !secretKey.startsWith('sk_live_')) {
    return {
      valid: false,
      error: 'PAYSTACK_CONFIGURATION_ERROR: PAYSTACK_MODE="live" requires an sk_live_ secret key.'
    };
  }

  const publicKey = process.env.VITE_PAYSTACK_PUBLIC_KEY?.trim();
  if (publicKey && !isPlaceholderConfigValue(publicKey)) {
    if (resolvedMode === 'test' && !publicKey.startsWith('pk_test_')) {
      return {
        valid: false,
        error: 'PAYSTACK_CONFIGURATION_ERROR: PAYSTACK_MODE="test" mismatches VITE_PAYSTACK_PUBLIC_KEY.'
      };
    }
    if (resolvedMode === 'live' && !publicKey.startsWith('pk_live_')) {
      return {
        valid: false,
        error: 'PAYSTACK_CONFIGURATION_ERROR: PAYSTACK_MODE="live" mismatches VITE_PAYSTACK_PUBLIC_KEY.'
      };
    }
  }

  return {
    valid: true,
    mode: resolvedMode,
    secretKey
  };
}

/**
 * Validates and retrieves the Paystack Secret Key from environment after mode/key verification.
 * Throws in production or when attempting transactions if unconfigured or mismatched.
 */
export function getPaystackSecretKey(mustThrow: boolean = true): string | null {
  const check = validatePaystackModeAndKey();
  if (!check.valid || !check.secretKey) {
    if (mustThrow) {
      throw new Error(check.error || 'PAYSTACK_CONFIGURATION_ERROR: Invalid Paystack configuration.');
    }
    return null;
  }
  return check.secretKey;
}

/**
 * Check if Paystack is properly configured and mode-matched in this environment.
 */
export function isPaystackConfigured(): boolean {
  return validatePaystackModeAndKey().valid;
}

/**
 * Returns the authoritative ISO currency code for Paystack transactions (defaults to NGN).
 */
export function getPaystackPaymentCurrency(): string {
  const raw = (process.env.PAYMENT_CURRENCY || 'NGN').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(raw) ? raw : 'NGN';
}

/**
 * Validates Paystack transaction reference format to prevent malformed or injection strings.
 */
export function isValidPaystackReference(reference: unknown): reference is string {
  if (typeof reference !== 'string') return false;
  const trimmed = reference.trim();
  return trimmed.length >= 4 && trimmed.length <= 128 && /^[A-Za-z0-9._-]+$/.test(trimmed);
}

/**
 * Validates and returns the explicitly configured PAYSTACK_CALLBACK_URL from server environment.
 * Enforces HTTPS and domain ownership against configured Avartah domain(s) in production.
 * Never hardcodes production domains or reads frontend/VITE variables.
 */
export function getConfiguredPaystackCallbackUrl(): string | null {
  const raw = process.env.PAYSTACK_CALLBACK_URL;
  if (isPlaceholderConfigValue(raw)) {
    return null;
  }
  const isProd = process.env.NODE_ENV === 'production';
  try {
    const parsed = new URL(raw!.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (isProd && parsed.protocol !== 'https:') {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (isProd) {
      // Reject localhost or raw IP addresses in production callback URL
      if (
        hostname === 'localhost' ||
        hostname.endsWith('.local') ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
        hostname.includes(':')
      ) {
        return null;
      }

      const allowedHosts = getAllowedPaystackCallbackHosts();
      if (allowedHosts.length > 0) {
        if (!allowedHosts.includes(hostname)) {
          return null;
        }
      } else {
        // Default Avartah domain check when APP_BASE_URL / ALLOWED_ORIGINS are unset
        const isAvartahDomain = hostname === 'avartah.com' || hostname.endsWith('.avartah.com');
        if (!isAvartahDomain) {
          return null;
        }
      }
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Resolves the authoritative server-side callback URL for Paystack checkout initialization.
 * Production:
 *  - PAYSTACK_CALLBACK_URL is MANDATORY, HTTPS, and domain-validated.
 *  - Never falls back to APP_BASE_URL, Host, X-Forwarded-Host, or Origin headers.
 * Non-Production:
 *  1. Server env PAYSTACK_CALLBACK_URL (if valid)
 *  2. Server env APP_BASE_URL + /api/os/payments/paystack/callback
 *  3. Request host/origin (dev/test convenience only)
 */
export function resolvePaystackCallbackUrl(requestMeta?: {
  origin?: string;
  host?: string;
  protocol?: string;
}): string {
  const isProd = process.env.NODE_ENV === 'production';
  const explicitCallback = getConfiguredPaystackCallbackUrl();
  if (explicitCallback) {
    return explicitCallback;
  }

  if (isProd) {
    throw new Error(
      'PAYSTACK_CONFIGURATION_ERROR: A valid HTTPS PAYSTACK_CALLBACK_URL belonging to the configured domain is mandatory in production.'
    );
  }

  const appBase = process.env.APP_BASE_URL?.trim();
  if (appBase && !isPlaceholderConfigValue(appBase)) {
    try {
      const parsedBase = new URL(appBase);
      if (parsedBase.protocol === 'https:' || parsedBase.protocol === 'http:') {
        return new URL(PAYSTACK_CALLBACK_PATH, parsedBase.origin).toString();
      }
    } catch {
      // Fall through to request-derived host validation in dev/test only
    }
  }

  if (requestMeta?.host) {
    const cleanHost = requestMeta.host.split(',')[0].trim();
    const rawProto = (requestMeta.protocol || 'http').split(',')[0].trim().toLowerCase();
    const proto = rawProto === 'https' ? 'https' : 'http';
    if (cleanHost && /^[A-Za-z0-9.-]+(:\d+)?$/.test(cleanHost)) {
      return `${proto}://${cleanHost}${PAYSTACK_CALLBACK_PATH}`;
    }
  }

  if (requestMeta?.origin) {
    try {
      const parsedOrigin = new URL(requestMeta.origin.trim());
      if (parsedOrigin.protocol === 'https:' || parsedOrigin.protocol === 'http:') {
        return new URL(PAYSTACK_CALLBACK_PATH, parsedOrigin.origin).toString();
      }
    } catch {
      // Invalid origin header
    }
  }

  throw new Error(
    'PAYSTACK_CONFIGURATION_ERROR: PAYSTACK_CALLBACK_URL or APP_BASE_URL must be configured to initialize Paystack checkout.'
  );
}

/**
 * Startup validation for Paystack configuration. Fails closed in production if
 * mode/key mismatch, unknown mode, or invalid/missing callback URL exists.
 */
export function validatePaystackStartupConfig(): { mode: PaystackMode; callbackUrl: string } {
  const keyCheck = validatePaystackModeAndKey();
  if (!keyCheck.valid || !keyCheck.mode) {
    throw new Error(keyCheck.error || 'PAYSTACK_CONFIGURATION_ERROR: Invalid Paystack configuration.');
  }
  const callbackUrl = resolvePaystackCallbackUrl();
  return {
    mode: keyCheck.mode,
    callbackUrl
  };
}

/**
 * Initialize a Paystack checkout transaction.
 * Calls POST https://api.paystack.co/transaction/initialize
 */
export async function initializePaystackTransaction(
  options: PaystackInitializeOptions
): Promise<PaystackInitializeResponse> {
  const secretKey = getPaystackSecretKey(true)!;

  if (!options.email || !options.amountKobo || options.amountKobo <= 0 || !options.reference) {
    return {
      success: false,
      error: 'Invalid initialization arguments: email, amountKobo, and reference are required.'
    };
  }

  const payload = {
    email: options.email.toLowerCase().trim(),
    amount: Math.round(options.amountKobo),
    reference: options.reference.trim(),
    callback_url: options.callbackUrl,
    metadata: options.metadata || {},
    channels: options.channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data: any = await res.json().catch(() => null);

    if (!res.ok || !data?.status || !data?.data?.authorization_url) {
      console.error('[Paystack Initialize Error]:', data?.message || res.statusText);
      return {
        success: false,
        error: data?.message || `Paystack initialization failed with status ${res.status}`
      };
    }

    return {
      success: true,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference || options.reference
    };
  } catch (err: any) {
    console.error('[Paystack Initialize Exception]:', err.message || err);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Paystack request timed out' : (err.message || 'Network error communicating with Paystack')
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Direct server-to-server verification of a transaction reference with Paystack.
 * Calls GET https://api.paystack.co/transaction/verify/:reference
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyResponse> {
  const secretKey = getPaystackSecretKey(true)!;

  if (!isValidPaystackReference(reference)) {
    return {
      success: false,
      status: 'failed',
      amountKobo: 0,
      currency: '',
      reference: '',
      transientError: false,
      error: 'Valid payment reference string is required'
    };
  }

  const cleanRef = reference.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(cleanRef)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    const data: any = await res.json().catch(() => null);

    if (res.status >= 500 || res.status === 429) {
      return {
        success: false,
        status: 'unknown',
        amountKobo: 0,
        currency: '',
        reference: cleanRef,
        transientError: true,
        error: data?.message || `Paystack verification temporarily unavailable (HTTP ${res.status})`
      };
    }

    if (!res.ok || !data) {
      return {
        success: false,
        status: 'failed',
        amountKobo: 0,
        currency: '',
        reference: cleanRef,
        transientError: false,
        error: data?.message || `Paystack verification HTTP error ${res.status}`
      };
    }

    const txData = data.data;
    if (!data.status || !txData) {
      return {
        success: false,
        status: 'failed',
        amountKobo: 0,
        currency: '',
        reference: cleanRef,
        transientError: false,
        error: data.message || 'Transaction not found on Paystack'
      };
    }

    const rawStatus = String(txData.status || 'unknown').trim().toLowerCase();
    const normalizedStatus: PaystackVerifyResponse['status'] =
      rawStatus === 'success' ||
      rawStatus === 'failed' ||
      rawStatus === 'abandoned' ||
      rawStatus === 'pending'
        ? rawStatus
        : 'unknown';

    const isSuccess = normalizedStatus === 'success';

    return {
      success: isSuccess,
      status: normalizedStatus,
      amountKobo: Number(txData.amount || 0),
      currency: String(txData.currency || '').trim().toUpperCase(),
      reference: String(txData.reference || '').trim(),
      transactionId: txData.id,
      channel: txData.channel,
      paidAt: txData.paid_at,
      customerEmail: txData.customer?.email,
      metadata: txData.metadata,
      transientError: false,
      error: isSuccess ? undefined : (txData.gateway_response || `Payment status is ${normalizedStatus}`)
    };
  } catch (err: any) {
    console.error('[Paystack Verify Exception]:', err.message || err);
    return {
      success: false,
      status: 'unknown',
      amountKobo: 0,
      currency: '',
      reference: cleanRef,
      transientError: true,
      error: err.name === 'AbortError' ? 'Paystack verification timed out' : (err.message || 'Verification network failure')
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Verify Paystack webhook HMAC-SHA512 cryptographic signature.
 * 
 * Requirement: Must calculate SHA512 of the exact raw buffer body against PAYSTACK_SECRET_KEY
 * and compare in constant time using crypto.timingSafeEqual.
 */
export function verifyPaystackWebhookSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | string[] | undefined,
  secretKeyOverride?: string
): boolean {
  if (rawBody === undefined || rawBody === null || !signatureHeader || Array.isArray(signatureHeader)) {
    return false;
  }

  const secret = secretKeyOverride ? secretKeyOverride.trim() : getPaystackSecretKey(false);
  if (!secret || isPlaceholderConfigValue(secret)) {
    console.error('[Paystack Webhook]: Missing or invalid secret key for signature verification.');
    return false;
  }

  if (typeof signatureHeader !== 'string') {
    return false;
  }
  const trimmedSignature = signatureHeader.trim();
  if (!/^[0-9a-fA-F]{128}$/.test(trimmedSignature)) {
    return false;
  }

  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  if (bodyBuffer.length === 0) {
    return false;
  }

  try {
    const expectedBuffer = crypto.createHmac('sha512', secret).update(bodyBuffer).digest();
    const signatureBuffer = Buffer.from(trimmedSignature, 'hex');

    if (expectedBuffer.length !== signatureBuffer.length || expectedBuffer.length !== 64) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (err) {
    console.error('[Paystack Webhook Signature Verification Error]:', err);
    return false;
  }
}
