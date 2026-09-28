import { useEffect, useState } from "react";

export type ViewerSession =
  | { status: "unknown" }
  | { status: "anonymous" }
  | { status: "signed-in"; userId: string };

/**
 * Whether the person looking at a public page is already signed in.
 *
 * The landing page is served to everyone, so it cannot resolve this on the
 * server without making the page uncacheable. It resolves after hydration
 * instead, and callers render the signed-out copy while the status is
 * "unknown" — that way the markup the crawler and the first paint both see is
 * the signed-out one, and a signed-in visitor only swaps a label.
 */
export function useViewerSession(): ViewerSession {
  const [session, setSession] = useState<ViewerSession>({ status: "unknown" });

  useEffect(() => {
    const abort = new AbortController();

    fetch("/api/user", { credentials: "include", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { id?: unknown } | null;
      })
      .then((body) => {
        if (abort.signal.aborted) return;
        const id = body && typeof body.id === "string" ? body.id : null;
        setSession(id ? { status: "signed-in", userId: id } : { status: "anonymous" });
      })
      .catch(() => {
        // A failed probe is indistinguishable from signed-out for this page's
        // purposes, and must never block rendering.
        if (!abort.signal.aborted) setSession({ status: "anonymous" });
      });

    return () => abort.abort();
  }, []);

  return session;
}
