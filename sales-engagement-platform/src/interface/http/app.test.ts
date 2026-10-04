import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { DomainError } from '../../domain/errors.js';
import { loadConfig } from '../../infrastructure/config.js';
import { buildApp } from './app.js';
import type { ErrorBody } from './errors.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

function make() {
  app = buildApp({ config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }) });
  return app;
}

describe('GET /health', () => {
  it('returns ok with a generated request id', async () => {
    const res = await make().inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('propagates a well-formed inbound x-request-id', async () => {
    const res = await make().inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'req_abc-123.XYZ' } });
    expect(res.headers['x-request-id']).toBe('req_abc-123.XYZ');
  });

  it.each(['bad\nid-injected', 'x'.repeat(200), 'short', '<script>'])(
    'replaces a malformed inbound x-request-id (%#)',
    async (bad) => {
      const res = await make().inject({ method: 'GET', url: '/health', headers: { 'x-request-id': bad } });
      expect(res.headers['x-request-id']).not.toBe(bad);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});

describe('GET /config', () => {
  it('serves only the client-safe projection', async () => {
    const res = await make().inject({ method: 'GET', url: '/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      flags: {
        AI_VOICE_ENABLED: false,
        AUTO_DIAL_ENABLED: false,
        RECORDING_ENABLED: false,
        HUMAN_HANDOFF_ENABLED: false,
      },
      outboundHalted: true,
      timezone: 'Asia/Tokyo',
    });
  });
});

describe('error envelope', () => {
  it('unknown route → 404 NOT_FOUND with requestId', async () => {
    const res = await make().inject({ method: 'GET', url: '/nope', headers: { 'x-request-id': 'req-00000001' } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found', requestId: 'req-00000001' } });
  });

  it('DomainError maps to its HTTP status and exposes code + retryable', async () => {
    const a = make();
    a.get('/suppressed', () => {
      throw new DomainError('CONTACT_SUPPRESSED', 'Contact cannot be called', { reason: 'DO_NOT_CALL' });
    });
    const res = await a.inject({ method: 'GET', url: '/suppressed' });
    expect(res.statusCode).toBe(409);
    expect(res.json<ErrorBody>().error).toMatchObject({
      code: 'CONTACT_SUPPRESSED',
      retryable: false,
      details: { reason: 'DO_NOT_CALL' },
    });
  });

  it('unexpected errors → 500 INTERNAL_ERROR without leaking internals', async () => {
    const a = make();
    a.get('/boom', () => {
      throw new Error('db password=hunter2 at 10.0.0.5');
    });
    const res = await a.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('hunter2');
    expect(res.body).not.toContain('10.0.0.5');
    expect(res.json<ErrorBody>().error.code).toBe('INTERNAL_ERROR');
  });

  it('schema validation failures → 400 VALIDATION_ERROR', async () => {
    const a = make();
    a.post(
      '/echo',
      { schema: { body: { type: 'object', required: ['n'], properties: { n: { type: 'integer' } } } } },
      () => ({}),
    );
    const res = await a.inject({ method: 'POST', url: '/echo', payload: { n: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(res.json<ErrorBody>().error.code).toBe('VALIDATION_ERROR');
  });
});
