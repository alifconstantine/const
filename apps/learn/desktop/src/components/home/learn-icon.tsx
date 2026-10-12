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
  Globe,
  Terminal,
  Database,
  FileText,
  Music,
  Video,
  Briefcase,
  Shield,
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
  { id: "globe", label: "Global", labelEn: "Global", icon: Globe },
  { id: "terminal", label: "Terminal", labelEn: "Terminal", icon: Terminal },
  { id: "database", label: "Basis Data", labelEn: "Database", icon: Database },
  { id: "document", label: "Dokumen", labelEn: "Document", icon: FileText },
  { id: "music", label: "Audio", labelEn: "Audio", icon: Music },
  { id: "video", label: "Video", labelEn: "Video", icon: Video },
  { id: "briefcase", label: "Bisnis", labelEn: "Business", icon: Briefcase },
  { id: "shield", label: "Keamanan", labelEn: "Security", icon: Shield },
];

export const LEGACY_EMOJI_TO_LEARN_ICON: Record<string, string> = {
  "📘": "book",
  "📚": "book",
  "📖": "book",
  "📕": "book",
  "📗": "book",
  "📓": "book",
  "📒": "book",
  "📝": "book",
  "💻": "code",
  "🖥️": "code",
  "⌨️": "code",
  "🎓": "graduation",
  "🧠": "brain",
  "💡": "lightbulb",
  "🚀": "rocket",
  "🛸": "rocket",
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
  "✨": "special",
  "⭐": "special",
  "🌟": "special",
  "🔥": "rocket",
  "sparkles": "special",
  "🎨": "palette",
  "📊": "chart",
  "📈": "chart",
  "📁": "folder",
  "📂": "folder",
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

  return <Fallback className={className} />;
}
