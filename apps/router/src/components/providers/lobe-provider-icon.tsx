"use client";

import { cn, ConstLogoIcon } from "@const/ui";

const LOBE_PROVIDER_MAP: Record<string, string> = {
  const: "const",
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  gemini: "gemini",
  claude: "claude",
  deepseek: "deepseek",
  groq: "groq",
  openrouter: "openrouter",
  mistral: "mistral",
  together: "together",
  perplexity: "perplexity",
  cohere: "cohere",
  ollama: "ollama",
  bedrock: "bedrock",
  azure: "azure",
  github: "github",
  meta: "meta",
};

interface LobeProviderIconProps {
  providerId: string;
  className?: string;
  size?: number;
}

export function LobeProviderIcon({
  providerId,
  className,
  size = 20,
}: LobeProviderIconProps) {
  const normalized = providerId.toLowerCase().trim();

  // Const built-in brand icon
  if (normalized === "const") {
    return <ConstLogoIcon size="sm" className={cn("text-foreground", className)} />;
  }

  const slug = LOBE_PROVIDER_MAP[normalized] || normalized;
  // Official @lobehub/icons raw SVG asset
  const cdnUrl = `https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-svg/icons/${slug}.svg`;

  return (
    <img
      src={cdnUrl}
      alt={providerId}
      width={size}
      height={size}
      className={cn(
        "object-contain filter dark:invert shrink-0 transition-opacity",
        className
      )}
      onError={(e) => {
        // Fallback to subtle letter pill if logo not found
        const target = e.currentTarget;
        target.style.display = "none";
        const parent = target.parentElement;
        if (parent && !parent.querySelector(".fallback-letter")) {
          const span = document.createElement("span");
          span.className = "fallback-letter font-sans text-xs font-semibold text-foreground";
          span.innerText = providerId.slice(0, 2).toUpperCase();
          parent.appendChild(span);
        }
      }}
    />
  );
}
