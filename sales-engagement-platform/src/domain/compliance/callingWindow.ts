import { err, ok, type Result } from '../shared/result.js';

/** Minutes since local midnight, [startMinute, endMinute). */
export type MinuteWindow = { readonly startMinute: number; readonly endMinute: number };

export type CallingPolicy = MinuteWindow & {
  readonly timezone: string;
  /** 0 = Sunday … 6 = Saturday (local). */
  readonly allowedWeekdays: readonly number[];
  /** Local dates (YYYY-MM-DD) on which no call may be placed, e.g. 祝日 / 年末年始. */
  readonly blockedDates: readonly string[];
};

/**
 * 宅建業法施行規則16条の11 prohibits calls at times that cause annoyance (迷惑を覚えさせるような時間).
 * The statute names no hours; 09:00–20:00 Mon–Sat is a conservative default. 〔要法務確認〕
 */
export const DEFAULT_CALLING_POLICY: CallingPolicy = Object.freeze({
  timezone: 'Asia/Tokyo',
  startMinute: 9 * 60,
  endMinute: 20 * 60,
  allowedWeekdays: Object.freeze([1, 2, 3, 4, 5, 6]),
  blockedDates: Object.freeze([]),
});

export type CallingWindowDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason:
        'OUTSIDE_HOURS' | 'DAY_NOT_ALLOWED' | 'HOLIDAY' | 'OUTSIDE_CONTACT_PREFERENCE' | 'POLICY_INVALID';
    };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type LocalParts = { date: string; weekday: number; minute: number };

function localParts(now: Date, timezone: string): LocalParts | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now);
  } catch {
    return null;
  }
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS.indexOf(get('weekday')),
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function isValidWindow(w: MinuteWindow): boolean {
  return (
    Number.isInteger(w.startMinute) &&
    Number.isInteger(w.endMinute) &&
    w.startMinute >= 0 &&
    w.endMinute <= 24 * 60 &&
    w.startMinute < w.endMinute
  );
}

const inside = (w: MinuteWindow, minute: number) => minute >= w.startMinute && minute < w.endMinute;

export function checkCallingWindow(input: {
  policy: CallingPolicy;
  now: Date;
  contactWindow?: MinuteWindow | undefined;
}): CallingWindowDecision {
  const { policy, now, contactWindow } = input;
  if (!isValidWindow(policy)) return { allowed: false, reason: 'POLICY_INVALID' };
  const local = localParts(now, policy.timezone);
  if (!local) return { allowed: false, reason: 'POLICY_INVALID' };

  if (policy.blockedDates.includes(local.date)) return { allowed: false, reason: 'HOLIDAY' };
  if (!policy.allowedWeekdays.includes(local.weekday)) return { allowed: false, reason: 'DAY_NOT_ALLOWED' };
  if (!inside(policy, local.minute)) return { allowed: false, reason: 'OUTSIDE_HOURS' };
  if (contactWindow && !inside(contactWindow, local.minute)) {
    return { allowed: false, reason: 'OUTSIDE_CONTACT_PREFERENCE' };
  }
  return { allowed: true };
}

const toHalfWidthDigits = (s: string) =>
  s.replace(/[０-９：]/g, (c) => (c === '：' ? ':' : String.fromCharCode(c.charCodeAt(0) - 0xfee0)));

/**
 * Parses the free-text 「電話可能な時間帯」 column. Unparseable text yields an error so the
 * caller can surface it; it never widens the organization policy either way.
 */
export function parseContactWindow(raw: string): Result<MinuteWindow, 'UNPARSEABLE'> {
  const s = toHalfWidthDigits(raw.trim());
  let w: MinuteWindow | null = null;

  const range = /^(\d{1,2}):(\d{2})\s*[~〜～-]\s*(\d{1,2}):(\d{2})$/.exec(s);
  const after = /^(\d{1,2})時以降$/.exec(s);
  const until = /^(\d{1,2})時まで$/.exec(s);
  if (range) {
    w = { startMinute: Number(range[1]) * 60 + Number(range[2]), endMinute: Number(range[3]) * 60 + Number(range[4]) };
  } else if (after) {
    w = { startMinute: Number(after[1]) * 60, endMinute: 24 * 60 };
  } else if (until) {
    w = { startMinute: 0, endMinute: Number(until[1]) * 60 };
  }
  return w && isValidWindow(w) ? ok(w) : err('UNPARSEABLE');
}
