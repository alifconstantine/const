import React from "react";
import {
  Quote,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Target,
} from "lucide-react";
import type { SlideItem } from "../../lib/db";
import type { PresentationTheme } from "../../lib/studio/presentation/themes";

export interface SlideContentViewProps {
  slide: SlideItem;
  theme: PresentationTheme;
  mode?: "mobile" | "fullscreen";
}

export function SlideContentView({ slide, theme, mode = "mobile" }: SlideContentViewProps) {
  const isFullscreen = mode === "fullscreen";

  // HERO LAYOUT
  if (slide.layout === "hero") {
    return (
      <div className={`text-center my-auto flex flex-col items-center justify-center ${isFullscreen ? "space-y-3 px-3" : "space-y-2 px-1"}`}>
        {(slide.accentTag || slide.kicker) && (
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: `${theme.colors.accent}1f`,
              borderColor: `${theme.colors.accent}4d`,
              borderWidth: "1px",
              borderStyle: "solid",
              color: theme.colors.accent,
            }}
          >
            {slide.accentTag || slide.kicker}
          </span>
        )}
        <h1
          className={`font-extrabold tracking-tight leading-tight ${isFullscreen ? "text-xl sm:text-2xl" : "text-base sm:text-lg"} line-clamp-3`}
          style={{
            fontFamily: theme.fontDisplay,
            color: theme.colors.fg,
          }}
        >
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p
            className={`leading-relaxed ${isFullscreen ? "text-xs sm:text-sm" : "text-[11px]"} line-clamp-3`}
            style={{ color: theme.colors.fgMuted }}
          >
            {slide.subtitle}
          </p>
        )}
      </div>
    );
  }

  // BIG-STAT LAYOUT
  if (slide.layout === "big-stat") {
    const statVal = slide.statHighlight?.value || slide.numbers?.[0]?.value || "100%";
    const statLabel = slide.statHighlight?.label || slide.numbers?.[0]?.label || slide.title;
    const statCtx = slide.statHighlight?.context || slide.subtitle || (slide.bullets && slide.bullets[0]);

    return (
      <div className="my-auto flex flex-col justify-center space-y-2">
        <div>
          {(slide.kicker || slide.accentTag) && (
            <span
              className="inline-block uppercase font-bold tracking-wider text-[10px] mb-0.5"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker || slide.accentTag}
            </span>
          )}
          <h2
            className="font-bold tracking-tight text-xs sm:text-sm truncate"
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div
          className="border p-3 flex flex-col justify-center"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.borderRadius,
          }}
        >
          <div
            className="font-black tracking-tight leading-none text-3xl sm:text-4xl"
            style={{ color: theme.colors.accent, fontFamily: theme.fontMono }}
          >
            {statVal}
          </div>
          <div
            className="font-bold uppercase tracking-wider text-xs mt-1.5"
            style={{ color: theme.colors.fg }}
          >
            {statLabel}
          </div>
          {statCtx && (
            <p
              className="mt-1 leading-snug text-[10.5px] line-clamp-2"
              style={{ color: theme.colors.fgMuted }}
            >
              {statCtx}
            </p>
          )}
        </div>
      </div>
    );
  }

  // BENTO-GRID LAYOUT
  if (slide.layout === "bento-grid") {
    const cards = slide.bentoCards || (slide.bullets || []).map((b, i) => {
      const parts = b.split(":");
      return {
        title: parts.length > 1 ? (parts[0] ?? "").trim() : `Poin 0${i + 1}`,
        desc: parts.length > 1 ? parts.slice(1).join(":").trim() : b,
        badge: `0${i + 1}`,
      };
    });

    return (
      <div className="space-y-1.5 my-auto">
        <div>
          {slide.kicker && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider block"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className="font-bold tracking-tight text-xs sm:text-sm line-clamp-1"
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {cards.slice(0, 4).map((card, idx) => (
            <div
              key={idx}
              className="p-2 border flex flex-col justify-between"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius,
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className="font-semibold text-[10.5px] truncate"
                  style={{ color: theme.colors.fg }}
                >
                  {card.title}
                </span>
                {card.badge && (
                  <span
                    className="text-[8.5px] font-mono px-1 py-0.2 rounded"
                    style={{
                      backgroundColor: `${theme.colors.accent}1a`,
                      color: theme.colors.accent,
                    }}
                  >
                    {card.badge}
                  </span>
                )}
              </div>
              <p
                className="leading-tight text-[9.5px] line-clamp-2"
                style={{ color: theme.colors.fgMuted }}
              >
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // AGENDA LAYOUT
  if (slide.layout === "agenda") {
    const items = slide.bullets || [];

    return (
      <div className="space-y-2 my-auto">
        <div>
          <span
            className="text-[9px] font-bold uppercase tracking-wider block"
            style={{ color: theme.colors.accent }}
          >
            {slide.kicker || "AGENDA & OVERVIEW"}
          </span>
          <h2
            className="font-bold tracking-tight text-xs sm:text-sm line-clamp-1"
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div className="space-y-1.5">
          {items.slice(0, 4).map((item, idx) => (
            <div
              key={idx}
              className="p-2 border flex items-center gap-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius,
              }}
            >
              <div
                className="w-5 h-5 rounded font-mono text-[10px] font-bold flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${theme.colors.accent}22`,
                  color: theme.colors.accent,
                }}
              >
                0{idx + 1}
              </div>
              <span
                className="font-medium truncate text-[11px]"
                style={{ color: theme.colors.fg }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // COMPARISON LAYOUT
  if (slide.layout === "comparison" || slide.layout === "split") {
    const leftTitle = slide.comparisonDetails?.leftTitle || slide.leftColumn?.title || "Konvensional";
    const leftItems = slide.comparisonDetails?.leftItems || slide.leftColumn?.items || slide.bullets?.slice(0, 2) || [];
    const rightTitle = slide.comparisonDetails?.rightTitle || slide.rightColumn?.title || "Strategi Modern";
    const rightItems = slide.comparisonDetails?.rightItems || slide.rightColumn?.items || slide.bullets?.slice(2, 4) || [];

    return (
      <div className="space-y-2 my-auto">
        <div>
          {slide.kicker && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider block"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className="font-bold tracking-tight text-xs sm:text-sm line-clamp-1"
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {/* Left Column */}
          <div
            className="p-2 border flex flex-col justify-between"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.borderRadius,
            }}
          >
            <span
              className="font-bold block truncate text-[10px] mb-1"
              style={{ color: theme.colors.fgMuted }}
            >
              {leftTitle}
            </span>
            <ul className="space-y-1 text-[9.5px]">
              {leftItems.slice(0, 2).map((it, idx) => (
                <li key={idx} className="flex items-start gap-1" style={{ color: theme.colors.fgMuted }}>
                  <span className="opacity-50 shrink-0">•</span>
                  <span className="line-clamp-2">{it}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column */}
          <div
            className="p-2 border flex flex-col justify-between"
            style={{
              backgroundColor: `${theme.colors.accent}12`,
              borderColor: `${theme.colors.accent}66`,
              borderRadius: theme.borderRadius,
            }}
          >
            <span
              className="font-bold block truncate text-[10px] mb-1 flex items-center gap-1"
              style={{ color: theme.colors.accent }}
            >
              <Sparkles className="h-2.5 w-2.5 shrink-0" />
              <span>{rightTitle}</span>
            </span>
            <ul className="space-y-1 text-[9.5px]">
              {rightItems.slice(0, 2).map((it, idx) => (
                <li key={idx} className="flex items-start gap-1 font-medium" style={{ color: theme.colors.fg }}>
                  <CheckCircle2 className="h-2.5 w-2.5 shrink-0 mt-0.5" style={{ color: theme.colors.accent }} />
                  <span className="line-clamp-2">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // TIMELINE LAYOUT
  if (slide.layout === "timeline") {
    const steps = slide.timelineSteps || (slide.bullets || []).map((b, i) => {
      const parts = b.split(":");
      return {
        step: `Fase 0${i + 1}`,
        title: parts[0]?.trim() || `Milestone 0${i + 1}`,
        desc: parts[1]?.trim() || b,
      };
    });

    return (
      <div className="space-y-2 my-auto">
        <div>
          {slide.kicker && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider block"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className="font-bold tracking-tight text-xs sm:text-sm line-clamp-1"
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div className="space-y-1.5">
          {steps.slice(0, 3).map((st, idx) => (
            <div
              key={idx}
              className="p-2 border flex items-center justify-between gap-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[8.5px] font-mono px-1 py-0.5 rounded font-bold uppercase shrink-0"
                  style={{
                    backgroundColor: `${theme.colors.accent}1f`,
                    color: theme.colors.accent,
                  }}
                >
                  {st.step || `0${idx + 1}`}
                </span>
                <span
                  className="font-semibold text-[10.5px] truncate"
                  style={{ color: theme.colors.fg }}
                >
                  {st.title}
                </span>
              </div>
              <p
                className="text-[9.5px] line-clamp-1 max-w-[50%]"
                style={{ color: theme.colors.fgMuted }}
              >
                {st.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // QUOTE LAYOUT
  if (slide.layout === "quote") {
    const quoteText = slide.quote?.text || slide.subtitle || slide.title;
    const author = slide.quote?.author || "Prinsip Utama";
    const context = slide.quote?.context || slide.accentTag || "Intisari";

    return (
      <div className="my-auto text-center flex flex-col items-center justify-center space-y-1.5 px-2">
        <Quote className="opacity-40 shrink-0 h-4 w-4" style={{ color: theme.colors.accent }} />
        <blockquote
          className="italic font-medium leading-snug text-xs sm:text-sm line-clamp-4"
          style={{
            fontFamily: theme.fontDisplay,
            color: theme.colors.fg,
          }}
        >
          “{quoteText}”
        </blockquote>
        <div className="pt-0.5">
          <div
            className="font-bold text-[11px]"
            style={{ color: theme.colors.accent }}
          >
            — {author}
          </div>
          {context && (
            <div
              className="text-[9.5px] mt-0.5"
              style={{ color: theme.colors.fgMuted }}
            >
              {context}
            </div>
          )}
        </div>
      </div>
    );
  }

  // TAKEAWAY LAYOUT
  if (slide.layout === "takeaway") {
    const mainTakeaway = slide.subtitle || slide.bullets?.[0] || slide.title;
    const points = (slide.bullets || []).slice(1, 3);

    return (
      <div className="space-y-2 my-auto">
        <div>
          <span
            className="text-[9px] font-bold uppercase tracking-wider block"
            style={{ color: theme.colors.accent }}
          >
            {slide.kicker || "KESIMPULAN"}
          </span>
          <h2
            className="font-bold tracking-tight text-xs sm:text-sm line-clamp-1"
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div
          className="p-2.5 border"
          style={{
            backgroundColor: `${theme.colors.accent}14`,
            borderColor: `${theme.colors.accent}66`,
            borderRadius: theme.borderRadius,
          }}
        >
          <div className="flex items-start gap-2">
            <Target className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme.colors.accent }} />
            <div>
              <h3
                className="font-bold leading-snug text-xs"
                style={{ color: theme.colors.fg }}
              >
                {mainTakeaway}
              </h3>
              {points.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {points.map((pt, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-1 text-[10px]"
                      style={{ color: theme.colors.fgMuted }}
                    >
                      <span className="h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: theme.colors.accent }} />
                      <span className="truncate">{pt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // NUMBERS LAYOUT
  if (slide.layout === "numbers" && slide.numbers && slide.numbers.length > 0) {
    const numItems = slide.numbers.slice(0, 3);
    return (
      <div className="space-y-2 my-auto">
        <div>
          {slide.kicker && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider block"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className="font-bold tracking-tight text-xs sm:text-sm line-clamp-1"
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${numItems.length}, minmax(0, 1fr))`,
          }}
        >
          {numItems.map((num, nIdx) => (
            <div
              key={nIdx}
              className="p-2 border flex flex-col justify-between"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius,
              }}
            >
              <div
                className="font-black tracking-tight leading-none text-lg sm:text-xl"
                style={{ color: theme.colors.accent, fontFamily: theme.fontMono }}
              >
                {num.value}
              </div>
              <div
                className="font-semibold truncate mt-1 text-[10px]"
                style={{ color: theme.colors.fg }}
              >
                {num.label}
              </div>
              {num.note && (
                <div
                  className="text-[8.5px] mt-0.5 line-clamp-1"
                  style={{ color: theme.colors.fgMuted }}
                >
                  {num.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // DEFAULT / BULLETS LAYOUT
  return (
    <div className="space-y-2 my-auto">
      <div>
        {slide.kicker && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider block"
            style={{ color: theme.colors.accent }}
          >
            {slide.kicker}
          </span>
        )}
        <h2
          className="font-bold tracking-tight text-xs sm:text-sm line-clamp-1"
          style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
        >
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="line-clamp-1 text-[10.5px]" style={{ color: theme.colors.fgMuted }}>
            {slide.subtitle}
          </p>
        )}
      </div>

      <div className="space-y-1">
        {(slide.bullets || []).slice(0, 4).map((b, bIdx) => (
          <div
            key={bIdx}
            className="p-1.5 border flex items-center gap-2"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.borderRadius,
            }}
          >
            <div
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: theme.colors.accent }}
            />
            <span
              className="font-medium truncate text-[10.5px]"
              style={{ color: theme.colors.fg }}
            >
              {b}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
