import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import {
  ArrowRight, Check, ChevronDown, Clapperboard, Film, Image,
  Sparkles, Users, MapPin, DownloadCloud, Menu, X, Eye, Wallet,
} from "lucide-react";
import { appMeta, toOwnAssetUrl } from "@/lib/app-meta";
import { useViewerSession } from "@/lib/use-viewer-session";
import {
  CREDIT_PACKS, SIGNUP_CREDIT_GRANT, VIDEO_ENGINES,
  clipCredits, estimateFilm, imageCredits, packUsdPerCredit,
} from "@/lib/services/pricing";

export const Route = createFileRoute("/")({
  head: () => {
    const ogImage = appMeta.og_image_url ? toOwnAssetUrl(appMeta.og_image_url) : undefined;
    const favicon = appMeta.favicon_url ? toOwnAssetUrl(appMeta.favicon_url) : undefined;
    const description =
      "Write, cast, storyboard and shoot a vertical short film from one idea. " +
      "You approve every shot, and you see what each one costs before it runs.";
    return {
      meta: [
        { title: "CineStory — the AI film studio you direct" },
        { name: "description", content: description },
        { property: "og:title", content: "CineStory — the AI film studio you direct" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(ogImage ? [{ property: "og:image" as const, content: ogImage }] : []),
      ],
      links: [
        ...(favicon ? [{ rel: "icon" as const, href: favicon }] : []),
      ],
    };
  },
  component: LandingPage,
});

// ─── Data ───────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Clapperboard,
    title: "Script and storyboard",
    description:
      "Start from an idea or a manuscript. CineStory writes the beats, then lays them out as scenes you can rewrite before a single frame is generated.",
  },
  {
    icon: Users,
    title: "Characters that hold",
    description:
      "Build a cast once, with reference photos, wardrobe and voice. The same face and the same outfit carry from scene one to the last shot.",
  },
  {
    icon: MapPin,
    title: "Locations with intent",
    description:
      "Each scene gets its own set, lit and framed for the moment it plays. Save the ones that work and reuse them across projects.",
  },
  {
    icon: Eye,
    title: "You approve every shot",
    description:
      "Nothing renders behind your back. Review each still, then each clip, and send back the ones that miss before paying for the next step.",
  },
  {
    icon: Image,
    title: "One media library",
    description:
      "Stills, clips, music and voiceover in one place, tied to the project they belong to. Nothing lives only inside a chat log.",
  },
  {
    icon: DownloadCloud,
    title: "Cut and export",
    description:
      "Scenes are assembled into a finished 1080p MP4, framed 9:16 for TikTok, Reels and Shorts.",
  },
];

const STEPS = [
  { num: "01", title: "Bring the idea", desc: "A sentence, a premise, or a whole manuscript. CineStory turns it into a scene-by-scene script you can edit." },
  { num: "02", title: "Cast and dress the set", desc: "Add characters with reference photos and wardrobe, and pick a location for each scene." },
  { num: "03", title: "Approve the storyboard", desc: "Every scene comes back as a still first. Retake the ones that miss before any video is generated." },
  { num: "04", title: "Shoot and cut", desc: "Approved stills become clips, clips become one finished vertical film." },
];

const FAQ = [
  {
    q: "What is CineStory?",
    a: "A film pipeline rather than a prompt box. You go from idea to script, script to cast and sets, sets to a storyboard, and only then to video — reviewing at each stage instead of hoping one prompt lands.",
  },
  {
    q: "Do I need video editing experience?",
    a: "No. There is no timeline to cut and no keyframes to set. You make the creative decisions — what happens in the scene, who is in it, whether a shot is good enough — and CineStory handles the production.",
  },
  {
    q: "How long does a film take?",
    a: "A short film is usually a few minutes of generation spread across the stages, plus however long you spend reviewing. Approving shots as you go is the slow part, and it is the part worth doing.",
  },
  {
    q: "What do I get at the end?",
    a: "A 1080p MP4 in 9:16, sized for TikTok, Instagram Reels and YouTube Shorts, plus every still and clip that went into it.",
  },
  {
    q: "Can I reuse characters between films?",
    a: "Yes. A character keeps its reference photos, appearance and wardrobe notes, so casting it into a new story picks up where the last one left off.",
  },
  {
    q: "How do credits work?",
    a: `Credits are prepaid and never expire on a monthly cycle — you buy a pack and spend it when you generate. Each step shows its exact cost before it runs, and you choose which video engine to shoot on, so a draft costs a fraction of a final cut. New accounts start with ${SIGNUP_CREDIT_GRANT} free credits.`,
  },
  {
    q: "Which video engine does it use?",
    a: `You pick, per clip. ${VIDEO_ENGINES.map((engine) => engine.name).join(", ")} are all available — cheap ones for drafts, the expensive ones for the take you keep.`,
  },
];

// ─── Primitives ─────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}>
      {children}
    </div>
  );
}

/** The one place the primary call-to-action decides where it sends people. */
function useDestination() {
  const session = useViewerSession();
  const signedIn = session.status === "signed-in";
  return {
    signedIn,
    href: signedIn ? "/studio" : "/__auth/login?return=/studio",
    primaryLabel: signedIn ? "Open the Studio" : "Start creating free",
    secondaryLabel: signedIn ? "Studio" : "Sign in",
  };
}

// ─── Navbar ─────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { href, primaryLabel, secondaryLabel, signedIn } = useDestination();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#features", label: "Features" },
    { href: "#how", label: "How it works" },
    { href: "#cost", label: "What it costs" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-cine-hairline bg-cine-surface/85 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-cine-accent">
            <Clapperboard className="size-4 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">CineStory</span>
        </a>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-white/60 transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
          <div className="ml-4 flex items-center gap-3">
            {!signedIn && (
              <a href="/__auth/login?return=/studio" className="text-sm text-white/60 transition-colors hover:text-white">
                {secondaryLabel}
              </a>
            )}
            <a href={href}>
              <Button variant="marketingPrimary" size="sm">
                {primaryLabel} <ArrowRight className="ml-1 size-3" />
              </Button>
            </a>
          </div>
        </div>

        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <Icon as={mobileOpen ? X : Menu} size="md" className="text-white" />
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-cine-hairline bg-cine-surface/95 px-4 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="text-sm text-white/60">
                {link.label}
              </a>
            ))}
            <a href={href} className="pt-2">
              <Button variant="marketingPrimary" className="w-full">{primaryLabel}</Button>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

/**
 * Kinds of film people actually make here. Shown as a static line under the
 * headline rather than cycled through it: a rotating headline gambles on
 * whichever niche happens to be on screen when someone arrives, and "a fashion
 * film" reads as the whole product rather than one example of it.
 */
const FILM_KINDS = [
  "Short films",
  "Vertical drama",
  "Product commercials",
  "Book adaptations",
  "Brand stories",
];

function Hero() {
  const { href, primaryLabel } = useDestination();

  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-cine-surface">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-cine-accent/20 blur-[130px]" />
        <div className="absolute right-1/4 top-1/3 h-[420px] w-[420px] rounded-full bg-cine-ember/15 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-[90vh] max-w-7xl flex-col items-center justify-center px-4 pt-24 text-center sm:px-6 lg:px-8">
        <FadeIn>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cine-hairline bg-white/5 px-4 py-1.5">
            <Sparkles className="size-3.5 text-cine-accent" />
            <span className="text-xs text-white/60">Script → cast → storyboard → film</span>
          </div>
        </FadeIn>

        <FadeIn delay={150}>
          <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Turn your idea into a{" "}
            <span className="bg-gradient-to-r from-cine-accent via-cine-accent-hover to-cine-ember bg-clip-text text-transparent">
              finished film
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={300}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
            Not one prompt and a shrug. A real pipeline: CineStory writes the script, you cast it,
            approve the storyboard, then shoot. Every shot is yours to accept or send back.
          </p>
        </FadeIn>

        <FadeIn delay={400}>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-white/45">
            {FILM_KINDS.map((kind, i) => (
              <li key={kind} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden="true" className="text-white/20">·</span>}
                {kind}
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn delay={500}>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <a href={href}>
              <Button variant="marketingPrimary" size="lg" className="group text-base">
                {primaryLabel}
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
            <a href="#how">
              <Button variant="tertiary" size="lg" className="text-base">See how it works</Button>
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={600}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/40">
            <span className="flex items-center gap-2"><Check className="size-3.5 text-cine-accent" /> No credit card</span>
            <span className="flex items-center gap-2"><Check className="size-3.5 text-cine-accent" /> {SIGNUP_CREDIT_GRANT} free credits</span>
            <span className="flex items-center gap-2"><Check className="size-3.5 text-cine-accent" /> Every cost shown before it runs</span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Features ───────────────────────────────────────────────────────────────

function Features() {
  return (
    <section id="features" className="border-t border-cine-hairline bg-cine-surface py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">A studio, not a prompt box</h2>
            <p className="mt-4 text-lg text-white/60">Every stage of a real production, in one place.</p>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 80}>
              <div className="group h-full rounded-2xl border border-cine-hairline bg-white/[0.02] p-6 transition-all duration-300 hover:border-cine-accent/30 hover:bg-white/[0.04]">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-cine-accent-soft text-cine-accent ring-1 ring-cine-accent/25">
                  <Icon as={feature.icon} size="md" />
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{feature.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ───────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how" className="border-t border-cine-hairline bg-cine-surface py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Four stages, and you sign off on each</h2>
            <p className="mt-4 text-lg text-white/60">Nothing expensive runs before you have seen what it is based on.</p>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <FadeIn key={step.num} delay={i * 120}>
              <div className="relative text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-cine-accent/25 bg-cine-accent-soft text-2xl font-bold text-cine-accent">
                  {step.num}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+2.5rem)] top-8 hidden h-px w-[calc(100%-5rem)] bg-gradient-to-r from-cine-accent/40 to-transparent md:block" />
                )}
                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── What it costs ──────────────────────────────────────────────────────────

const SCENE_COUNT = 5;
const SECONDS_PER_SCENE = 5;

/**
 * The transparency section. Every number here is computed from the same
 * pricing module the Studio charges from, so this page cannot drift from the
 * bill. That is the whole point of showing it.
 */
function CostSection() {
  const [engineId, setEngineId] = useState(
    VIDEO_ENGINES.find((engine) => engine.tier === "standard")?.id ?? VIDEO_ENGINES[0].id,
  );
  const engine = useMemo(
    () => VIDEO_ENGINES.find((item) => item.id === engineId) ?? VIDEO_ENGINES[0],
    [engineId],
  );
  const film = useMemo(() => estimateFilm(SCENE_COUNT, SECONDS_PER_SCENE, engine), [engine]);

  return (
    <section id="cost" className="border-t border-cine-hairline bg-cine-surface py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">See the bill before you spend it</h2>
            <p className="mt-4 text-lg text-white/60">
              You choose the engine each clip shoots on. Drafts cost a fraction of a final cut.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-cine-hairline bg-white/[0.02]">
            <div className="flex flex-wrap gap-2 border-b border-cine-hairline p-4">
              {VIDEO_ENGINES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setEngineId(item.id)}
                  aria-pressed={item.id === engineId}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    item.id === engineId
                      ? "bg-cine-accent text-white"
                      : "border border-cine-hairline text-white/60 hover:text-white"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-px bg-cine-hairline sm:grid-cols-3">
              <div className="bg-cine-surface p-6">
                <p className="text-sm text-white/50">One storyboard still</p>
                <p className="mt-1 text-2xl font-bold text-white">{imageCredits()} credits</p>
              </div>
              <div className="bg-cine-surface p-6">
                <p className="text-sm text-white/50">One {SECONDS_PER_SCENE}s clip on {engine.name}</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {clipCredits(engine, SECONDS_PER_SCENE)} credits
                </p>
              </div>
              <div className="bg-cine-surface p-6">
                <p className="text-sm text-white/50">A {SCENE_COUNT}-scene film</p>
                <p className="mt-1 text-2xl font-bold text-cine-accent">
                  {film.credits} credits
                  <span className="ml-2 text-base font-normal text-white/50">
                    ≈ ${film.usd.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>

            <p className="border-t border-cine-hairline p-4 text-sm text-white/50">{engine.blurb}</p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Pricing ────────────────────────────────────────────────────────────────

function Pricing() {
  const { href } = useDestination();

  return (
    <section id="pricing" className="border-t border-cine-hairline bg-cine-surface py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Buy credits, not a subscription</h2>
            <p className="mt-4 text-lg text-white/60">
              Nothing renews behind your back. Credits stay in your account until you use them.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CREDIT_PACKS.map((pack, i) => (
            <FadeIn key={pack.id} delay={i * 100}>
              <div
                className={`relative h-full rounded-2xl border p-6 transition-all duration-300 ${
                  pack.highlight
                    ? "border-cine-accent/50 bg-cine-accent-soft shadow-lg shadow-cine-accent/10"
                    : "border-cine-hairline bg-white/[0.02] hover:border-white/15"
                }`}
              >
                {pack.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cine-accent px-3 py-0.5 text-xs font-medium text-white">
                    Best value
                  </span>
                )}
                <h3 className="text-lg font-semibold text-white">{pack.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">${pack.usd}</span>
                  <span className="text-sm text-white/40">one-off</span>
                </div>
                <p className="mt-1 text-sm text-white/50">
                  {pack.credits.toLocaleString("en-US")} credits
                  <span className="text-white/30"> · ${packUsdPerCredit(pack).toFixed(3)} each</span>
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white/60">{pack.description}</p>
                <p className="mt-4 text-sm text-white/50">
                  ≈ {Math.floor(pack.credits / estimateFilm(SCENE_COUNT, SECONDS_PER_SCENE).credits)} five-scene
                  films on the standard engine.
                </p>
                <a href={href} className="mt-6 block">
                  <Button variant={pack.highlight ? "marketingPrimary" : "tertiary"} className="w-full">
                    Get started
                  </Button>
                </a>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={320}>
          <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-xl border border-cine-hairline bg-white/[0.02] p-5">
            <Icon as={Wallet} size="sm" className="mt-0.5 shrink-0 text-cine-accent" />
            <p className="text-sm leading-relaxed text-white/60">
              Every new account starts with {SIGNUP_CREDIT_GRANT} credits, enough to take one scene all the way
              from still to finished clip. No card required to try it.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="border-t border-cine-hairline bg-cine-surface py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Questions</h2>
        </FadeIn>

        <div className="mt-12 space-y-2">
          {FAQ.map((item, i) => (
            <FadeIn key={item.q} delay={i * 40}>
              <div className="rounded-xl border border-cine-hairline bg-white/[0.02] transition-colors hover:border-white/15">
                <button
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  aria-expanded={openIdx === i}
                >
                  <span className="text-sm font-medium text-white">{item.q}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-white/40 transition-transform duration-200 ${
                      openIdx === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openIdx === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm leading-relaxed text-white/60">{item.a}</p>
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Closing CTA ────────────────────────────────────────────────────────────

function CTAFooter() {
  const { href, primaryLabel } = useDestination();

  return (
    <section className="border-t border-cine-hairline bg-cine-surface py-24">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl border border-cine-hairline bg-gradient-to-br from-cine-accent/10 via-cine-surface to-cine-ember/10 p-12">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cine-accent/20 blur-[80px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Your first scene is on us</h2>
              <p className="mt-4 text-lg text-white/60">
                {SIGNUP_CREDIT_GRANT} credits, no card, no subscription to cancel.
              </p>
              <div className="mt-8 flex justify-center">
                <a href={href}>
                  <Button variant="marketingPrimary" size="lg" className="group text-base">
                    {primaryLabel}
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  const { href, primaryLabel } = useDestination();

  return (
    <footer className="border-t border-cine-hairline bg-cine-surface py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-cine-accent">
              <Film className="size-3.5 text-white" />
            </span>
            <span className="text-sm font-semibold text-white">CineStory</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#cost" className="transition-colors hover:text-white">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
            <a href="/guide" className="transition-colors hover:text-white">Guide</a>
            <a href={href} className="transition-colors hover:text-white">{primaryLabel}</a>
          </div>
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} CineStory, a Peyris studio.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="min-h-screen bg-cine-surface text-white">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <CostSection />
      <Pricing />
      <FAQSection />
      <CTAFooter />
      <Footer />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeIn 0.6s ease-out both; }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up { animation: none; }
          html { scroll-behavior: auto; }
        }
      `}</style>
    </div>
  );
}
