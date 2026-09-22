import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Card } from "@higgsfield/quanta/card";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { Plus, Film, Users, MapPin, TrendingUp } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { listStoriesFn } from "@/lib/story.functions";
import { useStoriesFeed } from "@/components/story/use-stories-feed";
import { useFnfScopeKey } from "@higgsfield/fnf-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const scopeKey = useFnfScopeKey() ?? "guest";
  const storiesFeed = useStoriesFeed(scopeKey);
  const stories = storiesFeed.data ?? [];

  const readyCount = stories.filter((s) => s.status === "ready").length;
  const inProgressCount = stories.filter((s) => s.status === "generating" || s.status === "assembling").length;

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">
              Dashboard
            </Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
              Welcome to CineStory — your AI storytelling studio.
            </Typography>
          </div>
          <Button variant="marketingPrimary" onClick={() => window.location.href = "/studio"}>
            <Icon as={Plus} size="sm" /> New Story
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Film} label="Total Stories" value={stories.length} />
          <StatCard icon={TrendingUp} label="Ready to Publish" value={readyCount} />
          <StatCard icon={Loader} label="In Progress" value={inProgressCount} />
          <StatCard icon={Users} label="Characters" value="—" />
        </div>

        {/* Recent Stories */}
        <div>
          <Typography as="h2" variant="title-sm-semi-bold" color="primary" className="mb-4">
            Recent Stories
          </Typography>
          {storiesFeed.isPending ? (
            <div className="flex h-32 items-center justify-center">
              <Loader size="md" color="neutral" />
            </div>
          ) : stories.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-q-border-subtle p-8 text-center">
              <Film className="size-12 text-q-text-tertiary" />
              <Typography as="p" variant="body-md-regular" color="secondary">
                No stories yet. Describe your first idea in the Studio.
              </Typography>
              <Button variant="primary" onClick={() => window.location.href = "/studio"}>
                Go to Studio
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stories.slice(0, 6).map((story) => (
                <Card key={story.id} className="overflow-hidden">
                  {story.finalPosterUrl ? (
                    <img
                      src={story.finalPosterUrl}
                      alt={story.title ?? ""}
                      className="aspect-[9/16] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[9/16] w-full items-center justify-center bg-q-background-secondary">
                      <Film className="size-8 text-q-text-tertiary" />
                    </div>
                  )}
                  <div className="p-3">
                    <Typography as="h3" variant="label-md-medium" color="primary" truncate>
                      {story.title ?? story.idea}
                    </Typography>
                    <Typography as="p" variant="caption-sm-regular" color="secondary" truncate>
                      {story.templateTitle} · {story.status}
                    </Typography>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: IconGlyph, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-q-brand-primary/10 text-q-brand-primary">
          <Icon as={IconGlyph} size="md" />
        </div>
        <div>
          <Typography as="p" variant="caption-sm-regular" color="secondary">
            {label}
          </Typography>
          <Typography as="p" variant="title-sm-semi-bold" color="primary">
            {value}
          </Typography>
        </div>
      </div>
    </Card>
  );
}