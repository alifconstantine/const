import type { VideoSummaryData, VideoSummaryScene } from "../db";

/**
 * Utility to encode an AudioBuffer into a standard 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // SubChunk1Size (16 for PCM)
  setUint16(1); // AudioFormat (1 for PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // Byte rate
  setUint16(numOfChan * 2); // Block align
  setUint16(16); // Bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      const sample = Math.max(-1, Math.min(1, channels[i]![offset]!));
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      out.setInt16(pos, intSample | 0, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: "audio/wav" });
}

/**
 * Convert Blob to Base64 data URL
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Measure audio duration from URL with fallback
 */
export async function getAudioDuration(url: string, fallbackSeconds = 5): Promise<number> {
  if (typeof window === "undefined" || !url) return fallbackSeconds;
  return new Promise<number>((resolve) => {
    const audio = new Audio();
    let resolved = false;

    const finalize = (dur: number) => {
      if (!resolved) {
        resolved = true;
        resolve(dur > 0.5 ? dur : fallbackSeconds);
      }
    };

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        finalize(audio.duration);
      } else {
        finalize(fallbackSeconds);
      }
    };

    audio.onerror = () => finalize(fallbackSeconds);
    setTimeout(() => finalize(fallbackSeconds), 4000);
    audio.src = url;
  });
}

/**
 * Build a complete, valid HyperFrames HTML composition string.
 * Adheres strictly to the HyperFrames Core and Animation specifications:
 * - Deterministic layout and timing
 * - Studio Monochrome aesthetic (#161616 canvas, #222222 panels, #ffffff crisp reading ink)
 * - data-* timing attributes (data-composition-id="root", data-start, data-duration, class="clip")
 * - Seekable GSAP timeline registered to window.__timelines["root"]
 * - Animation targets children inside .clip, NEVER .clip itself!
 */
export function buildHyperframesHtml(data: VideoSummaryData): string {
  const {
    title = "Video Summary",
    scenes = [],
    totalDurationSeconds = 30,
    combinedAudioBase64,
    combinedAudioUrl,
    masterAudioRelative,
    theme,
  } = data;

  const audioSrc = masterAudioRelative || "audio/full_narration.mp3";

  const primaryColor = theme?.primaryColor || "#38bdf8";
  const secondaryColor = theme?.secondaryColor || "#818cf8";
  const backgroundColor = theme?.backgroundColor || "#060913";
  const accentColor = theme?.accentColor || "#00f0ff";
  const textColor = theme?.textColor || "#f1f5f9";
  const fontHeading = theme?.fontHeading || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const fontBody = theme?.fontBody || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  let currentTime = 0;
  const scenesHtml: string[] = [];
  const gsapTimelineSteps: string[] = [];

  scenes.forEach((scene: VideoSummaryScene, index: number) => {
    const sceneStart = currentTime;
    const sceneDuration = Math.max(3.5, scene.durationSeconds || 5.0);
    const sceneNum = index + 1;
    const sceneId = `scene-${sceneNum}`;
    const contentId = `sc${sceneNum}-content`;
    currentTime += sceneDuration;

    const archetype = scene.archetype || scene.layout || "cards";
    const points: string[] = scene.keypoints || scene.bullets || [];
    const vData = scene.visualData || {};

    let innerHtml = "";

    if (archetype === "hero") {
      innerHtml = `
        <div class="scene-content hero-content" id="${contentId}">
          <div class="brand-badge" id="sc${sceneNum}-badge">
            <span class="pulse-dot"></span>
            ${escapeHtml(scene.subtitle || "Materi Pembelajaran")}
          </div>
          <h1 class="title-hero" id="sc${sceneNum}-title">${escapeHtml(scene.title)}</h1>
          <p class="subtitle" id="sc${sceneNum}-sub">
            ${escapeHtml(scene.narrationText?.slice(0, 180) || points[0] || "")}
          </p>
          <div class="cards-row" id="sc${sceneNum}-cards">
            ${(vData.cards && vData.cards.length > 0 ? vData.cards : points.map((p: string, i: number) => ({ title: `Konsep ${i + 1}`, desc: p }))).slice(0, 3).map((card: any, cIdx: number) => `
              <div class="glass-card ${cIdx === 1 ? "highlight" : ""}">
                <div class="card-tag">Poin ${cIdx + 1}</div>
                <div class="card-title">${escapeHtml(card.title)}</div>
                <p class="card-desc">${escapeHtml(card.desc)}</p>
                ${card.metric ? `
                  <div class="metric-badge">
                    <span class="metric-label">Sorotan</span>
                    <span class="metric-val">${escapeHtml(card.metric)}</span>
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      `;

      gsapTimelineSteps.push(`
        tl.fromTo("#sc${sceneNum}-badge", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, ${(sceneStart + 0.3).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-title", { opacity: 0, scale: 0.94, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "power3.out" }, ${(sceneStart + 0.6).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-sub", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, ${(sceneStart + 1.0).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-cards .glass-card", { opacity: 0, y: 35 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.2, ease: "power2.out" }, ${(sceneStart + 1.4).toFixed(2)});
      `);
    } else if (archetype === "flow_diagram") {
      const steps = vData.steps && vData.steps.length > 0 ? vData.steps : points.map((p: string, i: number) => ({ label: `Tahap ${i + 1}`, desc: p }));
      innerHtml = `
        <div class="scene-content diagram-content" id="${contentId}">
          <div class="card-tag" id="sc${sceneNum}-badge">${escapeHtml(scene.subtitle || "Alur Arsitektur & Proses")}</div>
          <h2 class="title-hero scene-h2" id="sc${sceneNum}-title">${escapeHtml(scene.title)}</h2>
          <div class="arch-flow" id="sc${sceneNum}-flow">
            ${steps.slice(0, 3).map((step: any, sIdx: number) => `
              <div class="arch-box ${sIdx === 0 ? "encoder" : sIdx === 1 ? "decoder" : ""}">
                <div class="card-tag">Langkah ${sIdx + 1}</div>
                <div class="card-title">${escapeHtml(step.label)}</div>
                <p class="card-desc">${escapeHtml(step.desc)}</p>
                ${step.tag ? `<div class="metric-badge"><span class="metric-label">Status</span><span class="metric-val green">${escapeHtml(step.tag)}</span></div>` : ""}
              </div>
              ${sIdx < Math.min(steps.length, 3) - 1 ? `
                <div class="arch-arrow">
                  <div class="arrow-text">Alur Proses</div>
                  <div class="arrow-line"></div>
                </div>
              ` : ""}
            `).join("")}
          </div>
        </div>
      `;

      gsapTimelineSteps.push(`
        tl.fromTo("#sc${sceneNum}-badge", { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${(sceneStart + 0.2).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-title", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ${(sceneStart + 0.5).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-flow .arch-box", { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.25, ease: "power2.out" }, ${(sceneStart + 1.0).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-flow .arch-arrow", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.2, ease: "back.out(1.5)" }, ${(sceneStart + 1.4).toFixed(2)});
      `);
    } else if (archetype === "comparison") {
      const cmp = vData.comparison || scene.comparison || {
        leftTitle: "Pendekatan Konvensional",
        leftItems: points.slice(0, 2),
        rightTitle: "Pendekatan Modern",
        rightItems: points.slice(2, 4),
      };

      innerHtml = `
        <div class="scene-content comp-content" id="${contentId}">
          <div class="card-tag" id="sc${sceneNum}-badge">${escapeHtml(scene.subtitle || "Perbandingan & Analisis")}</div>
          <h2 class="title-hero scene-h2" id="sc${sceneNum}-title">${escapeHtml(scene.title)}</h2>
          <div class="comp-table" id="sc${sceneNum}-table">
            <div class="comp-row header">
              <div class="col-model">${escapeHtml(cmp.leftTitle || "Aspek A")}</div>
              <div class="col-comp">${escapeHtml(cmp.rightTitle || "Aspek B")}</div>
            </div>
            ${(cmp.leftItems || []).map((item: string, rIdx: number) => `
              <div class="comp-row ${rIdx === 0 ? "featured" : ""}">
                <div class="col-model">${escapeHtml(item)}</div>
                <div class="col-comp" style="color: #00f0ff; font-weight: 600;">${escapeHtml(cmp.rightItems?.[rIdx] || "Optimal")}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `;

      gsapTimelineSteps.push(`
        tl.fromTo("#sc${sceneNum}-badge", { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${(sceneStart + 0.2).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-title", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ${(sceneStart + 0.5).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-table .comp-row", { opacity: 0, x: -25 }, { opacity: 1, x: 0, duration: 0.6, stagger: 0.18, ease: "power2.out" }, ${(sceneStart + 0.9).toFixed(2)});
      `);
    } else if (archetype === "metrics") {
      const metricList = vData.metrics || [
        { value: scene.statHighlight?.value || "100%", label: scene.statHighlight?.label || scene.title, desc: scene.statHighlight?.context || points[0] || "" },
        ...(points.slice(1, 4).map((p: string, i: number) => ({ value: `0${i + 2}`, label: `Metrik ${i + 2}`, desc: p }))),
      ];

      innerHtml = `
        <div class="scene-content metrics-content" id="${contentId}">
          <div class="card-tag" id="sc${sceneNum}-badge">${escapeHtml(scene.subtitle || "Hasil & Pencapaian")}</div>
          <h2 class="title-hero scene-h2" id="sc${sceneNum}-title">${escapeHtml(scene.title)}</h2>
          <div class="bench-grid" id="sc${sceneNum}-grid">
            ${metricList.slice(0, 4).map((m: any, mIdx: number) => `
              <div class="bench-card">
                <div class="bench-badge">${escapeHtml(m.badge || `Metrik ${mIdx + 1}`)}</div>
                <div class="bench-score">${escapeHtml(m.value)}</div>
                <div class="bench-title">${escapeHtml(m.label)}</div>
                <p class="bench-desc">${escapeHtml(m.desc || "")}</p>
              </div>
            `).join("")}
          </div>
        </div>
      `;

      gsapTimelineSteps.push(`
        tl.fromTo("#sc${sceneNum}-badge", { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${(sceneStart + 0.2).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-title", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ${(sceneStart + 0.5).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-grid .bench-card", { opacity: 0, y: 35, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.15, ease: "back.out(1.2)" }, ${(sceneStart + 0.9).toFixed(2)});
      `);
    } else if (archetype === "takeaway") {
      const takeaways = vData.takeaways || points;
      innerHtml = `
        <div class="scene-content takeaway-content" id="${contentId}">
          <div class="brand-badge" id="sc${sceneNum}-badge">
            <span class="pulse-dot"></span>
            ${escapeHtml(scene.subtitle || "Kesimpulan & Takeaways")}
          </div>
          <h2 class="title-hero scene-h2" id="sc${sceneNum}-title">${escapeHtml(scene.title)}</h2>
          <div class="takeaway-card" id="sc${sceneNum}-card">
            ${takeaways.map((t: string) => `
              <div class="takeaway-item">
                <div class="bullet-dot"></div>
                <span>${escapeHtml(t)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;

      gsapTimelineSteps.push(`
        tl.fromTo("#sc${sceneNum}-badge", { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${(sceneStart + 0.2).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-title", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ${(sceneStart + 0.5).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-card .takeaway-item", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.6, stagger: 0.18, ease: "power2.out" }, ${(sceneStart + 0.9).toFixed(2)});
      `);
    } else {
      // Default: concept cards
      const cards = vData.cards || points.map((p: string, i: number) => ({ title: `Gagasan ${i + 1}`, desc: p }));
      innerHtml = `
        <div class="scene-content cards-content" id="${contentId}">
          <div class="card-tag" id="sc${sceneNum}-badge">${escapeHtml(scene.subtitle || "Pendalaman Konsep")}</div>
          <h2 class="title-hero scene-h2" id="sc${sceneNum}-title">${escapeHtml(scene.title)}</h2>
          <div class="cards-row" id="sc${sceneNum}-cards">
            ${cards.slice(0, 3).map((card: any, cIdx: number) => `
              <div class="glass-card ${cIdx === 1 ? "highlight" : ""}">
                <div class="card-tag">Bagian ${cIdx + 1}</div>
                <div class="card-title">${escapeHtml(card.title)}</div>
                <p class="card-desc">${escapeHtml(card.desc)}</p>
              </div>
            `).join("")}
          </div>
        </div>
      `;

      gsapTimelineSteps.push(`
        tl.fromTo("#sc${sceneNum}-badge", { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${(sceneStart + 0.2).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-title", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ${(sceneStart + 0.5).toFixed(2)});
        tl.fromTo("#sc${sceneNum}-cards .glass-card", { opacity: 0, y: 35 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.2, ease: "power2.out" }, ${(sceneStart + 0.9).toFixed(2)});
      `);
    }

    // Soft exit fade before next scene
    gsapTimelineSteps.push(`
      tl.to("#${contentId}", { opacity: 0, y: -15, duration: 0.45, ease: "power2.in" }, ${(sceneStart + sceneDuration - 0.5).toFixed(2)});
    `);

    scenesHtml.push(`
      <!-- Scene ${sceneNum}: ${escapeHtml(scene.title)} -->
      <div id="${sceneId}" class="clip" data-start="${sceneStart.toFixed(2)}" data-duration="${sceneDuration.toFixed(2)}">
        ${innerHtml}
      </div>
    `);
  });

  const totalDuration = Math.max(currentTime, totalDurationSeconds || 10).toFixed(2);

  return `<!doctype html>
<html lang="${data.language === "en" ? "en" : "id"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>${escapeHtml(title)}</title>
    <!-- GSAP Master Runtime for HyperFrames seekable determinism -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      :root {
        --primary: ${primaryColor};
        --secondary: ${secondaryColor};
        --bg: ${backgroundColor};
        --accent: ${accentColor};
        --text: ${textColor};
        --font-heading: ${fontHeading};
        --font-body: ${fontBody};
      }
      *, *::before, *::after {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background-color: var(--bg);
        font-family: var(--font-body);
        color: var(--text);
        -webkit-font-smoothing: antialiased;
      }
      #root {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: radial-gradient(circle at 50% 15%, color-mix(in srgb, var(--primary) 22%, var(--bg)) 0%, var(--bg) 75%);
      }

      /* Ambient Background Layer */
      .bg-grid {
        position: absolute;
        inset: 0;
        background-image: 
          linear-gradient(to right, color-mix(in srgb, var(--primary) 7%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in srgb, var(--primary) 7%, transparent) 1px, transparent 1px);
        background-size: 60px 60px;
        pointer-events: none;
      }
      .ambient-glow-1 {
        position: absolute;
        top: -150px;
        left: 20%;
        width: 700px;
        height: 700px;
        background: radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%);
        border-radius: 50%;
        filter: blur(80px);
        pointer-events: none;
      }
      .ambient-glow-2 {
        position: absolute;
        bottom: -150px;
        right: 15%;
        width: 650px;
        height: 650px;
        background: radial-gradient(circle, color-mix(in srgb, var(--secondary) 14%, transparent) 0%, transparent 70%);
        border-radius: 50%;
        filter: blur(80px);
        pointer-events: none;
      }

      /* Top Persistent Nav */
      .top-nav {
        position: absolute;
        top: 40px;
        left: 80px;
        right: 80px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 50;
      }
      .brand-badge {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 8px 18px;
        background: color-mix(in srgb, var(--accent) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
        border-radius: 9999px;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 2px;
        color: var(--accent);
        text-transform: uppercase;
      }
      .pulse-dot {
        width: 8px;
        height: 8px;
        background: var(--accent);
        border-radius: 50%;
        box-shadow: 0 0 10px var(--accent);
      }
      .header-tag {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 1.5px;
        color: #94a3b8;
        text-transform: uppercase;
      }

      /* Clip & Scene Containers */
      .clip {
        position: absolute;
        inset: 0;
        width: 1920px;
        height: 1080px;
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 60px 100px;
      }
      .scene-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 1600px;
      }

      /* Typography */
      .title-hero {
        font-size: 68px;
        font-weight: 800;
        line-height: 1.1;
        letter-spacing: -1.5px;
        text-align: center;
        font-family: var(--font-heading);
        background: linear-gradient(135deg, #ffffff 30%, var(--primary) 70%, var(--accent) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 20px;
      }
      .scene-h2 {
        font-size: 54px;
        font-family: var(--font-heading);
      }
      .subtitle {
        font-size: 26px;
        font-weight: 400;
        color: #94a3b8;
        text-align: center;
        max-width: 1100px;
        line-height: 1.5;
        margin-bottom: 48px;
      }

      /* Cards & Containers */
      .cards-row {
        display: flex;
        gap: 28px;
        width: 100%;
        max-width: 1540px;
        justify-content: center;
      }
      .glass-card {
        background: color-mix(in srgb, var(--bg) 85%, #000000);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(16px);
        border-radius: 20px;
        padding: 32px 36px;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .glass-card.highlight {
        border-color: color-mix(in srgb, var(--accent) 40%, transparent);
        background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 18%, var(--bg)) 0%, color-mix(in srgb, var(--primary) 6%, var(--bg)) 100%);
        box-shadow: 0 20px 50px -10px color-mix(in srgb, var(--accent) 20%, transparent);
      }
      .card-tag {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: var(--primary);
        margin-bottom: 12px;
      }
      .card-title {
        font-size: 24px;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 12px;
      }
      .card-desc {
        font-size: 16px;
        color: #94a3b8;
        line-height: 1.6;
        margin-bottom: 20px;
      }
      .metric-badge {
        margin-top: auto;
        padding: 14px 18px;
        background: color-mix(in srgb, var(--accent) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
        border-radius: 12px;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
      }
      .metric-label {
        font-size: 14px;
        color: #cbd5e1;
      }
      .metric-val {
        font-size: 26px;
        font-weight: 800;
        color: var(--accent);
      }
      .metric-val.green {
        color: #10b981;
      }

      /* Architecture Flow Diagram */
      .arch-flow {
        display: flex;
        align-items: center;
        gap: 32px;
        width: 100%;
        max-width: 1440px;
        margin-bottom: 36px;
      }
      .arch-box {
        flex: 1;
        background: color-mix(in srgb, var(--bg) 90%, #000000);
        border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
        border-radius: 20px;
        padding: 36px 32px;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
      }
      .arch-box.encoder {
        border-color: color-mix(in srgb, var(--primary) 40%, transparent);
        background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 18%, var(--bg)) 0%, color-mix(in srgb, var(--primary) 6%, var(--bg)) 100%);
      }
      .arch-box.decoder {
        border-color: color-mix(in srgb, var(--secondary) 40%, transparent);
        background: linear-gradient(180deg, color-mix(in srgb, var(--secondary) 18%, var(--bg)) 0%, color-mix(in srgb, var(--secondary) 6%, var(--bg)) 100%);
      }
      .arch-arrow {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 140px;
      }
      .arrow-line {
        width: 100%;
        height: 3px;
        background: linear-gradient(90deg, var(--primary), var(--secondary));
        position: relative;
      }
      .arrow-line::after {
        content: '';
        position: absolute;
        right: 0;
        top: -5px;
        border-left: 8px solid var(--secondary);
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
      }
      .arrow-text {
        font-size: 12px;
        color: #cbd5e1;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      /* Comparison Table */
      .comp-table {
        width: 100%;
        max-width: 1400px;
        background: color-mix(in srgb, var(--bg) 85%, #000000);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        overflow: hidden;
        margin-top: 10px;
      }
      .comp-row {
        display: flex;
        align-items: center;
        padding: 22px 36px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .comp-row:last-child {
        border-bottom: none;
      }
      .comp-row.header {
        background: rgba(255, 255, 255, 0.03);
        font-size: 14px;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .comp-row.featured {
        background: color-mix(in srgb, var(--accent) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
        border-radius: 12px;
        margin: 8px 16px;
      }
      .col-model { flex: 1.5; font-size: 20px; font-weight: 700; }
      .col-comp { flex: 1.2; font-size: 18px; font-weight: 700; }

      /* Benchmark & Metrics Grid */
      .bench-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 24px;
        width: 100%;
        max-width: 1540px;
        margin-top: 10px;
      }
      .bench-card {
        background: color-mix(in srgb, var(--bg) 85%, #000000);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        padding: 28px 24px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .bench-badge {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 1px;
        padding: 6px 14px;
        border-radius: 9999px;
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        color: var(--primary);
        border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
        margin-bottom: 16px;
      }
      .bench-score {
        font-size: 40px;
        font-weight: 800;
        color: var(--accent);
        margin-bottom: 8px;
      }
      .bench-title {
        font-size: 18px;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 8px;
      }
      .bench-desc {
        font-size: 14px;
        color: #94a3b8;
        line-height: 1.4;
      }

      /* Takeaway Layout */
      .takeaway-card {
        display: flex;
        flex-direction: column;
        gap: 20px;
        background: color-mix(in srgb, var(--bg) 85%, #000000);
        border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
        border-radius: 20px;
        padding: 36px 48px;
        margin-top: 24px;
        width: 100%;
        max-width: 1400px;
      }
      .takeaway-item {
        display: flex;
        align-items: center;
        gap: 20px;
        font-size: 24px;
        color: #ffffff;
        line-height: 1.4;
      }
      .bullet-dot {
        width: 10px;
        height: 10px;
        border-radius: 9999px;
        background: var(--accent);
        box-shadow: 0 0 10px var(--accent);
        flex-shrink: 0;
      }

      /* Progress Bar at Bottom */
      .bottom-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.06);
        z-index: 60;
      }
      .progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, var(--accent), var(--primary), var(--secondary));
      }
    </style>
  </head>
  <body>
    <!-- Root Composition -->
    <div id="root" data-composition-id="root" data-width="1920" data-height="1080">
      
      <!-- Ambient Background Layer -->
      <div class="bg-grid"></div>
      <div class="ambient-glow-1"></div>
      <div class="ambient-glow-2"></div>

      <!-- Top Persistent Nav -->
      <div class="top-nav">
        <div class="brand-badge">
          <span class="pulse-dot"></span>
          Const Learn Studio
        </div>
        <div class="header-tag">${escapeHtml(title)}</div>
      </div>

      <!-- Audio Track -->
      <audio id="tts-audio" src="${escapeHtml(audioSrc)}" data-start="0" data-duration="${totalDuration}" preload="auto"></audio>

      <!-- Video Scenes -->
      ${scenesHtml.join("\n")}

      <!-- Persistent Bottom Timeline Progress Bar -->
      <div class="bottom-progress">
        <div class="progress-fill" id="progress-bar"></div>
      </div>

    </div>

    <!-- GSAP Master Animation Timeline -->
    <script>
      (function() {
        const tl = gsap.timeline({ paused: true });

        // Overall Progress Bar Animation
        tl.to("#progress-bar", {
          width: "100%",
          duration: ${totalDuration},
          ease: "none"
        }, 0);

        ${gsapTimelineSteps.join("\n")}

        // Dynamic clip visibility synchronization
        function syncClipVisibility(targetTime) {
          const t = typeof targetTime === "number" ? targetTime : tl.time();
          const clips = document.querySelectorAll(".clip");
          let activeFound = false;
          clips.forEach((clip, i) => {
            const start = parseFloat(clip.getAttribute("data-start") || "0");
            const dur = parseFloat(clip.getAttribute("data-duration") || "0");
            const end = start + dur;
            const isActive = (t >= start && t < end) || (i === clips.length - 1 && t >= start);
            if (isActive && !activeFound) {
              activeFound = true;
              clip.style.display = "flex";
              clip.style.visibility = "visible";
              const content = clip.querySelector(".scene-content");
              if (content && t < end - 0.5) {
                content.style.opacity = "1";
                content.style.transform = "none";
              }
            } else {
              clip.style.display = "none";
            }
          });
        }
        tl.eventCallback("onUpdate", () => syncClipVisibility());

        // Deterministic seek function called by parent player & lightbox
        window.__seekTo = function(targetTime) {
          if (typeof targetTime !== "number" || isNaN(targetTime)) return;
          tl.seek(targetTime, false);
          syncClipVisibility(targetTime);
        };

        // Register timeline for HyperFrames
        window.__timelines = window.__timelines || {};
        window.__timelines["root"] = tl;
        tl.seek(0, false);
        syncClipVisibility(0);
      })();
    </script>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
