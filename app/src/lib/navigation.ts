/**
 * Navigation configuration for CineStory — single source of truth for all
 * sidebar links, breadcrumbs, and page metadata.
 */
import {
  LayoutDashboard, Clapperboard, Film, Users, MapPin,
  Image, Music, Mic, Volume2, Library, Download,
  CreditCard, Receipt, User, Settings, HelpCircle,
  Sparkles, Tv,
} from "lucide-react";
import type { IconGlyph } from "@higgsfield/quanta/icon";

export interface NavItem {
  label: string;
  path: string;
  icon: IconGlyph;
  badge?: string;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard as IconGlyph },
  { label: "Story Workspace", path: "/workspace", icon: Clapperboard as IconGlyph },
  { label: "Projects", path: "/projects", icon: Film as IconGlyph },
  { label: "Series", path: "/series", icon: Tv as IconGlyph },
  { label: "Templates", path: "/templates", icon: Library as IconGlyph },
  { label: "Characters", path: "/characters", icon: Users as IconGlyph },
  { label: "Locations", path: "/locations", icon: MapPin as IconGlyph },
  { label: "AI Assets", path: "/assets", icon: Image as IconGlyph },
  { label: "Voice Library", path: "/voices", icon: Mic as IconGlyph },
  { label: "Music Library", path: "/music", icon: Music as IconGlyph },
  { label: "Prompt Library", path: "/prompts", icon: Sparkles as IconGlyph },
  { label: "Exports", path: "/exports", icon: Download as IconGlyph },
];

export const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Credits", path: "/credits", icon: CreditCard as IconGlyph },
  { label: "Billing", path: "/billing", icon: Receipt as IconGlyph },
  { label: "Account", path: "/account", icon: User as IconGlyph },
  { label: "Settings", path: "/settings", icon: Settings as IconGlyph },
  { label: "Help", path: "/help", icon: HelpCircle as IconGlyph },
];

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/workspace": "Story Workspace",
  "/projects": "Projects",
  "/series": "Series",
  "/templates": "Templates",
  "/characters": "Character Library",
  "/locations": "Location Library",
  "/assets": "AI Assets",
  "/voices": "Voice Library",
  "/music": "Music Library",
  "/prompts": "Prompt Library",
  "/exports": "Exports",
  "/credits": "Credits",
  "/billing": "Billing",
  "/account": "Account",
  "/settings": "Settings",
  "/help": "Help Center",
  "/pricing": "Pricing",
};