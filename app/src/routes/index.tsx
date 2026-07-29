import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Typography } from "@higgsfield/quanta/typography";
import { HeadContent } from "@tanstack/react-router";
import {
  ArrowRight, Check, ChevronDown, Clapperboard, Film, Image, Download,
  Sparkles, Users, MapPin, Music, Mic, DownloadCloud, Star, Menu, X,
  Quote,
} from "lucide-react";
import { appMeta, toOwnAssetUrl } from "@/lib/app-meta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CineStory — AI Storytelling Studio" },
      { name: "description", content: "Turn one idea into a cinematic short film. Upload a photo, pick a template, describe your story — AI does the rest." },
      { property: "og:title", content: "CineStory — AI Storytelling Studio" },
      { property: "og:description", content: "Turn one idea into a cinematic short film. No filming, no actors, no editing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(appMeta.og_image_url ? [{ property: "og:image", content: toOwnAssetUrl(appMeta.og_image_url) }] : []),
    ],
    links: [
      ...(appMeta.favicon_url ? [{ rel: "icon", href: toOwnAssetUrl(appMeta.favicon_url) }] : []),
    ],
  }),
  component: LandingPage,
});

// ─── Data ───────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Clapperboard,
    title: "Story Workspace",
    description: "Write, organize, and refine your story with a full scene editor. Script, camera directions, dialogue, narration — all in one place.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: Users,
    title: "Character Library",
    description: "Create reusable characters with biography, appearance, personality, voice, and reference images. Cast them across any story.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: MapPin,
    title: "Location Library",
    description: "Save cinematic locations with mood, lighting, weather, and prompt presets. Reuse them across projects.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Image,
    title: "AI Assets",
    description: "A unified media library for images, videos, audio, and music. Folders, search, tags — everything organized.",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    icon: Film,
    title: "Cinematic Generation",
    description: "Turn your story into a polished video automatically. Higgsfield Seedance renders each scene with character consistency.",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: DownloadCloud,
    title: "Multi-Format Export",
    description: "Export to MP4, TikTok, Instagram Reels, YouTube Shorts, 4K, and more. Optimized for every platform.",
    gradient: "from-indigo-500 to-violet-500",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    credits: "100 credits/mo",
    features: ["Basic story templates", "720p export", "1 character", "Community support"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Starter",
    price: "$19",
    credits: "1,000 credits/mo",
    features: ["All templates", "1080p export", "Unlimited characters", "Location library", "Email support"],
    cta: "Subscribe",
    popular: true,
  },
  {
    name: "Pro",
    price: "$79",
    credits: "5,000 credits/mo",
    features: ["Everything in Starter", "4K export", "AI voice library", "Music library", "Priority support"],
    cta: "Subscribe",
    popular: false,
  },
  {
    name: "Unlimited",
    price: "$249",
    credits: "25,000 credits/mo",
    features: ["Everything in Pro", "API access", "Custom templates", "Dedicated support", "Team workspace"],
    cta: "Contact Sales",
    popular: false,
  },
];

const FAQ = [
  { q: "What is CineStory?", a: "CineStory is an AI storytelling studio that turns a simple idea into a cinematic short film. Upload a photo, pick a template, describe your story — and our AI writes the script, generates every scene, and cuts the final video automatically." },
  { q: "Do I need any video editing experience?", a: "None. CineStory handles everything — scriptwriting, scene generation, character consistency, camera direction, and video assembly. You just provide the idea." },
  { q: "How long does it take to create a video?", a: "Most stories are ready in 2-10 minutes depending on length and complexity. The AI generates scenes in parallel, so longer videos don't take proportionally longer." },
  { q: "What formats can I export to?", a: "MP4, TikTok, Instagram Reels, YouTube Shorts, standard YouTube, and 4K Master. Storyboard PDF exports are coming soon." },
  { q: "Can I reuse characters across stories?", a: "Yes. The Character Library saves every character's appearance, voice, and reference images so you can cast them in any story with consistent results." },
  { q: "How do credits work?", a: "Each story generation consumes credits based on scene count and resolution. Free users get 100 credits/month. Paid plans start at 1,000 credits/month. Unused credits roll over." },
];

const TESTIMONIALS = [
  { text: "I created a professional product commercial in 5 minutes. CineStory replaced my entire production pipeline.", author: "Sarah Chen", role: "Marketing Director", company: "Bloom Cosmetics" },
  { text: "The character consistency blew my mind. Same face, same outfit, different scenes — it just works.", author: "Marcus Johnson", role: "Content Creator", company: "2M+ TikTok followers" },
  { text: "We use CineStory for rapid ad testing. Generate 10 variations of a concept in the time it takes to brief a video editor.", author: "Priya Patel", role: "Growth Lead", company: "Neon Studios" },
];

// ─── Components ─────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}

function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`bg-gradient-to-r from-white via-q-brand-primary to-q-brand-primary bg-clip-text text-transparent ${className}`}>
      {children}
    </span>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
      scrolled ? "bg-black/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
    }`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-q-brand-primary">
            <Clapperboard className="size-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">CineStory</span>
        </a>
        <div className="hidden items-center gap-6 md:flex">
          <a href="#features" className="text-sm text-gray-400 transition-colors hover:text-white">Features</a>
          <a href="#pricing" className="text-sm text-gray-400 transition-colors hover:text-white">Pricing</a>
          <a href="#faq" className="text-sm text-gray-400 transition-colors hover:text-white">FAQ</a>
          <div className="ml-4 flex items-center gap-3">
            <a href="/__auth/login?return=/studio" className="text-sm text-gray-400 transition-colors hover:text-white">Sign in</a>
            <a href="/__auth/login?return=/studio">
              <Button variant="marketingPrimary" size="sm">
                Get Started <ArrowRight className="ml-1 size-3" />
              </Button>
            </a>
          </div>
        </div>
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <Icon as={mobileOpen ? X : Menu} size="md" className="text-white" />
        </button>
      </div>
      {mobileOpen && (
        <div className="border-t border-white/5 bg-black/95 px-4 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            <a href="#features" onClick={() => setMobileOpen(false)} className="text-sm text-gray-400">Features</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="text-sm text-gray-400">Pricing</a>
            <a href="#faq" onClick={() => setMobileOpen(false)} className="text-sm text-gray-400">FAQ</a>
            <div className="flex gap-3 pt-2">
              <a href="/__auth/login?return=/studio" className="flex-1"><Button variant="tertiary" className="w-full">Sign in</Button></a>
              <a href="/__auth/login?return=/studio" className="flex-1"><Button variant="marketingPrimary" className="w-full">Get Started</Button></a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  const [textIdx, setTextIdx] = useState(0);
  const lines = [
    "a product commercial",
    "a fashion film",
    "a motivational story",
    "your personal journey",
    "a micro drama",
    "a brand story",
  ];

  useEffect(() => {
    const timer = setInterval(() => setTextIdx((i) => (i + 1) % lines.length), 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-black">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-q-brand-primary/20 blur-[120px]" />
        <div className="absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[80px]" />
      </div>

      <div className="relative mx-auto flex min-h-[90vh] max-w-7xl flex-col items-center justify-center px-4 pt-24 text-center sm:px-6 lg:px-8">
        <FadeIn>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
            <Sparkles className="size-3.5 text-q-brand-primary" />
            <span className="text-xs text-gray-400">AI Storytelling Studio</span>
          </div>
        </FadeIn>

        <FadeIn delay={150}>
          <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Turn your idea into
            <br />
            <span className="relative">
              <span className="invisible">{lines[textIdx]}</span>
              <span
                key={textIdx}
                className="absolute inset-0 bg-gradient-to-r from-q-brand-primary via-purple-400 to-q-brand-primary bg-clip-text text-transparent transition-all duration-500"
                style={{ animation: "fadeIn 0.5s ease-out" }}
              >
                {lines[textIdx]}
              </span>
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={300}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
            No filming. No actors. No editing. Upload a photo, pick a template, 
            describe your story — and our AI writes the script, generates every scene, 
            and cuts the final video for you.
          </p>
        </FadeIn>

        <FadeIn delay={450}>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <a href="/__auth/login?return=/studio">
              <Button variant="marketingPrimary" size="lg" className="group text-base">
                Start Creating Free
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
            <a href="#features">
              <Button variant="tertiary" size="lg" className="text-base">
                See How It Works
              </Button>
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={600}>
          <div className="mt-16 flex items-center gap-8 text-sm text-gray-500">
            <span className="flex items-center gap-2"><Check className="size-3.5 text-q-brand-primary" /> No credit card</span>
            <span className="flex items-center gap-2"><Check className="size-3.5 text-q-brand-primary" /> 100 free credits</span>
            <span className="flex items-center gap-2"><Check className="size-3.5 text-q-brand-primary" /> 2-min first video</span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section id="features" className="bg-black py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Everything you need to tell your story
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              A complete AI production studio — from first idea to finished video.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 100}>
              <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]">
                <div className={`mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient}`}>
                  <Icon as={feature.icon} size="md" className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{feature.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { num: "01", title: "Upload your photo", desc: "Take a selfie or upload any photo. CineStory uses it as the face of your story." },
    { num: "02", title: "Pick a template", desc: "Choose from 12 story templates — Storytime, Product Commercial, Luxury, Micro Drama, and more." },
    { num: "03", title: "Describe your idea", desc: "Write 'I want to tell the story of how I started my business' — the AI handles the rest." },
    { num: "04", title: "Get your film", desc: "In minutes, watch your completed cinematic short video, ready to publish." },
  ];

  return (
    <section className="border-t border-white/5 bg-black py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Four steps to your story
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              From idea to finished video — no timeline editing, no manual work.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-4">
          {steps.map((step, i) => (
            <FadeIn key={step.num} delay={i * 150}>
              <div className="relative text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl font-bold text-q-brand-primary">
                  {step.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute left-[calc(50%+2.5rem)] top-8 hidden h-px w-[calc(100%-5rem)] bg-gradient-to-r from-q-brand-primary/50 to-transparent md:block" />
                )}
                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ────────────────────────────────────────────────────────────

function Testimonials() {
  return (
    <section className="border-t border-white/5 bg-black py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Loved by creators
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              From solo creators to marketing teams — CineStory is changing how stories get made.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={t.author} delay={i * 150}>
              <div className="relative rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <Quote className="mb-4 size-8 text-q-brand-primary/30" />
                <p className="text-sm leading-relaxed text-gray-300">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-q-brand-primary to-purple-600 text-xs font-bold text-white">
                    {t.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.author}</p>
                    <p className="text-xs text-gray-500">{t.role}, {t.company}</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="border-t border-white/5 bg-black py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              Start free. Upgrade when you need more.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 100}>
              <div className={`relative rounded-2xl border p-6 transition-all duration-300 ${
                plan.popular
                  ? "border-q-brand-primary/50 bg-q-brand-primary/5 shadow-lg shadow-q-brand-primary/10"
                  : "border-white/5 bg-white/[0.02] hover:border-white/10"
              }`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-q-brand-primary px-3 py-0.5 text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm text-gray-500">/mo</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{plan.credits}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="mt-0.5 size-4 shrink-0 text-q-brand-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="/__auth/login?return=/studio" className="mt-6 block">
                  <Button variant={plan.popular ? "marketingPrimary" : "tertiary"} className="w-full">
                    {plan.cta}
                  </Button>
                </a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="border-t border-white/5 bg-black py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>
        </FadeIn>

        <div className="mt-12 space-y-2">
          {FAQ.map((item, i) => (
            <FadeIn key={item.q} delay={i * 50}>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] transition-colors hover:border-white/10">
                <button
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  aria-expanded={openIdx === i}
                >
                  <span className="text-sm font-medium text-white">{item.q}</span>
                  <ChevronDown className={`size-4 text-gray-500 transition-transform duration-200 ${
                    openIdx === i ? "rotate-180" : ""
                  }`} />
                </button>
                {openIdx === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm leading-relaxed text-gray-400">{item.a}</p>
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

// ─── CTA Footer ──────────────────────────────────────────────────────────────

function CTAFooter() {
  return (
    <section className="border-t border-white/5 bg-black py-24">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-q-brand-primary/10 via-black to-purple-500/10 p-12">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-q-brand-primary/20 blur-[80px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Ready to tell your story?
              </h2>
              <p className="mt-4 text-lg text-gray-400">
                Join thousands of creators using CineStory. No credit card required.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a href="/__auth/login?return=/studio">
                  <Button variant="marketingPrimary" size="lg" className="group text-base">
                    Start Creating Free
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </a>
                <a href="#features">
                  <Button variant="tertiary" size="lg" className="text-base">
                    Learn More
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

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-q-brand-primary">
              <Clapperboard className="size-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">CineStory</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
            <a href="/__auth/login?return=/studio" className="transition-colors hover:text-white">Sign in</a>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} CineStory. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQSection />
      <CTAFooter />
      <Footer />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeIn 0.6s ease-out both;
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}