#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const findings = [];

function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function reportMatches(files, pattern, message) {
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (pattern.test(line)) findings.push(`${relative(ROOT, file)}:${index + 1} — ${message}`);
      });
  }
}

const routeFiles = [
  ...sourceFiles(join(ROOT, "src", "layouts")),
  ...sourceFiles(join(ROOT, "src", "routes")),
];
const productFiles = [
  ...routeFiles,
  join(ROOT, "src", "components", "asset-library.tsx"),
  join(ROOT, "src", "components", "template-picker.tsx"),
  join(ROOT, "src", "components", "gallery", "demo-data.ts"),
  join(ROOT, "src", "components", "generation-detail.tsx"),
].filter(existsSync);

reportMatches(
  routeFiles,
  /\bTEMPLATE_DEMO\b|\bdemo=\{?true\}?|\bdemo\s*\/>/,
  "remove explicit demo mode and provide real app data",
);
reportMatches(
  productFiles,
  /PLACEHOLDER ASSETS|["']\/presets\//,
  "replace shipped media with product-specific generated assets",
);
reportMatches(
  productFiles,
  /(?:picsum\.photos|placehold\.co|via\.placeholder|images\.unsplash\.com)/i,
  "replace remote placeholder or stock media with owned/generated assets",
);
reportMatches(
  productFiles,
  /\bMOCK_[A-Z_]+\b|\bsetTimeout\s*\(|\bMath\.random\s*\(/,
  "remove mock data or simulated product behavior",
);
reportMatches(
  productFiles,
  /Marketing Studio|Aurora Labs|Pixel Forge|UGC Gadget save me|Giant figure|Turn any product into a video ad|Creator-style, handheld|Fast-cut vertical|Instagram vertical|Polished brand film|Product demo|Testimonial/,
  "replace the scaffold product identity and example copy",
);
reportMatches(
  productFiles,
  /(?:value|id): ["'](?:ugc|tiktok|reels|commercial|product|app)["']/,
  "replace the scaffold video-ad modes and formats with the adapted product flow",
);

const appMetaPath = join(ROOT, "src", "app-meta.json");
if (!existsSync(appMetaPath)) {
  findings.push("src/app-meta.json — add product metadata and favicon");
} else {
  try {
    const appMeta = JSON.parse(readFileSync(appMetaPath, "utf8"));
    for (const field of ["og_title", "og_description", "favicon_url", "marketplace_cover_url"]) {
      if (typeof appMeta[field] !== "string" || appMeta[field].trim() === "") {
        findings.push(`src/app-meta.json — set a product-specific ${field}`);
      }
    }
  } catch {
    findings.push("src/app-meta.json — fix invalid JSON and set product metadata");
  }
}

const demoAssetDir = join(ROOT, "public", "presets");
if (existsSync(demoAssetDir)) {
  for (const entry of readdirSync(demoAssetDir, { withFileTypes: true })) {
    if (entry.isFile()) {
      findings.push(
        `${relative(ROOT, join(demoAssetDir, entry.name))} — remove shipped demo media after replacing references`,
      );
    }
  }
}

if (findings.length > 0) {
  console.error("Studio scaffold adaptation is incomplete:\n");
  for (const finding of findings) console.error(`- ${finding}`);
  console.error(
    "\nGenerate final assets, replace scaffold copy, preserve the live wiring, then rerun bun run check:adapted.",
  );
  process.exit(1);
}

console.log("Studio scaffold adaptation check passed.");
