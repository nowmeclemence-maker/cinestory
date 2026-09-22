import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import { createServerFnf } from "../fnf.server";

export interface CreditTransaction {
  id: string;
  amount: number;
  type: "grant" | "spend" | "refund" | "purchase";
  description: string;
  referenceId: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  planId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

async function db(): Promise<D1Database | null> {
  try {
    const { bindings } = await import("../bindings.server");
    return bindings().DB ?? null;
  } catch { return null; }
}

async function ownerKey(): Promise<string> {
  try {
    const profile = createServerFnf().profile;
    const user = await profile.getUser();
    if (!user) throw new ApiJobError("auth_required", "Sign in required.", { status: 401 });
    const ws = await profile.getCurrentWorkspace().catch(() => null);
    return `user:${user.id}:workspace:${ws?.id ?? user.workspaceId ?? "personal"}`;
  } catch {
    if (import.meta.env.DEV) return "dev:local";
    throw new ApiJobError("auth_required", "Ser required.", { status: 401 });
  }
}

export async function getCreditBalance(): Promise<number> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return 100;
  const row = await database
    .prepare("SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE owner_key = ?")
    .bind(owner)
    .first<{ balance: number }>();
  return row?.balance ?? 0;
}

export async function getTransactions(limit = 50): Promise<CreditTransaction[]> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return [];
  const rows = await database
    .prepare("SELECT * FROM credit_transactions WHERE owner_key = ? ORDER BY created_at DESC LIMIT ?")
    .bind(owner, limit)
    .all();
  return (rows.results ?? []).map((r) => ({
    id: r.id as string,
    amount: r.amount as number,
    type: r.type as CreditTransaction["type"],
    description: (r.description as string) ?? "",
    referenceId: (r.reference_id as string) ?? "",
    createdAt: r.created_at as string,
  }));
}

export async function spendCredits(amount: number, description: string, referenceId?: string): Promise<void> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return;
  const balance = await getCreditBalance();
  if (balance < amount) throw new ApiJobError("insufficient_credits", "Not enough credits.", { status: 402 });
  await database
    .prepare("INSERT INTO credit_transactions (id, owner_key, amount, type, description, reference_id) VALUES (?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), owner, -amount, "spend", description, referenceId ?? null)
    .run();
}

export async function grantCredits(amount: number, description: string): Promise<void> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return;
  await database
    .prepare("INSERT INTO credit_transactions (id, owner_key, amount, type, description) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(), owner, amount, "grant", description)
    .run();
}

export async function getSubscription(): Promise<Subscription | null> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return null;
  const row = await database
    .prepare("SELECT * FROM subscriptions WHERE owner_key = ?")
    .bind(owner)
    .first();
  if (!row) return null;
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    stripeCustomerId: (row.stripe_customer_id as string) ?? "",
    stripeSubscriptionId: (row.stripe_subscription_id as string) ?? "",
    status: row.status as string,
    currentPeriodStart: (row.current_period_start as string) ?? "",
    currentPeriodEnd: (row.current_period_end as string) ?? "",
  };
}

/**
 * Choose a plan. Stripe checkout is not wired yet, so this persists the
 * selection as a 'requested' subscription row (the plan the user wants) —
 * see migration 0004 for the subscriptions table.
 */
export async function selectPlan(planId: string): Promise<Subscription> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  await database
    .prepare(
      `INSERT INTO subscriptions (id, owner_key, plan_id, status) VALUES (?, ?, ?, 'requested')
       ON CONFLICT(owner_key) DO UPDATE SET plan_id = excluded.plan_id, status = 'requested', updated_at = datetime('now')`,
    )
    .bind(crypto.randomUUID(), owner, planId)
    .run();
  const subscription = await getSubscription();
  if (!subscription) {
    throw new ApiJobError("plan_select_failed", "Could not save your plan.", { status: 500 });
  }
  return subscription;
}