// Simple idempotency key management for mutation requests
const pendingKeys = new Set<string>();

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function acquireKey(key: string): boolean {
  if (pendingKeys.has(key)) return false;
  pendingKeys.add(key);
  return true;
}

export function releaseKey(key: string): void {
  pendingKeys.delete(key);
}
