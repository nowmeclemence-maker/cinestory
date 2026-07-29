import { useCallback, useState, type CSSProperties } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  PanelLeftClose as IconSidebarCollapse,
  PanelLeftOpen as IconSidebarExpand,
  Clapperboard as ClapperboardIcon,
} from "lucide-react";
import { Icon } from "@higgsfield/quanta/icon";
import { Sidebar } from "@higgsfield/quanta/sidebar";
import { Typography } from "@higgsfield/quanta/typography";
import { IconTile } from "@/components/icon-tile";
import { appFaviconUrl, appMeta } from "@/lib/app-meta";
import { NAV_ITEMS, ACCOUNT_ITEMS, PAGE_TITLES } from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const title = appMeta.og_title?.trim() || "CineStory";

  const handleNav = useCallback(
    (path: string) => {
      void navigate({ to: path });
    },
    [navigate],
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-q-background-primary">
      <Sidebar.Root
        product="cinema-studio"
        className="m-2.5"
        style={
          { height: "calc(100% - 20px)", ["--q-sidebar-radius" as string]: "12px" } as CSSProperties
        }
      >
        <Sidebar.Header>
          <Sidebar.Switcher>
            <Sidebar.Logo>
              <span className="relative flex size-6 items-center justify-center overflow-hidden rounded-q-200 bg-q-brand-primary text-q-text-inverse">
                <span className="studio-sidebar-logo-mark flex size-full items-center justify-center">
                  {appFaviconUrl != null ? (
                    <img src={appFaviconUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-q-caption-xs-bold">C</span>
                  )}
                </span>
              </span>
            </Sidebar.Logo>
            <Sidebar.Title>{title}</Sidebar.Title>
          </Sidebar.Switcher>
          <Sidebar.Toggle>
            <Icon as={IconSidebarCollapse} size="md" />
          </Sidebar.Toggle>
        </Sidebar.Header>

        <Sidebar.Body>
          <Sidebar.Section>
            <Sidebar.SectionItems>
              <Sidebar.Item
                selected={currentPath === "/studio"}
                onClick={() => handleNav("/studio")}
                start={<IconTile as={ClapperboardIcon} gradient="blue" />}
                title="Studio"
              />
              {NAV_ITEMS.map((item) => (
                <Sidebar.Item
                  key={item.path}
                  selected={currentPath.startsWith(item.path)}
                  onClick={() => handleNav(item.path)}
                  start={<IconTile as={item.icon as any} gradient="teal" />}
                  title={item.label}
                />
              ))}
            </Sidebar.SectionItems>
          </Sidebar.Section>

          <Sidebar.Section>
            <Sidebar.SectionHeader>
              <Sidebar.SectionTitle>Account</Sidebar.SectionTitle>
            </Sidebar.SectionHeader>
            <Sidebar.SectionItems>
              {ACCOUNT_ITEMS.map((item) => (
                <Sidebar.Item
                  key={item.path}
                  selected={currentPath.startsWith(item.path)}
                  onClick={() => handleNav(item.path)}
                  start={<IconTile as={item.icon as any} gradient="neutral" />}
                  title={item.label}
                />
              ))}
            </Sidebar.SectionItems>
          </Sidebar.Section>
        </Sidebar.Body>
      </Sidebar.Root>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-q-border-subtle">
          <Typography as="h1" variant="title-sm-semi-bold" color="primary">
            {PAGE_TITLES[currentPath] ?? "CineStory"}
          </Typography>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}