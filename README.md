# Avartah Solutions — Enterprise Business OS & Agency Platform

**High-Conversion Engineered Systems & Multi-Tenant Business OS**

Avartah Solutions is an enterprise-grade agency and business management platform specializing in logic-driven UI/UX, client revenue architecture, lead tracking, automated billing, and multi-tenant operational tools. Built with a unified React 19 + Vite frontend and an Express.js backend on Node.js, persisted with Neon PostgreSQL.

---

## 🚀 Key Features

- **Business OS & Multi-Tenant Architecture:** Complete workspace separation by `tenant_id` for inventory, invoices, sales, customer management, staff roles, and analytics.
- **Paystack Payment Infrastructure:**
  - Secure server-side payment initialization and currency verification (NGN standard, kobo integer precision).
  - Webhook processing with HMAC-SHA512 rawBody cryptographic verification (`crypto.timingSafeEqual`).
  - Strict deduplication via database-enforced unique constraints (`webhook_events`).
  - Tenant-isolated atomic payment verification and plan activation.
- **Hardened Authentication & Session Security:**
  - Secure, signed session cookies (`admin_session`) with `HttpOnly`, `SameSite=Lax`, and `Secure` flags.
  - Zero token exposure: No session tokens stored in `localStorage` or returned in JSON responses.
  - Double Submit Cookie CSRF protection (`x-csrf-token` verified against signed cookie).
  - Strict minimum 32-character entropy enforcement for session secrets (`SESSION_SECRET`).
- **Modern Security Headers:**
  - Comprehensive Content Security Policy (CSP) permitting required assets (Paystack checkout, Vite, Google Fonts) while blocking untrusted scripts.
  - Strict Transport Security (HSTS), X-Frame-Options (`SAMEORIGIN`), X-Content-Type-Options (`nosniff`), and Permissions-Policy.
- **Neon PostgreSQL Persistence:**
  - Fully relational schema managed with clean, versioned SQL migrations (`lib/migrations.ts`).
  - Row-level tenant isolation across all multi-tenant queries.
  - Zero fabricated demo bank accounts or dummy credentials in production migrations.

---

## 🛠️ Tech Stack

**Frontend:**
- React 19
- Vite 6
- Tailwind CSS
- Framer Motion
- Lucide React
- React Router DOM

**Backend & Database:**
- Node.js & Express.js
- Neon Serverless PostgreSQL (`@neondatabase/serverless`)
- Google GenAI SDK (`@google/genai`)
- Crypto & Cookie Session Management

**Billing & Payments:**
- Paystack API (Server-side initialization, verification, and webhook processing)

---

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Neon PostgreSQL connection string (`DATABASE_URL`)
- Paystack Secret Key & Public Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/avartah-solutions.git
   cd avartah-solutions
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Fill in your live credentials in `.env` (ensure `SESSION_SECRET` is at least 32 cryptographically random characters).

---

## ⚙️ Environment Variables Guide

See `.env.example` for the full annotated specification:

| Variable | Scope | Required in Prod | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Server Only | **Yes** | Neon PostgreSQL **pooled** (`-pooler`) connection string with `?sslmode=require` |
| `SESSION_SECRET` | Server Only | **Yes** | Cryptographic secret for signing/validating session & CSRF tokens (minimum 32 chars; generate with `openssl rand -hex 32`) |
| `APP_BASE_URL` | Server Only | **Yes** | Canonical deployment URL (e.g., `https://avartahs-solution.vercel.app`) |
| `ALLOWED_ORIGINS` | Server Only | **Yes** | Comma-separated list of allowed CORS origins |
| `PAYSTACK_MODE` | Server Only | Billing Only | `live` or `test` (required only for Paystack payment endpoints) |
| `PAYSTACK_SECRET_KEY` | Server Only | Billing Only | Paystack `sk_live_...` or `sk_test_...` matching `PAYSTACK_MODE` |
| `VITE_PAYSTACK_PUBLIC_KEY` | Client Safe | Billing Only | Paystack public key (`pk_live_...` or `pk_test_...`) matching `PAYSTACK_MODE` |
| `PAYSTACK_CALLBACK_URL` | Server Only | Billing Only | Authorized HTTPS return URL (`https://avartahs-solution.vercel.app/api/os/payments/paystack/callback`) |
| `PAYMENT_CURRENCY` | Server Only | Optional | 3-letter ISO billing currency (`NGN` default) |
| `GEMINI_API_KEY` | Server Only | Optional | Google Gemini API key for AI features |
| `RESEND_API_KEY` | Server Only | Optional | Email provider API key |

> **Security note:** Never prefix `SESSION_SECRET`, `DATABASE_URL`, or `PAYSTACK_SECRET_KEY` with `VITE_`. In Vercel Production, authentication routes fail closed (`503`) if `SESSION_SECRET` is missing or shorter than 32 characters; missing Paystack configuration disables only payment endpoints (`503`) without blocking core app routes.

---

## 🧪 Testing & Verification

The test suite validates security constraints, webhook signatures, idempotency, and tenant isolation without mocks or synthetic bypasses.

Run all tests:
```bash
npm test
```

Individual test suites:
```bash
# Security & Paystack Cryptographic Tests
npm run test:security

# Multi-Tenant & Business OS Route Integration Tests
npm run test:integration

# Type check
npm run typecheck

# Production build
npm run build
```

---

## 🚀 Deployment (Vercel & Node.js)

For Vercel deployment:
1. Link repository to Vercel (`avartahs-solution`).
2. In **Vercel Project Settings -> Environment Variables (Production)**, configure:
   - `DATABASE_URL`: Neon **pooled** (`-pooler`) URL ending in `?sslmode=require`
   - `SESSION_SECRET`: 64-char hex secret generated via `openssl rand -hex 32` (minimum 32 characters)
   - `APP_BASE_URL`: `https://avartahs-solution.vercel.app`
   - `ALLOWED_ORIGINS`: `https://avartahs-solution.vercel.app,https://avartahs-solution-git-main-avartahs-projects.vercel.app`
   - Optional (to enable Paystack billing): `PAYSTACK_MODE`, `PAYSTACK_SECRET_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_CALLBACK_URL`, `PAYMENT_CURRENCY`
3. Configure the Paystack Dashboard Webhook URL (kept separate from the callback URL):
   - Webhook URL: `https://<YOUR_APP_DOMAIN>/api/os/payments/paystack/webhook`
4. Deploy with `npm run build`. On first request/boot, idempotent migrations in `lib/migrations.ts` (including `033_site_analytics_schema_reconciliation`) reconcile schema state automatically without dropping or overwriting existing rows.

---

## 🛡️ License & Ownership

Proprietary and confidential. Developed by Avartah Solutions. All rights reserved.
