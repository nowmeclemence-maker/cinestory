import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Mic, ArrowRight } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/voices")({ component: VoicesPage });

function VoicesPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Voice Library</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Narration for your films — imported recordings, and AI text-to-speech when Higgsfield opens it to apps.
          </Typography>
        </div>
        <div className="flex h-56 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-q-border-subtle p-8 text-center">
          <Mic className="size-10 text-q-text-tertiary" />
          <Typography as="p" variant="body-md-regular" color="secondary" className="max-w-md">
            Voiceover lives at the <span className="text-q-text-primary">Audio step</span> of each story — open any story, pick “Sound &amp; mix”, and import your narration.
          </Typography>
          <a href="/workspace" className="mt-1">
            <Button variant="marketingPrimary">Open the audio step <Icon as={ArrowRight} size="sm" /></Button>
          </a>
        </div>
      </div>
    </AppShell>
  );
}