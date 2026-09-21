import React from "react";
import {
  Folder,
  BookOpen,
  GraduationCap,
  Code2,
  Cpu,
  Atom,
  FlaskConical,
  Lightbulb,
  Brain,
  Compass,
  Target,
  Rocket,
  BarChart3,
  Layers,
  Sparkles,
  Palette,
  type LucideIcon,
} from "lucide-react";

export interface ModuleIconDef {
  id: string;
  label: string;
  labelEn?: string;
  icon: LucideIcon;
}

export const MODULE_ICONS: ModuleIconDef[] = [
  { id: "folder", label: "Folder", labelEn: "Folder", icon: Folder },
  { id: "book", label: "Buku", labelEn: "Book", icon: BookOpen },
  { id: "graduation", label: "Akademik", labelEn: "Academic", icon: GraduationCap },
  { id: "code", label: "Kode", labelEn: "Code", icon: Code2 },
  { id: "cpu", label: "Teknologi", labelEn: "Technology", icon: Cpu },
  { id: "atom", label: "Sains", labelEn: "Science", icon: Atom },
  { id: "flask", label: "Eksperimen", labelEn: "Experiment", icon: FlaskConical },
  { id: "lightbulb", label: "Ide", labelEn: "Idea", icon: Lightbulb },
  { id: "brain", label: "AI & Otak", labelEn: "AI & Brain", icon: Brain },
  { id: "compass", label: "Eksplorasi", labelEn: "Exploration", icon: Compass },
  { id: "target", label: "Target", labelEn: "Target", icon: Target },
  { id: "rocket", label: "Proyek", labelEn: "Project", icon: Rocket },
  { id: "chart", label: "Data", labelEn: "Data", icon: BarChart3 },
  { id: "layers", label: "Arsitektur", labelEn: "Architecture", icon: Layers },
  { id: "sparkles", label: "Spesial", labelEn: "Special", icon: Sparkles },
  { id: "palette", label: "Desain", labelEn: "Design", icon: Palette },
];

export const LEGACY_EMOJI_TO_ICON: Record<string, string> = {
  "📁": "folder",
  "📚": "book",
  "🔬": "atom",
  "💻": "code",
  "🎯": "target",
  "🚀": "rocket",
  "🧪": "flask",
  "📊": "chart",
  "🎨": "palette",
  "⚡": "sparkles",
  "🧠": "brain",
  "💡": "lightbulb",
  "🎓": "graduation",
  "🧭": "compass",
};

const DEFAULT_ICON_DEF: ModuleIconDef = { id: "folder", label: "Folder", labelEn: "Folder", icon: Folder };

export function getModuleIconDef(icon?: string | null): ModuleIconDef {
  if (!icon) return MODULE_ICONS[0] ?? DEFAULT_ICON_DEF;
  const id = LEGACY_EMOJI_TO_ICON[icon] || icon;
  return (
    MODULE_ICONS.find((item) => item.id === id) || {
      id,
      label: id,
      labelEn: id,
      icon: Folder,
    }
  );
}

export function getModuleIconLabel(icon?: string | null, language: "en" | "id" = "id"): string {
  const def = getModuleIconDef(icon);
  if (language === "en" && def.labelEn) return def.labelEn;
  return def.label;
}

interface ModuleIconProps {
  icon?: string | null;
  className?: string;
}

export function ModuleIcon({ icon, className = "w-4 h-4" }: ModuleIconProps) {
  if (!icon) {
    return <Folder className={className} />;
  }

  const mappedId = LEGACY_EMOJI_TO_ICON[icon] || icon;
  const def = MODULE_ICONS.find((item) => item.id === mappedId);

  if (def) {
    const IconComponent = def.icon;
    return <IconComponent className={className} />;
  }

  return <span className="inline-flex items-center justify-center text-sm leading-none">{icon}</span>;
}
