import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { recordOutcome, type OutcomeInput } from './outcome.js';

const NOW = new Date('2026-10-05T03:00:00Z');
const HOUR = 3_600_000;

function input(over: Partial<OutcomeInput> = {}): OutcomeInput {
  return {
    call: { id: 'call-1', state: 'COMPLETED', contactId: 'ct-1', campaignId: 'camp-A', outcome: null },
    outcome: 'NOT_REACHED_NO_ANSWER',
    now: NOW,
    attemptsForContact: 1,
    maxAttemptsPerContact: 3,
    activeHardSuppression: false,
    ...over,
  };
}

const expectDomainError = (fn: () => unknown, code: string) => {
  try {
    fn();
    expect.unreachable();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
  }
};

describe('recordOutcome — refusal stops all solicitation (再勧誘の禁止)', () => {
  it('REFUSED_DO_NOT_CALL → DO_NOT_CALL suppression, no follow-up', () => {
    const r = recordOutcome(input({ outcome: 'REFUSED_DO_NOT_CALL' }));
    expect(r.suppression).toEqual({ reason: 'DO_NOT_CALL' });
    expect(r.followUp).toBeNull();
  });

  it('NOT_INTERESTED (契約しない旨の意思表示) → STOP_REQUESTED suppression, no follow-up', () => {
    const r = recordOutcome(input({ outcome: 'NOT_INTERESTED' }));
    expect(r.suppression).toEqual({ reason: 'STOP_REQUESTED' });
    expect(r.followUp).toBeNull();
  });

  it('WRONG_NUMBER → third-party number is blocked and a data-fix task is created', () => {
    const r = recordOutcome(input({ outcome: 'WRONG_NUMBER' }));
    expect(r.suppression).toEqual({ reason: 'PRIVACY_BLOCK' });
    expect(r.followUp).toMatchObject({ type: 'DATA_FIX', dueAt: null });
  });

  it('safety state wins: an active hard suppression prevents every sales follow-up', () => {
    for (const outcome of ['NOT_REACHED_NO_ANSWER', 'NOT_REACHED_BUSY', 'NOT_REACHED_VOICEMAIL'] as const) {
      expect(recordOutcome(input({ outcome, activeHardSuppression: true })).followUp).toBeNull();
    }
    const cb = recordOutcome(
      input({ outcome: 'CALLBACK_REQUESTED', callbackAt: new Date(NOW.getTime() + HOUR), activeHardSuppression: true }),
    );
    expect(cb.followUp).toBeNull();
  });
});

describe('recordOutcome — follow-ups', () => {
  it('APPOINTMENT_SET → APPOINTMENT follow-up at the appointment time', () => {
    const at = new Date('2026-10-10T05:00:00Z');
    const r = recordOutcome(input({ outcome: 'APPOINTMENT_SET', appointmentAt: at }));
    expect(r.followUp).toEqual({
      type: 'APPOINTMENT',
      dueAt: at,
      contactId: 'ct-1',
      campaignId: 'camp-A',
      sourceCallId: 'call-1',
    });
    expect(r.suppression).toBeNull();
  });

  it('CALLBACK_REQUESTED → CALLBACK at the requested time', () => {
    const at = new Date(NOW.getTime() + 2 * HOUR);
    expect(recordOutcome(input({ outcome: 'CALLBACK_REQUESTED', callbackAt: at })).followUp).toMatchObject({
      type: 'CALLBACK',
      dueAt: at,
    });
  });

  it.each([
    ['NOT_REACHED_NO_ANSWER', 24 * HOUR],
    ['NOT_REACHED_VOICEMAIL', 24 * HOUR],
    ['NOT_REACHED_BUSY', HOUR / 2],
  ] as const)('%s → RETRY after the policy delay', (outcome, delay) => {
    expect(recordOutcome(input({ outcome })).followUp).toMatchObject({
      type: 'RETRY',
      dueAt: new Date(NOW.getTime() + delay),
    });
  });

  it('no retry once the attempt cap is reached', () => {
    const r = recordOutcome(
      input({ outcome: 'NOT_REACHED_NO_ANSWER', attemptsForContact: 3, maxAttemptsPerContact: 3 }),
    );
    expect(r.followUp).toBeNull();
    expect(r.attemptsExhausted).toBe(true);
  });

  it('CONVERSATION_ENDED_NO_RESULT → no follow-up, no suppression', () => {
    const r = recordOutcome(input({ outcome: 'CONVERSATION_ENDED_NO_RESULT' }));
    expect(r.followUp).toBeNull();
    expect(r.suppression).toBeNull();
  });
});

describe('recordOutcome — validation', () => {
  it('APPOINTMENT_SET without appointmentAt is invalid', () => {
    expectDomainError(() => recordOutcome(input({ outcome: 'APPOINTMENT_SET' })), 'VALIDATION_ERROR');
  });

  it('appointment / callback in the past is invalid', () => {
    const past = new Date(NOW.getTime() - 1);
    expectDomainError(
      () => recordOutcome(input({ outcome: 'APPOINTMENT_SET', appointmentAt: past })),
      'VALIDATION_ERROR',
    );
    expectDomainError(
      () => recordOutcome(input({ outcome: 'CALLBACK_REQUESTED', callbackAt: past })),
      'VALIDATION_ERROR',
    );
    expectDomainError(() => recordOutcome(input({ outcome: 'CALLBACK_REQUESTED' })), 'VALIDATION_ERROR');
  });

  it.each(['QUEUED', 'DIALING', 'RINGING', 'ANSWERED', 'AI_ACTIVE', 'HUMAN_ACTIVE', 'ENDING', 'CANCELLED'] as const)(
    'cannot record an outcome while the call is %s',
    (state) => {
      expectDomainError(() => recordOutcome(input({ call: { ...input().call, state } })), 'INVALID_STATE_TRANSITION');
    },
  );

  it('a FAILED call may only carry a not-reached outcome', () => {
    const failed = { ...input().call, state: 'FAILED' as const };
    expect(recordOutcome(input({ call: failed, outcome: 'NOT_REACHED_BUSY' })).followUp?.type).toBe('RETRY');
    expectDomainError(
      () =>
        recordOutcome(
          input({ call: failed, outcome: 'APPOINTMENT_SET', appointmentAt: new Date(NOW.getTime() + HOUR) }),
        ),
      'VALIDATION_ERROR',
    );
  });

  it('outcome is write-once (a second outcome is a conflict)', () => {
    expectDomainError(() => recordOutcome(input({ call: { ...input().call, outcome: 'NOT_INTERESTED' } })), 'CONFLICT');
  });
});
