import { z } from "zod";

const id = z.string().min(1).max(200);
const requestId = id;
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state:get"), requestId }),
  z.object({
    type: z.literal("conversation:get"),
    requestId,
    payload: z.object({ conversationId: id }),
  }),
  z.object({
    type: z.literal("conversation:send"),
    requestId,
    payload: z.object({
      conversationId: id,
      text: z.string().trim().min(1).max(32_000),
      model: id.optional(),
      project: z.string().max(4096).optional(),
    }),
  }),
  z.object({
    type: z.literal("conversation:rename"),
    requestId,
    payload: z.object({
      conversationId: id,
      title: z.string().trim().min(1).max(200),
    }),
  }),
  z.object({
    type: z.literal("conversation:archive"),
    requestId,
    payload: z.object({ conversationId: id }),
  }),
  z.object({
    type: z.literal("agent:abort"),
    requestId,
    payload: z.object({ conversationId: id, runId: id }),
  }),
  z.object({
    type: z.literal("agent:answer-question"),
    requestId,
    payload: z.object({
      toolCallId: id,
      runId: id,
      answer: z.record(z.string(), z.unknown()),
    }),
  }),
  z.object({
    type: z.literal("agent:approval"),
    requestId,
    payload: z.object({
      conversationId: id,
      runId: id,
      approvalId: id,
      decision: z.enum(["allow_once", "deny"]),
    }),
  }),
  z.object({ type: z.literal("scheduled:list"), requestId }),
  z.object({ type: z.literal("marketplace:list"), requestId }),
]);
export type RemoteCommand = z.infer<typeof commandSchema>;
export interface RemoteMessage {
  role: string;
  content: string | unknown[];
  thinking?: string;
  [key: string]: unknown;
}
export interface RemoteConversation {
  id: string;
  title: string;
  project: string;
  model?: string;
  messages?: RemoteMessage[];
  isRunning?: boolean;
  runId?: string;
  contextUsage?: { usedTokens: number; totalTokens: number };
  telemetry?: unknown;
}
export interface RemoteBootstrap {
  deviceId: string;
  conversations: RemoteConversation[];
  projects: string[];
  models: { id: string; displayName: string }[];
  runningSessions: { conversationId: string; runId: string }[];
}
export interface RemotePacket {
  type: string;
  requestId?: string;
  payload?: any;
  conversationId?: string;
  runId?: string;
  event?: any;
  [key: string]: unknown;
}

// Function references do not require generated server files in browser bundles.
import { makeFunctionReference } from "convex/server";
export const broker = Object.fromEntries(
  [
    "create",
    "join",
    "hostInbox",
    "deviceFeed",
    "submit",
    "claim",
    "complete",
    "publish",
    "heartbeat",
    "pingDevice",
    "revoke",
    "leave",
  ].map((name) => [
    name,
    makeFunctionReference<"mutation" | "query">(`remote:${name}`),
  ]),
) as Record<string, any>;
