import type { Config } from "tailwindcss";
import baseConfig from "@const/ui/tailwind.config";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [baseConfig],
};

export default config;
