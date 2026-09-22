import { ApiJobError } from "@higgsfield/fnf/errors";
import { inferContentType } from "@higgsfield/fnf/media";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFnf } from "@/lib/fnf.server";

const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

/** Multipart audio upload (music / voiceover) → durable Higgsfield media URL. */
export const Route = createFileRoute("/api/media/upload-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            return Response.json({ ok: false, error: { code: "invalid_file", message: "Choose an audio file to upload." } }, { status: 400 });
          }
          const contentType = inferContentType(file.name, file.type);
          if (!contentType.startsWith("audio/")) {
            return Response.json({ ok: false, error: { code: "invalid_file_type", message: "Only audio uploads are supported here." } }, { status: 415 });
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            return Response.json({ ok: false, error: { code: "file_too_large", message: "Audio files must be 60 MB or smaller." } }, { status: 413 });
          }
          const result = await createServerFnf().media.upload({
            source: new Uint8Array(await file.arrayBuffer()),
            type: "audio",
            filename: file.name,
            contentType,
            forceIpCheck: true,
          });
          const url = result.url ?? result.ref.url;
          if (!url) throw new ApiJobError("upload_missing_url", "Upload completed without a preview URL");
          return Response.json({ ok: true, url, name: file.name });
        } catch (error) {
          const payload =
            error instanceof ApiJobError
              ? error.toJSON()
              : { code: "upload_failed", message: error instanceof Error ? error.message : String(error) };
          return Response.json({ ok: false, error: payload }, { status: payload.status ?? 500 });
        }
      },
    },
  },
});