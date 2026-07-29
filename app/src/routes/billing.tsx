import { createFileRoute } from "@tanstack/react-router";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Card } from "@higgsfield/quanta/card";
import { Icon } from "@higgsfield/quanta/icon";
import { Check } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
});

const PLANS = [
  { name: "Free", price: "$0", credits: "100/mo", features: ["Basic templates", "720p export", "Community support"] },
  { name: "Starter", price: "$19", credits: "1,000/mo", features: ["All templates", "1080p export", "Character library", "Email support"] },
  { name: "Pro", price: "$79", credits: "5,000/mo", features: ["Everything in Starter", "4K export", "Location library", "Priority support", "Custom voice"] },
  { name: "Unlimited", price: "$249", credits: "25,000/mo", features: ["Everything in Pro", "API access", "Dedicated support", "Custom templates"] },
];

function BillingPage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Billing & Plans</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">Choose the plan that fits your storytelling.</Typography>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card key={plan.name} className="p-6">
              <Typography as="h3" variant="title-sm-semi-bold" color="primary">{plan.name}</Typography>
              <Typography as="p" variant="headline-lg-bold" color="primary" className="mt-2">{plan.price}<span className="text-q-body-sm-regular text-q-text-secondary">/mo</span></Typography>
              <Typography as="p" variant="caption-sm-regular" color="secondary" className="mt-1">{plan.credits}</Typography>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-q-body-sm-regular text-q-text-secondary">
                    <Icon as={Check} size="sm" className="text-q-brand-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant={plan.name === "Pro" ? "marketingPrimary" : "tertiary"} className="mt-6 w-full" disabled={plan.price === "0"}>
                {plan.price === "$0" ? "Current" : "Subscribe"}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}