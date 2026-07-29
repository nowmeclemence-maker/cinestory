import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Sparkles, Plus } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/prompts")({ component: PromptsPage });

function PromptsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">Prompt Library</Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">Save and organize your best generation prompts.</Typography>
          </div>
          <Button variant="marketingPrimary"><Icon as={Plus} size="sm" /> New Prompt</Button>
        </div>
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-q-border-subtle">
          <div className="text-center">
            <Sparkles className="mx-auto size-8 text-q-text-tertiary" />
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">Save prompts you love and reuse them across stories.</Typography>
          </div>
        </div>
      </div>
    </AppShell>
  );
}