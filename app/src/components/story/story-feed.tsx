import { Download as IconDownload } from "lucide-react";
import { Loader } from "@higgsfield/quanta/loader";
import { GenerationTile } from "@/components/generation-card";
import { ScreenEmptyState } from "@/components/screen-empty-state";
import type { ScreenEmptyStateContent } from "@/components/screen-empty-state";
import type { StoryDTO } from "@/lib/story-engine.server";

const STEP_LABELS: Record<string, string> = {
  old: "Old format",
  idea: "Idea",
  script: "Script",
  characters: "Characters",
  locations: "Locations",
  storyboard: "Storyboard",
  video: "Video",
  audio: "Audio",
  assembly: "Final cut",
};

function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? step;
}

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