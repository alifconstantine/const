/**
 * Document Parser Service for Const Learn.
 * Supports PDF (via pdfjs-dist), DOCX (via mammoth), Markdown, and Plain Text.
 * Safe for both browser/mobile environments and Electron desktop.
 */

import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import JSZip from "jszip";

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

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
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
 * Extract clean text and slide structure from a PowerPoint (.pptx) file buffer.
 */
export async function parsePptxBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ParsedDocument> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideEntries: Array<{ name: string; slideNum: number }> = [];

    // Find all slide XML files: ppt/slides/slide{number}.xml
    zip.forEach((relativePath) => {
      const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      if (match && match[1]) {
        slideEntries.push({
          name: relativePath,
          slideNum: parseInt(match[1], 10),
        });
      }
    });

    // Sort slides numerically (Slide 1, Slide 2, ..., Slide 10)
    slideEntries.sort((a, b) => a.slideNum - b.slideNum);

    const slideTexts: string[] = [];

    for (const entry of slideEntries) {
      try {
        const file = zip.file(entry.name);
        if (!file) continue;
        const xml = await file.async("text");

        // Extract paragraphs and text runs (<a:p> and <a:t>)
        const paragraphRegex = /<a:p[\s>][\s\S]*?<\/a:p>/gi;
        const paragraphs: string[] = [];
        let pMatch: RegExpExecArray | null;

        while ((pMatch = paragraphRegex.exec(xml)) !== null) {
          const pContent = pMatch[0];
          const textRegex = /<a:t[\s>]([\s\S]*?)<\/a:t>/gi;
          const textRuns: string[] = [];
          let tMatch: RegExpExecArray | null;
          while ((tMatch = textRegex.exec(pContent)) !== null) {
            if (tMatch[1]) {
              textRuns.push(decodeXmlEntities(tMatch[1].replace(/<[^>]*>/g, "")));
            }
          }
          const pText = textRuns.join("").trim();
          if (pText) {
            paragraphs.push(pText);
          }
        }

        // If no structured paragraphs matched, fallback to simple <a:t> extraction
        if (paragraphs.length === 0) {
          const textRegex = /<a:t[\s>]([\s\S]*?)<\/a:t>/gi;
          let tMatch: RegExpExecArray | null;
          while ((tMatch = textRegex.exec(xml)) !== null) {
            if (tMatch[1]) {
              const cleaned = decodeXmlEntities(tMatch[1].replace(/<[^>]*>/g, "")).trim();
              if (cleaned) paragraphs.push(cleaned);
            }
          }
        }

        // Check if there are presenter notes for this slide (ppt/notesSlides/notesSlide{n}.xml)
        let noteText = "";
        const notesFile = zip.file(`ppt/notesSlides/notesSlide${entry.slideNum}.xml`);
        if (notesFile) {
          try {
            const notesXml = await notesFile.async("text");
            const noteRuns: string[] = [];
            const nRegex = /<a:t[\s>]([\s\S]*?)<\/a:t>/gi;
            let nMatch: RegExpExecArray | null;
            while ((nMatch = nRegex.exec(notesXml)) !== null) {
              if (nMatch[1]) {
                const cleanNote = decodeXmlEntities(nMatch[1].replace(/<[^>]*>/g, "")).trim();
                if (cleanNote && cleanNote !== String(entry.slideNum)) {
                  noteRuns.push(cleanNote);
                }
              }
            }
            if (noteRuns.length > 0) {
              noteText = `\n[Notes: ${noteRuns.join(" ")}]`;
            }
          } catch {}
        }

        if (paragraphs.length > 0 || noteText) {
          slideTexts.push(`--- Slide ${entry.slideNum} ---\n${paragraphs.join("\n")}${noteText}`);
        }
      } catch (slideErr) {
        console.warn(`Failed to parse slide ${entry.slideNum}:`, slideErr);
      }
    }

    const fullContent = slideTexts.join("\n\n");
    return {
      title: fileName,
      content: fullContent || "[Presentasi PowerPoint tidak memuat teks yang dapat dibaca]",
      pageCount: slideEntries.length,
      size: buffer.byteLength,
      type: "file",
    };
  } catch (err: any) {
    throw new Error(`Gagal membaca berkas PowerPoint (.pptx): ${err.message || String(err)}`);
  }
}

/**
 * Unified entry point to parse any supported uploaded file (PDF, PPTX, DOCX, Text, Markdown, Code).
 */
export async function parseUploadedFile(file: File): Promise<ParsedDocument> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  const size = file.size;

  // 1. Tolak format legacy binary .doc dan .ppt
  if (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) {
    throw new Error(
      "Format .doc (Word 97-2003 lama) tidak dapat diunggah. Silakan simpan sebagai format modern .docx atau ekspor ke PDF terlebih dahulu."
    );
  }
  if (lowerName.endsWith(".ppt") && !lowerName.endsWith(".pptx")) {
    throw new Error(
      "Format .ppt (PowerPoint 97-2003 lama) tidak dapat diunggah. Silakan simpan sebagai format modern .pptx atau ekspor ke PDF terlebih dahulu."
    );
  }

  // 2. PDF
  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const buffer = await file.arrayBuffer();
    return await parsePdfBuffer(buffer, fileName);
  }

  // 3. PPTX (PowerPoint modern)
  if (
    lowerName.endsWith(".pptx") ||
    file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    const buffer = await file.arrayBuffer();
    return await parsePptxBuffer(buffer, fileName);
  }

  // 4. DOCX (Word modern)
  if (
    lowerName.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = await file.arrayBuffer();
    return await parseDocxBuffer(buffer, fileName);
  }

  // 5. Plain Text / Markdown / Code files
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
