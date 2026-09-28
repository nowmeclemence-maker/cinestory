import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { toast } from "@higgsfield/quanta/sonner";
import { Check, Info, Sparkles } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { selectPlanFn } from "@/lib/story.functions";
import {
  CREDIT_PACKS, SIGNUP_CREDIT_GRANT, VIDEO_ENGINES,
  clipCredits, estimateFilm, imageCredits, packUsdPerCredit,
} from "@/lib/services/pricing";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

const SCENE_COUNT = 5;
const SECONDS_PER_SCENE = 5;

function PricingPage() {
  const qc = useQueryClient();
  const [engineId, setEngineId] = useState(
    VIDEO_ENGINES.find((engine) => engine.tier === "standard")?.id ?? VIDEO_ENGINES[0].id,
  );
  const engine = useMemo(
    () => VIDEO_ENGINES.find((item) => item.id === engineId) ?? VIDEO_ENGINES[0],
    [engineId],
  );
  const film = useMemo(() => estimateFilm(SCENE_COUNT, SECONDS_PER_SCENE, engine), [engine]);

  /**
   * Checkout is not wired yet, so this records which pack the account wants
   * rather than pretending to sell it. The button says exactly that.
   */
  const registerInterest = useMutation({
    mutationFn: (packId: string) => selectPlanFn({ data: { planId: packId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Noted — you'll be the first to know when checkout opens.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not save your choice.");
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="text-center">
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">
            Credits, not subscriptions
          </Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Buy a pack, spend it when you generate. Nothing renews on its own.
          </Typography>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-cine-accent/30 bg-cine-accent-soft p-4">
          <Icon as={Info} size="sm" className="mt-0.5 shrink-0 text-cine-accent" />
          <Typography as="p" variant="body-sm-regular" color="secondary">
            Checkout is not open yet. Pick the pack you want and we&apos;ll contact you the day it is —
            until then, every account runs on its {SIGNUP_CREDIT_GRANT} free starting credits.
          </Typography>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                pack.highlight
                  ? "border-cine-accent/60 bg-cine-accent-soft shadow-lg shadow-cine-accent/10"
                  : "border-q-border-subtle bg-q-background-secondary"
              }`}
            >
              {pack.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cine-accent px-3 py-0.5 text-xs font-medium text-white">
                  Best value
                </span>
              )}
              <Typography as="h2" variant="title-sm-semi-bold" color="primary">{pack.name}</Typography>
              <div className="mt-4 flex items-baseline gap-1">
                <Typography as="p" variant="headline-lg-bold" color="primary">${pack.usd}</Typography>
                <Typography as="p" variant="body-sm-regular" color="secondary">one-off</Typography>
              </div>
              <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
                {pack.credits.toLocaleString("en-US")} credits · ${packUsdPerCredit(pack).toFixed(3)} each
              </Typography>
              <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-3">
                {pack.description}
              </Typography>
              <ul className="mt-5 flex-1 space-y-2">
                <li className="flex items-start gap-2 text-q-body-sm-regular text-q-text-secondary">
                  <Icon as={Check} size="sm" className="mt-0.5 shrink-0 text-cine-accent" />
                  ≈ {Math.floor(pack.credits / film.credits)} five-scene films on {engine.name}
                </li>
                <li className="flex items-start gap-2 text-q-body-sm-regular text-q-text-secondary">
                  <Icon as={Check} size="sm" className="mt-0.5 shrink-0 text-cine-accent" />
                  Credits never expire on a monthly cycle
                </li>
                <li className="flex items-start gap-2 text-q-body-sm-regular text-q-text-secondary">
                  <Icon as={Check} size="sm" className="mt-0.5 shrink-0 text-cine-accent" />
                  Every video engine unlocked
                </li>
              </ul>
              <Button
                variant={pack.highlight ? "marketingPrimary" : "tertiary"}
                className="mt-6 w-full"
                disabled={registerInterest.isPending}
                onClick={() => registerInterest.mutate(pack.id)}
              >
                {registerInterest.isPending ? <Loader size="xs" color="neutral" /> : null}
                Notify me when checkout opens
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-5">
          <div className="flex items-center gap-2">
            <Icon as={Sparkles} size="sm" className="text-cine-accent" />
            <Typography as="h3" variant="label-md-medium" color="primary">What a film costs</Typography>
          </div>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
            You choose the engine for each clip, so a draft costs a fraction of a final cut. Every step in
            the Studio shows its exact credit cost before it runs.
          </Typography>

          <div className="mt-4 flex flex-wrap gap-2">
            {VIDEO_ENGINES.map((item) => (
              <button
                key={item.id}
                onClick={() => setEngineId(item.id)}
                aria-pressed={item.id === engineId}
                className={`rounded-full px-3 py-1 text-q-caption-sm-regular transition-colors ${
                  item.id === engineId
                    ? "bg-cine-accent text-white"
                    : "border border-q-border-subtle text-q-text-secondary hover:text-q-text-primary"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-q-border-subtle p-3">
              <Typography as="p" variant="caption-sm-regular" color="secondary">One storyboard still</Typography>
              <Typography as="p" variant="title-sm-semi-bold" color="primary">{imageCredits()} credits</Typography>
            </div>
            <div className="rounded-lg border border-q-border-subtle p-3">
              <Typography as="p" variant="caption-sm-regular" color="secondary">
                One {SECONDS_PER_SCENE}s clip · {engine.name}
              </Typography>
              <Typography as="p" variant="title-sm-semi-bold" color="primary">
                {clipCredits(engine, SECONDS_PER_SCENE)} credits
              </Typography>
            </div>
            <div className="rounded-lg border border-q-border-subtle p-3">
              <Typography as="p" variant="caption-sm-regular" color="secondary">
                A {SCENE_COUNT}-scene film
              </Typography>
              <Typography as="p" variant="title-sm-semi-bold" color="primary">
                {film.credits} credits · ${film.usd.toFixed(2)}
              </Typography>
            </div>
          </div>

          <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-3">
            {engine.blurb}
          </Typography>
        </div>
      </div>
    </AppShell>
  );
}
