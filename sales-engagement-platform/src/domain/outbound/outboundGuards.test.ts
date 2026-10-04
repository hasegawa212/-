import { describe, expect, it } from 'vitest';
import { DEFAULT_CALLING_POLICY } from '../compliance/callingWindow.js';
import { GUARD_ORDER, evaluateOutboundGuards, type OutboundContext } from './outboundGuards.js';

const MONDAY_NOON_JST = new Date('2026-10-05T03:00:00Z');

const ACTOR = { kind: 'USER', userId: 'u-1', organizationId: 'org-1', permissions: ['call:create'] } as const;

function ctx(over: Partial<OutboundContext> = {}): OutboundContext {
  return {
    now: MONDAY_NOON_JST,
    requestOrganizationId: 'org-1',
    actor: ACTOR,
    killSwitchEngaged: false,
    contact: {
      id: 'ct-1',
      organizationId: 'org-1',
      status: 'ACTIVE',
      phoneRaw: '090-1234-5678',
      contactWindowRaw: null,
      consent: 'UNKNOWN',
    },
    campaign: {
      id: 'camp-A',
      organizationId: 'org-1',
      status: 'ACTIVE',
      dailyCallLimit: 100,
      callsToday: 10,
      maxAttemptsPerContact: 3,
      attemptsForContact: 0,
    },
    suppression: { status: 'FOUND', entries: [] },
    callingPolicy: DEFAULT_CALLING_POLICY,
    budget: { remainingYen: 10_000, estimatedCostYen: 50 },
    concurrency: { activeCalls: 0, limit: 5, contactHasActiveCall: false },
    idempotency: { status: 'NEW' },
    telephonyAvailable: true,
    ...over,
  };
}

const dnc = {
  status: 'FOUND',
  entries: [{ phoneE164: '+819012345678', reason: 'DO_NOT_CALL', campaignId: null, expiresAt: null }],
} as const;

describe('outbound guard pipeline — happy path', () => {
  it('allows a fully valid request and returns the normalized phone + full trace', () => {
    const r = evaluateOutboundGuards(ctx());
    expect(r).toEqual({
      kind: 'ALLOW',
      phone: { e164: '+819012345678', kind: 'MOBILE' },
      trace: GUARD_ORDER,
    });
  });

  it('guard order follows the spec (auth → … → telephony)', () => {
    expect(GUARD_ORDER).toEqual([
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
    ]);
  });
});

describe('outbound guard pipeline — DNC (critical)', () => {
  it('DNC contact is denied with CONTACT_SUPPRESSED', () => {
    expect(evaluateOutboundGuards(ctx({ suppression: dnc }))).toMatchObject({
      kind: 'DENY',
      guard: 'SUPPRESSION',
      code: 'CONTACT_SUPPRESSED',
      reason: 'DO_NOT_CALL',
    });
  });

  it('DNC matches regardless of how the contact phone was typed', () => {
    const r = evaluateOutboundGuards(
      ctx({ suppression: dnc, contact: { ...ctx().contact, phoneRaw: '+81 (0)90 1234 5678' } }),
    );
    expect(r.kind).toBe('DENY');
  });

  it('no actor permission set can bypass DNC (admin, wildcard, every permission)', () => {
    for (const permissions of [['call:create', 'admin'], ['*'], ['call:create', 'suppression:override', 'admin']]) {
      const actor = { kind: 'USER' as const, userId: 'boss', organizationId: 'org-1', permissions };
      expect(evaluateOutboundGuards(ctx({ actor, suppression: dnc })).kind).toBe('DENY');
    }
  });

  it('AI agent can never initiate an outbound call, even with permissions', () => {
    const actor = {
      kind: 'AI_AGENT' as const,
      userId: 'agent-1',
      organizationId: 'org-1',
      permissions: ['call:create'],
    };
    expect(evaluateOutboundGuards(ctx({ actor }))).toMatchObject({
      kind: 'DENY',
      guard: 'AUTHORIZATION',
      code: 'FORBIDDEN',
    });
  });

  it('suppression service unavailable → denied (fail closed)', () => {
    expect(evaluateOutboundGuards(ctx({ suppression: { status: 'UNAVAILABLE' } }))).toMatchObject({
      kind: 'DENY',
      code: 'CONTACT_SUPPRESSED',
      reason: 'SUPPRESSION_UNAVAILABLE',
    });
  });

  it('HUMAN_REQUIRED → HUMAN_REVIEW (no dial)', () => {
    const lookup = {
      status: 'FOUND',
      entries: [{ phoneE164: '+819012345678', reason: 'HUMAN_REQUIRED', campaignId: null, expiresAt: null }],
    } as const;
    expect(evaluateOutboundGuards(ctx({ suppression: lookup }))).toMatchObject({
      kind: 'HUMAN_REVIEW',
      guard: 'SUPPRESSION',
    });
  });

  it('withdrawn consent is treated as suppression', () => {
    expect(evaluateOutboundGuards(ctx({ contact: { ...ctx().contact, consent: 'WITHDRAWN' } }))).toMatchObject({
      kind: 'DENY',
      guard: 'CONSENT',
      code: 'CONTACT_SUPPRESSED',
    });
  });
});

describe('outbound guard pipeline — each guard denies on its own', () => {
  const base = ctx();
  it.each<[string, Partial<OutboundContext>, string, string]>([
    ['no actor', { actor: null }, 'AUTHENTICATION', 'UNAUTHORIZED'],
    ['missing permission', { actor: { ...ACTOR, permissions: ['contact:read'] } }, 'AUTHORIZATION', 'FORBIDDEN'],
    ['actor from another tenant', { actor: { ...ACTOR, organizationId: 'org-2' } }, 'TENANT', 'NOT_FOUND'],
    ['contact from another tenant', { contact: { ...base.contact, organizationId: 'org-2' } }, 'TENANT', 'NOT_FOUND'],
    [
      'campaign from another tenant',
      { campaign: { ...base.campaign, organizationId: 'org-2' } },
      'TENANT',
      'NOT_FOUND',
    ],
    ['idempotency in flight', { idempotency: { status: 'IN_FLIGHT' } }, 'IDEMPOTENCY', 'CONFLICT'],
    [
      'idempotency key reused with another payload',
      { idempotency: { status: 'PAYLOAD_MISMATCH' } },
      'IDEMPOTENCY',
      'CONFLICT',
    ],
    ['kill switch', { killSwitchEngaged: true }, 'KILL_SWITCH', 'OUTBOUND_HALTED'],
    ['archived contact', { contact: { ...base.contact, status: 'ARCHIVED' } }, 'CONTACT', 'CONFLICT'],
    ['invalid phone', { contact: { ...base.contact, phoneRaw: '0120-123-456' } }, 'PHONE', 'VALIDATION_ERROR'],
    ['night time', { now: new Date('2026-10-05T13:00:00Z') }, 'CALLING_WINDOW', 'CALLING_WINDOW_BLOCKED'],
    [
      'contact prefers evenings',
      { contact: { ...base.contact, contactWindowRaw: '18時以降' } },
      'CALLING_WINDOW',
      'CALLING_WINDOW_BLOCKED',
    ],
    ['campaign paused', { campaign: { ...base.campaign, status: 'PAUSED' } }, 'CAMPAIGN_LIMITS', 'CONFLICT'],
    [
      'daily limit reached',
      { campaign: { ...base.campaign, callsToday: 100 } },
      'CAMPAIGN_LIMITS',
      'CAMPAIGN_LIMIT_EXCEEDED',
    ],
    [
      'max attempts reached',
      { campaign: { ...base.campaign, attemptsForContact: 3 } },
      'CAMPAIGN_LIMITS',
      'CAMPAIGN_LIMIT_EXCEEDED',
    ],
    ['budget too low', { budget: { remainingYen: 49, estimatedCostYen: 50 } }, 'BUDGET', 'BUDGET_EXCEEDED'],
    ['budget unknown', { budget: { remainingYen: null, estimatedCostYen: 50 } }, 'BUDGET', 'BUDGET_EXCEEDED'],
    [
      'contact already on a call (double dial)',
      { concurrency: { activeCalls: 1, limit: 5, contactHasActiveCall: true } },
      'CONCURRENCY',
      'CONFLICT',
    ],
    [
      'org concurrency full',
      { concurrency: { activeCalls: 5, limit: 5, contactHasActiveCall: false } },
      'CONCURRENCY',
      'CONCURRENCY_LIMIT_EXCEEDED',
    ],
    ['provider circuit open', { telephonyAvailable: false }, 'TELEPHONY', 'PROVIDER_UNAVAILABLE'],
  ])('%s', (_name, over, guard, code) => {
    expect(evaluateOutboundGuards(ctx(over))).toMatchObject({ kind: 'DENY', guard, code });
  });

  it('unparseable contact window does not block (org policy still applies)', () => {
    expect(evaluateOutboundGuards(ctx({ contact: { ...base.contact, contactWindowRaw: 'いつでも' } })).kind).toBe(
      'ALLOW',
    );
  });

  it('unknown budget is denied even when the estimate is zero (null must never coerce to a number)', () => {
    for (const estimatedCostYen of [0, 50]) {
      expect(evaluateOutboundGuards(ctx({ budget: { remainingYen: null, estimatedCostYen } }))).toMatchObject({
        kind: 'DENY',
        guard: 'BUDGET',
        reason: 'BUDGET_UNKNOWN',
      });
    }
  });

  it('budget exactly equal to the estimate is allowed', () => {
    expect(evaluateOutboundGuards(ctx({ budget: { remainingYen: 50, estimatedCostYen: 50 } })).kind).toBe('ALLOW');
  });
});

describe('outbound guard pipeline — ordering & fail closed', () => {
  it('first failing guard wins and the trace stops there', () => {
    const r = evaluateOutboundGuards(
      ctx({ killSwitchEngaged: true, suppression: dnc, budget: { remainingYen: 0, estimatedCostYen: 1 } }),
    );
    expect(r).toMatchObject({
      kind: 'DENY',
      guard: 'KILL_SWITCH',
      trace: ['AUTHENTICATION', 'AUTHORIZATION', 'TENANT', 'IDEMPOTENCY'],
    });
  });

  it('idempotent replay returns the original call without evaluating dial guards (even if now suppressed)', () => {
    const r = evaluateOutboundGuards(
      ctx({ idempotency: { status: 'REPLAY', callId: 'call-9' }, suppression: dnc, killSwitchEngaged: true }),
    );
    expect(r).toEqual({ kind: 'REPLAY', callId: 'call-9', trace: ['AUTHENTICATION', 'AUTHORIZATION', 'TENANT'] });
  });

  it('a replay is still subject to authentication and tenant isolation', () => {
    expect(evaluateOutboundGuards(ctx({ actor: null, idempotency: { status: 'REPLAY', callId: 'call-9' } })).kind).toBe(
      'DENY',
    );
    const otherTenant = { ...ACTOR, organizationId: 'org-2' };
    expect(
      evaluateOutboundGuards(ctx({ actor: otherTenant, idempotency: { status: 'REPLAY', callId: 'call-9' } })).kind,
    ).toBe('DENY');
  });

  it('a guard that throws on malformed input denies (fail closed) instead of crashing or allowing', () => {
    const broken = ctx({ campaign: null as unknown as OutboundContext['campaign'] });
    expect(evaluateOutboundGuards(broken)).toMatchObject({
      kind: 'DENY',
      code: 'INTERNAL_ERROR',
      reason: 'GUARD_ERROR',
    });
  });
});
