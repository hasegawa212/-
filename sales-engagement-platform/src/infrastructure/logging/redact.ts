/**
 * PII / secret redaction for structured logs.
 * Rule: a full phone number, a transcript, an e-mail address or a credential must never reach a log sink.
 */

const REDACTED = '[redacted]';

// Keys whose values are dropped entirely.
const SECRET_KEY =
  /authorization|cookie|password|passwd|secret|token|api[-_]?key|transcript|utterance|recording|email|e_mail/i;
// Keys whose values are phone numbers → masked to the last 4 digits.
const PHONE_KEY = /phone|msisdn|mobile/i;
const TEL_KEY = /^tel(?:$|_|[A-Z])/;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Matched against a length-preserving ASCII fold of the text (see foldWidth), so indices line up.
const PHONE = /(?<![\d+])(?:\+81[\s-]?\(?0?\)?|\(?0)\d{1,4}\)?[\s\-‐–ー]?\d{1,4}[\s\-‐–ー]?\d{3,4}(?!\d)/g;

/** Full-width digits / plus / hyphen → ASCII, one UTF-16 unit for one, so string indices are preserved. */
function foldWidth(s: string): string {
  return s.replace(/[０-９＋－（）]/g, (c) => {
    if (c === '＋') return '+';
    if (c === '－') return '-';
    if (c === '（') return '(';
    if (c === '）') return ')';
    return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
  });
}

function digitsOf(s: string): string {
  return foldWidth(s).replace(/\D/g, '');
}

export function maskPhone(value: string): string {
  const d = digitsOf(value);
  return d.length >= 8 ? `***${d.slice(-4)}` : '***';
}

function looksLikeJpPhone(match: string): boolean {
  const d = digitsOf(match);
  if (match.trimStart().startsWith('+')) return d.startsWith('81') && (d.length === 11 || d.length === 12);
  return d.length === 10 || d.length === 11;
}

export function redactText(text: string): string {
  const folded = foldWidth(text);
  let out = '';
  let cursor = 0;
  for (const m of folded.matchAll(PHONE)) {
    if (!looksLikeJpPhone(m[0])) continue;
    out += text.slice(cursor, m.index) + maskPhone(m[0]);
    cursor = m.index + m[0].length;
  }
  out += text.slice(cursor);
  return out.replace(EMAIL, '[email]');
}

export function redact(value: unknown): unknown {
  return walk(value, new WeakSet());
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => walk(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEY.test(k)) out[k] = REDACTED;
    else if ((PHONE_KEY.test(k) || TEL_KEY.test(k)) && typeof v === 'string') out[k] = maskPhone(v);
    else out[k] = walk(v, seen);
  }
  return out;
}
