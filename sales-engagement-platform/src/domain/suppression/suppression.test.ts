import { describe, expect, it } from 'vitest';
import { evaluateSuppression, type SuppressionEntry, type SuppressionLookup } from './suppression.js';

const PHONE = '+819012345678';
const NOW = new Date('2026-10-05T03:00:00Z');

const entry = (over: Partial<SuppressionEntry> = {}): SuppressionEntry => ({
  phoneE164: PHONE,
  reason: 'DO_NOT_CALL',
  campaignId: null,
  expiresAt: null,
  ...over,
});
const found = (...entries: SuppressionEntry[]): SuppressionLookup => ({ status: 'FOUND', entries });
const evalWith = (lookup: SuppressionLookup, campaignId = 'camp-A') =>
  evaluateSuppression({ lookup, phoneE164: PHONE, campaignId, now: NOW });

describe('suppression — DNC (critical)', () => {
  it('DNC contact cannot be called', () => {
    expect(evalWith(found(entry()))).toEqual({ decision: 'BLOCK', reason: 'DO_NOT_CALL' });
  });

  it('DNC applies across campaigns even when recorded from another campaign', () => {
    const fromB = entry({ campaignId: 'camp-B' });
    expect(evalWith(found(fromB), 'camp-A')).toEqual({ decision: 'BLOCK', reason: 'DO_NOT_CALL' });
    expect(evalWith(found(fromB), 'camp-Z')).toEqual({ decision: 'BLOCK', reason: 'DO_NOT_CALL' });
  });

  it.each(['DO_NOT_CALL', 'STOP_REQUESTED', 'LEGAL_BLOCK', 'PRIVACY_BLOCK'] as const)(
    '%s ignores expiresAt — it never lapses on its own',
    (reason) => {
      const expired = entry({ reason, expiresAt: new Date('2020-01-01T00:00:00Z') });
      expect(evalWith(found(expired))).toEqual({ decision: 'BLOCK', reason });
    },
  );

  it('a DNC entry wins over any number of other entries (order independent)', () => {
    const cooldown = entry({ reason: 'COOLDOWN', campaignId: 'camp-A', expiresAt: new Date('2026-10-06T00:00:00Z') });
    const review = entry({ reason: 'HUMAN_REQUIRED' });
    expect(evalWith(found(cooldown, review, entry()))).toEqual({ decision: 'BLOCK', reason: 'DO_NOT_CALL' });
    expect(evalWith(found(entry(), review, cooldown))).toEqual({ decision: 'BLOCK', reason: 'DO_NOT_CALL' });
  });

  it('reports the strongest block reason: LEGAL > PRIVACY > DNC > STOP_REQUESTED', () => {
    expect(evalWith(found(entry({ reason: 'STOP_REQUESTED' }), entry({ reason: 'LEGAL_BLOCK' })))).toEqual({
      decision: 'BLOCK',
      reason: 'LEGAL_BLOCK',
    });
    expect(evalWith(found(entry(), entry({ reason: 'PRIVACY_BLOCK' })))).toEqual({
      decision: 'BLOCK',
      reason: 'PRIVACY_BLOCK',
    });
    expect(evalWith(found(entry({ reason: 'STOP_REQUESTED' }), entry()))).toEqual({
      decision: 'BLOCK',
      reason: 'DO_NOT_CALL',
    });
  });
});

describe('suppression — fail closed', () => {
  it('lookup unavailable → BLOCK, never ALLOW', () => {
    expect(evalWith({ status: 'UNAVAILABLE' })).toEqual({ decision: 'BLOCK', reason: 'SUPPRESSION_UNAVAILABLE' });
  });

  it('unknown reason in data → BLOCK (corrupt data is not permission)', () => {
    const bad = entry({ reason: 'WHATEVER' as SuppressionEntry['reason'] });
    expect(evalWith(found(bad))).toEqual({ decision: 'BLOCK', reason: 'SUPPRESSION_DATA_INVALID' });
  });

  it('entry for a different phone number is not applied (lookup must be exact-match)', () => {
    expect(evalWith(found(entry({ phoneE164: '+819099999999' })))).toEqual({ decision: 'ALLOW' });
  });

  it('malformed lookup object → BLOCK', () => {
    expect(evalWith({ status: 'FOUND' } as unknown as SuppressionLookup)).toEqual({
      decision: 'BLOCK',
      reason: 'SUPPRESSION_DATA_INVALID',
    });
  });
});

describe('suppression — soft states', () => {
  it('no entries → ALLOW', () => {
    expect(evalWith(found())).toEqual({ decision: 'ALLOW' });
  });

  it('HUMAN_REQUIRED → HUMAN_REVIEW', () => {
    expect(evalWith(found(entry({ reason: 'HUMAN_REQUIRED' })))).toEqual({
      decision: 'HUMAN_REVIEW',
      reason: 'HUMAN_REQUIRED',
    });
  });

  it('active COOLDOWN blocks only its own campaign', () => {
    const cd = entry({ reason: 'COOLDOWN', campaignId: 'camp-A', expiresAt: new Date('2026-10-05T04:00:00Z') });
    expect(evalWith(found(cd), 'camp-A')).toEqual({ decision: 'BLOCK', reason: 'COOLDOWN' });
    expect(evalWith(found(cd), 'camp-B')).toEqual({ decision: 'ALLOW' });
  });

  it('organization-wide COOLDOWN blocks every campaign', () => {
    const cd = entry({ reason: 'COOLDOWN', campaignId: null, expiresAt: new Date('2026-10-05T04:00:00Z') });
    expect(evalWith(found(cd), 'camp-B')).toEqual({ decision: 'BLOCK', reason: 'COOLDOWN' });
  });

  it('COOLDOWN lapses exactly at expiresAt', () => {
    const at = (iso: string) => entry({ reason: 'COOLDOWN', campaignId: 'camp-A', expiresAt: new Date(iso) });
    expect(evalWith(found(at('2026-10-05T03:00:00.001Z')))).toEqual({ decision: 'BLOCK', reason: 'COOLDOWN' });
    expect(evalWith(found(at('2026-10-05T03:00:00.000Z')))).toEqual({ decision: 'ALLOW' });
  });

  it('COOLDOWN without expiry is treated as active (fail closed)', () => {
    expect(evalWith(found(entry({ reason: 'COOLDOWN', campaignId: 'camp-A' })))).toEqual({
      decision: 'BLOCK',
      reason: 'COOLDOWN',
    });
  });

  it('BLOCK outranks HUMAN_REVIEW', () => {
    const cd = entry({ reason: 'COOLDOWN', campaignId: 'camp-A' });
    expect(evalWith(found(entry({ reason: 'HUMAN_REQUIRED' }), cd))).toEqual({ decision: 'BLOCK', reason: 'COOLDOWN' });
  });
});
