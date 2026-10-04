import { DomainError } from '../errors.js';

export const CONVERSATION_STATES = [
  'INTRODUCTION',
  'DISCLOSURE',
  'IDENTIFICATION',
  'QUALIFICATION',
  'DISCOVERY',
  'FAQ',
  'OBJECTION',
  'INTERESTED',
  'SCHEDULING',
  'HANDOFF',
  'STOPPING',
  'COMPLETED',
] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

const SALES = ['QUALIFICATION', 'DISCOVERY', 'FAQ', 'OBJECTION', 'INTERESTED'] as const;
const others = (self: ConversationState) => SALES.filter((s) => s !== self);
// A customer can hang up / the agent can stop or hand off from anywhere active.
const EXITS = ['HANDOFF', 'STOPPING', 'COMPLETED'] as const;

/**
 * 宅建業法施行規則16条の11: before soliciting, disclose 商号, 勧誘者の氏名 and 勧誘目的.
 * Hence INTRODUCTION → DISCLOSURE → IDENTIFICATION is the only path into sales states.
 * STOPPING (the customer declined) can only end the call: no objection handling, no transfer to sales.
 */
const TRANSITIONS: Readonly<Record<ConversationState, readonly ConversationState[]>> = {
  INTRODUCTION: ['DISCLOSURE', ...EXITS],
  DISCLOSURE: ['IDENTIFICATION', ...EXITS],
  IDENTIFICATION: [...SALES, ...EXITS],
  QUALIFICATION: [...others('QUALIFICATION'), ...EXITS],
  DISCOVERY: [...others('DISCOVERY'), ...EXITS],
  FAQ: [...others('FAQ'), ...EXITS],
  OBJECTION: [...others('OBJECTION'), ...EXITS],
  INTERESTED: [...others('INTERESTED'), 'SCHEDULING', ...EXITS],
  SCHEDULING: ['FAQ', 'OBJECTION', ...EXITS],
  HANDOFF: ['STOPPING', 'COMPLETED'],
  STOPPING: ['COMPLETED'],
  COMPLETED: [],
};

export function canConversationTransition(from: ConversationState, to: ConversationState): boolean {
  return Object.hasOwn(TRANSITIONS, from) && TRANSITIONS[from].includes(to);
}

export function transitionConversation(from: ConversationState, to: ConversationState): ConversationState {
  if (!canConversationTransition(from, to)) {
    throw new DomainError('INVALID_STATE_TRANSITION', `Illegal conversation transition ${from} → ${to}`, { from, to });
  }
  return to;
}

export type StopIntent = { stop: false } | { stop: true; strength: 'EXPLICIT_DNC' | 'REFUSAL'; matched: string };

// Explicit "do not contact me" — becomes DO_NOT_CALL.
const EXPLICIT_DNC: readonly RegExp[] = [
  /電話(を)?(し|かけ)(て(こ|く)ない|ない)で/,
  /(電話|連絡)(して|し)?(こないで|くるな|しないで)/,
  /かけ(て)?(こ|く)ないで/,
  /二度と(電話|連絡|かけ)/,
  /連絡(は)?(不要|いらない|要らない|しないで)/,
  /(リスト|名簿)から(消|外|削除)/,
  /番号を(消|削除)/,
  /迷惑/,
  /(営業|勧誘)(電話)?(は)?(お断り|断る|やめて)/,
  /stop\s+calling/i,
  /(do\s+not|don'?t)\s+call/i,
  /remove\s+(me|my\s+number)/i,
];

// Declining to contract (契約しない旨の意思表示) — re-solicitation is prohibited, becomes STOP_REQUESTED.
// 「結構です」 is ambiguous in Japanese; 「〜で結構です」 means "…is fine" and is excluded.
const REFUSAL: readonly RegExp[] = [
  /(?<![でデ])(結構|けっこう|ケッコウ)(です|デス|だ|でございます)/,
  /もう(いい|大丈夫)(です)?$/,
  /興味(が|は)?(ない|ありません|無い)/,
  /必要(が|は)?(ない|ありません|無い)/,
  /(いら|要ら)ない|いりません|要りません/,
  /お断り(します|です)/,
  /(やめて|止めて)(ください|下さい)?$/,
  /not\s+interested/i,
];

/**
 * Over-detection is the safe failure mode: a false positive ends one conversation,
 * a false negative continues soliciting someone who said no.
 */
export function detectStopIntent(text: string): StopIntent {
  const t = text.normalize('NFKC').trim();
  if (t === '') return { stop: false };
  const hit = (list: readonly RegExp[]) => list.map((re) => re.exec(t)?.[0]).find((m) => m !== undefined);
  const dnc = hit(EXPLICIT_DNC);
  if (dnc !== undefined) return { stop: true, strength: 'EXPLICIT_DNC', matched: dnc };
  const refusal = hit(REFUSAL);
  if (refusal !== undefined) return { stop: true, strength: 'REFUSAL', matched: refusal };
  return { stop: false };
}

export type StopDirective = {
  readonly next: 'STOPPING';
  readonly actions: readonly ['PERSIST_SUPPRESSION', 'CONFIRM_STOP', 'END_CALL'];
  readonly suppressionReason: 'DO_NOT_CALL' | 'STOP_REQUESTED';
};

/**
 * Runs on every customer utterance before the AI is allowed to respond. A stop request
 * forces STOPPING; the AI never gets a turn to persuade.
 */
export function handleCustomerTurn(state: ConversationState, utterance: string): StopDirective | null {
  if (!canConversationTransition(state, 'STOPPING')) return null;
  const intent = detectStopIntent(utterance);
  if (!intent.stop) return null;
  return {
    next: 'STOPPING',
    actions: ['PERSIST_SUPPRESSION', 'CONFIRM_STOP', 'END_CALL'],
    suppressionReason: intent.strength === 'EXPLICIT_DNC' ? 'DO_NOT_CALL' : 'STOP_REQUESTED',
  };
}
