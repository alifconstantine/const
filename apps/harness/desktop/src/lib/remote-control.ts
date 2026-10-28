export { commandSchema as remoteCommandSchema } from "@const/remote/protocol";
export type { RemoteCommand } from "@const/remote/protocol";

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
  transport?: "lan" | "relay";
}
