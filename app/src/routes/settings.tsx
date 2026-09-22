import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { Coins, Receipt, User, Music, ArrowRight, Fingerprint } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const getBalanceFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getCreditBalance } = await import("@/lib/services/credits");
  return getCreditBalance();
});

function SettingsPage() {
  const { data: balance, isLoading } = useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => getBalanceFn(),
  });

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Settings</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Account, credits and story defaults.
          </Typography>
        </div>

        <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Typography as="h3" variant="label-md-medium" color="primary">Credit balance</Typography>
              <Typography as="p" variant="caption-sm-regular" color="secondary">Shown before every paid step</Typography>
            </div>
            <Typography as="p" variant="headline-md-bold" color="primary">
              {isLoading ? <Loader size="xs" color="neutral" /> : balance ?? 0}
            </Typography>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/credits"><Button variant="tertiary" size="sm"><Icon as={Coins} size="sm" /> Transactions</Button></a>
            <a href="/billing"><Button variant="tertiary" size="sm"><Icon as={Receipt} size="sm" /> Plans & billing</Button></a>
          </div>
        </div>

        <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-5">
          <Typography as="h3" variant="label-md-medium" color="primary">Production defaults</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Every film runs the validated pipeline: Script → Cast → Sets → Storyboard → Video → Audio → Final cut.
            Costs follow Higgsfield’s rates (1.5 cr per image, 4.5 cr/s of video); each gate shows the exact price before spending.
          </Typography>
          <ul className="mt-3 space-y-2">
            {[
              ["Voiceover", "Imported recordings today; AI text-to-speech arrives when Higgsfield opens it to apps."],
              ["Music", "3 AI presets + your uploads, mixed under the film at assembly."],
              ["Credits checks", "Every paid launch stops if the balance can’t cover it — nothing is spent blindly."],
            ].map(([title, body]) => (
              <li key={title} className="rounded-lg border border-q-border-subtle bg-q-background-primary px-3 py-2">
                <span className="font-medium text-q-text-primary">{title}</span>
                <p className="text-sm text-q-text-secondary">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a href="/account" className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4 transition-colors hover:bg-q-background-tertiary">
            <Icon as={User} size="md" className="text-q-brand-primary" />
            <Typography as="h3" variant="label-md-medium" color="primary" className="mt-2">Account</Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary">Profile & sign out</Typography>
            <Icon as={ArrowRight} size="sm" className="mt-2 text-q-text-tertiary" />
          </a>
          <a href="/music" className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4 transition-colors hover:bg-q-background-tertiary">
            <Icon as={Music} size="md" className="text-q-brand-primary" />
            <Typography as="h3" variant="label-md-medium" color="primary" className="mt-2">Music library</Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary">Presets & uploads</Typography>
            <Icon as={ArrowRight} size="sm" className="mt-2 text-q-text-tertiary" />
          </a>
          <a href="/help" className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4 transition-colors hover:bg-q-background-tertiary">
            <Icon as={Fingerprint} size="md" className="text-q-brand-primary" />
            <Typography as="h3" variant="label-md-medium" color="primary" className="mt-2">Help center</Typography>
            <Typography as="p" variant="caption-sm-regular" color="secondary">How everything works</Typography>
            <Icon as={ArrowRight} size="sm" className="mt-2 text-q-text-tertiary" />
          </a>
        </div>
      </div>
    </AppShell>
  );
}