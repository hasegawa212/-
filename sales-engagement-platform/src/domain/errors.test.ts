import { describe, expect, it } from 'vitest';
import { DomainError, ERROR_CODES, isRetryable, type ErrorCode } from './errors.js';

describe('error taxonomy', () => {
  it('defines the minimum required codes', () => {
    const required: ErrorCode[] = [
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'CONTACT_SUPPRESSED',
      'CALLING_WINDOW_BLOCKED',
      'BUDGET_EXCEEDED',
      'PROVIDER_UNAVAILABLE',
      'INVALID_STATE_TRANSITION',
    ];
    for (const code of required) expect(ERROR_CODES).toContain(code);
  });

  it.each<ErrorCode>(['PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT'])('%s is retryable', (code) => {
    expect(isRetryable(code)).toBe(true);
  });

  it.each<ErrorCode>([
    'CONTACT_SUPPRESSED',
    'INVALID_STATE_TRANSITION',
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'CALLING_WINDOW_BLOCKED',
    'BUDGET_EXCEEDED',
    'OUTBOUND_HALTED',
  ])('%s is never retryable', (code) => {
    expect(isRetryable(code)).toBe(false);
  });

  it('DomainError carries code, retryability and safe details', () => {
    const err = new DomainError('CONTACT_SUPPRESSED', 'contact is on the DNC list', { reason: 'DO_NOT_CALL' });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('CONTACT_SUPPRESSED');
    expect(err.retryable).toBe(false);
    expect(err.details).toEqual({ reason: 'DO_NOT_CALL' });
    expect(err.name).toBe('DomainError');
  });

  it('DomainError details are frozen so callers cannot mutate a thrown decision', () => {
    const err = new DomainError('CONFLICT', 'x', { a: 1 });
    expect(Object.isFrozen(err.details)).toBe(true);
  });
});
