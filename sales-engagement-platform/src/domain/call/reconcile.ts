import { isTerminal, transitionCall, type CallState, type CallStateful } from './callStateMachine.js';

/** Provider-neutral call status as reported by telephony webhooks (adapters map vendor names onto this). */
export type ProviderStatus =
  'initiated' | 'ringing' | 'answered' | 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled';

export type ReconcileResult<T> =
  | { readonly kind: 'APPLIED'; readonly call: T; readonly path: readonly CallState[] }
  | { readonly kind: 'IGNORED'; readonly reason: 'DUPLICATE' | 'STALE' | 'TERMINAL' | 'UNKNOWN_STATUS' };

// Progress order of non-terminal states. AI_ACTIVE / HUMAN_ACTIVE are ours, not the provider's.
const RANK: Readonly<Partial<Record<CallState, number>>> = {
  QUEUED: 0,
  DIALING: 1,
  RINGING: 2,
  ANSWERED: 3,
  AI_ACTIVE: 4,
  HUMAN_ACTIVE: 4,
  ENDING: 5,
};
const ANSWERED_RANK = 3;

const IGNORE = (reason: 'DUPLICATE' | 'STALE' | 'TERMINAL' | 'UNKNOWN_STATUS') =>
  ({ kind: 'IGNORED', reason }) as const;

/**
 * Applies a provider webhook to a call without ever moving it backwards. Webhooks arrive
 * duplicated, late and out of order; this turns each into either a sequence of legal
 * transitions (filling skipped intermediate states) or an explicit no-op.
 */
export function reconcileProviderEvent<T extends CallStateful>(call: T, status: ProviderStatus): ReconcileResult<T> {
  if (isTerminal(call.state)) return IGNORE('TERMINAL');
  const rank = RANK[call.state] ?? 0;
  const answered = rank >= ANSWERED_RANK;
  const lead = call.state === 'QUEUED' ? (['DIALING'] as CallState[]) : [];

  let path: CallState[];
  switch (status) {
    case 'initiated':
    case 'ringing':
    case 'answered': {
      const target: CallState = status === 'initiated' ? 'DIALING' : status === 'ringing' ? 'RINGING' : 'ANSWERED';
      const targetRank = RANK[target] ?? 0;
      if (targetRank === rank) return IGNORE('DUPLICATE');
      if (targetRank < rank) return IGNORE('STALE');
      path = target === 'DIALING' ? ['DIALING'] : [...lead, target];
      break;
    }
    case 'completed':
      // Completed without ever being answered is not a conversation that took place.
      path = answered ? (call.state === 'ENDING' ? ['COMPLETED'] : ['ENDING', 'COMPLETED']) : [...lead, 'FAILED'];
      break;
    case 'busy':
    case 'no-answer':
      if (answered) return IGNORE('STALE');
      path = [...lead, 'FAILED'];
      break;
    case 'failed':
      path = [...lead, 'FAILED'];
      break;
    case 'canceled':
      if (answered) return IGNORE('STALE');
      path = ['CANCELLED'];
      break;
    default:
      return IGNORE('UNKNOWN_STATUS');
  }

  const next = path.reduce<T>((c, to) => transitionCall(c, to), call);
  return { kind: 'APPLIED', call: next, path };
}
