import type { CallState } from '../call/callStateMachine.js';
import { DomainError } from '../errors.js';
import type { HardReason } from '../suppression/suppression.js';

/**
 * Call outcomes. Mapped from the existing テレアポ管理シート vocabulary:
 * 成約 → WON, 検討 → CONSIDERING, アポ獲得 → APPOINTMENT_SET, 再架電/折り返し → CALLBACK_REQUESTED, 不在/留守 → NOT_REACHED_*,
 * 拒否/断り/NG → REFUSED_DO_NOT_CALL, 興味なし → NOT_INTERESTED, 番号違い → WRONG_NUMBER, 架電済み → CONVERSATION_ENDED_NO_RESULT.
 */
export const CALL_OUTCOMES = [
  'WON',
  'CONSIDERING',
  'APPOINTMENT_SET',
  'CALLBACK_REQUESTED',
  'NOT_REACHED_NO_ANSWER',
  'NOT_REACHED_BUSY',
  'NOT_REACHED_VOICEMAIL',
  'NOT_INTERESTED',
  'REFUSED_DO_NOT_CALL',
  'WRONG_NUMBER',
  'CONVERSATION_ENDED_NO_RESULT',
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

type NotReached = 'NOT_REACHED_NO_ANSWER' | 'NOT_REACHED_BUSY' | 'NOT_REACHED_VOICEMAIL';
const NOT_REACHED: ReadonlySet<CallOutcome> = new Set<NotReached>([
  'NOT_REACHED_NO_ANSWER',
  'NOT_REACHED_BUSY',
  'NOT_REACHED_VOICEMAIL',
]);

const MINUTE = 60_000;
/** Retry delay per not-reached outcome. 〔要確認: 運用に合わせて調整〕 */
const RETRY_DELAY_MS: Readonly<Record<NotReached, number>> = {
  NOT_REACHED_NO_ANSWER: 24 * 60 * MINUTE,
  NOT_REACHED_VOICEMAIL: 24 * 60 * MINUTE,
  NOT_REACHED_BUSY: 30 * MINUTE,
};
/** 検討中のお客様への再連絡。〔要確認: 運用に合わせて調整〕 */
const CONSIDERING_FOLLOW_UP_MS = 72 * 60 * MINUTE;

/**
 * 宅建業法施行規則16条の11: once the person indicates they will not contract (or do not want
 * further solicitation), continuing to solicit is prohibited. Both outcomes therefore become
 * hard suppressions — conversion never outranks this. 〔要法務確認〕
 */
const SUPPRESSION_FOR: Partial<Record<CallOutcome, HardReason>> = {
  REFUSED_DO_NOT_CALL: 'DO_NOT_CALL',
  NOT_INTERESTED: 'STOP_REQUESTED',
  // The number belongs to someone else: never call it again for this contact.
  WRONG_NUMBER: 'PRIVACY_BLOCK',
};

export type FollowUpType = 'APPOINTMENT' | 'CALLBACK' | 'RETRY' | 'FOLLOW_UP' | 'DATA_FIX';
export type FollowUp = {
  readonly type: FollowUpType;
  readonly dueAt: Date | null;
  readonly contactId: string;
  readonly campaignId: string;
  readonly sourceCallId: string;
};

export type OutcomeInput = {
  readonly call: {
    readonly id: string;
    readonly state: CallState;
    readonly contactId: string;
    readonly campaignId: string;
    readonly outcome: CallOutcome | null;
  };
  readonly outcome: CallOutcome;
  readonly now: Date;
  readonly attemptsForContact: number;
  readonly maxAttemptsPerContact: number;
  /** True when the contact already has DNC/STOP/LEGAL/PRIVACY suppression. */
  readonly activeHardSuppression: boolean;
  readonly appointmentAt?: Date;
  readonly callbackAt?: Date;
};

export type OutcomeDecision = {
  readonly outcome: CallOutcome;
  readonly suppression: { readonly reason: HardReason } | null;
  readonly followUp: FollowUp | null;
  readonly attemptsExhausted: boolean;
};

function requireFuture(at: Date | undefined, now: Date, field: string): Date {
  if (!at || Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be a future time`, { field });
  }
  return at;
}

export function recordOutcome(i: OutcomeInput): OutcomeDecision {
  const { call, outcome, now } = i;

  if (call.state !== 'COMPLETED' && call.state !== 'FAILED') {
    throw new DomainError('INVALID_STATE_TRANSITION', `Cannot record an outcome for a ${call.state} call`, {
      from: call.state,
    });
  }
  if (call.outcome !== null) {
    throw new DomainError('CONFLICT', 'Outcome already recorded', { callId: call.id });
  }
  if (call.state === 'FAILED' && !NOT_REACHED.has(outcome)) {
    throw new DomainError('VALIDATION_ERROR', 'A failed call can only be recorded as not reached', { outcome });
  }

  const followUpOf = (type: FollowUpType, dueAt: Date | null): FollowUp => ({
    type,
    dueAt,
    contactId: call.contactId,
    campaignId: call.campaignId,
    sourceCallId: call.id,
  });

  const suppressionReason = SUPPRESSION_FOR[outcome];
  const suppression = suppressionReason ? { reason: suppressionReason } : null;
  const exhausted = i.attemptsForContact >= i.maxAttemptsPerContact;
  // Sales follow-ups are only possible when no hard suppression exists or is being created.
  const mayFollowUp = !i.activeHardSuppression && suppression === null;

  let followUp: FollowUp | null = null;
  switch (outcome) {
    case 'APPOINTMENT_SET': {
      const at = requireFuture(i.appointmentAt, now, 'appointmentAt');
      if (mayFollowUp) followUp = followUpOf('APPOINTMENT', at);
      break;
    }
    case 'CALLBACK_REQUESTED': {
      const at = requireFuture(i.callbackAt, now, 'callbackAt');
      if (mayFollowUp) followUp = followUpOf('CALLBACK', at);
      break;
    }
    case 'NOT_REACHED_NO_ANSWER':
    case 'NOT_REACHED_BUSY':
    case 'NOT_REACHED_VOICEMAIL': {
      if (mayFollowUp && !exhausted) {
        followUp = followUpOf('RETRY', new Date(now.getTime() + RETRY_DELAY_MS[outcome]));
      }
      break;
    }
    case 'WRONG_NUMBER':
      // Internal data-quality task, not solicitation: allowed even under suppression.
      followUp = followUpOf('DATA_FIX', null);
      break;
    case 'CONSIDERING':
      if (mayFollowUp) followUp = followUpOf('FOLLOW_UP', new Date(now.getTime() + CONSIDERING_FOLLOW_UP_MS));
      break;
    case 'WON':
    case 'NOT_INTERESTED':
    case 'REFUSED_DO_NOT_CALL':
    case 'CONVERSATION_ENDED_NO_RESULT':
      break;
  }

  return { outcome, suppression, followUp, attemptsExhausted: exhausted };
}
