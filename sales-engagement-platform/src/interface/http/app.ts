import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { DomainError, isRetryable } from '../../domain/errors.js';
import { toClientSafeConfig, type AppConfig } from '../../infrastructure/config.js';
import { loggerOptions } from '../../infrastructure/logging/logger.js';
import { HTTP_STATUS, type ErrorBody } from './errors.js';

// Accept only ids that are safe to echo into headers and logs (no CR/LF, bounded length).
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export type AppDeps = { config: AppConfig };

export function buildApp({ config }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: loggerOptions(config.logLevel),
    requestIdHeader: false,
    genReqId: (req) => {
      const inbound = req.headers['x-request-id'];
      return typeof inbound === 'string' && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID();
    },
  });

  app.addHook('onRequest', async (req, reply) => {
    void reply.header('x-request-id', req.id);
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof DomainError) {
      const body: ErrorBody = {
        error: {
          code: err.code,
          message: err.message,
          requestId: req.id,
          retryable: err.retryable,
          details: err.details,
        },
      };
      return reply.status(HTTP_STATUS[err.code]).send(body);
    }
    if (typeof err === 'object' && err !== null && 'validation' in err) {
      const body: ErrorBody = {
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', requestId: req.id, retryable: false },
      };
      return reply.status(400).send(body);
    }
    req.log.error({ err }, 'unhandled error');
    const body: ErrorBody = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: req.id,
        retryable: isRetryable('INTERNAL_ERROR'),
      },
    };
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((req, reply) => {
    const body: ErrorBody = { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: req.id } };
    return reply.status(404).send(body);
  });

  app.get('/health', () => ({ status: 'ok' }));
  app.get('/config', () => toClientSafeConfig(config));

  return app;
}
