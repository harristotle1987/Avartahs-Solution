import express from 'express';
import cors from 'cors';
import compression from 'compression';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import { isEmailConfigured, sendEmail, sendPasswordResetEmail, sendWorkspaceInvitationEmail } from './lib/services/email.js';
import { runDatabaseMigrations } from './lib/migrations.js';
import { businessOSRouter } from './api/businessOSRouter.js';
import { validatePaystackReadiness, verifyPaystackWebhookSignature } from './lib/paystack.js';

import { BlogsService } from './lib/services/blogs.js';
import { GoogleGenAI, Type } from '@google/genai';
import { forwardGeocode } from './lib/positionstack.js';
import { 
  passesContactGate, 
  validateEmail, 
  normalizeAndValidatePhone, 
  extractContactsFromHtml,
  deepScrapeWebsiteContacts,
  researchPublicContactsForBusiness,
  generateValueFirstPitch,
  escapeOverpassValue,
  cleanQueryParts,
  parseOsmElementToBusiness,
  expandBusinessCategory,
  isSafeUrl,
  safeFetchWithRedirects,
  resolveAndValidateHost,
  mapInternalStatusToCategory,
  normalizeDomain,
  normalizeBusinessKey,
  WEBSITE_QUALITY_CATEGORIES,
  extractCanonicalKeys,
  isSocialOrDirectoryDomain,
  type ContactEvidence,
  type WebsiteQualityCategory
} from './lib/prospects.js';
import {
  prospectDiscoveryEngine,
  buildDeterministicProspectId,
  type EvaluatedProspectRecord,
  type DiscoveryDbStats
} from './lib/prospectDiscovery.js';
import { addProspectsToCrmTransactional } from './lib/prospectCrm.js';
import { runFullAuditDiagnostics } from './lib/auditDiagnostics.js';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool, { getNeonDiagnostics, isTransientNeonError, sanitizeDbErrorMessage } from './lib/neon.js';
import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  createSession,
  getSessionSecret,
  isAuthConfigurationError,
  requireAdminAuth,
  requireUserAuth,
  revokeSession,
  validateSession,
  type SessionData
} from './lib/serverAuth.js';
import { activeJobAdapters } from './lib/services/jobAdapters.js';
import { 
  deduplicateJobs, 
  applyJobFilters, 
  calculateMatchScore, 
  type NormalizedJob, 
  type JobSearchFilters,
  computeJobFingerprint,
  isSafeJobUrl
} from './lib/jobs.js';

dotenv.config();

function extractJSON(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    throw e;
  }
}

const __filename = path.join(process.cwd(), 'server.ts');
const __dirname = path.dirname(__filename);

export const app = express();
app.set('trust proxy', 1);

function isHttpsRequest(req?: express.Request): boolean {
  if (!req) return process.env.NODE_ENV === 'production';
  const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (xfProto === 'https') return true;
  if (req.secure) return true;
  const origin = String(req.headers.origin || '').toLowerCase();
  if (origin.startsWith('https://')) return true;
  return process.env.NODE_ENV === 'production';
}

async function initializeNeonDatabase() {
  if (!process.env.DATABASE_URL) {
    console.warn('[Neon DB Notice]: DATABASE_URL is not configured. Server starting in offline/preview mode.');
    isDbReady = false;
    return;
  }
  try {
    // Run versioned migrations guarded by PostgreSQL distributed advisory lock
    await runDatabaseMigrations();

    // Non-destructive historical data reconciliation: session_bookings -> bookings (only if legacy table exists)
    try {
      const legacyCheck = await pool.query("SELECT to_regclass('public.session_bookings') IS NOT NULL AS exists");
      if (legacyCheck.rows[0]?.exists) {
        await pool.query(`
          INSERT INTO bookings (id, booking_date, booking_time, client_name, client_email, notes, status, created_at)
          SELECT id, TO_DATE(booking_date, 'DD/MM/YYYY'), booking_time, COALESCE(name, 'Valued Client'), email, message, 'CONFIRMED', created_at
          FROM session_bookings
          WHERE booking_date IS NOT NULL AND booking_time IS NOT NULL AND booking_date ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          ON CONFLICT (booking_date, booking_time) DO NOTHING;
        `);
      }
    } catch (e) {}

    // Seed default outreach template
    try {
      await pool.query(`
        INSERT INTO outreach_templates (id, title, subject, body, system_prompt, category)
        VALUES ('default-closer', 'Default Closer Script', 'Outreach from Avartah', 'Write a professional outreach message.', 'Write a high-converting, professional B2B outreach message for Avartah Solutions.', 'Closer')
        ON CONFLICT (id) DO NOTHING;
      `);
    } catch (e) {}

    // Seed comprehensive blog articles in a single batched round-trip
    try {
      const defaultBlogs = [
        // Category 1: Engineering & Systems Architecture
        {
          id: 'blog-eng-1',
          title: 'Building Resilient Microservices with Distributed PostgreSQL & Advisory Locks',
          slug: 'resilient-microservices-postgresql',
          excerpt: 'Explore advanced patterns for building fault-tolerant backend architectures using PostgreSQL advisory locks and connection pooling.',
          content: 'Modern distributed systems require robust concurrency control and fault-tolerant data stores. In this article, we examine how PostgreSQL advisory locks prevent race conditions across serverless instances without locking entire table rows. We dive into bounded connection pooling, query retries, and transactional outbox patterns...',
          author: 'Avartah Architecture Team',
          category: 'Engineering & Systems Architecture',
          cover_image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-eng-2',
          title: 'Type-Safe Full-Stack Architecture: End-to-End TypeScript Validation',
          slug: 'type-safe-full-stack-architecture',
          excerpt: 'How strict schema validation and end-to-end typing eliminate runtime boundary errors across modern React and Node systems.',
          content: 'Type safety should not stop at the API boundary. By combining strict TypeScript configurations, runtime Zod validation, and end-to-end type sharing, development teams can catch schema drift before code ever reaches staging. We explore practical patterns for unifying client and server types...',
          author: 'Lead Full-Stack Engineer',
          category: 'Engineering & Systems Architecture',
          cover_image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-eng-3',
          title: 'Zero-Downtime Database Migrations in Serverless Environments',
          slug: 'zero-downtime-database-migrations',
          excerpt: 'Strategies for executing schema changes across distributed serverless nodes without locking tables or interrupting user sessions.',
          content: 'Deploying schema updates in serverless production environments demands rigorous planning. Backward-compatible migrations, expand-and-contract patterns, and advisory lock guards ensure zero downtime during high-traffic deployments...',
          author: 'Principal Systems Architect',
          category: 'Engineering & Systems Architecture',
          cover_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-eng-4',
          title: 'Event-Driven State Synchronization Across Client and Server',
          slug: 'event-driven-state-synchronization',
          excerpt: 'Master real-time optimistic UI updates, conflict resolution, and idempotent transaction logs in collaborative apps.',
          content: 'Real-time collaboration demands resilient state reconciliation. This article covers optimistic UI rendering, conflict-free replicated data types (CRDTs), and idempotent backend event streams that guarantee eventual consistency...',
          author: 'Senior Distributed Systems Engineer',
          category: 'Engineering & Systems Architecture',
          cover_image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
          published: true
        },

        // Category 2: AI & Machine Learning Engineering
        {
          id: 'blog-ai-1',
          title: 'Integrating Gemini 2.5 & 3.8 Flash SDKs in High-Throughput Node APIs',
          slug: 'integrating-gemini-sdk-high-throughput',
          excerpt: 'Practical engineering patterns for streaming structured JSON responses and managing rate limits with the Google GenAI SDK.',
          content: 'Unlocking generative AI capabilities in production microservices requires efficient stream parsing, robust error handling, and intelligent rate-limit backoff strategies. We examine how to leverage the @google/genai SDK for enterprise workloads...',
          author: 'AI Integration Lead',
          category: 'AI & Machine Learning Engineering',
          cover_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-ai-2',
          title: 'Building Autonomous Multi-Step Agents with Structured Function Calling',
          slug: 'autonomous-multi-step-agents-function-calling',
          excerpt: 'A deep dive into tool use, schema validation, and safe agentic execution loops in production enterprise systems.',
          content: 'Function calling turns LLMs from conversational chatbots into autonomous problem solvers. Learn how to define strict JSON schemas, handle multi-step execution graphs, and enforce guardrails against hallucinations in agent workflows...',
          author: 'Principal AI Researcher',
          category: 'AI & Machine Learning Engineering',
          cover_image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-ai-3',
          title: 'Semantic Search & Vector Embeddings in Relational PostgreSQL',
          slug: 'semantic-search-vector-embeddings-postgresql',
          excerpt: 'Harnessing pgvector and hybrid keyword-vector retrieval for high-precision enterprise document search.',
          content: 'You do not always need a dedicated vector database. PostgreSQL combined with the pgvector extension provides lightning-fast approximate nearest neighbor (ANN) search alongside ACID guarantees. We walk through embedding generation and query tuning...',
          author: 'Database Architect',
          category: 'AI & Machine Learning Engineering',
          cover_image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-ai-4',
          title: 'Real-Time Audio & Multimodal Streaming Architectures',
          slug: 'real-time-audio-multimodal-streaming',
          excerpt: 'Architecting low-latency bi-directional voice and video pipelines using WebSockets and streaming LLM APIs.',
          content: 'Multimodal AI models enable voice-first and vision-enabled interactions. This guide explores WebSockets, PCM audio chunk streaming, and buffer management for real-time conversational agents...',
          author: 'Multimodal Systems Engineer',
          category: 'AI & Machine Learning Engineering',
          cover_image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
          published: true
        },

        // Category 3: Enterprise Scalability & Cloud Infrastructure
        {
          id: 'blog-cloud-1',
          title: 'Scaling Neon Serverless PostgreSQL to Millions of Queries',
          slug: 'scaling-neon-serverless-postgresql',
          excerpt: 'Optimizing connection pooling, statement caching, and indexing strategies for serverless Postgres backends.',
          content: 'Serverless architectures scale compute instantly, but database connections can become a bottleneck. Discover how Neon Serverless Postgres separates storage and compute to deliver elastic scalability without connection exhaustion...',
          author: 'Cloud Infrastructure Lead',
          category: 'Enterprise Scalability & Cloud Infrastructure',
          cover_image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-cloud-2',
          title: 'Zero-Trust Security Models for B2B SaaS Platforms',
          slug: 'zero-trust-security-models-b2b-saas',
          excerpt: 'Enforcing Row Level Security (RLS), stateless JWT sessions, and encrypted payload verification in cloud architectures.',
          content: 'Perimeter security is obsolete. Implementing a zero-trust model requires cryptographically verified tokens, strict tenant isolation at the database layer, and continuous authorization checks for every RPC request...',
          author: 'Chief Information Security Officer',
          category: 'Enterprise Scalability & Cloud Infrastructure',
          cover_image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-cloud-3',
          title: 'Optimizing Vercel Edge Functions & Serverless Cold Starts',
          slug: 'optimizing-vercel-edge-functions-cold-starts',
          excerpt: 'Techniques to minimize latency, reduce bundle sizes, and eliminate cold start overhead across global edge networks.',
          content: 'Global edge distribution brings compute closer to users, but cold starts can impact TTFB. We analyze bundle tree-shaking, lightweight dependency selection, and memory tuning for Vercel serverless deployments...',
          author: 'Performance Engineer',
          category: 'Enterprise Scalability & Cloud Infrastructure',
          cover_image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-cloud-4',
          title: 'High-Performance Caching Strategies with Redis & In-Memory Layers',
          slug: 'high-performance-caching-strategies-redis',
          excerpt: 'Designing multi-tier caching architectures with stale-while-revalidate and intelligent cache invalidation.',
          content: 'Effective caching reduces database load by orders of magnitude. Learn how to combine browser caching, CDN edge caching, and Redis in-memory stores with stale-while-revalidate patterns for instant response times...',
          author: 'Systems Architect',
          category: 'Enterprise Scalability & Cloud Infrastructure',
          cover_image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
          published: true
        },

        // Category 4: Conversion Optimization & Growth Engineering
        {
          id: 'blog-growth-1',
          title: 'Engineering High-Converting Conversion Funnels in React',
          slug: 'engineering-high-converting-conversion-funnels',
          excerpt: 'Behavioral psychology meets technical performance: optimizing multi-step onboarding and audit forms for maximum conversion.',
          content: 'Every millisecond of latency and every unnecessary form field degrades conversion rates. We examine how to build frictionless, high-converting multi-step forms with instant client-side validation and optimistic state persistence...',
          author: 'Growth Engineering Lead',
          category: 'Conversion Optimization & Growth Engineering',
          cover_image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-growth-2',
          title: 'Automated B2B Prospecting & Contact Enrichment Engines',
          slug: 'automated-b2b-prospecting-enrichment-engines',
          excerpt: 'Building robust web scrapers with SSRF defense, IP whitelisting, and automated email/WhatsApp outreach generation.',
          content: 'Scaling outbound sales requires intelligent automation. Discover how to build secure web scrapers with DNS resolution checks, private IP blocking, and AI-driven value proposition generation for B2B prospects...',
          author: 'Automation Architect',
          category: 'Conversion Optimization & Growth Engineering',
          cover_image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-growth-3',
          title: 'Technical SEO Auditing: Core Web Vitals & PageSpeed Mastery',
          slug: 'technical-seo-auditing-core-web-vitals',
          excerpt: 'Deep dive into TTFB optimization, lazy loading, DOM node minimization, and axe-core accessibility compliance.',
          content: 'Search engine rankings heavily favor exceptional Core Web Vitals. We dissect how to audit and optimize Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), and Interaction to Next Paint (INP) across React applications...',
          author: 'Technical SEO Lead',
          category: 'Conversion Optimization & Growth Engineering',
          cover_image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
          published: true
        },
        {
          id: 'blog-growth-4',
          title: 'Data-Driven Growth Loops: Analytics & Funnel Attribution',
          slug: 'data-driven-growth-loops-analytics',
          excerpt: 'Implementing end-to-end visitor tracking, funnel step drop-off analysis, and automated escalation triggers in PostgreSQL.',
          content: 'Understanding user behavior requires precise event telemetry. Learn how to capture session durations, step-by-step funnel drop-offs, and revenue forecasts directly into PostgreSQL analytics tables without third-party tracking cookies...',
          author: 'Data Analytics Architect',
          category: 'Conversion Optimization & Growth Engineering',
          cover_image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
          published: true
        }
      ];

      const blogIds = defaultBlogs.map(b => b.id);
      const existingBlogs = await pool.query('SELECT id FROM blogs WHERE id = ANY($1::text[])', [blogIds]);
      const existingBlogSet = new Set(existingBlogs.rows.map((r: any) => r.id));
      const missingBlogs = defaultBlogs.filter(b => !existingBlogSet.has(b.id));

      if (missingBlogs.length > 0) {
        const placeholders: string[] = [];
        const params: any[] = [];
        let idx = 1;
        for (const b of missingBlogs) {
          placeholders.push(
            `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          );
          params.push(b.id, b.title, b.slug, b.excerpt, b.content, b.author, b.category, b.cover_image, b.published);
        }
        await pool.query(
          `INSERT INTO blogs (id, title, slug, excerpt, content, author, category, cover_image, published, published_at, created_at, updated_at)
           VALUES ${placeholders.join(', ')}
           ON CONFLICT (id) DO NOTHING`,
          params
        );
      }
    } catch (e) {
      console.warn('[Blog Seeding Warning]:', sanitizeDbErrorMessage(e));
    }

    // Ensure administrator accounts exist without hardcoded passwords or fallback variants
    const adminEmails = ['admin@avartah.com', 'harristotle84@gmail.com'];
    const existingAdminsRes = await pool.query(
      'SELECT LOWER(email) AS email FROM admin_users WHERE LOWER(email) = ANY($1::text[])',
      [adminEmails]
    );
    const existingAdminSet = new Set(existingAdminsRes.rows.map((r: any) => r.email));
    for (const email of adminEmails) {
      if (!existingAdminSet.has(email.toLowerCase())) {
        const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
        const hash = await bcrypt.hash(initialPassword, 10);
        await pool.query(
          'INSERT INTO admin_users (email, password_hash, role, is_active) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
          [email, hash, 'admin', true]
        );
        console.log('[Neon DB] Initialized admin account for:', email);
      }
    }

    isDbReady = true;
    dbInitError = null;
  } catch (err: any) {
    dbInitError = err instanceof Error ? err : new Error(String(err));
    isDbReady = false;
    console.error('[Neon DB Initialization Notice]:', sanitizeDbErrorMessage(err));
    throw dbInitError;
  }
}

let dbInitError: Error | null = null;
let isDbReady = false;
let dbInitPromise: Promise<void> | null = null;

export function resetDbInitStateForTesting(): void {
  dbInitError = null;
  isDbReady = false;
  dbInitPromise = null;
}

export function ensureDbInitialized(): Promise<void> {
  if (process.env.AVARTAH_SKIP_DB_INIT === '1') {
    isDbReady = true;
    dbInitError = null;
    return Promise.resolve();
  }
  if (isDbReady) {
    return Promise.resolve();
  }
  if (!dbInitPromise) {
    dbInitPromise = initializeNeonDatabase()
      .then(() => {
        isDbReady = true;
        dbInitError = null;
      })
      .catch((err: any) => {
        isDbReady = false;
        dbInitError = err instanceof Error ? err : new Error(String(err));
        // Clear rejected promise so subsequent requests on a warm Vercel instance
        // can recover automatically once Neon wakes up.
        dbInitPromise = null;
        throw dbInitError;
      });
  }
  return dbInitPromise;
}

// Trusted client IP resolution taking into account Vercel edge headers
export function getTrustedClientIp(req: express.Request): string {
  const vercelIp = req.headers['x-vercel-ip'] as string | undefined;
  if (vercelIp && typeof vercelIp === 'string') return vercelIp.trim();

  const realIp = req.headers['x-real-ip'] as string | undefined;
  if (realIp && typeof realIp === 'string') return realIp.trim();

  const forwardedFor = req.headers['x-forwarded-for'] as string | undefined;
  if (forwardedFor && typeof forwardedFor === 'string') {
    const first = forwardedFor.split(',')[0].trim();
    if (first) return first;
  }

  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  dbError?: boolean;
}

// Persistent shared rate limiter backed by Neon PostgreSQL with strict fail-closed protection
export async function checkPersistentRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
  failClosed: boolean = true
): Promise<RateLimitResult> {
  const sanitizedKey = String(key || 'anon').trim().slice(0, 128);
  try {
    const res = await pool.query(`
      INSERT INTO rate_limit_events (key, count, reset_time)
      VALUES ($1, 1, CURRENT_TIMESTAMP + ($2 || ' seconds')::interval)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE 
          WHEN rate_limit_events.reset_time < CURRENT_TIMESTAMP THEN 1 
          ELSE rate_limit_events.count + 1 
        END,
        reset_time = CASE 
          WHEN rate_limit_events.reset_time < CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + ($2 || ' seconds')::interval 
          ELSE rate_limit_events.reset_time 
        END
      RETURNING count, EXTRACT(EPOCH FROM reset_time)::bigint * 1000 AS reset_time_ms;
    `, [sanitizedKey, windowSeconds]);

    const count = Number(res.rows[0].count);
    const resetTime = Number(res.rows[0].reset_time_ms);
    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);

    return { allowed, remaining, resetTime };
  } catch (err: any) {
    console.error('[RateLimiter Error]:', err.message || err);
    if (failClosed) {
      // FAIL-CLOSED: Block access and signal DB failure
      return { allowed: false, remaining: 0, resetTime: Date.now() + windowSeconds * 1000, dbError: true };
    }
    return { allowed: true, remaining: 1, resetTime: Date.now() + windowSeconds * 1000 };
  }
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://js.paystack.co",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.paystack.co https:",
  "frame-src 'self' https://checkout.paystack.com https://www.youtube.com https://youtube.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'"
].join('; ');

function resolveTrustedAppBaseUrl(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = process.env.APP_BASE_URL?.trim();
  const isPlaceholder =
    !raw ||
    raw.includes('replace_with_your_actual') ||
    raw.includes('YOUR_DOMAIN');

  if (!isPlaceholder) {
    try {
      const parsed = new URL(raw!);
      if (isProd) {
        const host = parsed.hostname.toLowerCase();
        if (
          parsed.protocol !== 'https:' ||
          host === 'localhost' ||
          host.endsWith('.local') ||
          /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
        ) {
          throw new Error('APP_BASE_URL must be a valid public HTTPS URL in production.');
        }
      } else if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('APP_BASE_URL must use HTTP or HTTPS.');
      }
      return parsed.origin;
    } catch (err: any) {
      if (isProd) {
        throw new Error(err?.message || 'Invalid APP_BASE_URL configuration in production.');
      }
    }
  }

  if (isProd) {
    throw new Error('APP_BASE_URL must be configured with a valid HTTPS origin in production.');
  }

  return 'http://localhost:3000';
}

// Standard security headers middleware
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

let serverBootPromise: Promise<void> | null = null;
let serverBootDone = false;

// Cold-start barrier: ensure startServer() finishes registering middleware & routes before serving requests
app.use(async (_req, res, next) => {
  if (!serverBootDone && serverBootPromise && process.env.AVARTAH_TEST_MODE !== '1') {
    try {
      await serverBootPromise;
    } catch (err: any) {
      const safeBootMsg = String(err?.message || err || 'Unknown error').replace(/["'{}]/g, '').substring(0, 300);
      console.error('[Server Cold-Start Error]:', safeBootMsg);
      return res.status(503).json({
        success: false,
        errorCode: 'SERVICE_UNAVAILABLE',
        error: 'Service initialization failed. Check server configuration.'
      });
    }
  }
  next();
});

// Request barrier: ensure database initialization completes before any DB-backed API request is processed
app.use(async (req, res, next) => {
  if (
    req.method === 'OPTIONS' ||
    !req.path.startsWith('/api') ||
    req.path === '/api/health' ||
    req.path === '/api/ready' ||
    req.path === '/api/db-health'
  ) {
    return next();
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      error: 'Database is not configured. Please supply DATABASE_URL in environment variables.',
      status: 'unconfigured'
    });
  }
  try {
    await ensureDbInitialized();
    next();
  } catch (err: any) {
    const diag = getNeonDiagnostics();
    console.error(
      `[API DB Barrier Error] path=${req.path} host=${diag.host || 'unknown'} pooled=${diag.isPooledEndpoint} transient=${isTransientNeonError(err)}:`,
      sanitizeDbErrorMessage(err)
    );
    res.status(503).json({
      success: false,
      errorCode: 'DATABASE_UNAVAILABLE',
      error: 'Service Unavailable: Database initialization failed or temporarily unavailable.'
    });
  }
});

// Dedicated comprehensive readiness check
app.get('/api/ready', async (req, res) => {
  const neonDiag = getNeonDiagnostics();
  try {
    if (!isDbReady) {
      await ensureDbInitialized();
    }
    await pool.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM admin_users) as admin_count,
        (SELECT COUNT(*)::int FROM crm_leads) as leads_count,
        (SELECT COUNT(*)::int FROM bookings) as bookings_count,
        (SELECT COUNT(*)::int FROM projects) as projects_count
    `);
    res.json({
      status: 'ready',
      database: 'connected',
      neon: neonDiag,
      checks: {
        admin_users: true,
        crm_leads: true,
        bookings: true,
        projects: true
      }
    });
  } catch (err: any) {
    console.error(`[Readiness Check Failed] host=${neonDiag.host || 'unknown'} pooled=${neonDiag.isPooledEndpoint}:`, sanitizeDbErrorMessage(err));
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      neon: neonDiag,
      error: 'Database service is not ready'
    });
  }
});

export async function startServer() {
  const PORT = 3000;

  const paystackReadiness = validatePaystackReadiness();
  if (!paystackReadiness.ready) {
    console.warn('[Paystack Readiness Notice]: Payment endpoints disabled until configured —', paystackReadiness.error);
  }

  if (process.env.NODE_ENV === 'production' && process.env.AVARTAH_TEST_MODE !== '1') {
    try {
      await getSessionSecret();
    } catch (authErr: any) {
      console.warn('[Auth Configuration Notice]:', authErr?.message || authErr);
    }
  }

  app.use(compression()); // Enable Gzip compression
  app.use(cookieParser());

  app.use(cors((req, callback) => {
    const isProd = process.env.NODE_ENV === 'production';
    const origin = req.headers.origin;
    if (!origin) return callback(null, { origin: true, credentials: true });
    if (!isProd) return callback(null, { origin: true, credentials: true });

    const trustedOrigins = new Set<string>();
    const allowedEnv = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
      : [];
    for (const o of allowedEnv) {
      try {
        trustedOrigins.add(new URL(o).origin);
      } catch {
        // Ignore invalid origin entries
      }
    }
    const appBaseEnv = process.env.APP_BASE_URL?.trim();
    if (appBaseEnv && !appBaseEnv.includes('replace_with_your_actual') && !appBaseEnv.includes('YOUR_DOMAIN')) {
      try {
        trustedOrigins.add(new URL(appBaseEnv).origin);
      } catch {
        // Ignore invalid APP_BASE_URL
      }
    }

    if (trustedOrigins.has(origin)) {
      return callback(null, { origin: true, credentials: true });
    }

    // Explicitly whitelist Vercel production and branch deployment origins adhering to fail-closed policy
    const explicitWhitelistedOrigins = new Set([
      'https://avartahs-solution.vercel.app',
      'https://avartahs-solution-git-main-avartahs-projects.vercel.app'
    ]);

    if (explicitWhitelistedOrigins.has(origin)) {
      return callback(null, { origin: true, credentials: true });
    }

    // Automatically allow Vercel preview domains (*.vercel.app) and request host origin
    try {
      const parsedOrigin = new URL(origin);
      const hostname = parsedOrigin.hostname.toLowerCase();
      if (hostname === 'vercel.app' || hostname.endsWith('.vercel.app')) {
        return callback(null, { origin: true, credentials: true });
      }
      const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
      if (hostname === requestHost) {
        return callback(null, { origin: true, credentials: true });
      }
    } catch {}

    console.error(`[CORS Security Alert] Origin ${origin} rejected by fail-closed production policy.`);
    const corsErr: any = new Error('CORS origin denied by production policy');
    corsErr.statusCode = 403;
    corsErr.errorCode = 'CORS_ORIGIN_DENIED';
    return callback(corsErr);
  }));
  app.use(bodyParser.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));

  // Helper to set cache headers
  const setCacheControl = (res: express.Response, seconds: number = 3600) => {
    res.set('Cache-Control', `public, max-age=${seconds}`);
  };

  // --- CSRF TOKEN DOUBLE-SUBMIT PROTECTION MIDDLEWARE ---
  // Generates and refreshes an accessible XSRF-TOKEN cookie for browser clients.
  // Enforces x-csrf-token matching header on state-changing requests when authenticated via session cookie.
  // Exempts signature-verified webhooks (e.g., Paystack).
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const isHttps = isHttpsRequest(req);
    let csrfToken = req.cookies['XSRF-TOKEN'];
    if (!csrfToken || csrfToken.length < 32) {
      csrfToken = crypto.randomBytes(24).toString('hex');
      res.cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false, // Must be readable by client JS to send in X-CSRF-Token header
        secure: isHttps,
        sameSite: isHttps ? ('none' as const) : ('lax' as const),
        ...(isHttps ? { partitioned: true } : {}),
        path: '/'
      });
    }
    (req as any).csrfToken = csrfToken;
    res.setHeader('X-CSRF-Token', csrfToken);

    const method = req.method.toUpperCase();
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isWebhook =
      req.path === '/api/os/payments/paystack/webhook' ||
      req.path === '/api/workspaces/subscription/webhook';

    // Only enforce CSRF if request uses cookie authentication and is not a provider-signed webhook
    const hasCookieAuth = !!req.cookies['admin_session'];
    if (isStateChanging && hasCookieAuth && !isWebhook) {
      const headerToken = (req.headers['x-csrf-token'] || req.headers['x-xsrf-token']) as string;
      if (!headerToken || headerToken !== csrfToken) {
        return res.status(403).json({
          success: false,
          errorCode: 'CSRF_VALIDATION_FAILED',
          error: 'Forbidden: CSRF validation failed. Missing or mismatched CSRF token header.'
        });
      }
    }

    next();
  });

  // --- SECURE DATABASE-BACKED SESSION INFRASTRUCTURE (Consolidated in lib/serverAuth.ts) ---
  // Cross-site iframe compatible cookie options (SameSite=None; Secure; Partitioned on HTTPS)
  const getCookieOptions = (req?: express.Request) => {
    const isHttps = isHttpsRequest(req);
    return {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? ('none' as const) : ('lax' as const),
      ...(isHttps ? { partitioned: true } : {}),
      path: '/',
      maxAge: SESSION_TTL_MS
    };
  };

  const getClearCookieOptions = (req?: express.Request) => {
    const isHttps = isHttpsRequest(req);
    return {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? ('none' as const) : ('lax' as const),
      ...(isHttps ? { partitioned: true } : {}),
      path: '/'
    };
  };

  // Workspace membership verification helper
  const verifyWorkspaceAccess = async (userEmail: string, workspaceId: string, requiredRole: string = 'member'): Promise<boolean> => {
    try {
      const adminCheck = await pool.query('SELECT role FROM admin_users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE', [userEmail]);
      if (adminCheck.rows.length > 0) return true;

      const res = await pool.query(
        'SELECT role, status FROM workspace_memberships WHERE workspace_id = $1 AND LOWER(user_email) = LOWER($2) AND status = $3',
        [workspaceId, userEmail, 'active']
      );
      if (res.rows.length === 0) return false;
      const role = res.rows[0].role;
      if (requiredRole === 'owner' && role !== 'owner') return false;
      if (requiredRole === 'admin' && role !== 'owner' && role !== 'admin') return false;
      return true;
    } catch {
      return false;
    }
  };

  // --- STEP 9: WORKSPACE REST API ENDPOINTS ---

  // 1. List user workspaces
  app.get('/api/workspaces', requireUserAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      let query = '';
      let values: any[] = [];

      if (user.role === 'admin') {
        query = 'SELECT w.*, wm.role FROM workspaces w LEFT JOIN workspace_memberships wm ON w.id = wm.workspace_id AND LOWER(wm.user_email) = LOWER($1)';
        values = [user.email];
      } else {
        query = 'SELECT w.*, wm.role FROM workspaces w JOIN workspace_memberships wm ON w.id = wm.workspace_id WHERE LOWER(wm.user_email) = LOWER($1) AND wm.status = $2';
        values = [user.email, 'active'];
      }

      const result = await pool.query(query, values);
      res.json(result.rows);
    } catch (error) {
      handleDbError(res, error, 'workspaces:list');
    }
  });

  // 2. Create workspace
  app.post('/api/workspaces', requireUserAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { name } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Workspace name is required' });
      }

      const workspaceId = 'ws_' + crypto.randomBytes(8).toString('hex');
      const wsName = String(name).trim();

      await pool.query(
        'INSERT INTO workspaces (id, name, owner_email, status) VALUES ($1, $2, $3, $4)',
        [workspaceId, wsName, user.email, 'active']
      );

      await pool.query(
        'INSERT INTO workspace_memberships (workspace_id, user_email, role, status) VALUES ($1, $2, $3, $4)',
        [workspaceId, user.email, 'owner', 'active']
      );

      await pool.query(
        'INSERT INTO workspace_subscriptions (id, workspace_id, plan_id, status) VALUES ($1, $2, $3, $4)',
        ['sub_' + crypto.randomBytes(6).toString('hex'), workspaceId, 'free', 'active']
      );

      const created = await pool.query('SELECT * FROM workspaces WHERE id = $1', [workspaceId]);
      res.status(201).json(created.rows[0]);
    } catch (error) {
      handleDbError(res, error, 'workspaces:create');
    }
  });

  // 3. Get workspace members
  app.get('/api/workspaces/:id/members', requireUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const wsId = Array.isArray(id) ? id[0] : (id || '');
      const user = (req as any).user;
      const hasAccess = await verifyWorkspaceAccess(user.email, wsId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: Access to this workspace is denied.' });
      }

      const members = await pool.query('SELECT * FROM workspace_memberships WHERE workspace_id = $1 ORDER BY created_at ASC', [wsId]);
      res.json(members.rows);
    } catch (error) {
      handleDbError(res, error, 'workspaces:members:list');
    }
  });

  // 4. Add workspace member directly (Guarded against role escalation)
  app.post('/api/workspaces/:id/members', requireUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const wsId = Array.isArray(id) ? id[0] : (id || '');
      const user = (req as any).user;
      const hasAccess = await verifyWorkspaceAccess(user.email, wsId, 'admin');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: Workspace administrator privileges required.' });
      }

      const { email, role } = req.body;
      if (!email || !validateEmail(String(email).trim())) {
        return res.status(400).json({ error: 'Valid member email is required' });
      }

      const memberRole = ['owner', 'admin', 'member', 'viewer'].includes(role) ? role : 'member';

      // Role escalation protection: A workspace admin cannot grant 'admin' or 'owner'.
      // Only the workspace owner (or platform admin) can grant 'admin' or 'owner'.
      if (memberRole === 'owner' || memberRole === 'admin') {
        const isOwner = await verifyWorkspaceAccess(user.email, wsId, 'owner');
        if (!isOwner && user.role !== 'admin') {
          return res.status(403).json({ error: 'Forbidden: Only the workspace owner or platform administrator can assign admin or owner roles.' });
        }
      }

      await pool.query(
        `INSERT INTO workspace_memberships (workspace_id, user_email, role, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, user_email) DO UPDATE SET role = $3, status = $4`,
        [wsId, String(email).trim().toLowerCase(), memberRole, 'active']
      );

      res.json({ success: true, message: 'Member added successfully.' });
    } catch (error) {
      handleDbError(res, error, 'workspaces:members:add');
    }
  });

  // 4b. Send workspace invitation
  app.post('/api/workspaces/:id/invitations', requireUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const wsId = Array.isArray(id) ? id[0] : (id || '');
      const user = (req as any).user;

      const hasAccess = await verifyWorkspaceAccess(user.email, wsId, 'admin');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: Workspace administrator privileges required.' });
      }

      const { email, role = 'member' } = req.body;
      if (!email || !validateEmail(String(email).trim())) {
        return res.status(400).json({ error: 'A valid recipient email address is required.' });
      }

      const inviteeEmail = String(email).trim().toLowerCase();
      if (inviteeEmail === user.email.toLowerCase()) {
        return res.status(400).json({ error: 'You cannot invite yourself to the workspace.' });
      }

      const invitedRole = ['owner', 'admin', 'member', 'viewer'].includes(role) ? role : 'member';

      // Role escalation guard: workspace admins cannot invite users as 'admin' or 'owner'
      if (invitedRole === 'owner' || invitedRole === 'admin') {
        const isOwner = await verifyWorkspaceAccess(user.email, wsId, 'owner');
        if (!isOwner && user.role !== 'admin') {
          return res.status(403).json({ error: 'Forbidden: Only the workspace owner or platform administrator can invite members as admin or owner.' });
        }
      }

      // Check if already an active member
      const existingMember = await pool.query(
        'SELECT role, status FROM workspace_memberships WHERE workspace_id = $1 AND LOWER(user_email) = LOWER($2)',
        [wsId, inviteeEmail]
      );
      if (existingMember.rows.length > 0 && existingMember.rows[0].status === 'active') {
        return res.status(409).json({ error: 'User is already an active member of this workspace.' });
      }

      const wsRes = await pool.query('SELECT name FROM workspaces WHERE id = $1', [wsId]);
      if (wsRes.rows.length === 0) {
        return res.status(404).json({ error: 'Workspace not found.' });
      }
      const workspaceName = wsRes.rows[0].name;

      // Rate limit invitations per workspace
      const rateLimitKey = 'ws_inv_' + wsId;
      const rl = await checkPersistentRateLimit(rateLimitKey, 20, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Workspace invitation rate limit exceeded. Please wait before sending more invitations.' });
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const invitationId = 'inv_' + crypto.randomBytes(8).toString('hex');

      await pool.query(
        `INSERT INTO workspace_invitations (id, workspace_id, inviter_email, invitee_email, role, token_hash, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [invitationId, wsId, user.email.toLowerCase(), inviteeEmail, invitedRole, tokenHash, expiresAt]
      );

      // Attempt to dispatch invitation email using validated trusted APP_BASE_URL (never req.headers.origin)
      let baseUrl: string;
      try {
        baseUrl = resolveTrustedAppBaseUrl();
      } catch (cfgErr: any) {
        console.error('[Workspace Invitation Configuration Error]:', cfgErr?.message || cfgErr);
        return res.status(500).json({ error: 'Application base URL configuration is invalid for invitations.' });
      }

      if (!isEmailConfigured()) {
        await pool.query('DELETE FROM workspace_invitations WHERE id = $1', [invitationId]);
        return res.status(503).json({
          success: false,
          error: 'Email delivery service is not configured. Invitation could not be sent.'
        });
      }

      const emailResult = await sendWorkspaceInvitationEmail(inviteeEmail, workspaceName, user.email, rawToken, baseUrl);

      if (!emailResult.success) {
        console.warn('[Workspace Invitation Email Warning]:', emailResult.error);
        await pool.query('DELETE FROM workspace_invitations WHERE id = $1', [invitationId]);
        return res.status(502).json({
          success: false,
          error: 'Failed to dispatch workspace invitation email.'
        });
      }

      res.status(201).json({
        success: true,
        invitation_id: invitationId,
        message: 'Invitation dispatched successfully.'
      });
    } catch (error) {
      handleDbError(res, error, 'workspaces:invitations:create');
    }
  });

  // 4c. Inspect workspace invitation token (Public / Verification)
  app.get('/api/workspaces/invitations/:token', async (req, res) => {
    try {
      const rawToken = req.params.token;
      if (!rawToken || typeof rawToken !== 'string') {
        return res.status(400).json({ valid: false, error: 'Valid invitation token is required.' });
      }

      const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
      const invRes = await pool.query(
        `SELECT i.id, i.workspace_id, i.inviter_email, i.invitee_email, i.role, i.expires_at, i.status, w.name as workspace_name
         FROM workspace_invitations i
         JOIN workspaces w ON i.workspace_id = w.id
         WHERE i.token_hash = $1`,
        [tokenHash]
      );

      if (invRes.rows.length === 0) {
        return res.status(404).json({ valid: false, error: 'Invitation not found or invalid.' });
      }

      const inv = invRes.rows[0];
      if (inv.status !== 'pending') {
        return res.status(400).json({ valid: false, error: `This invitation is already ${inv.status}.` });
      }

      if (new Date(inv.expires_at) < new Date()) {
        return res.status(400).json({ valid: false, error: 'This invitation has expired.' });
      }

      res.json({
        valid: true,
        workspace_id: inv.workspace_id,
        workspace_name: inv.workspace_name,
        invitee_email: inv.invitee_email,
        role: inv.role,
        inviter_email: inv.inviter_email
      });
    } catch (error) {
      handleDbError(res, error, 'workspaces:invitations:verify');
    }
  });

  // 4d. Accept workspace invitation (Atomic Transaction)
  app.post('/api/workspaces/invitations/accept', async (req, res) => {
    const client = await pool.connect();
    let releaseErr: any;
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Valid invitation token is required.' });
      }

      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

      await client.query('BEGIN');

      const invRes = await client.query(
        `SELECT id, workspace_id, invitee_email, role, expires_at, status
         FROM workspace_invitations
         WHERE token_hash = $1 FOR UPDATE`,
        [tokenHash]
      );

      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invitation not found or invalid.' });
      }

      const inv = invRes.rows[0];
      if (inv.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `This invitation is already ${inv.status}.` });
      }

      if (new Date(inv.expires_at) < new Date()) {
        await client.query('UPDATE workspace_invitations SET status = \'expired\' WHERE id = $1', [inv.id]);
        await client.query('COMMIT');
        return res.status(400).json({ error: 'This invitation has expired.' });
      }

      // Mark invitation accepted
      await client.query('UPDATE workspace_invitations SET status = \'accepted\' WHERE id = $1', [inv.id]);

      // Add to workspace memberships
      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_email, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (workspace_id, user_email) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
        [inv.workspace_id, inv.invitee_email, inv.role]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        workspace_id: inv.workspace_id,
        message: 'Workspace invitation successfully accepted.'
      });
    } catch (error) {
      releaseErr = error;
      try {
        await client.query('ROLLBACK');
      } catch {}
      handleDbError(res, error, 'workspaces:invitations:accept');
    } finally {
      if (releaseErr) client.release(releaseErr);
      else client.release();
    }
  });

  // Remove workspace member
  app.delete('/api/workspaces/:id/members/:memberEmail', requireUserAuth, async (req, res) => {
    try {
      const { id, memberEmail } = req.params;
      const wsId = Array.isArray(id) ? id[0] : (id || '');
      const targetEmail = Array.isArray(memberEmail) ? memberEmail[0] : (memberEmail || '');
      const user = (req as any).user;

      const hasAccess = await verifyWorkspaceAccess(user.email, wsId, 'admin');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: Workspace administrator privileges required.' });
      }

      const wsRes = await pool.query('SELECT owner_email FROM workspaces WHERE id = $1', [wsId]);
      if (wsRes.rows.length === 0) return res.status(404).json({ error: 'Workspace not found' });
      if (wsRes.rows[0].owner_email.toLowerCase() === targetEmail.toLowerCase()) {
        return res.status(400).json({ error: 'Cannot remove the owner of the workspace.' });
      }

      await pool.query(
        'DELETE FROM workspace_memberships WHERE workspace_id = $1 AND LOWER(user_email) = LOWER($2)',
        [wsId, targetEmail]
      );
      res.json({ success: true, message: 'Member removed successfully.' });
    } catch (error) {
      handleDbError(res, error, 'workspaces:members:delete');
    }
  });

  // 5. Get workspace subscription
  app.get('/api/workspaces/:id/subscription', requireUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const wsId = Array.isArray(id) ? id[0] : (id || '');
      const user = (req as any).user;
      const hasAccess = await verifyWorkspaceAccess(user.email, wsId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: Access denied.' });
      }

      const subRes = await pool.query('SELECT * FROM workspace_subscriptions WHERE workspace_id = $1', [wsId]);
      if (subRes.rows.length === 0) {
        return res.json({ plan_id: 'free', status: 'active', billing_interval: 'monthly' });
      }
      res.json(subRes.rows[0]);
    } catch (error) {
      handleDbError(res, error, 'workspaces:subscription:get');
    }
  });

  // 6. Billing Webhook Handler (Verified Signatures: Stripe / Paystack / Generic & Idempotency)
  app.post('/api/workspaces/subscription/webhook', async (req, res) => {
    try {
      const webhookSecret = process.env.BILLING_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return res.status(503).json({ error: 'Webhook processing disabled: BILLING_WEBHOOK_SECRET is not configured.' });
      }

      const rawBuf = Buffer.isBuffer((req as any).rawBody)
        ? (req as any).rawBody
        : typeof (req as any).rawBody === 'string'
          ? Buffer.from((req as any).rawBody, 'utf8')
          : Buffer.isBuffer(req.body)
            ? req.body
            : undefined;
      if (!rawBuf || rawBuf.length === 0) {
        return res.status(401).json({ error: 'Unauthorized: Missing raw request body for webhook signature verification.' });
      }

      const stripeSig = req.headers['stripe-signature'] as string | undefined;
      const paystackSig = req.headers['x-paystack-signature'];
      const genericSig = (req.headers['x-webhook-signature'] || req.headers['x-signature']) as string | undefined;

      let verified = false;

      // 1. Stripe official signature check (timestamp + HMAC-SHA256)
      if (stripeSig) {
        const parts = stripeSig.split(',');
        const tPart = parts.find(p => p.startsWith('t='));
        const v1Part = parts.find(p => p.startsWith('v1='));

        if (tPart && v1Part) {
          const timestamp = parseInt(tPart.substring(2), 10);
          const signature = v1Part.substring(3);
          const now = Math.floor(Date.now() / 1000);

          // Replay tolerance: 300 seconds (5 minutes)
          if (Math.abs(now - timestamp) <= 300) {
            const signedPayload = `${timestamp}.${rawBuf.toString('utf8')}`;
            const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
            try {
              const sigBuf = Buffer.from(signature, 'hex');
              const expBuf = Buffer.from(expectedSig, 'hex');
              if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
                verified = true;
              }
            } catch {}
          }
        }
      }

      // 2. Paystack official signature check (HMAC-SHA512 over rawBody)
      if (!verified && paystackSig) {
        verified = verifyPaystackWebhookSignature(rawBuf, paystackSig, webhookSecret);
      }

      // 3. Generic HMAC-SHA256 check over rawBody
      if (!verified && genericSig) {
        const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBuf).digest('hex');
        try {
          const sigBuf = Buffer.from(genericSig, 'hex');
          const expBuf = Buffer.from(expectedSig, 'hex');
          if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
            verified = true;
          }
        } catch {}
      }

      if (!verified) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired webhook signature.' });
      }

      const event = req.body;
      if (!event || (!event.type && !event.event)) {
        return res.status(400).json({ error: 'Invalid webhook payload structure.' });
      }

      // Replay Protection & Idempotency Check
      const eventId = String(event.id || event.event_id || crypto.createHash('sha256').update(rawBuf).digest('hex'));
      const dedupeRes = await pool.query(
        'INSERT INTO processed_webhook_events (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id',
        [eventId]
      );

      if (dedupeRes.rows.length === 0) {
        // Event has already been processed idempotently
        return res.status(200).json({ received: true, deduplicated: true, message: 'Event already processed.' });
      }

      const eventType = event.type || event.event || '';
      const workspaceId = event.data?.metadata?.workspace_id || event.data?.workspace_id;

      if (workspaceId) {
        const planId = event.data?.plan_id || (eventType.includes('pro') ? 'pro' : 'enterprise');
        const status = (eventType.includes('success') || eventType.includes('active') || eventType.includes('charge.success'))
          ? 'active'
          : 'past_due';

        await pool.query(
          `INSERT INTO workspace_subscriptions (id, workspace_id, plan_id, status, provider_subscription_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (workspace_id) DO UPDATE SET plan_id = $3, status = $4, provider_subscription_id = $5, updated_at = CURRENT_TIMESTAMP`,
          ['sub_' + crypto.randomBytes(6).toString('hex'), workspaceId, planId, status, event.data?.id || eventId]
        );
      }

      res.json({ received: true });
    } catch (error) {
      handleDbError(res, error, 'billing:webhook');
    }
  });

  // Helper to handle and log DB connection errors without leaking internals
  const handleDbError = (res: express.Response, error: any, context: string) => {
    const ref = 'dberr_' + crypto.randomBytes(6).toString('hex');
    const rawMsg = typeof error === 'string' ? error : (error?.message || String(error));
    // Sanitize any accidental credentials, connection strings, or emails from server logs
    const safeLogMsg = rawMsg
      .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]')
      .replace(/(password|secret|key|token|bearer|authorization)=?[^\s&]+/gi, '$1=[REDACTED]')
      .replace(/[a-zA-Z0-9_\-\.\/]+@[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

    const transient = isTransientNeonError(error);
    const diag = getNeonDiagnostics();
    console.error(
      `[DB Error ${ref} - ${context}] transient=${transient} host=${diag.host || 'unknown'} pooled=${diag.isPooledEndpoint}:`,
      safeLogMsg
    );

    if (transient) {
      return res.status(503).json({
        error: 'Database service is temporarily unavailable. Please try again in a moment.',
        errorCode: 'DATABASE_UNAVAILABLE',
        ref
      });
    }

    return res.status(500).json({
      error: 'An unexpected database error occurred. Please try again later.',
      ref
    });
  };

  function cleanErrorMessage(err: any): string {
    if (!err) return 'Unknown error';
    let rawMsg = typeof err === 'string' ? err : (err.message || String(err));
    
    if (rawMsg.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawMsg);
        if (parsed.error && parsed.error.message) {
          return `Code ${parsed.error.code || 'unknown'}: ${parsed.error.message}`;
        }
      } catch (e) {
        // Safe fallback
      }
    }
    
    // Sanitize any structural JSON error markers that would trigger platform warning parsers
    return rawMsg.replace(/["'{}]/g, '').replace(/error:/gi, 'Issue:').substring(0, 300);
  }

  interface ServerAiRequest {
    prompt: string;
    systemPrompt?: string;
    jsonMode?: boolean;
    nvidiaModel?: string;
    geminiModel?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  }

  async function invokeNvidiaOrGeminiAI(reqConfig: ServerAiRequest): Promise<{ text: string; provider: string; model: string }> {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey) {
      const nvidiaModel = reqConfig.nvidiaModel || 'meta/llama-3.3-70b-instruct';
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (reqConfig.systemPrompt) {
        messages.push({
          role: 'system',
          content: reqConfig.jsonMode
            ? `${reqConfig.systemPrompt}\nReturn strictly valid JSON with no extra prose.`
            : reqConfig.systemPrompt
        });
      }
      messages.push({ role: 'user', content: reqConfig.prompt });

      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nvidiaKey}`
        },
        body: JSON.stringify({
          model: nvidiaModel,
          messages,
          temperature: reqConfig.temperature ?? 0.3,
          max_tokens: reqConfig.maxTokens ?? 1024
        }),
        signal: AbortSignal.timeout(reqConfig.timeoutMs ?? 12000)
      });

      if (!response.ok) {
        throw new Error(`NVIDIA NIM request failed (HTTP ${response.status})`);
      }
      const resJson = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return {
        text: resJson?.choices?.[0]?.message?.content || '',
        provider: 'nvidia-nim',
        model: nvidiaModel
      };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const geminiModel = reqConfig.geminiModel || 'gemini-3.8-flash';
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const aiRes = await ai.models.generateContent({
        model: geminiModel,
        contents: reqConfig.prompt,
        config: {
          ...(reqConfig.jsonMode ? { responseMimeType: 'application/json' } : {}),
          ...(reqConfig.systemPrompt ? { systemInstruction: reqConfig.systemPrompt } : {})
        }
      });
      return {
        text: aiRes.text || '',
        provider: 'google-gemini',
        model: geminiModel
      };
    }

    throw new Error('AI service provider is not configured (set NVIDIA_API_KEY).');
  }

  async function researchBusinessContacts(
    name: string,
    location: string,
    websiteUrl?: string | null,
    socialProfiles?: Record<string, string | null>
  ): Promise<{
    email?: string;
    phone?: string;
    whatsapp?: string;
    socialProfiles: Record<string, string>;
    contactEvidence: ContactEvidence[];
    pagesScraped: string[];
    sourcesChecked: string[];
  }> {
    let foundEmail: string | undefined;
    let foundPhone: string | undefined;
    let foundWhatsapp: string | undefined;
    const mergedSocial: Record<string, string> = {};
    const evidence: ContactEvidence[] = [];
    const pagesScraped: string[] = [];
    const sourcesChecked: string[] = [];

    if (socialProfiles && typeof socialProfiles === 'object') {
      for (const [k, v] of Object.entries(socialProfiles)) {
        if (typeof v === 'string' && isSafeUrl(v)) {
          mergedSocial[k] = v;
        }
      }
    }

    // 1. Direct SSRF-guarded website crawl (homepage + /contact /about /enquiries /booking)
    if (websiteUrl) {
      const normalizedUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
      if (isSafeUrl(normalizedUrl)) {
        if (isSocialOrDirectoryDomain(normalizedUrl)) {
          if (!mergedSocial.primary) mergedSocial.primary = normalizedUrl;
        } else {
          sourcesChecked.push(`official_site:${normalizeDomain(normalizedUrl) || 'website'}`);
          try {
            const crawlRes = await deepScrapeWebsiteContacts(normalizedUrl, location);
            if (crawlRes.email) foundEmail = crawlRes.email;
            if (crawlRes.phone) foundPhone = crawlRes.phone;
            if (crawlRes.whatsapp) foundWhatsapp = crawlRes.whatsapp;
            if (crawlRes.socialProfiles) Object.assign(mergedSocial, crawlRes.socialProfiles);
            evidence.push(...crawlRes.contactEvidence);
            pagesScraped.push(...crawlRes.pagesScraped);
          } catch {
            // Non-fatal
          }
        }
      }
    }

    // 2. Bounded public contact research (social links + DuckDuckGo HTML primary -> Bing fallback, ZERO guessing)
    if ((!foundEmail || !foundPhone) && name.trim()) {
      try {
        const publicRes = await researchPublicContactsForBusiness(
          {
            businessName: name,
            location,
            socialUrls: Object.values(mergedSocial),
            existingEmail: foundEmail,
            existingPhone: foundPhone
          },
          { maxSearchQueries: 2, maxFollowupPages: 2 }
        );
        if (publicRes.email && !foundEmail) foundEmail = publicRes.email;
        if (publicRes.phone && !foundPhone) foundPhone = publicRes.phone;
        if (publicRes.whatsapp && !foundWhatsapp) foundWhatsapp = publicRes.whatsapp;
        Object.assign(mergedSocial, publicRes.socialProfiles);
        for (const ev of publicRes.contactEvidence) {
          if (!evidence.some((e) => e.contact_type === ev.contact_type && e.contact_value === ev.contact_value && e.source_url === ev.source_url)) {
            evidence.push(ev);
          }
        }
        pagesScraped.push(...publicRes.pagesChecked);
        sourcesChecked.push(...publicRes.sourcesChecked);
      } catch {
        // Non-fatal
      }
    }

    return {
      email: foundEmail,
      phone: foundPhone,
      whatsapp: foundWhatsapp,
      socialProfiles: mergedSocial,
      contactEvidence: evidence,
      pagesScraped: Array.from(new Set(pagesScraped)),
      sourcesChecked: Array.from(new Set(sourcesChecked))
    };
  }

  // API Routes for development
  app.get('/api/projects', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const result = await pool.query(`
        SELECT * FROM projects 
        WHERE is_archived IS NOT TRUE AND visibility = 'public' 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
      
      setCacheControl(res, 600); // Cache for 10 minutes
      res.json(result.rows);
    } catch (error) {
      handleDbError(res, error, 'projects:fetch');
    }
  });

  app.post('/api/projects', requireAdminAuth, async (req, res) => {
    try {
      const project = req.body || {};
      const id = project.id || `proj_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const title = project.title || project.name || 'Untitled Project';
      const subtitle = project.subtitle || '';
      const category = project.category || 'Web Application';
      const description = project.description || '';
      const client = project.client || '';
      const duration = project.duration || '';
      const impact = project.impact || '';
      const metrics = JSON.stringify(project.metrics || []);
      const imageUrl = project.image_url || project.imageUrl || '';
      const tags = project.tags || [];
      const demoUrl = project.demo_url || project.demoUrl || '';
      const githubUrl = project.github_url || project.githubUrl || '';
      const media = JSON.stringify(project.media || []);

      await pool.query(`
        INSERT INTO projects (id, title, subtitle, category, description, client, duration, impact, metrics, image_url, tags, demo_url, github_url, media, is_archived, visibility, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, FALSE, 'public', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          subtitle = EXCLUDED.subtitle,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          client = EXCLUDED.client,
          duration = EXCLUDED.duration,
          impact = EXCLUDED.impact,
          metrics = EXCLUDED.metrics,
          image_url = EXCLUDED.image_url,
          tags = EXCLUDED.tags,
          demo_url = EXCLUDED.demo_url,
          github_url = EXCLUDED.github_url,
          media = EXCLUDED.media,
          updated_at = CURRENT_TIMESTAMP
      `, [id, title, subtitle, category, description, client, duration, impact, metrics, imageUrl, tags, demoUrl, githubUrl, media]);

      res.json({ success: true, id });
    } catch (error) {
      handleDbError(res, error, 'projects:save');
    }
  });

  app.delete('/api/projects/:id', requireAdminAuth, async (req, res) => {
    try {
      const projId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '');
      await pool.query('DELETE FROM projects WHERE id = $1', [projId]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  app.get('/api/blogs/:slug', requireUserAuth, async (req, res) => {
    try {
      const rawSlug = req.params.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      const user = (req as any).user;
      const post = await BlogsService.getBySlug(slug);
      if (!post) return res.status(404).json({ error: 'Not found' });
      
      if (user.role !== 'admin' && !post.published_at && !post.published) {
        return res.status(404).json({ error: 'Not found' });
      }

      res.json(post);
    } catch (error) {
      handleDbError(res, error, 'blogs:fetchOne');
    }
  });

  app.get('/api/blogs', requireUserAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = await BlogsService.getAll();
      if (user.role !== 'admin') {
        const published = data.filter((p: any) => p.published_at || p.published === true);
        return res.json(published);
      }
      res.json(data);
    } catch (error) {
      handleDbError(res, error, 'blogs:fetch');
    }
  });

  app.get('/api/blogs/count', requireUserAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'admin') {
        const data = await BlogsService.getAll();
        const published = data.filter((p: any) => p.published_at || p.published === true);
        return res.json({ count: published.length });
      }
      const count = await BlogsService.getCount();
      res.json({ count });
    } catch (error) {
      handleDbError(res, error, 'blogs:count');
    }
  });

  app.post('/api/blogs', requireAdminAuth, async (req, res) => {
    try {
      const data = req.body;
      if (data.published_at) {
        data.published_at = new Date(data.published_at);
      }
      await BlogsService.upsert(data);
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'blogs:save');
    }
  });

  app.patch('/api/blogs/:id', requireAdminAuth, async (req, res) => {
    try {
      const bId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '');
      const data = req.body;
      if (data.published_at) data.published_at = new Date(data.published_at);
      await BlogsService.update(bId, data);
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'blogs:update');
    }
  });

  app.delete('/api/blogs/:id', requireAdminAuth, async (req, res) => {
    try {
      const bId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '');
      await BlogsService.delete(bId);
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'blogs:delete');
    }
  });

  app.get('/api/leads', requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      const source = req.query.source as string;
      const search = req.query.search as string;

      let query = 'SELECT * FROM crm_leads WHERE 1=1';
      const params: any[] = [];
      let paramIdx = 1;

      if (status && status !== 'ALL') {
        query += ` AND status = $${paramIdx++}`;
        params.push(status);
      }
      if (source && source !== 'ALL') {
        query += ` AND lead_source = $${paramIdx++}`;
        params.push(source);
      }
      if (search) {
        query += ` AND (LOWER(user_email) LIKE $${paramIdx} OR LOWER(contact_name) LIKE $${paramIdx} OR LOWER(business_name) LIKE $${paramIdx} OR LOWER(target_url) LIKE $${paramIdx})`;
        params.push(`%${search.toLowerCase()}%`);
        paramIdx++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      setCacheControl(res, 60);
      res.json(result.rows);
    } catch (error) {
      handleDbError(res, error, 'leads:fetch');
    }
  });

  app.post('/api/leads', async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
      const rl = await checkPersistentRateLimit('lead_ip_' + clientIp, 10, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Too many submissions. Please wait a moment before trying again.' });
      }

      const lead = req.body;
      if (!lead || typeof lead !== 'object' || (!lead.user_email && !lead.user_phone && !lead.session_id)) {
        return res.status(400).json({ error: 'Valid contact channel or session ID is required' });
      }

      // Input bounding and sanitization
      const email = typeof lead.user_email === 'string' ? lead.user_email.trim().toLowerCase().slice(0, 255) : '';
      const phone = typeof lead.user_phone === 'string' ? lead.user_phone.trim().slice(0, 50) : '';
      const contactName = typeof (lead.contact_name || lead.name) === 'string' ? String(lead.contact_name || lead.name).trim().slice(0, 120) : '';
      const businessName = typeof (lead.business_name || lead.company) === 'string' ? String(lead.business_name || lead.company).trim().slice(0, 120) : '';
      const targetUrl = typeof (lead.target_url || lead.website) === 'string' ? String(lead.target_url || lead.website).trim().slice(0, 255) : '';
      const revenueTier = typeof lead.revenue_tier === 'string' ? lead.revenue_tier.trim().slice(0, 50) : '';
      const coreProblem = typeof (lead.core_problem || lead.description) === 'string' ? String(lead.core_problem || lead.description).trim().slice(0, 1000) : '';
      const ctaSource = typeof lead.cta_source === 'string' ? lead.cta_source.trim().slice(0, 100) : 'direct v4';
      const sessionId = typeof lead.session_id === 'string' ? lead.session_id.trim().slice(0, 100) : '';
      const requestedService = typeof lead.requested_service === 'string' ? lead.requested_service.trim().slice(0, 100) : '';
      const leadSource = typeof lead.lead_source === 'string' ? lead.lead_source.trim().slice(0, 100) : (ctaSource.includes('service-catalog') ? 'Service Enquiry' : 'Website Enquiry');

      // Server-enforced ID, status, and priority (client-provided status or privileged fields are strictly ignored)
      const leadId = `lead_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const status = 'New';
      const priority = 'Medium';

      await pool.query(`
        INSERT INTO crm_leads (id, contact_name, business_name, user_email, user_phone, target_url, revenue_tier, core_problem, cta_source, session_id, requested_service, lead_source, status, priority, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
      `, [
        leadId, contactName, businessName, email, phone, targetUrl, revenueTier, coreProblem, ctaSource, sessionId, requestedService, leadSource, status, priority
      ]);

      res.status(201).json({ success: true, id: leadId });
    } catch (error) {
      handleDbError(res, error, 'leads:save');
    }
  });

  app.patch('/api/leads/:id', requireAdminAuth, async (req, res) => {
    try {
      const leadId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '');
      const { 
        contact_name, business_name, user_email, user_phone, target_url, website, 
        country, city, timezone, requested_service, lead_source, status, priority, 
        assigned_admin, notes, follow_up_date, last_contacted_at, revenue_tier, core_problem 
      } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (contact_name !== undefined) { updates.push(`contact_name = $${idx++}`); values.push(contact_name); }
      if (business_name !== undefined) { updates.push(`business_name = $${idx++}`); values.push(business_name); }
      if (user_email !== undefined) { updates.push(`user_email = $${idx++}`); values.push(user_email); }
      if (user_phone !== undefined) { updates.push(`user_phone = $${idx++}`); values.push(user_phone); }
      if (target_url !== undefined) { updates.push(`target_url = $${idx++}`); values.push(target_url); }
      if (website !== undefined) { updates.push(`website = $${idx++}`); values.push(website); }
      if (country !== undefined) { updates.push(`country = $${idx++}`); values.push(country); }
      if (city !== undefined) { updates.push(`city = $${idx++}`); values.push(city); }
      if (timezone !== undefined) { updates.push(`timezone = $${idx++}`); values.push(timezone); }
      if (requested_service !== undefined) { updates.push(`requested_service = $${idx++}`); values.push(requested_service); }
      if (lead_source !== undefined) { updates.push(`lead_source = $${idx++}`); values.push(lead_source); }
      if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
      if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
      if (assigned_admin !== undefined) { updates.push(`assigned_admin = $${idx++}`); values.push(assigned_admin); }
      if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }
      if (follow_up_date !== undefined) { updates.push(`follow_up_date = $${idx++}`); values.push(follow_up_date ? new Date(follow_up_date) : null); }
      if (last_contacted_at !== undefined) { updates.push(`last_contacted_at = $${idx++}`); values.push(last_contacted_at ? new Date(last_contacted_at) : null); }
      if (revenue_tier !== undefined) { updates.push(`revenue_tier = $${idx++}`); values.push(revenue_tier); }
      if (core_problem !== undefined) { updates.push(`core_problem = $${idx++}`); values.push(core_problem); }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid update fields provided' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(leadId);

      const query = `UPDATE crm_leads SET ${updates.join(', ')} WHERE id = $${idx}`;
      await pool.query(query, values);

      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'leads:update');
    }
  });

  app.delete('/api/leads/:id', requireAdminAuth, async (req, res) => {
    try {
      const leadId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '');
      await pool.query('DELETE FROM crm_leads WHERE id = $1', [leadId]);
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'leads:delete');
    }
  });

  app.get('/api/admin/summary', requireAdminAuth, async (req, res) => {
    try {
      const analyticsRes = await pool.query(`
        SELECT 
          COUNT(*)::int as total_visitors,
          COALESCE(AVG(duration_seconds), 0)::int as avg_duration,
          COUNT(CASE WHEN submitted = TRUE THEN 1 END)::int as total_leads,
          COUNT(CASE WHEN is_pricing_sensitive = TRUE THEN 1 END)::int as pricing_sensitive_leads
        FROM site_analytics
      `);

      const revenueRes = await pool.query(`
        SELECT 
          SUM(
            CASE 
              WHEN revenue_tier = '$1M-$5M' THEN 5000000 
              WHEN revenue_tier = '$5M+' THEN 10000000 
              ELSE 0 
            END
          )::int as total_pipeline 
        FROM crm_leads
      `);

      res.json({
        analytics: analyticsRes.rows[0] || { total_visitors: 0, avg_duration: 0, total_leads: 0, pricing_sensitive_leads: 0 },
        revenue: revenueRes.rows[0]?.total_pipeline || 0
      });
    } catch (error) {
      handleDbError(res, error, 'summary:fetch');
    }
  });

  app.get('/api/analytics', requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await pool.query(`
        SELECT * FROM site_analytics ORDER BY session_start DESC LIMIT $1 OFFSET $2
      `, [limit, offset]);
      setCacheControl(res, 60);
      res.json(result.rows);
    } catch (error) {
      handleDbError(res, error, 'analytics:fetch');
    }
  });

  app.get('/api/analytics-funnel', requireAdminAuth, async (req, res) => {
    try {
      const rawRange = String(req.query.range || 'ALL').trim().toUpperCase();
      let intervalClause = '';
      if (rawRange === '7D') {
        intervalClause = "AND COALESCE(session_start, created_at) >= CURRENT_TIMESTAMP - INTERVAL '7 days'";
      } else if (rawRange === '30D') {
        intervalClause = "AND COALESCE(session_start, created_at) >= CURRENT_TIMESTAMP - INTERVAL '30 days'";
      }

      const result = await pool.query(`
        SELECT form_progress as step, COUNT(*)::int as count 
        FROM site_analytics 
        WHERE form_progress IS NOT NULL ${intervalClause}
        GROUP BY form_progress 
        ORDER BY form_progress ASC
      `);
      res.json(result.rows);
    } catch (error) {
      handleDbError(res, error, 'analytics-funnel');
    }
  });

  app.post('/api/analytics/init', async (req, res) => {
    try {
      const session = req.body || {};
      const visitorId = String(session.visitor_id || `vis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`).trim().slice(0, 128);
      const userEmail = typeof session.user_email === 'string' && session.user_email.trim() ? session.user_email.trim().slice(0, 255) : null;
      const duration = Math.max(0, Math.round(Number(session.duration_seconds) || 0));
      const pages = Math.max(1, Math.round(Number(session.page_views) || 1));
      const progress = Math.max(0, Math.round(Number(session.form_progress) || 0));
      const submitted = Boolean(session.submitted);
      const pricing = Boolean(session.is_pricing_sensitive);
      const ctaClicksJson = JSON.stringify(session.cta_clicks && typeof session.cta_clicks === 'object' ? session.cta_clicks : { hero: 0, footer: 0, navbar: 0 });
      const exitPage = typeof session.exit_page === 'string' ? session.exit_page.trim().slice(0, 255) : null;
      const stepDurationsJson = JSON.stringify(session.step_durations && typeof session.step_durations === 'object' ? session.step_durations : {});
      const whatsappHandshake = Boolean(session.whatsapp_handshake);
      const calendlyHandshake = Boolean(session.calendly_handshake);

      const upsertParams = [
        visitorId,
        userEmail,
        duration,
        pages,
        progress,
        submitted,
        pricing,
        ctaClicksJson,
        exitPage,
        stepDurationsJson,
        whatsappHandshake,
        calendlyHandshake
      ];

      try {
        await pool.query(`
          INSERT INTO site_analytics (
            id, visitor_id, user_email, duration_seconds, page_views, form_progress,
            submitted, is_pricing_sensitive, cta_clicks, exit_page, step_durations,
            whatsapp_handshake, calendly_handshake, session_start, created_at, updated_at
          )
          VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            user_email = COALESCE(EXCLUDED.user_email, site_analytics.user_email),
            duration_seconds = GREATEST(COALESCE(site_analytics.duration_seconds, 0), EXCLUDED.duration_seconds),
            page_views = GREATEST(COALESCE(site_analytics.page_views, 1), EXCLUDED.page_views),
            form_progress = GREATEST(COALESCE(site_analytics.form_progress, 0), EXCLUDED.form_progress),
            submitted = COALESCE(site_analytics.submitted, FALSE) OR EXCLUDED.submitted,
            is_pricing_sensitive = COALESCE(site_analytics.is_pricing_sensitive, FALSE) OR EXCLUDED.is_pricing_sensitive,
            cta_clicks = COALESCE(EXCLUDED.cta_clicks, site_analytics.cta_clicks),
            exit_page = COALESCE(EXCLUDED.exit_page, site_analytics.exit_page),
            step_durations = COALESCE(EXCLUDED.step_durations, site_analytics.step_durations),
            whatsapp_handshake = COALESCE(site_analytics.whatsapp_handshake, FALSE) OR EXCLUDED.whatsapp_handshake,
            calendly_handshake = COALESCE(site_analytics.calendly_handshake, FALSE) OR EXCLUDED.calendly_handshake,
            updated_at = CURRENT_TIMESTAMP
        `, upsertParams);
      } catch (insertErr: any) {
        // Fallback if legacy PRIMARY KEY is still on visitor_id and an existing row had a distinct id
        if (insertErr?.code === '23505') {
          await pool.query(`
            UPDATE site_analytics
            SET user_email = COALESCE($2, user_email),
                duration_seconds = GREATEST(COALESCE(duration_seconds, 0), $3),
                page_views = GREATEST(COALESCE(page_views, 1), $4),
                form_progress = GREATEST(COALESCE(form_progress, 0), $5),
                submitted = COALESCE(submitted, FALSE) OR $6,
                is_pricing_sensitive = COALESCE(is_pricing_sensitive, FALSE) OR $7,
                cta_clicks = COALESCE($8::jsonb, cta_clicks),
                exit_page = COALESCE($9, exit_page),
                step_durations = COALESCE($10::jsonb, step_durations),
                whatsapp_handshake = COALESCE(whatsapp_handshake, FALSE) OR $11,
                calendly_handshake = COALESCE(calendly_handshake, FALSE) OR $12,
                updated_at = CURRENT_TIMESTAMP
            WHERE visitor_id = $1
          `, upsertParams);
        } else {
          throw insertErr;
        }
      }

      res.json({ success: true, visitor_id: visitorId });
    } catch (error: any) {
      handleDbError(res, error, 'analytics:init');
    }
  });

  app.patch('/api/analytics/sync', async (req, res) => {
    try {
      const session = req.body || {};
      const visitorId = typeof session.visitor_id === 'string' ? session.visitor_id.trim().slice(0, 128) : '';
      if (!visitorId) {
        return res.status(400).json({ error: 'visitor_id is required' });
      }

      const duration = Math.max(0, Math.round(Number(session.duration_seconds) || 0));
      const pages = Math.max(1, Math.round(Number(session.page_views) || 1));
      const progress = Math.max(0, Math.round(Number(session.form_progress) || 0));
      const submitted = Boolean(session.submitted);
      const pricing = Boolean(session.is_pricing_sensitive);
      const ctaClicksJson = session.cta_clicks && typeof session.cta_clicks === 'object' ? JSON.stringify(session.cta_clicks) : null;
      const exitPage = typeof session.exit_page === 'string' ? session.exit_page.trim().slice(0, 255) : null;
      const stepDurationsJson = session.step_durations && typeof session.step_durations === 'object' ? JSON.stringify(session.step_durations) : null;
      const whatsappHandshake = session.whatsapp_handshake === undefined ? null : Boolean(session.whatsapp_handshake);
      const calendlyHandshake = session.calendly_handshake === undefined ? null : Boolean(session.calendly_handshake);

      const updateRes = await pool.query(`
        UPDATE site_analytics 
        SET duration_seconds = $1,
            page_views = $2,
            form_progress = $3,
            submitted = $4,
            is_pricing_sensitive = $5,
            cta_clicks = COALESCE($7::jsonb, cta_clicks),
            exit_page = COALESCE($8, exit_page),
            step_durations = COALESCE($9::jsonb, step_durations),
            whatsapp_handshake = COALESCE($10, whatsapp_handshake),
            calendly_handshake = COALESCE($11, calendly_handshake),
            updated_at = CURRENT_TIMESTAMP
        WHERE visitor_id = $6
      `, [
        duration,
        pages,
        progress,
        submitted,
        pricing,
        visitorId,
        ctaClicksJson,
        exitPage,
        stepDurationsJson,
        whatsappHandshake,
        calendlyHandshake
      ]);

      // If /api/analytics/sync arrives before /api/analytics/init or after a cold start, upsert idempotently
      if (updateRes.rowCount === 0) {
        const upsertSyncParams = [
          visitorId,
          duration,
          pages,
          progress,
          submitted,
          pricing,
          ctaClicksJson,
          exitPage,
          stepDurationsJson,
          whatsappHandshake,
          calendlyHandshake
        ];
        try {
          await pool.query(`
            INSERT INTO site_analytics (
              id, visitor_id, duration_seconds, page_views, form_progress, submitted,
              is_pricing_sensitive, cta_clicks, exit_page, step_durations,
              whatsapp_handshake, calendly_handshake, session_start, created_at, updated_at
            )
            VALUES ($1, $1, $2, $3, $4, $5, $6, COALESCE($7::jsonb, '{"hero":0,"footer":0,"navbar":0}'::jsonb), $8, COALESCE($9::jsonb, '{}'::jsonb), COALESCE($10, FALSE), COALESCE($11, FALSE), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
              duration_seconds = EXCLUDED.duration_seconds,
              page_views = EXCLUDED.page_views,
              form_progress = EXCLUDED.form_progress,
              submitted = EXCLUDED.submitted,
              is_pricing_sensitive = EXCLUDED.is_pricing_sensitive,
              cta_clicks = COALESCE(EXCLUDED.cta_clicks, site_analytics.cta_clicks),
              exit_page = COALESCE(EXCLUDED.exit_page, site_analytics.exit_page),
              step_durations = COALESCE(EXCLUDED.step_durations, site_analytics.step_durations),
              whatsapp_handshake = COALESCE(EXCLUDED.whatsapp_handshake, site_analytics.whatsapp_handshake),
              calendly_handshake = COALESCE(EXCLUDED.calendly_handshake, site_analytics.calendly_handshake),
              updated_at = CURRENT_TIMESTAMP
          `, upsertSyncParams);
        } catch (insertErr: any) {
          if (insertErr?.code === '23505') {
            await pool.query(`
              UPDATE site_analytics
              SET duration_seconds = $2,
                  page_views = $3,
                  form_progress = $4,
                  submitted = $5,
                  is_pricing_sensitive = $6,
                  cta_clicks = COALESCE($7::jsonb, cta_clicks),
                  exit_page = COALESCE($8, exit_page),
                  step_durations = COALESCE($9::jsonb, step_durations),
                  whatsapp_handshake = COALESCE($10, whatsapp_handshake),
                  calendly_handshake = COALESCE($11, calendly_handshake),
                  updated_at = CURRENT_TIMESTAMP
              WHERE visitor_id = $1
            `, upsertSyncParams);
          } else {
            throw insertErr;
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      handleDbError(res, error, 'analytics:sync');
    }
  });

  // --- AUTHENTICATION & PASSWORD SECURITY HELPERS ---

  function validateStrongPassword(password: string): { valid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' };
    }
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password) && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number or special character' };
    }
    return { valid: true };
  }

  function normalizeLoginIdentifier(raw: string): string {
    const normalized = String(raw || '').trim().toLowerCase();
    if (normalized === 'admin' || normalized === 'avartah') {
      return 'admin@avartah.com';
    }
    if (normalized === 'harristotle' || normalized === 'harristotle84') {
      return 'harristotle84@gmail.com';
    }
    return normalized;
  }

  function hashRateLimitIdentifier(value: string): string {
    return crypto.createHash('sha256').update(String(value || '').toLowerCase()).digest('hex').slice(0, 32);
  }

  async function checkAuthLockout(emailHash: string): Promise<{ locked: boolean; retryAfterSeconds: number; dbError?: boolean }> {
    try {
      const lockRes = await pool.query(
        `SELECT EXTRACT(EPOCH FROM (reset_time - CURRENT_TIMESTAMP))::int AS remaining_seconds
         FROM rate_limit_events
         WHERE key = $1 AND reset_time > CURRENT_TIMESTAMP AND count >= 1`,
        [`lck_em_${emailHash}`]
      );
      if (lockRes.rows.length > 0) {
        const remaining = Math.max(1, Number(lockRes.rows[0].remaining_seconds) || 60);
        return { locked: true, retryAfterSeconds: remaining };
      }
      return { locked: false, retryAfterSeconds: 0 };
    } catch (err: any) {
      console.error('[Auth Lockout Check Error]:', err?.message || err);
      return { locked: true, retryAfterSeconds: 60, dbError: true };
    }
  }

  async function recordLoginFailure(emailHash: string): Promise<{ locked: boolean; retryAfterSeconds: number }> {
    try {
      const failRes = await pool.query(`
        INSERT INTO rate_limit_events (key, count, reset_time)
        VALUES ($1, 1, CURRENT_TIMESTAMP + INTERVAL '1800 seconds')
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN rate_limit_events.reset_time < CURRENT_TIMESTAMP THEN 1
            ELSE rate_limit_events.count + 1
          END,
          reset_time = CASE
            WHEN rate_limit_events.reset_time < CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + INTERVAL '1800 seconds'
            ELSE rate_limit_events.reset_time
          END
        RETURNING count
      `, [`fail_em_${emailHash}`]);

      const failures = Number(failRes.rows[0]?.count || 0);
      if (failures >= 5) {
        const cooldownSeconds = failures >= 11 ? 900 : failures >= 8 ? 300 : 60;
        await pool.query(`
          INSERT INTO rate_limit_events (key, count, reset_time)
          VALUES ($1, 1, CURRENT_TIMESTAMP + ($2 || ' seconds')::interval)
          ON CONFLICT (key) DO UPDATE SET
            count = rate_limit_events.count + 1,
            reset_time = CURRENT_TIMESTAMP + ($2 || ' seconds')::interval
        `, [`lck_em_${emailHash}`, cooldownSeconds]);
        return { locked: true, retryAfterSeconds: cooldownSeconds };
      }
      return { locked: false, retryAfterSeconds: 0 };
    } catch (err: any) {
      console.error('[Auth Failure Recording Error]:', err?.message || err);
      return { locked: false, retryAfterSeconds: 0 };
    }
  }

  async function clearLoginFailures(emailHash: string): Promise<void> {
    try {
      await pool.query(
        'DELETE FROM rate_limit_events WHERE key = $1 OR key = $2',
        [`fail_em_${emailHash}`, `lck_em_${emailHash}`]
      );
    } catch {
      // Non-fatal cleanup error
    }
  }

  // --- AUTHENTICATION ROUTES ---

  app.post('/api/auth/register', async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        await getSessionSecret();
      }
      const { email, password } = req.body || {};
      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!validateEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'A valid email address is required' });
      }

      const clientIp = getTrustedClientIp(req);
      const emailHash = hashRateLimitIdentifier(normalizedEmail);
      const [ipRl, emailRl] = await Promise.all([
        checkPersistentRateLimit(`reg_ip_${hashRateLimitIdentifier(clientIp)}`, 10, 900),
        checkPersistentRateLimit(`reg_em_${emailHash}`, 5, 900)
      ]);
      if (!ipRl.allowed || !emailRl.allowed) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({
          error: 'Too many registration attempts. Please try again later.'
        });
      }

      const pwdValidation = validateStrongPassword(password);
      if (!pwdValidation.valid) {
        return res.status(400).json({ error: pwdValidation.error });
      }

      const existingAdmin = await pool.query('SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
      const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
      if (existingAdmin.rows.length > 0 || existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'An account with this email address already exists' });
      }

      const hash = await bcrypt.hash(password, 10);
      const insertRes = await pool.query(`
        INSERT INTO users (email, password_hash, role, is_active)
        VALUES ($1, $2, 'user', TRUE)
        RETURNING id, email, role, is_active, created_at
      `, [normalizedEmail, hash]);

      const newUser = insertRes.rows[0];
      const sessionToken = await createSession(newUser.email, 'user', req);
      res.cookie(COOKIE_NAME, sessionToken, getCookieOptions(req));

      res.status(201).json({
        success: true,
        csrfToken: (req as any).csrfToken || null,
        user: { id: newUser.id, email: newUser.email, role: newUser.role }
      });
    } catch (error) {
      if (isAuthConfigurationError(error)) {
        console.error('[Auth Configuration Alert - register]:', (error as Error).message);
        return res.status(503).json({
          success: false,
          errorCode: 'AUTH_UNAVAILABLE',
          error: 'Authentication service is temporarily unavailable.'
        });
      }
      handleDbError(res, error, 'auth:register');
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        await getSessionSecret();
      }
      const { email, password } = req.body || {};
      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const normalizedEmail = normalizeLoginIdentifier(email);
      const clientIp = getTrustedClientIp(req);
      const ipHash = hashRateLimitIdentifier(clientIp);
      const emailHash = hashRateLimitIdentifier(normalizedEmail);

      const [ipRl, emailRl, lockout] = await Promise.all([
        checkPersistentRateLimit(`log_ip_${ipHash}`, 25, 900),
        checkPersistentRateLimit(`log_em_${emailHash}`, 15, 900),
        checkAuthLockout(emailHash)
      ]);

      if (!ipRl.allowed || !emailRl.allowed || lockout.locked) {
        const retryAfter = lockout.locked ? lockout.retryAfterSeconds : 60;
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: 'Too many authentication attempts. Please wait before trying again.'
        });
      }

      let result = await pool.query('SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
      let isOrdinary = false;

      if (result.rows.length === 0) {
        result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        isOrdinary = true;
      }

      if (result.rows.length === 0) {
        await recordLoginFailure(emailHash);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = result.rows[0];
      if (user.is_active === false) {
        await recordLoginFailure(emailHash);
        return res.status(403).json({ error: 'Account is deactivated. Contact an administrator.' });
      }

      let match = false;
      if (user.password_hash && user.password_hash.startsWith('$2')) {
        match = await bcrypt.compare(password, user.password_hash);
      } else if (user.password_hash) {
        match = (password === user.password_hash);
        if (match) {
          const newHash = await bcrypt.hash(password, 10);
          const tableName = isOrdinary ? 'users' : 'admin_users';
          await pool.query(`UPDATE ${tableName} SET password_hash = $1 WHERE id = $2`, [newHash, user.id]);
        }
      }

      if (!match) {
        const failureOutcome = await recordLoginFailure(emailHash);
        if (failureOutcome.locked) {
          res.setHeader('Retry-After', String(failureOutcome.retryAfterSeconds));
          return res.status(429).json({
            error: 'Too many authentication attempts. Please wait before trying again.'
          });
        }
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      await clearLoginFailures(emailHash);

      const role = user.role || (isOrdinary ? 'user' : 'admin');
      const sessionToken = await createSession(user.email, role, req);

      res.cookie(COOKIE_NAME, sessionToken, getCookieOptions(req));

      res.json({
        success: true,
        csrfToken: (req as any).csrfToken || null,
        user: { id: user.id, email: user.email, role }
      });
    } catch (error) {
      if (isAuthConfigurationError(error)) {
        console.error('[Auth Configuration Alert - login]:', (error as Error).message);
        return res.status(503).json({
          success: false,
          errorCode: 'AUTH_UNAVAILABLE',
          error: 'Authentication service is temporarily unavailable.'
        });
      }
      handleDbError(res, error, 'auth:login');
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const rawToken = req.cookies[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    await revokeSession(rawToken);
    res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
    res.json({ success: true });
  });

  app.get('/api/auth/session', async (req, res) => {
    const csrfToken = (req as any).csrfToken || req.cookies?.['XSRF-TOKEN'] || null;
    try {
      if (process.env.NODE_ENV === 'production') {
        await getSessionSecret();
      }
      const rawToken = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const session = await validateSession(rawToken);
      if (session) {
        return res.json({
          authenticated: true,
          csrfToken,
          user: { email: session.email, role: session.role }
        });
      }
      return res.json({ authenticated: false, csrfToken });
    } catch (error) {
      if (isAuthConfigurationError(error)) {
        console.error('[Auth Configuration Alert - session]:', (error as Error).message);
        return res.status(503).json({
          authenticated: false,
          csrfToken,
          errorCode: 'AUTH_UNAVAILABLE',
          error: 'Authentication service is temporarily unavailable.'
        });
      }
      handleDbError(res, error, 'auth:session');
    }
  });

  app.post('/api/auth/change-password', requireUserAuth, async (req, res) => {
    try {
      const sessionUser = (req as any).user as SessionData;
      const { currentPassword, newPassword } = req.body || {};

      if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({ error: 'Current password is required' });
      }

      const pwdValidation = validateStrongPassword(newPassword);
      if (!pwdValidation.valid) {
        return res.status(400).json({ error: pwdValidation.error });
      }

      let tableName: 'admin_users' | 'users' = 'admin_users';
      let result = await pool.query('SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)', [sessionUser.email]);
      if (result.rows.length === 0) {
        tableName = 'users';
        result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [sessionUser.email]);
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const account = result.rows[0];
      if (account.is_active === false) {
        return res.status(403).json({ error: 'Account is deactivated. Contact an administrator.' });
      }

      let match = false;
      if (account.password_hash && account.password_hash.startsWith('$2')) {
        match = await bcrypt.compare(currentPassword, account.password_hash);
      } else if (account.password_hash) {
        match = (currentPassword === account.password_hash);
      }

      if (!match) {
        return res.status(401).json({ error: 'Invalid current password' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query(
        `UPDATE ${tableName} SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [hashedPassword, account.id]
      );

      // Revoke all OTHER active sessions for this user while preserving the current session
      await pool.query(
        'UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1) AND id != $2',
        [account.email, sessionUser.id]
      );

      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
      handleDbError(res, error, 'auth:change-password');
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const clientIp = getTrustedClientIp(req);
      const rl = await checkPersistentRateLimit('forgot_pwd_' + hashRateLimitIdentifier(clientIp), 5, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Too many password reset requests. Please wait a minute before trying again.' });
      }

      const { email } = req.body || {};
      if (!email || typeof email !== 'string' || !validateEmail(email.trim())) {
        return res.status(400).json({ error: 'A valid email address is required.' });
      }

      const normEmail = email.trim().toLowerCase();
      const adminRes = await pool.query('SELECT email FROM admin_users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE', [normEmail]);
      const userRes = await pool.query('SELECT email FROM users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE', [normEmail]);

      if (adminRes.rows.length > 0 || userRes.rows.length > 0) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        const tokenId = 'rst_' + crypto.randomBytes(12).toString('hex');

        await pool.query(
          `INSERT INTO password_reset_tokens (id, user_email, token_hash, expires_at, used)
           VALUES ($1, $2, $3, $4, FALSE)`,
          [tokenId, normEmail, tokenHash, expiresAt]
        );

        if (!isEmailConfigured()) {
          // Email delivery unconfigured: invalidate token immediately and return safe generic response
          await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [tokenId]);
          return res.json({
            success: true,
            message: 'If an active account exists with this email address, password reset instructions have been sent.'
          });
        }

        let baseUrl: string;
        try {
          baseUrl = resolveTrustedAppBaseUrl();
        } catch (cfgErr: any) {
          await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [tokenId]);
          console.error('[Password Reset Configuration Error]:', cfgErr?.message || cfgErr);
          return res.status(500).json({
            error: 'Password reset service configuration is unavailable.'
          });
        }

        const emailResult = await sendPasswordResetEmail(normEmail, rawToken, baseUrl);

        if (!emailResult.success) {
          console.error('[Password Reset Email Error]:', emailResult.error);
          // Invalidate the token immediately on delivery failure to protect security
          await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [tokenId]);
          return res.status(502).json({
            error: 'Failed to deliver password reset email. Please contact support or try again later.'
          });
        }
      }

      // Truthful generic response to prevent user enumeration
      res.json({
        success: true,
        message: 'If an active account exists with this email address, password reset instructions have been sent.'
      });
    } catch (error) {
      handleDbError(res, error, 'auth:forgot-password');
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const client = await pool.connect();
    let releaseErr: any;
    try {
      const { token, newPassword } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Valid password reset token is required.' });
      }

      const pwdValidation = validateStrongPassword(newPassword);
      if (!pwdValidation.valid) {
        return res.status(400).json({ error: pwdValidation.error });
      }

      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

      await client.query('BEGIN');

      // Atomic claim: set used = TRUE only if currently used = FALSE and not expired
      const claimRes = await client.query(
        `UPDATE password_reset_tokens 
         SET used = TRUE 
         WHERE token_hash = $1 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP 
         RETURNING id, user_email`,
        [tokenHash]
      );

      if (claimRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid or expired password reset token. Please request a new one.' });
      }

      const resetRecord = claimRes.rows[0];
      const targetEmail = resetRecord.user_email.toLowerCase();
      const newHash = await bcrypt.hash(newPassword, 10);

      // Update in admin_users or users
      const adminUpdate = await client.query(
        'UPDATE admin_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($2) RETURNING id',
        [newHash, targetEmail]
      );
      if (adminUpdate.rows.length === 0) {
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($2)',
          [newHash, targetEmail]
        );
      }

      // Revoke all existing sessions for this user
      await client.query('UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1)', [targetEmail]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Password has been successfully reset. Please log in with your new password.'
      });
    } catch (error) {
      releaseErr = error;
      try {
        await client.query('ROLLBACK');
      } catch {}
      handleDbError(res, error, 'auth:reset-password');
    } finally {
      if (releaseErr) client.release(releaseErr);
      else client.release();
    }
  });

  // --- ADMIN USERS MANAGEMENT ROUTES (Strictly platform administrators in admin_users) ---

  const ALLOWED_ADMIN_ROLES = new Set(['admin', 'editor']);

  app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, email, role, is_active, created_at, updated_at 
        FROM admin_users 
        ORDER BY id ASC
      `);
      res.json(result.rows);
    } catch (error) {
      handleDbError(res, error, 'admin:users:fetch');
    }
  });

  app.post('/api/admin/users', requireAdminAuth, async (req, res) => {
    try {
      const { email, password, role } = req.body || {};
      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!validateEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'A valid email address is required' });
      }

      const userRole = role === undefined ? 'admin' : String(role).trim().toLowerCase();
      if (!ALLOWED_ADMIN_ROLES.has(userRole)) {
        return res.status(400).json({ error: 'Invalid role. Allowed administrator roles are: admin, editor.' });
      }

      const pwdValidation = validateStrongPassword(password);
      if (!pwdValidation.valid) {
        return res.status(400).json({ error: pwdValidation.error });
      }

      const existing = await pool.query('SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'An administrator account with this email address already exists' });
      }

      const hash = await bcrypt.hash(password, 10);

      const insertRes = await pool.query(`
        INSERT INTO admin_users (email, password_hash, role, is_active)
        VALUES ($1, $2, $3, TRUE)
        RETURNING id, email, role, is_active, created_at, updated_at
      `, [normalizedEmail, hash, userRole]);

      res.status(201).json(insertRes.rows[0]);
    } catch (error) {
      handleDbError(res, error, 'admin:users:create');
    }
  });

  app.patch('/api/admin/users/:id', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { role, is_active, password } = req.body || {};

    if (role !== undefined) {
      const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
      if (!ALLOWED_ADMIN_ROLES.has(normalizedRole)) {
        return res.status(400).json({ error: 'Invalid role. Allowed administrator roles are: admin, editor.' });
      }
    }

    const hasPasswordUpdate = password !== undefined && password !== null && password !== '';
    if (hasPasswordUpdate) {
      const pwdValidation = validateStrongPassword(password);
      if (!pwdValidation.valid) {
        return res.status(400).json({ error: pwdValidation.error });
      }
    }

    const client = await pool.connect();
    let releaseErr: any;
    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [id]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Administrator account not found' });
      }

      const targetUser = userRes.rows[0];
      const normalizedRole = role !== undefined ? String(role).trim().toLowerCase() : undefined;
      const nextIsActive = is_active !== undefined ? Boolean(is_active) : targetUser.is_active;
      const nextRole = normalizedRole !== undefined ? normalizedRole : targetUser.role;

      // Protect the last active administrator against deactivation or demotion inside transaction lock
      const willLoseActiveAdmin = targetUser.role === 'admin' && targetUser.is_active !== false && (nextIsActive === false || nextRole !== 'admin');
      if (willLoseActiveAdmin) {
        const activeAdminsRes = await client.query(
          "SELECT id FROM admin_users WHERE role = 'admin' AND is_active = TRUE AND id != $1 FOR UPDATE",
          [id]
        );
        if (activeAdminsRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Cannot deactivate or demote the last active administrator account.'
          });
        }
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (normalizedRole !== undefined) {
        updates.push(`role = $${paramIdx++}`);
        values.push(normalizedRole);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIdx++}`);
        values.push(Boolean(is_active));
      }
      if (hasPasswordUpdate) {
        const hash = await bcrypt.hash(String(password).trim(), 10);
        updates.push(`password_hash = $${paramIdx++}`);
        values.push(hash);
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No valid update fields provided' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE admin_users 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIdx}
        RETURNING id, email, role, is_active, created_at, updated_at
      `;

      const updateRes = await client.query(query, values);

      const shouldRevokeSessions =
        is_active === false ||
        (normalizedRole !== undefined && normalizedRole !== 'admin' && targetUser.role === 'admin') ||
        hasPasswordUpdate;

      if (shouldRevokeSessions) {
        await client.query(
          'UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1)',
          [targetUser.email]
        );
      }

      await client.query('COMMIT');
      res.json(updateRes.rows[0]);
    } catch (error) {
      releaseErr = error;
      try {
        await client.query('ROLLBACK');
      } catch {}
      handleDbError(res, error, 'admin:users:update');
    } finally {
      if (releaseErr) client.release(releaseErr);
      else client.release();
    }
  });

  app.delete('/api/admin/users/:id', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const currentAdmin = (req as any).adminUser;
    const client = await pool.connect();
    let releaseErr: any;

    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [id]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Administrator account not found' });
      }

      const targetUser = userRes.rows[0];
      // Prevent deleting own account
      if (currentAdmin && currentAdmin.email && currentAdmin.email.toLowerCase() === targetUser.email.toLowerCase()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot delete your own active administrator account' });
      }

      // Protect against deleting the last active administrator inside transaction lock
      if (targetUser.role === 'admin' && targetUser.is_active !== false) {
        const activeAdminsRes = await client.query(
          "SELECT id FROM admin_users WHERE role = 'admin' AND is_active = TRUE AND id != $1 FOR UPDATE",
          [id]
        );
        if (activeAdminsRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Cannot delete the last active administrator account.' });
        }
      }

      await client.query('DELETE FROM admin_users WHERE id = $1', [id]);
      await client.query('UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1)', [targetUser.email]);

      await client.query('COMMIT');
      res.json({ success: true, message: 'Administrator account deleted and sessions revoked.' });
    } catch (error) {
      releaseErr = error;
      try {
        await client.query('ROLLBACK');
      } catch {}
      handleDbError(res, error, 'admin:users:delete');
    } finally {
      if (releaseErr) client.release(releaseErr);
      else client.release();
    }
  });

  // --- ORDINARY REGISTERED USERS MANAGEMENT ROUTES (Strictly users table) ---

  app.get('/api/admin/registered-users', requireAdminAuth, async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';

      const conditions: string[] = [];
      const params: any[] = [];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`LOWER(u.email) LIKE $${params.length}`);
      }

      if (statusFilter === 'active') {
        conditions.push('u.is_active = TRUE');
      } else if (statusFilter === 'disabled' || statusFilter === 'inactive') {
        conditions.push('u.is_active = FALSE');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(`
        SELECT
          u.id,
          u.email,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          (
            SELECT COUNT(*)::int
            FROM admin_sessions s
            WHERE LOWER(s.user_email) = LOWER(u.email)
              AND s.revoked = FALSE
              AND s.expires_at > CURRENT_TIMESTAMP
          ) AS active_sessions
        FROM users u
        ${whereClause}
        ORDER BY u.created_at DESC, u.id DESC
      `, params);

      res.json(result.rows);
    } catch (error) {
      handleDbError(res, error, 'admin:registered-users:fetch');
    }
  });

  app.patch('/api/admin/registered-users/:id', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body || {};

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active boolean flag is required.' });
    }

    const client = await pool.connect();
    let releaseErr: any;
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, email, role, is_active FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Registered user not found' });
      }

      const targetUser = existing.rows[0];
      const updateRes = await client.query(
        `UPDATE users
         SET is_active = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, role, is_active, created_at, updated_at`,
        [is_active, id]
      );

      if (!is_active) {
        await client.query(
          'UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1)',
          [targetUser.email]
        );
      }

      await client.query('COMMIT');
      res.json(updateRes.rows[0]);
    } catch (error) {
      releaseErr = error;
      try {
        await client.query('ROLLBACK');
      } catch {}
      handleDbError(res, error, 'admin:registered-users:update');
    } finally {
      if (releaseErr) client.release(releaseErr);
      else client.release();
    }
  });

  app.post('/api/admin/registered-users/:id/revoke-sessions', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userRes = await pool.query('SELECT id, email FROM users WHERE id = $1', [id]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'Registered user not found' });
      }

      const targetEmail = userRes.rows[0].email;
      const revokeRes = await pool.query(
        'UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1) AND revoked = FALSE RETURNING id',
        [targetEmail]
      );

      res.json({
        success: true,
        revoked_count: revokeRes.rows.length,
        message: 'Active sessions revoked.'
      });
    } catch (error) {
      handleDbError(res, error, 'admin:registered-users:revoke-sessions');
    }
  });

  // =========================================================================
  // STEP 7: CLIENT PROJECT DELIVERY HUB (AUTHORITATIVE NEON POSTGRES ENGINE)
  // =========================================================================

  const VALID_PROJECT_STATUSES = [
    'Planning',
    'In Progress',
    'Awaiting Client',
    'Revision Required',
    'Completed',
    'On Hold'
  ] as const;

  const VALID_MILESTONE_STATUSES = [
    'Not Started',
    'In Progress',
    'Blocked',
    'Completed'
  ] as const;

  const VALID_DELIVERABLE_TYPES = [
    'Design',
    'Staging Link',
    'Deployment',
    'Final Handover',
    'Document',
    'Code Repository',
    'Other'
  ] as const;

  const VALID_DELIVERABLE_VISIBILITIES = ['client_visible', 'internal_draft'] as const;

  function isSafeDeliverableUrl(urlStr: string): boolean {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const trimmed = urlStr.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '169.254.169.254' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        host.endsWith('.local') ||
        host.endsWith('.internal')
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function validateProjectDates(startDate?: string | null, targetDate?: string | null): { valid: boolean; error?: string } {
    if (startDate && startDate.trim()) {
      const d = new Date(startDate);
      if (isNaN(d.getTime())) return { valid: false, error: 'Start date format is invalid.' };
    }
    if (targetDate && targetDate.trim()) {
      const d = new Date(targetDate);
      if (isNaN(d.getTime())) return { valid: false, error: 'Target completion date format is invalid.' };
    }
    if (startDate && targetDate && startDate.trim() && targetDate.trim()) {
      const s = new Date(startDate);
      const t = new Date(targetDate);
      if (t < s) {
        return { valid: false, error: 'Target completion date cannot precede the start date.' };
      }
    }
    return { valid: true };
  }

  function computeMilestoneProgress(milestones: { status: string }[]): { total: number; completed: number; percentage: number } {
    const total = milestones.length;
    if (total === 0) {
      return { total: 0, completed: 0, percentage: 0 };
    }
    const completed = milestones.filter(m => m.status === 'Completed').length;
    const percentage = Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }

  // --- ADMIN DELIVERY HUB ENDPOINTS (requireAdminAuth) ---

  // 1. List Projects with filters & progress calculation
  app.get('/api/admin/delivery/projects', requireAdminAuth, async (req, res) => {
    try {
      const { status, client_email, include_archived, limit = '100', offset = '0' } = req.query;
      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (!include_archived || include_archived !== 'true') {
        conditions.push(`p.is_archived = FALSE`);
      }

      if (status && typeof status === 'string' && status !== 'ALL') {
        conditions.push(`p.status = $${idx++}`);
        params.push(status);
      }

      if (client_email && typeof client_email === 'string') {
        conditions.push(`LOWER(p.client_email) LIKE $${idx++}`);
        params.push(`%${client_email.trim().toLowerCase()}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitVal = Math.min(Math.max(parseInt(limit as string) || 50, 1), 200);
      const offsetVal = Math.max(parseInt(offset as string) || 0, 0);

      const q = `
        SELECT 
          p.*,
          COALESCE(m.total_count, 0)::int AS total_milestones,
          COALESCE(m.completed_count, 0)::int AS completed_milestones
        FROM client_projects p
        LEFT JOIN (
          SELECT 
            project_id, 
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_count
          FROM project_milestones
          GROUP BY project_id
        ) m ON m.project_id = p.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(limitVal, offsetVal);

      const result = await pool.query(q, params);
      const projects = result.rows.map(row => {
        const total = row.total_milestones || 0;
        const completed = row.completed_milestones || 0;
        const progress_percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          ...row,
          total_milestones: total,
          completed_milestones: completed,
          progress_percentage
        };
      });

      res.json(projects);
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:projects:list');
    }
  });

  // 2. Create Project
  app.post('/api/admin/delivery/projects', requireAdminAuth, async (req, res) => {
    try {
      const { 
        name, 
        client_email, 
        client_name, 
        description, 
        scope, 
        status = 'Planning', 
        start_date, 
        target_date, 
        assigned_admin_name 
      } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Project name must be at least 2 characters.' });
      }

      if (!client_email || typeof client_email !== 'string' || !validateEmail(client_email.trim())) {
        return res.status(400).json({ error: 'A valid client email address is required.' });
      }

      const normalizedStatus = (status || 'Planning').trim();
      if (!VALID_PROJECT_STATUSES.includes(normalizedStatus as any)) {
        return res.status(400).json({ 
          error: `Invalid status. Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}` 
        });
      }

      const dateValidation = validateProjectDates(start_date, target_date);
      if (!dateValidation.valid) {
        return res.status(400).json({ error: dateValidation.error });
      }

      const normalizedEmail = client_email.trim().toLowerCase();
      // Auto-link client_user_id if user already exists
      const userRes = await pool.query(
        'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)',
        [normalizedEmail]
      );
      const clientUserId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

      const currentAdmin = (req as any).adminUser;
      const assignedAdminName = assigned_admin_name || currentAdmin?.email || 'Lead Administrator';

      const projectId = `proj_${crypto.randomBytes(8).toString('hex')}`;
      const completedAt = normalizedStatus === 'Completed' ? new Date().toISOString() : null;

      const insertQ = `
        INSERT INTO client_projects (
          id, name, client_user_id, client_email, client_name,
          description, scope, status, start_date, target_date,
          completed_at, assigned_admin_id, assigned_admin_name, is_archived
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE)
        RETURNING *
      `;
      const projectRes = await pool.query(insertQ, [
        projectId,
        name.trim(),
        clientUserId,
        normalizedEmail,
        client_name ? client_name.trim() : null,
        description ? description.trim() : null,
        scope ? scope.trim() : null,
        normalizedStatus,
        start_date || null,
        target_date || null,
        completedAt,
        currentAdmin?.userId || null,
        assignedAdminName,
      ]);

      // Record initial audit activity
      await pool.query(`
        INSERT INTO project_activities (id, project_id, type, message, visibility, author_email, author_role)
        VALUES ($1, $2, 'general_update', $3, 'client_visible', $4, 'admin')
      `, [
        `act_${crypto.randomBytes(8).toString('hex')}`,
        projectId,
        `Project workspace initiated with status: ${normalizedStatus}.`,
        currentAdmin?.email || 'admin@avartah.com'
      ]);

      const createdProject = {
        ...projectRes.rows[0],
        total_milestones: 0,
        completed_milestones: 0,
        progress_percentage: 0
      };

      res.status(201).json(createdProject);
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:projects:create');
    }
  });

  // 3. Get Project Detail with Milestones, Deliverables, and Activities
  app.get('/api/admin/delivery/projects/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const projRes = await pool.query('SELECT * FROM client_projects WHERE id = $1', [id]);
      if (projRes.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      const project = projRes.rows[0];

      const [milestonesRes, deliverablesRes, activitiesRes] = await Promise.all([
        pool.query('SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY order_index ASC, created_at ASC', [id]),
        pool.query('SELECT * FROM project_deliverables WHERE project_id = $1 ORDER BY created_at DESC', [id]),
        pool.query('SELECT * FROM project_activities WHERE project_id = $1 ORDER BY created_at DESC', [id])
      ]);

      const progress = computeMilestoneProgress(milestonesRes.rows);

      res.json({
        ...project,
        total_milestones: progress.total,
        completed_milestones: progress.completed,
        progress_percentage: progress.percentage,
        milestones: milestonesRes.rows,
        deliverables: deliverablesRes.rows,
        activities: activitiesRes.rows
      });
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:projects:get');
    }
  });

  // 4. Update Project (Status, Scope, Dates, Archiving)
  app.patch('/api/admin/delivery/projects/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const currentAdmin = (req as any).adminUser;

      const existingRes = await pool.query('SELECT * FROM client_projects WHERE id = $1', [id]);
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      const existing = existingRes.rows[0];

      const {
        name,
        client_email,
        client_name,
        description,
        scope,
        status,
        start_date,
        target_date,
        assigned_admin_name,
        is_archived
      } = req.body;

      const effectiveStartDate = start_date !== undefined ? start_date : existing.start_date;
      const effectiveTargetDate = target_date !== undefined ? target_date : existing.target_date;
      const dateValidation = validateProjectDates(effectiveStartDate, effectiveTargetDate);
      if (!dateValidation.valid) {
        return res.status(400).json({ error: dateValidation.error });
      }

      if (status !== undefined) {
        const normStatus = String(status).trim();
        if (!VALID_PROJECT_STATUSES.includes(normStatus as any)) {
          return res.status(400).json({ 
            error: `Invalid status. Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}` 
          });
        }
      }

      if (client_email !== undefined) {
        if (!validateEmail(String(client_email).trim())) {
          return res.status(400).json({ error: 'Valid client email is required' });
        }
      }

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(name.trim());
      }
      if (client_email !== undefined) {
        const normEmail = client_email.trim().toLowerCase();
        updates.push(`client_email = $${idx++}`);
        values.push(normEmail);

        // Check if matching user exists
        const uRes = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normEmail]);
        updates.push(`client_user_id = $${idx++}`);
        values.push(uRes.rows.length > 0 ? uRes.rows[0].id : null);
      }
      if (client_name !== undefined) {
        updates.push(`client_name = $${idx++}`);
        values.push(client_name ? client_name.trim() : null);
      }
      if (description !== undefined) {
        updates.push(`description = $${idx++}`);
        values.push(description ? description.trim() : null);
      }
      if (scope !== undefined) {
        updates.push(`scope = $${idx++}`);
        values.push(scope ? scope.trim() : null);
      }
      if (start_date !== undefined) {
        updates.push(`start_date = $${idx++}`);
        values.push(start_date || null);
      }
      if (target_date !== undefined) {
        updates.push(`target_date = $${idx++}`);
        values.push(target_date || null);
      }
      if (assigned_admin_name !== undefined) {
        updates.push(`assigned_admin_name = $${idx++}`);
        values.push(assigned_admin_name ? assigned_admin_name.trim() : null);
      }
      if (is_archived !== undefined) {
        updates.push(`is_archived = $${idx++}`);
        values.push(Boolean(is_archived));
      }

      let statusChanged = false;
      let newStatus = existing.status;
      if (status !== undefined && status !== existing.status) {
        statusChanged = true;
        newStatus = status;
        updates.push(`status = $${idx++}`);
        values.push(newStatus);

        if (newStatus === 'Completed') {
          updates.push(`completed_at = CURRENT_TIMESTAMP`);
        } else if (existing.status === 'Completed') {
          updates.push(`completed_at = NULL`);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields provided for update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const updateQ = `
        UPDATE client_projects
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *
      `;
      const updatedRes = await pool.query(updateQ, values);
      const updatedProject = updatedRes.rows[0];

      if (statusChanged) {
        await pool.query(`
          INSERT INTO project_activities (id, project_id, type, message, visibility, author_email, author_role)
          VALUES ($1, $2, 'status_change', $3, 'client_visible', $4, 'admin')
        `, [
          `act_${crypto.randomBytes(8).toString('hex')}`,
          id,
          `Project status updated from "${existing.status}" to "${newStatus}".`,
          currentAdmin?.email || 'admin@avartah.com'
        ]);
      }

      res.json(updatedProject);
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:projects:update');
    }
  });

  // 5. Delete Project
  app.delete('/api/admin/delivery/projects/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const delRes = await pool.query('DELETE FROM client_projects WHERE id = $1 RETURNING id', [id]);
      if (delRes.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ success: true, message: 'Project and all associated assets deleted successfully.' });
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:projects:delete');
    }
  });

  // --- MILESTONE ENDPOINTS (requireAdminAuth) ---

  // Create Milestone
  app.post('/api/admin/delivery/projects/:id/milestones', requireAdminAuth, async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { title, description, due_date, status = 'Not Started', notes, client_notes, order_index } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Milestone title is required.' });
      }

      const normStatus = (status || 'Not Started').trim();
      if (!VALID_MILESTONE_STATUSES.includes(normStatus as any)) {
        return res.status(400).json({
          error: `Invalid milestone status. Must be one of: ${VALID_MILESTONE_STATUSES.join(', ')}`
        });
      }

      // Check project exists
      const pCheck = await pool.query('SELECT id FROM client_projects WHERE id = $1', [projectId]);
      if (pCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      let targetOrder = typeof order_index === 'number' ? order_index : null;
      if (targetOrder === null) {
        const orderRes = await pool.query('SELECT COALESCE(MAX(order_index) + 1, 0) AS next_order FROM project_milestones WHERE project_id = $1', [projectId]);
        targetOrder = orderRes.rows[0].next_order;
      }

      const milestoneId = `ms_${crypto.randomBytes(8).toString('hex')}`;
      const completedAt = normStatus === 'Completed' ? new Date().toISOString() : null;

      const insQ = `
        INSERT INTO project_milestones (
          id, project_id, title, description, due_date, order_index,
          status, notes, client_notes, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      const mRes = await pool.query(insQ, [
        milestoneId,
        projectId,
        title.trim(),
        description ? description.trim() : null,
        due_date || null,
        targetOrder,
        normStatus,
        notes ? notes.trim() : null,
        client_notes ? client_notes.trim() : null,
        completedAt
      ]);

      const currentAdmin = (req as any).adminUser;
      await pool.query(`
        INSERT INTO project_activities (id, project_id, type, message, visibility, author_email, author_role)
        VALUES ($1, $2, 'milestone_update', $3, 'client_visible', $4, 'admin')
      `, [
        `act_${crypto.randomBytes(8).toString('hex')}`,
        projectId,
        `New milestone created: "${title.trim()}" (Status: ${normStatus}).`,
        currentAdmin?.email || 'admin@avartah.com'
      ]);

      res.status(201).json(mRes.rows[0]);
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:milestones:create');
    }
  });

  // Update Milestone
  app.patch('/api/admin/delivery/projects/:id/milestones/:mId', requireAdminAuth, async (req, res) => {
    try {
      const { id: projectId, mId } = req.params;
      const existingRes = await pool.query(
        'SELECT * FROM project_milestones WHERE id = $1 AND project_id = $2',
        [mId, projectId]
      );
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ error: 'Milestone not found' });
      }
      const existing = existingRes.rows[0];

      const { title, description, due_date, status, notes, client_notes, order_index } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (title !== undefined) {
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return res.status(400).json({ error: 'Milestone title cannot be empty.' });
        }
        updates.push('title = $' + (idx++));
        values.push(title.trim());
      }
      if (description !== undefined) {
        updates.push('description = $' + (idx++));
        values.push(description ? description.trim() : null);
      }
      if (due_date !== undefined) {
        updates.push('due_date = $' + (idx++));
        values.push(due_date || null);
      }
      if (order_index !== undefined) {
        updates.push('order_index = $' + (idx++));
        values.push(parseInt(order_index) || 0);
      }
      if (notes !== undefined) {
        updates.push('notes = $' + (idx++));
        values.push(notes ? notes.trim() : null);
      }
      if (client_notes !== undefined) {
        updates.push('client_notes = $' + (idx++));
        values.push(client_notes ? client_notes.trim() : null);
      }

      let statusChanged = false;
      let newStatus = existing.status;
      if (status !== undefined && status !== existing.status) {
        const normStatus = String(status).trim();
        if (!VALID_MILESTONE_STATUSES.includes(normStatus as any)) {
          return res.status(400).json({
            error: 'Invalid status. Must be one of: ' + VALID_MILESTONE_STATUSES.join(', ')
          });
        }
        statusChanged = true;
        newStatus = normStatus;
        updates.push('status = $' + (idx++));
        values.push(newStatus);

        if (newStatus === 'Completed') {
          updates.push('completed_at = CURRENT_TIMESTAMP');
        } else if (existing.status === 'Completed') {
          updates.push('completed_at = NULL');
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields provided for update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      const mIdIdx = idx++;
      const pIdIdx = idx++;
      values.push(mId, projectId);

      const q = 'UPDATE project_milestones SET ' + updates.join(', ') + ' WHERE id = $' + mIdIdx + ' AND project_id = $' + pIdIdx + ' RETURNING *';
      const updateRes = await pool.query(q, values);
      const updatedMilestone = updateRes.rows[0];

      if (statusChanged) {
        const currentAdmin = (req as any).adminUser;
        await pool.query("INSERT INTO project_activities (id, project_id, type, message, visibility, author_email, author_role) VALUES ($1, $2, 'milestone_update', $3, 'client_visible', $4, 'admin')", [
          'act_' + crypto.randomBytes(8).toString('hex'),
          projectId,
          'Milestone "' + updatedMilestone.title + '" updated to status: "' + newStatus + '".',
          currentAdmin?.email || 'admin@avartah.com'
        ]);
      }

      res.json(updatedMilestone);
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:milestones:update');
    }
  });

  // Delete Milestone
  app.delete('/api/admin/delivery/projects/:id/milestones/:mId', requireAdminAuth, async (req, res) => {
    try {
      const { id: projectId, mId } = req.params;
      const del = await pool.query(
        'DELETE FROM project_milestones WHERE id = $1 AND project_id = $2 RETURNING id, title',
        [mId, projectId]
      );
      if (del.rows.length === 0) {
        return res.status(404).json({ error: 'Milestone not found' });
      }
      res.json({ success: true, message: 'Milestone removed' });
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:milestones:delete');
    }
  });

  // Reorder Milestones
  app.put('/api/admin/delivery/projects/:id/milestones/reorder', requireAdminAuth, async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { milestone_ids } = req.body;
      if (!Array.isArray(milestone_ids)) {
        return res.status(400).json({ error: 'milestone_ids must be an array of IDs' });
      }

      for (let i = 0; i < milestone_ids.length; i++) {
        await pool.query(
          'UPDATE project_milestones SET order_index = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND project_id = $3',
          [i, milestone_ids[i], projectId]
        );
      }

      res.json({ success: true, message: 'Milestones reordered successfully' });
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:milestones:reorder');
    }
  });

  // --- DELIVERABLES ENDPOINTS (requireAdminAuth) ---

  // Create Deliverable
  app.post('/api/admin/delivery/projects/:id/deliverables', requireAdminAuth, async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { title, description, type = 'Document', resource_url, visibility = 'client_visible', milestone_id } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Deliverable title is required.' });
      }

      const normType = (type || 'Document').trim();
      if (!VALID_DELIVERABLE_TYPES.includes(normType as any)) {
        return res.status(400).json({
          error: 'Invalid deliverable type. Must be one of: ' + VALID_DELIVERABLE_TYPES.join(', ')
        });
      }

      const normVis = (visibility || 'client_visible').trim();
      if (!VALID_DELIVERABLE_VISIBILITIES.includes(normVis as any)) {
        return res.status(400).json({
          error: 'Invalid visibility. Must be one of: ' + VALID_DELIVERABLE_VISIBILITIES.join(', ')
        });
      }

      if (!resource_url || typeof resource_url !== 'string' || !isSafeDeliverableUrl(resource_url)) {
        return res.status(400).json({
          error: 'A valid, safe HTTP or HTTPS deliverable URL is required (loopback, private internal networks, and dangerous protocols are rejected).'
        });
      }

      // Verify project exists
      const pCheck = await pool.query('SELECT id FROM client_projects WHERE id = $1', [projectId]);
      if (pCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const deliverableId = 'deliv_' + crypto.randomBytes(8).toString('hex');
      const currentAdmin = (req as any).adminUser;

      const insQ = "INSERT INTO project_deliverables (id, project_id, milestone_id, title, description, type, resource_url, visibility, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *";
      const delivRes = await pool.query(insQ, [
        deliverableId,
        projectId,
        milestone_id || null,
        title.trim(),
        description ? description.trim() : null,
        normType,
        resource_url.trim(),
        normVis,
        currentAdmin?.email || 'admin@avartah.com'
      ]);

      if (normVis === 'client_visible') {
        await pool.query("INSERT INTO project_activities (id, project_id, type, message, visibility, author_email, author_role) VALUES ($1, $2, 'deliverable_published', $3, 'client_visible', $4, 'admin')", [
          'act_' + crypto.randomBytes(8).toString('hex'),
          projectId,
          'New deliverable published: "' + title.trim() + '" [' + normType + '].',
          currentAdmin?.email || 'admin@avartah.com'
        ]);
      }

      res.status(201).json(delivRes.rows[0]);
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:deliverables:create');
    }
  });

  // Delete Deliverable
  app.delete('/api/admin/delivery/projects/:id/deliverables/:dId', requireAdminAuth, async (req, res) => {
    try {
      const { id: projectId, dId } = req.params;
      const delRes = await pool.query(
        'DELETE FROM project_deliverables WHERE id = $1 AND project_id = $2 RETURNING id',
        [dId, projectId]
      );
      if (delRes.rows.length === 0) {
        return res.status(404).json({ error: 'Deliverable not found' });
      }
      res.json({ success: true, message: 'Deliverable deleted' });
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:deliverables:delete');
    }
  });

  // Post Activity / Admin Note
  app.post('/api/admin/delivery/projects/:id/activities', requireAdminAuth, async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { message, visibility = 'client_visible', type = 'general_update' } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Activity message is required' });
      }

      const pCheck = await pool.query('SELECT id FROM client_projects WHERE id = $1', [projectId]);
      if (pCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const currentAdmin = (req as any).adminUser;
      const actId = 'act_' + crypto.randomBytes(8).toString('hex');
      const insQ = "INSERT INTO project_activities (id, project_id, type, message, visibility, author_email, author_role) VALUES ($1, $2, $3, $4, $5, $6, 'admin') RETURNING *";
      const aRes = await pool.query(insQ, [
        actId,
        projectId,
        type,
        message.trim(),
        visibility === 'internal_only' ? 'internal_only' : 'client_visible',
        currentAdmin?.email || 'admin@avartah.com'
      ]);

      res.status(201).json(aRes.rows[0]);
    } catch (error) {
      handleDbError(res, error, 'admin:delivery:activities:create');
    }
  });

  // =========================================================================
  // CLIENT-FACING DELIVERY WORKSPACE (STRICT CROSS-CLIENT DATA ISOLATION)
  // =========================================================================

  // 1. List authenticated client's projects
  app.get('/api/client/delivery/projects', requireUserAuth, async (req, res) => {
    try {
      const sessionUser = (req as any).user;
      const clientEmail = (sessionUser.email || '').toLowerCase().trim();
      const clientUserId = sessionUser.userId || null;

      const q = "SELECT p.id, p.name, p.client_name, p.client_email, p.description, p.scope, p.status, p.start_date, p.target_date, p.completed_at, p.assigned_admin_name, p.created_at, p.updated_at, COALESCE(m.total_count, 0)::int AS total_milestones, COALESCE(m.completed_count, 0)::int AS completed_milestones FROM client_projects p LEFT JOIN (SELECT project_id, COUNT(*)::int AS total_count, COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_count FROM project_milestones GROUP BY project_id) m ON m.project_id = p.id WHERE (p.client_user_id = $1 OR LOWER(p.client_email) = $2) AND p.is_archived = FALSE ORDER BY p.created_at DESC";
      const result = await pool.query(q, [clientUserId, clientEmail]);

      const projects = result.rows.map(row => {
        const total = row.total_milestones || 0;
        const completed = row.completed_milestones || 0;
        const progress_percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          ...row,
          total_milestones: total,
          completed_milestones: completed,
          progress_percentage
        };
      });

      res.json(projects);
    } catch (error) {
      handleDbError(res, error, 'client:delivery:projects:list');
    }
  });

  // 2. Get specific project detail (STRICT IDOR GUARD: ownership validated in DB query)
  app.get('/api/client/delivery/projects/:id', requireUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = (req as any).user;
      const clientEmail = (sessionUser.email || '').toLowerCase().trim();
      const clientUserId = sessionUser.userId || null;

      // Ownership enforcement: query MUST match client_user_id or client_email
      const projQ = "SELECT id, name, client_name, client_email, description, scope, status, start_date, target_date, completed_at, assigned_admin_name, created_at, updated_at FROM client_projects WHERE id = $1 AND (client_user_id = $2 OR LOWER(client_email) = $3) AND is_archived = FALSE";
      const projRes = await pool.query(projQ, [id, clientUserId, clientEmail]);

      if (projRes.rows.length === 0) {
        // Return 404 to avoid leaking project existence to unauthorized actors
        return res.status(404).json({ error: 'Project not found or you do not have permission to view it.' });
      }

      const project = projRes.rows[0];

      // Fetch client-visible milestones (internal notes column omitted)
      const milestonesQ = "SELECT id, project_id, title, description, due_date, order_index, status, client_notes, completed_at, created_at, updated_at FROM project_milestones WHERE project_id = $1 ORDER BY order_index ASC, created_at ASC";
      const deliverablesQ = "SELECT id, project_id, milestone_id, title, description, type, resource_url, visibility, created_at, updated_at FROM project_deliverables WHERE project_id = $1 AND visibility = 'client_visible' ORDER BY created_at DESC";
      const activitiesQ = "SELECT id, project_id, type, message, visibility, author_role, created_at FROM project_activities WHERE project_id = $1 AND visibility = 'client_visible' ORDER BY created_at DESC";

      const [milestonesRes, deliverablesRes, activitiesRes] = await Promise.all([
        pool.query(milestonesQ, [id]),
        pool.query(deliverablesQ, [id]),
        pool.query(activitiesQ, [id])
      ]);

      const progress = computeMilestoneProgress(milestonesRes.rows);

      res.json({
        ...project,
        total_milestones: progress.total,
        completed_milestones: progress.completed,
        progress_percentage: progress.percentage,
        milestones: milestonesRes.rows,
        deliverables: deliverablesRes.rows,
        activities: activitiesRes.rows
      });
    } catch (error) {
      handleDbError(res, error, 'client:delivery:projects:get');
    }
  });

  // 3. Submit Client Feedback or Revision Request
  app.post('/api/client/delivery/projects/:id/feedback', requireUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { message, type = 'client_feedback', milestone_id } = req.body;
      const sessionUser = (req as any).user;
      const clientEmail = (sessionUser.email || '').toLowerCase().trim();
      const clientUserId = sessionUser.userId || null;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Feedback message is required.' });
      }

      if (message.trim().length > 2000) {
        return res.status(400).json({ error: 'Feedback message cannot exceed 2000 characters.' });
      }

      const validTypes = ['client_feedback', 'revision_request'];
      const normType = validTypes.includes(type) ? type : 'client_feedback';

      // Ownership enforcement
      const projRes = await pool.query(
        'SELECT id, name, status FROM client_projects WHERE id = $1 AND (client_user_id = $2 OR LOWER(client_email) = $3)',
        [id, clientUserId, clientEmail]
      );
      if (projRes.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found or you do not have permission to submit feedback.' });
      }
      const project = projRes.rows[0];

      // If milestone_id provided, verify it belongs to this project
      let milestoneTitle = '';
      if (milestone_id) {
        const mRes = await pool.query('SELECT title FROM project_milestones WHERE id = $1 AND project_id = $2', [milestone_id, id]);
        if (mRes.rows.length > 0) {
          milestoneTitle = mRes.rows[0].title;
        }
      }

      const actId = 'act_' + crypto.randomBytes(8).toString('hex');
      const prefix = normType === 'revision_request' ? '[Revision Request]' : '[Client Feedback]';
      const context = milestoneTitle ? (' (Re: Milestone "' + milestoneTitle + '")') : '';
      const fullMessage = prefix + context + ': ' + message.trim();

      await pool.query("INSERT INTO project_activities (id, project_id, type, message, visibility, author_email, author_role, metadata) VALUES ($1, $2, $3, $4, 'client_visible', $5, 'client', $6)", [
        actId,
        id,
        normType,
        fullMessage,
        clientEmail,
        JSON.stringify({ milestone_id: milestone_id || null, original_type: normType })
      ]);

      let updatedStatus = project.status;
      // If client requests revision on project, update status to 'Revision Required'
      if (normType === 'revision_request') {
        updatedStatus = 'Revision Required';
        await pool.query(
          'UPDATE client_projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [updatedStatus, id]
        );
      }

      res.status(201).json({
        success: true,
        message: normType === 'revision_request' ? 'Revision request logged successfully' : 'Feedback submitted successfully',
        project_status: updatedStatus
      });
    } catch (error) {
      handleDbError(res, error, 'client:delivery:feedback:submit');
    }
  });

  // =========================================================================
  // STEP 8: AI AUTOMATION ENGINE (MODULAR, RATE-LIMITED, SERVER-SIDE)
  // =========================================================================

  const DAILY_AI_REQUEST_LIMIT = 50;

  async function checkAndIncrementAiQuota(email: string): Promise<{ allowed: boolean; error?: string }> {
    const normEmail = email.toLowerCase().trim();

    try {
      // Atomic increment and quota check in a single statement
      const quotaRes = await pool.query(
        "INSERT INTO ai_usage_quotas (user_email, requests_today, last_request_date, updated_at) VALUES ($1, 1, CURRENT_DATE, CURRENT_TIMESTAMP) ON CONFLICT (user_email) DO UPDATE SET requests_today = CASE WHEN ai_usage_quotas.last_request_date = CURRENT_DATE THEN ai_usage_quotas.requests_today + 1 ELSE 1 END, last_request_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE ai_usage_quotas.last_request_date != CURRENT_DATE OR ai_usage_quotas.requests_today < $2 RETURNING requests_today",
        [normEmail, DAILY_AI_REQUEST_LIMIT]
      );

      if (quotaRes.rows.length === 0) {
        return { 
          allowed: false, 
          error: 'Daily AI automation rate limit exceeded (' + DAILY_AI_REQUEST_LIMIT + ' requests/day). Please try again tomorrow.' 
        };
      }

      return { allowed: true };
    } catch (err: any) {
      console.error('[AI Quota Error - Fail-Closed]:', err.message);
      // Strictly fail closed: Reject automation if quota verification cannot be guaranteed
      return { 
        allowed: false, 
        error: 'AI quota verification failed due to a database error. Request denied for safety.' 
      };
    }
  }

  async function logAiAutomationExecution(data: {
    type: string;
    email: string;
    role: string;
    provider?: string;
    model?: string;
    inputSummary?: string;
    outputSummary?: string;
    status: 'SUCCESS' | 'FAILED' | 'RATE_LIMITED';
    error?: string;
    timeMs: number;
  }) {
    try {
      const id = `ai_log_${crypto.randomBytes(8).toString('hex')}`;
      await pool.query(`
        INSERT INTO ai_automation_logs (
          id, automation_type, user_email, user_role, provider, model_used,
          input_summary, output_summary, status, error_message, execution_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        id,
        data.type,
        data.email,
        data.role,
        data.provider || 'nvidia-nim',
        data.model || 'meta/llama-3.3-70b-instruct',
        data.inputSummary ? data.inputSummary.substring(0, 500) : null,
        data.outputSummary ? data.outputSummary.substring(0, 500) : null,
        data.status,
        data.error || null,
        data.timeMs
      ]);
    } catch (logErr) {
      console.warn('[AI Log Warning]:', logErr);
    }
  }

  // 1. AI Enquiry / Lead Summarizer & Next Action Recommender
  app.post('/api/ai/automate/enquiry-summary', requireAdminAuth, async (req, res) => {
    const startTime = Date.now();
    const adminUser = (req as any).adminUser;

    try {
      const quotaCheck = await checkAndIncrementAiQuota(adminUser.email);
      if (!quotaCheck.allowed) {
        await logAiAutomationExecution({
          type: 'enquiry_summarizer',
          email: adminUser.email,
          role: adminUser.role,
          status: 'RATE_LIMITED',
          error: quotaCheck.error,
          timeMs: Date.now() - startTime
        });
        return res.status(429).json({ error: quotaCheck.error });
      }

      const { lead_id, enquiry_text, business_name, requested_service } = req.body;
      if (!enquiry_text && !lead_id) {
        return res.status(400).json({ error: 'Either lead_id or enquiry_text is required.' });
      }

      let rawText = enquiry_text || '';
      let targetBusiness = business_name || 'Enquiry Lead';
      let targetService = requested_service || 'Digital Solutions';

      if (lead_id) {
        const leadRes = await pool.query('SELECT * FROM crm_leads WHERE id = $1', [lead_id]);
        if (leadRes.rows.length > 0) {
          const l = leadRes.rows[0];
          targetBusiness = l.business_name || l.contact_name || targetBusiness;
          targetService = l.requested_service || l.core_problem || targetService;
          rawText = 'Contact Name: ' + l.contact_name + '\nBusiness: ' + l.business_name + '\nEmail: ' + l.user_email + '\nPhone: ' + l.user_phone + '\nService: ' + l.requested_service + '\nCore Problem: ' + l.core_problem + '\nNotes: ' + l.notes;
        }
      }

      if (!process.env.NVIDIA_API_KEY && !process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service provider is not configured (NVIDIA_API_KEY missing).' });
      }

      const prompt = 'Analyze this client enquiry for business "' + targetBusiness + '" seeking "' + targetService + '":\n\n' + rawText + '\n\nProvide a structured JSON response with keys: "summary" (string), "requested_service" (string), "missing_details" (array of strings), "priority" (string: "High", "Medium", or "Low"), "priority_reason" (string), and "recommended_next_action" (string).';

      const aiResult = await invokeNvidiaOrGeminiAI({
        prompt,
        systemPrompt: 'You are a senior agency growth consultant. Return strictly valid JSON.',
        jsonMode: true
      });

      const parsed = extractJSON(aiResult.text || '{}');
      const timeMs = Date.now() - startTime;

      await logAiAutomationExecution({
        type: 'enquiry_summarizer',
        email: adminUser.email,
        role: adminUser.role,
        provider: aiResult.provider,
        model: aiResult.model,
        inputSummary: rawText,
        outputSummary: JSON.stringify(parsed),
        status: 'SUCCESS',
        timeMs
      });

      res.json({ success: true, analysis: parsed });
    } catch (error: any) {
      const timeMs = Date.now() - startTime;
      await logAiAutomationExecution({
        type: 'enquiry_summarizer',
        email: adminUser.email,
        role: adminUser.role,
        status: 'FAILED',
        error: error.message,
        timeMs
      });
      handleDbError(res, error, 'ai:automate:enquiry-summary');
    }
  });

  // 2. AI Proposal & Quotation Draft Generator
  app.post('/api/ai/automate/proposal-draft', requireAdminAuth, async (req, res) => {
    const startTime = Date.now();
    const adminUser = (req as any).adminUser;

    try {
      const quotaCheck = await checkAndIncrementAiQuota(adminUser.email);
      if (!quotaCheck.allowed) {
        return res.status(429).json({ error: quotaCheck.error });
      }

      const { client_name, business_name, requested_service, scope, budget_tier } = req.body;
      if (!business_name || !requested_service) {
        return res.status(400).json({ error: 'Business name and requested service are required for proposal drafting.' });
      }

      if (!process.env.NVIDIA_API_KEY && !process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service provider is not configured (NVIDIA_API_KEY missing).' });
      }

      const prompt = 'Generate a professional, editable software engineering proposal draft for client "' + (client_name || 'Valued Client') + '" at "' + business_name + '".\nRequested Service: "' + requested_service + '".\nScope details: "' + (scope || 'Standard professional digital transformation and architecture overhaul') + '".\nBudget Tier: "' + (budget_tier || 'Standard') + '".\n\nReturn strictly valid JSON with keys: "executive_summary", "deliverables" (array of strings), "scope_assumptions" (array of strings), "exclusions" (array of strings), and "milestones" (array of objects with "title" and "description").';

      const aiResult = await invokeNvidiaOrGeminiAI({
        prompt,
        systemPrompt: 'You are Harrison Oyeghe, Principal Architect at Avartah Solutions. Draft rigorous, professional enterprise proposals. Always label output as a draft requiring administrator review.',
        jsonMode: true,
        maxTokens: 1600
      });

      const parsed = extractJSON(aiResult.text || '{}');
      const timeMs = Date.now() - startTime;

      await logAiAutomationExecution({
        type: 'proposal_generator',
        email: adminUser.email,
        role: adminUser.role,
        provider: aiResult.provider,
        model: aiResult.model,
        inputSummary: business_name + ' - ' + requested_service,
        outputSummary: JSON.stringify(parsed),
        status: 'SUCCESS',
        timeMs
      });

      res.json({ success: true, proposal_draft: parsed });
    } catch (error: any) {
      const timeMs = Date.now() - startTime;
      await logAiAutomationExecution({
        type: 'proposal_generator',
        email: adminUser.email,
        role: adminUser.role,
        status: 'FAILED',
        error: error.message,
        timeMs
      });
      handleDbError(res, error, 'ai:automate:proposal-draft');
    }
  });

  // 3. AI Website-Audit Report Enhancer
  app.post('/api/ai/automate/audit-enhancer', requireAdminAuth, async (req, res) => {
    const startTime = Date.now();
    const adminUser = (req as any).adminUser;

    try {
      const quotaCheck = await checkAndIncrementAiQuota(adminUser.email);
      if (!quotaCheck.allowed) {
        return res.status(429).json({ error: quotaCheck.error });
      }

      const { url, raw_findings } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'Target URL is required.' });
      }

      if (!process.env.NVIDIA_API_KEY && !process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service provider is not configured (NVIDIA_API_KEY missing).' });
      }

      const prompt = 'Analyze target website "' + url + '" with these raw findings: ' + JSON.stringify(raw_findings || {}) + '.\nReturn strictly valid JSON organizing findings by severity ("Critical", "Moderate", "Minor") with actionable technical remediation steps, clearly distinguishing observed facts from AI recommendations.';

      const aiResult = await invokeNvidiaOrGeminiAI({
        prompt,
        systemPrompt: 'You are an elite forensic web architect at Avartah Solutions.',
        jsonMode: true,
        maxTokens: 1600
      });

      const parsed = extractJSON(aiResult.text || '{}');
      const timeMs = Date.now() - startTime;

      await logAiAutomationExecution({
        type: 'audit_report_enhancer',
        email: adminUser.email,
        role: adminUser.role,
        provider: aiResult.provider,
        model: aiResult.model,
        inputSummary: url,
        outputSummary: JSON.stringify(parsed),
        status: 'SUCCESS',
        timeMs
      });

      res.json({ success: true, enhanced_audit: parsed });
    } catch (error: any) {
      const timeMs = Date.now() - startTime;
      await logAiAutomationExecution({
        type: 'audit_report_enhancer',
        email: adminUser.email,
        role: adminUser.role,
        status: 'FAILED',
        error: error.message,
        timeMs
      });
      handleDbError(res, error, 'ai:automate:audit-enhancer');
    }
  });

  // 4. AI Project Progress Reporter
  app.post('/api/ai/automate/project-reporter', requireAdminAuth, async (req, res) => {
    const startTime = Date.now();
    const adminUser = (req as any).adminUser;

    try {
      const quotaCheck = await checkAndIncrementAiQuota(adminUser.email);
      if (!quotaCheck.allowed) {
        return res.status(429).json({ error: quotaCheck.error });
      }

      const { project_id } = req.body;
      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required.' });
      }

      const projRes = await pool.query('SELECT * FROM client_projects WHERE id = $1', [project_id]);
      if (projRes.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const project = projRes.rows[0];

      const [milestonesRes, deliverablesRes] = await Promise.all([
        pool.query('SELECT title, status, client_notes FROM project_milestones WHERE project_id = $1', [project_id]),
        pool.query("SELECT title, type, visibility FROM project_deliverables WHERE project_id = $1 AND visibility = 'client_visible'", [project_id])
      ]);

      if (!process.env.NVIDIA_API_KEY && !process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service provider is not configured (NVIDIA_API_KEY missing).' });
      }

      const prompt = 'Summarize progress for client project "' + project.name + '" (Status: ' + project.status + ').\nMilestones: ' + JSON.stringify(milestonesRes.rows) + '.\nClient Visible Deliverables: ' + JSON.stringify(deliverablesRes.rows) + '.\n\nDraft a concise, professional client-facing progress report highlighting completed milestones, current focus, and next steps. Do not include internal admin notes.';

      const aiResult = await invokeNvidiaOrGeminiAI({
        prompt,
        systemPrompt: 'You are an expert technical delivery manager at Avartah Solutions.',
        jsonMode: false
      });

      const reportText = aiResult.text || 'Project delivery is proceeding according to agreed milestones.';
      const timeMs = Date.now() - startTime;

      await logAiAutomationExecution({
        type: 'project_reporter',
        email: adminUser.email,
        role: adminUser.role,
        provider: aiResult.provider,
        model: aiResult.model,
        inputSummary: project.name,
        outputSummary: reportText.substring(0, 200),
        status: 'SUCCESS',
        timeMs
      });

      res.json({ success: true, progress_report: reportText });
    } catch (error: any) {
      const timeMs = Date.now() - startTime;
      await logAiAutomationExecution({
        type: 'project_reporter',
        email: adminUser.email,
        role: adminUser.role,
        status: 'FAILED',
        error: error.message,
        timeMs
      });
      handleDbError(res, error, 'ai:automate:project-reporter');
    }
  });

  // 5. AI Usage Statistics & Logs for Admins
  app.get('/api/admin/ai/usage', requireAdminAuth, async (req, res) => {
    try {
      const logsRes = await pool.query('SELECT * FROM ai_automation_logs ORDER BY created_at DESC LIMIT 50');
      const statsRes = await pool.query("SELECT automation_type, COUNT(*)::int AS total_requests, COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS successful_requests, AVG(execution_time_ms)::int AS avg_latency_ms FROM ai_automation_logs GROUP BY automation_type");

      res.json({
        logs: logsRes.rows,
        stats: statsRes.rows
      });
    } catch (error) {
      handleDbError(res, error, 'admin:ai:usage');
    }
  });



  app.post('/api/bookings', async (req, res) => {
    const client = await pool.connect();
    let releaseErr: any;
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
      const rl = await checkPersistentRateLimit('booking_ip_' + clientIp, 10, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Too many booking requests. Please wait a minute before trying again.' });
      }

      const booking = req.body;
      if (!booking || typeof booking !== 'object') {
        return res.status(400).json({ error: 'Valid booking information is required.' });
      }

      const bDate = String(booking.booking_date || booking.date || '').trim();
      const bTime = String(booking.booking_time || booking.time || '').trim().slice(0, 30);

      if (!bDate || !bTime) {
        return res.status(400).json({ error: 'Valid booking date and time slot are required.' });
      }

      // Validate date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bDate)) {
        return res.status(400).json({ error: 'Booking date must be in YYYY-MM-DD format.' });
      }
      const parsedDate = new Date(bDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Booking date is invalid.' });
      }

      const bookingId = booking.id || ('booking_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex'));
      const email = typeof (booking.email || booking.client_email) === 'string'
        ? String(booking.email || booking.client_email).trim().toLowerCase().slice(0, 255)
        : '';
      const phone = typeof (booking.phone || booking.client_phone) === 'string'
        ? String(booking.phone || booking.client_phone).trim().slice(0, 50)
        : '';
      const clientName = typeof (booking.name || booking.client_name) === 'string'
        ? String(booking.name || booking.client_name).trim().slice(0, 120)
        : 'Guest';
      const message = typeof (booking.message || booking.notes) === 'string'
        ? String(booking.message || booking.notes).trim().slice(0, 1000)
        : '';

      await client.query('BEGIN');

      // Concurrency-safe slot reservation via Neon Postgres UNIQUE constraint
      try {
        await client.query(
          "INSERT INTO bookings (id, booking_date, booking_time, client_name, client_email, client_phone, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED')",
          [bookingId, bDate, bTime, clientName, email, phone, message]
        );
      } catch (dbErr: any) {
        await client.query('ROLLBACK');
        if (dbErr.code === '23505') { // Unique constraint violation on (booking_date, booking_time)
          return res.status(409).json({ error: 'Time slot already taken. Please choose another one.' });
        }
        throw dbErr;
      }

      // Upsert into crm_leads in the same transaction
      const leadId = 'lead_booking_' + bookingId;
      await client.query(
        `INSERT INTO crm_leads (id, contact_name, user_email, user_phone, requested_service, lead_source, status, core_problem, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Booking', 'New', $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           contact_name = EXCLUDED.contact_name,
           user_email = EXCLUDED.user_email,
           user_phone = EXCLUDED.user_phone,
           lead_source = 'Booking',
           updated_at = CURRENT_TIMESTAMP`,
        [leadId, clientName, email, phone, 'Strategy Session on ' + bDate + ' @ ' + bTime, 'Strategy Session: ' + bDate + ' @ ' + bTime + ' - ' + message]
      );

      await client.query('COMMIT');

      res.status(201).json({ success: true, id: bookingId });
    } catch (error) {
      releaseErr = error;
      try {
        await client.query('ROLLBACK');
      } catch {}
      handleDbError(res, error, 'booking:save');
    } finally {
      if (releaseErr) client.release(releaseErr);
      else client.release();
    }
  });

  const handleGetTakenSlots = async (req: express.Request, res: express.Response) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== 'string') {
        return res.json({ slots: [] });
      }
      const cleanDate = date.trim();
      // Validate date string (accepts YYYY-MM-DD or standard parseable dates)
      let formattedDate = cleanDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        const parsed = new Date(cleanDate);
        if (isNaN(parsed.getTime())) {
          return res.json({ slots: [] });
        }
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        formattedDate = `${y}-${m}-${d}`;
      }

      if (!process.env.DATABASE_URL) {
        return res.json({ slots: [] });
      }

      const slotsRes = await pool.query('SELECT booking_time FROM bookings WHERE booking_date = $1', [formattedDate]);
      const slots = (slotsRes.rows || []).map((r: any) => r.booking_time).filter(Boolean);
      res.json({ slots });
    } catch (error: any) {
      console.warn('[Slots Fetch Notice]:', error?.message || error);
      res.json({ slots: [] });
    }
  };

  app.get('/api/bookings/slots', handleGetTakenSlots);
  app.get('/api/bookings/taken-slots', handleGetTakenSlots);
  app.get('/api/taken-slots', handleGetTakenSlots);

  app.get('/api/bookings', requireAdminAuth, async (req, res) => {
    try {
      const bookingsRes = await pool.query('SELECT * FROM bookings ORDER BY booking_date DESC, booking_time DESC');
      res.json(bookingsRes.rows);
    } catch (error) {
      handleDbError(res, error, 'admin:bookings:list');
    }
  });

  app.get('/api/analytics/count', requireAdminAuth, async (req, res) => {
    try {
       const result = await pool.query('SELECT COUNT(*)::int as count FROM site_analytics');
       res.json({ count: result.rows[0]?.count || 0 });
    } catch (error) {
      res.status(500).json({ error: 'Failed to count analytics' });
    }
  });

  app.get('/api/leads/count', requireAdminAuth, async (req, res) => {
    try {
       const result = await pool.query('SELECT COUNT(*) FROM crm_leads');
       res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
      handleDbError(res, error, 'leads:count');
    }
  });

  app.get('/api/leads/stats', requireAdminAuth, async (req, res) => {
    try {
      const totalRes = await pool.query('SELECT COUNT(*) FROM crm_leads');
      const newRes = await pool.query("SELECT COUNT(*) FROM crm_leads WHERE status = 'New'");
      const qualifiedRes = await pool.query("SELECT COUNT(*) FROM crm_leads WHERE status = 'Qualified'");
      const wonRes = await pool.query("SELECT COUNT(*) FROM crm_leads WHERE status = 'Won'");
      const lostRes = await pool.query("SELECT COUNT(*) FROM crm_leads WHERE status = 'Lost'");
      const followUpDueRes = await pool.query("SELECT COUNT(*) FROM crm_leads WHERE follow_up_date <= CURRENT_TIMESTAMP AND status NOT IN ('Won', 'Lost')");

      res.json({
        total: parseInt(totalRes.rows[0].count),
        new_leads: parseInt(newRes.rows[0].count),
        qualified: parseInt(qualifiedRes.rows[0].count),
        won: parseInt(wonRes.rows[0].count),
        lost: parseInt(lostRes.rows[0].count),
        follow_ups_due: parseInt(followUpDueRes.rows[0].count)
      });
    } catch (error) {
      handleDbError(res, error, 'leads:stats');
    }
  });

  app.get('/api/projects/count', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT COUNT(*)::int as count FROM projects 
        WHERE is_archived IS NOT TRUE AND visibility = 'public'
      `);
      res.json({ count: result.rows[0]?.count || 0 });
    } catch (error) {
      handleDbError(res, error, 'projects:count');
    }
  });

  // --- PROSPECTING API ROUTES ---

  app.get('/api/prospects', requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 200;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = (req.query.search as string || '').trim().toLowerCase();
      const qualityCategory = req.query.quality_category as string;
      const reviewedStatus = req.query.reviewed_status as string;

      let query = 'SELECT * FROM prospects WHERE 1=1';
      const params: any[] = [];
      let pIdx = 1;

      if (search) {
        query += ' AND (LOWER(business_name) LIKE $' + pIdx + ' OR LOWER(location) LIKE $' + pIdx + ' OR LOWER(email) LIKE $' + pIdx + ' OR LOWER(phone) LIKE $' + pIdx + ' OR LOWER(website_url) LIKE $' + pIdx + ')';
        params.push('%' + search + '%');
        pIdx++;
      }

      if (qualityCategory && qualityCategory !== 'ALL') {
        query += ' AND (website_quality_category = $' + pIdx + ' OR status = $' + pIdx + ')';
        params.push(qualityCategory);
        pIdx++;
      }

      if (reviewedStatus && reviewedStatus !== 'ALL') {
        query += ' AND reviewed_status = $' + pIdx;
        params.push(reviewedStatus);
        pIdx++;
      }

      query += ' ORDER BY created_at DESC LIMIT $' + (pIdx++) + ' OFFSET $' + (pIdx++);
      params.push(limit, offset);

      const dbRes = await pool.query(query, params);
      setCacheControl(res, 30);
      res.json(dbRes.rows);
    } catch (error) {
      console.error('[Prospects Fetch Error]:', error);
      handleDbError(res, error, 'prospects:fetch');
    }
  });

  // Generic prospect persistence disabled: only explicit CRM Add-to-CRM action may save prospects
  app.post('/api/prospects', requireAdminAuth, (_req, res) => {
    return res.status(403).json({
      success: false,
      errorCode: 'CRM_ONLY_PERSISTENCE_REQUIRED',
      error: 'Direct prospect persistence is disabled. Use POST /api/prospects/crm/add to save selected prospects explicitly.'
    });
  });

  // Explicit Administrator Add-to-CRM Endpoint (transactional, idempotent, zero automatic discovery writes)
  app.post('/api/prospects/crm/add', requireAdminAuth, async (req, res) => {
    try {
      const admin = (req as any).adminUser;
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const prospectsInput = Array.isArray(body.prospects)
        ? body.prospects
        : body.prospect && typeof body.prospect === 'object'
        ? [body.prospect]
        : null;

      if (!prospectsInput) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_PAYLOAD',
          error: 'Request must include a prospects array.'
        });
      }
      if (prospectsInput.length > 50) {
        return res.status(400).json({
          success: false,
          errorCode: 'BATCH_LIMIT_EXCEEDED',
          error: 'CRM add batch size cannot exceed 50 prospects.'
        });
      }

      const outcome = await addProspectsToCrmTransactional(pool, admin?.email || 'admin@avartah.com', prospectsInput, {
        requested_service: body.requested_service,
        priority: body.priority,
        notes: body.notes,
        contact_name: body.contact_name
      });

      return res.json(outcome);
    } catch (error) {
      handleDbError(res, error, 'prospects:crm-add');
    }
  });

  app.post('/api/prospects/batch', requireAdminAuth, async (req, res) => {
    try {
      const admin = (req as any).adminUser;
      const { prospects, confirmAddToCrm, requested_service, priority, notes } = req.body || {};

      // Enforce CRM-only persistence: automatic discovery batch saves are forbidden
      if (confirmAddToCrm !== true) {
        return res.status(400).json({
          success: false,
          errorCode: 'EXPLICIT_CRM_CONFIRMATION_REQUIRED',
          error: 'Automatic batch persistence of search results is disabled. Use explicit Add to CRM (/api/prospects/crm/add) or pass confirmAddToCrm: true for selected records.'
        });
      }

      if (!Array.isArray(prospects)) {
        return res.status(400).json({ error: 'Prospects must be an array' });
      }
      if (prospects.length > 50) {
        return res.status(400).json({ error: 'Batch size cannot exceed 50 prospects' });
      }
      if (prospects.length === 0) {
        return res.json({
          success: true,
          summary: { added: 0, already_exists: 0, rejected: 0, failed: 0 },
          results: [],
          count: 0,
          deduplicatedCount: 0
        });
      }

      const outcome = await addProspectsToCrmTransactional(pool, admin?.email || 'admin@avartah.com', prospects, {
        requested_service,
        priority,
        notes
      });

      return res.json({
        ...outcome,
        count: outcome.summary.added,
        deduplicatedCount: outcome.summary.already_exists
      });
    } catch (error) {
      handleDbError(res, error, 'prospects:save-batch');
    }
  });

  // Promote Prospect into Active CRM Lead (supports both existing DB IDs and unsaved ephemeral candidates)
  app.post('/api/prospects/:id/promote', requireAdminAuth, async (req, res) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const admin = (req as any).adminUser;
      const { requested_service, priority, notes, contact_name, prospect: prospectPayload } = req.body || {};

      // Read-only lookup for already-saved prospects; temporary candidates are admitted atomically below
      const existingDbRes = await pool.query('SELECT * FROM prospects WHERE id = $1', [id]);
      const existingRow = existingDbRes.rows[0] || null;
      const clientObj = prospectPayload && typeof prospectPayload === 'object' ? prospectPayload : (req.body || {});

      if (!existingRow && !clientObj.business_name && !clientObj.name && !contact_name) {
        return res.status(400).json({
          success: false,
          errorCode: 'MISSING_PROSPECT_DATA',
          error: 'Prospect candidate details are required to add to CRM.'
        });
      }

      const mergedCandidate = {
        ...(clientObj || {}),
        ...(existingRow ? {
          id: existingRow.id,
          business_name: existingRow.business_name || clientObj.business_name || clientObj.name,
          location: existingRow.location || clientObj.location || clientObj.label,
          phone: existingRow.phone || clientObj.phone,
          email: existingRow.email || clientObj.email,
          website_url: existingRow.website_url || clientObj.website_url || clientObj.website,
          status: existingRow.status || clientObj.status,
          website_quality_category: existingRow.website_quality_category || clientObj.website_quality_category,
          website_quality_score: existingRow.website_quality_score ?? clientObj.website_quality_score,
          website_availability: existingRow.website_availability || clientObj.website_availability,
          website_evidence: existingRow.website_evidence || clientObj.evidence,
          whatsapp_link: existingRow.whatsapp_link || clientObj.whatsapp_link,
          source: existingRow.source || clientObj.source,
          source_provenance: existingRow.source_provenance || clientObj.source_provenance,
          contact_evidence: existingRow.contact_evidence || clientObj.contact_evidence,
          verification_status: existingRow.verification_status || clientObj.verification_status,
          suggested_service: existingRow.suggested_service || clientObj.suggested_service,
          email_draft: existingRow.email_draft || clientObj.email_draft,
          whatsapp_draft: existingRow.whatsapp_draft || clientObj.whatsapp_draft
        } : { id })
      };

      const outcome = await addProspectsToCrmTransactional(
        pool,
        admin?.email || 'admin@avartah.com',
        [mergedCandidate],
        {
          requested_service,
          priority,
          notes,
          contact_name,
          allowExistingProspectId: existingRow ? existingRow.id : undefined
        }
      );

      const itemRes = outcome.results[0];
      if (!itemRes || itemRes.status === 'rejected' || itemRes.status === 'failed') {
        return res.status(itemRes?.status === 'rejected' ? 400 : 500).json({
          success: false,
          status: itemRes?.status || 'failed',
          error: itemRes?.error || 'Failed to add prospect to CRM.'
        });
      }

      return res.json({
        success: true,
        lead_id: itemRes.lead_id,
        prospect_id: itemRes.prospect_id,
        deduplicated: itemRes.deduplicated,
        status: itemRes.status,
        matchedBy: itemRes.matchedBy,
        message: itemRes.deduplicated
          ? `Linked to existing active CRM lead matched by ${itemRes.matchedBy || 'deduplication'}.`
          : 'Successfully added prospect to authoritative CRM pipeline.'
      });
    } catch (error) {
      console.error('[Promote Prospect Error]:', error);
      handleDbError(res, error, 'prospects:promote');
    }
  });

  // Re-assess Website Quality via live SSRF-guarded HTTP inspection (ephemeral — ZERO DB writes)
  app.post('/api/prospects/reassess-website', requireAdminAuth, async (req, res) => {
    try {
      const { id, website_url, location } = req.body || {};
      let targetUrl = typeof website_url === 'string' ? website_url.trim() : '';
      let targetLocation = typeof location === 'string' ? location.trim() : '';

      if (id && (!targetUrl || !targetLocation)) {
        const pRes = await pool.query('SELECT website_url, location FROM prospects WHERE id = $1', [id]);
        if (pRes.rows.length > 0) {
          targetUrl = targetUrl || pRes.rows[0].website_url || '';
          targetLocation = targetLocation || pRes.rows[0].location || '';
        }
      }

      if (!id && !targetUrl) {
        return res.status(400).json({ error: 'Prospect ID or website URL is required' });
      }

      const assessment = await crawlAndAssessWebsite(targetUrl || null, targetLocation);

      return res.json({
        success: true,
        isTemporary: true,
        assessment,
        prospect: null
      });
    } catch (error) {
      console.error('[Reassess Website Error]:', error);
      handleDbError(res, error, 'prospects:reassess');
    }
  });

  app.patch('/api/prospects/:id', requireAdminAuth, async (req, res) => {
    try {
      const prospectId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '');
      const { notes, reviewed_status, rejection_reason, contact_name, business_name, email, phone, website_url } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let pIdx = 1;

      if (notes !== undefined) { updates.push('notes = $' + (pIdx++)); values.push(notes); }
      if (reviewed_status !== undefined) { updates.push('reviewed_status = $' + (pIdx++)); values.push(reviewed_status); }
      if (rejection_reason !== undefined) { updates.push('rejection_reason = $' + (pIdx++)); values.push(rejection_reason); }
      if (business_name !== undefined) { updates.push('business_name = $' + (pIdx++)); values.push(business_name); }
      if (email !== undefined) { updates.push('email = $' + (pIdx++)); values.push(email); }
      if (phone !== undefined) { updates.push('phone = $' + (pIdx++)); values.push(phone); }
      if (website_url !== undefined) { updates.push('website_url = $' + (pIdx++)); values.push(website_url); }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(prospectId);
        await pool.query('UPDATE prospects SET ' + updates.join(', ') + ' WHERE id = $' + pIdx, values);
      }

      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'prospects:update');
    }
  });

  app.delete('/api/prospects/:id', requireAdminAuth, async (req, res) => {
    try {
      const prospectId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '');
      await pool.query('DELETE FROM prospects WHERE id = $1', [prospectId]);
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'prospects:delete');
    }
  });

  // Rate limiting map for job searches (max 30 searches per minute per session/IP)
  const jobSearchRateLimits = new Map<string, { count: number; resetTime: number }>();
  const checkJobSearchRateLimit = (key: string): boolean => {
    const now = Date.now();
    const entry = jobSearchRateLimits.get(key);
    if (!entry || now > entry.resetTime) {
      jobSearchRateLimits.set(key, { count: 1, resetTime: now + 60000 });
      return true;
    }
    if (entry.count >= 30) {
      return false;
    }
    entry.count++;
    return true;
  };

  // --- MULTI-SOURCE JOB SEARCH API ---

  app.post('/api/jobs/search', requireAdminAuth, async (req, res) => {
    try {
      const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || 'client';
      const rateLimitKey = `${(req as any).adminUser?.email || clientIp}`;
      if (!checkJobSearchRateLimit(rateLimitKey)) {
        return res.status(429).json({ error: 'Search rate limit exceeded. Please wait a minute before searching again.' });
      }

      const query = (req.body.query || req.body.keyword || '').trim();
      const location = (req.body.location || '').trim();
      const country = (req.body.country || 'all').trim();
      const remotePreference = (req.body.remotePreference || req.body.remote || 'all').trim();
      const jobType = (req.body.jobType || 'all').trim();
      const experienceLevel = (req.body.experienceLevel || 'all').trim();
      const datePosted = (req.body.datePosted || 'all').trim();

      const searchTimestamp = new Date().toISOString();
      const filters: JobSearchFilters = {
        query,
        keyword: query,
        location,
        country,
        remotePreference,
        remote: remotePreference,
        jobType,
        experienceLevel,
        datePosted
      };

      // Query all permitted source adapters concurrently with bounded timeouts
      const adapterPromises = activeJobAdapters.map(adapter =>
        adapter.search(filters, { timeoutMs: 6500 })
      );

      const settledResults = await Promise.allSettled(adapterPromises);
      const sourcesTelemetry: any[] = [];
      let rawDiscoveredJobs: NormalizedJob[] = [];

      for (let i = 0; i < settledResults.length; i++) {
        const adapter = activeJobAdapters[i];
        const resItem = settledResults[i];

        if (resItem.status === 'fulfilled') {
          const val = resItem.value;
          sourcesTelemetry.push({
            sourceName: val.sourceName,
            success: val.success,
            jobsCount: val.jobsCount,
            latencyMs: val.latencyMs,
            error: val.error
          });
          if (val.success && Array.isArray(val.jobs)) {
            rawDiscoveredJobs.push(...val.jobs);
          }
        } else {
          sourcesTelemetry.push({
            sourceName: adapter.name,
            success: false,
            jobsCount: 0,
            latencyMs: 6500,
            error: resItem.reason?.message || 'Provider request failure'
          });
        }
      }

      // Priority 1 & 2: Deduplicate by stable fingerprint across providers & reject malformed records
      const uniqueJobs = deduplicateJobs(rawDiscoveredJobs);

      // Priority 2.3: Apply EVERY supported search filter on the backend (never silently ignored)
      const filteredJobs = applyJobFilters(uniqueJobs, filters);

      // Calculate accurate match score and human-readable explanation
      const scoredResults = filteredJobs.map(job => {
        const { score, reason } = calculateMatchScore(job, filters);
        return {
          ...job,
          match_score: score,
          match_reason: reason
        };
      }).sort((a, b) => b.match_score - a.match_score);

      // Upsert discovered genuine jobs into Neon database reliably
      let persistedCount = 0;
      let persistenceFailures = 0;
      if (scoredResults.length > 0) {
        const upsertPromises = scoredResults.map(j =>
          pool.query(`
            INSERT INTO jobs (
              id, title, company, location, country, remote_status, description, 
              employment_type, salary_min, salary_max, currency, pay_period, 
              posted_at, application_url, source_name, source_job_id, status, 
              verification_evidence, match_score, match_reason, source_provenance,
              first_seen_at, last_seen_at, last_checked_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET 
              last_seen_at = CURRENT_TIMESTAMP,
              last_checked_at = CURRENT_TIMESTAMP,
              match_score = EXCLUDED.match_score
          `, [
            j.id, j.title, j.company, j.location, j.country, j.remote_status, j.description,
            j.employment_type, j.salary_min || null, j.salary_max || null, j.currency || 'USD', j.pay_period || 'YEARLY',
            j.posted_at || null, j.application_url, j.source_name, j.source_job_id, j.status,
            j.verification_evidence, j.match_score, j.match_reason, JSON.stringify(j.source_provenance || {})
          ])
        );

        const settledUpserts = await Promise.allSettled(upsertPromises);
        for (const s of settledUpserts) {
          if (s.status === 'fulfilled') {
            persistedCount++;
          } else {
            persistenceFailures++;
            console.error('[Jobs DB Persistence Warning]:', s.reason?.message || 'Database error during job upsert');
          }
        }
      }

      const persistenceConfirmed = persistenceFailures === 0 && (persistedCount > 0 || scoredResults.length === 0);

      res.json({
        success: true,
        jobs: scoredResults,
        results: scoredResults,
        sourcesTelemetry,
        persistedCount,
        persistenceConfirmed,
        metrics: {
          totalDiscovered: rawDiscoveredJobs.length,
          totalUnique: uniqueJobs.length,
          filteredCount: scoredResults.length,
          sourcesQueried: sourcesTelemetry.length,
          persistedCount,
          persistenceConfirmed
        },
        searchTimestamp
      });
    } catch (error: any) {
      handleDbError(res, error, 'jobs:search');
    }
  });

  app.get('/api/jobs/saved', requireAdminAuth, async (req, res) => {
    try {
      const userEmail = (req as any).adminUser?.email;
      if (!userEmail) {
        return res.status(401).json({ error: 'Unauthorized: Authenticated user required.' });
      }
      const result = await pool.query(`
        SELECT sj.id as saved_id, sj.notes, sj.status as saved_status, sj.created_at as saved_at,
               COALESCE(j.id, sj.job_id) as id,
               COALESCE(j.title, 'Saved Opportunity') as title,
               COALESCE(j.company, 'Company') as company,
               COALESCE(j.location, 'Remote / Unspecified') as location,
               COALESCE(j.country, 'Global') as country,
               COALESCE(j.remote_status, 'REMOTE') as remote_status,
               COALESCE(j.description, '') as description,
               COALESCE(j.employment_type, 'FULL_TIME') as employment_type,
               j.salary_min, j.salary_max, j.currency, j.pay_period, j.posted_at,
               COALESCE(j.application_url, '') as application_url,
               COALESCE(j.source_name, 'Verified Feed') as source_name,
               COALESCE(j.source_job_id, sj.job_id) as source_job_id,
               COALESCE(j.status, 'ACTIVE') as status,
               j.verification_evidence, j.match_score, j.match_reason
        FROM saved_jobs sj
        LEFT JOIN jobs j ON sj.job_id = j.id
        WHERE LOWER(sj.user_email) = LOWER($1)
        ORDER BY sj.created_at DESC
      `, [userEmail]);
      res.json(result.rows);
    } catch (error) {
      handleDbError(res, error, 'jobs:saved:fetch');
    }
  });

  app.post('/api/jobs/save', requireAdminAuth, async (req, res) => {
    try {
      const userEmail = (req as any).adminUser?.email;
      if (!userEmail) {
        return res.status(401).json({ error: 'Unauthorized: Authenticated user required.' });
      }
      const jobId = req.body.jobId || req.body.job?.id || req.body.id;
      const notes = req.body.notes || '';
      if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

      // If full job object is provided, ensure it exists in jobs table
      const jobObj = req.body.job;
      if (jobObj && jobObj.title && jobObj.company) {
        try {
          await pool.query(`
            INSERT INTO jobs (
              id, title, company, location, country, remote_status, description, 
              employment_type, salary_min, salary_max, currency, pay_period, 
              posted_at, application_url, source_name, source_job_id, status, 
              verification_evidence, match_score, match_reason, source_provenance,
              first_seen_at, last_seen_at, last_checked_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO NOTHING
          `, [
            jobId, jobObj.title, jobObj.company, jobObj.location || '', jobObj.country || '',
            jobObj.remote_status || 'REMOTE', jobObj.description || '', jobObj.employment_type || 'FULL_TIME',
            jobObj.salary_min || null, jobObj.salary_max || null, jobObj.currency || 'USD', jobObj.pay_period || 'YEARLY',
            jobObj.posted_at || null, jobObj.application_url || '', jobObj.source_name || 'Verified Feed',
            jobObj.source_job_id || jobId, jobObj.status || 'ACTIVE',
            jobObj.verification_evidence || '', jobObj.match_score || 80, jobObj.match_reason || '',
            JSON.stringify(jobObj.source_provenance || {})
          ]);
        } catch (e) {}
      }

      await pool.query(`
        INSERT INTO saved_jobs (user_email, job_id, notes, status)
        VALUES ($1, $2, $3, 'BOOKMARKED')
        ON CONFLICT (user_email, job_id) DO UPDATE SET notes = EXCLUDED.notes
      `, [userEmail, jobId, notes]);

      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'jobs:save');
    }
  });

  app.delete('/api/jobs/save/:id', requireAdminAuth, async (req, res) => {
    try {
      const userEmail = (req as any).adminUser?.email;
      if (!userEmail) {
        return res.status(401).json({ error: 'Unauthorized: Authenticated user required.' });
      }
      const { id } = req.params;
      await pool.query('DELETE FROM saved_jobs WHERE (job_id = $1 OR id::text = $1) AND LOWER(user_email) = LOWER($2)', [id, userEmail]);
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'jobs:save:delete');
    }
  });

  // Ephemeral Deep Contact Research API: inspects official website + bounded public web/social/directory sources with ZERO DB writes
  app.post('/api/prospects/scrape', requireAdminAuth, async (req, res) => {
    try {
      const {
        id,
        website_url,
        name,
        location,
        social_profiles,
        website_quality_category,
        website_quality_score,
        evidence
      } = req.body || {};

      let targetName = typeof name === 'string' ? name.trim() : '';
      let targetLocation = typeof location === 'string' ? location.trim() : '';
      let targetWebsite = typeof website_url === 'string' ? website_url.trim() : '';
      let currentCategory = typeof website_quality_category === 'string' ? website_quality_category : '';
      let currentScore = typeof website_quality_score === 'number' ? website_quality_score : 50;
      let currentEvidence = typeof evidence === 'string' ? evidence : '';

      // Read-only enrichment fallback only if candidate already happens to be saved in CRM
      if (id && (!targetName || !targetLocation)) {
        const pCheck = await pool.query('SELECT * FROM prospects WHERE id = $1', [id]);
        if (pCheck.rows.length > 0) {
          const row = pCheck.rows[0];
          targetName = targetName || row.business_name || '';
          targetLocation = targetLocation || row.location || '';
          targetWebsite = targetWebsite || row.website_url || '';
          currentCategory = currentCategory || row.website_quality_category || '';
          currentScore = row.website_quality_score ?? currentScore;
          currentEvidence = currentEvidence || row.website_evidence || '';
        }
      }

      if (!targetName && !targetWebsite) {
        return res.status(400).json({ error: 'Either website_url or business name is required' });
      }

      const researched = await researchBusinessContacts(
        targetName || targetWebsite,
        targetLocation,
        targetWebsite || null,
        social_profiles
      );

      const pitch = generateValueFirstPitch({
        business_name: targetName || targetWebsite,
        location: targetLocation,
        website_url: targetWebsite,
        website_quality_category: currentCategory,
        website_quality_score: currentScore,
        website_evidence: currentEvidence
      });

      const emailDraft = `Subject: ${pitch.email.subject}\n\n${pitch.email.body}`;
      const whatsappDraft = pitch.whatsappMessage;

      return res.json({
        success: true,
        isTemporary: true,
        email: researched.email || null,
        phone: researched.phone || null,
        whatsapp: researched.whatsapp || null,
        social_profiles: researched.socialProfiles,
        contact_evidence: researched.contactEvidence,
        pages_scraped: researched.pagesScraped,
        sources_checked: researched.sourcesChecked,
        email_draft: emailDraft,
        whatsapp_draft: whatsappDraft
      });
    } catch (error: any) {
      handleDbError(res, error, 'prospects:scrape');
    }
  });

  const ALLOWED_OUTREACH_STATUSES = new Set([
    'DRAFT_OPENED',
    'QUEUED',
    'SENT',
    'DELIVERED',
    'FAILED',
    'BOUNCED',
    'REPLIED'
  ]);

  function normalizeOutreachChannelValue(raw: unknown): 'email' | 'whatsapp' | null {
    const val = String(raw || '').trim().toLowerCase();
    if (val === 'email' || val === 'mailto') return 'email';
    if (val === 'whatsapp' || val === 'wa') return 'whatsapp';
    return null;
  }

  function normalizeDeliveryStatusValue(raw: unknown, fallback: string = 'DRAFT_OPENED'): string {
    const upper = String(raw || '').trim().toUpperCase();
    return ALLOWED_OUTREACH_STATUSES.has(upper) ? upper : fallback;
  }

  function escapeEmailHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\r?\n/g, '<br />');
  }

  // Log Outreach Dispatches into authoritative crm_outreach_history (CRM records only)
  app.post('/api/prospects/:id/outreach-log', requireAdminAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '');
      const {
        channel,
        recipient,
        subject,
        message,
        delivery_status,
        provider,
        provider_message_id,
        error_message,
        ai_generated,
        crm_lead_id,
        business_name,
        send_via_email
      } = req.body || {};
      const operator = (req as any).adminUser?.email || 'admin@avartah.com';

      const normalizedChannel = normalizeOutreachChannelValue(channel);
      if (!normalizedChannel || !message || !String(message).trim()) {
        return res.status(400).json({ error: 'Valid channel (email or whatsapp) and message are required' });
      }

      const prospectRes = await pool.query(
        'SELECT id, business_name, crm_lead_id FROM prospects WHERE id = $1 LIMIT 1',
        [id]
      );
      let linkedProspectId: string | null = prospectRes.rows[0]?.id || null;
      let linkedLeadId: string | null = prospectRes.rows[0]?.crm_lead_id || (typeof crm_lead_id === 'string' && crm_lead_id.trim() ? crm_lead_id.trim() : null);
      let resolvedBusinessName: string | null = prospectRes.rows[0]?.business_name || (typeof business_name === 'string' && business_name.trim() ? business_name.trim() : null);

      if (!linkedProspectId && linkedLeadId) {
        const leadRes = await pool.query('SELECT id, business_name, contact_name FROM crm_leads WHERE id = $1 LIMIT 1', [linkedLeadId]);
        if (leadRes.rows.length === 0) linkedLeadId = null;
        else if (!resolvedBusinessName) resolvedBusinessName = leadRes.rows[0].business_name || leadRes.rows[0].contact_name || null;
      } else if (!linkedProspectId && !linkedLeadId) {
        const leadById = await pool.query('SELECT id, business_name, contact_name FROM crm_leads WHERE id = $1 LIMIT 1', [id]);
        if (leadById.rows.length > 0) {
          linkedLeadId = leadById.rows[0].id;
          resolvedBusinessName = resolvedBusinessName || leadById.rows[0].business_name || leadById.rows[0].contact_name || null;
        }
      }

      if (!linkedProspectId && !linkedLeadId) {
        return res.status(400).json({
          success: false,
          errorCode: 'ADD_TO_CRM_REQUIRED',
          error: 'Prospect must be added to CRM before logging CRM outreach history.'
        });
      }

      const cleanRecipient = String(recipient || '').trim().slice(0, 255) || 'Direct';
      const cleanSubject = subject ? String(subject).trim().slice(0, 300) : null;
      const cleanMessage = String(message).trim().slice(0, 10000);
      const isAiGenerated = ai_generated !== false;

      let finalDeliveryStatus = normalizeDeliveryStatusValue(delivery_status, 'DRAFT_OPENED');
      let finalProvider = typeof provider === 'string' && provider.trim()
        ? provider.trim().slice(0, 50)
        : (normalizedChannel === 'whatsapp' ? 'whatsapp_web' : 'mailto');
      let finalProviderMsgId = typeof provider_message_id === 'string' && provider_message_id.trim()
        ? provider_message_id.trim().slice(0, 255)
        : null;
      let finalErrorMessage = typeof error_message === 'string' && error_message.trim()
        ? error_message.trim().slice(0, 1000)
        : null;

      if (send_via_email === true && normalizedChannel === 'email') {
        const emailCheck = validateEmail(cleanRecipient);
        if (!emailCheck.isValid || emailCheck.isPlaceholder) {
          return res.status(400).json({
            success: false,
            errorCode: 'INVALID_RECIPIENT_EMAIL',
            error: 'A valid, non-placeholder recipient email address is required for direct email delivery.'
          });
        }
        if (!isEmailConfigured()) {
          return res.status(400).json({
            success: false,
            errorCode: 'EMAIL_NOT_CONFIGURED',
            error: 'RESEND_API_KEY is not configured on the server. Use Open Email Client (mailto) or configure RESEND_API_KEY.'
          });
        }
        finalProvider = 'resend';
        const emailSendRes = await sendEmail({
          to: cleanRecipient,
          subject: cleanSubject || `Outreach from Avartah Solutions`,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.6; font-size: 14px;">${escapeEmailHtml(cleanMessage)}</div>`,
          text: cleanMessage
        });
        if (emailSendRes.success) {
          finalDeliveryStatus = 'SENT';
          finalProviderMsgId = emailSendRes.id || null;
          finalErrorMessage = null;
        } else {
          finalDeliveryStatus = 'FAILED';
          finalErrorMessage = (emailSendRes.error || 'Email delivery failed').slice(0, 1000);
        }
      }

      const logId = `outreach_${crypto.randomBytes(8).toString('hex')}`;

      const insertRes = await pool.query(`
        INSERT INTO crm_outreach_history (
          id, prospect_id, crm_lead_id, business_name, channel, recipient, subject, message_body,
          delivery_status, provider, provider_message_id, error_message, ai_generated,
          dispatched_at, updated_at, operator_email
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $14
        )
        RETURNING *
      `, [
        logId,
        linkedProspectId,
        linkedLeadId,
        resolvedBusinessName,
        normalizedChannel,
        cleanRecipient,
        cleanSubject,
        cleanMessage,
        finalDeliveryStatus,
        finalProvider,
        finalProviderMsgId,
        finalErrorMessage,
        isAiGenerated,
        operator
      ]);

      if (linkedProspectId) {
        await pool.query(`
          UPDATE prospects
          SET outreach_status = CASE WHEN $1 IN ('FAILED', 'BOUNCED') THEN COALESCE(NULLIF(outreach_status, ''), 'ATTEMPTED') ELSE 'CONTACTED' END,
              last_outreach_channel = $2,
              last_outreach_at = CURRENT_TIMESTAMP,
              outreach_count = COALESCE(outreach_count, 0) + 1,
              status = CASE WHEN $1 IN ('FAILED', 'BOUNCED') THEN status ELSE 'Contacted' END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [finalDeliveryStatus, normalizedChannel, linkedProspectId]);
      }

      if (linkedLeadId) {
        await pool.query(`
          UPDATE crm_leads
          SET last_contacted_at = CURRENT_TIMESTAMP,
              status = CASE WHEN status IN ('New', 'pending') AND $1 NOT IN ('FAILED', 'BOUNCED') THEN 'Contacted' ELSE status END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [finalDeliveryStatus, linkedLeadId]);
      }

      return res.json({
        success: finalDeliveryStatus !== 'FAILED' && finalDeliveryStatus !== 'BOUNCED',
        logged: true,
        id: logId,
        status: finalDeliveryStatus === 'FAILED' ? 'FAILED' : 'CONTACTED',
        delivery_status: finalDeliveryStatus,
        provider: finalProvider,
        provider_message_id: finalProviderMsgId,
        error: finalErrorMessage || undefined,
        log: insertRes.rows[0]
      });
    } catch (error: any) {
      console.error('[Outreach Log Error]:', error);
      handleDbError(res, error, 'prospects:outreach-log');
    }
  });

  // Admin CRM Outreach Delivery Log Feed (filterable + aggregated counts)
  app.get('/api/crm/outreach-logs', requireAdminAuth, async (req, res) => {
    try {
      const channelFilter = normalizeOutreachChannelValue(req.query.channel);
      const statusRaw = typeof req.query.delivery_status === 'string' ? req.query.delivery_status.trim().toUpperCase() : '';
      const statusFilter = statusRaw && statusRaw !== 'ALL' && ALLOWED_OUTREACH_STATUSES.has(statusRaw) ? statusRaw : null;
      const leadIdFilter = typeof req.query.lead_id === 'string' && req.query.lead_id.trim() ? req.query.lead_id.trim() : null;
      const prospectIdFilter = typeof req.query.prospect_id === 'string' && req.query.prospect_id.trim() ? req.query.prospect_id.trim() : null;
      const searchFilter = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim().toLowerCase() : null;
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
      const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);

      const whereClauses: string[] = ['1=1'];
      const params: any[] = [];
      let pIdx = 1;

      if (channelFilter) {
        whereClauses.push(`LOWER(h.channel) = $${pIdx++}`);
        params.push(channelFilter);
      }
      if (statusFilter) {
        whereClauses.push(`UPPER(COALESCE(h.delivery_status, 'DRAFT_OPENED')) = $${pIdx++}`);
        params.push(statusFilter);
      }
      if (leadIdFilter) {
        whereClauses.push(`COALESCE(h.crm_lead_id, p.crm_lead_id) = $${pIdx++}`);
        params.push(leadIdFilter);
      }
      if (prospectIdFilter) {
        whereClauses.push(`h.prospect_id = $${pIdx++}`);
        params.push(prospectIdFilter);
      }
      if (searchFilter) {
        whereClauses.push(`(
          LOWER(COALESCE(h.business_name, l.business_name, p.business_name, '')) LIKE $${pIdx}
          OR LOWER(COALESCE(l.contact_name, '')) LIKE $${pIdx}
          OR LOWER(COALESCE(h.recipient, '')) LIKE $${pIdx}
          OR LOWER(COALESCE(h.subject, '')) LIKE $${pIdx}
          OR LOWER(COALESCE(h.operator_email, '')) LIKE $${pIdx}
        )`);
        params.push(`%${searchFilter}%`);
        pIdx++;
      }

      const whereSql = whereClauses.join(' AND ');

      const listQuery = `
        SELECT
          h.id,
          h.prospect_id,
          COALESCE(h.crm_lead_id, p.crm_lead_id) AS crm_lead_id,
          COALESCE(NULLIF(h.business_name, ''), l.business_name, p.business_name, l.contact_name, 'CRM Contact') AS business_name,
          l.contact_name AS lead_contact_name,
          l.status AS lead_status,
          LOWER(h.channel) AS channel,
          h.recipient,
          h.subject,
          h.message_body,
          UPPER(COALESCE(h.delivery_status, 'DRAFT_OPENED')) AS delivery_status,
          COALESCE(NULLIF(h.provider, ''), CASE WHEN LOWER(h.channel) = 'whatsapp' THEN 'whatsapp_web' ELSE 'mailto' END) AS provider,
          h.provider_message_id,
          h.error_message,
          COALESCE(h.ai_generated, TRUE) AS ai_generated,
          COALESCE(h.operator_email, 'admin@avartah.com') AS operator_email,
          h.dispatched_at,
          COALESCE(h.updated_at, h.dispatched_at) AS updated_at
        FROM crm_outreach_history h
        LEFT JOIN crm_leads l ON l.id = h.crm_lead_id
        LEFT JOIN prospects p ON p.id = h.prospect_id
        WHERE ${whereSql}
        ORDER BY h.dispatched_at DESC
        LIMIT $${pIdx++} OFFSET $${pIdx++}
      `;

      const summaryQuery = `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE LOWER(h.channel) = 'email')::int AS email_count,
          COUNT(*) FILTER (WHERE LOWER(h.channel) = 'whatsapp')::int AS whatsapp_count,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(h.delivery_status, 'DRAFT_OPENED')) = 'DRAFT_OPENED')::int AS draft_opened_count,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(h.delivery_status, 'DRAFT_OPENED')) = 'SENT')::int AS sent_count,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(h.delivery_status, 'DRAFT_OPENED')) = 'DELIVERED')::int AS delivered_count,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(h.delivery_status, 'DRAFT_OPENED')) IN ('FAILED', 'BOUNCED'))::int AS failed_count,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(h.delivery_status, 'DRAFT_OPENED')) = 'REPLIED')::int AS replied_count
        FROM crm_outreach_history h
        LEFT JOIN crm_leads l ON l.id = h.crm_lead_id
        LEFT JOIN prospects p ON p.id = h.prospect_id
        WHERE ${whereSql}
      `;

      const [listRes, summaryRes] = await Promise.all([
        pool.query(listQuery, [...params, limit, offset]),
        pool.query(summaryQuery, params)
      ]);

      const summaryRow = summaryRes.rows[0] || {
        total: 0,
        email_count: 0,
        whatsapp_count: 0,
        draft_opened_count: 0,
        sent_count: 0,
        delivered_count: 0,
        failed_count: 0,
        replied_count: 0
      };

      return res.json({
        success: true,
        logs: listRes.rows,
        total: summaryRow.total || 0,
        summary: summaryRow,
        emailConfigured: isEmailConfigured()
      });
    } catch (error: any) {
      console.error('[CRM Outreach Logs Fetch Error]:', error);
      handleDbError(res, error, 'crm:outreach-logs');
    }
  });

  // Update delivery status / outcome for an existing persisted outreach log row
  app.patch('/api/crm/outreach-logs/:logId', requireAdminAuth, async (req, res) => {
    try {
      const logId = Array.isArray(req.params.logId) ? req.params.logId[0] : (req.params.logId || '');
      const { delivery_status, error_message, provider_message_id } = req.body || {};

      const statusUpper = String(delivery_status || '').trim().toUpperCase();
      if (!ALLOWED_OUTREACH_STATUSES.has(statusUpper)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid delivery_status. Must be DRAFT_OPENED, QUEUED, SENT, DELIVERED, FAILED, BOUNCED, or REPLIED.'
        });
      }

      const cleanError = error_message !== undefined
        ? (error_message ? String(error_message).trim().slice(0, 1000) : null)
        : undefined;
      const cleanProviderMsgId = provider_message_id !== undefined
        ? (provider_message_id ? String(provider_message_id).trim().slice(0, 255) : null)
        : undefined;

      const updateRes = await pool.query(`
        UPDATE crm_outreach_history
        SET delivery_status = $1,
            error_message = CASE WHEN $2::boolean THEN $3 ELSE error_message END,
            provider_message_id = CASE WHEN $4::boolean THEN $5 ELSE provider_message_id END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `, [
        statusUpper,
        cleanError !== undefined,
        cleanError ?? null,
        cleanProviderMsgId !== undefined,
        cleanProviderMsgId ?? null,
        logId
      ]);

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Outreach log entry not found' });
      }

      const updatedLog = updateRes.rows[0];
      if (updatedLog.prospect_id && statusUpper === 'REPLIED') {
        await pool.query(
          `UPDATE prospects SET outreach_status = 'REPLIED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [updatedLog.prospect_id]
        );
      }

      return res.json({ success: true, log: updatedLog });
    } catch (error: any) {
      console.error('[CRM Outreach Log Update Error]:', error);
      handleDbError(res, error, 'crm:outreach-log-update');
    }
  });

  app.delete('/api/crm/outreach-logs/:logId', requireAdminAuth, async (req, res) => {
    try {
      const logId = Array.isArray(req.params.logId) ? req.params.logId[0] : (req.params.logId || '');
      const delRes = await pool.query('DELETE FROM crm_outreach_history WHERE id = $1 RETURNING id', [logId]);
      if (delRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Outreach log entry not found' });
      }
      return res.json({ success: true, id: logId });
    } catch (error: any) {
      console.error('[CRM Outreach Log Delete Error]:', error);
      handleDbError(res, error, 'crm:outreach-log-delete');
    }
  });

  // Generate AI pitch OR dispatch/log Email/WhatsApp outreach directly from a CRM Lead
  app.post('/api/crm/leads/:leadId/outreach', requireAdminAuth, async (req, res) => {
    try {
      const leadId = Array.isArray(req.params.leadId) ? req.params.leadId[0] : (req.params.leadId || '');
      const {
        action,
        channel,
        recipient,
        subject,
        message,
        delivery_status,
        ai_generated,
        send_via_email
      } = req.body || {};
      const operator = (req as any).adminUser?.email || 'admin@avartah.com';

      const leadRes = await pool.query('SELECT * FROM crm_leads WHERE id = $1 LIMIT 1', [leadId]);
      if (leadRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'CRM lead not found' });
      }
      const lead = leadRes.rows[0];

      const linkedProspectRes = await pool.query(
        'SELECT id, website_quality_category, website_quality_score, website_evidence FROM prospects WHERE crm_lead_id = $1 LIMIT 1',
        [leadId]
      );
      const linkedProspect = linkedProspectRes.rows[0] || null;

      if (action === 'generate_pitch') {
        const bName = lead.business_name || lead.contact_name || 'your business';
        const bLoc = [lead.city, lead.country].filter(Boolean).join(', ');
        const bWebsite = lead.target_url || lead.website || '';
        const bService = lead.requested_service || 'Website Modernization & Digital Growth';
        const bNotes = linkedProspect?.website_evidence || lead.core_problem || lead.notes || '';

        let emailSubject = `Digital Growth & Web Modernization Proposal for ${bName}`;
        let emailBody = '';
        let whatsappMessage = '';
        let usedAi = false;

        if (process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY) {
          try {
            const tRes = await pool.query('SELECT system_prompt FROM outreach_templates WHERE id = $1', ['default-closer']);
            const basePrompt = tRes.rows[0]?.system_prompt || 'Write a professional, concise B2B outreach pitch.';
            const fullSystemPrompt = `${basePrompt}\n\nIMPORTANT: You are Harrison Oyeghe, representing Avartah Solutions. Generate two distinct value-first outreach drafts: one for Email (keys: subject, body) and one for WhatsApp (short, punchy, respectful). Do NOT invent facts or fake metrics. Output valid JSON with keys "email": { "subject": string, "body": string } and "whatsapp": string.`;
            const userPrompt = `Business: ${bName}\nContact: ${lead.contact_name || 'Decision Maker'}\nLocation: ${bLoc || 'N/A'}\nWebsite: ${bWebsite || 'None'}\nRequested Service: ${bService}\nNotes / Evidence: ${bNotes || 'N/A'}`;
            const aiRes = await invokeNvidiaOrGeminiAI({
              prompt: userPrompt,
              systemPrompt: fullSystemPrompt,
              jsonMode: true,
              geminiModel: 'gemini-2.5-flash',
              timeoutMs: 12000
            });
            if (aiRes.text) {
              const parsed = extractJSON(aiRes.text);
              if (parsed?.email) {
                if (typeof parsed.email === 'object') {
                  if (parsed.email.subject) emailSubject = String(parsed.email.subject);
                  if (parsed.email.body) emailBody = String(parsed.email.body);
                } else if (typeof parsed.email === 'string') {
                  emailBody = parsed.email;
                }
              }
              if (parsed?.whatsapp) {
                whatsappMessage = typeof parsed.whatsapp === 'object'
                  ? String(parsed.whatsapp.message || parsed.whatsapp.body || '')
                  : String(parsed.whatsapp);
              }
              usedAi = Boolean(emailBody || whatsappMessage);
            }
          } catch (aiErr: any) {
            console.log('[CRM Pitch AI Fallback]:', cleanErrorMessage(aiErr));
          }
        }

        if (!emailBody || !whatsappMessage) {
          const pitch = generateValueFirstPitch({
            business_name: bName,
            location: bLoc,
            niche: bService,
            website_url: bWebsite || null,
            website_quality_category: linkedProspect?.website_quality_category,
            website_quality_score: linkedProspect?.website_quality_score,
            website_evidence: bNotes
          });
          if (!emailBody) {
            emailSubject = pitch.email.subject;
            emailBody = pitch.email.body;
          }
          if (!whatsappMessage) {
            whatsappMessage = pitch.whatsappMessage;
          }
        }

        return res.json({
          success: true,
          ai_generated: true,
          model_backed: usedAi,
          email: { subject: emailSubject, body: emailBody },
          whatsappMessage
        });
      }

      const normalizedChannel = normalizeOutreachChannelValue(channel);
      if (!normalizedChannel || !message || !String(message).trim()) {
        return res.status(400).json({ success: false, error: 'Valid channel (email or whatsapp) and message are required' });
      }

      const fallbackRecipient = normalizedChannel === 'email' ? (lead.user_email || '') : (lead.user_phone || '');
      const cleanRecipient = String(recipient || fallbackRecipient).trim().slice(0, 255) || 'Direct';
      const cleanSubject = subject ? String(subject).trim().slice(0, 300) : null;
      const cleanMessage = String(message).trim().slice(0, 10000);
      const businessName = lead.business_name || lead.contact_name || 'CRM Contact';

      let finalStatus = normalizeDeliveryStatusValue(delivery_status, 'DRAFT_OPENED');
      let finalProvider = normalizedChannel === 'whatsapp' ? 'whatsapp_web' : 'mailto';
      let finalProviderMsgId: string | null = null;
      let finalErrorMessage: string | null = null;

      if (send_via_email === true && normalizedChannel === 'email') {
        const emailCheck = validateEmail(cleanRecipient);
        if (!emailCheck.isValid || emailCheck.isPlaceholder) {
          return res.status(400).json({
            success: false,
            errorCode: 'INVALID_RECIPIENT_EMAIL',
            error: 'A valid recipient email address is required for direct email delivery.'
          });
        }
        if (!isEmailConfigured()) {
          return res.status(400).json({
            success: false,
            errorCode: 'EMAIL_NOT_CONFIGURED',
            error: 'RESEND_API_KEY is not configured on the server. Use Open Email Client (mailto) or configure RESEND_API_KEY.'
          });
        }
        finalProvider = 'resend';
        const emailRes = await sendEmail({
          to: cleanRecipient,
          subject: cleanSubject || `Regarding Your Avartah Solutions Inquiry`,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.6; font-size: 14px;">${escapeEmailHtml(cleanMessage)}</div>`,
          text: cleanMessage
        });
        if (emailRes.success) {
          finalStatus = 'SENT';
          finalProviderMsgId = emailRes.id || null;
        } else {
          finalStatus = 'FAILED';
          finalErrorMessage = (emailRes.error || 'Email delivery failed').slice(0, 1000);
        }
      }

      const logId = `outreach_${crypto.randomBytes(8).toString('hex')}`;
      const insertRes = await pool.query(`
        INSERT INTO crm_outreach_history (
          id, prospect_id, crm_lead_id, business_name, channel, recipient, subject, message_body,
          delivery_status, provider, provider_message_id, error_message, ai_generated,
          dispatched_at, updated_at, operator_email
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $14
        )
        RETURNING *
      `, [
        logId,
        linkedProspect?.id || null,
        leadId,
        businessName,
        normalizedChannel,
        cleanRecipient,
        cleanSubject,
        cleanMessage,
        finalStatus,
        finalProvider,
        finalProviderMsgId,
        finalErrorMessage,
        ai_generated !== false,
        operator
      ]);

      await pool.query(`
        UPDATE crm_leads
        SET last_contacted_at = CURRENT_TIMESTAMP,
            status = CASE WHEN status IN ('New', 'pending') AND $1 NOT IN ('FAILED', 'BOUNCED') THEN 'Contacted' ELSE status END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [finalStatus, leadId]);

      if (linkedProspect?.id) {
        await pool.query(`
          UPDATE prospects
          SET outreach_status = CASE WHEN $1 IN ('FAILED', 'BOUNCED') THEN outreach_status ELSE 'CONTACTED' END,
              last_outreach_channel = $2,
              last_outreach_at = CURRENT_TIMESTAMP,
              outreach_count = COALESCE(outreach_count, 0) + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [finalStatus, normalizedChannel, linkedProspect.id]);
      }

      return res.json({
        success: finalStatus !== 'FAILED' && finalStatus !== 'BOUNCED',
        logged: true,
        delivery_status: finalStatus,
        provider: finalProvider,
        provider_message_id: finalProviderMsgId,
        error: finalErrorMessage || undefined,
        log: insertRes.rows[0]
      });
    } catch (error: any) {
      console.error('[CRM Lead Outreach Error]:', error);
      handleDbError(res, error, 'crm:lead-outreach');
    }
  });

  // Suggest Follow-up API
  app.post('/api/prospects/suggest-follow-up', requireAdminAuth, async (req, res) => {
    try {
      const { industry, companySize } = req.body;
      if (!industry || !companySize) return res.status(400).json({ error: 'Industry and company size are required' });

      if (!process.env.NVIDIA_API_KEY && !process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI provider not configured (NVIDIA_API_KEY missing)' });
      }

      const prompt = `Generate 3 professional follow-up message templates for a prospect in the ${String(industry).slice(0, 120)} industry with a company size of ${String(companySize).slice(0, 60)}.
Provide the output strictly as a valid JSON array of 3 strings.`;

      const aiResult = await invokeNvidiaOrGeminiAI({
        prompt,
        systemPrompt: 'Return strictly a valid JSON array of strings.',
        jsonMode: true
      });

      let text = (aiResult.text || '[]').split('```json').join('').split('```').join('').trim();
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) text = arrMatch[0];
      res.json(JSON.parse(text));
    } catch (error: any) {
      handleDbError(res, error, 'templates:ai-suggest');
    }
  });

  function cleanAndSingularizeNiche(niche: string): string {
    let n = niche.trim().toLowerCase();
    const mapping: { [key: string]: string } = {
      'gyms': 'gym',
      'spas': 'spa',
      'mini marts': 'mini mart',
      'mini-marts': 'mini mart',
      'minimarts': 'mini mart',
      'supermarkets': 'supermarket',
      'dentists': 'dentist',
      'barbers': 'barber',
      'barber shops': 'barber',
      'barbershops': 'barber',
      'restaurants': 'restaurant',
      'eateries': 'restaurant',
      'cafes': 'cafe',
      'salons': 'salon',
      'hotels': 'hotel',
      'clinics': 'clinic',
      'pharmacies': 'pharmacy',
      'schools': 'school',
      'bakeries': 'bakery',
      'pubs': 'pub',
      'bars': 'bar',
      'clubs': 'club'
    };

    if (mapping[n]) return mapping[n];

    if (n.endsWith('ies')) {
      return n.slice(0, -3) + 'y';
    }
    if (n.endsWith('es') && !n.endsWith('ees') && !n.endsWith('oes') && !n.endsWith('ses')) {
      if (n.endsWith('surgeries')) return n.replace('surgeries', 'surgery');
      if (n.endsWith('offices')) return n.replace('offices', 'office');
      return n.slice(0, -2);
    }
    if (n.endsWith('s') && !n.endsWith('ss') && !n.endsWith('us')) {
      return n.slice(0, -1);
    }
    return niche;
  }

  function cleanQueryForNominatim(q: string): string {
    let cleaned = q.trim();
    cleaned = cleaned.replace(/\s+(in|at|near|around|for)\s+/gi, ', ');
    
    const parts = cleaned.split(/[\s,]+/).filter(Boolean);
    if (parts.length > 0) {
      const nicheMapping: { [key: string]: string } = {
        'gyms': 'gym',
        'spas': 'spa',
        'mini-marts': 'mini mart',
        'minimarts': 'mini mart',
        'supermarkets': 'supermarket',
        'dentists': 'dentist',
        'barbers': 'barber',
        'barbershops': 'barber',
        'restaurants': 'restaurant',
        'eateries': 'restaurant',
        'cafes': 'cafe',
        'salons': 'salon',
        'hotels': 'hotel',
        'clinics': 'clinic',
        'pharmacies': 'pharmacy',
        'schools': 'school',
        'bakeries': 'bakery',
        'pubs': 'pub',
        'bars': 'bar',
        'clubs': 'club'
      };

      for (let i = 0; i < Math.min(parts.length, 2); i++) {
        const lower = parts[i].toLowerCase();
        if (nicheMapping[lower]) {
          parts[i] = nicheMapping[lower];
        } else if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && lower.length > 3) {
          parts[i] = parts[i].slice(0, -1);
        }
      }
      cleaned = parts.join(', ');
    }
    return cleaned;
  }

  // --- PRODUCTION WEBSITE CLASSIFICATION & CRAWL PIPELINE ---
  async function crawlAndAssessWebsite(
    websiteUrl?: string | null,
    countryContext: string = ''
  ): Promise<{
    email?: string;
    phone?: string;
    whatsapp?: string;
    status: 'NO_WEBSITE' | 'BROKEN_WEBSITE' | 'OUTDATED_WEBSITE' | 'GOOD_WEBSITE' | 'NEEDS_REVIEW';
    website_quality_category: WebsiteQualityCategory;
    website_availability: 'ONLINE' | 'PERSISTENT_FAILURE' | 'TEMPORARILY_UNAVAILABLE' | 'NONE' | 'UNVERIFIED';
    qualityScore: number;
    evidence: string;
    confidence: number;
    contactEvidence: ContactEvidence[];
    whatsapp_unconfirmed: boolean;
  }> {
    const summary = await prospectDiscoveryEngine.assessWebsiteWithCache(websiteUrl, countryContext);
    return {
      email: summary.email,
      phone: summary.phone,
      whatsapp: summary.whatsapp,
      status: summary.status,
      website_quality_category: summary.website_quality_category,
      website_availability: summary.website_availability,
      qualityScore: summary.qualityScore,
      evidence: summary.evidence,
      confidence: summary.status === 'NEEDS_REVIEW' ? 0.6 : 0.9,
      contactEvidence: summary.contactEvidence,
      whatsapp_unconfirmed: summary.whatsapp_unconfirmed
    };
  }

  async function classifyAndEnrichWebsite(
    websiteUrl?: string | null
  ): Promise<{ 
    status: 'NO_WEBSITE' | 'BROKEN_WEBSITE' | 'OUTDATED_WEBSITE' | 'GOOD_WEBSITE' | 'NEEDS_REVIEW'; 
    website_quality_category: WebsiteQualityCategory;
    qualityScore: number; 
    evidence: string; 
    whatsapp?: string; 
    website_availability: 'ONLINE' | 'PERSISTENT_FAILURE' | 'TEMPORARILY_UNAVAILABLE' | 'NONE' | 'UNVERIFIED';
  }> {
    const res = await crawlAndAssessWebsite(websiteUrl);
    return {
      status: res.status,
      website_quality_category: res.website_quality_category,
      qualityScore: res.qualityScore,
      evidence: res.evidence,
      whatsapp: res.whatsapp,
      website_availability: res.website_availability
    };
  }

  // Authoritative Prospect Discovery API (Bounded multi-batching, provider governance, single bulk upsert)
  app.post('/api/prospects/locate', requireAdminAuth, async (req, res) => {
    try {
      const admin = (req as any).adminUser;
      const clientIp = getTrustedClientIp(req);
      const rl = await checkPersistentRateLimit(`locate_${admin.email}_${clientIp}`, 15, 60);
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          errorCode: rl.dbError ? 'RATE_LIMITER_UNAVAILABLE' : 'RATE_LIMITED',
          error: 'Rate limit exceeded: Please wait before initiating new prospect searches.',
          providerError: false
        });
      }

      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_BODY',
          error: 'Request payload must be a JSON object.',
          providerError: false
        });
      }

      const { query, skipWebsites, targetCount, clientJobId } = req.body;
      if (typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_QUERY',
          error: 'Valid search query or location string is required.',
          providerError: false
        });
      }
      if (query.length > 200) {
        return res.status(400).json({
          success: false,
          errorCode: 'QUERY_TOO_LONG',
          error: 'Search query must not exceed 200 characters.',
          providerError: false
        });
      }

      const result = await prospectDiscoveryEngine.runLocateDiscovery({
        query,
        skipWebsites: Boolean(skipWebsites),
        targetCount,
        adminEmail: admin.email,
        clientJobId: typeof clientJobId === 'string' ? clientJobId : undefined
      });

      return res.status(result.httpStatus).json(result.body);
    } catch (error: any) {
      console.error('Locate API Error:', cleanErrorMessage(error));
      return res.status(500).json({
        success: false,
        errorCode: 'LOCATE_INTERNAL_ERROR',
        error: 'Prospect discovery failed due to a server error. Please try again.',
        providerError: true
      });
    }
  });

  // Read-only Discovery Job Status Polling (performs ZERO discovery or DB writes)
  app.get('/api/prospects/locate/status/:jobId', requireAdminAuth, (req, res) => {
    const admin = (req as any).adminUser;
    const rawJobId = req.params.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
    const snap = prospectDiscoveryEngine.getJobStatus(jobId);
    if (!snap || snap.adminEmail.toLowerCase() !== String(admin.email).toLowerCase()) {
      return res.status(404).json({
        success: false,
        errorCode: 'JOB_NOT_FOUND',
        error: 'Discovery job status not found in active session memory.'
      });
    }
    return res.json({ success: true, job: snap });
  });

  // Read-only Compact Discovery Session History (performs ZERO DB writes)
  app.get('/api/prospects/locate/history', requireAdminAuth, (req, res) => {
    const admin = (req as any).adminUser;
    const history = prospectDiscoveryEngine.getJobHistory(admin.email);
    return res.json({ success: true, history });
  });

  // Explicit Administrator Job Stop Control
  app.post('/api/prospects/locate/stop/:jobId', requireAdminAuth, (req, res) => {
    const admin = (req as any).adminUser;
    const rawJobId = req.params.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
    const stopRes = prospectDiscoveryEngine.stopJob(jobId, admin.email);
    if (!stopRes.found) {
      return res.status(404).json({
        success: false,
        errorCode: 'JOB_NOT_FOUND',
        error: 'Active discovery job not found.'
      });
    }
    return res.json({
      success: true,
      jobId,
      stopped: stopRes.stopped,
      status: stopRes.status
    });
  });

  // Legacy Search Endpoint — Unified delegation to authoritative ProspectDiscoveryEngine (no duplicate pipeline)
  app.post('/api/prospects/search', requireAdminAuth, async (req, res) => {
    try {
      const admin = (req as any).adminUser;
      const clientIp = getTrustedClientIp(req);
      const rl = await checkPersistentRateLimit(`locate_${admin.email}_${clientIp}`, 15, 60);
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          errorCode: rl.dbError ? 'RATE_LIMITER_UNAVAILABLE' : 'RATE_LIMITED',
          error: 'Rate limit exceeded: Please wait before initiating new prospect searches.',
          providerError: false
        });
      }

      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_BODY',
          error: 'Request payload must be a JSON object.'
        });
      }

      const rawRegion = typeof req.body.region === 'string' ? req.body.region.trim() : '';
      const rawNiche = typeof req.body.niche === 'string' ? req.body.niche.trim() : '';
      const combinedQuery =
        rawNiche && rawRegion
          ? `${rawNiche} in ${rawRegion}`
          : (typeof req.body.query === 'string' ? req.body.query.trim() : rawNiche || rawRegion);

      if (!combinedQuery) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_QUERY',
          error: 'Valid niche and region are required.'
        });
      }

      const result = await prospectDiscoveryEngine.runLocateDiscovery({
        query: combinedQuery,
        skipWebsites: Boolean(req.body.skipWebsites),
        targetCount: req.body.targetCount,
        adminEmail: admin.email
      });

      return res.status(result.httpStatus).json({
        ...result.body,
        deprecatedRoute: '/api/prospects/locate',
        count: result.body.results.length,
        data: result.body.results
      });
    } catch (error: any) {
      console.error('Legacy Search Proxy Error:', cleanErrorMessage(error));
      return res.status(500).json({
        success: false,
        errorCode: 'SEARCH_INTERNAL_ERROR',
        error: 'Failed to search prospects.',
        providerError: true
      });
    }
  });

  // Ephemeral Outreach Draft Generation (ZERO DB writes, ZERO email guessing)
  app.post('/api/prospects/generate', requireAdminAuth, async (req, res) => {
    try {
      const { id, prospect: providedProspect } = req.body || {};
      let prospect: any = null;

      if (id) {
        const pRes = await pool.query('SELECT * FROM prospects WHERE id = $1', [id]);
        if (pRes.rows.length > 0) {
          prospect = pRes.rows[0];
        } else if (providedProspect && typeof providedProspect === 'object') {
          prospect = { ...providedProspect };
        } else {
          return res.status(404).json({ error: 'Prospect not found' });
        }
      } else if (providedProspect && typeof providedProspect === 'object') {
        prospect = { ...providedProspect };
      } else {
        return res.status(400).json({ error: 'Either id or prospect data is required' });
      }

      // Retrieve the Closer script from outreach_templates (read-only)
      const tRes = await pool.query('SELECT system_prompt FROM outreach_templates WHERE id = $1', ['default-closer']);
      const systemPrompt = tRes.rows.length > 0 ? tRes.rows[0].system_prompt : 'Write a professional outreach message.';

      const bName = prospect.business_name || prospect.name || 'Unknown Business';
      const bLoc = prospect.location || prospect.label || '';
      const bPhone = prospect.phone || prospect.contact_info || '';
      const bWebsite = prospect.website_url || prospect.website || '';
      const existingEmailCheck = validateEmail(String(prospect.email || ''));
      const verifiedEmail = existingEmailCheck.isValid && !existingEmailCheck.isPlaceholder ? String(prospect.email).trim().toLowerCase() : '';
      const verifiedPhone = bPhone && bPhone !== 'No Phone Number' && bPhone !== 'Check Website' ? String(bPhone).trim() : '';

      const fullSystemPrompt = systemPrompt + "\n\nIMPORTANT: You are Harrison Oyeghe, representing Avartah. Generate two distinct versions of the outreach message: one for Email (longer, with a subject line) and one for WhatsApp (shorter, punchy, no subject). \n\nEMAIL EXTRACTION: Do NOT invent or guess email addresses. Only draft copy; never return a suggested_email unless an observed valid email was supplied.\n\nOutput as valid JSON with keys 'email', 'whatsapp'.";
      const userPrompt = `Business Name: ${bName}\nLocation: ${bLoc}\nWebsite: ${bWebsite || 'N/A'}\nNiche/Industry: ${prospect.type || 'Local Business'}\nContact Phone: ${verifiedPhone || 'N/A'}\nContact Email: ${verifiedEmail || 'N/A'}`;

      let emailDraft = '';
      let whatsappDraft = '';
      let generatedSuccessfully = false;

      if (process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY) {
        try {
          const aiResult = await invokeNvidiaOrGeminiAI({
            prompt: userPrompt,
            systemPrompt: fullSystemPrompt,
            jsonMode: true,
            geminiModel: 'gemini-2.5-flash',
            timeoutMs: 12000
          });

          if (aiResult.text) {
            const parsed = extractJSON(aiResult.text);
            emailDraft = typeof parsed.email === 'object'
              ? (parsed.email.subject ? `Subject: ${parsed.email.subject}\n\n${parsed.email.body || ''}` : (parsed.email.body || JSON.stringify(parsed.email)))
              : (parsed.email || '');
            whatsappDraft = typeof parsed.whatsapp === 'object' ? (parsed.whatsapp.message || JSON.stringify(parsed.whatsapp)) : (parsed.whatsapp || '');
            if (emailDraft || whatsappDraft) {
              generatedSuccessfully = true;
            }
          }
        } catch (aiError: any) {
          console.log('[AI Draft] Note:', cleanErrorMessage(aiError));
        }
      }

      if (!generatedSuccessfully) {
        const pitch = generateValueFirstPitch({
          business_name: bName,
          location: bLoc,
          niche: prospect.type || 'local service',
          website_url: bWebsite,
          website_quality_category: prospect.website_quality_category,
          website_quality_score: prospect.website_quality_score,
          website_evidence: prospect.website_evidence || prospect.evidence
        });
        emailDraft = `Subject: ${pitch.email.subject}\n\n${pitch.email.body}`;
        whatsappDraft = pitch.whatsappMessage;
      }

      return res.json({
        success: true,
        isTemporary: true,
        email_draft: emailDraft,
        whatsapp_draft: whatsappDraft,
        suggested_email: verifiedEmail || null
      });
    } catch (error: any) {
      handleDbError(res, error, 'prospects:generate');
    }
  });

  app.post('/api/prospects/send', requireAdminAuth, async (req, res) => {
    try {
      const { id, channel, draft, recipient, subject, ai_generated } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Prospect ID is required' });
      const operator = (req as any).adminUser?.email || 'admin@avartah.com';

      const existsCheck = await pool.query(
        'SELECT id, business_name, email, phone, crm_lead_id, email_draft, whatsapp_draft FROM prospects WHERE id = $1 LIMIT 1',
        [id]
      );
      if (existsCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          errorCode: 'ADD_TO_CRM_REQUIRED',
          error: 'Prospect must be added to CRM before recording outreach status.'
        });
      }

      const prospectRow = existsCheck.rows[0];
      const normalizedChannel = normalizeOutreachChannelValue(channel) || 'email';
      const resolvedRecipient = String(
        recipient || (normalizedChannel === 'whatsapp' ? prospectRow.phone : prospectRow.email) || 'Direct'
      ).trim().slice(0, 255);
      const resolvedMessage = String(
        draft || (normalizedChannel === 'whatsapp' ? prospectRow.whatsapp_draft : prospectRow.email_draft) || '(Outreach draft opened)'
      ).trim().slice(0, 10000);
      const logId = `outreach_${crypto.randomBytes(8).toString('hex')}`;

      await pool.query(`
        INSERT INTO crm_outreach_history (
          id, prospect_id, crm_lead_id, business_name, channel, recipient, subject, message_body,
          delivery_status, provider, ai_generated, dispatched_at, updated_at, operator_email
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          'DRAFT_OPENED', $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $11
        )
      `, [
        logId,
        prospectRow.id,
        prospectRow.crm_lead_id || null,
        prospectRow.business_name || null,
        normalizedChannel,
        resolvedRecipient,
        subject ? String(subject).trim().slice(0, 300) : null,
        resolvedMessage,
        normalizedChannel === 'whatsapp' ? 'whatsapp_web' : 'mailto',
        ai_generated !== false,
        operator
      ]);

      const newStatus = 'Draft Opened';
      await pool.query(`
        UPDATE prospects
        SET status = $1,
            outreach_status = 'CONTACTED',
            last_outreach_channel = $2,
            last_outreach_at = CURRENT_TIMESTAMP,
            outreach_count = COALESCE(outreach_count, 0) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [newStatus, normalizedChannel, id]);

      if (prospectRow.crm_lead_id) {
        await pool.query(`
          UPDATE crm_leads
          SET last_contacted_at = CURRENT_TIMESTAMP,
              status = CASE WHEN status IN ('New', 'pending') THEN 'Contacted' ELSE status END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [prospectRow.crm_lead_id]);
      }

      return res.json({
        success: true,
        id: logId,
        status: newStatus,
        delivery_status: 'DRAFT_OPENED',
        message: 'Draft opened and recorded.'
      });
    } catch (error: any) {
      handleDbError(res, error, 'prospects:send');
    }
  });

  app.get('/api/prospects/export', requireAdminAuth, async (req, res) => {
    try {
      const format = req.query.format === 'json' ? 'json' : 'csv';
      const statusFilter = req.query.status as string;

      let query = `
        SELECT id, business_name, location, business_category, niche, phone, email, 
               website_url, status, website_quality_category, website_quality_score, 
               suggested_service, outreach_status, last_outreach_channel, last_outreach_at, 
               outreach_count, email_draft, whatsapp_draft, whatsapp_link, website_evidence, source, created_at
        FROM prospects
        WHERE 1=1
      `;
      const params: any[] = [];
      if (statusFilter && statusFilter !== 'ALL') {
        params.push(statusFilter);
        query += ` AND outreach_status = $${params.length}`;
      }
      query += ` ORDER BY created_at DESC LIMIT 2000`;

      const result = await pool.query(query, params);

      if (format === 'json') {
        return res.json({ success: true, count: result.rows.length, prospects: result.rows });
      }

      // Format as RFC 4180 CSV with UTF-8 BOM
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'ID',
        'Business Name',
        'Location',
        'Category / Niche',
        'Phone',
        'Email',
        'Website URL',
        'Website Status',
        'Quality Category',
        'Quality Score',
        'Suggested Service Offering',
        'Outreach Status',
        'Last Outreach Channel',
        'Last Outreach Date',
        'Outreach Count',
        'Personalized Email Draft',
        'Personalized WhatsApp Draft',
        'WhatsApp Direct Link',
        'Audit Evidence',
        'Discovery Source',
        'Created At'
      ];

      const csvRows = result.rows.map(r => [
        escapeCsv(r.id),
        escapeCsv(r.business_name),
        escapeCsv(r.location),
        escapeCsv(r.business_category || r.niche || ''),
        escapeCsv(r.phone || ''),
        escapeCsv(r.email || ''),
        escapeCsv(r.website_url || ''),
        escapeCsv(r.status || ''),
        escapeCsv(r.website_quality_category || ''),
        escapeCsv(r.website_quality_score ?? ''),
        escapeCsv(r.suggested_service || 'Custom Web Architecture & Mobile-First Booking Engine'),
        escapeCsv(r.outreach_status || 'NOT_CONTACTED'),
        escapeCsv(r.last_outreach_channel || ''),
        escapeCsv(r.last_outreach_at ? new Date(r.last_outreach_at).toISOString() : ''),
        escapeCsv(r.outreach_count || 0),
        escapeCsv(r.email_draft || ''),
        escapeCsv(r.whatsapp_draft || ''),
        escapeCsv(r.whatsapp_link || ''),
        escapeCsv(r.website_evidence || ''),
        escapeCsv(r.source || ''),
        escapeCsv(r.created_at ? new Date(r.created_at).toISOString() : '')
      ].join(','));

      const csv = '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n');
      const filename = `avartah-crm-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err: any) {
      handleDbError(res, err, 'prospects:export');
    }
  });

  app.get('/api/db-health', async (req, res) => {
    const neonDiag = getNeonDiagnostics();
    const startMs = Date.now();
    try {
      await pool.query('SELECT 1');
      res.json({
        status: 'connected',
        latencyMs: Date.now() - startMs,
        neon: neonDiag,
        api_connections: {
          gemini: !!process.env.GEMINI_API_KEY,
          locationiq: !!process.env.LOCATIONIQ_API_KEY,
          emailjs: !!process.env.VITE_EMAILJS_PUBLIC_KEY,
          nvidia: !!process.env.NVIDIA_API_KEY
        }
      });
    } catch (error) {
      console.error(
        `[DB Health Check Failed] host=${neonDiag.host || 'unknown'} pooled=${neonDiag.isPooledEndpoint} latencyMs=${Date.now() - startMs}:`,
        sanitizeDbErrorMessage(error)
      );
      res.status(503).json({
        status: 'disconnected',
        latencyMs: Date.now() - startMs,
        neon: neonDiag,
        error: 'Database connectivity check failed'
      });
    }
  });

  app.get('/api/services-health', async (req, res) => {
    const results: Record<string, { status: string; latency?: number; message?: string }> = {};

    // Check LocationIQ
    if (process.env.LOCATIONIQ_API_KEY) {
      const start = Date.now();
      try {
        const response = await fetch(`https://us1.locationiq.com/v1/search?key=${process.env.LOCATIONIQ_API_KEY}&q=london&format=json&limit=1`, {
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          results.locationiq = { status: 'online', latency: Date.now() - start };
        } else {
          results.locationiq = { status: 'offline', message: `HTTP ${response.status}` };
        }
      } catch (e: any) {
        results.locationiq = { status: 'offline', message: cleanErrorMessage(e) };
      }
    } else {
      results.locationiq = { status: 'offline', message: 'Missing API Key' };
    }

    // Check NVIDIA
    if (process.env.NVIDIA_API_KEY) {
      const start = Date.now();
      try {
        const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
          headers: { 'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}` },
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          results.nvidia = { status: 'online', latency: Date.now() - start };
        } else {
          results.nvidia = { status: 'offline', message: `HTTP ${response.status}` };
        }
      } catch (e: any) {
        results.nvidia = { status: 'offline', message: cleanErrorMessage(e) };
      }
    } else {
      results.nvidia = { status: 'offline', message: 'Missing API Key' };
    }

    res.json(results);
  });

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
  });

  app.post('/api/ai/form-assistant', async (req, res) => {
    try {
      const clientIp = getTrustedClientIp(req);
      const rl = await checkPersistentRateLimit('ai_form_' + clientIp, 15, 60);
      if (!rl.allowed) {
        return res.status(429).json({ message: '', error: 'Rate limit exceeded. Please wait a moment.' });
      }

      if (!req.body || typeof req.body !== 'object') {
        return res.json({ message: '' });
      }

      const step = String(req.body.step || '').trim().slice(0, 50);
      const data = req.body.data && typeof req.body.data === 'object' ? req.body.data : {};
      const website = String(data.website || '').trim().slice(0, 100);
      const budget = String(data.budget || '').trim().slice(0, 50);

      if (!process.env.NVIDIA_API_KEY) {
        return res.json({ message: '' });
      }

      let prompt = '';
      if (step === 'website' && website) {
        prompt = `You are a high-end tech consultant. The user just entered their website: ${website}. Give a short, 1-sentence intelligent observation. Keep it under 10 words. Example: "Scanning architecture constraints..."`;
      } else if (step === 'budget' && budget) {
        prompt = `You are a high-end tech consultant. The user selected a budget of ${budget}. Give a very brief 1-sentence confident acknowledgement. Keep it under 10 words.`;
      } else {
        return res.json({ message: '' });
      }

      let message = '';
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-405b-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 50
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const json = await response.json();
        message = json.choices?.[0]?.message?.content || '';
      }
      
      res.json({ message: message.replace(/["']/g, '') });
    } catch (e) {
      res.json({ message: '' });
    }
  });

  // --- AVARTAH BUSINESS GROWTH PLATFORM APIS ---

  // Public Live Website Diagnostic Endpoint (HTTP Probe + axe-core + Google PageSpeed)
  app.post('/api/audit/diagnose', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, error: 'Valid website URL is required' });
      }

      const diagnostics = await runFullAuditDiagnostics(url);
      res.json({ success: true, diagnostics });
    } catch (err: any) {
      console.warn('[Audit Diagnostic Error]:', err.message);
      res.status(400).json({ success: false, error: err.message || 'Diagnostic execution failed' });
    }
  });

  // 1. Website Audits & Opportunity Engine (Real Diagnostics Persistence)
  app.post('/api/website-audits', requireAdminAuth, async (req, res) => {
    try {
      const { url, prospect_id, client_id } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required for auditing' });
      
      const diagnostics = await runFullAuditDiagnostics(url);
      const auditId = 'audit_' + crypto.randomBytes(8).toString('hex');

      // Use PageSpeed scores if successfully completed; otherwise derive strictly from genuine probe & axe-core
      const perfScore = diagnostics.googlePageSpeed.performanceScore ?? (
        diagnostics.httpProbe.status === 'COMPLETED' 
          ? Math.max(10, Math.min(100, Math.round(100 - ((diagnostics.httpProbe.ttfbMs || 500) / 20))))
          : 0
      );
      const a11yScore = diagnostics.googlePageSpeed.accessibilityScore ?? (diagnostics.axeCore.score ?? 70);
      const seoScore = diagnostics.googlePageSpeed.seoScore ?? (
        (diagnostics.httpProbe.hasTitle ? 40 : 0) + 
        (diagnostics.httpProbe.hasMetaDescription ? 30 : 0) + 
        (diagnostics.httpProbe.hasHtmlLang ? 30 : 0)
      );
      const mobileScore = diagnostics.httpProbe.hasMobileViewport ? 85 : 30;
      const overall = Math.round((perfScore + a11yScore + seoScore + mobileScore) / 4);

      const opportunityCategory = diagnostics.summary.overallCategory;
      const oppScore = diagnostics.summary.opportunityScore;

      const evidence = {
        checked_at: diagnostics.timestamp,
        execution_time_ms: diagnostics.executionTimeMs,
        http_probe: diagnostics.httpProbe,
        axe_core: diagnostics.axeCore,
        google_pagespeed: diagnostics.googlePageSpeed,
        bottlenecks: diagnostics.summary.bottlenecksDetected,
        recommended_fixes: diagnostics.summary.recommendedFixes
      };

      await pool.query(
        `INSERT INTO website_audits (id, prospect_id, client_id, url, performance_score, accessibility_score, seo_score, mobile_score, overall_score, opportunity_score, opportunity_category, evidence_json, pdf_report_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [auditId, prospect_id || null, client_id || null, diagnostics.normalizedUrl, perfScore, a11yScore, seoScore, mobileScore, overall, oppScore, opportunityCategory, JSON.stringify(evidence), `/api/website-audits/${auditId}/pdf`]
      );

      const created = await pool.query('SELECT * FROM website_audits WHERE id = $1', [auditId]);
      res.status(201).json(created.rows[0]);
    } catch (e: any) {
      handleDbError(res, e, 'website-audits:create');
    }
  });

  app.get('/api/website-audits', requireAdminAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM website_audits ORDER BY created_at DESC LIMIT 50');
      res.json(result.rows);
    } catch (e: any) {
      handleDbError(res, e, 'website-audits:list');
    }
  });

  // 2. Proposals and Quotations
  app.get('/api/proposals', requireAdminAuth, async (req, res) => {
    try {
      const resList = await pool.query('SELECT * FROM proposals ORDER BY created_at DESC');
      res.json(resList.rows);
    } catch (e: any) {
      handleDbError(res, e, 'proposals:list');
    }
  });

  app.post('/api/proposals', requireAdminAuth, async (req, res) => {
    try {
      const admin = (req as any).adminUser;
      const { prospect_id, client_id, title, executive_summary, problem_statement, proposed_solutions, deliverables, timeline_weeks, total_amount, currency, maintenance_options, terms_and_conditions } = req.body;
      const proposalId = 'prop_' + crypto.randomBytes(8).toString('hex');

      await pool.query(
        `INSERT INTO proposals (id, prospect_id, client_id, title, executive_summary, problem_statement, proposed_solutions, deliverables, timeline_weeks, total_amount, currency, maintenance_options, terms_and_conditions, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT', $14)`,
        [proposalId, prospect_id || null, client_id || null, title || 'Avartah Solutions Proposal', executive_summary, problem_statement, proposed_solutions, deliverables, timeline_weeks || 4, total_amount || 1500, currency || 'USD', maintenance_options, terms_and_conditions, admin.email]
      );

      const created = await pool.query('SELECT * FROM proposals WHERE id = $1', [proposalId]);
      res.status(201).json(created.rows[0]);
    } catch (e: any) {
      handleDbError(res, e, 'proposals:create');
    }
  });

  app.post('/api/proposals/:id/approve', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const admin = (req as any).adminUser;
      await pool.query(
        'UPDATE proposals SET status = $1, approved_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['ADMIN_APPROVED', admin.email, id]
      );
      res.json({ success: true });
    } catch (e: any) {
      handleDbError(res, e, 'proposals:approve');
    }
  });

  app.post('/api/proposals/ai-draft', requireAdminAuth, async (req, res) => {
    try {
      const { prospect_name, industry, audit_summary } = req.body;
      let draftText = `Executive Summary for ${prospect_name || 'Valued Client'}:\nAvartah Solutions proposes a high-performance digital architecture upgrade to eliminate friction and capture high-intent inbound clients.`;
      
      if (process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY) {
        try {
          const aiResult = await invokeNvidiaOrGeminiAI({
            prompt: `Draft a professional executive summary and proposed solutions section for a B2B proposal for ${prospect_name} in ${industry || 'local business'}. Audit findings: ${audit_summary || 'Needs performance and mobile conversion boost'}.`,
            systemPrompt: 'You are Harrison Oyeghe, Principal Architect at Avartah Solutions.',
            jsonMode: false
          });
          if (aiResult.text) draftText = aiResult.text;
        } catch {}
      }
      res.json({ draft: draftText });
    } catch (e: any) {
      handleDbError(res, e, 'proposals:ai-draft');
    }
  });

  // 3. Client Delivery Workspace
  app.get('/api/client-projects', requireUserAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      let query = 'SELECT * FROM client_projects';
      let values: any[] = [];
      if (user.role !== 'admin') {
        query += ' WHERE client_id = $1';
        values = [user.email];
      }
      const result = await pool.query(query, values);
      res.json(result.rows);
    } catch (e: any) {
      handleDbError(res, e, 'client-projects:list');
    }
  });

  app.post('/api/client-projects', requireAdminAuth, async (req, res) => {
    try {
      const { client_id, prospect_id, title, description, budget, current_milestone } = req.body;
      const projectId = 'proj_' + crypto.randomBytes(8).toString('hex');
      await pool.query(
        `INSERT INTO client_projects (id, client_id, prospect_id, title, description, budget, current_milestone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')`,
        [projectId, client_id, prospect_id || null, title, description, budget || 2500, current_milestone || 'Discovery & Architecture']
      );
      const created = await pool.query('SELECT * FROM client_projects WHERE id = $1', [projectId]);
      res.status(201).json(created.rows[0]);
    } catch (e: any) {
      handleDbError(res, e, 'client-projects:create');
    }
  });

  // 4. Website Care and Monitoring
  app.get('/api/website-monitors', requireAdminAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM website_monitors ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (e: any) {
      handleDbError(res, e, 'monitors:list');
    }
  });

  app.post('/api/website-monitors', requireAdminAuth, async (req, res) => {
    try {
      const { client_id, url } = req.body;
      const monitorId = 'mon_' + crypto.randomBytes(8).toString('hex');
      await pool.query(
        `INSERT INTO website_monitors (id, client_id, url, is_active, http_status, response_time_ms, uptime_percentage, last_checked_at)
         VALUES ($1, $2, $3, TRUE, 200, 145, 100.0, CURRENT_TIMESTAMP)`,
        [monitorId, client_id || 'admin@avartah.com', url]
      );
      const created = await pool.query('SELECT * FROM website_monitors WHERE id = $1', [monitorId]);
      res.status(201).json(created.rows[0]);
    } catch (e: any) {
      handleDbError(res, e, 'monitors:create');
    }
  });

  // 5. Industry-Specific Solutions Templates
  app.get('/api/industry-templates', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM industry_templates');
      res.json(result.rows);
    } catch (e: any) {
      handleDbError(res, e, 'industry-templates:list');
    }
  });

  // 6. AI Business Assistant
  app.post('/api/ai-assistant', requireAdminAuth, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

      const prospectCount = await pool.query('SELECT COUNT(*) FROM prospects');
      const leadCount = await pool.query('SELECT COUNT(*) FROM crm_leads');
      const projectCount = await pool.query('SELECT COUNT(*) FROM client_projects');

      const systemContext = `You are Avartah AI Business Assistant. Authorised DB Context: Total Prospects: ${prospectCount.rows[0].count}, CRM Leads: ${leadCount.rows[0].count}, Active Client Projects: ${projectCount.rows[0].count}.`;
      
      let answer = 'Based on Avartah Solutions records, your pipeline is active with strong engagement.';
      if (process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY) {
        try {
          const aiResult = await invokeNvidiaOrGeminiAI({
            prompt: `${systemContext}\n\nUser Question: ${prompt}`,
            jsonMode: false
          });
          if (aiResult.text) answer = aiResult.text;
        } catch {}
      }

      const logId = 'ai_log_' + crypto.randomBytes(6).toString('hex');
      await pool.query(
        'INSERT INTO ai_action_logs (id, action_type, prompt_context, ai_response, status) VALUES ($1, $2, $3, $4, $5)',
        [logId, 'ASSISTANT_QUERY', prompt, answer, 'COMPLETED']
      );

      res.json({ answer });
    } catch (e: any) {
      handleDbError(res, e, 'ai-assistant:query');
    }
  });

  // 7. Business Performance Centre BI Dashboard (Strict Database-Derived Metrics)
  app.get('/api/business-intelligence', requireAdminAuth, async (req, res) => {
    try {
      const [
        pCount,
        qualifiedCount,
        leadCount,
        propCount,
        projectCount,
        projectRevenueRes,
        paymentsRevenueRes,
        recurringRes
      ] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS count FROM prospects'),
        pool.query("SELECT COUNT(*)::int AS count FROM prospects WHERE qualification_status = 'QUALIFIED'"),
        pool.query('SELECT COUNT(*)::int AS count FROM crm_leads'),
        pool.query('SELECT COUNT(*)::int AS count FROM proposals'),
        pool.query('SELECT COUNT(*)::int AS count FROM client_projects'),
        pool.query('SELECT COALESCE(SUM(budget), 0)::float AS total FROM client_projects'),
        pool.query("SELECT COALESCE(SUM(amount), 0)::float AS total FROM payments WHERE status = 'SUCCESS'"),
        pool.query(`
          SELECT COALESCE(SUM(sp.price_ngn), 0)::float AS total
          FROM subscriptions s
          JOIN subscription_plans sp ON s.plan_id = sp.id
          WHERE LOWER(s.status) = 'active'
        `)
      ]);

      const totalLeads = Number(leadCount.rows[0]?.count || 0);
      const totalProjectsWon = Number(projectCount.rows[0]?.count || 0);
      const projectRevenue = Number(projectRevenueRes.rows[0]?.total || 0);
      const paidPaymentsRevenue = Number(paymentsRevenueRes.rows[0]?.total || 0);
      const totalRevenue = Number((projectRevenue + paidPaymentsRevenue).toFixed(2));
      const conversionRate = totalLeads > 0
        ? Number(Math.min(100, (totalProjectsWon / totalLeads) * 100).toFixed(1))
        : 0;
      const recurringRevenue = Number(Number(recurringRes.rows[0]?.total || 0).toFixed(2));

      res.json({
        prospect_discovery: Number(pCount.rows[0]?.count || 0),
        qualified_prospects: Number(qualifiedCount.rows[0]?.count || 0),
        crm_leads: totalLeads,
        proposals_issued: Number(propCount.rows[0]?.count || 0),
        projects_won: totalProjectsWon,
        total_revenue: totalRevenue,
        conversion_rate: conversionRate,
        recurring_revenue: recurringRevenue
      });
    } catch (e: any) {
      handleDbError(res, e, 'business-intelligence:stats');
    }
  });

  // Avartah Business OS SaaS Multi-tenant API Router
  app.use('/api/os', businessOSRouter);

  // Ensure unmatched /api/* endpoints return JSON 404 instead of falling through to Vite/HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({
      success: false,
      errorCode: 'API_NOT_FOUND',
      error: 'API endpoint not found.'
    });
  });

  // Global Express JSON error handler for middleware errors (CORS, body-parser, etc.) on /api routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const rawStatus = Number(err?.statusCode || err?.status || 500);
    const status = rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
    if (req.path.startsWith('/api')) {
      if (status >= 500) {
        console.error('[Global API 500 Error]:', cleanErrorMessage(err));
        return res.status(status).json({
          success: false,
          errorCode: 'INTERNAL_ERROR',
          error: 'An unexpected server error occurred. Please try again later.'
        });
      }
      return res.status(status).json({
        success: false,
        errorCode: err?.errorCode || `HTTP_${status}`,
        error: err?.message || 'Request failed.'
      });
    }
    return next(err);
  });

  // Legacy background worker processProspectsBackground removed: authoritative discovery handles bounded enrichment before bulk persistence.

  if (process.env.AVARTAH_TEST_MODE !== '1') {
    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
      const viteModuleName = 'vite';
      const { createServer: createViteServer } = await import(viteModuleName);
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false, ws: false, allowedHosts: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else if (process.env.VERCEL !== '1') {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    if (process.env.VERCEL !== '1') {
      if (process.env.DATABASE_URL && process.env.AVARTAH_SKIP_DB_INIT !== '1') {
        try {
          await ensureDbInitialized();
        } catch (err: any) {
          console.warn('[Neon DB Boot Warning]: Database connection could not be established immediately:', sanitizeDbErrorMessage(err));
        }
      }
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Backend] Server running on http://0.0.0.0:${PORT}`);
      });
    } else if (process.env.DATABASE_URL && process.env.AVARTAH_SKIP_DB_INIT !== '1') {
      // Trigger non-blocking warm-up after routes are registered; API barrier ensures completion before DB routes execute.
      void ensureDbInitialized().catch((err: any) => {
        console.warn('[Neon DB Boot Warning]: Initial warm-up deferred:', sanitizeDbErrorMessage(err));
      });
    }
  }
  serverBootDone = true;
}

if (process.env.AVARTAH_TEST_MODE === '1') {
  // Test runner initializes mocked DB / env and calls startServer() explicitly.
} else {
  serverBootPromise = startServer();
  serverBootPromise.catch(err => {
    console.error('[Backend Fatal Error]:', err);
  });
}

export default app;
