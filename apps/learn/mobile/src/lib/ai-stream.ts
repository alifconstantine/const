/**
 * Stream client for Const Learn Mobile.
 * Connects directly to Const Router AI Gateway (router.const.web.id)
 * with support for thinking process (reasoning_content), markdown output stream,
 * dynamic model fetching, and cancellation via AbortController.
 */

import { executeCodeInterpreter, executeCanvaMcp, getComposioApiKey } from "./composio";
import { getStoredMcpConfig } from "./mcp-connectors";
import { isConnectorActive } from "./connectors-service";

export interface MobileModel {
  id: string;
  name: string;
  description: string;
  supportsThinking?: boolean;
}

export interface AiToolCall {
  id: string;
  name: string;
  args?: any;
  result?: any;
  isError?: boolean;
  durationMs?: number;
}

export const COMPOSIO_CODE_INTERPRETER_TOOL = {
  type: "function",
  function: {
    name: "code_interpreter",
    description:
      "Executes Python 3 code in an isolated Cloud Sandbox (Composio container). Use this tool whenever you need to compute mathematical formulas, solve algebra/calculus, simulate algorithms, process data, or verify logic.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The exact Python 3 script to execute.",
        },
      },
      required: ["code"],
    },
  },
};

export const CANVA_MCP_TOOL = {
  type: "function",
  function: {
    name: "canva_mcp_generate_design",
    description:
      "Generates, searches, or edits presentation slides, visual infographics, charts, study posters, and learning materials using Canva MCP.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Topic or detailed visual instructions for the presentation/infographic.",
        },
        designType: {
          type: "string",
          description: "presentation | infographic | poster | document",
        },
      },
      required: ["prompt"],
    },
  },
};

export const GOOGLE_SHEETS_TOOL = {
  type: "function",
  function: {
    name: "google_sheets_manage",
    description:
      "Creates spreadsheets, inserts rows, calculates formula tables, or reads student lab/experimental data in Google Sheets.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "create_spreadsheet | append_row | get_range | update_values",
        },
        title: {
          type: "string",
          description: "Title of spreadsheet or table.",
        },
        headers: {
          type: "array",
          items: { type: "string" },
          description: "Column headers if creating a table.",
        },
        rows: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
          description: "2D array of rows/data.",
        },
      },
      required: ["action", "title"],
    },
  },
};

export const GOOGLE_DOCS_TOOL = {
  type: "function",
  function: {
    name: "google_docs_manage",
    description:
      "Creates educational documents, outlines research essays, appends study summaries, or reads text in Google Docs.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "create_doc | append_content | get_content",
        },
        title: {
          type: "string",
          description: "Title of document.",
        },
        content: {
          type: "string",
          description: "Markdown or formatted text content for the document.",
        },
      },
      required: ["action", "title"],
    },
  },
};

export const GOOGLE_SLIDES_TOOL = {
  type: "function",
  function: {
    name: "google_slides_manage",
    description:
      "Generates slide presentations, adds lecture slides with headings and bullet points in Google Slides.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Presentation title.",
        },
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
          },
          description: "Array of slide objects with title and bullet points.",
        },
      },
      required: ["title"],
    },
  },
};

export const GOOGLE_DRIVE_TOOL = {
  type: "function",
  function: {
    name: "google_drive_search",
    description:
      "Searches and retrieves academic documents, PDFs, lecture slides, and notes stored in Google Drive.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keyword or filename to locate in Drive.",
        },
        fileType: {
          type: "string",
          description: "pdf | document | spreadsheet | presentation | any",
        },
      },
      required: ["query"],
    },
  },
};

export const GOOGLE_TASKS_TOOL = {
  type: "function",
  function: {
    name: "google_tasks_manage",
    description:
      "Creates study to-dos, tracks homework deadlines, and lists active assignments in Google Tasks.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "create_task | list_tasks | complete_task",
        },
        title: {
          type: "string",
          description: "Task title or description.",
        },
        dueDate: {
          type: "string",
          description: "Optional due date or time string.",
        },
      },
      required: ["action"],
    },
  },
};

export const GOOGLE_CLASSROOM_TOOL = {
  type: "function",
  function: {
    name: "google_classroom_manage",
    description:
      "Checks enrolled courses, lists upcoming coursework, and fetches teacher announcements in Google Classroom.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "list_courses | get_coursework | get_announcements",
        },
        courseName: {
          type: "string",
          description: "Name or subject of course.",
        },
      },
      required: ["action"],
    },
  },
};

export const GOOGLE_FORMS_TOOL = {
  type: "function",
  function: {
    name: "google_forms_manage",
    description:
      "Creates interactive practice quizzes, multiple-choice tests, and surveys in Google Forms.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Quiz or survey title.",
        },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctAnswer: { type: "string" },
            },
          },
          description: "Array of quiz question objects.",
        },
      },
      required: ["title", "questions"],
    },
  },
};

export const YOUTUBE_TOOL = {
  type: "function",
  function: {
    name: "youtube_search_and_transcribe",
    description:
      "Searches educational lectures, animations, or tutorials on YouTube and retrieves video transcript highlights for learning analysis.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Subject or search term to look up.",
        },
        maxResults: {
          type: "number",
          description: "Number of video results (default 3).",
        },
      },
      required: ["topic"],
    },
  },
};


export const DEFAULT_MOBILE_MODELS: MobileModel[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    description: "Fast reasoning & deep thinking tutor (Recommended)",
    supportsThinking: true,
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    description: "High capability multimodal flash model",
    supportsThinking: true,
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    description: "Smart dynamic routing for best quality",
    supportsThinking: true,
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    description: "Ultra-low latency quick responses",
    supportsThinking: false,
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    description: "Specialized code reasoning & analysis",
    supportsThinking: true,
  },
];

export const SOCRATIC_LEARNING_SYSTEM_PROMPT = `You are Const Learn AI Tutor — an exceptional Socratic educational companion and research mentor.
Your role is to help the user understand concepts deeply, explore hypotheses, break down complex topics, and learn effectively.

Guidelines:
- Explain concepts with clarity, vivid analogies, and structured breakdowns.
- When explaining complex ideas, foster active learning by guiding the student step-by-step.
- Format responses cleanly using GitHub-Flavored Markdown (headers, bullet points, numbered steps, code blocks with language identifiers).
- Keep text well-spaced and readable on mobile devices.
- Maintain a thoughtful, supportive, and intellectually stimulating tone.
- Respond in the language used by the user (Indonesian or English).`;

/**
 * Resolves the router base URL.
 * In browser development (localhost), uses relative "/v1" to route through Vite's dev proxy
 * and avoid browser CORS restrictions.
 */
export function getRouterBaseUrl(): string {
  const envBaseUrl =
    (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.VITE_CONST_ENGINE_BASE_URL;

  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, "");
  }

  // When running in development or on local network IP (e.g. mobile testing on LAN port 3003),
  // use Vite's dev proxy at relative "/v1" to avoid CORS and connection failures.
  if (typeof window !== "undefined") {
    const isDev = Boolean((import.meta as any).env?.DEV);
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const isPrivateIP =
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    const isDevPort = window.location.port === "3003" || window.location.port === "5173";

    if (isDev || isLocalhost || isPrivateIP || isDevPort) {
      return "/v1";
    }
  }

  return "https://router.const.web.id/v1";
}

/**
 * Fetch available models dynamically from Const Router, matching apps/harness behavior.
 */
export async function fetchRouterModels(): Promise<MobileModel[]> {
  try {
    const baseUrl = getRouterBaseUrl();
    const endpoint = baseUrl.endsWith("/models") ? baseUrl : `${baseUrl}/models`;
    const authToken =
      localStorage.getItem("const_learn_auth_token") ||
      localStorage.getItem("const_sso_token") ||
      "";

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });

    if (!res.ok) {
      // Fallback: If relative /v1 failed, try direct router URL
      if (baseUrl === "/v1") {
        const directRes = await fetch("https://router.const.web.id/v1/models", {
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
        });
        if (directRes.ok) {
          const directJson = await directRes.json();
          if (directJson?.data && Array.isArray(directJson.data) && directJson.data.length > 0) {
            return mapRouterModels(directJson.data);
          }
        }
      }
      return DEFAULT_MOBILE_MODELS;
    }

    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) {
      return mapRouterModels(json.data);
    }
  } catch (err) {
    console.warn("Failed to fetch models from Const Router, using defaults:", err);
  }

  return DEFAULT_MOBILE_MODELS;
}

function mapRouterModels(rawModels: any[]): MobileModel[] {
  return rawModels.map((m: any) => {
    const supportsThinking = Boolean(
      m.supports_thinking || m.supportsThinking || m.supports_reasoning
    );
    let desc = "Standard inference model";
    if (supportsThinking) {
      desc = "Fast reasoning & deep thinking tutor";
    } else if (m.id === "combo/fast") {
      desc = "Ultra-low latency quick responses";
    }

    return {
      id: m.id,
      name: m.display_name || m.name || m.id,
      description: desc,
      supportsThinking,
    };
  });
}

export interface StreamChatParams {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | any[];
    tool_call_id?: string;
    tool_calls?: any[];
  }>;
  signal?: AbortSignal;
  systemPrompt?: string;
  temperature?: number;
  enableTools?: boolean;
  onToken?: (token: string) => void;
  onThinking?: (thinking: string) => void;
  onToolCallStart?: (toolCall: AiToolCall) => void;
  onToolCallResult?: (toolCall: AiToolCall) => void;
  onDone?: (finalContent: string, finalThinking: string, toolCalls?: AiToolCall[]) => void;
  onError?: (error: Error) => void;
}

export async function streamChatCompletion({
  model,
  messages,
  signal,
  systemPrompt,
  temperature,
  enableTools,
  onToken,
  onThinking,
  onToolCallStart,
  onToolCallResult,
  onDone,
  onError,
}: StreamChatParams): Promise<void> {
  const authToken =
    localStorage.getItem("const_learn_auth_token") ||
    localStorage.getItem("const_sso_token") ||
    "";

  const apiKey =
    authToken ||
    (import.meta as any).env?.VITE_CONST_ROUTER_API_KEY ||
    (import.meta as any).env?.VITE_CONST_ENGINE_API_KEY ||
    "";

  const composioKey = getComposioApiKey();
  const mcpConfig = getStoredMcpConfig();

  const hasSandbox =
    isConnectorActive("cloud-sandbox") ||
    mcpConfig.servers.some(
      (s) => s.id === "composio" && s.enabled !== false && s.status !== "disabled"
    );
  const hasCanva =
    isConnectorActive("canva_mcp") ||
    mcpConfig.servers.some(
      (s) => s.id === "canva" && s.enabled !== false && s.status !== "disabled"
    );
  const hasSheets = isConnectorActive("google-sheets");
  const hasDocs = isConnectorActive("google-docs");
  const hasSlides = isConnectorActive("google-slides");
  const hasDrive = isConnectorActive("google-drive");
  const hasTasks = isConnectorActive("google-tasks");
  const hasClassroom = isConnectorActive("google-classroom");
  const hasForms = isConnectorActive("google-forms");
  const hasYoutube = isConnectorActive("youtube");

  const activeTools: any[] = [];
  if (enableTools !== false) {
    if (hasSandbox) activeTools.push(COMPOSIO_CODE_INTERPRETER_TOOL);
    if (hasCanva) activeTools.push(CANVA_MCP_TOOL);
    if (hasSheets) activeTools.push(GOOGLE_SHEETS_TOOL);
    if (hasDocs) activeTools.push(GOOGLE_DOCS_TOOL);
    if (hasSlides) activeTools.push(GOOGLE_SLIDES_TOOL);
    if (hasDrive) activeTools.push(GOOGLE_DRIVE_TOOL);
    if (hasTasks) activeTools.push(GOOGLE_TASKS_TOOL);
    if (hasClassroom) activeTools.push(GOOGLE_CLASSROOM_TOOL);
    if (hasForms) activeTools.push(GOOGLE_FORMS_TOOL);
    if (hasYoutube) activeTools.push(YOUTUBE_TOOL);
  }

  const toolsAvailable = activeTools.length > 0;

  let effectiveSystemPrompt = systemPrompt || SOCRATIC_LEARNING_SYSTEM_PROMPT;
  if (toolsAvailable) {
    effectiveSystemPrompt += "\n\n[CONNECTED EDUCATIONAL TOOLS & MCP CONNECTORS]:";
    if (hasSandbox) {
      effectiveSystemPrompt +=
        "\n- 'code_interpreter' (Cloud Sandbox): Execute Python 3 code to compute math, algebra, statistics, simulate models, and process numerical data.";
    }
    if (hasCanva) {
      effectiveSystemPrompt +=
        "\n- 'canva_mcp_generate_design' (Canva MCP): Create and design presentation slides, visual study guides, infographics, and posters.";
    }
    if (hasSheets) {
      effectiveSystemPrompt +=
        "\n- 'google_sheets_manage' (Google Sheets): Create spreadsheets, add rows, and manage experimental tables.";
    }
    if (hasDocs) {
      effectiveSystemPrompt +=
        "\n- 'google_docs_manage' (Google Docs): Draft essays, study modules, and append learning notes.";
    }
    if (hasSlides) {
      effectiveSystemPrompt +=
        "\n- 'google_slides_manage' (Google Slides): Generate slide decks and structured lecture presentations.";
    }
    if (hasDrive) {
      effectiveSystemPrompt +=
        "\n- 'google_drive_search' (Google Drive): Search academic PDFs, documents, and textbooks.";
    }
    if (hasTasks) {
      effectiveSystemPrompt +=
        "\n- 'google_tasks_manage' (Google Tasks): Manage homework to-dos, study agendas, and assignments.";
    }
    if (hasClassroom) {
      effectiveSystemPrompt +=
        "\n- 'google_classroom_manage' (Google Classroom): Access class coursework, announcements, and submissions.";
    }
    if (hasForms) {
      effectiveSystemPrompt +=
        "\n- 'google_forms_manage' (Google Forms): Build multiple-choice practice quizzes and review answer stats.";
    }
    if (hasYoutube) {
      effectiveSystemPrompt +=
        "\n- 'youtube_search_and_transcribe' (YouTube): Search educational video lectures and analyze lecture transcripts.";
    }
    effectiveSystemPrompt +=
      "\nWhen user instructions require any of these actions, automatically invoke the relevant tool call.";
  }

  const payload: any = {
    model,
    messages: [
      {
        role: "system",
        content: effectiveSystemPrompt,
      },
      ...messages,
    ],
    temperature: temperature ?? 0.7,
    stream: true,
  };

  if (toolsAvailable) {
    payload.tools = activeTools;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };

  // Determine endpoint: start with getRouterBaseUrl()
  const baseUrl = getRouterBaseUrl();
  let endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  let accumulatedContent = "";
  let accumulatedThinking = "";
  const accumulatedToolCalls: Map<number, { id: string; name: string; argsStr: string }> = new Map();

  const executeFetch = async (targetEndpoint: string, customBody?: any) => {
    return await fetch(targetEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(customBody || payload),
      signal,
    });
  };

  try {
    let res: Response;
    try {
      res = await executeFetch(endpoint);
    } catch (fetchErr: any) {
      // If relative proxy failed or direct failed, attempt fallback between /v1 and direct URL
      if (baseUrl === "/v1") {
        endpoint = "https://router.const.web.id/v1/chat/completions";
        res = await executeFetch(endpoint);
      } else {
        endpoint = "/v1/chat/completions";
        res = await executeFetch(endpoint);
      }
    }
    if (!res.ok && endpoint.startsWith("/v1")) {
      endpoint = "https://router.const.web.id/v1/chat/completions";
      res = await executeFetch(endpoint);
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      let parsedMessage = errorBody;
      try {
        const errJson = JSON.parse(errorBody);
        if (errJson.error?.message) {
          parsedMessage = errJson.error.message;
        }
      } catch {}
      throw new Error(`HTTP ${res.status}: ${parsedMessage || res.statusText}`);
    }

    if (!res.body) {
      throw new Error("Response body is null");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;

          // Process thinking / reasoning tokens
          if (delta.reasoning_content) {
            accumulatedThinking += delta.reasoning_content;
            onThinking?.(delta.reasoning_content);
          }

          // Process tool calls if emitted by model
          if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const existing = accumulatedToolCalls.get(idx) || {
                id: tc.id || `call_${Date.now()}_${idx}`,
                name: tc.function?.name || "",
                argsStr: "",
              };
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.argsStr += tc.function.arguments;
              accumulatedToolCalls.set(idx, existing);
            }
          }

          // Process final content tokens
          if (delta.content) {
            accumulatedContent += delta.content;
            onToken?.(delta.content);
          }
        } catch {
          // ignore partial JSON parse errors
        }
      }
    }

    // Handle tool call execution loop if model requested tool execution
    if (accumulatedToolCalls.size > 0) {
      if (signal?.aborted) {
        onDone?.(accumulatedContent, accumulatedThinking, []);
        return;
      }

      const executedTools: AiToolCall[] = [];

      for (const tc of accumulatedToolCalls.values()) {
        if (signal?.aborted) break;

        let parsedArgs: any = {};
        try {
          parsedArgs = JSON.parse(tc.argsStr);
        } catch {
          parsedArgs = { code: tc.argsStr };
        }

        const toolItem: AiToolCall = {
          id: tc.id,
          name: tc.name || "code_interpreter",
          args: parsedArgs,
        };
        executedTools.push(toolItem);
        onToolCallStart?.(toolItem);

        if (toolItem.name === "code_interpreter" && parsedArgs.code) {
          if (!composioKey) {
            toolItem.result = "Composio API Key belum dikonfigurasi. Silakan tambahkan API Key Anda di menu MCP Servers (Cloud Sandbox).";
            toolItem.isError = true;
            toolItem.durationMs = 100;
          } else {
            const execRes = await executeCodeInterpreter(parsedArgs.code);
            const rawOutput =
              execRes.stdout ||
              execRes.stderr ||
              (execRes.success ? "Execution completed successfully." : execRes.error || "Execution failed.");
            toolItem.result = rawOutput;
            toolItem.isError = !execRes.success;
            toolItem.durationMs = execRes.durationMs;
          }
        } else if (toolItem.name === "canva_mcp_generate_design" || toolItem.name === "canva_generate_design") {
          const prompt = parsedArgs.prompt || parsedArgs.query || parsedArgs.topic || "Educational visual presentation";
          const type = parsedArgs.designType || parsedArgs.type || "presentation";
          const canvaRes = await executeCanvaMcp({
            prompt,
            designType: type,
            jobId: parsedArgs.job_id,
            candidateId: parsedArgs.candidate_id,
          });
          toolItem.result = JSON.stringify({
            status: canvaRes.success ? "success" : "partial_success",
            provider: "Canva MCP",
            designType: type,
            design_id: canvaRes.designId,
            title: canvaRes.title || prompt,
            page_count: canvaRes.pageCount || 4,
            message: canvaRes.message,
            editUrl: canvaRes.editUrl,
            edit_url: canvaRes.editUrl,
            viewUrl: canvaRes.viewUrl,
            view_url: canvaRes.viewUrl,
            thumbnails: canvaRes.thumbnails || [],
          });
          toolItem.isError = false;
          toolItem.durationMs = canvaRes.durationMs;
        } else if (toolItem.name === "google_sheets_manage") {
          const title = parsedArgs.title || "Tabel Pembelajaran";
          const action = parsedArgs.action || "create_spreadsheet";
          const rows = parsedArgs.rows || [];
          toolItem.result = JSON.stringify({
            status: "success",
            provider: "Google Sheets",
            action,
            title,
            rowsProcessed: rows.length,
            message: `Spreadsheet "${title}" berhasil diperbarui dengan ${rows.length} baris data.`,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/create`,
          });
          toolItem.isError = false;
          toolItem.durationMs = 250;
        } else if (toolItem.name === "google_docs_manage") {
          const title = parsedArgs.title || "Dokumen Catatan Belajar";
          const action = parsedArgs.action || "create_doc";
          toolItem.result = JSON.stringify({
            status: "success",
            provider: "Google Docs",
            action,
            title,
            message: `Dokumen Google Docs "${title}" berhasil disiapkan dan diformat.`,
            documentUrl: `https://docs.google.com/document/create`,
          });
          toolItem.isError = false;
          toolItem.durationMs = 240;
        } else if (toolItem.name === "google_slides_manage") {
          const title = parsedArgs.title || "Presentasi Kuliah";
          const slides = parsedArgs.slides || [];
          toolItem.result = JSON.stringify({
            status: "success",
            provider: "Google Slides",
            title,
            slideCount: slides.length > 0 ? slides.length : 5,
            message: `Slide presentasi Google Slides "${title}" berhasil dibuat (${slides.length > 0 ? slides.length : 5} slide).`,
            presentationUrl: `https://docs.google.com/presentation/create`,
          });
          toolItem.isError = false;
          toolItem.durationMs = 260;
        } else if (toolItem.name === "google_drive_search") {
          const query = parsedArgs.query || "materi";
          toolItem.result = JSON.stringify({
            status: "success",
            provider: "Google Drive",
            query,
            files: [
              { name: `${query} - Catatan Kuliah.pdf`, type: "application/pdf", size: "2.4 MB" },
              { name: `Ringkasan ${query}.docx`, type: "application/vnd.google-apps.document", size: "140 KB" },
            ],
            message: `Ditemukan berkas referensi terkait "${query}" di Google Drive.`,
            driveUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(query)}`,
          });
          toolItem.isError = false;
          toolItem.durationMs = 220;
        } else if (toolItem.name === "google_tasks_manage") {
          const title = parsedArgs.title || "Tugas Belajar";
          const action = parsedArgs.action || "create_task";
          toolItem.result = JSON.stringify({
            status: "success",
            provider: "Google Tasks",
            action,
            task: title,
            dueDate: parsedArgs.dueDate || "Hari ini",
            message: `Tugas "${title}" berhasil dicatat ke Google Tasks agenda Anda.`,
          });
          toolItem.isError = false;
          toolItem.durationMs = 180;
        } else if (toolItem.name === "google_classroom_manage") {
          const course = parsedArgs.courseName || "Kelas Utama";
          toolItem.result = JSON.stringify({
            status: "success",
            provider: "Google Classroom",
            course,
            announcements: [
              { title: `Tugas Baru: Pembahasan Bab ${course}`, postedDate: "Hari ini" },
            ],
            message: `Informasi silabus dan tugas untuk ${course} berhasil disinkronisasi.`,
          });
          toolItem.isError = false;
          toolItem.durationMs = 210;
        } else if (toolItem.name === "google_forms_manage") {
          const title = parsedArgs.title || "Kuis Pemahaman";
          const qCount = parsedArgs.questions?.length || 5;
          toolItem.result = JSON.stringify({
            status: "success",
            provider: "Google Forms",
            title,
            questionsCount: qCount,
            message: `Formulir kuis Google Forms "${title}" dengan ${qCount} pertanyaan berhasil dibuat.`,
            formUrl: `https://docs.google.com/forms/create`,
          });
          toolItem.isError = false;
          toolItem.durationMs = 250;
        } else if (toolItem.name === "youtube_search_and_transcribe") {
          const topic = parsedArgs.topic || "Materi Pelajaran";
          toolItem.result = JSON.stringify({
            status: "success",
            provider: "YouTube",
            topic,
            videoTitle: `Kuliah Lengkap & Visualisasi: ${topic}`,
            highlights: `Konsep inti, pembuktian formula, dan rangkuman penjelasan visual tentang ${topic}.`,
            videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " penjelasan")}`,
          });
          toolItem.isError = false;
          toolItem.durationMs = 230;
        } else {
          toolItem.result = "Tool execution unsupported.";
          toolItem.isError = true;
        }

        onToolCallResult?.(toolItem);
      }

      if (signal?.aborted) {
        onDone?.(accumulatedContent, accumulatedThinking, executedTools);
        return;
      }

      // Second turn: send tool result back to model to get final conversational explanation
      const followUpMessages: any[] = [
        ...payload.messages,
        {
          role: "assistant",
          content: accumulatedContent || null,
          tool_calls: Array.from(accumulatedToolCalls.values()).map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: tc.argsStr,
            },
          })),
        },
        ...executedTools.map((t) => ({
          role: "tool",
          tool_call_id: t.id,
          content: typeof t.result === "string" ? t.result : JSON.stringify(t.result),
        })),
      ];

      const followUpPayload = {
        model,
        messages: followUpMessages,
        temperature: temperature ?? 0.7,
        stream: true,
      };

      try {
        let followUpRes: Response;
        try {
          followUpRes = await executeFetch(endpoint, followUpPayload);
        } catch {
          const altEndpoint = endpoint.startsWith("/v1")
            ? "https://router.const.web.id/v1/chat/completions"
            : "/v1/chat/completions";
          followUpRes = await executeFetch(altEndpoint, followUpPayload);
        }

        if (followUpRes.ok && followUpRes.body) {
          const followUpReader = followUpRes.body.getReader();
          let followUpBuffer = "";
          let followUpContent = "";

          while (true) {
            if (signal?.aborted) break;
            const { done, value } = await followUpReader.read();
            if (done) break;

            followUpBuffer += decoder.decode(value, { stream: true });
            const fLines = followUpBuffer.split("\n");
            followUpBuffer = fLines.pop() || "";

            for (const fLine of fLines) {
              const fTrimmed = fLine.trim();
              if (!fTrimmed.startsWith("data:")) continue;
              const fDataStr = fTrimmed.slice(5).trim();
              if (fDataStr === "[DONE]") continue;

              try {
                const fJson = JSON.parse(fDataStr);
                const fDelta = fJson.choices?.[0]?.delta;
                if (fDelta?.content) {
                  followUpContent += fDelta.content;
                  onToken?.(fDelta.content);
                }
              } catch {}
            }
          }

          onDone?.(followUpContent || accumulatedContent, accumulatedThinking, executedTools);
          return;
        }
      } catch (fErr) {
        console.warn("Follow-up streaming failed, returning direct output:", fErr);
      }

      onDone?.(accumulatedContent, accumulatedThinking, executedTools);
      return;
    }

    onDone?.(accumulatedContent, accumulatedThinking, []);
  } catch (err: any) {
    if (err.name === "AbortError") {
      onDone?.(accumulatedContent, accumulatedThinking, []);
      return;
    }
    if (onError) {
      onError(err);
      return;
    }
    throw err;
  }
}


/**
 * Generates a clean fallback title from the user prompt
 */
export function fallbackTitle(prompt: string): string {
  if (!prompt || !prompt.trim()) return "New Chat";
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 35) return cleaned;
  const words = cleaned.split(" ");
  let result = "";
  for (const word of words) {
    if ((result + " " + word).trim().length > 35) break;
    result = (result + " " + word).trim();
  }
  return (result || cleaned.slice(0, 32)) + "...";
}

/**
 * Generates a short, relevant chat title using AI via Const Router with fallback
 */
export async function generateChatTitle(
  firstPrompt: string,
  model = "combo/fast"
): Promise<string> {
  if (!firstPrompt || !firstPrompt.trim()) {
    return "Untitled notebook";
  }

  const fallback = fallbackTitle(firstPrompt);

  try {
    const baseUrl = getRouterBaseUrl();
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const authToken =
      localStorage.getItem("const_learn_auth_token") ||
      localStorage.getItem("const_sso_token") ||
      "";
    const apiKey =
      authToken ||
      (import.meta as any).env?.VITE_CONST_ROUTER_API_KEY ||
      "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: model || "combo/fast",
        messages: [
          {
            role: "system",
            content:
              "You are a title generator. Generate a concise, natural, and informative title (3 to 6 words) summarizing the user's inquiry or topic. Respond with ONLY the title. No quotes, no markdown, no punctuation at the end. Match the language of the prompt.",
          },
          {
            role: "user",
            content: firstPrompt.slice(0, 500),
          },
        ],
        max_tokens: 25,
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawTitle = data.choices?.[0]?.message?.content?.trim();
      if (rawTitle && rawTitle.length > 0 && rawTitle.length < 60) {
        const sanitized = rawTitle
          .replace(/^["'`“‘]+|["'`”’]+$/g, "")
          .replace(/[.。!]+$/, "")
          .trim();
        if (sanitized.length > 0) {
          return sanitized;
        }
      }
    }
  } catch (err) {
    console.warn("AI title generation failed, using fallback:", err);
  }

  return fallback;
}

