import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../../server.js';

/**
 * Integrated Vercel Serverless Handler: Lead by ID
 * Delegates to the authoritative Express application in server.ts.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
