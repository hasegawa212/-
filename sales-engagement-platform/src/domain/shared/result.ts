/** Expected domain outcomes are values, not exceptions. Exceptions are for broken invariants. */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: E };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
export const err = <E>(reason: E): { ok: false; reason: E } => ({ ok: false, reason });
