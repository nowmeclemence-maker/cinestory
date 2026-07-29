import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Tabs } from "@higgsfield/quanta/tabs";
import { AppShell } from "@/layouts/app-shell";
import { STORY_TEMPLATES, type StoryTemplateGroup } from "@/lib/story-templates";
import { TEMPLATE_PREVIEWS } from "@/components/template-picker";
import { Clapperboard, Heart } from "lucide-react";

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
});

const GROUPS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "story", label: "Story" },
  { id: "ad", label: "Ad & Brand" },
  { id: "drama", label: "Drama" },
  { id: "real", label: "Real Life" },
];

function TemplatesPage() {
  const [group, setGroup] = useState("all");

  const visible = group === "all"
    ? STORY_TEMPLATES
    : STORY_TEMPLATES.filter((t) => t.group === group);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Templates</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Browse and select storytelling templates for your videos.
          </Typography>
        </div>
        <Tabs.Root value={group} onValueChange={(v) => setGroup(String(v))}>
          <Tabs.List items={GROUPS.map((g) => ({ value: g.id, label: g.label }))} />
        </Tabs.Root>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((template) => {
            const preview = TEMPLATE_PREVIEWS[template.id];
            return (
              <div key={template.id} className="group relative overflow-hidden rounded-lg border border-q-border-subtle bg-q-background-secondary transition-colors hover:bg-q-background-tertiary">
                {preview ? (
                  <img src={preview} alt={template.title} className="aspect-[9/16] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[9/16] w-full items-center justify-center bg-q-background-secondary">
                    <Clapperboard className="size-8 text-q-text-tertiary" />
                  </div>
                )}
                <div className="p-3">
                  <Typography as="h3" variant="label-md-medium" color="primary">{template.title}</Typography>
                  <Typography as="p" variant="caption-sm-regular" color="secondary">{template.subtitle}</Typography>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}