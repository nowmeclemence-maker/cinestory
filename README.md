# CineStory — AI Storytelling Studio

Turn one idea into a cinematic short film. Upload a photo, pick a story template,
describe your idea in plain language — CineStory writes the script, casts the
characters, sets the scenes, generates the storyboard, films every scene, mixes
the sound and cuts the final 9:16 video. No prompting, no timeline editing.

Live: **https://cinestory.higgsfield.app** · Series demo: **/series** ("Unwanted Guest")

---

## The pipeline

A film advances one **validated step at a time** — nothing is generated until you
confirm the current step, and every paid action shows its credit cost first:

```
Idea → Script → Cast → Sets → Storyboard → Video → Audio → Final cut
```

| Step | What you do | What the AI does | Paid? |
|---|---|---|---|
| Script | Edit scenes, dialogue, camera, on-screen text | Writes title, hook, scenes, music mood | free (text) |
| Cast | Pick/propose 1–3 characters, add photo or generate a portrait | Deduces the cast from the script; protagonist inherits your selfie | portraits 1.5 cr |
| Sets | One set per scene: preset, free text, photo, or generated | Proposes a set per scene from the preset gallery | set images 1.5 cr |
| Storyboard | Validate or regenerate each 9:16 image one by one | One image per scene (cast + set references locked in) | images 1.5 cr |
| Video | Review the recorded clips | One Seedance 2.0 clip per scene with native dialogue | 4.5 cr/second |
| Audio | Toggle per-scene dialogue, pick music, import voiceover | Recommendations + the mix | free (assembly) |
| Final cut | Preview, download, export | ffmpeg container stitches clips, music, captions | free |

**Series mode** (Lot F): import a manuscript → the showrunner writes a story bible
(characters into the reusable library, settings, arcs, episode split) → each
episode runs the same pipeline with the recurring cast pre-linked.

## Stack

- **Framework** — React 19 + TanStack Start (file-based routing, `createServerFn`)
- **Runtime** — one Cloudflare Worker (SSR); D1 for product state, R2 for final
  videos, a single **container** (ffmpeg) for assembly
- **AI** — Higgsfield platform egress (`fnf.internal` / `fnf` SDK): LLM scriptwriter,
  Nano Banana 2 images/portraits/sets, Seedance 2.0 video, Sonilo music presets
- **Auth** — platform Sign in with Higgsfield (`/__auth/login`), server-side
  re-check before every SDK operation
- **UI** — Quanta design system + Tailwind v4, dark-only

## Repository layout

```
app/
  migrations/           # additive D1 migrations (0001–0009)
  container/            # the ffmpeg assembly container (Dockerfile + server.mjs)
  src/
    layout/             # AppShell (sidebar) + the Studio workspace layout
    components/         # shared UI (generation tiles, step bar, story feed…)
    lib/
      story-engine.server.ts  # the story pipeline: steps, gates, credits
      series-engine.server.ts # manuscript → bible → episodes
      services/               # characters, locations, assets, credits, music…
      generation/             # provider port: Higgsfield FNF implementation
      story.functions.ts      # server-function bridges (client-safe)
      story-templates.ts      # templates, locations, durations, cost model
      music-presets.ts        # AI music beds
    routes/             # pages: /, /studio, /workspace, /series, /dashboard…
    routes/api/         # /api/user, /api/media/upload(-audio), /api/stories/*, story-media
```

Full developer guide: **docs/ARCHITECTURE.md**.

## Costs (confirmed Higgsfield pricing, Sep 2026)

| Item | Credits |
|---|---|
| Storyboard / portrait / set image (Nano Banana 2) | 1.5 |
| Video (Seedance 2.0) | 4.5 / second |
| Script + bible + casting text | text only |
| Final assembly (container) | 0 |

Every gate checks the balance before launching (`Not enough credits for videos:
X needed, Y available`).

## Development

```bash
cd app
bun install
bun run dev          # local dev (Vite + Worker)
bun run typecheck    # tsr generate + tsc
bun run build        # production build
```

Deploys run through the Higgsfield platform (`deploy_website`); migrations apply
automatically (additive only). Each completed lot is a clean commit on `main`.