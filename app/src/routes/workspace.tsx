import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFnfMediaClient } from "@higgsfield/fnf-react";
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
  Volume2, Music as IconMusic, Mic, Upload, RotateCcw,
} from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { StepBar } from "@/components/story/step-bar";
import { AssetLibraryModal, type AssetLibraryItem } from "@/components/asset-library";
import { UploadField } from "@/components/upload-field";
import { mediaRefToAssetItem } from "@/lib/higgsfield-generation-results";
import { attachErrorMessage, isAttachable } from "@/lib/character-references";
import {
  getStoryFn, updateScriptFn, regenerateScriptFn, validateScriptFn, validateStoryboardFn,
  regenerateSceneImageFn, listStoryCharactersFn, proposeCharactersFn, linkCharacterFn,
  unlinkCharacterFn, generateCharacterPortraitFn, validateCharactersFn, addCharacterImageFn,
  applySelfieReferenceFn,
  listLibraryCharactersFn, proposeLocationsFn, setSceneLocationFn, generateSceneLocationFn,
  validateLocationsFn, setSceneDialogueFn, setStoryMusicFn, setStoryVoiceoverFn, validateAudioFn,
  listMusicTracksFn, createMusicTrackFn, remasterStoryFn,
} from "@/lib/story.functions";
import { uploadAsset, uploadAudioAsset } from "@/lib/fnf.browser";
import { triggerAssembly } from "@/lib/story.browser";
import { MUSIC_PRESETS } from "@/lib/music-presets";
import type { StoryDTO, SceneDTO } from "@/lib/story-engine.server";
import type { CastMemberDTO } from "@/lib/story-engine.server";
import { sceneDurationSeconds, STORY_LOCATIONS, videoClipCostCredits } from "@/lib/story-templates";

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
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [regeneratingScene, setRegeneratingScene] = useState<string | null>(null);
  const [castBusy, setCastBusy] = useState<string | null>(null);
  const [remastering, setRemastering] = useState(false);

  const { data: story, isLoading } = useQuery({
    queryKey: ["workspace", storyId],
    queryFn: () => getStoryFn({ data: { storyId: storyId! } }),
    enabled: !!storyId,
    refetchInterval: (query) => {
      const s = query.state.data as StoryDTO | undefined;
      if (!s) return false;
      if (s.status === "generating" || s.status === "assembling") return 4000;
      if (s.status === "locations") {
        const pendingSet = s.scenes.some((scene) => scene.locationJobId);
        return pendingSet ? 4000 : false;
      }
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
  // Done as render-time state adjustment (conditional + converging), keyed on
  // story id + status so live edits are never clobbered by a refetch.
  const [editor, setEditor] = useState<{ title: string; hook: string; cta: string; scenes: SceneEdit[] } | null>(null);
  const [editorKey, setEditorKey] = useState("");
  const draftKey = story && story.status === "draft" ? `${story.id}:draft` : "none";
  if (draftKey !== editorKey) {
    setEditorKey(draftKey);
    setEditor(
      draftKey === "none"
        ? null
        : {
            title: story?.title ?? "",
            hook: story?.hook ?? "",
            cta: story?.cta ?? "",
            scenes: (story?.scenes ?? []).map((scene) => ({
              id: scene.id,
              description: scene.description,
              camera: scene.camera ?? "",
              dialogue: scene.dialogue ?? "",
              onScreenText: scene.onScreenText ?? "",
            })),
          },
    );
  }

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

  // A reference photo arrives ALREADY uploaded by AssetLibraryModal (either a
  // fresh upload or a library pick), so the handler takes the ready { ref, src }
  // — never raw bytes. `ref` is what generation consumes; `src` is for display.
  const handleAddReference = async (characterId: string, item: { ref?: unknown; src: string }) => {
    if (!story) return;
    // Same rule as the Character Library form: a preview-only library item has
    // no submit-ready ref, so it is refused rather than stored faceless.
    if (!isAttachable(item)) {
      toast.error(attachErrorMessage("no_reference"));
      return;
    }
    setCastBusy(characterId);
    setStageError(null);
    try {
      await addCharacterImageFn({ data: { characterId, ref: item.ref, src: item.src } });
      await refreshCast();
      toast.success("Photo added — the character will be consistent from this face");
    } catch (error) {
      getStageError(error);
    } finally {
      setCastBusy(null);
    }
  };

  // Fix 3: fill a character's reference from the story's own photo, in one click.
  const handleUseSelfie = async (characterId: string) => {
    if (!story) return;
    setCastBusy(characterId);
    setStageError(null);
    try {
      await applySelfieReferenceFn({ data: { storyId: story.id, characterId } });
      await refreshCast();
      toast.success("Using your photo for this character");
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

  const [setBusy, setSetBusy] = useState<string | null>(null);

  const handleProposeLocations = async () => {
    if (!story || story.status !== "locations") return;
    setSetBusy("propose");
    setStageError(null);
    try {
      await proposeLocationsFn({ data: { storyId: story.id } });
      await invalidate();
      toast.success("Sets proposed — adjust any scene, then validate");
    } catch (error) {
      getStageError(error);
    } finally {
      setSetBusy(null);
    }
  };

  const handleSetSceneLocation = async (
    sceneId: string,
    input: { name: string; description: string; source: "preset" | "free" | "photo"; ref?: { ref: unknown; src: string } },
  ) => {
    if (!story || story.status !== "locations") return;
    setSetBusy(sceneId);
    setStageError(null);
    try {
      await setSceneLocationFn({ data: { storyId: story.id, sceneId, ...input } });
      await invalidate();
    } catch (error) {
      getStageError(error);
    } finally {
      setSetBusy(null);
    }
  };

  const handleGenerateSetImage = async (sceneId: string) => {
    if (!story || story.status !== "locations") return;
    setSetBusy(sceneId);
    setStageError(null);
    try {
      await generateSceneLocationFn({ data: { storyId: story.id, sceneId } });
      await invalidate();
      toast.success("Generating set image…");
    } catch (error) {
      getStageError(error);
    } finally {
      setSetBusy(null);
    }
  };

  const handleUploadSetPhoto = async (sceneId: string, file: File) => {
    if (!story || story.status !== "locations") return;
    setSetBusy(sceneId);
    setStageError(null);
    try {
      const uploaded = await uploadAsset(file);
      const scene = story.scenes.find((scene) => scene.id === sceneId);
      await setSceneLocationFn({
        data: {
          storyId: story.id,
          sceneId,
          name: scene?.locationName ?? "Custom set",
          description: scene?.locationDescription ?? "",
          source: "photo",
          ref: { ref: uploaded.ref, src: uploaded.src },
        },
      });
      await invalidate();
      toast.success("Set photo added");
    } catch (error) {
      getStageError(error);
    } finally {
      setSetBusy(null);
    }
  };

  const handleValidateLocations = async () => {
    if (!story || story.status !== "locations") return;
    setStageError(null);
    setValidating(true);
    try {
      await validateLocationsFn({ data: { storyId: story.id } });
      await invalidate();
      toast.success("Sets validated — building the storyboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not validate the sets.";
      setStageError(message);
      toast.error(message);
    } finally {
      setValidating(false);
    }
  };

  // ── Lot E: audio ───────────────────────────────────────────────────────────
  const { data: userTracks = [] } = useQuery({
    queryKey: ["music", "tracks"],
    queryFn: () => listMusicTracksFn(),
    enabled: story?.status === "audio",
  });
  const allMusicOptions = [
    ...MUSIC_PRESETS.map((p) => ({ id: p.id, name: p.name, sub: `${p.mood} · preset`, url: p.url })),
    ...userTracks.map((t) => ({ id: t.id, name: t.name, sub: t.mood || "your library", url: t.url })),
  ];

  const handleSetDialogue = async (sceneId: string, enabled: boolean) => {
    if (!story) return;
    try {
      await setSceneDialogueFn({ data: { storyId: story.id, sceneId, enabled } });
      await invalidate();
    } catch (error) {
      getStageError(error);
    }
  };

  const handleSelectMusic = async (track: { name: string; url: string } | null) => {
    if (!story) return;
    try {
      await setStoryMusicFn({ data: { storyId: story.id, track } });
      await invalidate();
    } catch (error) {
      getStageError(error);
    }
  };

  const handleUploadMusic = async (file: File) => {
    if (!story) return;
    try {
      const uploaded = await uploadAudioAsset(file);
      const track = await createMusicTrackFn({ data: { name: file.name.replace(/\.[^.]+$/, ""), url: uploaded.url, mood: "uploaded" } });
      await handleSelectMusic({ name: track.name, url: track.url });
      toast.success("Track added to your library");
    } catch (error) {
      getStageError(error);
    }
  };

  const handleSetVoiceover = async (file: File | null) => {
    if (!story) return;
    try {
      if (!file) {
        await setStoryVoiceoverFn({ data: { storyId: story.id, url: null } });
      } else {
        const uploaded = await uploadAudioAsset(file);
        await setStoryVoiceoverFn({ data: { storyId: story.id, url: uploaded.url } });
        toast.success("Voiceover added — it will sit above the mix");
      }
      await invalidate();
    } catch (error) {
      getStageError(error);
    }
  };

  const handleValidateAudio = async () => {
    if (!story || story.status !== "audio") return;
    setStageError(null);
    setValidating(true);
    try {
      await validateAudioFn({ data: { storyId: story.id } });
      await invalidate();
      toast.success("Mix validated — cutting the final film");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not validate the mix.";
      setStageError(message);
      toast.error(message);
    } finally {
      setValidating(false);
    }
  };

  // Kick off the assembly container when the story reaches the assembly step.
  const assemblyDispatched = useRef(new Set<string>());
  useEffect(() => {
    if (story?.status === "assembling" && !assemblyDispatched.current.has(story.id)) {
      assemblyDispatched.current.add(story.id);
      void triggerAssembly(story.id).catch(() => assemblyDispatched.current.delete(story.id));
    }
  }, [story?.id, story?.status]);

  const handleRemaster = async () => {
    if (!story || story.status !== "failed") return;
    setRemastering(true);
    try {
      const remastered = await remasterStoryFn({ data: { storyId: story.id } });
      toast.success("Remastered — the script is ready in the modern pipeline");
      window.location.href = `/workspace?story=${remastered.id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remaster the story.";
      setStageError(message);
      toast.error(message);
    } finally {
      setRemastering(false);
    }
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
                onAddReference={(characterId, item) => void handleAddReference(characterId, item)}
                onUseSelfie={(characterId) => void handleUseSelfie(characterId)}
                onValidate={() => void handleValidateCharacters()}
              />
            ) : story.status === "locations" ? (
              <LocationsView
                story={story}
                busy={setBusy}
                validating={validating}
                error={stageError}
                onPropose={() => void handleProposeLocations()}
                onSetPreset={(sceneId, preset) =>
                  void handleSetSceneLocation(sceneId, {
                    name: preset.title,
                    description: preset.description,
                    source: "preset",
                  })
                }
                onSetFree={(sceneId, name, description) =>
                  void handleSetSceneLocation(sceneId, { name, description, source: "free" })
                }
                onGenerateSet={(sceneId) => void handleGenerateSetImage(sceneId)}
                onUploadSetPhoto={(sceneId, file) => void handleUploadSetPhoto(sceneId, file)}
                onValidate={() => void handleValidateLocations()}
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
            ) : story.status === "audio" ? (
              <AudioView
                story={story}
                options={allMusicOptions}
                error={stageError}
                validating={validating}
                onToggleDialogue={(sceneId, enabled) => void handleSetDialogue(sceneId, enabled)}
                onSelectMusic={(track) => void handleSelectMusic(track)}
                onUploadMusic={(file) => void handleUploadMusic(file)}
                onSetVoiceover={(file) => void handleSetVoiceover(file)}
                onValidate={() => void handleValidateAudio()}
              />
            ) : story.status === "generating" || story.status === "assembling" ? (
              <ProductionView story={story} />
            ) : story.status === "ready" && story.finalVideoUrl ? (
              <ReadyView story={story} />
            ) : story.status === "failed" ? (
              <div className="rounded-lg border border-cine-danger/30 bg-cine-danger-soft p-6">
                <Typography as="h3" variant="title-sm-semi-bold" color="danger">
                  This story stopped
                </Typography>
                <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
                  {story.error ?? "An unknown error happened during production."}
                </Typography>
                {story.scenes.filter((scene) => scene.error).length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <Typography as="p" variant="caption-sm-regular" color="secondary">
                      What happened, scene by scene:
                    </Typography>
                    {story.scenes.filter((scene) => scene.error).map((scene) => (
                      <div key={scene.id} className="rounded-lg border border-cine-danger/20 bg-q-background-primary px-3 py-2 text-sm">
                        <span className="font-medium text-q-text-primary">Scene {scene.idx + 1}: </span>
                        <span className="text-q-text-secondary">{scene.error}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href="/studio"><Button variant="tertiary">Back to stories</Button></a>
                  <Button variant="marketingPrimary" disabled={remastering} onClick={() => void handleRemaster()}>
                    {remastering ? <Loader size="xs" color="neutral" /> : <Icon as={RotateCcw} size="sm" />}
                    Remaster in the modern pipeline
                  </Button>
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

// ─── Audio (Lot E) ───────────────────────────────────────────────────────────

type MusicOption = { id: string; name: string; sub: string; url: string };

function AudioView({
  story, options, error, validating,
  onToggleDialogue, onSelectMusic, onUploadMusic, onSetVoiceover, onValidate,
}: {
  story: StoryDTO;
  options: MusicOption[];
  error: string | null;
  validating: boolean;
  onToggleDialogue: (sceneId: string, enabled: boolean) => void;
  onSelectMusic: (track: { name: string; url: string } | null) => void;
  onUploadMusic: (file: File) => void;
  onSetVoiceover: (file: File | null) => void;
  onValidate: () => void;
}) {
  const selectedUrl = story.musicTrack?.url ?? null;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <Typography as="h2" variant="title-sm-semi-bold" color="primary">Sound & mix</Typography>
        <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
          Scenes already carry native dialogue and sound. Mute a scene's dialogue (captions hide too), pick a music bed, add an optional voiceover — then validate the mix to cut the film.
        </Typography>
        {error && (
          <div className="mt-3 rounded-lg border border-cine-danger/30 bg-cine-danger-soft px-3 py-2 text-sm text-cine-danger" role="alert">
            {error}
          </div>
        )}
        <div className="mt-4">
          <Button variant="marketingPrimary" size="md" disabled={validating} onClick={onValidate}>
            {validating ? <Loader size="xs" color="neutral" /> : <Icon as={Film} size="sm" />}
            Validate mix & cut the film
          </Button>
        </div>
      </div>

      {/* Music */}
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="flex items-center gap-2">
          <Icon as={IconMusic} size="sm" className="text-q-brand-primary" />
          <Typography as="h3" variant="label-md-medium" color="primary">Music</Typography>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectMusic(null)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              selectedUrl == null ? "border-q-brand-primary bg-q-brand-primary/10 text-q-brand-primary" : "border-q-border-subtle text-q-text-secondary hover:bg-q-transparent-light-10"
            }`}
          >
            No music
          </button>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectMusic({ name: option.name, url: option.url })}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                selectedUrl === option.url ? "border-q-brand-primary bg-q-brand-primary/10 text-q-brand-primary" : "border-q-border-subtle text-q-text-secondary hover:bg-q-transparent-light-10"
              }`}
            >
              <span className="block font-medium">{option.name}</span>
              <span className="block text-[11px] opacity-70">{option.sub}</span>
            </button>
          ))}
          <label className="cursor-pointer rounded-lg border border-dashed border-q-border-subtle px-3 py-2 text-sm text-q-text-secondary hover:bg-q-transparent-light-10">
            <span className="flex items-center gap-1.5"><Icon as={Upload} size="sm" /> Upload track</span>
            <input type="file" accept="audio/*" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadMusic(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* Voiceover */}
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="flex items-center gap-2">
          <Icon as={Mic} size="sm" className="text-q-brand-primary" />
          <Typography as="h3" variant="label-md-medium" color="primary">Voiceover</Typography>
        </div>
        <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
          Optional imported narration (mp3/m4a) — mixed above the film. AI text-to-speech arrives when Higgsfield opens it to apps.
        </Typography>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-dashed border-q-border-subtle px-3 py-2 text-sm text-q-text-secondary hover:bg-q-transparent-light-10">
            <span className="flex items-center gap-1.5"><Icon as={Upload} size="sm" /> Import voiceover</span>
            <input type="file" accept="audio/*" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onSetVoiceover(file);
                e.target.value = "";
              }}
            />
          </label>
          {story.voiceoverUrl && (
            <>
              <span className="text-xs text-cine-success">Voiceover ready</span>
              <button type="button" className="text-xs text-q-text-danger hover:underline" onClick={() => onSetVoiceover(null)}>Remove</button>
            </>
          )}
        </div>
      </div>

      {/* Dialogue toggles */}
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="flex items-center gap-2">
          <Icon as={Volume2} size="sm" className="text-q-brand-primary" />
          <Typography as="h3" variant="label-md-medium" color="primary">Dialogue per scene</Typography>
        </div>
        <div className="mt-3 space-y-2">
          {story.scenes.map((scene) => (
            <div key={scene.id} className="flex items-center justify-between gap-3 rounded-lg border border-q-border-subtle bg-q-background-primary px-3 py-2">
              <div className="min-w-0">
                <Typography as="span" variant="label-md-medium" color="primary">Scene {scene.idx + 1}</Typography>
                <Typography as="p" variant="caption-sm-regular" color="secondary" className="line-clamp-1">
                  {scene.dialogue?.trim() || scene.onScreenText?.trim() || "Ambient only"}
                </Typography>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={scene.dialogueEnabled}
                aria-label={`Dialogue for scene ${scene.idx + 1}`}
                onClick={() => onToggleDialogue(scene.id, !scene.dialogueEnabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${scene.dialogueEnabled ? "bg-q-brand-primary" : "bg-q-transparent-light-10"}`}
              >
                <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${scene.dialogueEnabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
        <Typography as="p" variant="caption-sm-regular" color="tertiary" className="mt-2">
          Turning dialogue off hides the scene's captions in this cut; regenerating the scene's video will also drop its spoken line.
        </Typography>
      </div>
    </div>
  );
}

// ─── Sets & locations (Lot D) ───────────────────────────────────────────────

function LocationsView({
  story, busy, validating, error,
  onPropose, onSetPreset, onSetFree, onGenerateSet, onUploadSetPhoto, onValidate,
}: {
  story: StoryDTO;
  busy: string | null;
  validating: boolean;
  error: string | null;
  onPropose: () => void;
  onSetPreset: (sceneId: string, preset: { id: string; title: string; description: string }) => void;
  onSetFree: (sceneId: string, name: string, description: string) => void;
  onGenerateSet: (sceneId: string) => void;
  onUploadSetPhoto: (sceneId: string, file: File) => void;
  onValidate: () => void;
}) {
  const imageCost = story.sceneCount * 1.5;
  const anySet = story.scenes.some((scene) => (scene.locationDescription ?? "").trim());
  const allSet = story.scenes.length > 0 && story.scenes.every((scene) => (scene.locationDescription ?? "").trim());

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography as="h2" variant="title-sm-semi-bold" color="primary">Sets & locations</Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
              One set per scene — preset, free description, your photo, or AI-generated (1.5 credits). Storyboard images cost ~{Math.round(imageCost)} credits.
            </Typography>
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-cine-danger/30 bg-cine-danger-soft px-3 py-2 text-sm text-cine-danger" role="alert">
            {error}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!anySet && (
            <Button variant="marketingPrimary" size="md" disabled={busy === "propose"} onClick={onPropose}>
              {busy === "propose" ? <Loader size="xs" color="neutral" /> : <Icon as={Wand2} size="sm" />}
              Propose sets with AI
            </Button>
          )}
          {anySet && (
            <Button variant="marketingPrimary" size="md" disabled={validating || !allSet} onClick={onValidate}>
              {validating ? <Loader size="xs" color="neutral" /> : <Icon as={Film} size="sm" />}
              {allSet ? `Validate sets & build storyboard (~${Math.round(imageCost)} credits)` : "Waiting for every scene's set…"}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {story.scenes.map((scene) => {
          const isBusy = busy === scene.id;
          const hasDescription = (scene.locationDescription ?? "").trim().length > 0;
          return (
            <div key={scene.id} className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Typography as="h3" variant="label-md-medium" color="primary">Scene {scene.idx + 1}</Typography>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                    hasDescription ? "bg-cine-success-soft text-cine-success" : "bg-q-transparent-light-10 text-q-text-tertiary"
                  }`}>
                    {hasDescription ? "Set set" : "No set"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {scene.locationJobId ? (
                    <span className="flex items-center gap-1.5 text-xs text-q-text-secondary">
                      <Loader size="xs" color="neutral" /> Generating set image…
                    </span>
                  ) : scene.locationImage ? (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500">Reference ready</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-q-text-tertiary" htmlFor={`preset-${scene.id}`}>Pick a preset</label>
                  <select
                    id={`preset-${scene.id}`}
                    aria-label={`Preset set for scene ${scene.idx + 1}`}
                    className="w-full rounded-lg border border-q-border-subtle bg-q-background-secondary px-3 py-2 text-sm text-q-text-primary"
                    value=""
                    disabled={isBusy || validating}
                    onChange={(e) => {
                      const preset = STORY_LOCATIONS.find((p) => p.id === e.target.value);
                      if (preset) onSetPreset(scene.id, preset);
                    }}
                  >
                    <option value="" disabled>Choose a preset…</option>
                    {STORY_LOCATIONS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.title}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    {scene.locationImage ? (
                      <img src={scene.locationImage} alt={`Set for scene ${scene.idx + 1}`} className="h-20 w-14 rounded object-cover" />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded bg-q-background-primary">
                        <ImagePlus className="size-5 text-q-text-tertiary" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="cursor-pointer rounded-lg border border-q-border-subtle px-2.5 py-1.5 text-xs font-medium text-q-text-secondary hover:bg-q-transparent-light-10">
                        Upload photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isBusy || validating}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUploadSetPhoto(scene.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Button variant="tertiary" size="sm" disabled={isBusy || validating} onClick={() => onGenerateSet(scene.id)}>
                        {isBusy ? <Loader size="xs" color="neutral" /> : <Icon as={Wand2} size="sm" />}
                        Generate (1.5)
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor={`setname-${scene.id}`} className="text-xs text-q-text-tertiary">Set name</label>
                  <input
                    id={`setname-${scene.id}`}
                    key={`name-${scene.id}-${scene.locationName}`}
                    defaultValue={scene.locationName ?? ""}
                    placeholder="e.g. NYC rooftop at night"
                    disabled={isBusy || validating}
                    className="w-full rounded-lg border border-q-border-subtle bg-q-background-secondary px-3 py-2 text-sm text-q-text-primary focus:border-q-border-focus focus:outline-none"
                    onBlur={(e) => {
                      if (e.target.value !== (scene.locationName ?? "")) {
                        onSetFree(scene.id, e.target.value, scene.locationDescription ?? "");
                      }
                    }}
                  />
                  <label htmlFor={`setdesc-${scene.id}`} className="text-xs text-q-text-tertiary">Set description</label>
                  <textarea
                    id={`setdesc-${scene.id}`}
                    key={`desc-${scene.id}-${scene.locationDescription}`}
                    defaultValue={scene.locationDescription ?? ""}
                    placeholder="Concrete cinematic setting (space, light, time, mood)."
                    disabled={isBusy || validating}
                    rows={3}
                    className="w-full rounded-lg border border-q-border-subtle bg-q-background-secondary px-3 py-2 text-sm text-q-text-primary focus:border-q-border-focus focus:outline-none"
                    onBlur={(e) => {
                      if (e.target.value !== (scene.locationDescription ?? "")) {
                        onSetFree(scene.id, scene.locationName ?? "", e.target.value);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Casting (Lot C) ────────────────────────────────────────────────────────

type LibraryCharacter = { id: string; name: string; role: string; appearance: string };

function CastingView({
  story, cast, availableCharacters, busy, validating, error,
  onPropose, onLink, onUnlink, onPortrait, onAddReference, onUseSelfie, onValidate,
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
  onAddReference: (characterId: string, item: { ref?: unknown; src: string }) => void;
  onUseSelfie: (characterId: string) => void;
  onValidate: () => void;
}) {
  const imageCost = story.sceneCount * 1.5;
  const allHavePhotos = cast.length > 0 && cast.every((m) => m.hasReference || m.portraitJobId);
  const missingPhotos = cast.filter((m) => !m.hasReference && !m.portraitJobId).length;

  // The picker's library source: the user's own uploaded and generated stills,
  // read through the same FNF media client the Studio uses. New uploads are
  // handled by the modal's `onUpload` (uploadAsset), which returns a
  // submit-ready selection.
  const mediaClient = useFnfMediaClient();
  const { data: libraryItems = [] } = useQuery({
    queryKey: ["cast", "library", "images"],
    queryFn: async () => {
      const page = await mediaClient.list({ type: "image", size: 40 });
      return page.items
        .map(mediaRefToAssetItem)
        .filter((item): item is AssetLibraryItem => item != null);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography as="h2" variant="title-sm-semi-bold" color="primary">Cast</Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
              Optional — the AI proposes the cast automatically. Add a reference photo so a face stays consistent; skip it and your own photo carries the story. Up to 3 characters · storyboard images cost ~{Math.round(imageCost)} credits.
            </Typography>
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-cine-danger/30 bg-cine-danger-soft px-3 py-2 text-sm text-cine-danger" role="alert">
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
          {/* Always available: casting is optional, never a wall. */}
          <Button
            variant="marketingPrimary"
            size="md"
            disabled={validating}
            onClick={onValidate}
          >
            {validating ? <Loader size="xs" color="neutral" /> : <Icon as={Film} size="sm" />}
            {cast.length === 0
              ? "Skip casting & continue"
              : allHavePhotos
                ? "Continue to sets"
                : missingPhotos === cast.length
                  ? "Continue to sets (your photo will be used)"
                  : `Continue to sets (${missingPhotos} without a photo)`}
          </Button>
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
                  // Fix 2 — the empty slot IS the picker: AssetLibraryModal owns
                  // upload + library browsing, and reports a submit-ready ref.
                  <AssetLibraryModal
                    accept="image/*"
                    items={libraryItems}
                    onUpload={uploadAsset}
                    pagination={{}}
                    onSelect={(item) => onAddReference(member.characterId, { ref: item.ref, src: item.src })}
                    trigger={
                      <UploadField
                        render={<button type="button" />}
                        icon={ImagePlus}
                        title="Add photo"
                        subtitle="Upload or pick from your library"
                      />
                    }
                  />
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
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {member.portraitJobId ? (
                      <span className="text-xs text-q-text-tertiary">Portrait queued…</span>
                    ) : member.hasReference ? (
                      <>
                        <span className="rounded-full bg-cine-success-soft px-2.5 py-1 text-xs text-cine-success">
                          Reference ready
                        </span>
                        <AssetLibraryModal
                          accept="image/*"
                          items={libraryItems}
                          onUpload={uploadAsset}
                          pagination={{}}
                          onSelect={(item) => onAddReference(member.characterId, { ref: item.ref, src: item.src })}
                          trigger={
                            <button
                              type="button"
                              disabled={isBusy || validating}
                              className="rounded-lg border border-q-border-subtle px-2.5 py-1.5 text-xs font-medium text-q-text-secondary hover:bg-q-transparent-light-10 disabled:opacity-50"
                            >
                              Replace photo
                            </button>
                          }
                        />
                      </>
                    ) : (
                      <>
                        {/* Fix 3 — inherit the story's own photo in one click. */}
                        <Button
                          variant="tertiary"
                          size="sm"
                          disabled={isBusy || validating}
                          onClick={() => onUseSelfie(member.characterId)}
                        >
                          {isBusy ? <Loader size="xs" color="neutral" /> : <Icon as={UserRound} size="sm" />}
                          Use my photo
                        </Button>
                        <Button
                          variant="tertiary"
                          size="sm"
                          disabled={isBusy || validating}
                          onClick={() => onPortrait(member.characterId)}
                        >
                          {isBusy ? <Loader size="xs" color="neutral" /> : <Icon as={Wand2} size="sm" />}
                          Generate portrait (1.5)
                        </Button>
                      </>
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
          <div className="mt-3 rounded-lg border border-cine-danger/30 bg-cine-danger-soft px-3 py-2 text-sm text-cine-danger" role="alert">
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
                    scene.status === "image_ready" ? "bg-cine-success-soft text-cine-success" :
                    scene.status === "failed" ? "bg-cine-danger-soft text-cine-danger" :
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
          scene.status === "ready" ? "bg-cine-success-soft text-cine-success" :
          scene.status === "failed" ? "bg-cine-danger-soft text-cine-danger" :
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