import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { loggerOptions } from './logger.js';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { log: pino(loggerOptions('info'), stream), lines };
}

describe('logger PII redaction (end-to-end through pino)', () => {
  it('redacts structured fields', () => {
    const { log, lines } = capture();
    log.info({ callId: 'c1', phone: '090-1234-5678', token: 'tok_live_abc' }, 'dial');
    const out = lines.join('');
    expect(out).toContain('"callId":"c1"');
    expect(out).toContain('***5678');
    expect(out).not.toContain('090-1234-5678');
    expect(out).not.toContain('tok_live_abc');
  });

  it('redacts phone numbers and e-mails inside the message string', () => {
    const { log, lines } = capture();
    log.warn('retrying 09012345678 for taro@example.jp');
    const out = lines.join('');
    expect(out).not.toContain('09012345678');
    expect(out).not.toContain('taro@example.jp');
  });
});
