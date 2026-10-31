import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.web.constapp.harness",
  appName: "Const Harness",
  webDir: "dist",
  server: {
    androidScheme: "https",
    allowNavigation: [
      "*.const.web.id",
      "const.web.id",
      "harness.const.web.id",
      "accounts.const.web.id",
    ],
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
