
import { neon } from '@neondatabase/serverless';

// Neon Serverless Connection
// Using the connection string provided by the user
const connectionString = (typeof process !== 'undefined' ? process.env.DATABASE_URL : '') || 'postgresql://neondb_owner:npg_Tqp0ojdvy4ZP@ep-wandering-salad-anmmi2ea-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export const sql = neon(connectionString);

/**
 * Database Status Check
 */
export const isNeonConfigured = !!connectionString && connectionString.includes('neon.tech');
