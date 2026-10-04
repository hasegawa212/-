import type { ErrorCode } from '../../domain/errors.js';

export const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  CONTACT_SUPPRESSED: 409,
  CALLING_WINDOW_BLOCKED: 409,
  CAMPAIGN_LIMIT_EXCEEDED: 429,
  BUDGET_EXCEEDED: 402,
  CONCURRENCY_LIMIT_EXCEEDED: 429,
  OUTBOUND_HALTED: 503,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_TIMEOUT: 504,
  INVALID_STATE_TRANSITION: 409,
  INTERNAL_ERROR: 500,
};

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    retryable?: boolean;
    details?: Readonly<Record<string, unknown>>;
  };
};
