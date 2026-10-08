/**
 * Suppression policy (DNC and friends). Pure: the caller performs the lookup and passes
 * its outcome in, including the case where the lookup itself failed.
 *
 * Invariants:
 *  - Fail closed: anything other than a well-formed, successful lookup with no applicable
 *    entry yields BLOCK. Missing or corrupt data is never permission to call.
 *  - Hard reasons are organization-wide and never lapse by time.
 *  - There is deliberately no override parameter: a hard block cannot be bypassed here.
 */

export const HARD_REASONS = ['LEGAL_BLOCK', 'PRIVACY_BLOCK', 'DO_NOT_CALL', 'STOP_REQUESTED'] as const;
export type HardReason = (typeof HARD_REASONS)[number];
export type SoftReason = 'COOLDOWN' | 'HUMAN_REQUIRED';
export type SuppressionReason = HardReason | SoftReason;

export type SuppressionEntry = {
  readonly phoneE164: string;
  readonly reason: SuppressionReason;
  /** null = organization-wide. Ignored for hard reasons (always organization-wide). */
  readonly campaignId: string | null;
  /** Only honoured for COOLDOWN. */
  readonly expiresAt: Date | null;
};

export type SuppressionLookup =
  { readonly status: 'FOUND'; readonly entries: readonly SuppressionEntry[] } | { readonly status: 'UNAVAILABLE' };

export type SuppressionDecision =
  | { readonly decision: 'ALLOW' }
  | {
      readonly decision: 'BLOCK';
      readonly reason: HardReason | 'COOLDOWN' | 'SUPPRESSION_UNAVAILABLE' | 'SUPPRESSION_DATA_INVALID';
    }
  | { readonly decision: 'HUMAN_REVIEW'; readonly reason: 'HUMAN_REQUIRED' };

export type SuppressionQuery = {
  readonly lookup: SuppressionLookup;
  readonly phoneE164: string;
  readonly campaignId: string;
  readonly now: Date;
};

const KNOWN_REASONS: ReadonlySet<string> = new Set<SuppressionReason>([...HARD_REASONS, 'COOLDOWN', 'HUMAN_REQUIRED']);

function cooldownApplies(e: SuppressionEntry, campaignId: string, now: Date): boolean {
  const inScope = e.campaignId === null || e.campaignId === campaignId;
  const active = e.expiresAt === null || now.getTime() < e.expiresAt.getTime();
  return inScope && active;
}

/** Runtime shape check: the lookup crosses an I/O boundary, so its type is a claim, not a fact. */
function entriesOf(lookup: SuppressionLookup): readonly SuppressionEntry[] | 'UNAVAILABLE' | 'INVALID' {
  const raw = lookup as { status?: unknown; entries?: unknown };
  if (raw.status === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (raw.status !== 'FOUND' || !Array.isArray(raw.entries)) return 'INVALID';
  return raw.entries as readonly SuppressionEntry[];
}

export function evaluateSuppression(q: SuppressionQuery): SuppressionDecision {
  const all = entriesOf(q.lookup);
  if (all === 'UNAVAILABLE') return { decision: 'BLOCK', reason: 'SUPPRESSION_UNAVAILABLE' };
  if (all === 'INVALID') return { decision: 'BLOCK', reason: 'SUPPRESSION_DATA_INVALID' };

  const entries = all.filter((e) => e.phoneE164 === q.phoneE164);
  if (entries.some((e) => !KNOWN_REASONS.has(e.reason))) {
    return { decision: 'BLOCK', reason: 'SUPPRESSION_DATA_INVALID' };
  }

  // Strongest hard reason first (HARD_REASONS is ordered by severity).
  for (const hard of HARD_REASONS) {
    if (entries.some((e) => e.reason === hard)) return { decision: 'BLOCK', reason: hard };
  }
  if (entries.some((e) => e.reason === 'COOLDOWN' && cooldownApplies(e, q.campaignId, q.now))) {
    return { decision: 'BLOCK', reason: 'COOLDOWN' };
  }
  if (entries.some((e) => e.reason === 'HUMAN_REQUIRED')) {
    return { decision: 'HUMAN_REVIEW', reason: 'HUMAN_REQUIRED' };
  }
  return { decision: 'ALLOW' };
}
