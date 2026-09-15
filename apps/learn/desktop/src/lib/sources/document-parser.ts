/**
 * Document Parser Service for Const Learn.
 * Supports PDF (via pdfjs-dist), DOCX (via mammoth), Markdown, and Plain Text.
 * Safe for both browser/mobile environments and Electron desktop.
 */

import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Set pdfjs worker source if in browser environment
if (typeof window !== "undefined") {
  try {
    // Use bundled or unpkg worker fallback
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch {}
}

export interface ParsedDocument {
  title: string;
  content: string;
  pageCount?: number;
  size: number;
  type: "file" | "text";
}

/**
 * Extract text from a PDF ArrayBuffer page-by-page.
 */
export async function parsePdfBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ParsedDocument> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageString = textContent.items
          .map((item: any) => item.str || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (pageString) {
          pageTexts.push(`--- Page ${pageNum} ---\n${pageString}`);
        }
      } catch (pageErr) {
        console.warn(`Failed to parse PDF page ${pageNum}:`, pageErr);
      }
    }

    const fullContent = pageTexts.join("\n\n");
    return {
      title: fileName,
      content: fullContent || "[PDF document contained no readable text]",
      pageCount: numPages,
      size: buffer.byteLength,
      type: "file",
    };
  } catch (err) {
    console.warn("pdfjs-dist parse failed, trying fallback stream text extraction:", err);
    // Fallback: simple text extraction from raw PDF byte stream
    const decoder = new TextDecoder("utf-8");
    const rawText = decoder.decode(buffer);
    const textMatches: string[] = [];
    const regex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
      if (match[1]) textMatches.push(match[1]);
    }
    const fallbackText = textMatches.join(" ").replace(/\\([()\\])/g, "$1");

    return {
      title: fileName,
      content: fallbackText || "[Could not extract readable text from PDF]",
      size: buffer.byteLength,
      type: "file",
    };
  }
}

/**
 * Extract clean text and markdown from a DOCX file buffer.
 */
export async function parseDocxBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ParsedDocument> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return {
      title: fileName,
      content: result.value || "[Empty Word document]",
      size: buffer.byteLength,
      type: "file",
    };
  } catch (err: any) {
    throw new Error(`Failed to parse Word document: ${err.message || String(err)}`);
  }
}

/**
 * Unified entry point to parse any supported uploaded file (PDF, Word, Text, Markdown, Code).
 */
export async function parseUploadedFile(file: File): Promise<ParsedDocument> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  const size = file.size;

  // 1. PDF
  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const buffer = await file.arrayBuffer();
    return await parsePdfBuffer(buffer, fileName);
  }

  // 2. DOCX / DOC
  if (
    lowerName.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = await file.arrayBuffer();
    return await parseDocxBuffer(buffer, fileName);
  }

  // 3. Plain Text / Markdown / Code files
  try {
    const text = await file.text();
    return {
      title: fileName,
      content: text,
      size,
      type: "file",
    };
  } catch (err: any) {
    throw new Error(`Unable to read file ${fileName}: ${err.message || String(err)}`);
  }
}
