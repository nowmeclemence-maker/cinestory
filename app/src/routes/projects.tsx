import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { Plus, Folder } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { createServerFn } from "@tanstack/react-start";
import { listStudioProjectsFn } from "@/lib/studio-projects.functions";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["studio", "projects"],
    queryFn: () => listStudioProjectsFn(),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">Projects</Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
              Organize your stories and media into projects.
            </Typography>
          </div>
          <Button variant="marketingPrimary" onClick={() => window.location.href = "/"}>
            <Icon as={Plus} size="sm" /> New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader size="md" color="neutral" /></div>
        ) : !data?.projects.length ? (
          <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-q-border-subtle p-8 text-center">
            <Folder className="size-12 text-q-text-tertiary" />
            <Typography as="p" variant="body-md-regular" color="secondary">No projects yet.</Typography>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((p) => (
              <div key={p.id} className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-4">
                <Typography as="h3" variant="label-md-medium" color="primary">{p.name}</Typography>
                <Typography as="p" variant="caption-sm-regular" color="secondary">{p.generationCount} generations</Typography>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}