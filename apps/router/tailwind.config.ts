import type { Config } from "tailwindcss";
import baseConfig from "@const/ui/tailwind.config";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [baseConfig],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--background))",
        "header-strip": "hsl(var(--card))",
        field: "hsl(var(--secondary))",
        "field-hover": "hsl(var(--muted))",
        "chip-bg": "hsl(var(--secondary))",
        "chip-hover": "hsl(var(--muted))",
        ink: "hsl(var(--foreground))",
        "ink-bright": "hsl(var(--foreground))",
        "harness-muted": "hsl(var(--muted-foreground))",
        "harness-faint": "hsl(var(--muted-foreground) / 0.7)",
        hairline: "hsl(var(--border))",
        "hairline-chip": "hsl(var(--border))",
      },
    },
  },
};

export default config;
