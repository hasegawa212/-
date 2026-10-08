import { checkCallingWindow, parseContactWindow, type CallingPolicy } from '../compliance/callingWindow.js';
import { normalizeJpPhone, type NormalizedPhone } from '../contact/phoneNumber.js';
import type { ErrorCode } from '../errors.js';
import { evaluateSuppression, type SuppressionLookup } from '../suppression/suppression.js';

/**
 * Pre-dial guard pipeline. Pure: every fact it needs (lookups, counters, the idempotency
 * reservation status) is gathered by the application layer and passed in. The pipeline
 * runs on the server for every outbound attempt — UI checks are a convenience only.
 *
 * IDEMPOTENCY runs right after TENANT (see ADR-0008): a replay must return the original
 * call even when later guards would now fail, and a replay never dials.
 */
export const GUARD_ORDER = [
  'AUTHENTICATION',
  'AUTHORIZATION',
  'TENANT',
  'IDEMPOTENCY',
  'KILL_SWITCH',
  'CONTACT',
  'PHONE',
  'SUPPRESSION',
  'CONSENT',
  'CALLING_WINDOW',
  'CAMPAIGN_LIMITS',
  'BUDGET',
  'CONCURRENCY',
  'TELEPHONY',
] as const;
export type GuardName = (typeof GUARD_ORDER)[number];

export const CALL_CREATE_PERMISSION = 'call:create';

export type Actor = {
  readonly kind: 'USER' | 'AI_AGENT' | 'SYSTEM';
  readonly userId: string;
  readonly organizationId: string;
  readonly permissions: readonly string[];
};

export type OutboundContext = {
  readonly now: Date;
  readonly requestOrganizationId: string;
  readonly actor: Actor | null;
  readonly killSwitchEngaged: boolean;
  readonly contact: {
    readonly id: string;
    readonly organizationId: string;
    readonly status: 'ACTIVE' | 'ARCHIVED';
    readonly phoneRaw: string;
    readonly contactWindowRaw: string | null;
    readonly consent: 'UNKNOWN' | 'GRANTED' | 'WITHDRAWN';
  };
  readonly campaign: {
    readonly id: string;
    readonly organizationId: string;
    readonly status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    readonly dailyCallLimit: number;
    readonly callsToday: number;
    readonly maxAttemptsPerContact: number;
    readonly attemptsForContact: number;
  };
  readonly suppression: SuppressionLookup;
  readonly callingPolicy: CallingPolicy;
  /** remainingYen null = budget state unknown → fail closed. */
  readonly budget: { readonly remainingYen: number | null; readonly estimatedCostYen: number };
  readonly concurrency: {
    readonly activeCalls: number;
    readonly limit: number;
    readonly contactHasActiveCall: boolean;
  };
  readonly idempotency:
    | { readonly status: 'NEW' }
    | { readonly status: 'REPLAY'; readonly callId: string }
    | { readonly status: 'IN_FLIGHT' }
    | { readonly status: 'PAYLOAD_MISMATCH' };
  /** false when the provider circuit breaker is open. */
  readonly telephonyAvailable: boolean;
};

export type GuardResult =
  | { readonly kind: 'ALLOW'; readonly phone: NormalizedPhone; readonly trace: readonly GuardName[] }
  | { readonly kind: 'REPLAY'; readonly callId: string; readonly trace: readonly GuardName[] }
  | {
      readonly kind: 'DENY' | 'HUMAN_REVIEW';
      readonly guard: GuardName;
      readonly code: ErrorCode;
      readonly reason: string;
      readonly trace: readonly GuardName[];
    };

type Step =
  | { readonly kind: 'PASS' }
  | { readonly kind: 'REPLAY'; readonly callId: string }
  | { readonly kind: 'DENY' | 'HUMAN_REVIEW'; readonly code: ErrorCode; readonly reason: string };

const PASS: Step = { kind: 'PASS' };
const deny = (code: ErrorCode, reason: string): Step => ({ kind: 'DENY', code, reason });

type State = { phone: NormalizedPhone | null };

const GUARDS: Readonly<Record<GuardName, (c: OutboundContext, s: State) => Step>> = {
  AUTHENTICATION: (c) => (c.actor ? PASS : deny('UNAUTHORIZED', 'NO_ACTOR')),

  AUTHORIZATION: (c) => {
    // Outbound dialing is a human/system decision. An AI agent can never start a call.
    if (c.actor?.kind === 'AI_AGENT') return deny('FORBIDDEN', 'AI_AGENT_CANNOT_DIAL');
    return c.actor?.permissions.includes(CALL_CREATE_PERMISSION) ? PASS : deny('FORBIDDEN', 'MISSING_PERMISSION');
  },

  // Cross-tenant access answers NOT_FOUND so existence in another tenant is not disclosed.
  TENANT: (c) => {
    const org = c.requestOrganizationId;
    const same =
      c.actor?.organizationId === org && c.contact.organizationId === org && c.campaign.organizationId === org;
    return same ? PASS : deny('NOT_FOUND', 'TENANT_MISMATCH');
  },

  IDEMPOTENCY: (c) => {
    switch (c.idempotency.status) {
      case 'NEW':
        return PASS;
      case 'REPLAY':
        return { kind: 'REPLAY', callId: c.idempotency.callId };
      case 'IN_FLIGHT':
        return deny('CONFLICT', 'IDEMPOTENCY_IN_FLIGHT');
      case 'PAYLOAD_MISMATCH':
        return deny('CONFLICT', 'IDEMPOTENCY_KEY_REUSED');
    }
  },

  KILL_SWITCH: (c) => (c.killSwitchEngaged ? deny('OUTBOUND_HALTED', 'KILL_SWITCH_ENGAGED') : PASS),

  CONTACT: (c) => (c.contact.status === 'ACTIVE' ? PASS : deny('CONFLICT', `CONTACT_${c.contact.status}`)),

  PHONE: (c, s) => {
    const r = normalizeJpPhone(c.contact.phoneRaw);
    if (!r.ok) return deny('VALIDATION_ERROR', `PHONE_${r.reason}`);
    s.phone = r.value;
    return PASS;
  },

  SUPPRESSION: (c, s) => {
    if (!s.phone) return deny('CONTACT_SUPPRESSED', 'SUPPRESSION_DATA_INVALID');
    const d = evaluateSuppression({
      lookup: c.suppression,
      phoneE164: s.phone.e164,
      campaignId: c.campaign.id,
      now: c.now,
    });
    if (d.decision === 'ALLOW') return PASS;
    if (d.decision === 'HUMAN_REVIEW') return { kind: 'HUMAN_REVIEW', code: 'CONTACT_SUPPRESSED', reason: d.reason };
    return deny('CONTACT_SUPPRESSED', d.reason);
  },

  CONSENT: (c) => (c.contact.consent === 'WITHDRAWN' ? deny('CONTACT_SUPPRESSED', 'CONSENT_WITHDRAWN') : PASS),

  CALLING_WINDOW: (c) => {
    const pref = c.contact.contactWindowRaw ? parseContactWindow(c.contact.contactWindowRaw) : null;
    const d = checkCallingWindow({
      policy: c.callingPolicy,
      now: c.now,
      contactWindow: pref?.ok ? pref.value : undefined,
    });
    return d.allowed ? PASS : deny('CALLING_WINDOW_BLOCKED', d.reason);
  },

  CAMPAIGN_LIMITS: (c) => {
    const k = c.campaign;
    if (k.status !== 'ACTIVE') return deny('CONFLICT', `CAMPAIGN_${k.status}`);
    if (k.callsToday >= k.dailyCallLimit) return deny('CAMPAIGN_LIMIT_EXCEEDED', 'DAILY_LIMIT');
    if (k.attemptsForContact >= k.maxAttemptsPerContact) return deny('CAMPAIGN_LIMIT_EXCEEDED', 'MAX_ATTEMPTS');
    return PASS;
  },

  BUDGET: (c) => {
    const { remainingYen, estimatedCostYen } = c.budget;
    if (remainingYen === null) return deny('BUDGET_EXCEEDED', 'BUDGET_UNKNOWN');
    return remainingYen >= estimatedCostYen ? PASS : deny('BUDGET_EXCEEDED', 'INSUFFICIENT_BUDGET');
  },

  CONCURRENCY: (c) => {
    if (c.concurrency.contactHasActiveCall) return deny('CONFLICT', 'CONTACT_ALREADY_ON_CALL');
    return c.concurrency.activeCalls < c.concurrency.limit
      ? PASS
      : deny('CONCURRENCY_LIMIT_EXCEEDED', 'ORG_CONCURRENCY_FULL');
  },

  TELEPHONY: (c) => (c.telephonyAvailable ? PASS : deny('PROVIDER_UNAVAILABLE', 'CIRCUIT_OPEN')),
};

export function evaluateOutboundGuards(ctx: OutboundContext): GuardResult {
  const trace: GuardName[] = [];
  const state: State = { phone: null };

  for (const name of GUARD_ORDER) {
    let step: Step;
    try {
      step = GUARDS[name](ctx, state);
    } catch {
      // A guard that cannot decide must not let the call through.
      return { kind: 'DENY', guard: name, code: 'INTERNAL_ERROR', reason: 'GUARD_ERROR', trace };
    }
    if (step.kind === 'REPLAY') return { kind: 'REPLAY', callId: step.callId, trace };
    if (step.kind !== 'PASS') return { kind: step.kind, guard: name, code: step.code, reason: step.reason, trace };
    trace.push(name);
  }

  // PHONE always runs before this point; the check keeps the type honest and fails closed.
  return state.phone
    ? { kind: 'ALLOW', phone: state.phone, trace }
    : { kind: 'DENY', guard: 'PHONE', code: 'INTERNAL_ERROR', reason: 'GUARD_ERROR', trace };
}
