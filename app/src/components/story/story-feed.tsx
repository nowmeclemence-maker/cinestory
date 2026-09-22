import { Download as IconDownload, Clapperboard as IconClapperboard } from "lucide-react";
import { Loader } from "@higgsfield/quanta/loader";
import { Button } from "@higgsfield/quanta/button";
import { GenerationTile } from "@/components/generation-card";
import { ScreenEmptyState } from "@/components/screen-empty-state";
import type { ScreenEmptyStateContent } from "@/components/screen-empty-state";
import type { StoryDTO } from "@/lib/story-engine.server";
import { stepLabel } from "@/lib/story-templates";

function statusLabel(story: StoryDTO): string {
  if (story.status === "ready") return "Ready";
  if (story.status === "failed") return story.error ?? "This story could not be finished.";
  return story.progressLabel ?? "Directing your story…";
}

/** First scene with a generated storyboard image (the images used to stay invisible). */
function firstSceneImage(story: StoryDTO): string | undefined {
  return story.scenes.find((s) => s.imageUrl)?.imageUrl ?? undefined;
}

function StepChip({ story }: { story: StoryDTO }) {
  const failed = story.status === "failed";
  return (
    <span
      className={`pointer-events-none absolute left-2 top-2 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm ${
        failed
          ? "bg-red-500/80 text-white"
          : story.status === "ready"
            ? "bg-emerald-500/80 text-white"
            : "bg-q-brand-primary/90 text-black"
      }`}
    >
      {stepLabel(story.currentStep)}
    </span>
  );
}

function CostChip({ story }: { story: StoryDTO }) {
  if (story.estimatedCost <= 0) return null;
  return (
    <span className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
      ~{Math.round(story.estimatedCost)} credits
    </span>
  );
}

export function StoryTile({
  story,
  authorName,
  authorAvatar,
}: {
  story: StoryDTO;
  authorName: string;
  authorAvatar?: string;
}) {
  if (story.status === "draft") {
    // Script step: nothing generated yet — the story awaits the writer.
    return (
      <div className="relative flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-q-border-subtle bg-q-background-secondary p-4 text-center">
        <StepChip story={story} />
        <div className="flex size-12 items-center justify-center rounded-xl bg-q-brand-primary/10">
          <IconClapperboard className="size-6 text-q-brand-primary" />
        </div>
        <p className="line-clamp-3 text-sm font-medium text-q-text-primary">
          {story.title ?? story.idea}
        </p>
        <p className="text-xs text-q-text-tertiary">
          {story.sceneCount} scenes · ~{Math.round(story.estimatedCost)} credits
        </p>
        <a href={`/workspace?story=${story.id}`} className="mt-1">
          <Button variant="marketingPrimary" size="sm">
            Edit script
          </Button>
        </a>
      </div>
    );
  }

  if (story.status === "ready" && story.finalVideoUrl) {
    return (
      <GenerationTile
        ratio="portrait"
        title={story.title ?? story.idea}
        generation={{
          src: story.finalVideoUrl,
          mediaType: "video",
          poster: story.finalPosterUrl ?? undefined,
          author: { name: authorName, avatarSrc: authorAvatar },
          prompt: story.idea,
        }}
        actions={[{ id: "download", label: "Download", icon: IconDownload }]}
      >
        <StepChip story={story} />
      </GenerationTile>
    );
  }

  if (story.status === "characters") {
    // Casting step: awaiting cast decision before any image is spent.
    return (
      <div className="relative flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-q-border-subtle bg-q-background-secondary p-4 text-center">
        <StepChip story={story} />
        <div className="flex size-12 items-center justify-center rounded-xl bg-q-brand-primary/10">
          <IconClapperboard className="size-6 text-q-brand-primary" />
        </div>
        <p className="line-clamp-2 text-sm font-medium text-q-text-primary">{story.title ?? story.idea}</p>
        <p className="text-xs text-q-text-tertiary">Cast pending · storyboard ~{Math.round(story.sceneCount * 1.5)} credits</p>
        <a href={`/workspace?story=${story.id}`} className="mt-1">
          <Button variant="marketingPrimary" size="sm">Pick the cast</Button>
        </a>
      </div>
    );
  }

  if (story.status === "locations") {
    // Sets step: awaiting one set per scene before any image is spent.
    const setCount = story.scenes.filter((s) => (s.locationDescription ?? "").trim()).length;
    return (
      <div className="relative flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-q-border-subtle bg-q-background-secondary p-4 text-center">
        <StepChip story={story} />
        <div className="flex size-12 items-center justify-center rounded-xl bg-q-brand-primary/10">
          <IconClapperboard className="size-6 text-q-brand-primary" />
        </div>
        <p className="line-clamp-2 text-sm font-medium text-q-text-primary">{story.title ?? story.idea}</p>
        <p className="text-xs text-q-text-tertiary">{setCount} of {story.sceneCount} sets · storyboard ~{Math.round(story.sceneCount * 1.5)} credits</p>
        <a href={`/workspace?story=${story.id}`} className="mt-1">
          <Button variant="marketingPrimary" size="sm">Pick the sets</Button>
        </a>
      </div>
    );
  }

  if (story.status === "storyboard") {
    // Storyboard step: images are generating / awaiting per-image validation.
    const storyboard = firstSceneImage(story);
    return (
      <div className="relative flex aspect-[9/16] w-full flex-col overflow-hidden rounded-lg border border-q-border-subtle bg-q-background-secondary">
        <StepChip story={story} />
        {storyboard ? (
          <img src={storyboard} alt={story.title ?? "Storyboard"} className="min-h-0 flex-1 w-full object-cover" />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Loader size="sm" color="neutral" />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 p-2.5">
          <p className="line-clamp-1 text-xs font-medium text-q-text-primary">{story.title ?? story.idea}</p>
          <a href={`/workspace?story=${story.id}`}>
            <Button variant="marketingPrimary" size="sm">Review storyboard</Button>
          </a>
        </div>
      </div>
    );
  }

  if (story.status === "failed") {
    return (
      <div className="relative">
        <GenerationTile
          state="failed"
          ratio="portrait"
          failureLabel={statusLabel(story)}
        />
        <StepChip story={story} />
      </div>
    );
  }

  // Generating: show the first storyboard image when available (images were
  // invisible before), with the live progress label overlaid.
  const storyboard = firstSceneImage(story);
  if (storyboard) {
    return (
      <GenerationTile
        ratio="portrait"
        title={statusLabel(story)}
        media={
          <div className="relative h-full w-full">
            <img src={storyboard} alt={story.title ?? "Storyboard"} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10">
              <Loader size="xs" color="neutral" />
              <span className="text-xs font-medium text-white">{statusLabel(story)}</span>
            </div>
          </div>
        }
      >
        <StepChip story={story} />
        <CostChip story={story} />
      </GenerationTile>
    );
  }

  return (
    <div className="relative">
      <GenerationTile
        state="generating"
        ratio="portrait"
        generatingLabel={statusLabel(story)}
      />
      <StepChip story={story} />
      <CostChip story={story} />
    </div>
  );
}

export function StoryFeedGrid({
  stories,
  loading,
  authorName,
  authorAvatar,
  emptyState,
}: {
  stories: StoryDTO[];
  loading: boolean;
  authorName: string;
  authorAvatar?: string;
  emptyState: ScreenEmptyStateContent;
}) {
  if (loading && stories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader size="md" color="neutral" aria-label="Loading your stories" />
      </div>
    );
  }
  if (stories.length === 0) {
    return <ScreenEmptyState {...emptyState} />;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {stories.map((story) => (
        <StoryTile key={story.id} story={story} authorName={authorName} authorAvatar={authorAvatar} />
      ))}
    </div>
  );
}