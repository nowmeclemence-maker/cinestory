import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Folders, ArrowRight } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/assets")({ component: AssetsPage });

function AssetsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">AI Assets</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Your storyboard stills, scene videos, music and uploads live with each story.
          </Typography>
        </div>
        <div className="flex h-56 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-q-border-subtle p-8 text-center">
          <Folders className="size-10 text-q-text-tertiary" />
          <Typography as="p" variant="body-md-regular" color="secondary" className="max-w-md">
            A full media manager — folders, search, tags — is on the roadmap. Every asset is already saved and reusable: open a story to re-export its images, clips and audio.
          </Typography>
          <a href="/studio" className="mt-1">
            <Button variant="marketingPrimary">Go to your stories <Icon as={ArrowRight} size="sm" /></Button>
          </a>
        </div>
      </div>
    </AppShell>
  );
}