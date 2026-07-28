import "./lib/error-capture";

import { Container } from "@cloudflare/containers";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { applySecurityHeaders } from "./lib/security-headers.server";
import { bindings } from "./lib/bindings.server";

const MAX_JOB_MS = 30 * 60 * 1000; // 30 minutes hard deadline per assembly job
const BOOT_TIMEOUT_MS = 120_000; // patient cold-boot budget (background)
const POLL_TIMEOUT_MS = 6_000; // fast health-check once the container is up

/**
 * The shared ffmpeg assembly container (ONE instance for the whole app, per
 * the platform's container contract). Stitches a story's finished scene
 * clips into the final cut. See app/container/server.mjs + skills/containers.md.
 */
export class AppContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";

  private booting = false;

  private bg(p: Promise<unknown>) {
    (this as unknown as { ctx: { waitUntil: (p: Promise<unknown>) => void } }).ctx.waitUntil(p);
  }

  private running(): boolean {
    return Boolean(
      (this as unknown as { ctx?: { container?: { running?: boolean } } }).ctx?.container?.running,
    );
  }

  private async bootAndStart(job: Record<string, unknown>) {
    try {
      await this.containerFetch("http://c/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(job),
        signal: AbortSignal.timeout(BOOT_TIMEOUT_MS),
      });
    } catch (error) {
      console.log(`[AppContainer] bootAndStart ${job.jobId} threw ${error}`);
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/__keepalive/start") {
      const job = (await request.json()) as Record<string, unknown>;
      this.booting = true;
      this.bg(this.bootAndStart(job).finally(() => (this.booting = false)));
      this.schedule(1, "tick", { job, startedAt: Date.now() });
      return Response.json({ ok: true });
    }
    return super.fetch(request);
  }

  async tick(p: { job: Record<string, unknown>; startedAt: number }): Promise<void> {
    const env = bindings();
    const jobId = String(p.job.jobId);

    if (Date.now() - p.startedAt > MAX_JOB_MS) {
      await env.DB?.prepare(
        "UPDATE story_assembly_jobs SET status='timed_out' WHERE id=? AND status!='done'",
      )
        .bind(jobId)
        .run();
      await this.stopIfIdle();
      return;
    }

    const row = await env.DB?.prepare("SELECT status FROM story_assembly_jobs WHERE id=?")
      .bind(jobId)
      .first<{ status: string }>();
    if (!row || ["done", "error", "timed_out"].includes(row.status)) {
      await this.stopIfIdle();
      return;
    }

    this.renewActivityTimeout();

    if (!this.running()) {
      if (!this.booting) {
        this.booting = true;
        this.bg(this.bootAndStart(p.job).finally(() => (this.booting = false)));
      }
      this.schedule(3, "tick", p);
      return;
    }

    let status: { status?: string } | null = null;
    try {
      const response = await this.containerFetch(`http://c/status?jobId=${jobId}`, {
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
      const body = await response.text();
      if (response.ok && body.trimStart().startsWith("{")) status = JSON.parse(body);
    } catch (error) {
      console.log(`[AppContainer] status unreachable ${error}`);
    }

    if (!status) {
      this.schedule(3, "tick", p);
      return;
    }
    if (status.status === "unknown") {
      this.bg(this.bootAndStart(p.job));
      this.schedule(3, "tick", p);
      return;
    }
    if (status.status === "done" || status.status === "error") {
      await this.stopIfIdle();
      return;
    }
    this.schedule(5, "tick", p);
  }

  private async stopIfIdle() {
    const env = bindings();
    const row = await env.DB?.prepare(
      "SELECT COUNT(*) AS n FROM story_assembly_jobs WHERE status IN ('queued','running')",
    ).first<{ n: number }>();
    if (!row || row.n === 0) await this.stop().catch(() => {});
  }
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
