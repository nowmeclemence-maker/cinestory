import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Card } from "@higgsfield/quanta/card";
import { Icon } from "@higgsfield/quanta/icon";
import { ArrowRight, Wallet } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { createServerFn } from "@tanstack/react-start";
import { getSubscriptionFn } from "@/lib/story.functions";
import { CREDIT_PACKS, SIGNUP_CREDIT_GRANT } from "@/lib/services/pricing";

export const Route = createFileRoute("/billing")({ component: BillingPage });

const getBalanceFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getCreditBalance } = await import("@/lib/services/credits");
  return getCreditBalance();
});

/**
 * Account status only. The packs themselves live on /pricing so there is one
 * place a price can be wrong, not two.
 */
function BillingPage() {
  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => getSubscriptionFn(),
  });
  const { data: balance, isLoading } = useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => getBalanceFn(),
  });

  const requested = CREDIT_PACKS.find((pack) => pack.id === subscription?.planId);

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Typography as="h1" variant="title-lg-semi-bold" color="primary">Billing</Typography>
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
              Your balance and the pack you asked for.
            </Typography>
          </div>
          <a href="/pricing">
            <Button variant="tertiary" size="sm">See packs <Icon as={ArrowRight} size="sm" /></Button>
          </a>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Typography as="p" variant="body-sm-regular" color="secondary">Credit balance</Typography>
              <Typography as="p" variant="headline-lg-bold" color="primary" className="mt-1">
                {isLoading ? "…" : (balance ?? 0).toLocaleString("en-US")}
              </Typography>
            </div>
            <Icon as={Wallet} size="lg" className="text-cine-accent" />
          </div>
        </Card>

        <Card className="p-6">
          <Typography as="h2" variant="title-sm-semi-bold" color="primary">Checkout</Typography>
          {requested ? (
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
              You asked to be notified about the <strong>{requested.name}</strong> pack
              (${requested.usd} for {requested.credits.toLocaleString("en-US")} credits). Card payments
              are not open yet — we&apos;ll contact you the day they are.
            </Typography>
          ) : (
            <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-2">
              Card payments are not open yet. Every account runs on its {SIGNUP_CREDIT_GRANT} free starting
              credits until they are. Pick the pack you want on the pricing page and we&apos;ll let you know
              the day checkout opens.
            </Typography>
          )}
          <a href="/pricing" className="mt-4 inline-block">
            <Button variant="marketingPrimary" size="sm">
              {requested ? "Change pack" : "Choose a pack"} <Icon as={ArrowRight} size="sm" />
            </Button>
          </a>
        </Card>
      </div>
    </AppShell>
  );
}
