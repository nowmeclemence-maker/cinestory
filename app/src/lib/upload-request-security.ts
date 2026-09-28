export interface UploadRequestRejection {
  status: 403 | 413;
  code: "invalid_origin" | "file_too_large";
  message: string;
}

/**
 * Reject unsafe/declared-oversize requests before multipart parsing buffers the
 * body. `label` names the kind of file in the size message, so the audio route
 * does not tell the user their audio file is too large an image.
 */
export function validateUploadRequestHeaders(
  request: Request,
  maxBytes: number,
  label = "Images",
): UploadRequestRejection | undefined {
  const origin = request.headers.get("origin");
  if (origin != null && origin !== new URL(request.url).origin) {
    return {
      status: 403,
      code: "invalid_origin",
      message: "Cross-site uploads are not allowed.",
    };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength != null) {
    const bytes = Number(declaredLength);
    if (Number.isFinite(bytes) && bytes > maxBytes) {
      return {
        status: 413,
        code: "file_too_large",
        message: `${label} must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.`,
      };
    }
  }
}
