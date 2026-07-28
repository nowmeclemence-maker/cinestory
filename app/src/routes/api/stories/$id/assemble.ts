import { createFileRoute } from "@tanstack/react-router";
import { bindings } from "@/lib/bindings.server";
import { getStoryOwnerAndClips, markAssemblyStarted } from "@/lib/story-engine.server";

export const Route = createFileRoute("/api/stories/$id/assemble")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const containerToken = request.headers.get("x-hf-container-token");
        if (!containerToken) {
          return Response.json(
            { ok: false, error: "Missing container token." },
            { status: 401 },
          );
        }

        const storyId = params.id;
        const state = await getStoryOwnerAndClips(storyId);
        if (!state) {
          return Response.json({ ok: false, error: "Story not found." }, { status: 404 });
        }
        const { story, scenes } = state;
        const readyScenes = scenes
          .filter((scene) => scene.status === "ready" && scene.video_url)
          .sort((a, b) => a.idx - b.idx);
        if (readyScenes.length === 0) {
          return Response.json({ ok: false, error: "No finished scenes yet." }, { status: 409 });
        }

        const container = bindings().CONTAINER;
        if (!container) {
          return Response.json(
            { ok: false, error: "Assembly is not configured on this deployment." },
            { status: 503 },
          );
        }

        await markAssemblyStarted(storyId);

        const appBaseUrl = new URL(request.url).origin;
        const stub = container.getByName("cinestory-assembler");
        await stub.fetch("https://do/__keepalive/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jobId: storyId,
            containerToken,
            appBaseUrl,
            title: story.title,
            hook: story.hook,
            cta: story.cta,
            clips: readyScenes.map((scene) => ({
              url: scene.video_url,
              onScreenText: scene.on_screen_text ?? "",
            })),
          }),
        });

        return Response.json({ ok: true });
      },
    },
  },
});
