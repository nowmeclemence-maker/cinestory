import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Input } from "@higgsfield/quanta/input";
import { Textarea } from "@higgsfield/quanta/textarea";
import { Loader } from "@higgsfield/quanta/loader";
import { toast } from "@higgsfield/quanta/sonner";
import {
  ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Wand2, Check,
  Clapperboard, Film, Camera, RefreshCw, Coins, UserRound, ImagePlus, Users,
} from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { StepBar } from "@/components/story/step-bar";
import {
  getStoryFn, updateScriptFn, regenerateScriptFn, validateScriptFn, validateStoryboardFn,
  regenerateSceneImageFn, listStoryCharactersFn, proposeCharactersFn, linkCharacterFn,
  unlinkCharacterFn, generateCharacterPortraitFn, validateCharactersFn, addCharacterImageFn,
  listLibraryCharactersFn,
} from "@/lib/story.functions";
import { uploadAsset } from "@/lib/fnf.browser";
import type { StoryDTO, SceneDTO } from "@/lib/story-engine.server";
import type { CastMemberDTO } from "@/lib/story-engine.server";
import { sceneDurationSeconds, videoClipCostCredits } from "@/lib/story-templates";

export const Route = createFileRoute("/workspace")({
  component: WorkspacePage,
  validateSearch: (search: Record<string, unknown>) => ({
    story: typeof search.story === "string" ? search.story : undefined,
  }),
});

interface SceneEdit {
  id: string;
  description: string;
  camera: string;
  dialogue: string;
  onScreenText: string;
}

function WorkspacePage() {
  const { story: storyId } = Route.useSearch();
  const qc = useQueryClient();
  const [editor, setEditor] = useState<{ title: string; hook: string; cta: string; scenes: SceneEdit[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [regeneratingScene, setRegeneratingScene] = useState<string | null>(null);
  const [castBusy, setCastBusy] = useState<string | null>(null);

  const { data: story, isLoading } = useQuery({
    queryKey: ["workspace", storyId],
    queryFn: () => getStoryFn({ data: { storyId: storyId! } }),
    enabled: !!storyId,
    refetchInterval: (query) => {
      const s = query.state.data as StoryDTO | undefined;
      if (!s) return false;
      if (s.status === "generating" || s.status === "assembling") return 4000;
      if (s.status === "storyboard") {
        const final = s.scenes.every((scene) => scene.status === "image_ready" || scene.status === "failed");
        return final ? false : 4000;
      }
      return false;
    },
  });

  const atCasting = story?.status === "characters";
  const { data: cast = [] } = useQuery({
    queryKey: ["workspace", storyId, "cast"],
    queryFn: () => listStoryCharactersFn({ data: { storyId: storyId! } }),
    enabled: !!storyId && atCasting,
    refetchInterval: (query) => {
      const c = query.state.data as CastMemberDTO[] | undefined;
      if (c && c.some((member) => member.portraitJobId)) return 3000;
      return false;
    },
  });
  const { data: libraryCharacters = [] } = useQuery({
    queryKey: ["characters", "library"],
    queryFn: () => listLibraryCharactersFn(),
    enabled: atCasting,
  });
  const availableCharacters = libraryCharacters.filter(
    (candidate) => !cast.some((member) => member.characterId === candidate.id),
  );

  // Load draft content into the editor once the story lands in the Script step.
  useEffect(() => {
    if (!story || story.status !== "draft") {
      setEditor(null);
      return;
    }
    setEditor({
      title: story.title ?? "",
      hook: story.hook ?? "",
      cta: story.cta ?? "",
      scenes: story.scenes.map((scene) => ({
        id: scene.id,
        description: scene.description,
        camera: scene.camera ?? "",
        dialogue: scene.dialogue ?? "",
        onScreenText: scene.onScreenText ?? "",
      })),
    });
  }, [story?.id, story?.status]);

  const sceneCount = useMemo(
    () => (story && story.status === "draft" ? (editor?.scenes.length ?? story.sceneCount) : story?.sceneCount ?? 0),
    [editor, story],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace", storyId] });

  const patchScene = (idx: number, patch: Partial<SceneEdit>) => {
    setEditor((current) => {
      if (!current) return current;
      const scenes = current.scenes.map((scene, i) => (i === idx ? { ...scene, ...patch } : scene));
      return { ...current, scenes };
    });
  };

  const addScene = () => {
    setEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        scenes: [...current.scenes, { id: `local-${Date.now()}`, description: "", camera: "slow push in", dialogue: "", onScreenText: "" }],
      };
    });
  };

  const removeScene = (idx: number) => {
    setEditor((current) => {
      if (!current) return current;
      return { ...current, scenes: current.scenes.filter((_, i) => i !== idx) };
    });
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    setEditor((current) => {
      if (!current) return current;
      const scenes = [...current.scenes];
      const target = idx + dir;
      if (target < 0 || target >= scenes.length) return current;
      [scenes[idx], scenes[target]] = [scenes[target], scenes[idx]];
      return { ...current, scenes };
    });
  };

  const handleSave = async () => {
    if (!story || !editor || editor.scenes.length === 0) return;
    setSaving(true);
    try {
      await updateScriptFn({
        data: {
          storyId: story.id,
          title: editor.title.trim() || "Untitled story",
          hook: editor.hook,
          cta: editor.cta,
          scenes: editor.scenes.map((scene, idx) => ({
            idx,
            description: scene.description,
            camera: scene.camera,
            dialogue: scene.dialogue,
            onScreenText: scene.onScreenText,
          })),
        },
      });
      await invalidate();
      toast.success("Script saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the script.");
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!story) return;
    if (story.status === "draft") await handleSave();
    setValidating(true);
    try {
      await validateScriptFn({ data: { storyId: story.id } });
      await invalidate();
      toast.success("Script validated — building the storyboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not validate the script.");
    } finally {
      setValidating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!story || story.status !== "draft") return;
    if (!confirm("Rewrite the whole script with AI? Your edits will be replaced.")) return;
    setRegenerating(true);
    try {
      await regenerateScriptFn({ data: { storyId: story.id } });
      await invalidate();
      toast.success("Script regenerated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not regenerate the script.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleValidateStoryboard = async () => {
    if (!story || story.status !== "storyboard") return;
    setStageError(null);
    setValidating(true);
    try {
      await validateStoryboardFn({ data: { storyId: story.id } });
      await invalidate();
      toast.success("Storyboard validated — recording your scenes");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not validate the storyboard.";
      setStageError(message);
      toast.error(message);
    } finally {
      setValidating(false);
    }
  };

  const handleRegenerateSceneImage = async (sceneId: string) => {
    if (!story || story.status !== "storyboard") return;
    setStageError(null);
    setRegeneratingScene(sceneId);
    try {
      await regenerateSceneImageFn({ data: { storyId: story.id, sceneId } });
      await invalidate();
      toast.success("Regenerating storyboard image…");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not regenerate the image.";
      setStageError(message);
      toast.error(message);
    } finally {
      setRegeneratingScene(null);
    }
  };

  const refreshCast = () => qc.invalidateQueries({ queryKey: ["workspace", storyId, "cast"] });

  const handleProposeCast = async () => {
    if (!story || story.status !== "characters") return;
    setCastBusy("propose");
    setStageError(null);
    try {
      await proposeCharactersFn({ data: { storyId: story.id } });
      await refreshCast();
      toast.success("Cast proposed — add photos or generate portraits");
    } catch (error) {
      getStageError(error);
    } finally {
      setCastBusy(null);
    }
  };

  const handleLinkCharacter = async (characterId: string) => {
    if (!story) return;
    setCastBusy(characterId);
    setStageError(null);
    try {
      await linkCharacterFn({ data: { storyId: story.id, characterId } });
      await refreshCast();
      toast.success("Character added to the cast");
    } catch (error) {
      getStageError(error);
    } finally {
      setCastBusy(null);
    }
  };

  const handleUnlinkCharacter = async (characterId: string) => {
    if (!story) return;
    setCastBusy(characterId);
    setStageError(null);
    try {
      await unlinkCharacterFn({ data: { storyId: story.id, characterId } });
      await refreshCast();
    } catch (error) {
      getStageError(error);
    } finally {
      setCastBusy(null);
    }
  };

  const handleGeneratePortrait = async (characterId: string) => {
    if (!story) return;
    setCastBusy(characterId);
    setStageError(null);
    try {
      await generateCharacterPortraitFn({ data: { storyId: story.id, characterId } });
      await refreshCast();
      toast.success("Generating portrait…");
    } catch (error) {
      getStageError(error);
    } finally {
      setCastBusy(null);
    }
  };

  const handleUploadPhoto = async (characterId: string, file: File) => {
    if (!story) return;
    setCastBusy(characterId);
    setStageError(null);
    try {
      const uploaded = await uploadAsset(file);
      await addCharacterImageFn({
        data: { characterId, ref: uploaded.ref, src: uploaded.src },
      });
      await refreshCast();
      toast.success("Photo added — the character will be consistent from this face");
    } catch (error) {
      getStageError(error);
    } finally {
      setCastBusy(null);
    }
  };

  const handleValidateCharacters = async () => {
    if (!story || story.status !== "characters") return;
    setStageError(null);
    setValidating(true);
    try {
      await validateCharactersFn({ data: { storyId: story.id } });
      await invalidate();
      toast.success("Casting validated — building the storyboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not validate the cast.";
      setStageError(message);
      toast.error(message);
    } finally {
      setValidating(false);
    }
  };

  const getStageError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    setStageError(message);
    toast.error(message);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {!storyId ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-q-border-subtle p-8 text-center">
            <Clapperboard className="size-10 text-q-text-tertiary" />
            <Typography as="p" variant="body-md-regular" color="secondary">
              Pick a story to work on.
            </Typography>
            <a href="/dashboard">
              <Button variant="primary">Go to Dashboard</Button>
            </a>
          </div>
        ) : isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader size="md" color="neutral" aria-label="Loading story" />
          </div>
        ) : story ? (
          <>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <a href="/studio" aria-label="Back to stories" className="text-q-text-secondary hover:text-q-text-primary">
                  <Icon as={ArrowLeft} size="md" />
                </a>
                <div>
                  <Typography as="h1" variant="title-lg-semi-bold" color="primary">
                    Story Workspace
                  </Typography>
                  <Typography as="p" variant="body-sm-regular" color="secondary" truncate>
                    {story.title ?? story.idea} · {story.templateTitle} · ~{Math.round(story.estimatedCost)} credits
                  </Typography>
                </div>
              </div>
              {story.status === "ready" && story.finalVideoUrl && (
                <a href="/studio">
                  <Button variant="tertiary">Back to stories</Button>
                </a>
              )}
            </div>

            {/* Step bar */}
            <StepBar currentStep={story.currentStep} />

            {story.status === "draft" && editor ? (
              <ScriptEditor
                editor={editor}
                sceneCount={sceneCount}
                saving={saving}
                validating={validating}
                regenerating={regenerating}
                onTitle={(title) => setEditor({ ...editor, title })}
                onHook={(hook) => setEditor({ ...editor, hook })}
                onCta={(cta) => setEditor({ ...editor, cta })}
                onPatchScene={patchScene}
                onAddScene={addScene}
                onRemoveScene={removeScene}
                onMoveScene={moveScene}
                onSave={() => void handleSave()}
                onValidate={() => void handleValidate()}
                onRegenerate={() => void handleRegenerate()}
              />
            ) : story.status === "characters" ? (
              <CastingView
                story={story}
                cast={cast}
                availableCharacters={availableCharacters}
                busy={castBusy}
                validating={validating}
                error={stageError}
                onPropose={() => void handleProposeCast()}
                onLink={(characterId) => void handleLinkCharacter(characterId)}
                onUnlink={(characterId) => void handleUnlinkCharacter(characterId)}
                onPortrait={(characterId) => void handleGeneratePortrait(characterId)}
                onUploadPhoto={(characterId, file) => void handleUploadPhoto(characterId, file)}
                onValidate={() => void handleValidateCharacters()}
              />
            ) : story.status === "storyboard" ? (
              <StoryboardView
                story={story}
                error={stageError}
                validating={validating}
                regeneratingScene={regeneratingScene}
                onValidate={() => void handleValidateStoryboard()}
                onRegenerateImage={(sceneId) => void handleRegenerateSceneImage(sceneId)}
              />
            ) : story.status === "generating" || story.status === "assembling" ? (
              <ProductionView story={story} />
            ) : story.status === "ready" && story.finalVideoUrl ? (
              <ReadyView story={story} />
            ) : story.status === "failed" ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
                <Typography as="h3" variant="title-sm-semi-bold" color="danger">
                  This story stopped
                </Typography>
                <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
                  {story.error ?? "An unknown error happened during production."}
                </Typography>
                <div className="mt-4 flex gap-2">
                  <a href="/studio"><Button variant="tertiary">Back to stories</Button></a>
                  <a href={`/dashboard`}><Button variant="primary">Dashboard</Button></a>
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <Loader size="md" color="neutral" />
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

// ─── Script editor (Lot A) ──────────────────────────────────────────────────

function ScriptEditor({
  editor, sceneCount, saving, validating, regenerating,
  onTitle, onHook, onCta, onPatchScene, onAddScene, onRemoveScene, onMoveScene,
  onSave, onValidate, onRegenerate,
}: {
  editor: { title: string; hook: string; cta: string; scenes: SceneEdit[] };
  sceneCount: number;
  saving: boolean;
  validating: boolean;
  regenerating: boolean;
  onTitle: (v: string) => void;
  onHook: (v: string) => void;
  onCta: (v: string) => void;
  onPatchScene: (idx: number, patch: Partial<SceneEdit>) => void;
  onAddScene: () => void;
  onRemoveScene: (idx: number) => void;
  onMoveScene: (idx: number, dir: -1 | 1) => void;
  onSave: () => void;
  onValidate: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Title + hook */}
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Input label="Story title" value={editor.title} onChange={(e) => onTitle(e.target.value)} />
          <Input label="Call to action (optional)" value={editor.cta} onChange={(e) => onCta(e.target.value)} />
        </div>
        <div className="mt-4">
          <Textarea
            label="Opening hook"
            description="The first line the viewer hears or reads."
            value={editor.hook}
            onChange={(e) => onHook(e.target.value)}
            className="min-h-[84px]"
          />
        </div>
      </div>

      {/* Scenes */}
      <div className="flex items-center justify-between">
        <Typography as="h2" variant="title-sm-semi-bold" color="primary">
          Scenes ({sceneCount})
        </Typography>
        <Button variant="tertiary" size="sm" onClick={onAddScene}>
          <Icon as={Plus} size="sm" /> Add scene
        </Button>
      </div>

      <div className="space-y-3">
        {editor.scenes.map((scene, idx) => (
          <div key={scene.id} className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
            <div className="flex items-center justify-between">
              <Typography as="h3" variant="label-md-medium" color="primary">
                Scene {idx + 1}
              </Typography>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Move scene up" className="rounded p-1 text-q-text-secondary hover:bg-q-transparent-light-10" onClick={() => onMoveScene(idx, -1)} disabled={idx === 0}>
                  <Icon as={ArrowUp} size="sm" />
                </button>
                <button type="button" aria-label="Move scene down" className="rounded p-1 text-q-text-secondary hover:bg-q-transparent-light-10" onClick={() => onMoveScene(idx, 1)} disabled={idx === editor.scenes.length - 1}>
                  <Icon as={ArrowDown} size="sm" />
                </button>
                <button type="button" aria-label="Delete scene" className="rounded p-1 text-q-text-danger hover:bg-q-transparent-light-10" onClick={() => onRemoveScene(idx)}>
                  <Icon as={Trash2} size="sm" />
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <Textarea
                label="What happens"
                description="Visual description of the scene."
                value={scene.description}
                onChange={(e) => onPatchScene(idx, { description: e.target.value })}
                className="min-h-[72px]"
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input label="Camera direction" value={scene.camera} onChange={(e) => onPatchScene(idx, { camera: e.target.value })} />
                <Input label="On-screen text" value={scene.onScreenText} onChange={(e) => onPatchScene(idx, { onScreenText: e.target.value })} />
              </div>
              <Input label="Dialogue / narration" value={scene.dialogue} onChange={(e) => onPatchScene(idx, { dialogue: e.target.value })} />
            </div>
          </div>
        ))}
        {editor.scenes.length === 0 && (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-q-border-subtle text-q-text-tertiary">
            No scenes yet — add one to start building the film.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-1 rounded-xl border border-q-border-subtle bg-q-background-primary/90 p-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="tertiary" size="md" disabled={regenerating} onClick={onRegenerate}>
            {regenerating ? <Loader size="xs" color="neutral" /> : <Icon as={Wand2} size="sm" />}
            Regenerate with AI
          </Button>
          <Button variant="secondary" size="md" disabled={saving || editor.scenes.length === 0} onClick={onSave}>
            {saving ? <Loader size="xs" color="neutral" /> : <Icon as={Check} size="sm" />}
            Save
          </Button>
          <Button variant="marketingPrimary" size="md" disabled={validating || editor.scenes.length === 0 || !editor.title.trim()} onClick={onValidate}>
            {validating ? <Loader size="xs" color="neutral" /> : <Icon as={Film} size="sm" />}
            Validate script & start production
          </Button>
        </div>
        <p className="mt-2 text-right text-xs text-q-text-tertiary">
          {editor.scenes.length} scene{editor.scenes.length === 1 ? "" : "s"} · production starts only after validation.
        </p>
      </div>
    </div>
  );
}

// ─── Casting (Lot C) ────────────────────────────────────────────────────────

type LibraryCharacter = { id: string; name: string; role: string; appearance: string };

function CastingView({
  story, cast, availableCharacters, busy, validating, error,
  onPropose, onLink, onUnlink, onPortrait, onUploadPhoto, onValidate,
}: {
  story: StoryDTO;
  cast: CastMemberDTO[];
  availableCharacters: LibraryCharacter[];
  busy: string | null;
  validating: boolean;
  error: string | null;
  onPropose: () => void;
  onLink: (characterId: string) => void;
  onUnlink: (characterId: string) => void;
  onPortrait: (characterId: string) => void;
  onUploadPhoto: (characterId: string, file: File) => void;
  onValidate: () => void;
}) {
  const imageCost = story.sceneCount * 1.5;
  const allHavePhotos = cast.length > 0 && cast.every((m) => m.hasReference || m.portraitJobId);
  const canValidate = cast.length === 0 || allHavePhotos;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography as="h2" variant="title-sm-semi-bold" color="primary">Cast</Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
              Up to 3 characters · storyboard images cost ~{Math.round(imageCost)} credits · every cast member appears in every scene (per-scene casting arrives with Lot D).
            </Typography>
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-500" role="alert">
            {error}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {cast.length === 0 && (
            <Button variant="marketingPrimary" size="md" disabled={busy === "propose"} onClick={onPropose}>
              {busy === "propose" ? <Loader size="xs" color="neutral" /> : <Icon as={Wand2} size="sm" />}
              Propose cast with AI
            </Button>
          )}
          {availableCharacters.length > 0 && cast.length < 3 && (
            <select
              aria-label="Add a character from your library"
              className="rounded-lg border border-q-border-subtle bg-q-background-secondary px-3 py-2 text-sm text-q-text-primary"
              value=""
              onChange={(e) => {
                if (e.target.value) onLink(e.target.value);
              }}
            >
              <option value="" disabled>Add from library…</option>
              {availableCharacters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}{character.role ? ` — ${character.role}` : ""}
                </option>
              ))}
            </select>
          )}
          {cast.length > 0 && (
            <Button
              variant="marketingPrimary"
              size="md"
              disabled={validating || !canValidate}
              onClick={onValidate}
            >
              {validating ? <Loader size="xs" color="neutral" /> : <Icon as={Film} size="sm" />}
              {cast.length === 0
                ? `Validate cast & build storyboard (~${Math.round(imageCost)} credits)`
                : allHavePhotos
                  ? `Validate cast & build storyboard (~${Math.round(imageCost)} credits)`
                  : "Waiting for all cast photos…"}
            </Button>
          )}
        </div>
      </div>

      {cast.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-q-border-subtle text-center">
          <Users className="size-8 text-q-text-tertiary" />
          <Typography as="p" variant="body-sm-regular" color="secondary">
            Let the AI deduce the cast from your script, or add characters from your library.
          </Typography>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cast.map((member) => {
            const isBusy = busy === member.characterId;
            return (
              <div key={member.characterId} className="overflow-hidden rounded-xl border border-q-border-subtle bg-q-background-secondary">
                {member.portraitUrl ? (
                  <img src={member.portraitUrl} alt={member.name} className="aspect-[3/4] w-full object-cover" />
                ) : member.portraitJobId ? (
                  <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 bg-q-background-secondary">
                    <Loader size="sm" color="neutral" />
                    <span className="text-xs text-q-text-secondary">Generating portrait…</span>
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center bg-q-background-secondary">
                    <UserRound className="size-8 text-q-text-tertiary" />
                  </div>
                )}
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Typography as="h3" variant="label-md-medium" color="primary" truncate>
                        {member.name}
                      </Typography>
                      {member.role && (
                        <Typography as="p" variant="caption-sm-regular" color="secondary" truncate>
                          {member.role}
                        </Typography>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${member.name} from the cast`}
                      disabled={isBusy || validating}
                      className="rounded p-1 text-q-text-secondary hover:bg-q-transparent-light-10 disabled:opacity-50"
                      onClick={() => onUnlink(member.characterId)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {(member.appearance || member.clothing) && (
                    <Typography as="p" variant="caption-sm-regular" color="secondary" className="line-clamp-2">
                      {[member.appearance, member.clothing ? `wears ${member.clothing}` : ""].filter(Boolean).join(" · ")}
                    </Typography>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {!member.hasReference && !member.portraitJobId && (
                      <>
                        <label className="cursor-pointer rounded-lg border border-q-border-subtle px-2.5 py-1.5 text-xs font-medium text-q-text-secondary hover:bg-q-transparent-light-10">
                          <span className="flex items-center gap-1">
                            {isBusy ? <Loader size="xs" color="neutral" /> : <Icon as={ImagePlus} size="sm" />}
                            Add photo
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isBusy || validating}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onUploadPhoto(member.characterId, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <Button variant="tertiary" size="sm" disabled={isBusy || validating} onClick={() => onPortrait(member.characterId)}>
                          {isBusy ? <Loader size="xs" color="neutral" /> : <Icon as={Wand2} size="sm" />}
                          Generate portrait (1.5)
                        </Button>
                      </>
                    )}
                    {member.portraitJobId && (
                      <span className="text-xs text-q-text-tertiary">Portrait queued…</span>
                    )}
                    {member.hasReference && !member.portraitJobId && (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500">
                        Reference ready
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Storyboard (Lot B) ──────────────────────────────────────────────────────

function StoryboardView({
  story, error, validating, regeneratingScene,
  onValidate, onRegenerateImage,
}: {
  story: StoryDTO;
  error: string | null;
  validating: boolean;
  regeneratingScene: string | null;
  onValidate: () => void;
  onRegenerateImage: (sceneId: string) => void;
}) {
  const secondsPerScene = sceneDurationSeconds(story.durationSec, story.sceneCount);
  const videoCost = story.scenes.length * videoClipCostCredits(secondsPerScene);
  const allReady = story.scenes.length > 0 && story.scenes.every((s) => s.status === "image_ready");
  const failedAny = story.scenes.some((s) => s.status === "failed");

  return (
    <div className="space-y-4">
      {/* Cost + gate info */}
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography as="h2" variant="title-sm-semi-bold" color="primary">
              Storyboard
            </Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
              One image per scene · {secondsPerScene}s clip per scene · videos cost ~{Math.round(videoCost)} credits
            </Typography>
          </div>
          {failedAny && (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-500">
              Regenerate failed images before launching
            </span>
          )}
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-500" role="alert">
            {error}
          </div>
        )}
        <div className="mt-4">
          <Button
            variant="marketingPrimary"
            size="md"
            disabled={!allReady || validating}
            onClick={onValidate}
          >
            {validating ? <Loader size="xs" color="neutral" /> : <Icon as={Film} size="sm" />}
            {allReady ? `Validate storyboard & record (${Math.round(videoCost)} credits)` : "Waiting for all images…"}
          </Button>
        </div>
      </div>

      {/* Per-image grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {story.scenes.map((scene) => {
          const busy = regeneratingScene === scene.id;
          return (
            <div key={scene.id} className="overflow-hidden rounded-xl border border-q-border-subtle bg-q-background-secondary">
              {scene.imageUrl ? (
                <img src={scene.imageUrl} alt={`Storyboard ${scene.idx + 1}`} className="aspect-[9/16] w-full object-cover" />
              ) : (
                <div className="flex aspect-[9/16] w-full items-center justify-center bg-q-background-secondary">
                  {scene.status === "failed" ? (
                    <Typography as="p" variant="caption-sm-regular" color="danger" className="px-3 text-center">
                      {scene.error ?? "Failed"}
                    </Typography>
                  ) : (
                    <Loader size="sm" color="neutral" aria-label={`Generating scene ${scene.idx + 1}`} />
                  )}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 p-2.5">
                <span className="text-xs font-medium text-q-text-primary">Scene {scene.idx + 1}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                    scene.status === "image_ready" ? "bg-emerald-500/10 text-emerald-500" :
                    scene.status === "failed" ? "bg-red-500/10 text-red-500" :
                    "bg-q-transparent-light-10 text-q-text-secondary"
                  }`}>
                    {scene.status === "image_ready" ? "Ready" : scene.status === "failed" ? "Failed" : "Generating"}
                  </span>
                  {scene.status !== "image_generating" && (
                    <button
                      type="button"
                      disabled={busy || validating}
                      onClick={() => onRegenerateImage(scene.id)}
                      aria-label={`Regenerate image for scene ${scene.idx + 1}`}
                      title="Regenerate this image (1.5 credits)"
                      className="rounded p-1 text-q-text-secondary hover:bg-q-transparent-light-10 disabled:opacity-50"
                    >
                      {busy ? <Loader size="xs" color="neutral" /> : <Icon as={RefreshCw} size="sm" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-q-text-tertiary">
        <Icon as={Coins} size="sm" />
        Regenerating an image costs 1.5 credits. Reorder the scenes in the Script step if needed.
      </div>
    </div>
  );
}

// ─── Production progress ─────────────────────────────────────────────────────

function ProductionView({ story }: { story: StoryDTO }) {
  const done = story.scenes.filter((s) => s.status === "ready").length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <Loader size="sm" color="neutral" />
        <div className="flex-1">
          <Typography as="p" variant="label-md-medium" color="primary">
            {story.progressLabel ?? "Production running…"}
          </Typography>
          <Typography as="p" variant="caption-sm-regular" color="secondary">
            {done} of {story.scenes.length} scenes finished
          </Typography>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {story.scenes.map((scene) => (
          <SceneCard key={scene.id} scene={scene} idx={scene.idx} />
        ))}
      </div>
    </div>
  );
}

function SceneCard({ scene, idx }: { scene: SceneDTO; idx: number }) {
  const media = scene.videoUrl ?? scene.imageUrl;
  return (
    <div className="overflow-hidden rounded-xl border border-q-border-subtle bg-q-background-secondary">
      {media ? (
        scene.videoUrl ? (
          <video src={scene.videoUrl} className="aspect-[9/16] w-full object-cover" muted playsInline />
        ) : (
          <img src={media} alt={`Scene ${idx + 1}`} className="aspect-[9/16] w-full object-cover" />
        )
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center bg-q-background-secondary">
          <Camera className="size-6 text-q-text-tertiary" />
        </div>
      )}
      <div className="flex items-center justify-between p-2.5">
        <span className="text-xs font-medium text-q-text-primary">Scene {idx + 1}</span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
          scene.status === "ready" ? "bg-emerald-500/10 text-emerald-500" :
          scene.status === "failed" ? "bg-red-500/10 text-red-500" :
          "bg-q-transparent-light-10 text-q-text-secondary"
        }`}>
          {scene.status === "ready" ? "Done" : scene.status === "failed" ? scene.error ?? "Failed" : scene.status}
        </span>
      </div>
    </div>
  );
}

// ─── Ready ───────────────────────────────────────────────────────────────────

function ReadyView({ story }: { story: StoryDTO }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="overflow-hidden rounded-xl border border-q-border-subtle lg:col-span-2">
        <video
          src={story.finalVideoUrl ?? undefined}
          controls
          playsInline
          poster={story.finalPosterUrl ?? undefined}
          className="aspect-[9/16] max-h-[70vh] w-full bg-black object-contain"
        />
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-5">
          <Typography as="h3" variant="title-sm-semi-bold" color="primary">
            {story.title}
          </Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2 line-clamp-4">
            {story.idea}
          </Typography>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-q-brand-primary/10 px-3 py-1 text-xs text-q-brand-primary">{story.templateTitle}</span>
            <span className="rounded-full bg-q-transparent-light-10 px-3 py-1 text-xs">{story.durationSec}s</span>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-500">Ready</span>
          </div>
        </div>
        <a href={story.finalVideoUrl ?? "#"} download="cinestory.mp4">
          <Button variant="marketingPrimary" className="w-full">
            <Icon as={Film} size="sm" /> Download MP4
          </Button>
        </a>
        <a href="/exports">
          <Button variant="tertiary" className="w-full">
            Export center
          </Button>
        </a>
      </div>
    </div>
  );
}