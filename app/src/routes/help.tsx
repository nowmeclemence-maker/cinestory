import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { ChevronDown, ArrowRight } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/help")({ component: HelpPage });

const FAQ = [
  {
    q: "How does CineStory make a film?",
    a: "You describe an idea. CineStory writes the script, proposes the cast, sets each scene, generates a storyboard, films scene-by-scene with Seedance, mixes music/dialogue/voiceover, and cuts a final 9:16 video. Every step is visible and validated before the next one — nothing is generated without you confirming the current step.",
  },
  {
    q: "Do I need to prompt or edit a timeline?",
    a: "No. There are no prompt boxes to master and no timeline editor. You edit story, cast, sets, images and sound in plain language and by pressing buttons.",
  },
  {
    q: "How much do films cost?",
    a: "Storyboard/portrait/set images are 1.5 credits each; video is 4.5 credits per second. Scripts, bibles and the final assembly are free. Every paid step shows its exact cost and checks your balance before launching.",
  },
  {
    q: "What is the Audio step?",
    a: "After the scene videos are recorded you can mute a scene's dialogue (captions hide too), pick a music bed (3 AI presets or your upload), and import a voiceover — then validate the mix to cut the film.",
  },
  {
    q: "Can I make a series?",
    a: "Yes. Import a manuscript (paste or .txt, or load the “Unwanted Guest” demo) and CineStory writes a story bible, splits it into episodes, and keeps recurring characters across episodes — their reference photos carry over.",
  },
  {
    q: "What if I run out of credits?",
    a: "The gates stop before spending: you'll see exactly how many credits are needed versus available, and nothing is charged. Top up in Settings → Credits/Billing and retry.",
  },
];

function HelpPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Help Center</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Everything you need to make your first film.
          </Typography>
        </div>

        <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-5">
          <Typography as="h2" variant="title-sm-semi-bold" color="primary">Start here</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
            Open the Studio, upload a photo, pick a template, and describe an idea in plain words. You'll land in the Script step — review it, then validate your way through Cast, Sets, Storyboard, Video, Audio and the final cut.
          </Typography>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/studio"><Button variant="marketingPrimary">Open the Studio <Icon as={ArrowRight} size="sm" /></Button></a>
            <a href="/series"><Button variant="tertiary">Try the series demo <Icon as={ArrowRight} size="sm" /></Button></a>
          </div>
        </div>

        <div>
          <Typography as="h2" variant="title-sm-semi-bold" color="primary" className="mb-3">Frequently asked</Typography>
          <div className="space-y-2">
            {FAQ.map((item, idx) => (
              <div key={item.q} className="rounded-xl border border-q-border-subtle bg-q-background-secondary transition-colors hover:border-q-border-strong">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
                  onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                  aria-expanded={openIdx === idx}
                >
                  <span className="text-sm font-medium text-q-text-primary">{item.q}</span>
                  <ChevronDown className={`size-4 shrink-0 text-q-text-secondary transition-transform ${openIdx === idx ? "rotate-180" : ""}`} />
                </button>
                {openIdx === idx && (
                  <p className="px-5 pb-4 text-sm leading-relaxed text-q-text-secondary">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-5">
          <Typography as="h3" variant="label-md-medium" color="primary">A story that failed?</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Open it from the feed and choose “Remaster in the modern pipeline” — the script is cloned into a fresh project at the Script step, ready to run again (e.g. after topping up credits).
          </Typography>
        </div>
      </div>
    </AppShell>
  );
}