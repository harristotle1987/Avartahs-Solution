import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();

// Explicitly wire `ws` so Node.js WebSocket connections in serverless runtimes
// do not rely on experimental global WebSocket implementations.
neonConfig.webSocketConstructor = ws;

export interface NeonConnectionDiagnostics {
  configured: boolean;
  validUrl: boolean;
  host: string | null;
  database: string | null;
  isNeonHost: boolean;
  isPooledEndpoint: boolean;
  sslMode: string | null;
  transport: 'fetch+ws' | 'ws';
  poolMax: number;
}

function sanitizeConnectionString(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function sanitizeDbErrorMessage(err: unknown): string {
  const raw = typeof err === 'string' ? err : ((err as any)?.message || String(err || 'Unknown database error'));
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]')
    .replace(/(password|secret|key|token|bearer|authorization)=?[^\s&'"]+/gi, '$1=[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function parseDatabaseMetadata(connStr: string, poolMax: number): NeonConnectionDiagnostics {
  if (!connStr) {
    return {
      configured: false,
      validUrl: false,
      host: null,
      database: null,
      isNeonHost: false,
      isPooledEndpoint: false,
      sslMode: null,
      transport: 'ws',
      poolMax
    };
  }

  try {
    const parsed = new URL(connStr);
    const host = parsed.hostname ? parsed.hostname.toLowerCase() : null;
    const database = parsed.pathname ? parsed.pathname.replace(/^\/+/, '') || null : null;
    const isNeonHost = Boolean(host && (host.endsWith('.neon.tech') || host.endsWith('.neon.build')));
    const isPooledEndpoint = Boolean(
      (host && host.includes('-pooler')) || parsed.port === '6543'
    );
    const sslMode = parsed.searchParams.get('sslmode');

    return {
      configured: true,
      validUrl: Boolean(host),
      host,
      database,
      isNeonHost,
      isPooledEndpoint,
      sslMode,
      transport: isNeonHost ? 'fetch+ws' : 'ws',
      poolMax
    };
  } catch {
    return {
      configured: true,
      validUrl: false,
      host: null,
      database: null,
      isNeonHost: false,
      isPooledEndpoint: false,
      sslMode: null,
      transport: 'ws',
      poolMax
    };
  }
}

const cleanConnectionString = sanitizeConnectionString(process.env.DATABASE_URL);
const isServerlessRuntime = Boolean(
  process.env.VERCEL === '1' ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NODE_ENV === 'production'
);
const poolMax = isServerlessRuntime ? 5 : 10;
const diagnostics = parseDatabaseMetadata(cleanConnectionString, poolMax);

if (!diagnostics.configured) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Neon DB Configuration Error]: DATABASE_URL is not configured in production environment.');
  } else {
    console.warn('[WARNING]: DATABASE_URL is not defined. Database operations will fail unless configured.');
  }
} else if (!diagnostics.validUrl) {
  console.error('[Neon DB Configuration Error]: DATABASE_URL could not be parsed as a valid PostgreSQL connection URI.');
} else {
  if (diagnostics.isNeonHost) {
    // Use Neon HTTP /sql fetch transport for stateless single-statement pool.query() calls
    // while retaining ws WebSocket connections for pool.connect() transactions & migrations.
    neonConfig.poolQueryViaFetch = true;
    neonConfig.fetchFunction = (input: RequestInfo | URL, init?: RequestInit) => {
      const fetchImpl = globalThis.fetch;
      if (!init?.signal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return fetchImpl(input, { ...init, signal: AbortSignal.timeout(10000) });
      }
      return fetchImpl(input, init);
    };

    if (isServerlessRuntime && !diagnostics.isPooledEndpoint) {
      console.warn(
        `[Neon Pool Advisory]: Non-pooled Neon host (${diagnostics.host}) detected in serverless production. ` +
        'Use the Neon -pooler endpoint with ?sslmode=require to avoid connection exhaustion and timeouts.'
      );
    }
  }

  const isLocalHost = diagnostics.host === 'localhost' || diagnostics.host === '127.0.0.1';
  if (!isLocalHost && diagnostics.sslMode !== 'require' && diagnostics.sslMode !== 'verify-full') {
    console.warn(`[Neon Pool Advisory]: sslmode=require is recommended for remote PostgreSQL host (${diagnostics.host}).`);
  }
}

export function getNeonDiagnostics(): NeonConnectionDiagnostics {
  const currentUrl = sanitizeConnectionString(process.env.DATABASE_URL) || cleanConnectionString;
  return parseDatabaseMetadata(currentUrl, poolMax);
}

export function isTransientNeonError(err: unknown): boolean {
  if (!err) return false;
  const code = String((err as any)?.code || (err as any)?.cause?.code || '').toUpperCase();
  const name = String((err as any)?.name || '').toLowerCase();
  const msg = String((err as any)?.message || err || '').toLowerCase();

  // Never retry SQL schema, constraint, or syntax errors
  if (
    code === '42703' || // undefined_column
    code === '42P01' || // undefined_table
    code === '42601' || // syntax_error
    code === '23505' || // unique_violation
    code === '23503' || // foreign_key_violation
    code === '23502' || // not_null_violation
    code === '22P02' || // invalid_text_representation
    code === '28P01' || // invalid_password
    code === '28000'    // invalid_authorization_specification
  ) {
    return false;
  }

  const transientCodes = new Set([
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now (Neon compute waking up)
    '08000', // connection_exception
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08003', // connection_does_not_exist
    '08006', // connection_failure
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EPIPE',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
    'UND_ERR_HEADERS_TIMEOUT'
  ]);
  if (transientCodes.has(code)) return true;
  if (name === 'timeouterror' || name === 'aborterror') return true;

  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('connection terminated') ||
    msg.includes('terminating connection') ||
    msg.includes('connection closed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('epipe') ||
    msg.includes('socket hang up') ||
    msg.includes('websocket') ||
    msg.includes('unexpected server response') ||
    msg.includes('fetch failed') ||
    msg.includes('error connecting to database') ||
    msg.includes('cannot_connect_now') ||
    msg.includes('remaining connection slots')
  );
}

export async function executeWithRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 250);
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err: any) {
      const transient = isTransientNeonError(err);
      if (transient && attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[Neon Transient Retry ${attempt}/${maxAttempts - 1}] op=${operationName} host=${diagnostics.host || 'unconfigured'} ` +
          `pooled=${diagnostics.isPooledEndpoint} code=${err?.code || 'NONE'} delayMs=${delayMs}: ${sanitizeDbErrorMessage(err)}`
        );
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        continue;
      }
      throw err;
    }
  }
}

// Single module-scoped Neon Serverless Pool reused across warm Vercel invocations.
const pool = new Pool({
  connectionString: cleanConnectionString || undefined,
  max: poolMax,
  idleTimeoutMillis: isServerlessRuntime ? 10000 : 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true
});

pool.on('error', (err: any) => {
  console.warn(
    `[Neon Pool Notice] host=${diagnostics.host || 'unconfigured'} pooled=${diagnostics.isPooledEndpoint}:`,
    sanitizeDbErrorMessage(err)
  );
});

const rawPoolQuery = pool.query.bind(pool);
const rawPoolConnect = pool.connect.bind(pool);

(pool as any).query = (...args: any[]) => {
  const lastArg = args[args.length - 1];
  if (typeof lastArg === 'function') {
    return (rawPoolQuery as any)(...args);
  }
  return executeWithRetry('pool.query', () => (rawPoolQuery as any)(...args));
};

(pool as any).connect = (...args: any[]) => {
  const lastArg = args[args.length - 1];
  if (typeof lastArg === 'function') {
    return (rawPoolConnect as any)(...args);
  }
  return executeWithRetry('pool.connect', () => (rawPoolConnect as any)(...args));
};

export const query = async (text: string, params?: any[], retries = 3, delayMs = 250) => {
  return executeWithRetry('query', () => pool.query(text, params), {
    maxAttempts: retries,
    baseDelayMs: delayMs
  });
};

export const checkNeonConnection = async (): Promise<boolean> => {
  try {
    if (!sanitizeConnectionString(process.env.DATABASE_URL) && !cleanConnectionString) return false;
    const res = await pool.query('SELECT 1 as connected');
    return res.rows[0]?.connected === 1;
  } catch (err) {
    console.error(
      `[Neon Connection Check Failed] host=${diagnostics.host || 'unconfigured'} pooled=${diagnostics.isPooledEndpoint}:`,
      sanitizeDbErrorMessage(err)
    );
    return false;
  }
};

export default pool;
