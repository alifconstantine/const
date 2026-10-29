import { Blocks } from "lucide-react";
import { ConstLogoIcon } from "@const/ui";
import { ARTCRAFT_IDS, isArtCraftApp } from "../../lib/mcp/artcraft";
import {
  Blender,
  Godot,
  Unity,
  UnrealEngine,
  Github,
  Canva,
  GoogleDrive,
  GoogleDocs,
  GoogleSheets,
  GoogleSlides,
  Gmail,
  GoogleCalendar,
  GoogleClassroom,
  Excalidraw,
  Figma,
  Obsidian,
} from "@thesvg/react";

export const PLUGIN_LOGOS = new Set([
  ...ARTCRAFT_IDS,
  "blender",
  "godot",
  "unity",
  "unreal",
  "const-guide",
  "github",
  "canva",
  "excalidraw",
  "figma",
  "obsidian",
  "google-drive",
  "google-docs",
  "google-sheets",
  "google-slides",
  "gmail",
  "google-calendar",
  "google-classroom",
]);

export function isPluginLogo(name: string): boolean {
  return PLUGIN_LOGOS.has(name);
}

/** Only packaged, known assets render here. Missing brand logos consistently fall back to Blocks. */
export function PluginIcon({
  name,
  className = "w-6 h-6",
  size = 24,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  if (isArtCraftApp(name))
    return (
      <img
        src={`${import.meta.env.BASE_URL}assets/plugins/artcraft/${name}.png`}
        width={size}
        height={size}
        className={className}
        alt=""
        aria-hidden="true"
      />
    );
  if (name === "const-guide")
    return <ConstLogoIcon size={size} className={className} />;
  if (name === "github")
    return (
      <Github
        variant="mono"
        width={size}
        height={size}
        className={`${className} text-white`}
        aria-hidden="true"
      />
    );
  if (name === "canva")
    return (
      <Canva
        width={size}
        height={size}
        className={className}
        aria-hidden="true"
      />
    );
  if (name === "excalidraw")
    return (
      <Excalidraw
        width={size}
        height={size}
        className={className}
        aria-hidden="true"
      />
    );
  const GoogleIcon = (
    {
      blender: Blender,
      godot: Godot,
      unity: Unity,
      unreal: UnrealEngine,
      figma: Figma,
      obsidian: Obsidian,
      "google-drive": GoogleDrive,
      "google-docs": GoogleDocs,
      "google-sheets": GoogleSheets,
      "google-slides": GoogleSlides,
      gmail: Gmail,
      "google-calendar": GoogleCalendar,
      "google-classroom": GoogleClassroom,
    } as Record<string, typeof GoogleDrive>
  )[name];
  if (GoogleIcon)
    return (
      <GoogleIcon
        width={size}
        height={size}
        className={className}
        aria-hidden="true"
      />
    );
  return <Blocks size={size} className={className} aria-hidden="true" />;
}
