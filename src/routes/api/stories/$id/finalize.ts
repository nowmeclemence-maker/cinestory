import { createFileRoute } from "@tanstack/react-router";
import { bindings } from "@/lib/bindings.server";
import { failStory, finalizeStory } from "@/lib/story-engine.server";

/**
 * Called by the ffmpeg assembly container once a story's final cut is ready
 * (see app/container/server.mjs). Authenticated by the short-lived container
 * token minted at kickoff — the platform resolves the viewer for the
 * container->app hop; we only need to confirm the header is present.
 */
export const Route = createFileRoute("/api/stories/$id/finalize")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const storage = bindings().STORAGE;
        if (!storage) {
          return Response.json({ ok: false, error: "Storage is not configured." }, { status: 503 });
        }

        const storyId = params.id;
        try {
          const form = await request.formData();
          const error = form.get("error");
          if (typeof error === "string" && error.length > 0) {
            await failStory(storyId, error);
            return Response.json({ ok: true });
          }

          const video = form.get("video");
          const poster = form.get("poster");
          if (!(video instanceof File)) {
            return Response.json({ ok: false, error: "Missing final video." }, { status: 400 });
          }

          const videoKey = `stories/${storyId}/final.mp4`;
          await storage.put(videoKey, await video.arrayBuffer(), {
            httpMetadata: { contentType: "video/mp4" },
          });

          let posterKey: string | null = null;
          if (poster instanceof File) {
            posterKey = `stories/${storyId}/poster.jpg`;
            await storage.put(posterKey, await poster.arrayBuffer(), {
              httpMetadata: { contentType: "image/jpeg" },
            });
          }

          await finalizeStory(storyId, videoKey, posterKey);
          return Response.json({ ok: true });
        } catch (err) {
          await failStory(storyId, err instanceof Error ? err.message : "Assembly failed.");
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
