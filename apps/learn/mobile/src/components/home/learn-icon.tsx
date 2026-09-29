import React from "react";
import {
  BookOpen,
  Code2,
  GraduationCap,
  Brain,
  Lightbulb,
  Rocket,
  Atom,
  FlaskConical,
  Cpu,
  Compass,
  Target,
  Star,
  Palette,
  BarChart3,
  Layers,
  Folder,
  type LucideIcon,
} from "lucide-react";

export interface LearnIconDef {
  id: string;
  label: string;
  labelEn?: string;
  icon: LucideIcon;
}

export const LEARN_ICONS: LearnIconDef[] = [
  { id: "book", label: "Buku", labelEn: "Book", icon: BookOpen },
  { id: "code", label: "Kode", labelEn: "Code", icon: Code2 },
  { id: "graduation", label: "Akademik", labelEn: "Academic", icon: GraduationCap },
  { id: "brain", label: "AI & Otak", labelEn: "AI & Brain", icon: Brain },
  { id: "lightbulb", label: "Ide", labelEn: "Idea", icon: Lightbulb },
  { id: "rocket", label: "Proyek", labelEn: "Project", icon: Rocket },
  { id: "atom", label: "Sains", labelEn: "Science", icon: Atom },
  { id: "flask", label: "Eksperimen", labelEn: "Experiment", icon: FlaskConical },
  { id: "cpu", label: "Teknologi", labelEn: "Technology", icon: Cpu },
  { id: "compass", label: "Eksplorasi", labelEn: "Exploration", icon: Compass },
  { id: "target", label: "Target", labelEn: "Target", icon: Target },
  { id: "special", label: "Spesial", labelEn: "Special", icon: Star },
  { id: "palette", label: "Desain", labelEn: "Design", icon: Palette },
  { id: "chart", label: "Data", labelEn: "Data", icon: BarChart3 },
  { id: "layers", label: "Arsitektur", labelEn: "Architecture", icon: Layers },
  { id: "folder", label: "Folder", labelEn: "Folder", icon: Folder },
];

export const LEGACY_EMOJI_TO_LEARN_ICON: Record<string, string> = {
  "📘": "book",
  "📚": "book",
  "📝": "book",
  "💻": "code",
  "🎓": "graduation",
  "🧠": "brain",
  "💡": "lightbulb",
  "🚀": "rocket",
  "🔬": "atom",
  "🧬": "atom",
  "🧪": "flask",
  "🤖": "cpu",
  "🧭": "compass",
  "📐": "compass",
  "🌐": "compass",
  "🪐": "compass",
  "🎯": "target",
  "🏆": "target",
  "⚡": "special",
  "sparkles": "special",
  "🎨": "palette",
  "📊": "chart",
  "📁": "folder",
};

const DEFAULT_LEARN_ICON_DEF: LearnIconDef = {
  id: "book",
  label: "Buku",
  labelEn: "Book",
  icon: BookOpen,
};

export function getLearnIconDef(icon?: string | null): LearnIconDef {
  if (!icon) return DEFAULT_LEARN_ICON_DEF;
  const id = LEGACY_EMOJI_TO_LEARN_ICON[icon] || icon;
  return (
    LEARN_ICONS.find((item) => item.id === id) || {
      id,
      label: id,
      labelEn: id,
      icon: BookOpen,
    }
  );
}

export function getLearnIconLabel(icon?: string | null, language: "en" | "id" = "id"): string {
  const def = getLearnIconDef(icon);
  if (language === "en" && def.labelEn) return def.labelEn;
  return def.label;
}

interface LearnIconProps {
  icon?: string | null;
  className?: string;
  fallbackIcon?: LucideIcon;
}

export function LearnIcon({
  icon,
  className = "w-4 h-4",
  fallbackIcon: Fallback = BookOpen,
}: LearnIconProps) {
  if (!icon) {
    return <Fallback className={className} />;
  }

  const mappedId = LEGACY_EMOJI_TO_LEARN_ICON[icon] || icon;
  const def = LEARN_ICONS.find((item) => item.id === mappedId);

  if (def) {
    const IconComponent = def.icon;
    return <IconComponent className={className} />;
  }

  return (
    <span className="inline-flex items-center justify-center text-sm leading-none select-none">
      {icon}
    </span>
  );
}
