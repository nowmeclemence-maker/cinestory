import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Card } from "@higgsfield/quanta/card";
import { Icon } from "@higgsfield/quanta/icon";
import { Check, ArrowRight } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { getSubscriptionFn } from "@/lib/story.functions";
import { CREDIT_PLANS } from "@/lib/services/plans";

export const Route = createFileRoute("/billing")({ component: BillingPage });

const PLAN_FEATURES: Record<keyof typeof CREDIT_PLANS, string[]> = {
  free: ["All 12 story templates", "720p storyboard previews", "1 character & 1 set", "Community support"],
  pro: ["Everything in Free", "1080p exports", "Unlimited characters & sets", "Music & voiceover library", "Email support"],
  studio: ["Everything in Pro", "4K exports", "Series mode (bible → episodes)", "Custom templates", "Priority support"],
};

function BillingPage() {
  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => getSubscriptionFn(),
  });
  const currentPlanId = subscription?.planId ?? "free";

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">Billing & Plans</Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">Choose the plan that fits your storytelling.</Typography>
          </div>
          <a href="/pricing">
            <Button variant="tertiary" size="sm">Compare pricing <Icon as={ArrowRight} size="sm" /></Button>
          </a>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CREDIT_PLANS) as Array<keyof typeof CREDIT_PLANS>).map((planId) => {
            const plan = CREDIT_PLANS[planId];
            const isCurrent = currentPlanId === planId;
            return (
              <Card key={planId} className="p-6">
                <Typography as="h3" variant="title-sm-semi-bold" color="primary">{plan.name}</Typography>
                <Typography as="p" variant="headline-lg-bold" color="primary" className="mt-2">${plan.price}<span className="text-q-body-sm-regular text-q-text-secondary">/mo</span></Typography>
                <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">{plan.credits.toLocaleString("en-US")} credits/mo</Typography>
                <ul className="mt-4 space-y-2">
                  {PLAN_FEATURES[planId].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-q-body-sm-regular text-q-text-secondary">
                      <Icon as={Check} size="sm" className="text-q-brand-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <a href="/pricing" className="mt-6 block">
                  <Button variant={planId === "pro" ? "marketingPrimary" : "tertiary"} className="w-full" disabled={isCurrent}>
                    {isCurrent ? "Current plan" : plan.price === 0 ? "Start Free" : "Upgrade"}
                  </Button>
                </a>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}