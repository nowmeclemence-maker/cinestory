import type { ComponentProps, CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubmitInputFor } from "@higgsfield/fnf/client";
import {
  costQueryOptions,
  flattenFeedPages,
  jobsFeedQueryOptions,
  prependGenerations,
  useFnfJobClient,
  useFnfMediaClient,
  useFnfScopeKey,
  useGenerationRun,
  useLiveFeedGenerations,
} from "@higgsfield/fnf-react";
import { Box as Icon3dBoxTopOutlined } from "lucide-react";
import { PaintBucket as IconBucketOutlined } from "lucide-react";
import { Compass as IconExploreOutlined } from "lucide-react";
import { Folder as IconProjectsOutlined } from "lucide-react";
import { Plus as IconPlusMediumOutlined } from "lucide-react";
import {
  PanelLeftClose as IconSidebarHiddenLeftWideOutlined,
  PanelLeftOpen as IconSidebarVisibleLeftWideOutlined,
} from "lucide-react";
import { Globe as IconWorldOutlined } from "lucide-react";
import { House as IconHomeFilled, Images as IconImagesFilled } from "@phosphor-icons/react";
import { Icon } from "@higgsfield/quanta/icon";
import { Button } from "@higgsfield/quanta/button";
import { Loader } from "@higgsfield/quanta/loader";
import { Sidebar } from "@higgsfield/quanta/sidebar";
import { Tabs } from "@higgsfield/quanta/tabs";
import { Typography } from "@higgsfield/quanta/typography";
import type {
  AssetLibraryItem,
  AssetLibraryPagination,
  AssetSelection,
} from "@/components/asset-library";
import { ExamplePresets } from "@/components/example-presets";
import type { GalleryItem } from "@/components/gallery";
import { HeroComposition } from "@/components/hero-composition";
import { IconTile } from "@/components/icon-tile";
import { MyProjects } from "@/components/my-projects";
import type { MyProjectsProject } from "@/components/my-projects";
import { ProjectActions } from "@/components/project-actions";
import { ProjectCreateModal } from "@/components/project-create-modal";
import { SignInModal } from "@/components/sign-in-modal";
import { StudioPromptBox } from "@/components/studio-prompt-box";
import type {
  PromptModeOption,
  PromptSettingOption,
  PromptUploadOption,
} from "@/components/studio-prompt-box";
import { TEMPLATES } from "@/components/template-picker";
import type { TemplateItem } from "@/components/template-picker";
import { UserGenerations } from "@/components/user-generations";
import { appFaviconUrl, appMeta } from "@/lib/app-meta";
import { getSignInUrl, STUDIO_JOBS, uploadAsset } from "@/lib/fnf.browser";
import {
  generationToAssetItem,
  generationToGalleryItem,
  getGenerationFailureLabel,
  getGenerationStatusLabel,
  mediaRefToAssetItem,
  selectGenerationMedia,
} from "@/lib/higgsfield-generation-results";
import {
  flattenMediaPages,
  getNextCursor,
  getNextStudioCursor,
  indexProjectItems,
} from "@/lib/studio-history";
import { linkProjectWithOneRetry } from "@/lib/project-link-retry";
import {
  createStudioProjectFn,
  deleteStudioProjectFn,
  linkStudioGenerationsFn,
  listStudioProjectsFn,
  renameStudioProjectFn,
} from "@/lib/studio-projects.functions";

/**
 * Production-ready Studio scaffold: one FNF-backed prompt state is shared by
 * the home and history docks; uploads are durable; history is cursor-paged and
 * virtualized; app projects and generation links are scoped/persisted in D1.
 * Keep the four Studio pillars when adapting: sidebar, hero, prompt dock, feed.
 */

type StudioGenerationInput = SubmitInputFor<typeof STUDIO_JOBS>;
type StudioProject = MyProjectsProject;
type StudioDockProps = Omit<ComponentProps<typeof StudioPromptBox>, "className" | "surface">;
type StudioView = { kind: "home" } | { kind: "all" } | { kind: "project"; projectId: string };

const HISTORY_QUERY = { type: "video" as const, size: 40 };
const IMAGE_LIBRARY_QUERY = { type: "image" as const, size: 40 };

// PLACEHOLDER ASSETS — replace these hero/example assets when adapting the
// scaffold. The root AGENTS.md and `bun run check:adapted` make this mandatory.
const HERO_FALLBACKS = [
  "/presets/skateboard-illustration.png",
  "/presets/chess-illustration.png",
  "/presets/skateboard-illustration.png",
] as const;

const FORMATS = [
  { value: "ugc", title: "UGC", subtitle: "Creator-style, handheld" },
  { value: "tiktok", title: "TikTok", subtitle: "Fast-cut vertical" },
  { value: "reels", title: "Reels", subtitle: "Instagram vertical" },
  { value: "commercial", title: "Commercial", subtitle: "Polished brand film" },
];

const HOOKS = [
  { value: "hook", title: "Hook" },
  { value: "story", title: "Story" },
  { value: "demo", title: "Product demo" },
  { value: "testimonial", title: "Testimonial" },
];

const PROMPT_MODES: PromptModeOption[] = [
  { id: "product", label: "Product", icon: Icon3dBoxTopOutlined },
  { id: "app", label: "App", icon: IconWorldOutlined },
];

const PROMPT_SETTINGS: PromptSettingOption[] = [
  {
    id: "format",
    start: <Icon as={IconBucketOutlined} size="sm" />,
    defaultValue: "ugc",
    options: FORMATS,
  },
  {
    id: "hook",
    start: <Icon as={IconBucketOutlined} size="sm" />,
    defaultValue: "hook",
    options: HOOKS,
  },
];

const PROMPT_UPLOADS: Array<Pick<PromptUploadOption, "id" | "label">> = [
  { id: "product", label: "Product" },
  { id: "avatar", label: "Avatar" },
];

const GALLERY_TABS = [
  { value: "explore", label: "Explore", start: <Icon size="sm" as={IconExploreOutlined} /> },
  {
    value: "projects",
    label: "My Projects",
    start: <Icon size="sm" as={IconProjectsOutlined} />,
  },
];

const HERO_GLOW =
  "radial-gradient(60% 80% at 50% 0%, rgba(160,164,170,0.14) 0%, rgba(160,164,170,0.05) 42%, transparent 72%)";
const HERO_DOTS = "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)";
const HERO_DOTS_MASK =
  "radial-gradient(55% 70% at 50% 0%, #000 0%, rgba(0,0,0,0.35) 45%, transparent 75%)";

function generationTimestamp(item: GalleryItem): number {
  if (typeof item.createdAt === "number") {
    return item.createdAt > 10_000_000_000 ? item.createdAt : item.createdAt * 1000;
  }
  if (typeof item.createdAt === "string") {
    const timestamp = Date.parse(item.createdAt);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
  }
  return Number.NEGATIVE_INFINITY;
}

function latestProjectCover(
  project: StudioProject,
  generations: GalleryItem[],
): string | undefined {
  const matching = generations.filter((item) => item.status === "ready" && item.src !== "");
  if (matching.length === 0) return project.cover;
  return matching.reduce((latest, item) =>
    generationTimestamp(item) > generationTimestamp(latest) ? item : latest,
  ).src;
}

function useRequiredFnfScopeKey(): string {
  const scopeKey = useFnfScopeKey();
  if (scopeKey == null) throw new Error("Studio requires a user/workspace cache scope.");
  return scopeKey;
}

function StudioSidebar({
  view,
  onViewChange,
  projects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: {
  view: StudioView;
  onViewChange: (view: StudioView) => void;
  projects: StudioProject[];
  onCreateProject: (name: string) => Promise<void>;
  onRenameProject: (projectId: string, name: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}) {
  const title = appMeta.og_title?.trim() || "Studio";

  return (
    <Sidebar.Root
      product="marketing-studio"
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
                  <span aria-hidden className="text-q-caption-xs-bold">
                    {title.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className="studio-sidebar-expand-icon pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <Icon as={IconSidebarVisibleLeftWideOutlined} size="md" />
              </span>
            </span>
          </Sidebar.Logo>
          <Sidebar.Title>{title}</Sidebar.Title>
        </Sidebar.Switcher>
        <Sidebar.Toggle>
          <Icon as={IconSidebarHiddenLeftWideOutlined} size="md" />
        </Sidebar.Toggle>
      </Sidebar.Header>

      <Sidebar.Body>
        <Sidebar.Section>
          <Sidebar.SectionItems>
            <Sidebar.Item
              selected={view.kind === "home"}
              onClick={() => onViewChange({ kind: "home" })}
              start={<IconTile as={IconHomeFilled} gradient="blue" />}
              title="Home"
            />
            <Sidebar.Item
              selected={view.kind === "all"}
              onClick={() => onViewChange({ kind: "all" })}
              start={<IconTile as={IconImagesFilled} gradient="purple" />}
              title="All Generations"
            />
          </Sidebar.SectionItems>
        </Sidebar.Section>

        <Sidebar.Section>
          <Sidebar.SectionHeader>
            <Sidebar.SectionTitle>Projects</Sidebar.SectionTitle>
            <Sidebar.SectionActions>
              <ProjectCreateModal
                onCreate={onCreateProject}
                trigger={
                  <Sidebar.ActionButton aria-label="New project">
                    <Icon as={IconPlusMediumOutlined} size="md" />
                  </Sidebar.ActionButton>
                }
              />
            </Sidebar.SectionActions>
          </Sidebar.SectionHeader>
          <Sidebar.SectionItems>
            {projects.length === 0 ? (
              <ProjectCreateModal
                onCreate={onCreateProject}
                trigger={
                  <Sidebar.Item
                    variant="project"
                    start={
                      <span className="relative flex size-6 items-center justify-center overflow-hidden rounded-q-200 border border-[rgba(197,197,197,0.3)] bg-[rgba(255,255,255,0.04)] text-q-icon-secondary shadow-[0_5px_6px_rgba(0,0,0,0.1),inset_0_-0.3px_5px_rgba(185,185,185,0.35)] backdrop-blur-[3.7px]">
                        <Icon as={IconPlusMediumOutlined} size="sm" />
                      </span>
                    }
                    title={
                      <span className="text-q-label-sm-medium text-q-text-secondary">
                        Add project
                      </span>
                    }
                  />
                }
              />
            ) : (
              projects.map((project) => {
                return (
                  <Sidebar.Item
                    key={project.id}
                    variant="project"
                    selected={view.kind === "project" && view.projectId === project.id}
                    onClick={() => onViewChange({ kind: "project", projectId: project.id })}
                    start={
                      <Sidebar.ProjectThumbnail
                        src={project.cover}
                        alt={project.cover ? `Latest generation in ${project.name}` : ""}
                        fallback={project.name.slice(0, 1).toUpperCase()}
                      />
                    }
                    title={project.name}
                    meta={project.generationCount.toLocaleString("en-US")}
                    action={
                      <ProjectActions
                        projectName={project.name}
                        onRename={(name) => onRenameProject(project.id, name)}
                        onDelete={() => onDeleteProject(project.id)}
                      />
                    }
                    actionVisibility="hover"
                  />
                );
              })
            )}
          </Sidebar.SectionItems>
        </Sidebar.Section>
      </Sidebar.Body>
    </Sidebar.Root>
  );
}

function BeforeState({
  projects,
  generations,
  dock,
  onCreateProject,
  onOpenAllGenerations,
  onOpenProject,
  onUseTemplate,
  onOpenProjects,
  projectError,
}: {
  projects: StudioProject[];
  generations: GalleryItem[];
  dock: StudioDockProps;
  onCreateProject: (name: string) => Promise<void>;
  onOpenAllGenerations: () => void;
  onOpenProject: (project: StudioProject) => void;
  onUseTemplate: (template: TemplateItem) => void;
  onOpenProjects: () => boolean;
  projectError?: string;
}) {
  const [galleryTab, setGalleryTab] = useState("explore");
  const promptRef = useRef<HTMLDivElement>(null);
  const heroImages = useMemo(() => {
    const ready = generations
      .filter((item) => item.status === "ready" && item.src !== "")
      .slice(0, 3)
      .map((item) => item.src);
    return [
      ready[0] ?? HERO_FALLBACKS[0],
      ready[1] ?? HERO_FALLBACKS[1],
      ready[2] ?? HERO_FALLBACKS[2],
    ] as const;
  }, [generations]);

  const handleUseTemplate = (template: TemplateItem) => {
    onUseTemplate(template);
    promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          backgroundImage: HERO_DOTS,
          backgroundSize: "14px 14px",
          maskImage: HERO_DOTS_MASK,
          WebkitMaskImage: HERO_DOTS_MASK,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{ backgroundImage: HERO_GLOW }}
      />

      <div className="relative flex w-full flex-col items-center gap-12 px-6 pb-16 pt-16">
        <div ref={promptRef} className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-5">
            <HeroComposition images={heroImages} alt="Recent Studio outputs" />
            <Typography
              as="h1"
              variant="headline-md-bold"
              color="primary"
              className="max-w-[640px] text-center uppercase"
            >
              Turn any product into a video ad
            </Typography>
          </div>
          <StudioPromptBox {...dock} />
        </div>

        <div className="flex w-full max-w-[900px] flex-col items-start gap-5">
          <Tabs.Root
            className="example-presets-tabs"
            variant="segmented"
            shape="pill"
            surface="glass"
            tone="glass"
            value={galleryTab}
            onValueChange={(value) => {
              const nextTab = String(value);
              if (nextTab === "projects" && !onOpenProjects()) return;
              setGalleryTab(nextTab);
            }}
          >
            <Tabs.List items={GALLERY_TABS} />
          </Tabs.Root>

          {projectError != null && galleryTab === "projects" ? (
            <Typography as="p" variant="body-sm-regular" color="danger">
              {projectError}
            </Typography>
          ) : null}

          <div key={galleryTab} className="home-gallery-panel">
            {galleryTab === "projects" ? (
              <MyProjects
                projects={projects}
                generations={generations}
                onCreateProject={onCreateProject}
                onOpenAllGenerations={onOpenAllGenerations}
                onOpenProject={onOpenProject}
              />
            ) : (
              <ExamplePresets items={TEMPLATES} onUse={handleUseTemplate} className="w-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AfterPromptDock({ dock }: { dock: StudioDockProps }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4 pt-24"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, transparent 0%, var(--hf-color-background-primary) 100%)",
      }}
    >
      <StudioPromptBox
        {...dock}
        surface="glass"
        className="pointer-events-auto w-[900px] max-w-full"
      />
    </div>
  );
}

function GenerationsState({
  items,
  previewItems,
  title,
  loading,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  manualLoadMore,
  dock,
}: {
  items: GalleryItem[];
  previewItems: GalleryItem[];
  title: string;
  loading: boolean;
  error?: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => Promise<unknown>;
  manualLoadMore: boolean;
  dock: StudioDockProps;
}) {
  const emptyStateImages = useMemo(() => {
    const ready = previewItems
      .filter((item) => item.status === "ready" && item.src !== "")
      .slice(0, 3)
      .map((item) => item.src);
    return [
      ready[0] ?? HERO_FALLBACKS[0],
      ready[1] ?? HERO_FALLBACKS[1],
      ready[2] ?? HERO_FALLBACKS[2],
    ] as const;
  }, [previewItems]);
  const showBlockingError = error != null && items.length === 0 && !import.meta.env.DEV;
  const showInlineError = error != null && !import.meta.env.DEV;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-40 pt-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader size="md" color="neutral" aria-label="Loading generation history" />
          </div>
        ) : showBlockingError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Typography as="p" variant="body-sm-regular" color="danger">
              {error}
            </Typography>
            <Button variant="tertiary" size="sm" onClick={() => void onLoadMore()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {showInlineError ? (
              <div className="flex shrink-0 items-center justify-between gap-3 rounded-q-300 bg-q-transparent-light-05 px-3 py-2">
                <Typography as="p" variant="caption-sm-regular" color="danger">
                  {error}
                </Typography>
                <Button variant="tertiary" size="xs" onClick={() => void onLoadMore()}>
                  Retry
                </Button>
              </div>
            ) : null}
            <UserGenerations
              items={items}
              title={title}
              emptyState={{
                images: emptyStateImages,
                title:
                  title === "All Generations" ? "No generations yet" : `No generations in ${title}`,
                description: "Describe an idea below, then generate the first result.",
              }}
              hasMore={hasMore && !manualLoadMore}
              loadingMore={loadingMore}
              onLoadMore={onLoadMore}
            />
            {manualLoadMore && hasMore ? (
              <div className="flex shrink-0 justify-center">
                <Button
                  variant="tertiary"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => void onLoadMore()}
                >
                  {loadingMore ? "Loading…" : "Load older"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <AfterPromptDock dock={dock} />
    </div>
  );
}

export function StudioTemplate() {
  const jobClient = useFnfJobClient<typeof STUDIO_JOBS>();
  const mediaClient = useFnfMediaClient();
  const scopeKey = useRequiredFnfScopeKey();
  const queryClient = useQueryClient();
  const run = useGenerationRun(jobClient, { scopeKey });
  const [view, setView] = useState<StudioView>({ kind: "home" });
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("product");
  const [settingValues, setSettingValues] = useState<Record<string, string>>({
    format: "ugc",
    hook: "hook",
  });
  const [references, setReferences] = useState<Record<string, AssetSelection | undefined>>({});
  const [localUploads, setLocalUploads] = useState<AssetLibraryItem[]>([]);
  const [linkOverrides, setLinkOverrides] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingSignInUrl, setPendingSignInUrl] = useState<string | null>(null);
  const prependedIds = useRef(new Set<string>());
  const linkingIds = useRef(new Set<string>());
  const runProjectId = useRef<string | undefined>(undefined);
  const navigateToAllOnSubmitRef = useRef(false);
  const projectsQueryKey = useMemo(
    () => ["studio", "scope", scopeKey, "projects"] as const,
    [scopeKey],
  );

  const history = useInfiniteQuery({
    ...jobsFeedQueryOptions(jobClient, HISTORY_QUERY, { scopeKey }),
    getNextPageParam: getNextStudioCursor,
    select: flattenFeedPages,
  });
  const imageHistory = useInfiniteQuery({
    ...jobsFeedQueryOptions(jobClient, IMAGE_LIBRARY_QUERY, { scopeKey }),
    getNextPageParam: getNextStudioCursor,
    select: flattenFeedPages,
  });
  const liveGenerations = useMemo(
    () => [...(history.data ?? []), ...(imageHistory.data ?? [])],
    [history.data, imageHistory.data],
  );
  useLiveFeedGenerations(jobClient, liveGenerations, { scopeKey });
  const persistedUploads = useInfiniteQuery({
    queryKey: ["fnf", "scope", scopeKey, "media", "image"],
    queryFn: ({ pageParam }) =>
      mediaClient.list({
        type: "image",
        size: 40,
        ...(pageParam !== undefined ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | number | undefined,
    getNextPageParam: getNextCursor,
    select: flattenMediaPages,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const projectData = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => listStudioProjectsFn(),
    refetchOnWindowFocus: false,
  });

  const generations = useMemo(() => {
    const runIds = new Set(run.generations.map((generation) => generation.id));
    return [
      ...run.generations,
      ...(history.data ?? []).filter((generation) => !runIds.has(generation.id)),
    ];
  }, [history.data, run.generations]);
  const generationProjects = useMemo(() => {
    const result: Record<string, string> = {};
    for (const link of projectData.data?.links ?? []) result[link.generationId] = link.projectId;
    return { ...result, ...linkOverrides };
  }, [linkOverrides, projectData.data?.links]);
  const galleryItems = useMemo(
    () =>
      generations
        .map((generation) => generationToGalleryItem(generation, generationProjects[generation.id]))
        .filter((item): item is GalleryItem => item != null),
    [generationProjects, generations],
  );
  const projectItems = useMemo(() => indexProjectItems(galleryItems), [galleryItems]);
  const projects = useMemo<StudioProject[]>(
    () =>
      (projectData.data?.projects ?? []).map((project) => {
        const items = projectItems.get(project.id) ?? [];
        const base: StudioProject = {
          id: project.id,
          name: project.name,
          generationCount: project.generationCount,
          updatedAt: project.updatedAt,
        };
        const cover = latestProjectCover(base, items);
        return cover ? { ...base, cover } : base;
      }),
    [projectData.data?.projects, projectItems],
  );
  const selectedProject = useMemo(
    () =>
      view.kind === "project"
        ? projects.find((project) => project.id === view.projectId)
        : undefined,
    [projects, view],
  );
  const visibleItems = useMemo(
    () => (view.kind === "project" ? (projectItems.get(view.projectId) ?? []) : galleryItems),
    [galleryItems, projectItems, view],
  );
  const libraryGenerations = useMemo(() => {
    const generationIds = new Set(generations.map((generation) => generation.id));
    return [
      ...generations,
      ...(imageHistory.data ?? []).filter((generation) => !generationIds.has(generation.id)),
    ];
  }, [generations, imageHistory.data]);

  const libraryItems = useMemo(() => {
    const localIds = new Set(localUploads.map((item) => item.ref?.id));
    return [
      ...localUploads,
      ...(persistedUploads.data ?? [])
        .filter((ref) => !localIds.has(ref.id))
        .map(mediaRefToAssetItem)
        .filter((item): item is AssetLibraryItem => item != null),
      ...libraryGenerations
        .map(generationToAssetItem)
        .filter((item): item is AssetLibraryItem => item != null),
    ];
  }, [libraryGenerations, localUploads, persistedUploads.data]);
  const loadMoreUploads =
    persistedUploads.data == null ||
    (persistedUploads.error != null && !persistedUploads.isFetchNextPageError)
      ? persistedUploads.refetch
      : persistedUploads.fetchNextPage;
  const loadMoreLibraryVideos =
    history.data == null || (history.error != null && !history.isFetchNextPageError)
      ? history.refetch
      : history.fetchNextPage;
  const loadMoreLibraryImages =
    imageHistory.data == null || (imageHistory.error != null && !imageHistory.isFetchNextPageError)
      ? imageHistory.refetch
      : imageHistory.fetchNextPage;

  const libraryPagination = useMemo<AssetLibraryPagination>(
    () => ({
      uploads: {
        hasMore: persistedUploads.hasNextPage === true,
        loading: persistedUploads.isPending || persistedUploads.isFetchingNextPage,
        ...(persistedUploads.error instanceof Error
          ? { error: persistedUploads.error.message }
          : {}),
        onLoadMore: loadMoreUploads,
      },
      image: {
        hasMore: imageHistory.hasNextPage === true,
        loading: imageHistory.isPending || imageHistory.isFetchingNextPage,
        ...(imageHistory.error instanceof Error ? { error: imageHistory.error.message } : {}),
        onLoadMore: loadMoreLibraryImages,
      },
      video: {
        hasMore: history.hasNextPage === true,
        loading: history.isPending || history.isFetchingNextPage,
        ...(history.error instanceof Error ? { error: history.error.message } : {}),
        onLoadMore: loadMoreLibraryVideos,
      },
    }),
    [
      history.error,
      history.hasNextPage,
      history.isFetchingNextPage,
      history.isPending,
      imageHistory.error,
      imageHistory.hasNextPage,
      imageHistory.isFetchingNextPage,
      imageHistory.isPending,
      loadMoreLibraryImages,
      loadMoreLibraryVideos,
      loadMoreUploads,
      persistedUploads.error,
      persistedUploads.hasNextPage,
      persistedUploads.isFetchingNextPage,
      persistedUploads.isPending,
    ],
  );

  const input = useMemo<StudioGenerationInput>(() => {
    const format = settingValues.format ?? "ugc";
    const hook = settingValues.hook ?? "hook";
    const selections = Object.values(references).flatMap((selection) =>
      selection?.ref ? [{ kind: selection.kind, ref: selection.ref }] : [],
    );
    const images = selections.filter(({ kind }) => kind !== "video").map(({ ref }) => ref);
    const videos = selections.filter(({ kind }) => kind === "video").map(({ ref }) => ref);
    const formatLabel = FORMATS.find((candidate) => candidate.value === format)?.title ?? format;
    const hookLabel = HOOKS.find((candidate) => candidate.value === hook)?.title ?? hook;
    const instruction = [
      `Create a ${formatLabel} ${mode} video with a ${hookLabel} structure.`,
      prompt.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      model: "seedance_2_0",
      prompt: { instruction },
      ...(images.length > 0 || videos.length > 0
        ? {
            media: {
              ...(images.length > 0 ? { image: images } : {}),
              ...(videos.length > 0 ? { video: videos } : {}),
            },
          }
        : {}),
      settings: {
        duration: 8,
        aspectRatio: format === "commercial" ? "16:9" : "9:16",
        resolution: "720p",
        mode: "std",
        batchSize: 1,
        generateAudio: true,
        bitrateMode: "standard",
      },
    };
  }, [mode, prompt, references, settingValues.format, settingValues.hook]);

  const hasReference = Object.values(references).some((selection) => selection?.ref != null);
  const canGenerate = prompt.trim().length > 0 || hasReference;
  const runFailure = useMemo(() => {
    for (const generation of run.generations) {
      const media = selectGenerationMedia(generation);
      if (media.kind !== "empty" || !media.terminal) continue;
      return (
        getGenerationFailureLabel(generation) ??
        (media.reason === "preview_unavailable"
          ? "The generation completed without previewable media."
          : getGenerationStatusLabel(generation))
      );
    }
    return undefined;
  }, [run.generations]);
  const cost = useQuery({
    ...costQueryOptions(jobClient, input, { enabled: canGenerate, scopeKey }),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const fresh =
      history.data == null
        ? []
        : run.generations.filter((generation) => !prependedIds.current.has(generation.id));
    if (fresh.length > 0) {
      for (const generation of fresh) prependedIds.current.add(generation.id);
      prependGenerations(queryClient, HISTORY_QUERY, fresh, { scopeKey });
    }

    const projectId = runProjectId.current;
    if (!projectId) return;
    const unlinked = run.generations.filter((generation) => !linkingIds.current.has(generation.id));
    if (unlinked.length === 0) return;
    const ids = unlinked.map((generation) => generation.id);
    for (const id of ids) linkingIds.current.add(id);
    setLinkOverrides((current) => ({
      ...current,
      ...Object.fromEntries(ids.map((id) => [id, projectId])),
    }));
    void linkProjectWithOneRetry(() =>
      linkStudioGenerationsFn({ data: { projectId, generationIds: ids } }),
    )
      .then(() => queryClient.invalidateQueries({ queryKey: projectsQueryKey }))
      .catch((error: unknown) => {
        for (const id of ids) linkingIds.current.delete(id);
        setLinkOverrides((current) => {
          const next = { ...current };
          for (const id of ids) delete next[id];
          return next;
        });
        setSubmitError(error instanceof Error ? error.message : "Could not save the project link.");
      });
  }, [history.data, projectsQueryKey, queryClient, run.generations, scopeKey]);

  useEffect(() => {
    if (!navigateToAllOnSubmitRef.current || run.generations.length === 0) return;
    navigateToAllOnSubmitRef.current = false;
    setView({ kind: "all" });
  }, [run.generations.length]);

  const handleUpload = async (file: File): Promise<AssetSelection> => {
    const uploaded = await uploadAsset(file);
    const item = { ...uploaded, kind: "upload" as const, personal: true };
    setLocalUploads((current) => [
      item,
      ...current.filter((candidate) => candidate.ref?.id !== uploaded.ref?.id),
    ]);
    return item;
  };

  const handleCreateProject = async (name: string) => {
    const project = await createStudioProjectFn({ data: { name } });
    await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    setView({ kind: "project", projectId: project.id });
  };

  const handleRenameProject = async (projectId: string, name: string) => {
    await renameStudioProjectFn({ data: { projectId, name } });
    await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteStudioProjectFn({ data: { projectId } });
    await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    if (view.kind === "project" && view.projectId === projectId) {
      setView({ kind: "all" });
    }
  };

  const handleUseTemplate = (template: TemplateItem) => {
    setPrompt(`${template.title} — ${template.subtitle}`);
    setSettingValues((current) => ({ ...current, format: template.category }));
  };

  const allowPersonalNavigation = useCallback(() => {
    const signInUrl = getSignInUrl(
      scopeKey,
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    if (signInUrl != null) {
      setPendingSignInUrl(signInUrl);
      return false;
    }
    return true;
  }, [scopeKey]);

  const handleViewChange = useCallback(
    (nextView: StudioView) => {
      if (nextView.kind !== "home" && !allowPersonalNavigation()) return;
      setView(nextView);
    },
    [allowPersonalNavigation],
  );

  const handleGenerate = () => {
    if (!canGenerate || run.status === "submitting") return;
    if (!allowPersonalNavigation()) return;
    setSubmitError(null);
    runProjectId.current = view.kind === "project" ? view.projectId : undefined;
    // The host approval iframe owns confirmation. Do not navigate away from
    // Home until the approved submit has actually created a generation.
    navigateToAllOnSubmitRef.current = runProjectId.current == null;
    void run.start(input).then((generations) => {
      if (generations.length === 0) navigateToAllOnSubmitRef.current = false;
    });
  };

  const promptUploads = PROMPT_UPLOADS.map((upload) => ({
    ...upload,
    selection: references[upload.id],
  }));
  const dock: StudioDockProps = {
    modes: PROMPT_MODES,
    mode,
    onModeChange: setMode,
    settings: PROMPT_SETTINGS,
    settingValues,
    onSettingChange: (id, value) => setSettingValues((current) => ({ ...current, [id]: value })),
    uploads: promptUploads,
    assetLibrary: {
      items: libraryItems,
      onUpload: handleUpload,
      pagination: libraryPagination,
    },
    onAddMedia: (selection) => {
      const target = PROMPT_UPLOADS.find((upload) => references[upload.id] == null)?.id;
      if (target == null) {
        setSubmitError("Remove a Product or Avatar reference before adding another.");
        return;
      }
      setSubmitError(null);
      setReferences((current) => ({ ...current, [target]: selection }));
    },
    onUploadSelect: (id, selection) => {
      setSubmitError(null);
      setReferences((current) => ({ ...current, [id]: selection }));
    },
    onUploadRemove: (id) => {
      setSubmitError(null);
      setReferences((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    },
    onSelectTemplate: handleUseTemplate,
    prompt,
    onPromptChange: setPrompt,
    cost: cost.data?.credits ?? "—",
    onGenerate: handleGenerate,
    submitting: run.status === "submitting",
    generateDisabled: !canGenerate,
    error: submitError ?? run.error?.message ?? runFailure ?? run.warning ?? undefined,
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-q-background-primary">
      <SignInModal
        open={pendingSignInUrl != null}
        signInUrl={pendingSignInUrl}
        onOpenChange={(open) => {
          if (!open) setPendingSignInUrl(null);
        }}
      />
      <StudioSidebar
        view={view}
        onViewChange={handleViewChange}
        projects={projects}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {view.kind === "home" ? (
          <BeforeState
            projects={projects}
            generations={galleryItems}
            dock={dock}
            onCreateProject={handleCreateProject}
            onOpenAllGenerations={() => handleViewChange({ kind: "all" })}
            onOpenProject={(project) =>
              handleViewChange({ kind: "project", projectId: project.id })
            }
            onUseTemplate={handleUseTemplate}
            onOpenProjects={allowPersonalNavigation}
            projectError={
              projectData.error instanceof Error ? projectData.error.message : undefined
            }
          />
        ) : (
          <GenerationsState
            items={visibleItems}
            previewItems={galleryItems}
            title={selectedProject?.name ?? "All Generations"}
            loading={history.isPending && visibleItems.length === 0}
            error={history.error instanceof Error ? history.error.message : undefined}
            hasMore={history.error == null && history.hasNextPage === true}
            loadingMore={history.isFetchingNextPage}
            onLoadMore={loadMoreLibraryVideos}
            manualLoadMore={view.kind === "project"}
            dock={dock}
          />
        )}
      </main>
    </div>
  );
}
