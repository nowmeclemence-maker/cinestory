import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildFilterComplex } from "./filter-graph.mjs";

const run = promisify(execFile);
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

// ONE shared container serves ALL jobs -> state MUST be per-job, not global.
const jobs = new Map(); // jobId -> { status, progress, error }

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://c");

    if (req.method === "POST" && url.pathname === "/start") {
      const job = await readJson(req);
      if (jobs.get(job.jobId)?.status === "running") {
        res.writeHead(202).end("running");
        return;
      }
      jobs.set(job.jobId, { status: "running", progress: 0, error: null });
      res.writeHead(202).end("started");
      runJob(job).catch((error) => {
        console.error(`[CTR] job ${job.jobId} failed`, error);
        jobs.set(job.jobId, { status: "error", progress: 0, error: String(error?.message ?? error) });
      });
      return;
    }

    if (url.pathname === "/status") {
      const jobId = url.searchParams.get("jobId");
      const state = jobs.get(jobId) ?? { status: "unknown" };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(state));
      return;
    }

    res.writeHead(404).end();
  })
  .listen(8080, () => console.log("[CTR] CineStory assembler listening on 8080"));

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed (${response.status}): ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await fsp.writeFile(destPath, bytes);
}

async function runJob(job) {
  const { jobId, clips, hook, cta, appBaseUrl, containerToken, musicUrl, voiceoverUrl } = job;
  const dir = `/tmp/${jobId}`;
  await fsp.mkdir(dir, { recursive: true });
  jobs.set(jobId, { status: "running", progress: 5, error: null });

  try {
    const clipPaths = [];
    for (let i = 0; i < clips.length; i++) {
      const dest = path.join(dir, `clip_${i}.mp4`);
      await downloadFile(clips[i].url, dest);
      clipPaths.push(dest);
      jobs.set(jobId, { status: "running", progress: 5 + Math.round((i / clips.length) * 30), error: null });
    }

    const extraInputs = []; // [ "-i", path, ... ]
    let musicPath = null;
    let voiceoverPath = null;
    if (musicUrl) {
      musicPath = path.join(dir, "music.m4a");
      await downloadFile(musicUrl, musicPath);
      extraInputs.push("-i", musicPath);
    }
    if (voiceoverUrl) {
      voiceoverPath = path.join(dir, "voiceover.m4a");
      await downloadFile(voiceoverUrl, voiceoverPath);
      extraInputs.push("-i", voiceoverPath);
    }
    const { filterComplex, finalAudioLabel } = buildFilterComplex({
      clips,
      font: FONT,
      hook,
      cta,
      hasMusic: musicPath != null,
      hasVoiceover: voiceoverPath != null,
    });

    const outputPath = path.join(dir, "final.mp4");
    const posterPath = path.join(dir, "poster.jpg");
    const args = [
      "-y",
      ...clipPaths.flatMap((p) => ["-i", p]),
      ...extraInputs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[outv]",
      "-map",
      finalAudioLabel,
      "-c:v",
      "libx264",
      "-crf",
      "20",
      "-preset",
      "veryfast",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ];
    jobs.set(jobId, { status: "running", progress: 65, error: null });
    await run("ffmpeg", args, { maxBuffer: 1024 * 1024 * 64 });

    await run("ffmpeg", ["-y", "-i", outputPath, "-frames:v", "1", "-q:v", "3", posterPath]);
    jobs.set(jobId, { status: "running", progress: 90, error: null });

    const form = new FormData();
    form.append("video", new Blob([await fsp.readFile(outputPath)], { type: "video/mp4" }), "final.mp4");
    if (fs.existsSync(posterPath)) {
      form.append(
        "poster",
        new Blob([await fsp.readFile(posterPath)], { type: "image/jpeg" }),
        "poster.jpg",
      );
    }
    await fetch(`${appBaseUrl}/api/stories/${jobId}/finalize`, {
      method: "POST",
      headers: { authorization: `Bearer ${containerToken}` },
      body: form,
    });

    jobs.set(jobId, { status: "done", progress: 100, error: null });
  } catch (error) {
    try {
      const form = new FormData();
      form.append("error", String(error?.message ?? error));
      await fetch(`${appBaseUrl}/api/stories/${jobId}/finalize`, {
        method: "POST",
        headers: { authorization: `Bearer ${containerToken}` },
        body: form,
      });
    } catch {
      // best-effort — the tick loop's MAX_JOB_MS deadline is the backstop.
    }
    jobs.set(jobId, { status: "error", progress: 0, error: String(error?.message ?? error) });
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
