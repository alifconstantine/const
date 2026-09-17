import pptxgen from "pptxgenjs";
import { jsPDF } from "jspdf";
import type { SlideDeckData } from "../db";

export async function exportToPdf(deck: SlideDeckData, filename?: string): Promise<void> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [960, 540],
  });

  const PAGE_W = 960;
  const PAGE_H = 540;

  for (let i = 0; i < deck.slides.length; i++) {
    if (i > 0) {
      doc.addPage([PAGE_W, PAGE_H], "landscape");
    }

    const slide = deck.slides[i];
    if (!slide) continue;

    // Dark canvas background (#161616)
    doc.setFillColor(22, 22, 22);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    // Header strip
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(deck.title.toUpperCase(), 50, 42);

    const counterText = `№ ${slide.slideNumber || i + 1} / ${deck.slides.length}`;
    doc.text(counterText, PAGE_W - 50, 42, { align: "right" });

    // Subtle header divider
    doc.setDrawColor(56, 56, 56);
    doc.setLineWidth(0.75);
    doc.line(50, 52, PAGE_W - 50, 52);

    if (slide.layout === "hero") {
      let yPos = 210;
      if (slide.accentTag) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(56, 189, 248);
        doc.text(slide.accentTag.toUpperCase(), PAGE_W / 2, yPos, { align: "center" });
        yPos += 28;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(30);
      doc.setTextColor(255, 255, 255);
      const titleLines = doc.splitTextToSize(slide.title, 750);
      doc.text(titleLines, PAGE_W / 2, yPos, { align: "center" });
      yPos += titleLines.length * 34 + 10;

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.setTextColor(160, 160, 160);
        const subLines = doc.splitTextToSize(slide.subtitle, 700);
        doc.text(subLines, PAGE_W / 2, yPos, { align: "center" });
      }
    } else if (slide.layout === "numbers" && slide.numbers && slide.numbers.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(slide.title, 50, 95);

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(160, 160, 160);
        doc.text(slide.subtitle, 50, 118);
      }

      const count = Math.min(4, slide.numbers.length);
      const totalAvailableW = PAGE_W - 100;
      const gap = 18;
      const cardW = (totalAvailableW - (count - 1) * gap) / count;
      const cardH = 260;
      const startY = 145;

      slide.numbers.slice(0, count).forEach((num, idx) => {
        const cardX = 50 + idx * (cardW + gap);
        doc.setFillColor(34, 34, 34);
        doc.setDrawColor(56, 56, 56);
        doc.roundedRect(cardX, startY, cardW, cardH, 12, 12, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(32);
        doc.setTextColor(56, 189, 248);
        doc.text(num.value, cardX + 18, startY + 55);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(255, 255, 255);
        const labelLines = doc.splitTextToSize(num.label, cardW - 36);
        doc.text(labelLines, cardX + 18, startY + 100);

        if (num.note) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          const noteLines = doc.splitTextToSize(num.note, cardW - 36);
          doc.text(noteLines, cardX + 18, startY + 145);
        }
      });
    } else if (slide.layout === "split" || slide.layout === "comparison") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(slide.title, 50, 95);

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(160, 160, 160);
        doc.text(slide.subtitle, 50, 118);
      }

      // Left Column
      const leftCol = slide.leftColumn || { title: deck.language === "en" ? "Pillar A" : "Pilar A", items: slide.bullets?.slice(0, 3) || [] };
      const colW = (PAGE_W - 120) / 2;
      const colH = 260;
      const startY = 150;

      doc.setFillColor(34, 34, 34);
      doc.setDrawColor(56, 56, 56);
      doc.roundedRect(50, startY, colW, colH, 12, 12, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(56, 189, 248);
      doc.text(leftCol.title || (deck.language === "en" ? "Pillar A" : "Pilar A"), 70, startY + 30);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11.5);
      doc.setTextColor(220, 220, 220);
      let leftItemY = startY + 60;
      (leftCol.items || []).forEach((it) => {
        const itLines = doc.splitTextToSize(`•  ${it}`, colW - 40);
        doc.text(itLines, 70, leftItemY);
        leftItemY += itLines.length * 16 + 10;
      });

      // Right Column
      const rightCol = slide.rightColumn || { title: deck.language === "en" ? "Pillar B" : "Pilar B", items: slide.bullets?.slice(3) || [] };
      const rightX = 50 + colW + 20;
      doc.setFillColor(34, 34, 34);
      doc.setDrawColor(56, 56, 56);
      doc.roundedRect(rightX, startY, colW, colH, 12, 12, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(253, 224, 71);
      doc.text(rightCol.title || (deck.language === "en" ? "Pillar B" : "Pilar B"), rightX + 20, startY + 30);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11.5);
      doc.setTextColor(220, 220, 220);
      let rightItemY = startY + 60;
      (rightCol.items || []).forEach((it) => {
        const itLines = doc.splitTextToSize(`•  ${it}`, colW - 40);
        doc.text(itLines, rightX + 20, rightItemY);
        rightItemY += itLines.length * 16 + 10;
      });
    } else {
      // Bullets / Default Layout
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text(slide.title, 50, 95);

      if (slide.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(13);
        doc.setTextColor(160, 160, 160);
        doc.text(slide.subtitle, 50, 120);
      }

      const bullets = slide.bullets || [];
      const itemW = PAGE_W - 100;
      let bulletY = 145;

      bullets.slice(0, 5).forEach((b) => {
        doc.setFillColor(34, 34, 34);
        doc.setDrawColor(56, 56, 56);
        doc.roundedRect(50, bulletY, itemW, 44, 8, 8, "FD");

        doc.setFillColor(56, 189, 248);
        doc.circle(70, bulletY + 23, 3.5, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11.5);
        doc.setTextColor(240, 240, 240);
        const bLines = doc.splitTextToSize(b, itemW - 50);
        doc.text(bLines, 84, bulletY + 27);

        bulletY += 54;
      });
    }

    // Footer line & text
    doc.setDrawColor(56, 56, 56);
    doc.line(50, PAGE_H - 42, PAGE_W - 50, PAGE_H - 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    const noteText = slide.speakerNotes
      ? (deck.language === "en" ? `Notes: ${slide.speakerNotes}` : `Catatan: ${slide.speakerNotes}`)
      : "Const Learn Presentation";
    doc.text(noteText.slice(0, 90), 50, PAGE_H - 26);
    doc.text("16 : 9", PAGE_W - 50, PAGE_H - 26, { align: "right" });
  }

  const safeTitle = deck.title.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_") || (deck.language === "en" ? "Const_Learn_Presentation" : "Presentasi_Const_Learn");
  const outName = filename || `${safeTitle}.pdf`;
  doc.save(outName);
}

export async function exportToPptx(deck: SlideDeckData, filename?: string): Promise<void> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Const Learn";
  pptx.company = "Const Platform";
  pptx.title = deck.title;

  // Dark studio theme matching DESIGN.md
  const BG_COLOR = "161616";
  const CARD_COLOR = "222222";
  const TEXT_COLOR = "FFFFFF";
  const MUTED_COLOR = "969696";
  const ACCENT_COLOR = "0066FF";

  for (const slide of deck.slides) {
    const s = pptx.addSlide();
    s.background = { color: BG_COLOR };

    // Header metadata
    s.addText(deck.title.toUpperCase(), {
      x: 0.8,
      y: 0.4,
      w: 8.0,
      h: 0.3,
      fontSize: 10,
      fontFace: "Arial",
      color: MUTED_COLOR,
      bold: true,
    });

    s.addText(`№ ${slide.slideNumber} / ${deck.slides.length}`, {
      x: 10.5,
      y: 0.4,
      w: 2.0,
      h: 0.3,
      fontSize: 10,
      fontFace: "Arial",
      color: MUTED_COLOR,
      align: "right",
      bold: true,
    });

    if (slide.layout === "hero") {
      if (slide.accentTag) {
        s.addText(slide.accentTag.toUpperCase(), {
          x: 1.0,
          y: 2.2,
          w: 11.3,
          h: 0.4,
          fontSize: 13,
          fontFace: "Arial",
          color: ACCENT_COLOR,
          bold: true,
        });
      }
      s.addText(slide.title, {
        x: 1.0,
        y: 2.7,
        w: 11.3,
        h: 2.0,
        fontSize: 38,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
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
        });
      }
    } else if (slide.layout === "numbers" && slide.numbers && slide.numbers.length > 0) {
      s.addText(slide.title, {
        x: 0.8,
        y: 0.9,
        w: 11.7,
        h: 0.8,
        fontSize: 26,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 1.7,
          w: 11.7,
          h: 0.5,
          fontSize: 14,
          fontFace: "Arial",
          color: MUTED_COLOR,
        });
      }

      const count = Math.min(4, slide.numbers.length);
      const cardWidth = Math.min(3.6, 11.5 / count);
      slide.numbers.slice(0, count).forEach((num, idx) => {
        const xPos = 0.8 + idx * (cardWidth + 0.3);
        s.addShape(pptx.ShapeType.rect, {
          x: xPos,
          y: 2.4,
          w: cardWidth,
          h: 4.0,
          fill: { color: CARD_COLOR },
          line: { color: "383838", width: 1 },
        });
        s.addText(num.value, {
          x: xPos + 0.2,
          y: 2.7,
          w: cardWidth - 0.4,
          h: 1.0,
          fontSize: 36,
          fontFace: "Arial",
          color: ACCENT_COLOR,
          bold: true,
        });
        s.addText(num.label, {
          x: xPos + 0.2,
          y: 3.8,
          w: cardWidth - 0.4,
          h: 0.9,
          fontSize: 16,
          fontFace: "Arial",
          color: TEXT_COLOR,
          bold: true,
        });
        if (num.note) {
          s.addText(num.note, {
            x: xPos + 0.2,
            y: 4.8,
            w: cardWidth - 0.4,
            h: 1.0,
            fontSize: 12,
            fontFace: "Arial",
            color: MUTED_COLOR,
          });
        }
      });
    } else if (slide.layout === "split" || slide.layout === "comparison") {
      s.addText(slide.title, {
        x: 0.8,
        y: 0.9,
        w: 11.7,
        h: 0.8,
        fontSize: 26,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 1.7,
          w: 11.7,
          h: 0.5,
          fontSize: 14,
          fontFace: "Arial",
          color: MUTED_COLOR,
        });
      }

      const leftCol = slide.leftColumn || { title: "Pilar A", items: slide.bullets?.slice(0, 3) || [] };
      s.addShape(pptx.ShapeType.rect, {
        x: 0.8,
        y: 2.4,
        w: 5.6,
        h: 4.2,
        fill: { color: CARD_COLOR },
        line: { color: "383838", width: 1 },
      });
      if (leftCol.title) {
        s.addText(leftCol.title, {
          x: 1.1,
          y: 2.7,
          w: 5.0,
          h: 0.5,
          fontSize: 18,
          fontFace: "Arial",
          color: ACCENT_COLOR,
          bold: true,
        });
      }
      (leftCol.items || []).forEach((it, itIdx) => {
        s.addText(`• ${it}`, {
          x: 1.1,
          y: 3.3 + itIdx * 0.7,
          w: 5.0,
          h: 0.6,
          fontSize: 14,
          fontFace: "Arial",
          color: TEXT_COLOR,
        });
      });

      const rightCol = slide.rightColumn || { title: "Pilar B", items: slide.bullets?.slice(3) || [] };
      s.addShape(pptx.ShapeType.rect, {
        x: 6.8,
        y: 2.4,
        w: 5.6,
        h: 4.2,
        fill: { color: CARD_COLOR },
        line: { color: "383838", width: 1 },
      });
      if (rightCol.title) {
        s.addText(rightCol.title, {
          x: 7.1,
          y: 2.7,
          w: 5.0,
          h: 0.5,
          fontSize: 18,
          fontFace: "Arial",
          color: ACCENT_COLOR,
          bold: true,
        });
      }
      (rightCol.items || []).forEach((it, itIdx) => {
        s.addText(`• ${it}`, {
          x: 7.1,
          y: 3.3 + itIdx * 0.7,
          w: 5.0,
          h: 0.6,
          fontSize: 14,
          fontFace: "Arial",
          color: TEXT_COLOR,
        });
      });
    } else {
      // Bullets / Quote / Takeaway
      s.addText(slide.title, {
        x: 0.8,
        y: 0.9,
        w: 11.7,
        h: 0.8,
        fontSize: 26,
        fontFace: "Arial",
        color: TEXT_COLOR,
        bold: true,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 1.7,
          w: 11.7,
          h: 0.5,
          fontSize: 14,
          fontFace: "Arial",
          color: MUTED_COLOR,
        });
      }

      const bullets = slide.bullets || [];
      bullets.forEach((b, bIdx) => {
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8,
          y: 2.4 + bIdx * 0.95,
          w: 11.7,
          h: 0.75,
          fill: { color: CARD_COLOR },
          line: { color: "383838", width: 1 },
        });
        s.addText(b, {
          x: 1.1,
          y: 2.45 + bIdx * 0.95,
          w: 11.2,
          h: 0.65,
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

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${deck.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #161616; color: #ffffff; margin: 0; }
    .slide-canvas { aspect-ratio: 16 / 9; width: 100%; max-width: 1200px; }
  </style>
</head>
<body class="h-screen w-screen flex flex-col items-center justify-center p-4 bg-[#161616] select-none">
  <div id="deck-container" class="slide-canvas rounded-2xl bg-[#222222] border border-[#383838] p-8 md:p-12 flex flex-col justify-between shadow-2xl relative">
    <div id="deck-header" class="flex items-center justify-between text-xs text-[#969696] font-medium tracking-wide border-b border-white/10 pb-3">
      <span id="deck-title">${deck.title}</span>
      <span id="deck-counter">1 / ${deck.slides.length}</span>
    </div>
    <div id="slide-body" class="flex-1 flex flex-col justify-center py-6">
      <!-- Dynamic slide content will be rendered here -->
    </div>
    <div id="deck-footer" class="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-[#969696]">
      <span>Tekan ← / → atau Spasi untuk berpindah slide</span>
      <div class="flex items-center gap-2">
        <button id="btn-prev" class="px-3 py-1.5 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-white">Sebelumnya</button>
        <button id="btn-next" class="px-3 py-1.5 rounded-lg bg-[#0066ff] hover:bg-[#0055dd] text-white font-medium">Selanjutnya</button>
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
        html = '<div class="text-center space-y-4">' +
          (s.accentTag ? '<span class="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">' + s.accentTag + '</span>' : '') +
          '<h1 class="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">' + s.title + '</h1>' +
          (s.subtitle ? '<p class="text-lg md:text-xl text-[#969696] max-w-2xl mx-auto">' + s.subtitle + '</p>' : '') +
          '</div>';
      } else if (s.layout === "numbers" && s.numbers) {
        html = '<div class="space-y-6">' +
          '<div><h2 class="text-2xl md:text-3xl font-bold text-white">' + s.title + '</h2>' +
          (s.subtitle ? '<p class="text-sm text-[#969696] mt-1">' + s.subtitle + '</p>' : '') + '</div>' +
          '<div class="grid grid-cols-1 md:grid-cols-' + Math.min(s.numbers.length, 3) + ' gap-4">' +
          s.numbers.map(n => '<div class="p-5 rounded-xl bg-[#2b2b2b] border border-[#383838]"><div class="text-3xl font-black text-[#0066ff]">' + n.value + '</div><div class="text-sm font-semibold text-white mt-1">' + n.label + '</div>' + (n.note ? '<div class="text-xs text-[#969696] mt-1">' + n.note + '</div>' : '') + '</div>').join('') +
          '</div></div>';
      } else if (s.layout === "split" || s.layout === "comparison") {
        const left = s.leftColumn || { title: "Poin A", items: (s.bullets || []).slice(0, 3) };
        const right = s.rightColumn || { title: "Poin B", items: (s.bullets || []).slice(3) };
        html = '<div class="space-y-6">' +
          '<div><h2 class="text-2xl md:text-3xl font-bold text-white">' + s.title + '</h2>' +
          (s.subtitle ? '<p class="text-sm text-[#969696] mt-1">' + s.subtitle + '</p>' : '') + '</div>' +
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
          '<div class="p-5 rounded-xl bg-[#2b2b2b] border border-[#383838]"><h3 class="text-base font-semibold text-[#0066ff] mb-3">' + (left.title || '') + '</h3><ul class="space-y-2 text-sm text-[#d4d4d4]">' + (left.items || []).map(it => '<li>• ' + it + '</li>').join('') + '</ul></div>' +
          '<div class="p-5 rounded-xl bg-[#2b2b2b] border border-[#383838]"><h3 class="text-base font-semibold text-[#0066ff] mb-3">' + (right.title || '') + '</h3><ul class="space-y-2 text-sm text-[#d4d4d4]">' + (right.items || []).map(it => '<li>• ' + it + '</li>').join('') + '</ul></div>' +
          '</div></div>';
      } else {
        html = '<div class="space-y-6">' +
          '<div><h2 class="text-2xl md:text-3xl font-bold text-white">' + s.title + '</h2>' +
          (s.subtitle ? '<p class="text-sm text-[#969696] mt-1">' + s.subtitle + '</p>' : '') + '</div>' +
          '<div class="space-y-3">' +
          (s.bullets || []).map(b => '<div class="p-3.5 rounded-xl bg-[#2b2b2b] border border-[#383838] text-sm text-[#ffffff] font-medium flex items-center gap-3"><div class="h-2 w-2 rounded-full bg-[#0066ff] shrink-0"></div><span>' + b + '</span></div>').join('') +
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
