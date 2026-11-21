import { useEffect, useState } from "react";

export interface MediaDevicesLike {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  enumerateDevices?: () => Promise<Array<Pick<MediaDeviceInfo, "kind">>>;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

export async function checkAudioInputAvailable(mediaDevices?: MediaDevicesLike | null): Promise<boolean> {
  if (!mediaDevices?.getUserMedia || !mediaDevices?.enumerateDevices) {
    return false;
  }
  try {
    const devices = await mediaDevices.enumerateDevices();
    return Array.isArray(devices) && devices.some((device) => device?.kind === "audioinput");
  } catch {
    return false;
  }
}

export function useHasMicrophone(): boolean {
  const [hasMicrophone, setHasMicrophone] = useState<boolean>(false);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      setHasMicrophone(false);
      return;
    }

    const mediaDevices = navigator.mediaDevices as MediaDevicesLike | undefined;
    let disposed = false;

    const refresh = () => {
      void checkAudioInputAvailable(mediaDevices).then((available) => {
        if (!disposed) {
          setHasMicrophone(available);
        }
      });
    };

    refresh();

    mediaDevices?.addEventListener?.("devicechange", refresh);
    if (typeof window !== "undefined") {
      window.addEventListener("focus", refresh);
    }

    return () => {
      disposed = true;
      mediaDevices?.removeEventListener?.("devicechange", refresh);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refresh);
      }
    };
  }, []);

  return hasMicrophone;
}
