import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Textarea } from "@higgsfield/quanta/textarea";
import { Tabs } from "@higgsfield/quanta/tabs";
import { Card } from "@higgsfield/quanta/card";
import { Loader } from "@higgsfield/quanta/loader";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getStory } from "@/lib/story-engine.server";
import type { StoryDTO, SceneDTO } from "@/lib/story-engine.server";
import { AppShell } from "@/layouts/app-shell";
import { useQueryClient } from "@tanstack/react-query";
import { Clapperboard, FileText, Camera, Mic, Wand2, Eye } from "lucide-react";

export const Route = createFileRoute("/workspace")({
  component: WorkspacePage,
});

const getStoryFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => getStory(data.storyId));

function WorkspacePage() {
  const qc = useQueryClient();
  const [storyId, setStoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("script");
  const [scenes, setScenes] = useState<SceneDTO[]>([]);

  const { data: story, isLoading } = useQuery({
    queryKey: ["workspace", storyId],
    queryFn: () => getStoryFn({ data: { storyId: storyId! } }),
    enabled: !!storyId,
    refetchInterval: (query) => {
      const s = query.state.data as StoryDTO | undefined;
      if (s && (s.status === "generating" || s.status === "assembling")) return 4000;
      return false;
    },
  });

  // Load a story from URL params or default
  const handleLoadStory = async (id: string) => {
    setStoryId(id);
    const s = await getStoryFn({ data: { storyId: id } });
    setScenes(s.scenes);
  };

  const updateScene = (idx: number, patch: Partial<SceneDTO>) => {
    setScenes((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">
              Story Workspace
            </Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
              Write, organize, and refine your story before generating.
            </Typography>
          </div>
          <div className="flex gap-2">
            <Button variant="tertiary" onClick={() => window.location.href = "/"}>
              <Icon as={Clapperboard} size="sm" /> Open Studio
            </Button>
          </div>
        </div>

        {!storyId ? (
          /* Empty state — pick a story */
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-q-border-subtle p-8 text-center">
            <FileText className="size-12 text-q-text-tertiary" />
            <Typography as="p" variant="body-md-regular" color="secondary">
              Select a story from the Dashboard to edit it here.
            </Typography>
            <Button variant="primary" onClick={() => window.location.href = "/dashboard"}>
              Go to Dashboard
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader size="md" color="neutral" /></div>
        ) : story ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Story Info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-4">
                <Typography as="h2" variant="title-sm-semi-bold" color="primary">{story.title}</Typography>
                <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">{story.idea}</Typography>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-q-brand-primary/10 px-3 py-1 text-xs text-q-brand-primary">{story.templateTitle}</span>
                  <span className="rounded-full bg-q-transparent-light-10 px-3 py-1 text-xs">{story.durationSec}s</span>
                  <span className="rounded-full bg-q-transparent-light-10 px-3 py-1 text-xs">{story.status}</span>
                </div>
              </div>

              {/* Tabs: Script / Scenes / Preview */}
              <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(String(v))}>
                <Tabs.List items={[
                  { value: "script", label: "Script", start: <Icon as={FileText} size="sm" /> },
                  { value: "scenes", label: "Scenes", start: <Icon as={Camera} size="sm" /> },
                  { value: "preview", label: "Preview", start: <Icon as={Eye} size="sm" /> },
                ]} />
              </Tabs.Root>

              {activeTab === "scenes" && (
                <div className="space-y-3">
                  {scenes.map((scene, idx) => (
                    <Card key={scene.id} className="overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <Typography as="h3" variant="label-md-medium" color="primary">
                            Scene {idx + 1}
                          </Typography>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${
                            scene.status === "ready" ? "bg-green-500/10 text-green-500" :
                            scene.status === "failed" ? "bg-red-500/10 text-red-500" :
                            "bg-q-transparent-light-10"
                          }`}>{scene.status}</span>
                        </div>
                        <Textarea
                          label="Description"
                          value={scene.description}
                          onChange={(e) => updateScene(idx, { description: e.target.value })}
                          className="mt-2"
                        />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Textarea label="Camera" value={scene.camera ?? ""} onChange={(e) => updateScene(idx, { camera: e.target.value })} />
                          <Textarea label="Dialogue" value={scene.dialogue ?? ""} onChange={(e) => updateScene(idx, { dialogue: e.target.value })} />
                        </div>
                        {scene.imageUrl && (
                          <img src={scene.imageUrl} alt={`Scene ${idx + 1}`} className="mt-2 h-32 w-full rounded object-cover" />
                        )}
                        {scene.videoUrl && (
                          <video src={scene.videoUrl} controls className="mt-2 h-32 w-full rounded object-cover" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === "script" && story && (
                <div className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-4">
                  <Typography as="h3" variant="label-md-medium" color="primary">Story Hook</Typography>
                  <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">{story.hook}</Typography>
                  <Typography as="h3" variant="label-md-medium" color="primary" className="mt-4">Call to Action</Typography>
                  <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">{story.cta}</Typography>
                  <Typography as="h3" variant="label-md-medium" color="primary" className="mt-4">Music Mood</Typography>
                  <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">{story.musicMood}</Typography>
                  <Typography as="h3" variant="label-md-medium" color="primary" className="mt-4">Color Grade</Typography>
                  <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">{story.colorGrade}</Typography>
                </div>
              )}

              {activeTab === "preview" && story.finalVideoUrl && (
                <div className="rounded-lg overflow-hidden border border-q-border-subtle">
                  <video src={story.finalVideoUrl} controls className="w-full aspect-[9/16] max-h-[70vh] object-contain bg-black" poster={story.finalPosterUrl ?? undefined} />
                </div>
              )}
              {activeTab === "preview" && !story.finalVideoUrl && (
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-q-border-subtle">
                  <Typography as="p" variant="body-sm-regular" color="secondary">Video not yet generated.</Typography>
                </div>
              )}
            </div>

            {/* Right: Timeline */}
            <div className="space-y-4">
              <Typography as="h2" variant="title-sm-semi-bold" color="primary">Production Timeline</Typography>
              {[
                { label: "Idea", status: "done", icon: FileText },
                { label: "Story", status: "done", icon: FileText },
                { label: "Characters", status: "done", icon: UsersIcon },
                { label: "Locations", status: "done", icon: MapPinIcon },
                { label: "Shots", status: story && story.scenes.every(s => s.status === "ready") ? "done" : story?.status === "generating" ? "active" : "pending", icon: Camera },
                { label: "Generation", status: story?.status === "generating" ? "active" : story?.status === "ready" ? "done" : "pending", icon: Wand2 },
                { label: "Assembly", status: story?.status === "assembling" ? "active" : story?.status === "ready" ? "done" : "pending", icon: Clapperboard },
                { label: "Export", status: story?.status === "ready" ? "ready" : "pending", icon: DownloadIcon },
              ].map((step) => (
                <div key={step.label} className={`flex items-center gap-3 rounded-lg border p-3 ${
                  step.status === "done" ? "border-green-500/30 bg-green-500/5" :
                  step.status === "active" ? "border-q-brand-primary/30 bg-q-brand-primary/5" :
                  "border-q-border-subtle bg-q-background-secondary"
                }`}>
                  <div className={`flex size-8 items-center justify-center rounded-full ${
                    step.status === "done" ? "bg-green-500 text-white" :
                    step.status === "active" ? "bg-q-brand-primary text-white" :
                    "bg-q-transparent-light-10 text-q-text-tertiary"
                  }`}>
                    <Icon as={step.icon} size="sm" />
                  </div>
                  <Typography as="span" variant="label-md-medium" color="primary">{step.label}</Typography>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

import { Users as UsersIcon, MapPin as MapPinIcon, Download as DownloadIcon } from "lucide-react";