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
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Story Workspace", path: "/workspace", icon: Clapperboard },
  { label: "Projects", path: "/projects", icon: Film },
  { label: "Series", path: "/series", icon: Tv },
  { label: "Templates", path: "/templates", icon: Library },
  { label: "Characters", path: "/characters", icon: Users },
  { label: "Locations", path: "/locations", icon: MapPin },
  { label: "AI Assets", path: "/assets", icon: Image },
  { label: "Voice Library", path: "/voices", icon: Mic },
  { label: "Music Library", path: "/music", icon: Music },
  { label: "Prompt Library", path: "/prompts", icon: Sparkles },
  { label: "Exports", path: "/exports", icon: Download },
];

export const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Credits", path: "/credits", icon: CreditCard },
  { label: "Billing", path: "/billing", icon: Receipt },
  { label: "Account", path: "/account", icon: User },
  { label: "Settings", path: "/settings", icon: Settings },
  { label: "Help", path: "/help", icon: HelpCircle },
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