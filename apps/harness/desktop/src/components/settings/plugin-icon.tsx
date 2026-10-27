import { Blocks } from "lucide-react";
import { ConstLogoIcon } from "@const/ui";
import { Github, Canva } from "@thesvg/react";
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
    return <Github variant="mono" className={`${className} text-white`} aria-hidden="true" />;
  if (name === "canva")
    return <Canva className={className} aria-hidden="true" />;
  return <Blocks className={className} aria-hidden="true" />;
}
