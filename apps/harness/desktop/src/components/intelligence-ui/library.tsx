import { createContext } from "react";
import {
  openuiLibrary,
  openuiChatLibrary,
} from "@openuidev/react-ui/genui-lib";

export const InteractionContext = createContext({ disabled: false });

// Register chat-specific extras (FollowUpBlock, SectionBlock, etc.) if not already present
const chatExtraNames = ["FollowUpBlock", "FollowUpItem", "SectionBlock", "SectionItem"] as const;
for (const name of chatExtraNames) {
  const component = openuiChatLibrary.components[name];
  if (component && !openuiLibrary.components[name]) {
    (openuiLibrary.components as Record<string, unknown>)[name] = component;
  }
}

export const intelligenceLibrary = openuiLibrary;
