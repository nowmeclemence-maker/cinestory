/**
 * Phase 1 — duplicate-submission protection.
 *
 * A tiny, dependency-free distributed-claim layer over D1 that serializes
 * every path that submits a PAID Higgsfield job or starts assembly. Only the
 * request that WINS the compare-and-swap (CAS) may call the provider; every
 * concurrent duplicate is a silent no-op.
 *
 * Protocol:
 *   - claim token  `claim:<expiryMs>:<uuid>`
 *   - 3-minute lease (CLAIM_LEASE_MS)
 *   - acquire = one conditional upsert whose `meta.changes` decides the winner
 *   - expired claims are taken over by CAS (same upsert, WHERE expiry < now)
 *   - commit / release-on-failure = CAS delete (only the token holder wins)
 *
 * The module itself is SQL-agnostic: it speaks to a `ClaimStore` (two atomic
 * ops). `d1ClaimStore()` adapts D1. This keeps the logic unit-testable with an
 * in-memory store and dependency-free (no cloudflare types at runtime).
 */

export const CLAIM_LEASE_MS = 3 * 60 * 1000; // 3-minute lease

export interface ClaimToken {
  /** Claim id / key, e.g. `story:<id>:videos`. */
  key: string;
  /** Opaque bearer `claim:<expiryMs>:<uuid>`. */
  token: string;
  expiresAt: number;
}

/**
 * Two atomic operations. The D1 adapter implements them as single statements,
 * so a concurrent request either wins or loses — no read-then-write races.
 */
export interface ClaimStore {
  /**
   * Insert the claim, or replace an EXPIRED claim. Returns true only for the
   * request whose write actually changed the row.
   */
  acquire(key: string, token: string, expiresAt: number, now: number): Promise<boolean>;
  /** Delete the row only when the token still matches (CAS release). */
  release(key: string, token: string): Promise<boolean>;
}

export interface MaybeClaimResult {
  ok: boolean;
  claim: ClaimToken | null;
}

/** Build a claim token: `claim:<expiryMs>:<uuid>`. */
export function makeClaimToken(expiryMs: number, uuid: string): string {
  return `claim:${expiryMs}:${uuid}`;
}

export function isClaimToken(value: string): boolean {
  return /^claim:\d+:[0-9a-f-]{36}$/i.test(value);
}

/** Try to win `key` for `leaseMs` milliseconds. Only the winner may proceed. */
export async function acquireClaim(
  store: ClaimStore,
  key: string,
  leaseMs: number = CLAIM_LEASE_MS,
  now: number = Date.now(),
): Promise<MaybeClaimResult> {
  const expiresAt = now + leaseMs;
  const token = makeClaimToken(expiresAt, crypto.randomUUID());
  const ok = await store.acquire(key, token, expiresAt, now);
  if (!ok) return { ok: false, claim: null };
  return { ok: true, claim: { key, token, expiresAt } };
}

/**
 * Compare-and-swap release. Safe to call on success (commit) or in a finally
 * after a failure — only the claim's own token can release it, so it never
 * un-claims another request's work.
 */
export async function releaseClaim(store: ClaimStore, claim: ClaimToken | null): Promise<boolean> {
  if (!claim) return true;
  return store.release(claim.key, claim.token);
}

/**
 * Hold a claim across an async operation: acquire, run, then release commit /
 * release-on-failure. Returns the result of `work` when the claim was won,
 * or `null` when another request already owns the claim.
 */
export async function withClaim<T>(
  store: ClaimStore,
  key: string,
  work: () => Promise<T>,
  leaseMs: number = CLAIM_LEASE_MS,
  now: number = Date.now(),
): Promise<T | null> {
  const acquired = await acquireClaim(store, key, leaseMs, now);
  if (!acquired.ok) return null;
  try {
    return await work();
  } finally {
    await releaseClaim(store, acquired.claim);
  }
}

// ─── D1 adapter ──────────────────────────────────────────────────────────────

export interface D1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
}

/**
 * Adapter over D1. Both operations are single atomic statements:
 *
 *   acquire — `INSERT … ON CONFLICT(id) DO UPDATE SET token=excluded.token,
 *             expires_at=excluded.expires_at WHERE expires_at <= now`
 *             → `meta.changes === 1` only for the insert or the takeover.
 *   release — `DELETE FROM claim_leases WHERE id = ? AND token = ?`
 *             → `meta.changes === 1` only for the token holder.
 */
export function d1ClaimStore(db: D1Like): ClaimStore {
  return {
    async acquire(key, token, expiresAt, now): Promise<boolean> {
      const result = await db
        .prepare(
          `INSERT INTO claim_leases (id, token, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
           WHERE claim_leases.expires_at <= ?`,
        )
        .bind(key, token, expiresAt, now)
        .run();
      return result.meta.changes === 1;
    },
    async release(key, token): Promise<boolean> {
      const result = await db
        .prepare("DELETE FROM claim_leases WHERE id = ? AND token = ?")
        .bind(key, token)
        .run();
      return result.meta.changes === 1;
    },
  };
}

/**
 * Per-isolate in-memory store — dev fallback when D1 is unavailable. Same CAS
 * semantics; loses its guarantees across isolates (acceptable only in dev).
 */
export function inMemoryClaimStore(): ClaimStore {
  const rows = new Map<string, { token: string | null; expiresAt: number }>();
  return {
    async acquire(key, token, expiresAt, now): Promise<boolean> {
      const existing = rows.get(key);
      if (!existing || existing.token === null || existing.expiresAt <= now) {
        rows.set(key, { token, expiresAt });
        return true;
      }
      return false;
    },
    async release(key, token): Promise<boolean> {
      const existing = rows.get(key);
      if (existing && existing.token === token) {
        rows.delete(key);
        return true;
      }
      return false;
    },
  };
}