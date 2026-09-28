import type { ComponentProps, CSSProperties } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flattenFeedPages,
  jobsFeedQueryOptions,
  useFnfJobClient,
  useFnfMediaClient,
  useFnfScopeKey,
} from "@higgsfield/fnf-react";
import { Compass as IconExploreOutlined } from "lucide-react";
import { Folder as IconProjectsOutlined } from "lucide-react";
import { Plus as IconPlusMediumOutlined } from "lucide-react";
import {
  PanelLeftClose as IconSidebarHiddenLeftWideOutlined,
  PanelLeftOpen as IconSidebarVisibleLeftWideOutlined,
} from "lucide-react";
import { Clock as IconClockOutlined, MapPin as IconMapPinOutlined } from "lucide-react";
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
import { ACCOUNT_ITEMS, NAV_ITEMS } from "@/lib/navigation";
import { BRAND } from "@/lib/brand";
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
import { TEMPLATE_PREVIEWS, TEMPLATES } from "@/components/template-picker";
import type { TemplateItem } from "@/components/template-picker";
import { StoryFeedGrid } from "@/components/story/story-feed";
import { useStoriesFeed } from "@/components/story/use-stories-feed";
import { appFaviconUrl, appMeta } from "@/lib/app-meta";
import { getSignInUrl, uploadAsset } from "@/lib/fnf.browser";
import {
  generationToAssetItem,
  generationToGalleryItem,
  mediaRefToAssetItem,
} from "@/lib/higgsfield-generation-results";
import {
  flattenMediaPages,
  getNextCursor,
  getNextStudioCursor,
} from "@/lib/studio-history";
import {
  createStudioProjectFn,
  deleteStudioProjectFn,
  listStudioProjectsFn,
  renameStudioProjectFn,
} from "@/lib/studio-projects.functions";
import { createStoryFn } from "@/lib/story.functions";
import type { StoryDTO } from "@/lib/story-engine.server";
import { DEFAULT_DURATION_SECONDS, DURATION_OPTIONS, STORY_LOCATIONS } from "@/lib/story-templates";

/**
 * Production-ready Studio scaffold: one FNF-backed prompt state is shared by
 * the home and history docks; uploads are durable; history is cursor-paged and
 * virtualized; app projects and generation links are scoped/persisted in D1.
 * Keep the four Studio pillars when adapting: sidebar, hero, prompt dock, feed.
 */

type StudioProject = MyProjectsProject;
type StudioDockProps = Omit<ComponentProps<typeof StudioPromptBox>, "className" | "surface">;
type StudioView = { kind: "home" } | { kind: "all" } | { kind: "project"; projectId: string };

const HISTORY_QUERY = { type: "video" as const, size: 40 };
const IMAGE_LIBRARY_QUERY = { type: "image" as const, size: 40 };

// Bespoke CineStory template stills — see components/template-picker.tsx.
const HERO_FALLBACKS = [
  TEMPLATE_PREVIEWS["storytime"],
  TEMPLATE_PREVIEWS["movie-trailer"],
  TEMPLATE_PREVIEWS["fashion-campaign"],
] as const;

const LOCATION_OPTIONS = STORY_LOCATIONS.map((location) => ({
  value: location.id,
  title: location.title,
}));

const DURATION_SELECT_OPTIONS = DURATION_OPTIONS.map((option) => ({
  value: option.value,
  title: option.title,
}));

const PROMPT_MODES: PromptModeOption[] = [];

const PROMPT_SETTINGS: PromptSettingOption[] = [
  {
    id: "location",
    start: <Icon as={IconMapPinOutlined} size="sm" />,
    defaultValue: "match-template",
    options: LOCATION_OPTIONS,
  },
  {
    id: "duration",
    start: <Icon as={IconClockOutlined} size="sm" />,
    defaultValue: String(DEFAULT_DURATION_SECONDS),
    options: DURATION_SELECT_OPTIONS,
  },
];

const PROMPT_UPLOADS: Array<Pick<PromptUploadOption, "id" | "label">> = [
  { id: "selfie", label: "Your Photo" },
  { id: "reference", label: "Product / Logo" },
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
              start={<IconTile as={IconHomeFilled} gradient="brand" />}
              title="Home"
            />
            <Sidebar.Item
              selected={view.kind === "all"}
              onClick={() => onViewChange({ kind: "all" })}
              start={<IconTile as={IconImagesFilled} gradient="ember" />}
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

        {/*
         * The pipeline. Without this the Studio carried only Home / All
         * Generations / Projects while every other screen carried the full
         * CineStory navigation, so the two halves of the product read as two
         * different apps and the Studio looked like a tool someone left behind.
         * Same list, same order, same icons as AppShell — one source of truth.
         */}
        <Sidebar.Section>
          <Sidebar.SectionHeader>
            <Sidebar.SectionTitle>{BRAND.product}</Sidebar.SectionTitle>
          </Sidebar.SectionHeader>
          <Sidebar.SectionItems>
            {NAV_ITEMS.map((item) => (
              <Sidebar.Item
                key={item.path}
                onClick={() => { window.location.href = item.path; }}
                start={<IconTile as={item.icon} gradient="brand" />}
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
                onClick={() => { window.location.href = item.path; }}
                start={<IconTile as={item.icon} gradient="neutral" />}
                title={item.label}
              />
            ))}
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
              Turn any idea into a cinematic short film
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

function StoriesState({
  stories,
  loading,
  title,
  dock,
  authorName,
  authorAvatar,
}: {
  stories: StoryDTO[];
  loading: boolean;
  title: string;
  dock: StudioDockProps;
  authorName: string;
  authorAvatar?: string;
}) {
  const emptyStateImages = useMemo(() => {
    const ready = stories
      .filter((story) => story.status === "ready" && story.finalPosterUrl)
      .slice(0, 3)
      .map((story) => story.finalPosterUrl as string);
    return [
      ready[0] ?? HERO_FALLBACKS[0],
      ready[1] ?? HERO_FALLBACKS[1],
      ready[2] ?? HERO_FALLBACKS[2],
    ] as const;
  }, [stories]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-40 pt-4">
        <Typography as="h2" variant="title-sm-semi-bold" color="primary">
          {title}
        </Typography>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <StoryFeedGrid
            stories={stories}
            loading={loading}
            authorName={authorName}
            authorAvatar={authorAvatar}
            emptyState={{
              images: emptyStateImages,
              title: title === "All Stories" ? "No stories yet" : `No stories in ${title}`,
              description: "Describe an idea below and CineStory will direct, cast and cut the film.",
            }}
          />
        </div>
      </div>
      <AfterPromptDock dock={dock} />
    </div>
  );
}

export function StudioTemplate() {
  const jobClient = useFnfJobClient();
  const mediaClient = useFnfMediaClient();
  const scopeKey = useRequiredFnfScopeKey();
  const queryClient = useQueryClient();
  const [view, setView] = useState<StudioView>({ kind: "home" });
  const [prompt, setPrompt] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem>(TEMPLATES[0]);
  const [settingValues, setSettingValues] = useState<Record<string, string>>({
    location: "match-template",
    duration: String(DEFAULT_DURATION_SECONDS),
  });
  const [references, setReferences] = useState<Record<string, AssetSelection | undefined>>({});
  const [localUploads, setLocalUploads] = useState<AssetLibraryItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingSignInUrl, setPendingSignInUrl] = useState<string | null>(null);
  const projectsQueryKey = useMemo(
    () => ["studio", "scope", scopeKey, "projects"] as const,
    [scopeKey],
  );

  // Raw fnf image/video generations — kept ONLY to back the asset-library
  // picker (past uploads + generated stills the story pipeline produced).
  // The user-facing product surface is Stories, driven by useStoriesFeed below.
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

  const galleryItems = useMemo(
    () =>
      (history.data ?? [])
        .map((generation) => generationToGalleryItem(generation))
        .filter((item): item is GalleryItem => item != null),
    [history.data],
  );
  const projects = useMemo<StudioProject[]>(
    () =>
      (projectData.data?.projects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        generationCount: project.generationCount,
        updatedAt: project.updatedAt,
      })),
    [projectData.data?.projects],
  );
  const selectedProject = useMemo(
    () =>
      view.kind === "project"
        ? projects.find((project) => project.id === view.projectId)
        : undefined,
    [projects, view],
  );
  const libraryGenerations = useMemo(() => {
    const generationIds = new Set((history.data ?? []).map((generation) => generation.id));
    return [
      ...(history.data ?? []),
      ...(imageHistory.data ?? []).filter((generation) => !generationIds.has(generation.id)),
    ];
  }, [history.data, imageHistory.data]);

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

  const storiesFeed = useStoriesFeed(scopeKey, view.kind === "project" ? view.projectId : undefined);
  const stories = useMemo(() => storiesFeed.data ?? [], [storiesFeed.data]);

  const hasSelfie = references.selfie?.ref != null;
  const canGenerate = prompt.trim().length > 0 && hasSelfie;

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
    setSelectedTemplate(template);
    if (!prompt.trim()) setPrompt(`${template.title} — ${template.subtitle}`);
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

  const handleGenerate = async () => {
    if (!canGenerate || submitting) return;
    if (!allowPersonalNavigation()) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createStoryFn({
        data: {
          idea: prompt.trim(),
          templateId: selectedTemplate.id,
          locationId: settingValues.location ?? "match-template",
          durationSec: Number(settingValues.duration ?? DEFAULT_DURATION_SECONDS),
          ...(view.kind === "project" ? { projectId: view.projectId } : {}),
          ...(references.selfie?.ref
            ? { selfieRef: { ref: references.selfie.ref, src: references.selfie.src } }
            : {}),
          ...(references.reference?.ref
            ? { referenceRef: { ref: references.reference.ref, src: references.reference.src } }
            : {}),
        },
      });
      setPrompt("");
      await queryClient.invalidateQueries({ queryKey: ["cinestory", "stories", scopeKey] });
      // Lot A: a new story stops at the Script step — open the workspace so
      // the user reviews/edits the script before anything is generated.
      window.location.href = `/workspace?story=${created.id}`;
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "CineStory could not start this story.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const promptUploads = PROMPT_UPLOADS.map((upload) => ({
    ...upload,
    selection: references[upload.id],
  }));
  const dock: StudioDockProps = {
    modes: PROMPT_MODES,
    mode: "story",
    onModeChange: () => {},
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
        setSubmitError("Remove a photo or reference before adding another.");
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
    onGenerate: () => void handleGenerate(),
    submitting,
    generateDisabled: !canGenerate,
    error:
      submitError ??
      (prompt.trim().length > 0 && !hasSelfie
        ? "Add your photo so CineStory can cast you in the story."
        : undefined),
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
          <StoriesState
            stories={stories}
            loading={storiesFeed.isPending && stories.length === 0}
            title={selectedProject?.name ?? "All Stories"}
            dock={dock}
            authorName="You"
          />
        )}
      </main>
    </div>
  );
}
