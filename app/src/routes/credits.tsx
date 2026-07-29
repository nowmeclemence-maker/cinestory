import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Card } from "@higgsfield/quanta/card";
import { Loader } from "@higgsfield/quanta/loader";
import { AppShell } from "@/layouts/app-shell";
import { createServerFn } from "@tanstack/react-start";
import { getCreditBalance, getTransactions, CREDIT_PLANS } from "@/lib/services/credits";

export const Route = createFileRoute("/credits")({
  component: CreditsPage,
});

const getBalanceFn = createServerFn({ method: "POST" }).handler(() => getCreditBalance());
const getTxFn = createServerFn({ method: "POST" }).handler(() => getTransactions());

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
            <Button variant="marketingPrimary" onClick={() => window.location.href = "/billing"}>Buy Credits</Button>
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Object.entries(CREDIT_PLANS).map(([id, plan]) => (
            <Card key={id} className="p-4 text-center">
              <Typography as="h3" variant="title-sm-semi-bold" color="primary">{plan.name}</Typography>
              <Typography as="p" variant="headline-md-bold" color="primary" className="mt-2">${plan.price}</Typography>
              <Typography as="p" variant="body-sm-regular" color="secondary">{plan.credits.toLocaleString()} credits</Typography>
              <Button variant="tertiary" size="sm" className="mt-3" disabled={plan.price === 0}>Buy</Button>
            </Card>
          ))}
        </div>
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