import { ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import {
  desktopEvents,
  isDesktopChannel,
} from "@const/remote/desktop-contract";
import { remoteDaemon } from "./remote-daemon";

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => any;
const handlers = new Map<string, Handler>();
export function handleDesktopIpc(channel: string, handler: Handler) {
  ipcMain.handle(channel, handler);
  if (isDesktopChannel(channel)) handlers.set(channel, handler);
}
export function invokeRemoteDesktop(
  channel: string,
  event: IpcMainInvokeEvent,
  args: any[],
) {
  if (!isDesktopChannel(channel) || !handlers.has(channel))
    throw new Error("REMOTE_CAPABILITY_DENIED");
  return handlers.get(channel)!(event, ...args);
}
export function sendDesktopEvent(
  target: WebContents,
  channel: string,
  ...args: any[]
) {
  target.send(channel, ...args);
  if (desktopEvents.has(channel))
    remoteDaemon.broadcast({ type: "desktop:event", channel, args });
}
