import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { toast } from "@higgsfield/quanta/sonner";
import { Music as IconMusic, Trash2, ArrowRight } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { listMusicTracksFn, deleteMusicTrackFn } from "@/lib/story.functions";
import { MUSIC_PRESETS } from "@/lib/music-presets";

export const Route = createFileRoute("/music")({ component: MusicPage });

function MusicPage() {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: userTracks = [], isLoading } = useQuery({
    queryKey: ["music", "tracks"],
    queryFn: () => listMusicTracksFn(),
  });

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteMusicTrackFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["music", "tracks"] });
      toast.success("Track removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the track.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Music Library</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            AI-composed beds and your uploads. Pick one per story at its Audio step — it’s mixed under the film at assembly.
          </Typography>
        </div>

        <div>
          <Typography as="h2" variant="title-sm-semi-bold" color="primary" className="mb-3">CineStory presets</Typography>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MUSIC_PRESETS.map((track) => (
              <div key={track.id} className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-q-brand-primary/10 text-q-brand-primary">
                    <Icon as={IconMusic} size="md" />
                  </div>
                  <div className="min-w-0">
                    <Typography as="h3" variant="label-md-medium" color="primary" truncate>{track.name}</Typography>
                    <Typography as="p" variant="caption-sm-regular" color="secondary" truncate>
                      {track.genre} · {track.mood}
                    </Typography>
                  </div>
                </div>
                <audio controls src={track.url} className="mt-3 h-9 w-full" preload="none">
                  <a href={track.url}>Listen</a>
                </audio>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Typography as="h2" variant="title-sm-semi-bold" color="primary" className="mb-3">Your tracks</Typography>
          {isLoading ? (
            <div className="flex h-24 items-center justify-center"><Loader size="sm" color="neutral" /></div>
          ) : userTracks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-q-border-subtle p-6 text-center">
              <Typography as="p" variant="body-sm-regular" color="secondary">
                No uploaded tracks yet — add one from any story’s Audio step (“Upload track”).
              </Typography>
            </div>
          ) : (
            <div className="space-y-2">
              {userTracks.map((track) => (
                <div key={track.id} className="flex items-center justify-between gap-3 rounded-xl border border-q-border-subtle bg-q-background-secondary p-3">
                  <div className="min-w-0">
                    <Typography as="p" variant="label-md-medium" color="primary" truncate>{track.name}</Typography>
                    <Typography as="p" variant="caption-sm-regular" color="secondary">{track.mood || "uploaded"}</Typography>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <audio controls src={track.url} className="h-8 w-44 sm:w-56" preload="none" />
                    <button
                      type="button"
                      aria-label={`Delete ${track.name}`}
                      disabled={deleting === track.id}
                      className="rounded p-1.5 text-q-text-secondary hover:bg-q-transparent-light-10 disabled:opacity-50"
                      onClick={() => void handleDelete(track.id)}
                    >
                      {deleting === track.id ? <Loader size="xs" color="neutral" /> : <Icon as={Trash2} size="sm" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <a href="/workspace" className="inline-block">
          <Button variant="tertiary">Add music in any story’s Audio step <Icon as={ArrowRight} size="sm" /></Button>
        </a>
      </div>
    </AppShell>
  );
}