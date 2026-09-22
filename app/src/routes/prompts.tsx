import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Sparkles, ArrowRight } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/prompts")({ component: PromptsPage });

function PromptsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Prompt Library</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            CineStory writes every prompt for you — but your reusable favourites belong here.
          </Typography>
        </div>
        <div className="flex h-56 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-q-border-subtle p-8 text-center">
          <Sparkles className="size-10 text-q-text-tertiary" />
          <Typography as="p" variant="body-md-regular" color="secondary" className="max-w-md">
            No prompting needed: each story’s script, cast and sets generate their own prompts automatically. Saving your own prompt snippets is coming with the asset manager.
          </Typography>
          <a href="/studio" className="mt-1">
            <Button variant="marketingPrimary">Describe an idea <Icon as={ArrowRight} size="sm" /></Button>
          </a>
        </div>
      </div>
    </AppShell>
  );
}