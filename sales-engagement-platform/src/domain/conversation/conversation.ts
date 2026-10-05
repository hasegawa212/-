import { DomainError } from '../errors.js';

export const CONVERSATION_STATES = [
  'INTRODUCTION',
  'DISCLOSURE',
  'PERMISSION',
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
 * Hence INTRODUCTION → DISCLOSURE → PERMISSION → IDENTIFICATION is the only path into sales states
 * (PERMISSION = 「今お時間よろしいですか」: a no here ends or reschedules, it is never argued with).
 * STOPPING (the customer declined) can only end the call: no objection handling, no transfer to sales.
 */
const TRANSITIONS: Readonly<Record<ConversationState, readonly ConversationState[]>> = {
  INTRODUCTION: ['DISCLOSURE', ...EXITS],
  DISCLOSURE: ['PERMISSION', ...EXITS],
  PERMISSION: ['IDENTIFICATION', ...EXITS],
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

// Complaints (クレーム) — the AI must stop selling and hand over to a person.
const COMPLAINT: readonly RegExp[] = [
  /しつこい/,
  /クレーム|苦情/,
  /消費(者|生活)センター|国民生活センター/,
  /警察|弁護士|訴え/,
  /(責任者|上司|上の人)を出(せ|して)/,
  /ふざけ(る|ん)な/,
];

export function detectComplaint(text: string): boolean {
  const t = text.normalize('NFKC');
  return COMPLAINT.some((re) => re.test(t));
}

export type SafetyDirective =
  | {
      readonly next: 'STOPPING';
      readonly actions: readonly ('PERSIST_SUPPRESSION' | 'CONFIRM_STOP' | 'END_CALL' | 'FLAG_COMPLAINT')[];
      readonly suppressionReason: 'DO_NOT_CALL' | 'STOP_REQUESTED';
    }
  | {
      readonly next: 'HANDOFF';
      readonly actions: readonly ['STOP_AI', 'HANDOFF_TO_HUMAN', 'FLAG_COMPLAINT'];
      readonly suppressionReason: null;
    };

/**
 * Runs on every customer utterance before the AI is allowed to respond.
 * Precedence: stop request (suppression) > complaint (human) > normal flow.
 * The AI never gets a turn to persuade after either.
 */
export function handleCustomerTurn(state: ConversationState, utterance: string): SafetyDirective | null {
  const complaint = detectComplaint(utterance);
  const intent = detectStopIntent(utterance);

  if (intent.stop && canConversationTransition(state, 'STOPPING')) {
    return {
      next: 'STOPPING',
      actions: complaint
        ? ['PERSIST_SUPPRESSION', 'CONFIRM_STOP', 'END_CALL', 'FLAG_COMPLAINT']
        : ['PERSIST_SUPPRESSION', 'CONFIRM_STOP', 'END_CALL'],
      suppressionReason: intent.strength === 'EXPLICIT_DNC' ? 'DO_NOT_CALL' : 'STOP_REQUESTED',
    };
  }
  if (complaint && canConversationTransition(state, 'HANDOFF')) {
    return { next: 'HANDOFF', actions: ['STOP_AI', 'HANDOFF_TO_HUMAN', 'FLAG_COMPLAINT'], suppressionReason: null };
  }
  return null;
}

export type ConversationSession = {
  readonly state: ConversationState;
  readonly controller: 'AI' | 'HUMAN';
};

/** A human takeover is final for the conversation: there is deliberately no resumeAi(). */
export function takeOver(session: ConversationSession): ConversationSession {
  return session.controller === 'HUMAN' ? session : { ...session, controller: 'HUMAN' };
}

const AI_SILENT_STATES: ReadonlySet<ConversationState> = new Set(['STOPPING', 'HANDOFF', 'COMPLETED']);

export function canAiSpeak(session: ConversationSession): boolean {
  return session.controller === 'AI' && !AI_SILENT_STATES.has(session.state);
}
