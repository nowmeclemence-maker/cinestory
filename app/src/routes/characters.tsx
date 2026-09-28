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
import { Plus, Users, Pencil, Trash2, ImagePlus } from "lucide-react";
import { useFnfMediaClient } from "@higgsfield/fnf-react";
import { AppShell } from "@/layouts/app-shell";
import { AssetLibraryModal, type AssetLibraryItem } from "@/components/asset-library";
import { UploadField } from "@/components/upload-field";
import { mediaRefToAssetItem } from "@/lib/higgsfield-generation-results";
import { attachErrorMessage, attachReference } from "@/lib/character-references";
import { uploadAsset } from "@/lib/fnf.browser";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Character } from "@/lib/services/characters";

export const Route = createFileRoute("/characters")({
  component: CharactersPage,
});

const listCharactersFn = createServerFn({ method: "POST" }).handler(async () => {
  const { listCharacters } = await import("@/lib/services/characters");
  return listCharacters();
});
const createCharacterFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { createCharacter } = await import("@/lib/services/characters");
    return createCharacter({ name: data.name });
  });
const updateCharacterFn = createServerFn({ method: "POST" })
  .validator(z.any())
  .handler(async ({ data }) => {
    const { updateCharacter } = await import("@/lib/services/characters");
    return updateCharacter(data.id, data);
  });
const deleteCharacterFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { deleteCharacter } = await import("@/lib/services/characters");
    return deleteCharacter(data.id);
  });

/** The user's own photo (from their most recent story) for "Use my photo". */
const latestStoryPhotoFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getLatestStorySelfie } = await import("@/lib/services/characters");
  return getLatestStorySelfie();
});

function CharactersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Character | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: characters = [], isLoading } = useQuery({
    queryKey: ["characters"],
    queryFn: () => listCharactersFn(),
  });

  const createMut = useMutation({
    mutationFn: () => createCharacterFn({ data: { name: "New Character" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["characters"] }); toast.success("Character created"); },
  });

  const saveMut = useMutation({
    mutationFn: (data: Partial<Character>) => updateCharacterFn({ data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["characters"] }); toast.success("Saved"); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCharacterFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["characters"] }),
  });

  // ─── Reference photo ───────────────────────────────────────────────────────
  // The picker hands back an ALREADY-uploaded selection ({ ref, src }); `ref` is
  // what generation consumes. "Use my photo" fills from the user's own photo
  // (stories.selfie_ref) via their latest story. Both update local state, so the
  // modal's existing Save persists them — cancelling changes nothing.
  const addReference = (selection: { ref?: unknown; src: string }) => {
    if (!editing) return;
    const result = attachReference(editing.referenceImages, selection);
    if (!result.ok) {
      toast.error(attachErrorMessage(result.error));
      return;
    }
    setEditing({ ...editing, referenceImages: result.images });
    toast.success("Photo added — press Save to keep it");
  };

  // Named `applyMyPhoto`, not `useMyPhoto`: a `use*` prefix makes the linter
  // treat it as a React Hook and reject calling it from a handler.
  const applyMyPhoto = async () => {
    if (!editing) return;
    try {
      const mine = await latestStoryPhotoFn();
      if (!mine) {
        toast.error("No photo of you found yet — upload one here, or add yours when you start a story.");
        return;
      }
      setEditing({ ...editing, referenceImages: [...editing.referenceImages, mine] });
      toast.success("Your photo added — press Save to keep it");
    } catch {
      toast.error("Could not read your story photo.");
    }
  };

  const mediaClient = useFnfMediaClient();
  const { data: libraryItems = [] } = useQuery({
    queryKey: ["characters", "library", "images"],
    enabled: editing != null,
    queryFn: async () => {
      const page = await mediaClient.list({ type: "image", size: 40 });
      return page.items.map(mediaRefToAssetItem).filter((item): item is AssetLibraryItem => item != null);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">
              Character Library
            </Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
              Create and manage characters for your stories.
            </Typography>
          </div>
          <Button variant="marketingPrimary" onClick={() => createMut.mutate()}>
            <Icon as={Plus} size="sm" /> New Character
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader size="md" color="neutral" /></div>
        ) : characters.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-q-border-subtle p-8 text-center">
            <Users className="size-12 text-q-text-tertiary" />
            <Typography as="p" variant="body-md-regular" color="secondary">
              No characters yet. Create your first character to reuse across stories.
            </Typography>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((c) => (
              <div key={c.id} className="rounded-lg border border-q-border-subtle bg-q-background-secondary p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Typography as="h3" variant="label-md-medium" color="primary">{c.name}</Typography>
                    {c.age && <Typography as="p" variant="caption-sm-regular" color="secondary">{c.age} · {c.ethnicity}</Typography>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(c)} className="rounded p-1 hover:bg-q-transparent-light-10"><Pencil className="size-4" /></button>
                    <button onClick={() => { if (confirm("Delete?")) deleteMut.mutate(c.id); }} className="rounded p-1 hover:bg-q-transparent-light-10"><Trash2 className="size-4 text-q-text-danger" /></button>
                  </div>
                </div>
                {c.biography && <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2 line-clamp-2">{c.biography}</Typography>}
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        <Modal.Root open={editing != null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <Modal.Content size="lg">
            <Modal.Header>Edit Character</Modal.Header>
            {editing && (
              <div className="space-y-4 p-4">
                {/* Reference photo — the face generation keeps consistent. */}
                <div className="space-y-2 rounded-lg border border-q-border-subtle p-4">
                  <Typography as="p" variant="label-md-medium" color="primary">Reference photo</Typography>
                  <Typography as="p" variant="caption-sm-regular" color="secondary">
                    Upload a photo, pick one from your library, or use your own. Without one this character has no face to keep consistent across scenes.
                  </Typography>
                  <div className="flex flex-wrap items-center gap-3">
                    {editing.referenceImages.length > 0 ? (
                      <img
                        src={editing.referenceImages[0].src}
                        alt={editing.name}
                        className="size-20 rounded-lg border border-q-border-subtle object-cover"
                      />
                    ) : null}
                    <div className="min-w-56 flex-1">
                      <AssetLibraryModal
                        accept="image/*"
                        items={libraryItems}
                        onUpload={uploadAsset}
                        pagination={{}}
                        onSelect={addReference}
                        trigger={
                          <UploadField
                            render={<button type="button" />}
                            icon={ImagePlus}
                            title={editing.referenceImages.length > 0 ? "Replace photo" : "Add photo"}
                            subtitle="Upload or pick from your library"
                          />
                        }
                      />
                    </div>
                    <Button variant="tertiary" size="sm" onClick={() => void applyMyPhoto()}>
                      <Icon as={ImagePlus} size="sm" /> Use my photo
                    </Button>
                  </div>
                </div>
                <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <Textarea label="Biography" value={editing.biography} onChange={(e) => setEditing({ ...editing, biography: e.target.value })} />
                <Textarea label="Appearance" value={editing.appearance} onChange={(e) => setEditing({ ...editing, appearance: e.target.value })} />
                <Textarea label="Personality" value={editing.personality} onChange={(e) => setEditing({ ...editing, personality: e.target.value })} />
                <Textarea label="Clothing" value={editing.clothing} onChange={(e) => setEditing({ ...editing, clothing: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Age" value={editing.age} onChange={(e) => setEditing({ ...editing, age: e.target.value })} />
                  <Input label="Ethnicity" value={editing.ethnicity} onChange={(e) => setEditing({ ...editing, ethnicity: e.target.value })} />
                </div>
                <Textarea label="Relationships" value={editing.relationships} onChange={(e) => setEditing({ ...editing, relationships: e.target.value })} />
                <Textarea label="Reusable Prompts" value={editing.reusablePrompts} onChange={(e) => setEditing({ ...editing, reusablePrompts: e.target.value })} />
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