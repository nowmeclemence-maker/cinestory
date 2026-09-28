import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { ArrowRight, Check, Film, Smartphone, Video } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/exports")({
  component: ExportsPage,
});

/**
 * What the pipeline actually produces, not what would be nice to promise.
 * Clips are generated at 1080p and assembled at 1080p, so no 4K claim belongs
 * on this page until an upscale step exists and is paid for.
 */
const DELIVERED = [
  { label: "TikTok", icon: Smartphone, desc: "Vertical 9:16 · 1080p MP4" },
  { label: "Instagram Reels", icon: Smartphone, desc: "Vertical 9:16 · 1080p MP4" },
  { label: "YouTube Shorts", icon: Video, desc: "Vertical 9:16 · 1080p MP4" },
];

const NOT_YET = [
  "Landscape 16:9 masters",
  "4K, which needs an upscale pass that is not built yet",
  "Storyboard PDF, batch export, and scheduled publishing",
];

function ExportsPage() {
  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Exports</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Every finished film downloads from its own project page.
          </Typography>
        </div>

        <div className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-6">
          <div className="flex items-start gap-3">
            <Icon as={Film} size="md" className="mt-0.5 shrink-0 text-cine-accent" />
            <div>
              <Typography as="h2" variant="label-md-medium" color="primary">
                One file, sized for vertical
              </Typography>
              <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
                A finished film is a single 1080p MP4 framed 9:16. The same file plays natively on all
                three vertical platforms, so there is nothing to re-export between them.
              </Typography>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DELIVERED.map((format) => (
              <div key={format.label} className="rounded-lg border border-q-border-subtle p-3">
                <div className="flex items-center gap-2">
                  <Icon as={format.icon} size="sm" className="text-cine-accent" />
                  <Typography as="h3" variant="label-md-medium" color="primary">{format.label}</Typography>
                </div>
                <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
                  {format.desc}
                </Typography>
              </div>
            ))}
          </div>

          <a href="/projects" className="mt-5 inline-block">
            <Button variant="marketingPrimary" size="sm">
              Go to your projects <Icon as={ArrowRight} size="sm" />
            </Button>
          </a>
        </div>

        <div className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-6">
          <Typography as="h2" variant="title-sm-semi-bold" color="primary">Not available yet</Typography>
          <ul className="mt-3 space-y-2">
            {NOT_YET.map((item) => (
              <li key={item} className="flex items-start gap-2 text-q-body-sm-regular text-q-text-secondary">
                <Icon as={Check} size="sm" className="mt-0.5 shrink-0 text-q-text-tertiary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
