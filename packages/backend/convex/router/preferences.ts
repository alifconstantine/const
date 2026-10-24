import { DEFAULT_MODEL } from "./modelCatalog";
export const DEFAULT_SETTINGS = {
  defaultModel: DEFAULT_MODEL as string,
  defaultTemperature: 0.7,
  enableStreaming: true,
  logPayloads: false,
  anonymizeTelemetry: true,
  notifyLowQuota: true,
};
