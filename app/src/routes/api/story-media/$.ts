import { createFileRoute } from "@tanstack/react-router";
import { bindings } from "@/lib/bindings.server";
import { requireCurrentUser } from "@/lib/auth.server";
import { getStoryOwnerAndClips, ownerKey } from "@/lib/story-engine.server";

/** Serves a story's final R2-hosted video/poster, gated to its owner. */
export const Route = createFileRoute("/api/story-media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const auth = await requireCurrentUser();
        if (!auth.ok) {
          return Response.json(auth.body, { status: auth.status });
        }
        const storage = bindings().STORAGE;
        if (!storage) {
          return Response.json({ error: "Storage is not configured." }, { status: 503 });
        }

        const key = params._splat ?? "";
        const match = /^stories\/([^/]+)\//.exec(key);
        if (!match) {
          return Response.json({ error: "Not found." }, { status: 404 });
        }
        const state = await getStoryOwnerAndClips(match[1]);
        const owner = await ownerKey();
        if (!state || state.story.owner_key !== owner) {
          return Response.json({ error: "Not found." }, { status: 404 });
        }

        const object = await storage.get(key);
        if (!object) {
          return Response.json({ error: "Not found." }, { status: 404 });
        }
        return new Response(object.body as unknown as ReadableStream, {
          headers: {
            "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
            "cache-control": "private, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
