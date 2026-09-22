import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { toast } from "@higgsfield/quanta/sonner";
import { Check, Sparkles } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { getSubscriptionFn, selectPlanFn } from "@/lib/story.functions";
import { CREDIT_PLANS } from "@/lib/services/plans";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

const PLAN_FEATURES: Record<keyof typeof CREDIT_PLANS, string[]> = {
  free: ["All 12 story templates", "720p storyboard previews", "1 character & 1 set", "Community support"],
  pro: ["Everything in Free", "1080p exports", "Unlimited characters & sets", "Music & voiceover library", "Email support"],
  studio: ["Everything in Pro", "4K exports", "Series mode (bible → episodes)", "Custom templates", "Priority support"],
};

const PLAN_DESCRIPTIONS: Record<keyof typeof CREDIT_PLANS, string> = {
  free: "Try the studio and make your first film.",
  pro: "For creators making films every week.",
  studio: "Series pipelines and team-scale output.",
};

function PricingPage() {
  const qc = useQueryClient();
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => getSubscriptionFn(),
  });

  const selectPlan = useMutation({
    mutationFn: (planId: string) => selectPlanFn({ data: { planId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Plan selected — checkout is coming soon.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not select the plan.");
    },
  });

  const currentPlanId = subscription?.planId ?? "free";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="text-center">
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">
            Pricing
          </Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Start free. Scale when your stories do.
          </Typography>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(Object.keys(CREDIT_PLANS) as Array<keyof typeof CREDIT_PLANS>).map((planId) => {
            const plan = CREDIT_PLANS[planId];
            const isCurrent = currentPlanId === planId;
            const popular = planId === "pro";
            return (
              <div
                key={planId}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  popular
                    ? "border-q-brand-primary/60 bg-q-brand-primary/5 shadow-lg shadow-q-brand-primary/10"
                    : "border-q-border-subtle bg-q-background-secondary"
                }`}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-q-brand-primary px-3 py-0.5 text-xs font-medium text-white">
                    Most Popular
                  </span>
                )}
                <Typography as="h2" variant="title-sm-semi-bold" color="primary">{plan.name}</Typography>
                <div className="mt-4 flex items-baseline gap-1">
                  <Typography as="p" variant="headline-lg-bold" color="primary">${plan.price}</Typography>
                  <Typography as="p" variant="body-sm-regular" color="secondary">/month</Typography>
                </div>
                <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">
                  {plan.credits.toLocaleString("en-US")} credits/mo
                </Typography>
                <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-3">
                  {PLAN_DESCRIPTIONS[planId]}
                </Typography>
                <ul className="mt-5 flex-1 space-y-2">
                  {PLAN_FEATURES[planId].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-q-body-sm-regular text-q-text-secondary">
                      <Icon as={Check} size="sm" className="mt-0.5 shrink-0 text-q-brand-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={popular ? "marketingPrimary" : "tertiary"}
                  className="mt-6 w-full"
                  disabled={isCurrent || selectPlan.isPending}
                  onClick={() => selectPlan.mutate(planId)}
                >
                  {selectPlan.isPending ? <Loader size="xs" color="neutral" /> : null}
                  {isCurrent ? "Current plan" : plan.price === 0 ? "Start Free" : `Upgrade to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-5">
          <div className="flex items-center gap-2">
            <Icon as={Sparkles} size="sm" className="text-q-brand-primary" />
            <Typography as="h3" variant="label-md-medium" color="primary">How credits work</Typography>
          </div>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
            Credits are spent per generation: ~1.5 per storyboard image / portrait / set, and 4.5 per second of video.
            Every step shows its exact credit cost before it runs — a short film is typically 70–250 credits.
          </Typography>
        </div>
      </div>
    </AppShell>
  );
}