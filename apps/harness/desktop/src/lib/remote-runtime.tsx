import { createContext, useContext } from "react";

export interface RemoteRuntime {
  deviceName: string;
  online: boolean;
  mobile: boolean;
  disconnect?: () => Promise<void>;
}
export const RemoteRuntimeContext = createContext<RemoteRuntime | null>(null);
export const useRemoteRuntime = () => useContext(RemoteRuntimeContext);
