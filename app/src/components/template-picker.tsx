import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Clapperboard as IconStoryOutlined } from "lucide-react";
import { Megaphone as IconAdOutlined } from "lucide-react";
import { Drama as IconDramaOutlined } from "lucide-react";
import { Rocket as IconRealOutlined } from "lucide-react";
import { Button } from "@higgsfield/quanta/button";
import { Icon } from "@higgsfield/quanta/icon";
import { Media } from "@higgsfield/quanta/media";
import { Modal } from "@higgsfield/quanta/modal";
import { Tabs } from "@higgsfield/quanta/tabs";
import { Typography } from "@higgsfield/quanta/typography";
import { STORY_TEMPLATES } from "@/lib/story-templates";

/**
 * TemplatePickerModal — CineStory's "choose a storytelling template" picker,
 * opened from the Studio prompt box's sliders pill. A glass `Modal` gallery of
 * selectable template tiles, filtered by story group (Story / Ad / Drama / Real).
 */

type LeadGlyph = typeof IconStoryOutlined;
export type TemplateCategory = "story" | "ad" | "drama" | "real";
export type TemplateKind = "video";

export interface TemplateItem {
  id: string;
  title: string;
  subtitle: string;
  category: TemplateCategory;
  kind: TemplateKind;
  images: [string, string, string];
  icon: LeadGlyph;
}

const GROUP_ICON: Record<TemplateCategory, LeadGlyph> = {
  story: IconStoryOutlined,
  ad: IconAdOutlined,
  drama: IconDramaOutlined,
  real: IconRealOutlined,
};

// Bespoke, template-specific stills generated via the Higgsfield tools (one
// hero frame per template) — see TEMPLATE_PREVIEWS below for the mapping.
const FALLBACK_PREVIEW = "/presets/skateboard-illustration.png";

export const TEMPLATE_PREVIEWS: Record<string, string> = {
  storytime:
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190455_6799be86-c852-45dc-8bb9-94be4e019c99.png",
  "product-commercial":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190455_5f7dbd9f-a1b3-4217-82f2-dd882d7a33cc.png",
  "luxury-lifestyle":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190455_45ba78e2-35f9-4cf3-8d46-22596afa131a.png",
  "micro-drama":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190455_a1fb3481-cf67-430f-a3f1-845eab461ffa.png",
  "future-me":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190335_b9837a71-fddc-4c44-b528-0f7e900b3c2a.png",
  "before-vs-after":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190335_121619dd-74fc-4a3c-8bf4-2a3831b2e456.png",
  "ugc-ad":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190624_ce1ba2f1-5a21-4286-ae7a-0057b7d097e1.png",
  motivational:
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190623_92b4bfc7-8038-42eb-a02d-3f1c5ef12786.png",
  "life-lesson":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190623_b1d11906-5693-4934-857f-10eb38521183.png",
  "entrepreneur-journey":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190623_2c5226c5-f88b-4858-a61c-710c34d71ad1.png",
  "movie-trailer":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190720_14fd2dfd-efad-4ba3-9a6c-c8d3f6b5c748.png",
  "fashion-campaign":
    "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260728_190720_687c600a-599c-4138-9240-4075f28881a8.png",
};

export const TEMPLATES: TemplateItem[] = STORY_TEMPLATES.map((template) => {
  const src = TEMPLATE_PREVIEWS[template.id] ?? FALLBACK_PREVIEW;
  return {
    id: template.id,
    title: template.title,
    subtitle: template.subtitle,
    category: template.group,
    kind: "video" as const,
    images: [src, src, src] as [string, string, string],
    icon: GROUP_ICON[template.group],
  };
});

/** Stable random-looking gradient per template — avoids SSR hydration differences. */
function gradientFromSeed(seed: string): string {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const startHue = hash % 360;
  const endHue = (startHue + 36 + ((hash >>> 8) % 72)) % 360;
  return `linear-gradient(135deg, hsl(${startHue} 62% 52%) 0%, hsl(${endHue} 76% 27%) 100%)`;
}

function GradientBadge({ as, seed }: { as: LeadGlyph; seed: string }) {
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-[1.333px] border-[rgba(197,197,197,0.24)] p-1.5 text-white shadow-[0_5.333px_2.667px_rgba(0,0,0,0.08),inset_0_2.667px_5.333px_rgba(255,255,255,0.24)]">
      <span
        aria-hidden
        className="absolute inset-0 rounded-[10px]"
        style={{ backgroundImage: gradientFromSeed(seed) }}
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-[10px] bg-gradient-to-t from-transparent to-white/20 mix-blend-overlay"
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-[10px] bg-gradient-to-t from-transparent to-white/[0.32] mix-blend-hard-light"
      />
      <Icon as={as} size="md" className="relative" />
    </span>
  );
}

const TRIPTYCH_CORNERS = [
  "rounded-tl-q-500 rounded-bl-q-500 rounded-tr-q-150 rounded-br-q-150",
  "rounded-q-150",
  "rounded-tr-q-500 rounded-br-q-500 rounded-tl-q-150 rounded-bl-q-150",
] as const;

export type TemplateCardVariant = "single" | "triptych";

export interface TemplateCardProps {
  template: TemplateItem;
  variant?: TemplateCardVariant;
  onTry: (template: TemplateItem) => void;
  tryLabel?: ReactNode;
}

export function TemplateCard({
  template,
  variant = "single",
  onTry,
  tryLabel = "Try",
}: TemplateCardProps) {
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onTry(template);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Use template: ${template.title}`}
      className="motion-card relative flex cursor-pointer flex-col gap-q-200 rounded-q-600 bg-q-transparent-light-05 p-q-200 shadow-[0_2px_6px_rgba(0,0,0,0.15)] hover:z-[1] focus-visible:outline-2 focus-visible:outline-q-border-focus"
      onClick={() => onTry(template)}
      onKeyDown={handleCardKeyDown}
    >
      <div className="flex h-60 items-stretch gap-1.5">
        {variant === "triptych" ? (
          template.images.map((src, index) => (
            <Media
              key={index}
              ratio="auto"
              rounded="none"
              className={`min-w-0 flex-1 border border-q-border-subtle ${TRIPTYCH_CORNERS[index]}`}
            >
              <Media.Image src={src} alt={`${template.title} — shot ${index + 1}`} />
            </Media>
          ))
        ) : (
          <Media
            ratio="auto"
            rounded="none"
            className="min-w-0 flex-1 rounded-q-500 border border-q-border-subtle"
          >
            <Media.Image src={template.images[0]} alt={template.title} />
          </Media>
        )}
      </div>
      <div className="flex items-center gap-3 px-2 py-1">
        <GradientBadge as={template.icon} seed={template.id} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Typography as="span" variant="label-md-medium" color="primary" truncate>
            {template.title}
          </Typography>
          <Typography as="span" variant="caption-sm-regular" color="secondary" truncate>
            {template.subtitle}
          </Typography>
        </div>
        <Button
          variant="marketingPrimary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onTry(template);
          }}
        >
          {tryLabel}
        </Button>
      </div>
    </div>
  );
}

/* ── Filter tabs ──────────────────────────────────────────────────────────── */

const CATEGORY_TABS = [
  { value: "all", label: "All" },
  { value: "story", label: "Story", start: <Icon size="sm" as={IconStoryOutlined} /> },
  { value: "ad", label: "Ad & Brand", start: <Icon size="sm" as={IconAdOutlined} /> },
  { value: "drama", label: "Drama", start: <Icon size="sm" as={IconDramaOutlined} /> },
  { value: "real", label: "Real Life", start: <Icon size="sm" as={IconRealOutlined} /> },
];

export interface TemplatePickerModalProps {
  trigger: ReactElement;
  onSelect: (template: TemplateItem) => void;
  defaultOpen?: boolean;
}

export function TemplatePickerModal({ trigger, onSelect, defaultOpen }: TemplatePickerModalProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [category, setCategory] = useState("all");

  const visible = useMemo(
    () => TEMPLATES.filter((t) => category === "all" || t.category === category),
    [category],
  );

  return (
    <Modal.Root open={open} onOpenChange={setOpen}>
      <Modal.Trigger render={trigger} />
      <Modal.Content size="2xl">
        <Modal.Header flush className="px-2 py-1">
          <Tabs.Root variant="pill" value={category} onValueChange={setCategory} className="flex-1">
            <Tabs.List items={CATEGORY_TABS} />
          </Tabs.Root>
          <Modal.CloseButton />
        </Modal.Header>

        <div className="min-h-0 flex-1 overflow-y-auto pt-3">
          <div className="grid grid-cols-2 gap-5 p-1">
            {visible.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onTry={(selected) => {
                  onSelect(selected);
                  setOpen(false);
                }}
                tryLabel="Use"
              />
            ))}
          </div>
        </div>

        <Modal.Footer>
          <Modal.FooterCaption>
            {visible.length} template
            {visible.length === 1 ? "" : "s"}
          </Modal.FooterCaption>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
