/**
 * YouTube Transcript Extraction Service for Const Learn Mobile.
 * Calls Const Router (/v1/transcript) to retrieve time-coded captions.
 */

import { getRouterBaseUrl } from "./search-service";

export interface YouTubeTranscriptResult {
  videoId: string;
  url: string;
  title: string;
  language?: string;
  transcript: string;
  lineCount: number;
}

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))/i.test(
    url.trim()
  );
}

export async function fetchYouTubeTranscript(
  urlOrId: string,
  signal?: AbortSignal
): Promise<YouTubeTranscriptResult> {
  const trimmed = urlOrId.trim();
  if (!trimmed) {
    throw new Error("YouTube URL or ID cannot be empty.");
  }

  const authToken =
    localStorage.getItem("const_learn_auth_token") ||
    localStorage.getItem("const_sso_token") ||
    "";

  const payload = { url: trimmed };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(authToken.startsWith("sk-") ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(authToken ? { "X-Const-SSO-Token": authToken } : {}),
  };

  const baseUrl = getRouterBaseUrl();
  let endpoint = `${baseUrl.replace(/\/+$/, "")}/transcript`;

  const doFetch = async (targetEndpoint: string) => {
    return await fetch(targetEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  };

  try {
    let res: Response;
    try {
      res = await doFetch(endpoint);
    } catch {
      if (baseUrl === "/v1") {
        endpoint = "https://router.const.web.id/v1/transcript";
        res = await doFetch(endpoint);
      } else {
        endpoint = "/v1/transcript";
        res = await doFetch(endpoint);
      }
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const msg =
        errData?.error?.message ||
        `Failed to fetch YouTube transcript (HTTP ${res.status}).`;
      throw new Error(msg);
    }

    const data = await res.json();
    return {
      videoId: data.videoId,
      url: data.url,
      title: data.title || `YouTube Video (${data.videoId})`,
      language: data.language,
      transcript: data.transcript,
      lineCount: data.lineCount || 0,
    };
  } catch (err: any) {
    if (err.name === "AbortError") throw err;
    console.error("fetchYouTubeTranscript error:", err);
    throw err;
  }
}
