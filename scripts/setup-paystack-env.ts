#!/usr/bin/env node
/**
 * AVARTAH SOLUTIONS — PRODUCTION PAYSTACK ENVIRONMENT SETUP SCRIPT
 * 
 * This helper script verifies and configures PAYSTACK_MODE ('test' or 'live')
 * and required API credentials in deployment environments (Vercel / Node).
 * 
 * Usage:
 *   npx tsx scripts/setup-paystack-env.ts [--live|--test]
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function setupPaystackEnv() {
  console.log('========================================================================');
  console.log('       AVARTAH SOLUTIONS — PRODUCTION PAYSTACK ENVIRONMENT SETUP');
  console.log('========================================================================\n');

  console.log('This utility configures PAYSTACK_MODE, secret keys, public keys, and callback URLs.');
  console.log('Adhering to production fail-closed security rules.\n');

  const modeInput = await question('Select Paystack Mode [test / live] (default: test): ');
  const mode = modeInput.trim().toLowerCase() === 'live' ? 'live' : 'test';

  const secretKeyPrompt = await question(`Enter Paystack Secret Key (${mode === 'live' ? 'sk_live_...' : 'sk_test_...'}): `);
  const secretKey = secretKeyPrompt.trim();

  if (!secretKey) {
    console.error('[Error]: Paystack Secret Key cannot be empty.');
    rl.close();
    process.exit(1);
  }

  if (mode === 'live' && !secretKey.startsWith('sk_live_')) {
    console.error('[Error]: PAYSTACK_MODE="live" requires a secret key starting with "sk_live_".');
    rl.close();
    process.exit(1);
  }

  if (mode === 'test' && !secretKey.startsWith('sk_test_')) {
    console.error('[Error]: PAYSTACK_MODE="test" requires a secret key starting with "sk_test_".');
    rl.close();
    process.exit(1);
  }

  const publicKeyPrompt = await question(`Enter Paystack Public Key (${mode === 'live' ? 'pk_live_...' : 'pk_test_...'}): `);
  const publicKey = publicKeyPrompt.trim();

  const callbackUrlPrompt = await question('Enter Authoritative HTTPS Callback URL (e.g. https://avartahs-solution.vercel.app/api/os/payments/paystack/callback): ');
  const callbackUrl = callbackUrlPrompt.trim();

  if (mode === 'production' || callbackUrl) {
    try {
      const u = new URL(callbackUrl);
      if (u.protocol !== 'https:') {
        console.error('[Error]: Production PAYSTACK_CALLBACK_URL must use HTTPS.');
        rl.close();
        process.exit(1);
      }
    } catch {
      console.error('[Error]: Invalid callback URL format.');
      rl.close();
      process.exit(1);
    }
  }

  const envSnippet = `
# ==============================================================================
# AVARTAH SOLUTIONS — PAYSTACK PRODUCTION CONFIGURATION
# ==============================================================================
PAYSTACK_MODE=${mode}
PAYSTACK_SECRET_KEY=${secretKey}
VITE_PAYSTACK_PUBLIC_KEY=${publicKey}
PAYSTACK_CALLBACK_URL=${callbackUrl}
PAYMENT_CURRENCY=NGN
`;

  const envPath = path.join(process.cwd(), '.env');
  fs.appendFileSync(envPath, envSnippet, 'utf8');

  console.log('\n[Success]: Paystack environment variables successfully configured!');
  console.log('For Vercel Production deployment, ensure these environment variables are added in:');
  console.log('  Vercel Dashboard -> Project Settings -> Environment Variables');
  console.log('  - PAYSTACK_MODE');
  console.log('  - PAYSTACK_SECRET_KEY');
  console.log('  - VITE_PAYSTACK_PUBLIC_KEY');
  console.log('  - PAYSTACK_CALLBACK_URL');
  console.log('  - PAYMENT_CURRENCY=NGN\n');

  rl.close();
}

setupPaystackEnv().catch((err) => {
  console.error('Setup failed:', err);
  rl.close();
  process.exit(1);
});
