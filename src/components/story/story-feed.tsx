import { Download as IconDownload } from "lucide-react";
import { Loader } from "@higgsfield/quanta/loader";
import { GenerationTile } from "@/components/generation-card";
import { ScreenEmptyState } from "@/components/screen-empty-state";
import type { ScreenEmptyStateContent } from "@/components/screen-empty-state";
import type { StoryDTO } from "@/lib/story-engine.server";

function statusLabel(story: StoryDTO): string {
  if (story.status === "ready") return "Ready";
  if (story.status === "failed") return story.error ?? "This story could not be finished.";
  return story.progressLabel ?? "Directing your story…";
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
      />
    );
  }
  if (story.status === "failed") {
    return (
      <GenerationTile
        state="failed"
        ratio="portrait"
        failureLabel={statusLabel(story)}
      />
    );
  }
  return (
    <GenerationTile
      state="generating"
      ratio="portrait"
      generatingLabel={statusLabel(story)}
    />
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
