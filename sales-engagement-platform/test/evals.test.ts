import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CONVERSATION_STATES, handleCustomerTurn } from '../src/domain/conversation/conversation.js';

/**
 * Evaluates the deterministic safety layer that runs before the AI may respond:
 * stop-intent detection and the forced STOPPING transition. Asserts policy behaviour
 * (stop / suppression reason / forbidden persuasion), never exact wording.
 */
const Case = z.object({
  id: z.string(),
  state: z.enum(CONVERSATION_STATES),
  utterance: z.string(),
  expect: z.object({
    stop: z.boolean(),
    suppressionReason: z.enum(['DO_NOT_CALL', 'STOP_REQUESTED']).optional(),
  }),
  note: z.string().optional(),
});

const REQUIRED_CATEGORIES = [
  'normal',
  'interested',
  'rejection',
  'dnc',
  'objection',
  'scheduling',
  'handoff',
  'adversarial',
];
const root = join(import.meta.dirname, '..', 'evals');
const categories = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe('eval dataset', () => {
  it('contains every required category', () => {
    for (const c of REQUIRED_CATEGORIES) expect(categories).toContain(c);
  });
});

for (const category of categories) {
  const cases = z.array(Case).parse(JSON.parse(readFileSync(join(root, category, 'cases.json'), 'utf8')));
  describe(`evals/${category}`, () => {
    it.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
      const directive = handleCustomerTurn(c.state, c.utterance);
      if (!c.expect.stop) {
        expect(directive).toBeNull();
        return;
      }
      // Required behaviour: stop, persist suppression, confirm, end. Forbidden: any further sales turn.
      expect(directive).not.toBeNull();
      expect(directive?.next).toBe('STOPPING');
      expect(directive?.actions).toEqual(['PERSIST_SUPPRESSION', 'CONFIRM_STOP', 'END_CALL']);
      expect(directive?.suppressionReason).toBe(c.expect.suppressionReason);
    });
  });
}
