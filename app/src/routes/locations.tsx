import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Input } from "@higgsfield/quanta/input";
import { Textarea } from "@higgsfield/quanta/textarea";
import { Modal } from "@higgsfield/quanta/modal";
import { Loader } from "@higgsfield/quanta/loader";
import { toast } from "@higgsfield/quanta/sonner";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listLocations, createLocation, updateLocation, deleteLocation } from "@/lib/services/locations";
import type { Location } from "@/lib/services/locations";

export const Route = createFileRoute("/locations")({
  component: LocationsPage,
});

const listLocationsFn = createServerFn({ method: "POST" }).handler(() => listLocations());
const createLocationFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1) }))
  .handler(({ data }) => createLocation({ name: data.name }));
const updateLocationFn = createServerFn({ method: "POST" })
  .validator(z.any())
  .handler(({ data }) => updateLocation(data.id, data));
const deleteLocationFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => deleteLocation(data.id));

function LocationsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Location | null>(null);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocationsFn(),
  });

  const createMut = useMutation({
    mutationFn: () => createLocationFn({ data: { name: "New Location" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); toast.success("Location created"); },
  });

  const saveMut = useMutation({
    mutationFn: (data: Partial<Location>) => updateLocationFn({ data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); toast.success("Saved"); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLocationFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">Location Library</Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
              Save reusable locations with mood, lighting, and prompt presets.
            </Typography>
          </div>
          <Button variant="marketingPrimary" onClick={() => createMut.mutate()}><Icon as={Plus} size="sm" /> New Location</Button>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader size="md" color="neutral" /></div>
        ) : locations.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-q-border-subtle p-8 text-center">
            <MapPin className="size-12 text-q-text-tertiary" />
            <Typography as="p" variant="body-md-regular" color="secondary">No locations saved yet.</Typography>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => (
              <div key={loc.id} className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-4">
                <div className="flex items-start justify-between">
                  <Typography as="h3" variant="label-md-medium" color="primary">{loc.name}</Typography>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(loc)} className="rounded p-1 hover:bg-q-transparent-light-10"><Pencil className="size-4" /></button>
                    <button onClick={() => { if (confirm("Delete?")) deleteMut.mutate(loc.id); }} className="rounded p-1 hover:bg-q-transparent-light-10"><Trash2 className="size-4 text-q-text-danger" /></button>
                  </div>
                </div>
                {loc.description && <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2 line-clamp-2">{loc.description}</Typography>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {loc.mood && <span className="rounded-full bg-q-brand-primary/10 px-2 py-0.5 text-xs text-q-brand-primary">{loc.mood}</span>}
                  {loc.lighting && <span className="rounded-full bg-q-transparent-light-10 px-2 py-0.5 text-xs">{loc.lighting}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal.Root open={editing != null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <Modal.Content size="lg">
            <Modal.Header>Edit Location</Modal.Header>
            {editing && (
              <div className="space-y-4 p-4">
                <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <Textarea label="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Mood" value={editing.mood} onChange={(e) => setEditing({ ...editing, mood: e.target.value })} />
                  <Input label="Lighting" value={editing.lighting} onChange={(e) => setEditing({ ...editing, lighting: e.target.value })} />
                  <Input label="Weather" value={editing.weather} onChange={(e) => setEditing({ ...editing, weather: e.target.value })} />
                  <Input label="Architecture" value={editing.architecture} onChange={(e) => setEditing({ ...editing, architecture: e.target.value })} />
                </div>
                <Textarea label="Prompt Presets" value={editing.promptPresets} onChange={(e) => setEditing({ ...editing, promptPresets: e.target.value })} />
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="tertiary" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button variant="primary" onClick={() => saveMut.mutate(editing)}>Save</Button>
                </div>
              </div>
            )}
          </Modal.Content>
        </Modal.Root>
      </div>
    </AppShell>
  );
}