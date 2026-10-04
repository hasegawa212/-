import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import {
  CONVERSATION_STATES,
  canConversationTransition,
  detectStopIntent,
  handleCustomerTurn,
  transitionConversation,
  type ConversationState,
} from './conversation.js';

const SALES: ConversationState[] = ['QUALIFICATION', 'DISCOVERY', 'FAQ', 'OBJECTION', 'INTERESTED', 'SCHEDULING'];

describe('conversation state machine', () => {
  it('INTRODUCTION must go through DISCLOSURE (商号・氏名・勧誘目的の告知) before any sales state', () => {
    for (const s of SALES) expect(canConversationTransition('INTRODUCTION', s), s).toBe(false);
    expect(canConversationTransition('INTRODUCTION', 'DISCLOSURE')).toBe(true);
    for (const s of SALES) expect(canConversationTransition('DISCLOSURE', s), s).toBe(false);
    expect(canConversationTransition('DISCLOSURE', 'IDENTIFICATION')).toBe(true);
  });

  it('STOPPING is reachable from every non-terminal state', () => {
    for (const s of CONVERSATION_STATES) {
      if (s === 'STOPPING' || s === 'COMPLETED') continue;
      expect(canConversationTransition(s, 'STOPPING'), s).toBe(true);
    }
  });

  it('STOPPING can only end — no persuasion, no handoff to sales after a stop request', () => {
    for (const s of CONVERSATION_STATES) {
      expect(canConversationTransition('STOPPING', s), s).toBe(s === 'COMPLETED');
    }
  });

  it('COMPLETED is terminal', () => {
    for (const s of CONVERSATION_STATES) expect(canConversationTransition('COMPLETED', s)).toBe(false);
  });

  it('HANDOFF is reachable from active states and can only stop or end', () => {
    expect(canConversationTransition('OBJECTION', 'HANDOFF')).toBe(true);
    expect(canConversationTransition('INTRODUCTION', 'HANDOFF')).toBe(true);
    for (const s of CONVERSATION_STATES) {
      expect(canConversationTransition('HANDOFF', s), s).toBe(s === 'COMPLETED' || s === 'STOPPING');
    }
  });

  it('INTERESTED → SCHEDULING → COMPLETED', () => {
    expect(canConversationTransition('INTERESTED', 'SCHEDULING')).toBe(true);
    expect(canConversationTransition('SCHEDULING', 'COMPLETED')).toBe(true);
    expect(canConversationTransition('IDENTIFICATION', 'SCHEDULING')).toBe(false);
  });

  it('illegal transition throws INVALID_STATE_TRANSITION', () => {
    expect(() => transitionConversation('STOPPING', 'OBJECTION')).toThrow(DomainError);
    expect(transitionConversation('INTRODUCTION', 'DISCLOSURE')).toBe('DISCLOSURE');
  });
});

describe('detectStopIntent', () => {
  it.each([
    ['もう電話しないでください', 'EXPLICIT_DNC'],
    ['二度とかけてこないで', 'EXPLICIT_DNC'],
    ['電話をかけないでください', 'EXPLICIT_DNC'],
    ['電話をしないでほしい', 'EXPLICIT_DNC'],
    ['連絡不要です', 'EXPLICIT_DNC'],
    ['リストから消してください', 'EXPLICIT_DNC'],
    ['迷惑なのでやめてください', 'EXPLICIT_DNC'],
    ['営業電話はお断りです', 'EXPLICIT_DNC'],
    ['Please stop calling me', 'EXPLICIT_DNC'],
    ['do not call this number again', 'EXPLICIT_DNC'],
    ['もう結構です', 'REFUSAL'],
    ['いえ、結構です', 'REFUSAL'],
    ['興味ないです', 'REFUSAL'],
    ['興味がありません', 'REFUSAL'],
    ['必要ありません', 'REFUSAL'],
    ['いらないです', 'REFUSAL'],
    ['ｹｯｺｳﾃﾞｽ', 'REFUSAL'],
    ['not interested', 'REFUSAL'],
  ])('%s → %s', (text, strength) => {
    expect(detectStopIntent(text)).toMatchObject({ stop: true, strength });
  });

  it.each([
    'はい、その時間で結構です',
    'ソノ時間デケッコウデス',
    '水曜日の午後で結構ですよ',
    'もう少し詳しく聞きたいです',
    '電話番号は090で始まります',
    '資料を送ってもらえますか',
    '',
  ])('%j is not a stop request', (text) => {
    expect(detectStopIntent(text)).toEqual({ stop: false });
  });

  it('explicit DNC wins when both kinds appear', () => {
    expect(detectStopIntent('結構です、もう電話しないで')).toMatchObject({ strength: 'EXPLICIT_DNC' });
  });
});

describe('handleCustomerTurn — stop overrides the sales flow', () => {
  it.each(SALES)('stop request during %s → STOPPING + persist DNC + confirm + end', (state) => {
    expect(handleCustomerTurn(state, 'もう電話しないで')).toEqual({
      next: 'STOPPING',
      actions: ['PERSIST_SUPPRESSION', 'CONFIRM_STOP', 'END_CALL'],
      suppressionReason: 'DO_NOT_CALL',
    });
  });

  it('a refusal maps to STOP_REQUESTED suppression', () => {
    expect(handleCustomerTurn('OBJECTION', '興味ないです')).toMatchObject({
      next: 'STOPPING',
      suppressionReason: 'STOP_REQUESTED',
    });
  });

  it('applies even before disclosure is finished', () => {
    expect(handleCustomerTurn('INTRODUCTION', '電話しないで')).toMatchObject({ next: 'STOPPING' });
  });

  it('no stop intent → no forced change', () => {
    expect(handleCustomerTurn('DISCOVERY', '今は賃貸に住んでいます')).toBeNull();
  });

  it('already stopping/completed → idempotent (no duplicate actions)', () => {
    expect(handleCustomerTurn('STOPPING', '電話しないで')).toBeNull();
    expect(handleCustomerTurn('COMPLETED', '電話しないで')).toBeNull();
  });

  it('during HANDOFF a stop request still stops (safety beats the transfer)', () => {
    expect(handleCustomerTurn('HANDOFF', '電話しないで')).toMatchObject({
      next: 'STOPPING',
      suppressionReason: 'DO_NOT_CALL',
    });
  });
});
