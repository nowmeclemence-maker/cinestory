import { describe, expect, test } from "bun:test";
import {
  acquireClaim,
  CLAIM_LEASE_MS,
  d1ClaimStore,
  isClaimToken,
  makeClaimToken,
  releaseClaim,
  withClaim,
  type ClaimStore,
} from "@/lib/story-claims";

/** In-memory store with SQLite-like upsert semantics (insert win, takeover on expiry). */
class FakeClaimStore implements ClaimStore {
  rows = new Map<string, { token: string | null; expiresAt: number }>();

  async acquire(key: string, token: string, expiresAt: number, now: number): Promise<boolean> {
    const existing = this.rows.get(key);
    if (!existing || existing.token === null || existing.expiresAt <= now) {
      this.rows.set(key, { token, expiresAt });
      return true;
    }
    return false;
  }

  async release(key: string, token: string): Promise<boolean> {
    const existing = this.rows.get(key);
    if (existing && existing.token === token) {
      this.rows.delete(key);
      return true;
    }
    return false;
  }
}

// A tiny D1-like that accepts the adapter's two SQL statements.
class FakeD1Like {
  store = new FakeClaimStore();

  prepare(sql: string) {
    return {
      bind: (...params: unknown[]) => ({
        run: async () => {
          const [key, token, expiresAt, now] = params as [string, string, number, number];
          const insert = sql.includes("INSERT INTO claim_leases");
          if (insert) {
            const acquired = await this.store.acquire(
              key,
              token,
              expiresAt,
              now ?? Date.now(),
            );
            return { meta: { changes: acquired ? 1 : 0 } };
          }
          const released = await this.store.release(key, token);
          return { meta: { changes: released ? 1 : 0 } };
        },
      }),
    };
  }
}

const NOW = 1_700_000_000_000;

describe("story-claims (Phase 1 duplicate-submission protection)", () => {
  test("acquireClaim wins a fresh claim and issues a claim: token", async () => {
    const store = new FakeClaimStore();
    const result = await acquireClaim(store, "story:s:videos", CLAIM_LEASE_MS, NOW);
    expect(result.ok).toBe(true);
    expect(result.claim).not.toBeNull();
    expect(result.claim!.key).toBe("story:s:videos");
    expect(isClaimToken(result.claim!.token)).toBe(true);
    expect(result.claim!.expiresAt).toBe(NOW + CLAIM_LEASE_MS);
  });

  test("a second acquire for the same key LOSES while the lease is live", async () => {
    const store = new FakeClaimStore();
    await acquireClaim(store, "scene:s:1:image", CLAIM_LEASE_MS, NOW);
    const second = await acquireClaim(store, "scene:s:1:image", CLAIM_LEASE_MS, NOW + 30_000);
    expect(second.ok).toBe(false);
    expect(second.claim).toBeNull();
  });

  test("an EXPIRED claim is taken over by CAS (the new request wins)", async () => {
    const store = new FakeClaimStore();
    await acquireClaim(store, "character:c:portrait", CLAIM_LEASE_MS, NOW);
    const takeover = await acquireClaim(
      store,
      "character:c:portrait",
      CLAIM_LEASE_MS,
      NOW + CLAIM_LEASE_MS + 1, // lease expired
    );
    expect(takeover.ok).toBe(true);
  });

  test("releaseClaim is compare-and-swap: only the holder's token releases", async () => {
    const store = new FakeClaimStore();
    const holder = await acquireClaim(store, "story:s:images", CLAIM_LEASE_MS, NOW);
    expect(holder.ok).toBe(true);

    const wrongToken = { key: "story:s:images", token: makeClaimToken(NOW, crypto.randomUUID()), expiresAt: NOW };
    expect(await releaseClaim(store, wrongToken)).toBe(false); // CAS release fails

    expect(await releaseClaim(store, holder.claim)).toBe(true); // holder releases
    expect(await releaseClaim(store, holder.claim)).toBe(false); // already gone
  });

  test("withClaim runs work only while the claim is held; a concurrent holder loses", async () => {
    const store = new FakeClaimStore();
    const calls: string[] = [];

    // Request A holds the claim (in-flight submit), request B arrives concurrently.
    const held = await acquireClaim(store, "hyper:1", CLAIM_LEASE_MS, NOW);
    expect(held.ok).toBe(true);

    const loser = await withClaim(store, "hyper:1", async () => {
      calls.push("loser");
      return "done";
    }, CLAIM_LEASE_MS, NOW);
    expect(loser).toBeNull(); // concurrent duplicate did NOT run
    expect(calls).toEqual([]);

    // A commits (releases); a later request may proceed.
    expect(await releaseClaim(store, held.claim)).toBe(true);
    const next = await withClaim(store, "hyper:1", async () => {
      calls.push("winner");
      return "done";
    }, CLAIM_LEASE_MS, NOW);
    expect(next).toBe("done");
    expect(calls).toEqual(["winner"]);
  });

  test("claim is released on failure (compare-and-swap release-on-failure)", async () => {
    const store = new FakeClaimStore();
    await expect(
      withClaim(store, "story:s:videos", async () => {
        throw new Error("provider failed");
      }),
    ).rejects.toThrow("provider failed");
    // claim released → a later request can take it immediately
    const retry = await acquireClaim(store, "story:s:videos", CLAIM_LEASE_MS, NOW);
    expect(retry.ok).toBe(true);
  });

  test("token format round-trips", () => {
    expect(makeClaimToken(1234, "00000000-0000-4000-8000-000000000000")).toBe(
      "claim:1234:00000000-0000-4000-8000-000000000000",
    );
    expect(isClaimToken("claim:1234:00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isClaimToken("garbage")).toBe(false);
  });

  test("d1ClaimStore adapter implements the same protocol over a D1-like", async () => {
    const d1 = new FakeD1Like();
    const store = d1ClaimStore(d1 as never);
    const first = await acquireClaim(store, "assembly:story-1", CLAIM_LEASE_MS, NOW);
    const second = await acquireClaim(store, "assembly:story-1", CLAIM_LEASE_MS, NOW + 5_000);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);

    // takeover after expiry through the adapter
    const takeover = await acquireClaim(store, "assembly:story-1", CLAIM_LEASE_MS, NOW + CLAIM_LEASE_MS + 1);
    expect(takeover.ok).toBe(true);
    expect(await releaseClaim(store, takeover.claim)).toBe(true);
  });
});