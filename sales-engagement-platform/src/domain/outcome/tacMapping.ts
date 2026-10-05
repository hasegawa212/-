import { err, ok, type Result } from '../shared/result.js';
import type { CallOutcome, FollowUpType } from './outcome.js';

/**
 * Anti-corruption layer for the current TAC app (hasegawa212/-6780 telegram-ai-bot/tac).
 * Labels are mapped exactly; anything else is rejected rather than guessed, because a
 * wrong guess could turn a refusal into a callable lead.
 */
const DISPOSITIONS: Readonly<Record<string, CallOutcome>> = {
  成約: 'WON',
  検討: 'CONSIDERING',
  折り返し: 'CALLBACK_REQUESTED',
  不在: 'NOT_REACHED_NO_ANSWER',
  拒否: 'REFUSED_DO_NOT_CALL',
};

export type TacFollowDecision =
  | { readonly kind: 'CALLABLE'; readonly followUpType: Extract<FollowUpType, 'CALLBACK' | 'FOLLOW_UP' | 'RETRY'> }
  | { readonly kind: 'HUMAN_REVIEW' }
  | { readonly kind: 'SUPPRESS'; readonly reason: 'STOP_REQUESTED' };

const FOLLOW_CATEGORIES: Readonly<Record<string, TacFollowDecision>> = {
  再調整希望: { kind: 'CALLABLE', followUpType: 'CALLBACK' },
  日程返答待ち: { kind: 'CALLABLE', followUpType: 'FOLLOW_UP' },
  不在: { kind: 'CALLABLE', followUpType: 'RETRY' },
  要確認: { kind: 'HUMAN_REVIEW' },
  // The current app does not add 連絡停止 to its DNC list (audit R13); here it is a hard suppression.
  連絡停止: { kind: 'SUPPRESS', reason: 'STOP_REQUESTED' },
};

const clean = (s: string) => s.normalize('NFKC').trim();

export function mapTacDisposition(label: string): Result<CallOutcome, 'UNKNOWN_DISPOSITION'> {
  const key = clean(label);
  return Object.hasOwn(DISPOSITIONS, key) ? ok(DISPOSITIONS[key] as CallOutcome) : err('UNKNOWN_DISPOSITION');
}

export function mapTacFollowCategory(category: string): Result<TacFollowDecision, 'UNKNOWN_CATEGORY'> {
  const key = clean(category);
  return Object.hasOwn(FOLLOW_CATEGORIES, key)
    ? ok(FOLLOW_CATEGORIES[key] as TacFollowDecision)
    : err('UNKNOWN_CATEGORY');
}
