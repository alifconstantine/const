export const ROUTER_ENDPOINTS = [
  {
    method: "POST",
    path: "/v1/chat/completions",
    name: "Chat completions",
    description:
      "OpenAI-compatible chat, streaming, tool calls, and user combos.",
  },
  {
    method: "GET",
    path: "/v1/models",
    name: "Model catalog",
    description:
      "Public models; authenticated requests also include your active combos.",
  },
  {
    method: "POST",
    path: "/v1/audio/transcriptions",
    name: "Audio transcription",
    description: "Speech to text using Whisper. Charged per audio minute.",
  },
  {
    method: "POST",
    path: "/v1/search",
    name: "Web search",
    description: "Research or deep research. Charged per search request.",
  },
  {
    method: "POST",
    path: "/v1/fetch",
    name: "Fetch web content",
    description: "Authenticated extraction of public web pages.",
  },
  {
    method: "POST",
    path: "/v1/transcript",
    name: "YouTube transcript",
    description:
      "Authenticated caption extraction from a public YouTube video.",
  },
] as const;
