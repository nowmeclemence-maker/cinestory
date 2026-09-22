import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Typography } from "@higgsfield/quanta/typography";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Loader } from "@higgsfield/quanta/loader";
import { User as IconUser, LogOut, Coins, Receipt, ArrowRight, Tag } from "lucide-react";
import { AppShell } from "@/layouts/app-shell";

export const Route = createFileRoute("/account")({ component: AccountPage });

interface UserProfile {
  id?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  workspace_id?: string;
  workspaces?: { id: string; name?: string }[];
  [key: string]: unknown;
}

function AccountPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user", { credentials: "include" })
      .then(async (response) => {
        const body = response.ok ? ((await response.json()) as UserProfile) : null;
        if (!cancelled) setUser(body);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const workspaces = Array.isArray(user?.workspaces) ? user.workspaces : [];

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div>
          <Typography as="h1" variant="title-lg-semi-bold" color="primary">Account</Typography>
          <Typography as="p" variant="body-sm-regular" color="secondary" className="mt-1">
            Your Higgsfield identity and session.
          </Typography>
        </div>

        <div className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-5">
          {loading ? (
            <div className="flex h-20 items-center justify-center"><Loader size="sm" color="neutral" /></div>
          ) : !user ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <IconUser className="size-8 text-q-text-tertiary" />
              <Typography as="p" variant="body-sm-regular" color="secondary">
                You’re signed out — sign in to create films.
              </Typography>
              <a href="/__auth/login?return=/account">
                <Button variant="marketingPrimary">Sign in</Button>
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="size-14 rounded-full object-cover" />
                ) : (
                  <div className="flex size-14 items-center justify-center rounded-full bg-q-brand-primary/10 text-q-brand-primary">
                    <Icon as={IconUser} size="lg" />
                  </div>
                )}
                <div className="min-w-0">
                  <Typography as="h2" variant="title-sm-semi-bold" color="primary" truncate>
                    {user.name ?? "CineStory creator"}
                  </Typography>
                  {user.email && (
                    <Typography as="p" variant="body-sm-regular" color="secondary" truncate>
                      {user.email}
                    </Typography>
                  )}
                  <Typography as="p" variant="caption-sm-regular" color="secondary">
                    user id {user.id ?? user.workspace_id ?? "—"}
                  </Typography>
                </div>
              </div>

              {workspaces.length > 0 && (
                <div>
                  <Typography as="p" variant="caption-sm-regular" color="secondary" className="mb-1.5">
                    Workspaces
                  </Typography>
                  <div className="flex flex-wrap gap-1.5">
                    {workspaces.map((workspace) => (
                      <span key={workspace.id} className="rounded-full bg-q-transparent-light-10 px-2.5 py-1 text-xs text-q-text-secondary">
                        {workspace.name ?? workspace.id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-q-border-subtle pt-4">
                <a href="/__auth/logout?return=/">
                  <Button variant="tertiary"><Icon as={LogOut} size="sm" /> Sign out of CineStory</Button>
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a href="/credits" className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4 transition-colors hover:bg-q-background-tertiary">
            <div className="flex items-center gap-3">
              <Icon as={Coins} size="md" className="text-q-brand-primary" />
              <div>
                <Typography as="h3" variant="label-md-medium" color="primary">Credits</Typography>
                <Typography as="p" variant="caption-sm-regular" color="secondary">Balance and transactions</Typography>
              </div>
              <Icon as={ArrowRight} size="sm" className="ml-auto text-q-text-tertiary" />
            </div>
          </a>
          <a href="/pricing" className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4 transition-colors hover:bg-q-background-tertiary">
            <div className="flex items-center gap-3">
              <Icon as={Tag} size="md" className="text-q-brand-primary" />
              <div>
                <Typography as="h3" variant="label-md-medium" color="primary">Pricing</Typography>
                <Typography as="p" variant="caption-sm-regular" color="secondary">Plans, credits and upgrade</Typography>
              </div>
              <Icon as={ArrowRight} size="sm" className="ml-auto text-q-text-tertiary" />
            </div>
          </a>
          <a href="/billing" className="rounded-xl border border-q-border-subtle bg-q-background-secondary p-4 transition-colors hover:bg-q-background-tertiary">
            <div className="flex items-center gap-3">
              <Icon as={Receipt} size="md" className="text-q-brand-primary" />
              <div>
                <Typography as="h3" variant="label-md-medium" color="primary">Billing</Typography>
                <Typography as="p" variant="caption-sm-regular" color="secondary">Plans and payments</Typography>
              </div>
              <Icon as={ArrowRight} size="sm" className="ml-auto text-q-text-tertiary" />
            </div>
          </a>
        </div>
      </div>
    </AppShell>
  );
}