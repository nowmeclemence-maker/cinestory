import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Input } from "@higgsfield/quanta/input";
import { Tabs } from "@higgsfield/quanta/tabs";
import { Loader } from "@higgsfield/quanta/loader";
import { Image, Video, Music, FileText, Search, FolderPlus } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/assets")({
  component: AssetsPage,
});

const TYPES = [
  { value: "all", label: "All" },
  { value: "image", label: "Images", icon: Image },
  { value: "video", label: "Videos", icon: Video },
  { value: "audio", label: "Audio", icon: Music },
  { value: "document", label: "Documents", icon: FileText },
];

function AssetsPage() {
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">AI Assets</Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
              Manage all your media — images, videos, audio, and documents.
            </Typography>
          </div>
          <Button variant="tertiary"><Icon as={FolderPlus} size="sm" /> New Folder</Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              start={<Icon as={Search} size="sm" />}
            />
          </div>
          <Tabs.Root value={type} onValueChange={(v) => setType(String(v))}>
            <Tabs.List items={TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          </Tabs.Root>
        </div>
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-q-border-subtle">
          <div className="text-center">
            <Image className="mx-auto size-8 text-q-text-tertiary" />
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
              Upload assets from the Studio or drag files here.
            </Typography>
          </div>
        </div>
      </div>
    </AppShell>
  );
}