import { describe, expect, it } from 'vitest';
import { mapTacDisposition, mapTacFollowCategory } from './tacMapping.js';

describe('mapTacDisposition — current TAC 5 buttons (mobile_app.py DISPOSITIONS)', () => {
  it.each([
    ['成約', 'WON'],
    ['検討', 'CONSIDERING'],
    ['折り返し', 'CALLBACK_REQUESTED'],
    ['不在', 'NOT_REACHED_NO_ANSWER'],
    ['拒否', 'REFUSED_DO_NOT_CALL'],
  ])('%s → %s', (label, outcome) => {
    expect(mapTacDisposition(label)).toEqual({ ok: true, value: outcome });
  });

  it('tolerates surrounding whitespace and full-width spaces', () => {
    expect(mapTacDisposition('　拒否 ')).toEqual({ ok: true, value: 'REFUSED_DO_NOT_CALL' });
  });

  it.each(['', 'アポ', 'NG', 'kyohi', '拒否します'])('%j is not guessed — rejected', (label) => {
    expect(mapTacDisposition(label)).toEqual({ ok: false, reason: 'UNKNOWN_DISPOSITION' });
  });
});

describe('mapTacFollowCategory — follow ledger categories (followup.py CATEGORIES)', () => {
  it.each([
    ['再調整希望', { kind: 'CALLABLE', followUpType: 'CALLBACK' }],
    ['日程返答待ち', { kind: 'CALLABLE', followUpType: 'FOLLOW_UP' }],
    ['不在', { kind: 'CALLABLE', followUpType: 'RETRY' }],
    ['要確認', { kind: 'HUMAN_REVIEW' }],
    ['連絡停止', { kind: 'SUPPRESS', reason: 'STOP_REQUESTED' }],
  ])('%s', (cat, expected) => {
    expect(mapTacFollowCategory(cat)).toEqual({ ok: true, value: expected });
  });

  it('連絡停止 always becomes a hard suppression (audit R13: it was not added to DNC)', () => {
    const r = mapTacFollowCategory('連絡停止');
    expect(r.ok && r.value.kind).toBe('SUPPRESS');
  });

  it('unknown category is rejected, never treated as callable', () => {
    expect(mapTacFollowCategory('連絡予定')).toEqual({ ok: false, reason: 'UNKNOWN_CATEGORY' });
  });
});
