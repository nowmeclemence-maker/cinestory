import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Download, Film, Monitor, Smartphone, Youtube } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/exports")({
  component: ExportsPage,
});

function ExportsPage() {
  const formats = [
    { label: "MP4", icon: Film, desc: "Standard HD video", res: "1080p" },
    { label: "TikTok", icon: Smartphone, desc: "Vertical 9:16", res: "1080p" },
    { label: "Instagram Reels", icon: Smartphone, desc: "Vertical 9:16", res: "1080p" },
    { label: "YouTube Shorts", icon: Youtube, desc: "Vertical 9:16", res: "1080p" },
    { label: "YouTube", icon: Monitor, desc: "Landscape 16:9", res: "4K" },
    { label: "4K Master", icon: Film, desc: "Highest quality", res: "4K" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Exports</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Export your finished stories in any format.
          </Typography>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formats.map((fmt) => (
            <div key={fmt.label} className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-4 transition-colors hover:bg-q-background-tertiary">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-q-brand-primary/10 text-q-brand-primary">
                  <Icon as={fmt.icon} size="md" />
                </div>
                <div className="flex-1">
                  <Typography as="h3" variant="label-md-medium" color="primary">{fmt.label}</Typography>
                  <Typography as="p" variant="caption-sm-regular" color="secondary">{fmt.desc} · {fmt.res}</Typography>
                </div>
                <Button variant="tertiary" size="sm" disabled>
                  <Icon as={Download} size="sm" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-6">
          <Typography as="h2" variant="title-sm-semi-bold" color="primary" className="mb-2">Coming Soon</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary">
            Storyboard PDF exports, batch export, and scheduled publishing are in development.
          </Typography>
        </div>
      </div>
    </AppShell>
  );
}