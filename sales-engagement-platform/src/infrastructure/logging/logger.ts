import { pino, type Logger, type LoggerOptions } from 'pino';
import { redact, redactText } from './redact.js';

/**
 * Logger options with PII redaction applied to every structured field and every message string.
 * Shared by the Fastify instance and background workers so no sink can bypass redaction.
 */
export function loggerOptions(level: string): LoggerOptions {
  return {
    level,
    formatters: {
      log: (obj) => redact(obj) as Record<string, unknown>,
    },
    hooks: {
      logMethod(args, method) {
        method.apply(this, args.map((a) => (typeof a === 'string' ? redactText(a) : a)) as Parameters<typeof method>);
      },
    },
  };
}

export function createLogger(level: string): Logger {
  return pino(loggerOptions(level));
}
