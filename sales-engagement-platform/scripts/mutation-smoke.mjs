#!/usr/bin/env node
// Critical-mutant smoke test: applies hand-picked, safety-relevant mutations one at a time
// and asserts that the domain test suite FAILS for each. A surviving mutant means a safety
// rule (DNC, fail-closed, kill switch, terminal states…) is not actually protected by a test.
// See docs/DECISIONS.md ADR-0009 for why this replaces Stryker for now.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MUTANTS = [
  [
    'src/domain/suppression/suppression.ts',
    'if (entries.some((e) => e.reason === hard))',
    'if (!entries.some((e) => e.reason === hard))',
    'hard suppression check inverted',
  ],
  [
    'src/domain/suppression/suppression.ts',
    "if (all === 'UNAVAILABLE') return { decision: 'BLOCK', reason: 'SUPPRESSION_UNAVAILABLE' };",
    "if (all === 'UNAVAILABLE') return { decision: 'ALLOW' };",
    'suppression fails open',
  ],
  [
    'src/domain/suppression/suppression.ts',
    'now.getTime() < e.expiresAt.getTime()',
    'now.getTime() <= e.expiresAt.getTime()',
    'cooldown boundary',
  ],
  [
    'src/domain/suppression/suppression.ts',
    'const inScope = e.campaignId === null || e.campaignId === campaignId;',
    'const inScope = e.campaignId === campaignId;',
    'org-wide cooldown ignored',
  ],
  [
    'src/domain/outbound/outboundGuards.ts',
    "if (c.actor?.kind === 'AI_AGENT')",
    "if (c.actor?.kind === 'SYSTEM')",
    'AI agent may dial',
  ],
  [
    'src/domain/outbound/outboundGuards.ts',
    "(c.killSwitchEngaged ? deny('OUTBOUND_HALTED', 'KILL_SWITCH_ENGAGED') : PASS)",
    'PASS',
    'kill switch ignored',
  ],
  [
    'src/domain/outbound/outboundGuards.ts',
    'return remainingYen >= estimatedCostYen',
    'return remainingYen > estimatedCostYen',
    'budget boundary',
  ],
  [
    'src/domain/outbound/outboundGuards.ts',
    "if (remainingYen === null) return deny('BUDGET_EXCEEDED', 'BUDGET_UNKNOWN');",
    '',
    'unknown budget allowed',
  ],
  [
    'src/domain/outbound/outboundGuards.ts',
    "return { kind: 'DENY', guard: name, code: 'INTERNAL_ERROR', reason: 'GUARD_ERROR', trace };",
    'continue;',
    'guard error fails open',
  ],
  [
    'src/domain/outbound/outboundGuards.ts',
    "if (c.concurrency.contactHasActiveCall) return deny('CONFLICT', 'CONTACT_ALREADY_ON_CALL');",
    '',
    'double dial allowed',
  ],
  [
    'src/domain/outbound/outboundGuards.ts',
    "c.contact.consent === 'WITHDRAWN'",
    "c.contact.consent === 'GRANTED'",
    'consent inverted',
  ],
  ['src/domain/call/callStateMachine.ts', 'COMPLETED: [],', "COMPLETED: ['RINGING'],", 'terminal state re-opened'],
  [
    'src/domain/call/callStateMachine.ts',
    "HUMAN_ACTIVE: ['ENDING', 'FAILED'],",
    "HUMAN_ACTIVE: ['AI_ACTIVE', 'ENDING', 'FAILED'],",
    'human takeover reverted to AI',
  ],
  [
    'src/domain/conversation/conversation.ts',
    "STOPPING: ['COMPLETED'],",
    "STOPPING: ['OBJECTION', 'COMPLETED'],",
    'persuasion after stop',
  ],
  [
    'src/domain/conversation/conversation.ts',
    "INTRODUCTION: ['DISCLOSURE', ...EXITS],",
    "INTRODUCTION: ['DISCLOSURE', 'QUALIFICATION', ...EXITS],",
    'disclosure skipped',
  ],
  ['src/domain/conversation/conversation.ts', '/電話(を)?(し|かけ)(て(こ|く)ない|ない)で/,', '', 'stop phrase missed'],
  ['src/domain/outcome/outcome.ts', "NOT_INTERESTED: 'STOP_REQUESTED',", '', 're-solicitation after refusal'],
  [
    'src/domain/outcome/outcome.ts',
    'const mayFollowUp = !i.activeHardSuppression && suppression === null;',
    'const mayFollowUp = suppression === null;',
    'follow-up despite DNC',
  ],
  [
    'src/domain/contact/phoneNumber.ts',
    "if (NON_DIALABLE_PREFIXES.some((p) => national.startsWith(p))) return err('NON_DIALABLE_SERVICE');",
    '',
    'free-dial numbers dialable',
  ],
];

let survived = 0;
for (const [file, from, to, label] of MUTANTS) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes(from)) {
    console.error(`STALE  ${label}: pattern not found in ${file} — update the mutant`);
    survived++;
    continue;
  }
  writeFileSync(file, original.replace(from, to));
  try {
    const r = spawnSync('npx', ['vitest', 'run', 'src/domain', '--reporter=dot'], { encoding: 'utf8' });
    const killed = r.status !== 0;
    console.log(`${killed ? 'KILLED  ' : 'SURVIVED'} ${label}`);
    if (!killed) survived++;
  } finally {
    writeFileSync(file, original);
  }
}
console.log(`\n${MUTANTS.length - survived}/${MUTANTS.length} critical mutants killed`);
process.exit(survived === 0 ? 0 : 1);
