import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Mic, Plus, Play } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/voices")({ component: VoicesPage });

function VoicesPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">Voice Library</Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">Manage AI voices for narration and dialogue.</Typography>
          </div>
          <Button variant="marketingPrimary"><Icon as={Plus} size="sm" /> Add Voice</Button>
        </div>
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-q-border-subtle">
          <div className="text-center">
            <Mic className="mx-auto size-8 text-q-text-tertiary" />
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">No voices yet. Clone or add a voice to get started.</Typography>
          </div>
        </div>
      </div>
    </AppShell>
  );
}