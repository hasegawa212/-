import { DomainError } from '../errors.js';

export const CALL_STATES = [
  'QUEUED',
  'DIALING',
  'RINGING',
  'ANSWERED',
  'AI_ACTIVE',
  'HUMAN_ACTIVE',
  'ENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type CallState = (typeof CALL_STATES)[number];

/**
 * The only legal transitions. Anything absent is illegal — including self-transitions,
 * which upstream code must treat as duplicate events (idempotent no-ops), not as moves.
 * HUMAN_ACTIVE never returns to AI_ACTIVE: a human takeover is final for that call.
 */
const TRANSITIONS: Readonly<Record<CallState, readonly CallState[]>> = {
  QUEUED: ['DIALING', 'CANCELLED'],
  DIALING: ['RINGING', 'ANSWERED', 'FAILED', 'CANCELLED'],
  RINGING: ['ANSWERED', 'FAILED', 'CANCELLED'],
  ANSWERED: ['AI_ACTIVE', 'HUMAN_ACTIVE', 'ENDING', 'FAILED'],
  AI_ACTIVE: ['HUMAN_ACTIVE', 'ENDING', 'FAILED'],
  HUMAN_ACTIVE: ['ENDING', 'FAILED'],
  ENDING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: CallState, to: CallState): boolean {
  return Object.hasOwn(TRANSITIONS, from) && TRANSITIONS[from].includes(to);
}

export function isTerminal(state: CallState): boolean {
  return Object.hasOwn(TRANSITIONS, state) && TRANSITIONS[state].length === 0;
}

export type CallStateful = { readonly id: string; readonly state: CallState; readonly version: number };

/** Pure transition. `version` supports optimistic concurrency in the persistence layer. */
export function transitionCall<T extends CallStateful>(call: T, to: CallState): T {
  if (!canTransition(call.state, to)) {
    throw new DomainError('INVALID_STATE_TRANSITION', `Illegal call transition ${call.state} → ${to}`, {
      from: call.state,
      to,
    });
  }
  return { ...call, state: to, version: call.version + 1 };
}
