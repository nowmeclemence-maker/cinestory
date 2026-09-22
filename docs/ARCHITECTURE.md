# CineStory — Developer Architecture

This document explains how CineStory is built: the module map, the data model,
the generation provider port, the assembly container, the step gates, and how
to extend it (new providers, new markets, series).

## 1. Modules

```
src/
├── router.tsx                 TanStack router bootstrapping
├── start.ts                   server middleware (CSRF, error)
├── server.ts                  Worker entry + AppContainer Durable Object
├── layouts/
│   ├── app-shell.tsx          sidebar + page chrome (all app pages)
│   └── studio.tsx             the full-bleed Studio (generate dock + story feed)
├── components/
│   ├── story/
│   │   ├── step-bar.tsx       8-step pipeline bar
│   │   ├── story-feed.tsx      story tiles per status (draft/cast/sets/storyboard/audio…)
│   │   └── use-stories-feed.ts feed query + assembly trigger
│   ├── generation-card/       shared generation tiles (Quanta-based)
│   └── …                      other shared components
├── lib/
│   ├── story-engine.server.ts ★ the pipeline engine
│   ├── series-engine.server.ts★ manuscript → bible → episodes
│   ├── generation/
│   │   ├── port.ts            provider abstraction (CineStory vocabulary)
│   │   ├── fnf-provider.server.ts  Higgsfield FNF implementation
│   │   └── registry.server.ts pick the active provider
│   ├── services/              characters, locations, assets, credits,
│   │                          exports, music — per-domain D1 CRUD
│   ├── story.functions.ts     server functions (client-safe bridges)
│   ├── story-templates.ts     templates, presets, durations, cost model
│   ├── music-presets.ts       bundled AI music beds
│   └── fnf.browser.ts         upload helpers (image + audio)
└── routes/
    ├── index.tsx              public landing page
    ├── studio.tsx             Studio (app home of the pipeline)
    ├── workspace.tsx          per-story workspace: script/cast/sets/storyboard/audio
    ├── series.tsx             series library + bible + episode strips
    ├── dashboard.tsx, projects.tsx, characters.tsx, locations.tsx, …
    └── api/
        ├── user.ts            /api/user auth proxy
        ├── media/upload.ts    image upload → Higgsfield media
        ├── media/upload-audio.ts music/voiceover upload
        ├── stories/$id/assemble.ts  container kickoff
        ├── stories/$id/finalize.ts  container result → R2
        └── story-media/$.ts   owner-gated playback of final videos
```

## 2. Data model (D1)

`migrations/0001–0009.sql`, additive. Key tables:

| Table | Purpose |
|---|---|
| `stories` | one row per film/episode: idea, template, duration, `status`, `current_step`, `estimated_cost`, `spent_cost`, script JSON, `music_track`, `voiceover_url` |
| `story_scenes` | per-scene: description, camera, dialogue, on-screen text, image/video jobs + URLs, `retry_count`, per-scene set (`location_*`), `dialogue_enabled` |
| `characters` | reusable Character Library (role, appearance, clothing, `reference_images`, `portrait_job_id`) |
| `story_characters` | story ↔ character links, `scene_indices` (null = every scene) |
| `locations` | reusable Location Library |
| `music_tracks` | user-uploaded music library |
| `series` / `series_episodes` | manuscripts, story bibles, episode index → `story_id` |
| `story_assembly_jobs` | container job lifecycle (written by the DO monitor) |
| `credit_transactions`, `subscriptions` | credits ledger + Stripe-ready subscription slot |
| `assets`, `asset_folders`, `prompts`, `voices`, `exports`, `templates` | future surfaces (schema ready) |

### The status machine

`status` is the pipeline’s position: `draft` (script) → `characters` → `locations`
→ `storyboard` → `generating` (video) → `audio` → `assembling` → `ready` / `failed`.

- Scene statuses: `pending → image_generating → image_ready → video_generating → ready`, or `failed`.
- `resolveStory` (in `story-engine.server.ts`) advances by status on every read
  (single story and feed), so polling drives the pipeline without cron jobs.

## 3. The step gates (validated progression)

| Gate function | Launches… | Checks before spending |
|---|---|---|
| `validateScript` | the Cast step | — (text is free) |
| `validateCharacters` | the Locations step | every cast member has a reference photo/portrait |
| `validateLocations` | the Storyboard | every scene has a set; balance ≥ storyboard cost |
| `validateStoryboard` | the Videos (~94%) | balance ≥ video cost; all images `image_ready` |
| `validateAudio` | the Assembly | — (container is free) |

Each gate throws a precise `ApiJobError` (e.g. `Not enough credits for videos:
135 needed, 20 available.`) and the UI surfaces it as a banner — nothing is
spent on a gate that cannot pass.

## 4. Generation provider port

`lib/generation/port.ts` defines CineStory’s vocabulary:

```ts
submitSceneImage(request) → { jobId }       // a scene still / portrait / set still
submitSceneVideo(request) → { jobId }       // a clip animated from a still
getSceneJob(jobId)        → { jobId, phase, rawUrl } | null
uploadReference(bytes)    → { ref, url }
```

The story engine never names a model. `fnf-provider.server.ts` maps that
vocabulary onto the Higgsfield SDK (Nano Banana 2 for stills, Seedance 2.0 for
clips). Adding another provider = implement the port + register it — the engine
is unchanged.

### Async assets

Portraits and set images are submitted as jobs, `portrait_job_id` /
`location_job_id` persisted, and resolved on the next read
(`pollCharacterPortraits`, `pollSceneLocations`): completed jobs are fetched,
re-uploaded as durable references, and stored on the record.

## 5. Assembly container

`container/server.mjs` is one shared ffmpeg node that:
1. downloads every ready scene clip (indexed inputs),
2. builds a filter chain — 1080×1920 pad, per-scene captions (skipped when
   `dialogueEnabled === false`), opening hook, CTA,
3. concatenates with `concat=n=…:v=1:a=1`,
4. amixes optional music (`volume=0.14`, fade-in) and an optional imported
   voiceover above the film,
5. posts the final MP4 + poster to `/api/stories/:id/finalize` (→ R2), or posts
   an `error` field.

The Worker side (`AppContainer` Durable Object, `src/server.ts`) boots the
container patiently in the background, monitors per-job state, and keeps it
alive only while a job runs (single shared instance — `getByName("cinestory-assembler")`).

## 6. Series pipeline

`series-engine.server.ts`:
- `createSeries(title, manuscript)` → LLM showrunner writes the **bible**
  (summary, characters, settings, arcs, 2–5 episodes), creates bible characters
  in the reusable Character Library (storing `characterId`), persists the row.
- `startEpisode(seriesId, idx)` → builds the episode idea from the bible,
  calls the normal `createStory` (a draft at the Script step), then
  **pre-links the recurring cast** via `story_characters` — reference photos
  carry over between episodes.

## 7. Extending

- **New story template** — one entry in `STORY_TEMPLATES` in `story-templates.ts`
  (id, group, directive, default location).
- **New preset set** — one entry in `STORY_LOCATIONS`.
- **New provider** — implement `GenerationProvider`, register it; optionally use
  a `GenerationMediaRef`-compatible upload.
- **New market / duration** — the cost model (`estimateFilmCost`, `sceneDurationSeconds`)
  is centralized in `story-templates.ts`.
- **Voiceover TTS** — when Higgsfield exposes speech synthesis to apps, add a
  TTS path in place of the imported-voiceover upload (the storage shape already
  accepts a URL).
- **Stripe billing** — `subscriptions` + `credit_transactions` are ready; wire
  `website_secrets` (STRIPE_SECRET_KEY) server-side and checkouts from `/billing`.

## 8. Deployment

- One live deploy per push: `deploy_website` builds from `main` and ships the
  live site (no preview stage).
- Migrations run once, additively; verify schema with the read-only DB inspector.
- Secrets via the platform `website_secrets` tool, read server-side as
  `bindings().NAME` — never in client code.
- Repo mirrors: platform repo at `apps-repos.higgs.ai/…`; the project also
  pushes to GitHub (`nowmeclemence-maker/cinestory`) for remote editing.