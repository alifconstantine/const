import { NextRequest, NextResponse } from "next/server";
import { authenticate, errorResponse } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Const-SSO-Token, X-Title, HTTP-Referer, User-Agent",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function corsJson(
  data: any,
  init?: { status?: number; headers?: Record<string, string> },
) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function extractYouTubeVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  // If already an 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
    );
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/embed/")[1]?.split("/")[0] || null;
      }
      if (parsed.pathname.startsWith("/v/")) {
        return parsed.pathname.split("/v/")[1]?.split("/")[0] || null;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1]?.split("/")[0] || null;
      }
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
  } catch {
    // Regex fallback
    const match = trimmed.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/,
    );
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}]`;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, dec) =>
      String.fromCharCode(parseInt(dec, 10)),
    );
}

interface ClientProfile {
  name: string;
  clientName: string;
  clientVersion: string;
  clientNameHeader: string;
  userAgent: string;
  context: Record<string, unknown>;
}

const CLIENT_PROFILES: ClientProfile[] = [
  {
    name: "ios",
    clientName: "IOS",
    clientVersion: "20.10.4",
    clientNameHeader: "5",
    userAgent:
      "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    context: {
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      platform: "MOBILE",
      osName: "iOS",
      osVersion: "18.3.2.22D82",
    },
  },
  {
    name: "android_vr",
    clientName: "ANDROID_VR",
    clientVersion: "1.62.20",
    clientNameHeader: "28",
    userAgent:
      "com.google.android.apps.youtube.vr.oculus/1.62.20 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    context: {
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      platform: "MOBILE",
      osName: "Android",
      osVersion: "12L",
      androidSdkVersion: 32,
    },
  },
  {
    name: "mweb",
    clientName: "MWEB",
    clientVersion: "2.20251209.01.00",
    clientNameHeader: "2",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    context: {
      platform: "MOBILE",
      osName: "iOS",
      osVersion: "17.5.1",
    },
  },
];

const INNERTUBE_ENDPOINT =
  "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false";

interface CaptionTrack {
  baseUrl: string;
  vssId?: string;
  languageCode?: string;
  name?: { simpleText?: string; runs?: Array<{ text: string }> };
}

interface Json3Segment {
  utf8?: string;
}

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Json3Segment[];
  aAppend?: number;
}

interface Json3Transcript {
  events?: Json3Event[];
}

export async function POST(req: NextRequest) {
  try {
    await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const input = body?.url || body?.videoId || body?.id;

    if (!input || typeof input !== "string" || !input.trim()) {
      return corsJson(
        { error: { message: "The 'url' or 'videoId' field is required." } },
        { status: 400 },
      );
    }

    const videoId = extractYouTubeVideoId(input);
    if (!videoId) {
      return corsJson(
        { error: { message: "Invalid YouTube URL or Video ID provided." } },
        { status: 400 },
      );
    }

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Query InnerTube player endpoint using client profiles sequentially
    let selectedPlayerData: any = null;
    let selectedClient: ClientProfile | null = null;
    let availableTracks: CaptionTrack[] = [];
    const clientErrors: string[] = [];

    for (const client of CLIENT_PROFILES) {
      try {
        const payload = {
          context: {
            client: {
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              hl: "en",
              gl: "US",
              ...client.context,
            },
            user: { lockedSafetyMode: false },
            request: { useSsl: true },
          },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        };

        const res = await fetch(INNERTUBE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "*/*",
            "User-Agent": client.userAgent,
            "X-YouTube-Client-Name": client.clientNameHeader,
            "X-YouTube-Client-Version": client.clientVersion,
            Origin: "https://www.youtube.com",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          clientErrors.push(`${client.name} returned HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        const status = data.playabilityStatus?.status;
        if (status && status !== "OK") {
          clientErrors.push(`${client.name} playabilityStatus: ${status}`);
          continue;
        }

        const tracks =
          data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks && Array.isArray(tracks) && tracks.length > 0) {
          selectedPlayerData = data;
          selectedClient = client;
          availableTracks = tracks;
          break;
        }

        // Retain metadata even if this client had no captions
        if (!selectedPlayerData) {
          selectedPlayerData = data;
          selectedClient = client;
        }
      } catch (err: any) {
        clientErrors.push(
          `${client.name} error: ${err?.message || String(err)}`,
        );
      }
    }

    const videoTitle =
      selectedPlayerData?.videoDetails?.title?.trim() ||
      `YouTube Video (${videoId})`;
    const author = selectedPlayerData?.videoDetails?.author?.trim() || "";

    if (availableTracks.length === 0) {
      return corsJson(
        {
          error: {
            message:
              "No captions or transcript track available for this YouTube video. Please choose a video with subtitles or closed captions enabled.",
          },
        },
        { status: 404 },
      );
    }

    // Prioritize English or Indonesian, or fallback to the first track
    const selectedTrack =
      availableTracks.find(
        (t) => t.vssId === ".en" || t.languageCode === "en",
      ) ||
      availableTracks.find(
        (t) => t.vssId?.startsWith("a.en") || t.languageCode?.startsWith("en"),
      ) ||
      availableTracks.find(
        (t) => t.vssId === ".id" || t.languageCode === "id",
      ) ||
      availableTracks.find(
        (t) => t.vssId?.startsWith("a.id") || t.languageCode?.startsWith("id"),
      ) ||
      availableTracks[0];

    if (!selectedTrack?.baseUrl) {
      return corsJson(
        { error: { message: "Caption track URL is missing." } },
        { status: 404 },
      );
    }

    // Fetch caption track using json3 format for structured parsing
    let trackUrl = selectedTrack.baseUrl.replace(/&fmt=[^&]+/, "");
    trackUrl += "&fmt=json3";

    const userAgent =
      selectedClient?.userAgent ||
      "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)";

    const trackRes = await fetch(trackUrl, {
      headers: {
        "User-Agent": userAgent,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!trackRes.ok) {
      return corsJson(
        {
          error: {
            message: `Failed to download caption track (HTTP ${trackRes.status}).`,
          },
        },
        { status: 502 },
      );
    }

    const trackBody = await trackRes.text();
    const lines: string[] = [];

    // Try parsing json3 events
    try {
      const json3: Json3Transcript = JSON.parse(trackBody);
      const events = json3.events || [];

      for (const event of events) {
        if (!event.segs || event.aAppend === 1) continue;
        const raw = event.segs.map((s) => s.utf8 || "").join("");
        const clean = decodeXmlEntities(raw.replace(/<[^>]*>/g, "")).trim();
        if (!clean) continue;

        const startSec = (event.tStartMs || 0) / 1000;
        lines.push(`${formatTime(startSec)} ${clean}`);
      }
    } catch {
      // Fallback: parse as timedtext XML if not json3
      const textRegex =
        /<text\s+start="([0-9.]+)"(?:\s+dur="([0-9.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
      let match: RegExpExecArray | null;
      while ((match = textRegex.exec(trackBody)) !== null) {
        if (!match[1] || !match[3]) continue;
        const startSec = parseFloat(match[1]);
        const cleanContent = decodeXmlEntities(
          match[3].replace(/<[^>]*>/g, ""),
        ).trim();
        if (cleanContent) {
          lines.push(`${formatTime(startSec)} ${cleanContent}`);
        }
      }
    }

    if (lines.length === 0) {
      return corsJson(
        {
          error: {
            message:
              "Transcript captions were empty or could not be parsed for this video.",
          },
        },
        { status: 404 },
      );
    }

    const fullTranscript = lines.join("\n");
    const trackLang =
      selectedTrack.name?.simpleText ||
      selectedTrack.name?.runs?.[0]?.text ||
      selectedTrack.languageCode ||
      "en";

    return corsJson({
      videoId,
      url: watchUrl,
      title: videoTitle,
      author,
      language: trackLang,
      transcript: fullTranscript,
      lineCount: lines.length,
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url =
    searchParams.get("url") ||
    searchParams.get("v") ||
    searchParams.get("videoId");

  if (!url) {
    return corsJson(
      { error: { message: "Query parameter 'url' or 'videoId' is required." } },
      { status: 400 },
    );
  }

  const dummyReq = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({ url }),
  });

  return POST(dummyReq);
}
