import { err, ok, type Result } from '../shared/result.js';

export type PhoneKind = 'MOBILE' | 'LANDLINE' | 'IP';
export type NormalizedPhone = { readonly e164: string; readonly kind: PhoneKind };
export type PhoneRejection =
  | 'EMPTY'
  | 'INVALID_CHARACTERS'
  | 'INVALID_LENGTH'
  | 'UNSUPPORTED_COUNTRY'
  | 'MISSING_TRUNK_PREFIX'
  | 'NON_DIALABLE_SERVICE';

// Separators people actually type: spaces, ASCII/full-width/Unicode hyphens, 長音, dots, parentheses.
const SEPARATORS = /[\s\-‐‑‒–—―ー.()]/g;

// Free-dial / navi-dial / premium / pager-M2M: never targets of outbound sales calls.
const NON_DIALABLE_PREFIXES = ['0120', '0800', '0570', '0990', '0180', '020'] as const;

function toHalfWidth(s: string): string {
  return s.replace(/[０-９＋－（）\u3000]/g, (c) => {
    if (c === '＋') return '+';
    if (c === '－') return '-';
    if (c === '（') return '(';
    if (c === '）') return ')';
    if (c === '\u3000') return ' ';
    return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
  });
}

/**
 * Normalizes a Japanese phone number to E.164. The E.164 string is the identity used
 * for de-duplication and suppression (DNC) matching, so every notation of one number
 * must map to exactly one key.
 */
export function normalizeJpPhone(raw: string): Result<NormalizedPhone, PhoneRejection> {
  if (typeof raw !== 'string' || raw.trim() === '') return err('EMPTY');

  const compact = toHalfWidth(raw.trim()).replace(SEPARATORS, '');
  if (!/^\+?\d+$/.test(compact)) return err('INVALID_CHARACTERS');

  let national: string;
  if (compact.startsWith('+')) {
    if (!compact.startsWith('+81')) return err('UNSUPPORTED_COUNTRY');
    const rest = compact.slice(3);
    // "+81(0)90…" carries the domestic trunk 0 in parentheses — drop it.
    national = `0${rest.startsWith('0') ? rest.slice(1) : rest}`;
  } else if (compact.startsWith('0')) {
    national = compact;
  } else {
    return err(compact.length === 9 || compact.length === 10 ? 'MISSING_TRUNK_PREFIX' : 'INVALID_LENGTH');
  }

  if (national.startsWith('00')) return err('UNSUPPORTED_COUNTRY');
  if (NON_DIALABLE_PREFIXES.some((p) => national.startsWith(p))) return err('NON_DIALABLE_SERVICE');

  const kind: PhoneKind = /^0[6789]0/.test(national) ? 'MOBILE' : national.startsWith('050') ? 'IP' : 'LANDLINE';
  const expectedLength = kind === 'LANDLINE' ? 10 : 11;
  if (national.length !== expectedLength) return err('INVALID_LENGTH');

  return ok({ e164: `+81${national.slice(1)}`, kind });
}
