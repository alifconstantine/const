import { z } from "zod";

export interface RemoteConnectedDevice {
  id: string;
  name: string;
  connectedAt: number;
}

export interface RemoteDaemonStatus {
  status: "idle" | "waiting" | "connected";
  deviceId: string;
  sessionId: string | null;
  pairingUrl: string | null;
  localBridgeUrl: string | null;
  expiresAt: number | null;
  connectedDevices: RemoteConnectedDevice[];
}

const id = z.string().min(1).max(200);
const requestId = id.optional();
export const remoteCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state:get"), requestId }),
  z.object({ type: z.literal("conversation:get"), requestId, payload: z.object({ conversationId: id }) }),
  z.object({ type: z.literal("agent:abort"), requestId, payload: z.object({ conversationId: id, runId: id }) }),
  z.object({ type: z.literal("agent:answer-question"), requestId, payload: z.object({ toolCallId: id, runId: id, answer: z.unknown() }) }),
]);
export type RemoteCommand = z.infer<typeof remoteCommandSchema>;
