import { describe, expect, it } from 'vitest';
import {
  canAiSpeak,
  canConversationTransition,
  detectComplaint,
  handleCustomerTurn,
  takeOver,
  type ConversationSession,
} from './conversation.js';

describe('PERMISSION state (「今お時間よろしいですか」)', () => {
  it('DISCLOSURE → PERMISSION → IDENTIFICATION is the only path into sales', () => {
    expect(canConversationTransition('DISCLOSURE', 'PERMISSION')).toBe(true);
    expect(canConversationTransition('DISCLOSURE', 'IDENTIFICATION')).toBe(false);
    expect(canConversationTransition('PERMISSION', 'IDENTIFICATION')).toBe(true);
    expect(canConversationTransition('PERMISSION', 'QUALIFICATION')).toBe(false);
  });

  it('a refusal at PERMISSION stops the call', () => {
    expect(handleCustomerTurn('PERMISSION', 'いえ、結構です')).toMatchObject({ next: 'STOPPING' });
  });
});

describe('COMPLAINT', () => {
  it.each(['しつこいんだけど', 'クレームを入れます', '消費者センターに相談します', '責任者を出して', 'ふざけるな'])(
    '%s is a complaint',
    (t) => {
      expect(detectComplaint(t)).toBe(true);
    },
  );

  it.each(['少し考えます', '資料を見てから決めます', ''])('%j is not a complaint', (t) => {
    expect(detectComplaint(t)).toBe(false);
  });

  it('complaint without a stop request → AI stops and hands off to a human (no further sales)', () => {
    expect(handleCustomerTurn('OBJECTION', '責任者を出して')).toEqual({
      next: 'HANDOFF',
      actions: ['STOP_AI', 'HANDOFF_TO_HUMAN', 'FLAG_COMPLAINT'],
      suppressionReason: null,
    });
  });

  it('complaint + stop request → stop wins (DNC) and the complaint is still flagged', () => {
    expect(handleCustomerTurn('DISCOVERY', 'しつこい。もう電話しないで')).toEqual({
      next: 'STOPPING',
      actions: ['PERSIST_SUPPRESSION', 'CONFIRM_STOP', 'END_CALL', 'FLAG_COMPLAINT'],
      suppressionReason: 'DO_NOT_CALL',
    });
  });

  it('complaint during HANDOFF does not re-trigger a handoff', () => {
    expect(handleCustomerTurn('HANDOFF', '責任者を出して')).toBeNull();
  });
});

describe('human takeover stops the AI', () => {
  const ai: ConversationSession = { state: 'DISCOVERY', controller: 'AI' };

  it('AI may speak while it controls an active conversation', () => {
    expect(canAiSpeak(ai)).toBe(true);
  });

  it('after takeover the AI can never speak again in that conversation', () => {
    const human = takeOver(ai);
    expect(human.controller).toBe('HUMAN');
    expect(canAiSpeak(human)).toBe(false);
    expect(canAiSpeak({ ...human, state: 'FAQ' })).toBe(false);
  });

  it('takeover is idempotent and does not mutate the input', () => {
    const once = takeOver(ai);
    expect(takeOver(once)).toEqual(once);
    expect(ai.controller).toBe('AI');
  });

  it.each(['STOPPING', 'HANDOFF', 'COMPLETED'] as const)('AI may not speak in %s', (state) => {
    expect(canAiSpeak({ state, controller: 'AI' })).toBe(false);
  });
});
