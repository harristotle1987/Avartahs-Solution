# Avartah Solutions — Production Paystack Deployment Guide

This guide explains how to properly configure and inject Paystack billing environment variables into Vercel and production deployments to resolve Paystack initialization errors while adhering to fail-closed security rules.

## 1. Required Environment Variables

To activate Paystack subscription checkout, verification, callbacks, and webhooks in production, configure the following variables in your deployment dashboard:

| Variable Name | Required | Description | Example Value |
| :--- | :--- | :--- | :--- |
| **`PAYSTACK_MODE`** | **Yes** | Operating mode (`test` or `live`) | `live` (or `test`) |
| **`PAYSTACK_SECRET_KEY`** | **Yes** | Server-side secret key matching mode | `sk_live_...` or `sk_test_...` |
| **`VITE_PAYSTACK_PUBLIC_KEY`** | Recommended | Client-safe public key matching mode | `pk_live_...` or `pk_test_...` |
| **`PAYSTACK_CALLBACK_URL`** | **Yes (Prod)** | Authoritative HTTPS return URL | `https://avartahs-solution.vercel.app/api/os/payments/paystack/callback` |
| **`PAYMENT_CURRENCY`** | Optional | Authoritative billing currency (defaults to NGN) | `NGN` |

---

## 2. Configuring on Vercel Dashboard

1. Navigate to your Vercel Project Dashboard: **`avartahs-solution`**.
2. Go to **Settings** -> **Environment Variables**.
3. Add each of the required variables above for **Production** (and optionally Preview/Development):
   - `PAYSTACK_MODE` = `live`
   - `PAYSTACK_SECRET_KEY` = `sk_live_YOUR_SECRET_KEY`
   - `VITE_PAYSTACK_PUBLIC_KEY` = `pk_live_YOUR_PUBLIC_KEY`
   - `PAYSTACK_CALLBACK_URL` = `https://avartahs-solution.vercel.app/api/os/payments/paystack/callback`
   - `PAYMENT_CURRENCY` = `NGN`
4. Redeploy your project for the environment variables to take effect.

---

## 3. Automated Setup Script

Alternatively, developers can run the interactive setup helper script to validate and append these variables locally or in staging:

```bash
npx tsx scripts/setup-paystack-env.ts
```
