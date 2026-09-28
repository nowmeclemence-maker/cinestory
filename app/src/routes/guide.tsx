import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import {
  Clapperboard, Users, MapPin, Image, Film, Music, Scissors, Sparkles,
  ArrowLeftRight, Wand2, Coins, ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { IMAGE_COST_CREDITS, VIDEO_COST_PER_SECOND } from "@/lib/story-templates";

export const Route = createFileRoute("/guide")({ component: GuidePage });

/**
 * How to use CineStory — the end-to-end walkthrough, in the order the workspace
 * actually asks for it. Written against the real step ids/labels in
 * story-templates so it cannot drift from the product.
 */
const STEPS: { icon: typeof Clapperboard; title: string; body: string; cost: string }[] = [
  {
    icon: Clapperboard,
    title: "1 · Idea → Script",
    body: "Describe your story in plain language in the Studio and pick a template. CineStory writes the script: title, hook, and one visual beat per scene. Read it, then edit any wording by hand — this is the step that decides how your film looks, so it is worth a careful pass. When it reads right, press Validate script & start production.",
    cost: "Free (AI writing + unlimited edits)",
  },
  {
    icon: Users,
    title: "2 · Characters",
    body: "The cast proposes itself. Each member can get a reference photo — upload one, pick one from your library, or use your own photo — and that face is what keeps the character consistent across scenes. This step is optional: if you skip it, your own photo carries the story.",
    cost: "Free (a generated portrait is 1.5 credits)",
  },
  {
    icon: MapPin,
    title: "3 · Locations",
    body: "One set per scene: accept the AI proposal, pick a preset, describe it yourself, or supply a photo. The set and its reference image are passed to the image model for that scene only.",
    cost: "Free (a generated set image is 1.5 credits)",
  },
  {
    icon: Image,
    title: "4 · Storyboard",
    body: "Every scene gets a still frame. This is your checkpoint: look at each image before paying for video. Anything wrong can be corrected at its source — click an earlier step in the bar at the top, fix the wording or the reference photo, then regenerate just that one image.",
    cost: `${IMAGE_COST_CREDITS} credits per image`,
  },
  {
    icon: Film,
    title: "5 · Video",
    body: "The stills are animated into clips. Validating the storyboard shows the exact video cost and checks your balance first — if you are short, nothing is spent and the story stays put so you can top up and retry.",
    cost: `${VIDEO_COST_PER_SECOND} credits per second of finished clip`,
  },
  {
    icon: Music,
    title: "6 · Audio",
    body: "Scenes carry native dialogue; mute any scene's line, choose a music bed from the presets or your library, and optionally attach a voiceover. Captions follow the dialogue toggles.",
    cost: "Free (music beds and voiceovers are yours)",
  },
  {
    icon: Scissors,
    title: "7 · Final cut",
    body: "The clips, music and captions are cut together into one vertical 9:16 film, ready to play and download.",
    cost: "Free — assembly runs in the CineStory container",
  },
  {
    icon: Sparkles,
    title: "8 · Reuse",
    body: "Characters and locations live in your libraries, so the next story can cast the same faces and places with no extra work.",
    cost: "Free",
  },
];

const NAV_TIPS: { icon: typeof Clapperboard; title: string; body: string }[] = [
  {
    icon: ArrowLeftRight,
    title: "Every step you have reached is clickable",
    body: "Click any completed step in the bar at the top to reopen it. You can always go back to Script, Characters or Locations to fix something.",
  },
  {
    icon: ShieldCheck,
    title: "Going back never destroys work",
    body: "Reopening a step does not rewind your story. Existing storyboard images and clips stay exactly as they are — regenerate the specific scene you want redone.",
  },
  {
    icon: Wand2,
    title: "Steps are linkable",
    body: "The address bar carries both the story and the step (?story=…&step=script), so a step can be bookmarked, shared, or survive a refresh.",
  },
];

function GuidePage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <header className="space-y-3">
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">
            How to use CineStory
          </Typography>
          <Typography as="p" variant="body-md-regular" color="secondary">
            One idea in, one finished vertical film out — in eight steps. Nothing is generated
            without you validating the step before it, and nothing is charged before you see the cost.
          </Typography>
          <a href="/studio">
            <Button variant="marketingPrimary">
              <Icon as={Clapperboard} size="sm" /> Start a story
            </Button>
          </a>
        </header>

        <section className="space-y-4">
          <Typography as="h2" variant="title-sm-semi-bold" color="primary">
            The eight steps
          </Typography>
          <ol className="space-y-3">
            {STEPS.map((step) => (
              <li
                key={step.title}
                className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-cine-accent-soft text-cine-accent">
                    <Icon as={step.icon} size="md" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <Typography as="h3" variant="label-md-medium" color="primary">
                      {step.title}
                    </Typography>
                    <Typography as="p" variant="body-sm-regular" color="secondary">
                      {step.body}
                    </Typography>
                    <span className="inline-flex items-center gap-1 rounded-full bg-cine-success-soft px-2.5 py-0.5 text-[11px] font-medium text-cine-success">
                      <Icon as={Coins} size="xs" /> {step.cost}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <Typography as="h2" variant="title-sm-semi-bold" color="primary">
            Moving around a story
          </Typography>
          <div className="grid gap-3 sm:grid-cols-3">
            {NAV_TIPS.map((tip) => (
              <div
                key={tip.title}
                className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4"
              >
                <span className="mb-2 flex size-8 items-center justify-center rounded-lg bg-cine-accent-soft text-cine-accent">
                  <Icon as={tip.icon} size="md" />
                </span>
                <Typography as="h3" variant="label-md-medium" color="primary">
                  {tip.title}
                </Typography>
                <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
                  {tip.body}
                </Typography>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-q-border-subtle bg-q-background-secondary p-4">
          <Typography as="h2" variant="title-sm-semi-bold" color="primary">
            Getting a consistent film
          </Typography>
          <ul className="space-y-2">
            <li className="flex gap-2 text-q-body-sm-regular text-q-text-secondary">
              <Icon as={Users} size="sm" className="mt-0.5 shrink-0 text-cine-accent" />
              <span>
                Give each character a reference photo. Identity comes from that face far more
                reliably than from a written description.
              </span>
            </li>
            <li className="flex gap-2 text-q-body-sm-regular text-q-text-secondary">
              <Icon as={Wand2} size="sm" className="mt-0.5 shrink-0 text-cine-accent" />
              <span>
                Describe the wardrobe explicitly in every scene&apos;s text — name the garments and
                colours rather than writing &quot;the same outfit&quot;. Each scene is generated on
                its own, so a back-reference produces a different outfit. CineStory now substitutes
                the cast&apos;s wardrobe automatically where it can, but explicit text is best.
              </span>
            </li>
            <li className="flex gap-2 text-q-body-sm-regular text-q-text-secondary">
              <Icon as={Image} size="sm" className="mt-0.5 shrink-0 text-cine-accent" />
              <span>
                Check the storyboard before recording. Regenerating one image costs {IMAGE_COST_CREDITS}{" "}
                credits; re-recording a clip costs {VIDEO_COST_PER_SECOND} credits per second.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
