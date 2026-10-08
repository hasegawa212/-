import { describe, expect, it } from 'vitest';
import { normalizeJpPhone } from './phoneNumber.js';

describe('normalizeJpPhone — accepted', () => {
  it.each([
    ['090-1234-5678', '+819012345678', 'MOBILE'],
    ['08012345678', '+818012345678', 'MOBILE'],
    ['070 1234 5678', '+817012345678', 'MOBILE'],
    ['０９０－１２３４－５６７８', '+819012345678', 'MOBILE'],
    ['+81 90-1234-5678', '+819012345678', 'MOBILE'],
    ['+81(0)90-1234-5678', '+819012345678', 'MOBILE'],
    ['＋８１９０１２３４５６７８', '+819012345678', 'MOBILE'],
    ['03-1234-5678', '+81312345678', 'LANDLINE'],
    ['(06) 1234-5678', '+81612345678', 'LANDLINE'],
    ['072.123.4567', '+81721234567', 'LANDLINE'],
    ['050-1234-5678', '+815012345678', 'IP'],
    ['（０３）１２３４－５６７８', '+81312345678', 'LANDLINE'],
    ['090\u30001234\u30005678', '+819012345678', 'MOBILE'],
  ])('%s → %s', (raw, e164, kind) => {
    expect(normalizeJpPhone(raw)).toEqual({ ok: true, value: { e164, kind } });
  });

  it('is idempotent on its own output', () => {
    const first = normalizeJpPhone('090-1234-5678');
    if (!first.ok) throw new Error('precondition');
    expect(normalizeJpPhone(first.value.e164)).toEqual(first);
  });

  it('different notations of the same number normalize to the same key (dedupe / DNC match)', () => {
    const a = normalizeJpPhone('090-1234-5678');
    const b = normalizeJpPhone('+81 (0)90 1234 5678');
    const c = normalizeJpPhone('０９０１２３４５６７８');
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });
});

describe('normalizeJpPhone — rejected', () => {
  it.each([
    ['', 'EMPTY'],
    ['   ', 'EMPTY'],
    ['090-1234-567', 'INVALID_LENGTH'],
    ['090-1234-56789', 'INVALID_LENGTH'],
    ['03-1234-56789', 'INVALID_LENGTH'],
    ['110', 'INVALID_LENGTH'],
    ['abc-defg', 'INVALID_CHARACTERS'],
    ['090-1234-5678 ext 12', 'INVALID_CHARACTERS'],
    ['+1 415 555 0100', 'UNSUPPORTED_COUNTRY'],
    ['001-1-415-555-0100', 'UNSUPPORTED_COUNTRY'],
    ['9012345678', 'MISSING_TRUNK_PREFIX'],
    ['0120-123-456', 'NON_DIALABLE_SERVICE'],
    ['0800-123-4567', 'NON_DIALABLE_SERVICE'],
    ['0570-123-456', 'NON_DIALABLE_SERVICE'],
    ['0990-123-456', 'NON_DIALABLE_SERVICE'],
    ['0180-123-456', 'NON_DIALABLE_SERVICE'],
    ['020-1234-5678', 'NON_DIALABLE_SERVICE'],
    ['+81 120 123 456', 'NON_DIALABLE_SERVICE'],
  ])('%j → %s', (raw, reason) => {
    expect(normalizeJpPhone(raw)).toEqual({ ok: false, reason });
  });

  it('rejects non-string input defensively', () => {
    expect(normalizeJpPhone(undefined as unknown as string)).toEqual({ ok: false, reason: 'EMPTY' });
  });
});
