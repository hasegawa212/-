import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { CALL_STATES, canTransition, isTerminal, transitionCall, type CallState } from './callStateMachine.js';

const ALLOWED: ReadonlyArray<[CallState, CallState]> = [
  ['QUEUED', 'DIALING'],
  ['QUEUED', 'CANCELLED'],
  ['DIALING', 'RINGING'],
  ['DIALING', 'ANSWERED'],
  ['DIALING', 'FAILED'],
  ['DIALING', 'CANCELLED'],
  ['RINGING', 'ANSWERED'],
  ['RINGING', 'FAILED'],
  ['RINGING', 'CANCELLED'],
  ['ANSWERED', 'AI_ACTIVE'],
  ['ANSWERED', 'HUMAN_ACTIVE'],
  ['ANSWERED', 'ENDING'],
  ['AI_ACTIVE', 'HUMAN_ACTIVE'],
  ['AI_ACTIVE', 'ENDING'],
  ['HUMAN_ACTIVE', 'ENDING'],
  ['ANSWERED', 'FAILED'],
  ['AI_ACTIVE', 'FAILED'],
  ['HUMAN_ACTIVE', 'FAILED'],
  ['ENDING', 'COMPLETED'],
  ['ENDING', 'FAILED'],
];

describe('call state machine', () => {
  it('exhaustively matches the transition table (every pair checked)', () => {
    const allowed = new Set(ALLOWED.map(([a, b]) => `${a}>${b}`));
    for (const from of CALL_STATES) {
      for (const to of CALL_STATES) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(allowed.has(`${from}>${to}`));
      }
    }
  });

  it.each(['COMPLETED', 'FAILED', 'CANCELLED'] as const)('%s is terminal: nothing leaves it', (s) => {
    expect(isTerminal(s)).toBe(true);
    for (const to of CALL_STATES) expect(canTransition(s, to)).toBe(false);
  });

  it('COMPLETED → RINGING is a domain error', () => {
    const call = { id: 'c1', state: 'COMPLETED' as const, version: 7 };
    expect(() => transitionCall(call, 'RINGING')).toThrow(DomainError);
    try {
      transitionCall(call, 'RINGING');
    } catch (e) {
      expect((e as DomainError).code).toBe('INVALID_STATE_TRANSITION');
      expect((e as DomainError).details).toEqual({ from: 'COMPLETED', to: 'RINGING' });
    }
  });

  it('HUMAN_ACTIVE → AI_ACTIVE is forbidden (a human takeover is never silently reverted to AI)', () => {
    expect(canTransition('HUMAN_ACTIVE', 'AI_ACTIVE')).toBe(false);
  });

  it('self-transitions are not allowed (duplicate events must be handled as idempotent no-ops upstream)', () => {
    for (const s of CALL_STATES) expect(canTransition(s, s)).toBe(false);
  });

  it('a legal transition returns a new object with incremented version and does not mutate the input', () => {
    const call = Object.freeze({ id: 'c1', state: 'QUEUED' as const, version: 1 });
    const next = transitionCall(call, 'DIALING');
    expect(next).toEqual({ id: 'c1', state: 'DIALING', version: 2 });
    expect(call.state).toBe('QUEUED');
  });

  it('rejects unknown states defensively', () => {
    expect(canTransition('BOGUS' as CallState, 'DIALING')).toBe(false);
    expect(() => transitionCall({ id: 'x', state: 'QUEUED', version: 1 }, 'BOGUS' as CallState)).toThrow(DomainError);
  });
});
