import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL CONFIGURATION]: DATABASE_URL is not defined in production environment.');
    throw new Error('FATAL CONFIGURATION: DATABASE_URL is missing in production environment.');
  } else {
    console.warn('[WARNING]: DATABASE_URL is not defined. Database operations will fail unless configured.');
  }
}

// Bounded Neon Serverless connection pool configured for Vercel/Node execution boundaries
const pool = new Pool({
  connectionString: connectionString || '',
  max: 10, // Prevent unbounded connection pools across concurrent serverless instances
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err: any) => {
  console.warn('[Neon Pool Notice]: Idle client warning:', err?.message || err);
});

export const query = async (text: string, params?: any[]) => {
  return await pool.query(text, params);
};

export const checkNeonConnection = async (): Promise<boolean> => {
  try {
    if (!connectionString) return false;
    const res = await pool.query('SELECT 1 as connected');
    return res.rows[0]?.connected === 1;
  } catch (err) {
    console.error('[Neon Connection Check Failed]:', err);
    return false;
  }
};

export default pool;
