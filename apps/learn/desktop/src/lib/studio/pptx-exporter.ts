import pptxgen from "pptxgenjs";
import { jsPDF } from "jspdf";
import type { SlideDeckData } from "../db";
import { getTheme } from "./presentation/themes";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const bigint = parseInt(clean, 16);
  if (isNaN(bigint)) return [22, 22, 22];
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function cleanHex(hex: string): string {
  return hex.replace("#", "").trim();
}

export async function exportToPdf(deck: SlideDeckData, filename?: string): Promise<void> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [960, 540],
  });

  const PAGE_W = 960;
  const PAGE_H = 540;
  const theme = getTheme(deck.themeId);
  const bgRgb = hexToRgb(theme.colors.bg);
  const surfRgb = hexToRgb(theme.colors.surface);
  const borderRgb = hexToRgb(theme.colors.border);
  const textRgb = hexToRgb(theme.colors.fg);
  const mutedRgb = hexToRgb(theme.colors.fgMuted);
  const accentRgb = hexToRgb(theme.colors.accent);

  for (let i = 0; i < deck.slides.length; i++) {
    if (i > 0) {
      doc.addPage([PAGE_W, PAGE_H], "landscape");
    }

    const slide = deck.slides[i];
    if (!slide) continue;

    // Theme canvas background
    doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    // Header strip
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
    doc.text(deck.title.toUpperCase(), 50, 42);

    const counterText = `№ ${slide.slideNumber || i + 1} / ${deck.slides.length}`;
    doc.text(counterText, PAGE_W - 50, 42, { align: "right" });

    // Header divider
    doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
    doc.setLineWidth(0.75);
    doc.line(50, 50, PAGE_W - 50, 50);

    // HERO LAYOUT
    if (slide.layout === "hero") {
      let yPos = 210;
      const kicker = slide.accentTag || slide.kicker;
      if (kicker) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        doc.text(kicker.toUpperCase(), PAGE_W / 2, yPos, { align: "center" });
        yPos += 28;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(30);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      const titleLines = doc.splitTextToSize(slide.title, 750);
      doc.text(titleLines, PAGE_W / 2, yPos, { align: "center" });
      yPos += titleLines.length * 34 + 10;

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        const subLines = doc.splitTextToSize(slide.subtitle, 700);
        doc.text(subLines, PAGE_W / 2, yPos, { align: "center" });
      }
    }

    // BIG-STAT LAYOUT
    else if (slide.layout === "big-stat") {
      const statVal = slide.statHighlight?.value || slide.numbers?.[0]?.value || "100%";
      const statLabel = slide.statHighlight?.label || slide.numbers?.[0]?.label || slide.title;
      const statCtx = slide.statHighlight?.context || slide.subtitle || (slide.bullets && slide.bullets[0]);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(slide.title, 50, 95);

      // Card container
      doc.setFillColor(surfRgb[0], surfRgb[1], surfRgb[2]);
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.roundedRect(50, 125, PAGE_W - 100, 310, 12, 12, "FD");

      // Giant stat number
      doc.setFont("helvetica", "bold");
      doc.setFontSize(64);
      doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.text(statVal, 80, 220);

      // Stat label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(statLabel.toUpperCase(), 80, 265);

      // Context paragraph
      if (statCtx) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(13);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        const ctxLines = doc.splitTextToSize(statCtx, PAGE_W - 160);
        doc.text(ctxLines, 80, 305);
      }
    }

    // BENTO-GRID LAYOUT
    else if (slide.layout === "bento-grid") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(slide.title, 50, 90);

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        doc.text(slide.subtitle, 50, 112);
      }

      const cards = slide.bentoCards || (slide.bullets || []).map((b, idx) => ({
        title: b.split(":")[0] || `Item 0${idx + 1}`,
        desc: b.split(":")[1] || b,
        badge: `0${idx + 1}`,
      }));

      const colW = (PAGE_W - 120) / 2;
      const rowH = 145;
      const startY = 135;

      cards.slice(0, 4).forEach((c, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cardX = 50 + col * (colW + 20);
        const cardY = startY + row * (rowH + 15);

        doc.setFillColor(surfRgb[0], surfRgb[1], surfRgb[2]);
        doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
        doc.roundedRect(cardX, cardY, colW, rowH, 10, 10, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        doc.text(c.title, cardX + 18, cardY + 30);

        if (c.badge) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
          doc.text(c.badge, cardX + colW - 18, cardY + 30, { align: "right" });
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        const descLines = doc.splitTextToSize(c.desc, colW - 36);
        doc.text(descLines, cardX + 18, cardY + 55);
      });
    }

    // COMPARISON / SPLIT LAYOUT
    else if (slide.layout === "comparison" || slide.layout === "split") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(slide.title, 50, 90);

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        doc.text(slide.subtitle, 50, 112);
      }

      const leftTitle = slide.comparisonDetails?.leftTitle || slide.leftColumn?.title || "Konvensional";
      const leftItems = slide.comparisonDetails?.leftItems || slide.leftColumn?.items || slide.bullets?.slice(0, 3) || [];
      const rightTitle = slide.comparisonDetails?.rightTitle || slide.rightColumn?.title || "Strategi Modern";
      const rightItems = slide.comparisonDetails?.rightItems || slide.rightColumn?.items || slide.bullets?.slice(3) || [];

      const colW = (PAGE_W - 120) / 2;
      const colH = 300;
      const startY = 135;

      // Left Column
      doc.setFillColor(surfRgb[0], surfRgb[1], surfRgb[2]);
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.roundedRect(50, startY, colW, colH, 12, 12, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
      doc.text(leftTitle, 70, startY + 35);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11.5);
      let leftY = startY + 68;
      leftItems.forEach((it) => {
        const itLines = doc.splitTextToSize(`•  ${it}`, colW - 40);
        doc.text(itLines, 70, leftY);
        leftY += itLines.length * 16 + 10;
      });

      // Right Column (Highlight Accent)
      const rightX = 50 + colW + 20;
      doc.setFillColor(surfRgb[0], surfRgb[1], surfRgb[2]);
      doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.roundedRect(rightX, startY, colW, colH, 12, 12, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.text(rightTitle, rightX + 20, startY + 35);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11.5);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      let rightY = startY + 68;
      rightItems.forEach((it) => {
        const itLines = doc.splitTextToSize(`✓  ${it}`, colW - 40);
        doc.text(itLines, rightX + 20, rightY);
        rightY += itLines.length * 16 + 10;
      });
    }

    // QUOTE LAYOUT
    else if (slide.layout === "quote") {
      const quoteText = slide.quote?.text || slide.subtitle || slide.title;
      const author = slide.quote?.author || "Prinsip Utama";
      const context = slide.quote?.context || slide.accentTag || "";

      doc.setFont("times", "italic");
      doc.setFontSize(26);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      const quoteLines = doc.splitTextToSize(`“${quoteText}”`, 760);
      let yPos = 210;
      doc.text(quoteLines, PAGE_W / 2, yPos, { align: "center" });
      yPos += quoteLines.length * 32 + 25;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.text(`— ${author}`, PAGE_W / 2, yPos, { align: "center" });
      yPos += 20;

      if (context) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        doc.text(context, PAGE_W / 2, yPos, { align: "center" });
      }
    }

    // AGENDA LAYOUT
    else if (slide.layout === "agenda") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(slide.title, 50, 90);

      const items = slide.bullets || [];
      const colW = (PAGE_W - 120) / 2;
      const rowH = 65;
      const startY = 140;

      items.slice(0, 4).forEach((item, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cardX = 50 + col * (colW + 20);
        const cardY = startY + row * (rowH + 20);

        doc.setFillColor(surfRgb[0], surfRgb[1], surfRgb[2]);
        doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
        doc.roundedRect(cardX, cardY, colW, rowH, 8, 8, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        doc.text(`0${idx + 1}`, cardX + 16, cardY + 38);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        const itemLines = doc.splitTextToSize(item, colW - 60);
        doc.text(itemLines, cardX + 50, cardY + 38);
      });
    }

    // TIMELINE LAYOUT
    else if (slide.layout === "timeline") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(slide.title, 50, 90);

      const steps = slide.timelineSteps || (slide.bullets || []).map((b, idx) => ({
        step: `Fase 0${idx + 1}`,
        title: b.split(":")[0] || `Tahap 0${idx + 1}`,
        desc: b.split(":")[1] || b,
      }));

      const count = Math.min(3, steps.length);
      const colW = (PAGE_W - 100 - (count - 1) * 20) / count;
      const colH = 260;
      const startY = 140;

      steps.slice(0, count).forEach((st, idx) => {
        const cardX = 50 + idx * (colW + 20);

        doc.setFillColor(surfRgb[0], surfRgb[1], surfRgb[2]);
        doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
        doc.roundedRect(cardX, startY, colW, colH, 10, 10, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        doc.text(st.step.toUpperCase(), cardX + 16, startY + 32);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        doc.text(st.title, cardX + 16, startY + 60);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        const descLines = doc.splitTextToSize(st.desc, colW - 32);
        doc.text(descLines, cardX + 16, startY + 90);
      });
    }

    // NUMBERS LAYOUT
    else if (slide.layout === "numbers" && slide.numbers && slide.numbers.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(slide.title, 50, 95);

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        doc.text(slide.subtitle, 50, 118);
      }

      const count = Math.min(3, slide.numbers.length);
      const totalAvailableW = PAGE_W - 100;
      const gap = 20;
      const cardW = (totalAvailableW - (count - 1) * gap) / count;
      const cardH = 260;
      const startY = 145;

      slide.numbers.slice(0, count).forEach((num, idx) => {
        const cardX = 50 + idx * (cardW + gap);
        doc.setFillColor(surfRgb[0], surfRgb[1], surfRgb[2]);
        doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
        doc.roundedRect(cardX, startY, cardW, cardH, 12, 12, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(36);
        doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        doc.text(num.value, cardX + 18, startY + 60);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        const labelLines = doc.splitTextToSize(num.label, cardW - 36);
        doc.text(labelLines, cardX + 18, startY + 110);

        if (num.note) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
          const noteLines = doc.splitTextToSize(num.note, cardW - 36);
          doc.text(noteLines, cardX + 18, startY + 160);
        }
      });
    }

    // DEFAULT / BULLETS / TAKEAWAY LAYOUT
    else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.text(slide.title, 50, 95);

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
        doc.text(slide.subtitle, 50, 118);
      }

      const bullets = slide.bullets || [];
      let itemY = 150;
      bullets.slice(0, 4).forEach((b) => {
        doc.setFillColor(surfRgb[0], surfRgb[1], surfRgb[2]);
        doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
        doc.roundedRect(50, itemY, PAGE_W - 100, 52, 8, 8, "FD");

        doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        doc.circle(68, itemY + 26, 4, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(13);
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        doc.text(b, 85, itemY + 31);

        itemY += 68;
      });
    }

    // Footer strip
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
    const footerNotes = slide.speakerNotes ? `Catatan: ${slide.speakerNotes}` : "Const Learn Presentation Engine";
    doc.text(footerNotes, 50, PAGE_H - 25);
    doc.text("16 : 9", PAGE_W - 50, PAGE_H - 25, { align: "right" });
  }

  const safeTitle = deck.title.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_") || "Presentasi_Const_Learn";
  const outName = filename || `${safeTitle}.pdf`;
  doc.save(outName);
}

export async function exportToPptx(deck: SlideDeckData, filename?: string): Promise<void> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = deck.title;
  pptx.subject = deck.topic || "Slide Presentasi Const Learn";

  const theme = getTheme(deck.themeId);
  const BG_COLOR = cleanHex(theme.colors.bg);
  const CARD_COLOR = cleanHex(theme.colors.surface);
  const ACCENT_COLOR = cleanHex(theme.colors.accent);
  const TEXT_COLOR = cleanHex(theme.colors.fg);
  const MUTED_COLOR = cleanHex(theme.colors.fgMuted);
  const BORDER_COLOR = cleanHex(theme.colors.border);

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    if (!slide) continue;

    const s = pptx.addSlide();
    s.background = { color: BG_COLOR };

    // Header strip
    s.addText(deck.title.toUpperCase(), {
      x: 0.8,
      y: 0.35,
      w: 8.5,
      h: 0.35,
      fontSize: 9,
      fontFace: "Arial",
      color: MUTED_COLOR,
      bold: true,
    });

    s.addText(`№ ${slide.slideNumber || i + 1} / ${deck.slides.length}`, {
      x: 9.5,
      y: 0.35,
      w: 3.0,
      h: 0.35,
      fontSize: 9,
      fontFace: "Arial",
      color: MUTED_COLOR,
      align: "right",
    });

    // HERO LAYOUT
    if (slide.layout === "hero") {
      const kicker = slide.accentTag || slide.kicker;
      if (kicker) {
        s.addText(kicker.toUpperCase(), {
          x: 1.0,
          y: 2.0,
          w: 11.3,
          h: 0.4,
          fontSize: 13,
          fontFace: "Arial",
          color: ACCENT_COLOR,
          bold: true,
          align: "center",
        });
      }
      s.addText(slide.title, {
        x: 1.0,
        y: kicker ? 2.5 : 2.2,
        w: 11.3,
        h: 2.2,
        fontSize: 38,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
        align: "center",
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 1.0,
          y: 4.8,
          w: 11.3,
          h: 1.2,
          fontSize: 18,
          fontFace: "Arial",
          color: MUTED_COLOR,
          align: "center",
        });
      }
    }

    // BIG-STAT LAYOUT
    else if (slide.layout === "big-stat") {
      const statVal = slide.statHighlight?.value || slide.numbers?.[0]?.value || "100%";
      const statLabel = slide.statHighlight?.label || slide.numbers?.[0]?.label || slide.title;
      const statCtx = slide.statHighlight?.context || slide.subtitle || (slide.bullets && slide.bullets[0]);

      s.addText(slide.title, {
        x: 0.8,
        y: 0.9,
        w: 11.7,
        h: 0.7,
        fontSize: 24,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });

      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y: 1.8,
        w: 11.7,
        h: 4.8,
        fill: { color: CARD_COLOR },
        line: { color: BORDER_COLOR, width: 1 },
      });

      s.addText(statVal, {
        x: 1.2,
        y: 2.2,
        w: 10.9,
        h: 1.8,
        fontSize: 72,
        fontFace: "Arial",
        color: ACCENT_COLOR,
        bold: true,
      });

      s.addText(statLabel.toUpperCase(), {
        x: 1.2,
        y: 4.1,
        w: 10.9,
        h: 0.7,
        fontSize: 20,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });

      if (statCtx) {
        s.addText(statCtx, {
          x: 1.2,
          y: 4.8,
          w: 10.9,
          h: 1.2,
          fontSize: 14,
          fontFace: "Arial",
          color: MUTED_COLOR,
        });
      }
    }

    // BENTO-GRID LAYOUT
    else if (slide.layout === "bento-grid") {
      s.addText(slide.title, {
        x: 0.8,
        y: 0.8,
        w: 11.7,
        h: 0.7,
        fontSize: 24,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });

      const cards = slide.bentoCards || (slide.bullets || []).map((b, idx) => ({
        title: b.split(":")[0] || `Item 0${idx + 1}`,
        desc: b.split(":")[1] || b,
        badge: `0${idx + 1}`,
      }));

      const colW = 5.6;
      const rowH = 2.2;
      cards.slice(0, 4).forEach((c, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cardX = 0.8 + col * (colW + 0.5);
        const cardY = 1.8 + row * (rowH + 0.4);

        s.addShape(pptx.ShapeType.roundRect, {
          x: cardX,
          y: cardY,
          w: colW,
          h: rowH,
          fill: { color: CARD_COLOR },
          line: { color: BORDER_COLOR, width: 1 },
        });

        s.addText(c.title, {
          x: cardX + 0.3,
          y: cardY + 0.2,
          w: colW - 0.6,
          h: 0.4,
          fontSize: 16,
          fontFace: "Arial",
          color: TEXT_COLOR,
          bold: true,
        });

        s.addText(c.desc, {
          x: cardX + 0.3,
          y: cardY + 0.7,
          w: colW - 0.6,
          h: 1.2,
          fontSize: 12,
          fontFace: "Arial",
          color: MUTED_COLOR,
        });
      });
    }

    // COMPARISON / SPLIT LAYOUT
    else if (slide.layout === "comparison" || slide.layout === "split") {
      s.addText(slide.title, {
        x: 0.8,
        y: 0.8,
        w: 11.7,
        h: 0.7,
        fontSize: 26,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });

      const leftTitle = slide.comparisonDetails?.leftTitle || slide.leftColumn?.title || "Konvensional";
      const leftItems = slide.comparisonDetails?.leftItems || slide.leftColumn?.items || slide.bullets?.slice(0, 3) || [];
      const rightTitle = slide.comparisonDetails?.rightTitle || slide.rightColumn?.title || "Strategi Modern";
      const rightItems = slide.comparisonDetails?.rightItems || slide.rightColumn?.items || slide.bullets?.slice(3) || [];

      // Left Column
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y: 1.8,
        w: 5.6,
        h: 4.8,
        fill: { color: CARD_COLOR },
        line: { color: BORDER_COLOR, width: 1 },
      });
      s.addText(leftTitle, {
        x: 1.1,
        y: 2.1,
        w: 5.0,
        h: 0.5,
        fontSize: 18,
        fontFace: "Arial",
        color: MUTED_COLOR,
        bold: true,
      });
      leftItems.forEach((it, idx) => {
        s.addText(`• ${it}`, {
          x: 1.1,
          y: 2.7 + idx * 0.7,
          w: 5.0,
          h: 0.6,
          fontSize: 13,
          fontFace: "Arial",
          color: TEXT_COLOR,
        });
      });

      // Right Column
      s.addShape(pptx.ShapeType.roundRect, {
        x: 6.9,
        y: 1.8,
        w: 5.6,
        h: 4.8,
        fill: { color: CARD_COLOR },
        line: { color: ACCENT_COLOR, width: 2 },
      });
      s.addText(rightTitle, {
        x: 7.2,
        y: 2.1,
        w: 5.0,
        h: 0.5,
        fontSize: 18,
        fontFace: "Arial",
        color: ACCENT_COLOR,
        bold: true,
      });
      rightItems.forEach((it, idx) => {
        s.addText(`✓ ${it}`, {
          x: 7.2,
          y: 2.7 + idx * 0.7,
          w: 5.0,
          h: 0.6,
          fontSize: 13,
          fontFace: "Arial",
          color: TEXT_COLOR,
        });
      });
    }

    // QUOTE LAYOUT
    else if (slide.layout === "quote") {
      const quoteText = slide.quote?.text || slide.subtitle || slide.title;
      const author = slide.quote?.author || "Prinsip Utama";
      const context = slide.quote?.context || slide.accentTag || "";

      s.addText(`“${quoteText}”`, {
        x: 1.5,
        y: 2.2,
        w: 10.3,
        h: 2.5,
        fontSize: 28,
        fontFace: "Georgia",
        color: TEXT_COLOR,
        italic: true,
        align: "center",
      });

      s.addText(`— ${author}`, {
        x: 1.5,
        y: 4.8,
        w: 10.3,
        h: 0.6,
        fontSize: 16,
        fontFace: "Arial",
        color: ACCENT_COLOR,
        bold: true,
        align: "center",
      });

      if (context) {
        s.addText(context, {
          x: 1.5,
          y: 5.4,
          w: 10.3,
          h: 0.5,
          fontSize: 12,
          fontFace: "Arial",
          color: MUTED_COLOR,
          align: "center",
        });
      }
    }

    // NUMBERS LAYOUT
    else if (slide.layout === "numbers" && slide.numbers && slide.numbers.length > 0) {
      s.addText(slide.title, {
        x: 0.8,
        y: 0.8,
        w: 11.7,
        h: 0.7,
        fontSize: 24,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });

      const count = Math.min(3, slide.numbers.length);
      const cardW = 3.6;
      slide.numbers.slice(0, count).forEach((num, idx) => {
        const xPos = 0.8 + idx * (cardW + 0.4);
        s.addShape(pptx.ShapeType.roundRect, {
          x: xPos,
          y: 1.8,
          w: cardW,
          h: 4.5,
          fill: { color: CARD_COLOR },
          line: { color: BORDER_COLOR, width: 1 },
        });

        s.addText(num.value, {
          x: xPos + 0.3,
          y: 2.2,
          w: cardW - 0.6,
          h: 1.2,
          fontSize: 44,
          fontFace: "Arial",
          color: ACCENT_COLOR,
          bold: true,
        });

        s.addText(num.label, {
          x: xPos + 0.3,
          y: 3.5,
          w: cardW - 0.6,
          h: 0.8,
          fontSize: 16,
          fontFace: "Arial",
          color: TEXT_COLOR,
          bold: true,
        });

        if (num.note) {
          s.addText(num.note, {
            x: xPos + 0.3,
            y: 4.4,
            w: cardW - 0.6,
            h: 1.2,
            fontSize: 12,
            fontFace: "Arial",
            color: MUTED_COLOR,
          });
        }
      });
    }

    // DEFAULT BULLETS / TAKEAWAY
    else {
      s.addText(slide.title, {
        x: 0.8,
        y: 0.8,
        w: 11.7,
        h: 0.7,
        fontSize: 24,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });

      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 1.5,
          w: 11.7,
          h: 0.5,
          fontSize: 14,
          fontFace: "Arial",
          color: MUTED_COLOR,
        });
      }

      (slide.bullets || []).slice(0, 4).forEach((bullet, bIdx) => {
        const yPos = 2.2 + bIdx * 1.1;
        s.addShape(pptx.ShapeType.roundRect, {
          x: 0.8,
          y: yPos,
          w: 11.7,
          h: 0.85,
          fill: { color: CARD_COLOR },
          line: { color: BORDER_COLOR, width: 1 },
        });

        s.addShape(pptx.ShapeType.ellipse, {
          x: 1.1,
          y: yPos + 0.35,
          w: 0.15,
          h: 0.15,
          fill: { color: ACCENT_COLOR },
          line: { color: ACCENT_COLOR },
        });

        s.addText(bullet, {
          x: 1.4,
          y: yPos + 0.15,
          w: 10.8,
          h: 0.55,
          fontSize: 14,
          fontFace: "Arial",
          color: TEXT_COLOR,
        });
      });
    }

    if (slide.speakerNotes) {
      s.addNotes(slide.speakerNotes);
    }
  }

  const safeTitle = deck.title.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_") || "Presentasi_Const_Learn";
  const outName = filename || `${safeTitle}.pptx`;
  await pptx.writeFile({ fileName: outName });
}

export function exportToHtml(deck: SlideDeckData): void {
  const safeTitle = deck.title.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_") || "Presentasi_Const_Learn";
  const slidesJson = JSON.stringify(deck.slides);
  const theme = getTheme(deck.themeId);

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${deck.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      font-family: ${theme.fontBody};
      background: ${theme.colors.bg};
      color: ${theme.colors.fg};
      margin: 0;
    }
    .slide-canvas {
      aspect-ratio: 16 / 9;
      width: 100%;
      max-width: 1100px;
      background: ${theme.colors.bg};
      border-color: ${theme.colors.border};
      border-radius: 20px;
    }
    .theme-card {
      background: ${theme.colors.surface};
      border: 1px solid ${theme.colors.border};
      border-radius: ${theme.borderRadius};
    }
  </style>
</head>
<body class="h-screen w-screen flex flex-col items-center justify-center p-4 select-none">
  <div id="deck-container" class="slide-canvas border p-8 md:p-12 flex flex-col justify-between shadow-2xl relative">
    <div id="deck-header" class="flex items-center justify-between text-xs font-medium tracking-wide uppercase border-b pb-3" style="color: ${theme.colors.fgMuted}; border-color: ${theme.colors.border}80;">
      <span id="deck-title">${deck.title}</span>
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded text-[10px]" style="background: ${theme.colors.accent}20; color: ${theme.colors.accent};">${theme.name}</span>
        <span id="deck-counter" class="font-mono">1 / ${deck.slides.length}</span>
      </div>
    </div>
    <div id="slide-body" class="flex-1 flex flex-col justify-center py-6">
      <!-- Dynamic slide content rendered via script -->
    </div>
    <div id="deck-footer" class="flex items-center justify-between pt-3 border-t text-xs" style="color: ${theme.colors.fgMuted}; border-color: ${theme.colors.border}80;">
      <span>Gunakan ← / → atau Spasi untuk navigasi</span>
      <div class="flex items-center gap-2">
        <button id="btn-prev" class="px-3 py-1.5 rounded-lg border text-white transition-opacity" style="background: ${theme.colors.surface}; border-color: ${theme.colors.border};">Sebelumnya</button>
        <button id="btn-next" class="px-3 py-1.5 rounded-lg font-medium text-black transition-opacity" style="background: ${theme.colors.accent};">Selanjutnya</button>
      </div>
    </div>
  </div>

  <script>
    const slides = ${slidesJson};
    let currentIdx = 0;

    function renderSlide(idx) {
      const s = slides[idx];
      const body = document.getElementById("slide-body");
      document.getElementById("deck-counter").textContent = (idx + 1) + " / " + slides.length;
      
      let html = "";
      if (s.layout === "hero") {
        html = '<div class="text-center space-y-4 max-w-2xl mx-auto">' +
          (s.accentTag || s.kicker ? '<span class="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider" style="background: ${theme.colors.accent}22; color: ${theme.colors.accent}; border: 1px solid ${theme.colors.accent}44;">' + (s.accentTag || s.kicker) + '</span>' : '') +
          '<h1 class="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight" style="color: ${theme.colors.fg};">' + s.title + '</h1>' +
          (s.subtitle ? '<p class="text-base md:text-lg leading-relaxed" style="color: ${theme.colors.fgMuted};">' + s.subtitle + '</p>' : '') +
          '</div>';
      } else if (s.layout === "big-stat") {
        const stat = s.statHighlight || (s.numbers && s.numbers[0]) || { value: "100%", label: s.title };
        html = '<div class="space-y-4">' +
          '<div><h2 class="text-2xl font-bold" style="color: ${theme.colors.fg};">' + s.title + '</h2></div>' +
          '<div class="theme-card p-8">' +
          '<div class="text-6xl md:text-7xl font-black font-mono" style="color: ${theme.colors.accent};">' + stat.value + '</div>' +
          '<div class="text-lg font-bold uppercase tracking-wider mt-2" style="color: ${theme.colors.fg};">' + stat.label + '</div>' +
          (stat.context || s.subtitle ? '<p class="text-sm mt-2 leading-relaxed" style="color: ${theme.colors.fgMuted};">' + (stat.context || s.subtitle) + '</p>' : '') +
          '</div></div>';
      } else if (s.layout === "bento-grid") {
        const cards = s.bentoCards || (s.bullets || []).map((b, i) => ({ title: b.split(":")[0] || ("Poin 0" + (i+1)), desc: b.split(":")[1] || b }));
        html = '<div class="space-y-4">' +
          '<div><h2 class="text-2xl font-bold" style="color: ${theme.colors.fg};">' + s.title + '</h2></div>' +
          '<div class="grid grid-cols-2 gap-3">' +
          cards.slice(0, 4).map(c => '<div class="theme-card p-4 flex flex-col justify-between"><div class="font-semibold text-sm" style="color: ${theme.colors.fg};">' + c.title + '</div><p class="text-xs mt-1" style="color: ${theme.colors.fgMuted};">' + c.desc + '</p></div>').join('') +
          '</div></div>';
      } else if (s.layout === "comparison" || s.layout === "split") {
        const left = s.comparisonDetails ? { title: s.comparisonDetails.leftTitle, items: s.comparisonDetails.leftItems } : (s.leftColumn || { title: "Poin A", items: (s.bullets || []).slice(0, 2) });
        const right = s.comparisonDetails ? { title: s.comparisonDetails.rightTitle, items: s.comparisonDetails.rightItems } : (s.rightColumn || { title: "Poin B", items: (s.bullets || []).slice(2, 4) });
        html = '<div class="space-y-4">' +
          '<div><h2 class="text-2xl font-bold" style="color: ${theme.colors.fg};">' + s.title + '</h2></div>' +
          '<div class="grid grid-cols-2 gap-4">' +
          '<div class="theme-card p-5"><h3 class="text-sm font-semibold mb-3" style="color: ${theme.colors.fgMuted};">' + left.title + '</h3><ul class="space-y-2 text-xs" style="color: ${theme.colors.fgMuted};">' + (left.items || []).map(it => '<li>• ' + it + '</li>').join('') + '</ul></div>' +
          '<div class="theme-card p-5" style="border-color: ${theme.colors.accent}; background: ${theme.colors.accent}14;"><h3 class="text-sm font-semibold mb-3" style="color: ${theme.colors.accent};">' + right.title + '</h3><ul class="space-y-2 text-xs font-medium" style="color: ${theme.colors.fg};">' + (right.items || []).map(it => '<li>✓ ' + it + '</li>').join('') + '</ul></div>' +
          '</div></div>';
      } else if (s.layout === "quote") {
        const q = s.quote || { text: s.subtitle || s.title, author: "Prinsip Utama" };
        html = '<div class="text-center space-y-4 max-w-2xl mx-auto">' +
          '<blockquote class="text-2xl md:text-3xl italic font-medium leading-relaxed" style="color: ${theme.colors.fg};">“' + q.text + '”</blockquote>' +
          '<div class="font-bold text-sm" style="color: ${theme.colors.accent};">— ' + (q.author || "Prinsip Utama") + '</div>' +
          '</div>';
      } else if (s.layout === "numbers" && s.numbers) {
        html = '<div class="space-y-4">' +
          '<div><h2 class="text-2xl font-bold" style="color: ${theme.colors.fg};">' + s.title + '</h2></div>' +
          '<div class="grid grid-cols-' + Math.min(s.numbers.length, 3) + ' gap-3">' +
          s.numbers.slice(0, 3).map(n => '<div class="theme-card p-4"><div class="text-3xl font-black font-mono" style="color: ${theme.colors.accent};">' + n.value + '</div><div class="text-xs font-bold mt-1" style="color: ${theme.colors.fg};">' + n.label + '</div>' + (n.note ? '<div class="text-[10px] mt-1" style="color: ${theme.colors.fgMuted};">' + n.note + '</div>' : '') + '</div>').join('') +
          '</div></div>';
      } else {
        html = '<div class="space-y-4">' +
          '<div><h2 class="text-2xl font-bold" style="color: ${theme.colors.fg};">' + s.title + '</h2>' +
          (s.subtitle ? '<p class="text-xs mt-1" style="color: ${theme.colors.fgMuted};">' + s.subtitle + '</p>' : '') + '</div>' +
          '<div class="space-y-2">' +
          (s.bullets || []).slice(0, 4).map(b => '<div class="theme-card p-3 text-xs font-medium flex items-center gap-3" style="color: ${theme.colors.fg};"><span class="h-2 w-2 rounded-full shrink-0" style="background: ${theme.colors.accent};"></span><span>' + b + '</span></div>').join('') +
          '</div></div>';
      }
      body.innerHTML = html;
    }

    document.getElementById("btn-prev").onclick = () => { if (currentIdx > 0) { currentIdx--; renderSlide(currentIdx); } };
    document.getElementById("btn-next").onclick = () => { if (currentIdx < slides.length - 1) { currentIdx++; renderSlide(currentIdx); } };
    window.onkeydown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "PageUp") { if (currentIdx > 0) { currentIdx--; renderSlide(currentIdx); } }
      else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { if (currentIdx < slides.length - 1) { currentIdx++; renderSlide(currentIdx); } }
    };

    renderSlide(0);
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeTitle}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
