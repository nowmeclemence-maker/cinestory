import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { Modal } from "@higgsfield/quanta/modal";
import { toast } from "@higgsfield/quanta/sonner";
import {
  Clapperboard, Plus, Play, Trash2, BookOpen, Users, MapPin, Repeat, Upload,
} from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import {
  listSeriesFn, getSeriesFn, createSeriesFn, startEpisodeFn, deleteSeriesFn,
} from "@/lib/story.functions";
import type { SeriesDTO } from "@/lib/series-engine.server";
import { DEMO_MANUSCRIPT, DEMO_SERIES_TITLE } from "@/lib/demo-manuscript";

export const Route = createFileRoute("/series")({
  component: SeriesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

function SeriesPage() {
  const { id } = Route.useSearch();
  return id ? <SeriesDetail seriesId={id} /> : <SeriesList />;
}

// ─── List ────────────────────────────────────────────────────────────────────

function SeriesList() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [manuscript, setManuscript] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: series = [], isLoading } = useQuery({
    queryKey: ["series"],
    queryFn: () => listSeriesFn(),
  });

  const handleCreate = async () => {
    if (!title.trim() || manuscript.trim().length < 40) {
      toast.error("Add a series title and a manuscript (at least a paragraph).");
      return;
    }
    setCreating(true);
    try {
      const created = await createSeriesFn({ data: { title: title.trim(), manuscript } });
      window.location.href = `/series?id=${created.id}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the series.");
    } finally {
      setCreating(false);
    }
  };

  const loadDemo = () => {
    setTitle(DEMO_SERIES_TITLE);
    setManuscript(DEMO_MANUSCRIPT);
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
      setManuscript((current) => (current ? `${current}\n\n${text}` : text));
    };
    reader.readAsText(file);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">Series</Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
              Import a manuscript → get a story bible → produce episodes one by one, with recurring characters.
            </Typography>
          </div>
          <Button variant="marketingPrimary" onClick={() => setOpen(true)}>
            <Icon as={Plus} size="sm" /> New series
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader size="md" color="neutral" /></div>
        ) : series.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-q-border-subtle p-8 text-center">
            <BookOpen className="size-10 text-q-text-tertiary" />
            <Typography as="p" variant="body-md-regular" color="secondary">
              No series yet. Start with the demo — “Unwanted Guest” — to see the full series pipeline.
            </Typography>
            <Button variant="marketingPrimary" onClick={loadDemo}>
              Load the demo manuscript
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {series.map((entry) => (
              <a key={entry.id} href={`/series?id=${entry.id}`} className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4 transition-colors hover:bg-q-background-tertiary">
                <Typography as="h3" variant="label-md-medium" color="primary">{entry.title}</Typography>
                <Typography as="p" variant="caption-sm-regular" color="secondary">
                  {entry.episodeCount} episode{entry.episodeCount === 1 ? "" : "s"} · {entry.bible?.characters.length ?? 0} characters
                </Typography>
                {entry.bible?.logline && (
                  <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-2 line-clamp-2">
                    {entry.bible.logline}
                  </Typography>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      <Modal.Root open={open} onOpenChange={setOpen}>
        <Modal.Content size="lg">
          <Modal.Header>New series</Modal.Header>
          <div className="space-y-4 p-4">
            <label className="text-xs text-q-text-tertiary" htmlFor="series-title">Title</label>
            <input
              id="series-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unwanted Guest"
              className="w-full rounded-lg border border-q-border-subtle bg-q-background-secondary px-3 py-2 text-sm text-q-text-primary focus:border-q-border-focus focus:outline-none"
            />
            <label className="text-xs text-q-text-tertiary" htmlFor="series-manuscript">Manuscript</label>
            <textarea
              id="series-manuscript"
              value={manuscript}
              onChange={(e) => setManuscript(e.target.value)}
              placeholder="Paste your manuscript — CineStory turns it into a bible, splits it into episodes, and casts recurring characters…"
              rows={12}
              className="w-full rounded-lg border border-q-border-subtle bg-q-background-secondary px-3 py-2 text-sm text-q-text-primary focus:border-q-border-focus focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="tertiary" size="sm" onClick={loadDemo}>
                <Icon as={Clapperboard} size="sm" /> Load “Unwanted Guest” demo
              </Button>
              <label className="cursor-pointer rounded-lg border border-q-border-subtle px-2.5 py-1.5 text-xs font-medium text-q-text-secondary hover:bg-q-transparent-light-10">
                <span className="flex items-center gap-1"><Icon as={Upload} size="sm" /> Import .txt</span>
                <input type="file" accept=".txt,.md,.text" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importFile(file);
                  e.target.value = "";
                }} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="tertiary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="marketingPrimary" disabled={creating} onClick={() => void handleCreate()}>
                {creating ? <Loader size="xs" color="neutral" /> : <Icon as={BookOpen} size="sm" />}
                Write the bible
              </Button>
            </div>
          </div>
        </Modal.Content>
      </Modal.Root>
    </AppShell>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function SeriesDetail({ seriesId }: { seriesId: string }) {
  const [starting, setStarting] = useState<number | null>(null);
  const { data: series, isLoading } = useQuery({
    queryKey: ["series", seriesId],
    queryFn: () => getSeriesFn({ data: { seriesId } }),
  });

  const handleStartEpisode = async (idx: number) => {
    setStarting(idx);
    try {
      const story = await startEpisodeFn({ data: { seriesId, idx } });
      window.location.href = `/workspace?story=${story.id}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the episode.");
      setStarting(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete “${series?.title}”? Episodes stay in your library.`)) return;
    try {
      await deleteSeriesFn({ data: { seriesId } });
      window.location.href = "/series";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the series.");
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-48 items-center justify-center"><Loader size="md" color="neutral" /></div>
      </AppShell>
    );
  }
  if (!series) {
    return (
      <AppShell>
        <div className="flex h-48 items-center justify-center">
          <a href="/series"><Button variant="primary">Back to series</Button></a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/series" className="text-q-text-secondary hover:text-q-text-primary" aria-label="Back to series">
              <Icon as={Play} size="md" className="rotate-180" />
            </a>
            <div>
              <Typography as="h1" variant="title-lg-semi-bold" color="primary">{series.title}</Typography>
              {series.bible?.logline && (
                <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1 max-w-2xl">
                  {series.bible.logline}
                </Typography>
              )}
            </div>
          </div>
          <Button variant="tertiary" size="sm" onClick={() => void handleDelete()}>
            <Icon as={Trash2} size="sm" /> Delete
          </Button>
        </div>

        {/* Bible */}
        {series.bible && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
              <Typography as="h2" variant="title-sm-semi-bold" color="primary">Story bible</Typography>
              <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
                {series.bible.summary}
              </Typography>
              {series.bible.arcs.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-q-text-tertiary">
                    <Icon as={Repeat} size="sm" /> <span className="text-xs">Arcs</span>
                  </div>
                  {series.bible.arcs.map((arc, idx) => (
                    <Typography key={idx} as="p" variant="caption-sm-regular" color="secondary">· {arc}</Typography>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
              <div className="flex items-center gap-2">
                <Icon as={Users} size="sm" className="text-q-brand-primary" />
                <Typography as="h3" variant="label-md-medium" color="primary">
                  Recurring characters ({series.bible.characters.length})
                </Typography>
              </div>
              <div className="mt-3 space-y-2">
                {series.bible.characters.map((character) => (
                  <div key={character.name} className="rounded-lg border border-q-border-subtle bg-q-background-primary px-3 py-2">
                    <Typography as="span" variant="label-md-medium" color="primary">
                      {character.name}{character.role ? ` — ${character.role}` : ""}
                    </Typography>
                    <Typography as="p" variant="caption-sm-regular" color="secondary" className="line-clamp-2">
                      {character.appearance}{character.clothing ? ` · wears ${character.clothing}` : ""}
                    </Typography>
                  </div>
                ))}
              </div>
              {series.bible.settings.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-q-text-tertiary">
                    <Icon as={MapPin} size="sm" /> <span className="text-xs">Settings</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {series.bible.settings.map((setting) => (
                      <span key={setting.name} className="rounded-full bg-q-transparent-light-10 px-2.5 py-1 text-xs text-q-text-secondary">
                        {setting.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Episodes */}
        <div>
          <Typography as="h2" variant="title-sm-semi-bold" color="primary" className="mb-3">
            Episodes
          </Typography>
          <div className="space-y-2">
            {series.episodes.map((episode, idx) => (
              <div key={episode.idx} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
                <div className="min-w-0">
                  <Typography as="h3" variant="label-md-medium" color="primary">
                    Episode {idx + 1} — {episode.title}
                  </Typography>
                  {episode.logline && (
                    <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1 line-clamp-2">
                      {episode.logline}
                    </Typography>
                  )}
                  {episode.storyId && (
                    <a href={`/workspace?story=${episode.storyId}`} className="mt-1 inline-block text-xs text-q-brand-primary hover:underline">
                      Open episode story →
                    </a>
                  )}
                </div>
                {episode.storyId ? (
                  <a href={`/workspace?story=${episode.storyId}`}>
                    <Button variant="tertiary" size="sm">Continue</Button>
                  </a>
                ) : (
                  <Button variant="marketingPrimary" size="sm" disabled={starting === episode.idx} onClick={() => void handleStartEpisode(episode.idx)}>
                    {starting === episode.idx ? <Loader size="xs" color="neutral" /> : <Icon as={Play} size="sm" />}
                    Start episode
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}