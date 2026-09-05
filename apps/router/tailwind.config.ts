import type { Config } from "tailwindcss";
import baseConfig from "@const/ui/tailwind.config";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [baseConfig],
  theme: {
    extend: {
      colors: {
        canvas: "#161616",
        "header-strip": "#222222",
        field: "#2b2b2b",
        "field-hover": "#383838",
        "chip-bg": "#1b1b1b",
        "chip-hover": "#252528",
        ink: "#d4d4d4",
        "ink-bright": "#ffffff",
        "harness-muted": "#969696",
        "harness-faint": "#5d5d5d",
        hairline: "#383838",
        "hairline-chip": "#2e2e2e",
      },
    },
  },
};

export default config;
