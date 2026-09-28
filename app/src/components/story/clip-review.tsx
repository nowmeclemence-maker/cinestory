import { useState } from "react";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { Textarea } from "@higgsfield/quanta/textarea";
import { Check, Download, Film, RefreshCw, Volume2, VolumeX, Wand2 } from "lucide-react";
import type { StoryDTO, SceneDTO } from "@/lib/story-engine.server";
import { IMAGE_COST_CREDITS, sceneDurationSeconds, videoClipCostCredits } from "@/lib/story-templates";

/**
 * The Video-step review gate.
 *
 * The storyboard is a checkpoint; the Video step must be one too. Each clip is
 * watched and approved individually, and the story cannot move on to Audio (and
 * therefore cannot reach Final cut) until every clip has been seen and accepted.
 *
 * The "Redo" choices are deliberately priced and framed: re-rolling the video
 * costs the full clip price and changes the motion, whereas correcting at image
 * level costs a single still — roughly 15x cheaper — so that is presented as the
 * better first move when the problem is the picture rather than the movement.
 */
export function ClipReviewView({
  story,
  busy,
  error,
  onApprove,
  onRecord,
  onFixScene,
  onApproveAll,
}: {
  story: StoryDTO;
  busy: string | null;
  error: string | null;
  onApprove: (sceneId: string, approved: boolean) => void;
  onRecord: (sceneId: string) => void;
  onFixScene: (sceneId: string, description: string) => void;
  onApproveAll: () => void;
}) {
  const seconds = sceneDurationSeconds(story.durationSec, story.sceneCount);
  const videoCost = videoClipCostCredits(seconds);
  const [openRedo, setOpenRedo] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [unmuted, setUnmuted] = useState<string | null>(null);

  const approved = story.scenes.filter((scene) => scene.videoApproved).length;
  const total = story.scenes.length;
  const allApproved = total > 0 && approved === total;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Typography as="h2" variant="title-sm-semi-bold" color="primary">
              Review your clips
            </Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
              Watch every clip before continuing. Nothing moves on to Audio until all {total} are
              approved — that is what keeps a bad take out of the final film.
            </Typography>
          </div>
          <div className="text-right">
            <Typography as="p" variant="label-md-medium" color="primary">
              {approved} of {total} approved
            </Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-0.5">
              {Math.round(story.spentCost)} credits spent on this story
            </Typography>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-cine-danger/30 bg-cine-danger-soft px-3 py-2 text-sm text-cine-danger" role="alert">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="marketingPrimary"
            size="md"
            disabled={!allApproved || busy != null}
            onClick={onApproveAll}
          >
            <Icon as={Film} size="sm" /> Approve all clips &amp; continue
          </Button>
          <Typography as="p" variant="caption-sm-regular" color="secondary">
            {allApproved
              ? "Every clip approved — this is the gate into Audio."
              : `${total - approved} clip${total - approved === 1 ? "" : "s"} still to review`}
          </Typography>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {story.scenes.map((scene) => {
          const isBusy = busy === scene.id;
          const redoOpen = openRedo === scene.id;
          const hasClip = scene.status === "ready" && Boolean(scene.videoUrl);
          const hasStillOnly = scene.status === "image_ready";
          const draft = drafts[scene.id] ?? scene.description;

          return (
            <div key={scene.id} className="flex flex-col overflow-hidden rounded-xl border border-q-border-subtle bg-q-background-secondary">
              <div className="relative bg-black">
                {hasClip ? (
                  <>
                    <video
                      // Muted autoplay is the only autoplay browsers allow; tapping
                      // unmutes, which is also what makes the tap a real gesture.
                      ref={(element) => {
                        if (element) element.muted = unmuted !== scene.id;
                      }}
                      src={scene.videoUrl ?? undefined}
                      className="aspect-[9/16] w-full cursor-pointer object-cover"
                      autoPlay
                      loop
                      playsInline
                      onClick={() => setUnmuted(unmuted === scene.id ? null : scene.id)}
                      aria-label={`Scene ${scene.idx + 1} clip`}
                    />
                    <button
                      type="button"
                      onClick={() => setUnmuted(unmuted === scene.id ? null : scene.id)}
                      className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur"
                    >
                      <Icon as={unmuted === scene.id ? Volume2 : VolumeX} size="sm" />
                      {unmuted === scene.id ? "Mute" : "Tap to unmute"}
                    </button>
                  </>
                ) : (
                  <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 px-4 text-center">
                    {isBusy || scene.status === "video_generating" || scene.status === "image_generating" ? (
                      <>
                        <Loader size="sm" color="neutral" />
                        <span className="text-xs text-q-text-secondary">
                          {scene.status === "image_generating" ? "Generating the new image…" : "Recording the clip…"}
                        </span>
                      </>
                    ) : scene.status === "failed" ? (
                      <span className="text-xs text-cine-danger">{scene.error ?? "This scene failed."}</span>
                    ) : (
                      <>
                        <Icon as={Film} size="md" className="text-q-text-tertiary" />
                        <span className="text-xs text-q-text-secondary">
                          Still approved — not recorded yet
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-3 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Typography as="h3" variant="label-md-medium" color="primary">
                    Scene {scene.idx + 1}
                  </Typography>
                  {scene.videoApproved ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cine-success-soft px-2.5 py-0.5 text-[11px] font-medium text-cine-success">
                      <Icon as={Check} size="xs" /> Looks good
                    </span>
                  ) : null}
                </div>
                <Typography as="p" variant="caption-sm-regular" color="secondary" className="line-clamp-3">
                  {scene.description}
                </Typography>

                {/* Primary per-clip actions */}
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {hasClip ? (
                    <>
                      {scene.videoApproved ? (
                        <Button variant="tertiary" size="sm" disabled={isBusy} onClick={() => onApprove(scene.id, false)}>
                          Undo approval
                        </Button>
                      ) : (
                        <Button variant="marketingPrimary" size="sm" disabled={isBusy} onClick={() => onApprove(scene.id, true)}>
                          {isBusy ? <Loader size="xs" color="neutral" /> : <Icon as={Check} size="sm" />} Looks good
                        </Button>
                      )}
                      {scene.videoUrl ? (
                        <a href={scene.videoUrl} download={`scene-${scene.idx + 1}.mp4`}>
                          <Button variant="tertiary" size="sm">
                            <Icon as={Download} size="sm" /> Download
                          </Button>
                        </a>
                      ) : null}
                    </>
                  ) : hasStillOnly && !isBusy ? (
                    <Button variant="marketingPrimary" size="sm" onClick={() => onRecord(scene.id)}>
                      <Icon as={Film} size="sm" /> Record clip ({videoCost} credits)
                    </Button>
                  ) : null}

                  <Button
                    variant="tertiary"
                    size="sm"
                    disabled={isBusy || (!hasClip && !hasStillOnly)}
                    onClick={() => setOpenRedo(redoOpen ? null : scene.id)}
                    aria-expanded={redoOpen}
                  >
                    <Icon as={RefreshCw} size="sm" /> Redo
                  </Button>
                </div>

                {redoOpen ? (
                  <div className="space-y-3 rounded-lg border border-q-border-subtle bg-q-background-primary p-3">
                    <div>
                      <Typography as="p" variant="label-sm-medium" color="primary">
                        Regenerate the video only — {videoCost} credits
                      </Typography>
                      <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
                        Records a fresh take from the same still. This re-rolls the motion, so the
                        movement and timing will differ from what you just watched.
                      </Typography>
                      <Button variant="tertiary" size="sm" className="mt-2" disabled={isBusy} onClick={() => onRecord(scene.id)}>
                        <Icon as={RefreshCw} size="sm" /> Re-record clip ({videoCost} credits)
                      </Button>
                    </div>

                    <div className="rounded-lg border border-cine-success/40 bg-cine-success-soft p-3">
                      <Typography as="p" variant="label-sm-medium" color="primary">
                        Fix the scene first — {IMAGE_COST_CREDITS} credits
                      </Typography>
                      <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
                        Cheaper by roughly 15x: correct the wording and the still, then record. Do this
                        when the frame itself is wrong — wrong outfit, wrong place, wrong face.
                      </Typography>
                      <Textarea
                        label="Scene description"
                        value={draft}
                        onChange={(event) => setDrafts((current) => ({ ...current, [scene.id]: event.target.value }))}
                        className="mt-2"
                      />
                      <Button
                        variant="marketingPrimary"
                        size="sm"
                        className="mt-2"
                        disabled={isBusy || draft.trim().length === 0 || draft === scene.description}
                        onClick={() => onFixScene(scene.id, draft)}
                      >
                        {isBusy ? <Loader size="xs" color="neutral" /> : <Icon as={Wand2} size="sm" />}
                        Save wording &amp; regenerate image ({IMAGE_COST_CREDITS} credits)
                      </Button>
                      <Typography as="p" variant="caption-sm-regular" color="tertiary" className="mt-2">
                        Then record the clip here ({videoCost} credits). The old clip is dropped — a
                        description change invalidates it.
                      </Typography>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Final cut review: the same principle at the end of the pipeline — watch it,
 * then accept it or go back and redo a scene.
 */
export function FinalCutActions({
  story,
  busy,
  onAccept,
  onRedoScene,
}: {
  story: StoryDTO;
  busy: boolean;
  onAccept: () => void;
  onRedoScene: () => void;
}) {
  return (
    <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography as="h3" variant="title-sm-semi-bold" color="primary">
            {story.finalApproved ? "Final cut accepted" : "Review the final cut"}
          </Typography>
          <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
            {story.finalApproved
              ? `${Math.round(story.spentCost)} credits spent on this story.`
              : "Watch the whole film, then accept it — or go back and redo a scene. Accepting spends nothing."}
          </Typography>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="tertiary" size="md" disabled={busy} onClick={onRedoScene}>
            <Icon as={RefreshCw} size="sm" /> Redo a scene
          </Button>
          <Button variant="marketingPrimary" size="md" disabled={busy || story.finalApproved} onClick={onAccept}>
            {busy ? <Loader size="xs" color="neutral" /> : <Icon as={Check} size="sm" />}
            {story.finalApproved ? "Accepted" : "Accept the film"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Shared helper: does every scene already have an approved-ready clip? */
export function allClipsRecorded(story: StoryDTO): boolean {
  return story.scenes.length > 0 && story.scenes.every((scene: SceneDTO) => scene.status === "ready");
}
