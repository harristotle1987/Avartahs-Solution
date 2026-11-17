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

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Server Only | Neon PostgreSQL connection string (pooled recommended) |
| `SESSION_SECRET` | Server Only | Cryptographic secret for signing session cookies (minimum 32 characters) |
| `APP_BASE_URL` | Server Only | Canonical URL of the deployment (e.g., `https://avartah.vercel.app`) |
| `ALLOWED_ORIGINS` | Server Only | Comma-separated list of allowed CORS origins |
| `PAYSTACK_SECRET_KEY` | Server Only | Paystack live/test secret key (`sk_live_...` or `sk_test_...`) |
| `VITE_PAYSTACK_PUBLIC_KEY` | Client Safe | Paystack public key for frontend inline checkout (`pk_live_...` or `pk_test_...`) |
| `PAYSTACK_MODE` | Server Only | `live` or `test` |
| `PAYMENT_CURRENCY` | Server Only | Standard currency code (`NGN`) |
| `PAYSTACK_CALLBACK_URL` | Server Only | Authorized return URL for Paystack redirect |
| `GEMINI_API_KEY` | Server Only | Google Gemini API key for smart business operations |
| `RESEND_API_KEY` | Server Only | Optional email provider API key |

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
npm run type-check

# Production build
npm run build
```

---

## 🚀 Deployment (Vercel & Node.js)

For Vercel deployment:
1. Link repository to Vercel.
2. In Project Settings > Environment Variables, configure:
   - `DATABASE_URL`
   - `SESSION_SECRET` (generate with `openssl rand -hex 32`)
   - `PAYSTACK_SECRET_KEY`
   - `VITE_PAYSTACK_PUBLIC_KEY`
   - `PAYSTACK_CALLBACK_URL` (`https://<YOUR_APP_DOMAIN>/api/os/payments/paystack/callback`)
   - `APP_BASE_URL` (set to your production domain)
   - `ALLOWED_ORIGINS`
3. Configure the Paystack Dashboard Webhook URL (kept separate from the callback URL):
   - Webhook URL: `https://<YOUR_APP_DOMAIN>/api/os/payments/paystack/webhook`
4. Deploy with `npm run build`.

---

## 🛡️ License & Ownership

Proprietary and confidential. Developed by Avartah Solutions. All rights reserved.
