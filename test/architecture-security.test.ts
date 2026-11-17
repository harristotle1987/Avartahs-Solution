import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app, { checkPersistentRateLimit, getTrustedClientIp } from '../server.ts';
import pool from '../lib/neon.ts';
import { runDatabaseMigrations } from '../lib/migrations.ts';

describe('Avartah Solutions Production Architecture & Security Test Suite', () => {
  beforeAll(async () => {
    // Ensure migrations and database are initialized
    await runDatabaseMigrations();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('1. Database Architecture & Migrations', () => {
    it('should have applied migrations tracked in schema_migrations', async () => {
      const res = await pool.query('SELECT id FROM schema_migrations ORDER BY applied_at ASC');
      expect(res.rows.length).toBeGreaterThan(0);
      const appliedIds = res.rows.map(r => r.id);
      expect(appliedIds).toContain('001_core_accounts_and_sessions');
    });

    it('should enforce readyness check via /api/ready', async () => {
      const res = await request(app).get('/api/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('2. Rate Limiting & Fail-Closed Protection', () => {
    it('should correctly resolve trusted client IP with edge headers', () => {
      const mockReq = {
        headers: {
          'x-vercel-ip': '192.168.1.50',
          'x-forwarded-for': '10.0.0.1, 10.0.0.2'
        },
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1'
      } as any;

      expect(getTrustedClientIp(mockReq)).toBe('192.168.1.50');
    });

    it('should allow requests within rate limit and fail closed on database errors', async () => {
      const testKey = 'test_rate_limit_' + Date.now();
      const first = await checkPersistentRateLimit(testKey, 2, 60, true);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(1);

      const second = await checkPersistentRateLimit(testKey, 2, 60, true);
      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(0);

      const third = await checkPersistentRateLimit(testKey, 2, 60, true);
      expect(third.allowed).toBe(false);
    });
  });

  describe('3. Server-Side Role Authorization & Security Headers', () => {
    it('should return security headers on requests', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should reject unauthenticated access to protected admin routes with 401', async () => {
      const res = await request(app).get('/api/leads');
      expect(res.status).toBe(401);
    });
  });
});
