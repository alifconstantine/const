import { Blocks } from "lucide-react";
import { ConstLogoIcon } from "@const/ui";
import {
  Github,
  Canva,
  GoogleDrive,
  GoogleDocs,
  GoogleSheets,
  GoogleSlides,
  Gmail,
  GoogleCalendar,
  GoogleClassroom,
  Excalidraw,
} from "@thesvg/react";
import hyperframesIcon from "../../../plugins/hyperframes/assets/icon.svg";

/** Only packaged, known assets render here. Missing brand logos consistently fall back to Blocks. */
export function PluginIcon({
  name,
  className = "w-6 h-6",
  size = 24,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  if (name === "const-guide")
    return <ConstLogoIcon size={size} className={className} />;
  if (name === "hyperframes")
    return <img src={hyperframesIcon} alt="" className={className} />;
  if (name === "github")
    return (
      <Github
        variant="mono"
        className={`${className} text-white`}
        aria-hidden="true"
      />
    );
  if (name === "canva")
    return <Canva className={className} aria-hidden="true" />;
  if (name === "excalidraw") return <Excalidraw className={className} aria-hidden="true" />;
  const GoogleIcon = (
    {
      "google-drive": GoogleDrive,
      "google-docs": GoogleDocs,
      "google-sheets": GoogleSheets,
      "google-slides": GoogleSlides,
      gmail: Gmail,
      "google-calendar": GoogleCalendar,
      "google-classroom": GoogleClassroom,
    } as Record<string, typeof GoogleDrive>
  )[name];
  if (GoogleIcon)
    return <GoogleIcon className={className} aria-hidden="true" />;
  return <Blocks className={className} aria-hidden="true" />;
}
