/**
 * Error taxonomy shared by every layer. Codes are stable API: clients branch on them,
 * so never rename one — add a new code instead.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'CONTACT_SUPPRESSED',
  'CALLING_WINDOW_BLOCKED',
  'CAMPAIGN_LIMIT_EXCEEDED',
  'BUDGET_EXCEEDED',
  'CONCURRENCY_LIMIT_EXCEEDED',
  'OUTBOUND_HALTED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_TIMEOUT',
  'INVALID_STATE_TRANSITION',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Only transient infrastructure failures may be retried automatically.
 * Everything that encodes a policy decision (suppression, window, budget, kill switch,
 * authz, illegal transition) must NOT be retried — retrying would be an attempt to bypass it.
 */
const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>(['PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT']);

export function isRetryable(code: ErrorCode): boolean {
  return RETRYABLE.has(code);
}

export type ErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

export class DomainError extends Error {
  override readonly name = 'DomainError';
  readonly retryable: boolean;
  readonly details: ErrorDetails;

  constructor(
    readonly code: ErrorCode,
    message: string,
    details: Record<string, string | number | boolean | null> = {},
  ) {
    super(message);
    this.retryable = isRetryable(code);
    this.details = Object.freeze({ ...details });
  }
}
