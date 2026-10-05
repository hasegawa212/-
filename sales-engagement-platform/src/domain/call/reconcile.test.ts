import { describe, expect, it } from 'vitest';
import type { CallState } from './callStateMachine.js';
import { reconcileProviderEvent, type ProviderStatus } from './reconcile.js';

const call = (state: CallState, version = 1) => ({ id: 'c1', state, version });

describe('reconcileProviderEvent — webhook duplicates and ordering', () => {
  it('applies a normal forward event', () => {
    expect(reconcileProviderEvent(call('DIALING'), 'ringing')).toEqual({
      kind: 'APPLIED',
      call: { id: 'c1', state: 'RINGING', version: 2 },
      path: ['RINGING'],
    });
  });

  it('duplicate webhook is a no-op', () => {
    expect(reconcileProviderEvent(call('RINGING', 2), 'ringing')).toEqual({ kind: 'IGNORED', reason: 'DUPLICATE' });
  });

  it('a late "ringing" after "answered" does not move the call backwards', () => {
    expect(reconcileProviderEvent(call('ANSWERED', 3), 'ringing')).toEqual({ kind: 'IGNORED', reason: 'STALE' });
  });

  it('any event after a terminal state is ignored (e.g. ringing after completed)', () => {
    for (const s of ['ringing', 'answered', 'completed', 'busy'] as ProviderStatus[]) {
      expect(reconcileProviderEvent(call('COMPLETED', 9), s)).toEqual({ kind: 'IGNORED', reason: 'TERMINAL' });
    }
  });

  it('missing intermediate events are filled with legal steps (answered arrives while QUEUED)', () => {
    expect(reconcileProviderEvent(call('QUEUED'), 'answered')).toEqual({
      kind: 'APPLIED',
      call: { id: 'c1', state: 'ANSWERED', version: 3 },
      path: ['DIALING', 'ANSWERED'],
    });
  });

  it('completed after an answered conversation ends via ENDING', () => {
    expect(reconcileProviderEvent(call('HUMAN_ACTIVE', 5), 'completed')).toEqual({
      kind: 'APPLIED',
      call: { id: 'c1', state: 'COMPLETED', version: 7 },
      path: ['ENDING', 'COMPLETED'],
    });
  });

  it.each(['busy', 'no-answer', 'failed'] as const)('%s before answer → FAILED', (s) => {
    expect(reconcileProviderEvent(call('RINGING', 2), s)).toMatchObject({ kind: 'APPLIED', call: { state: 'FAILED' } });
  });

  it('completed without ever being answered → FAILED (not a completed conversation)', () => {
    expect(reconcileProviderEvent(call('RINGING', 2), 'completed')).toMatchObject({
      kind: 'APPLIED',
      call: { state: 'FAILED' },
    });
  });

  it('canceled before answer → CANCELLED; after answer it is ignored as stale', () => {
    expect(reconcileProviderEvent(call('DIALING'), 'canceled')).toMatchObject({ call: { state: 'CANCELLED' } });
    expect(reconcileProviderEvent(call('AI_ACTIVE', 4), 'canceled')).toEqual({ kind: 'IGNORED', reason: 'STALE' });
  });

  it('unknown provider status never throws and never moves the call', () => {
    expect(reconcileProviderEvent(call('RINGING'), 'weird' as ProviderStatus)).toEqual({
      kind: 'IGNORED',
      reason: 'UNKNOWN_STATUS',
    });
  });

  it('every applied path consists only of legal transitions', () => {
    const states: CallState[] = ['QUEUED', 'DIALING', 'RINGING', 'ANSWERED', 'AI_ACTIVE', 'HUMAN_ACTIVE', 'ENDING'];
    const events: ProviderStatus[] = [
      'initiated',
      'ringing',
      'answered',
      'completed',
      'busy',
      'no-answer',
      'failed',
      'canceled',
    ];
    for (const s of states) for (const e of events) expect(() => reconcileProviderEvent(call(s), e)).not.toThrow();
  });
});
