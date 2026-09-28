import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Card } from "@higgsfield/quanta/card";
import { Loader } from "@higgsfield/quanta/loader";
import { AppShell } from "@/layouts/app-shell";
import { createServerFn } from "@tanstack/react-start";
import { VIDEO_ENGINES, clipCredits, imageCredits } from "@/lib/services/pricing";

export const Route = createFileRoute("/credits")({
  component: CreditsPage,
});

const getBalanceFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getCreditBalance } = await import("@/lib/services/credits");
  return getCreditBalance();
});
const getTxFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getTransactions } = await import("@/lib/services/credits");
  return getTransactions();
});

function CreditsPage() {
  const { data: balance, isLoading: balLoading } = useQuery({ queryKey: ["credits", "balance"], queryFn: () => getBalanceFn() });
  const { data: transactions = [] } = useQuery({ queryKey: ["credits", "tx"], queryFn: () => getTxFn() });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Credits</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">Manage your AI credits and usage.</Typography>
        </div>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <Typography as="p" variant="body-sm-regular" color="secondary">Available Balance</Typography>
              <Typography as="p" variant="headline-lg-bold" color="primary" className="mt-1">
                {balLoading ? "..." : balance ?? 0}
              </Typography>
            </div>
            <Button variant="marketingPrimary" onClick={() => { window.location.href = "/pricing"; }}>
              Get more credits
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <Typography as="h2" variant="label-md-medium" color="primary">What each step costs</Typography>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-q-body-sm-regular">
              <span className="text-q-text-secondary">Storyboard still, portrait or set</span>
              <span className="text-q-text-primary">{imageCredits()} credits</span>
            </div>
            {VIDEO_ENGINES.map((engine) => (
              <div key={engine.id} className="flex items-center justify-between text-q-body-sm-regular">
                <span className="text-q-text-secondary">5s clip · {engine.name}</span>
                <span className="text-q-text-primary">{clipCredits(engine, 5)} credits</span>
              </div>
            ))}
          </div>
        </Card>
        <Typography as="h2" variant="title-sm-semi-bold" color="primary">Transaction History</Typography>
        {transactions.length === 0 ? (
          <Typography as="p" variant="body-sm-regular" color="secondary">No transactions yet.</Typography>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg border border-q-border-subtle bg-q-background-secondary p-3">
                <div>
                  <Typography as="p" variant="body-sm-regular" color="primary">{tx.description}</Typography>
                  <Typography as="p" variant="caption-sm-regular" color="secondary">{tx.createdAt}</Typography>
                </div>
                <Typography as="span" variant="label-md-medium" color={tx.amount > 0 ? "success" : "danger"}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}