-- CineStory Phase 1: duplicate-submission protection — distributed claim leases.
-- One row per claim key; only the request whose conditional upsert changes the
-- row may call the generation provider or start assembly.
-- Additive; runs once via d1_migrations.

CREATE TABLE IF NOT EXISTS claim_leases (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_claim_leases_expiry ON claim_leases (expires_at);