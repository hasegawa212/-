import { describe, expect, it } from 'vitest';
import { checkCallingWindow, DEFAULT_CALLING_POLICY, parseContactWindow, type CallingPolicy } from './callingWindow.js';

// 2026-10-05 is a Monday. JST = UTC+9.
const jst = (isoLocal: string) => new Date(`${isoLocal}+09:00`);

describe('checkCallingWindow — organization policy (default 09:00–20:00 JST, Mon–Sat)', () => {
  const policy = DEFAULT_CALLING_POLICY;

  it.each([
    ['2026-10-05T09:00:00', true],
    ['2026-10-05T19:59:59', true],
    ['2026-10-05T08:59:59', false],
    ['2026-10-05T20:00:00', false],
    ['2026-10-05T23:30:00', false],
  ])('%s JST allowed=%s', (t, allowed) => {
    expect(checkCallingWindow({ policy, now: jst(t) }).allowed).toBe(allowed);
  });

  it('evaluates in the policy timezone, not the server timezone (UTC 01:00 = JST 10:00)', () => {
    expect(checkCallingWindow({ policy, now: new Date('2026-10-05T01:00:00Z') })).toEqual({ allowed: true });
  });

  it('blocks Sunday by default', () => {
    expect(checkCallingWindow({ policy, now: jst('2026-10-04T12:00:00') })).toEqual({
      allowed: false,
      reason: 'DAY_NOT_ALLOWED',
    });
  });

  it('blocks listed holidays (local date)', () => {
    const p: CallingPolicy = { ...policy, blockedDates: ['2026-10-12'] }; // スポーツの日
    expect(checkCallingWindow({ policy: p, now: jst('2026-10-12T12:00:00') })).toEqual({
      allowed: false,
      reason: 'HOLIDAY',
    });
  });

  it('reports OUTSIDE_HOURS with a reason', () => {
    expect(checkCallingWindow({ policy, now: jst('2026-10-05T07:00:00') })).toEqual({
      allowed: false,
      reason: 'OUTSIDE_HOURS',
    });
  });

  it('a policy that is not a valid window blocks everything (fail closed)', () => {
    const broken: CallingPolicy = { ...policy, startMinute: 20 * 60, endMinute: 9 * 60 };
    expect(checkCallingWindow({ policy: broken, now: jst('2026-10-05T12:00:00') })).toEqual({
      allowed: false,
      reason: 'POLICY_INVALID',
    });
  });

  it('an unknown timezone blocks (fail closed)', () => {
    const broken: CallingPolicy = { ...policy, timezone: 'Mars/Olympus' };
    expect(checkCallingWindow({ policy: broken, now: jst('2026-10-05T12:00:00') })).toEqual({
      allowed: false,
      reason: 'POLICY_INVALID',
    });
  });
});

describe('checkCallingWindow — contact preference narrows, never widens', () => {
  const policy = DEFAULT_CALLING_POLICY;

  it('inside both windows → allowed', () => {
    const contactWindow = { startMinute: 18 * 60, endMinute: 24 * 60 };
    expect(checkCallingWindow({ policy, contactWindow, now: jst('2026-10-05T18:30:00') })).toEqual({ allowed: true });
  });

  it('inside policy but outside the contact preference → blocked', () => {
    const contactWindow = { startMinute: 18 * 60, endMinute: 24 * 60 };
    expect(checkCallingWindow({ policy, contactWindow, now: jst('2026-10-05T12:00:00') })).toEqual({
      allowed: false,
      reason: 'OUTSIDE_CONTACT_PREFERENCE',
    });
  });

  it('contact preference cannot extend past the policy (「18時以降」 at 21:00 is still blocked)', () => {
    const contactWindow = { startMinute: 18 * 60, endMinute: 24 * 60 };
    expect(checkCallingWindow({ policy, contactWindow, now: jst('2026-10-05T21:00:00') })).toEqual({
      allowed: false,
      reason: 'OUTSIDE_HOURS',
    });
  });
});

describe('parseContactWindow (テレアポ管理シート「電話可能な時間帯」)', () => {
  it.each([
    ['9:00~12:00', { startMinute: 540, endMinute: 720 }],
    ['12:00~15:00', { startMinute: 720, endMinute: 900 }],
    ['15:00〜18:00', { startMinute: 900, endMinute: 1080 }],
    ['18時以降', { startMinute: 1080, endMinute: 1440 }],
    ['１８時以降', { startMinute: 1080, endMinute: 1440 }],
    ['９：００～１２：００', { startMinute: 540, endMinute: 720 }],
    ['12時まで', { startMinute: 0, endMinute: 720 }],
  ])('%s', (raw, expected) => {
    expect(parseContactWindow(raw)).toEqual({ ok: true, value: expected });
  });

  it.each(['', 'いつでも', '25:00~26:00', '12:00~09:00', '夕方'])('%j is not a window', (raw) => {
    expect(parseContactWindow(raw).ok).toBe(false);
  });
});
