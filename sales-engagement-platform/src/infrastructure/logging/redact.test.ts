import { describe, expect, it } from 'vitest';
import { maskPhone, redact, redactText } from './redact.js';

describe('maskPhone', () => {
  it('keeps only the last 4 digits', () => {
    expect(maskPhone('+819012345678')).toBe('***5678');
    expect(maskPhone('090-1234-5678')).toBe('***5678');
  });
  it('masks short/odd input completely', () => {
    expect(maskPhone('123')).toBe('***');
  });
});

describe('redactText', () => {
  it.each([
    ['call 090-1234-5678 now', 'call ***5678 now'],
    ['tel:09012345678', 'tel:***5678'],
    ['E164 +81 90 1234 5678.', 'E164 ***5678.'],
    ['landline 03-1234-5678', 'landline ***5678'],
    ['fullwidth ０９０－１２３４－５６７８', 'fullwidth ***5678'],
    ['mail taro@example.co.jp', 'mail [email]'],
    // Regression: a preceding row number must not hide the phone number from the matcher.
    ['No.3 090-1234-5678', 'No.3 ***5678'],
    ['(03) 1234-5678', '***5678'],
    ['（０３）１２３４－５６７８', '***5678'],
    ['+81 3 1234 5678', '***5678'],
  ])('%s', (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });

  it('leaves ordinary numbers (ids, amounts, timestamps) alone', () => {
    expect(redactText('order 12345 total 980 at 2026-10-04T10:00:00Z')).toBe(
      'order 12345 total 980 at 2026-10-04T10:00:00Z',
    );
  });
});

describe('redact (structured)', () => {
  it('fully removes secrets and transcripts by key, regardless of nesting or case', () => {
    const out = redact({
      callId: 'c1',
      Authorization: 'Bearer abc',
      nested: { apiKey: 'k', password: 'p', transcript: '電話しないでください 090-1111-2222', token: 't' },
    });
    expect(out).toEqual({
      callId: 'c1',
      Authorization: '[redacted]',
      nested: { apiKey: '[redacted]', password: '[redacted]', transcript: '[redacted]', token: '[redacted]' },
    });
  });

  it('masks phone-like keys and phone numbers inside free text', () => {
    expect(redact({ phone: '090-1234-5678', phoneNormalized: '+819012345678', note: 'call 0312345678' })).toEqual({
      phone: '***5678',
      phoneNormalized: '***5678',
      note: 'call ***5678',
    });
  });

  it('handles arrays and does not mutate input', () => {
    const input = { items: [{ email: 'a@b.jp' }, 'x 090-1234-5678'] };
    const out = redact(input);
    expect(out).toEqual({ items: [{ email: '[redacted]' }, 'x ***5678'] });
    expect(input.items[1]).toBe('x 090-1234-5678');
  });

  it('survives cycles and deep nesting without throwing', () => {
    const a: Record<string, unknown> = { id: 1 };
    a.self = a;
    expect(redact(a)).toEqual({ id: 1, self: '[circular]' });
  });

  it('passes through primitives', () => {
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
    expect(redact(true)).toBe(true);
  });
});
