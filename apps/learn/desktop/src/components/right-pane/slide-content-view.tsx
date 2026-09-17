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
  mode?: "compact" | "large";
}

export function SlideContentView({ slide, theme, mode = "compact" }: SlideContentViewProps) {
  const isLarge = mode === "large";

  // HERO LAYOUT
  if (slide.layout === "hero") {
    return (
      <div className={`text-center my-auto flex flex-col items-center justify-center ${isLarge ? "space-y-4 max-w-3xl mx-auto" : "space-y-2.5 max-w-xl mx-auto"}`}>
        {(slide.accentTag || slide.kicker) && (
          <span
            className={`inline-block px-3 py-1 rounded-full font-semibold uppercase tracking-wider ${isLarge ? "text-xs" : "text-[10px]"}`}
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
          className={`font-extrabold tracking-tight leading-tight ${isLarge ? "text-2xl sm:text-4xl md:text-5xl" : "text-lg sm:text-2xl line-clamp-3"}`}
          style={{
            fontFamily: theme.fontDisplay,
            color: theme.colors.fg,
          }}
        >
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p
            className={`leading-relaxed ${isLarge ? "text-sm sm:text-base md:text-lg max-w-2xl" : "text-xs sm:text-sm max-w-lg line-clamp-2"}`}
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
      <div className={`my-auto flex flex-col justify-center ${isLarge ? "space-y-5" : "space-y-2.5"}`}>
        <div>
          {(slide.kicker || slide.accentTag) && (
            <span
              className={`inline-block uppercase font-bold tracking-wider mb-1 ${isLarge ? "text-xs" : "text-[10px]"}`}
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker || slide.accentTag}
            </span>
          )}
          <h2
            className={`font-bold tracking-tight ${isLarge ? "text-xl sm:text-2xl" : "text-sm sm:text-base truncate"}`}
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div
          className={`border p-4 sm:p-6 flex flex-col justify-center ${isLarge ? "py-8" : "py-4"}`}
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.borderRadius,
          }}
        >
          <div
            className={`font-black tracking-tight leading-none ${isLarge ? "text-5xl sm:text-7xl" : "text-3xl sm:text-4xl"}`}
            style={{ color: theme.colors.accent, fontFamily: theme.fontMono }}
          >
            {statVal}
          </div>
          <div
            className={`font-bold uppercase tracking-wider mt-2 ${isLarge ? "text-sm sm:text-base" : "text-xs"}`}
            style={{ color: theme.colors.fg }}
          >
            {statLabel}
          </div>
          {statCtx && (
            <p
              className={`mt-2 leading-relaxed ${isLarge ? "text-xs sm:text-sm max-w-2xl" : "text-[11px] line-clamp-2"}`}
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
      <div className="space-y-2 sm:space-y-3 my-auto">
        <div>
          {slide.kicker && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider block"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className={`font-bold tracking-tight ${isLarge ? "text-xl sm:text-2xl" : "text-sm sm:text-base line-clamp-1"}`}
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className={`line-clamp-1 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`} style={{ color: theme.colors.fgMuted }}>
              {slide.subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {cards.slice(0, 4).map((card, idx) => (
            <div
              key={idx}
              className={`p-2.5 sm:p-3.5 border flex flex-col justify-between transition-all ${isLarge ? "min-h-[110px]" : "min-h-[72px]"}`}
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`font-semibold ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"} truncate`}
                  style={{ color: theme.colors.fg }}
                >
                  {card.title}
                </span>
                {card.badge && (
                  <span
                    className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded"
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
                className={`leading-snug ${isLarge ? "text-xs line-clamp-3" : "text-[10px] line-clamp-2"}`}
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
      <div className="space-y-3 my-auto">
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider block"
            style={{ color: theme.colors.accent }}
          >
            {slide.kicker || "AGENDA & OVERVIEW"}
          </span>
          <h2
            className={`font-bold tracking-tight ${isLarge ? "text-xl sm:text-2xl" : "text-sm sm:text-base line-clamp-1"}`}
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className={`line-clamp-1 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`} style={{ color: theme.colors.fgMuted }}>
              {slide.subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
          {items.slice(0, 4).map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 sm:p-3 border flex items-center gap-2.5 sm:gap-3"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius,
              }}
            >
              <div
                className="w-6 h-6 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${theme.colors.accent}22`,
                  color: theme.colors.accent,
                }}
              >
                0{idx + 1}
              </div>
              <span
                className={`font-medium truncate ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`}
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
      <div className="space-y-3 my-auto">
        <div>
          {slide.kicker && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider block"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className={`font-bold tracking-tight ${isLarge ? "text-xl sm:text-2xl" : "text-sm sm:text-base line-clamp-1"}`}
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className={`line-clamp-1 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`} style={{ color: theme.colors.fgMuted }}>
              {slide.subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {/* Left Column (Neutral / Baseline) */}
          <div
            className="p-3 sm:p-4 border flex flex-col justify-between"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.borderRadius,
            }}
          >
            <span
              className={`font-bold block truncate mb-2 ${isLarge ? "text-sm sm:text-base" : "text-xs"}`}
              style={{ color: theme.colors.fgMuted }}
            >
              {leftTitle}
            </span>
            <ul className={`space-y-1.5 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`}>
              {leftItems.map((it, idx) => (
                <li key={idx} className="flex items-start gap-1.5" style={{ color: theme.colors.fgMuted }}>
                  <span className="opacity-50 shrink-0">•</span>
                  <span className="line-clamp-2">{it}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column (Highlight / Accent) */}
          <div
            className="p-3 sm:p-4 border flex flex-col justify-between"
            style={{
              backgroundColor: `${theme.colors.accent}12`,
              borderColor: `${theme.colors.accent}66`,
              borderRadius: theme.borderRadius,
            }}
          >
            <span
              className={`font-bold block truncate mb-2 flex items-center gap-1.5 ${isLarge ? "text-sm sm:text-base" : "text-xs"}`}
              style={{ color: theme.colors.accent }}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>{rightTitle}</span>
            </span>
            <ul className={`space-y-1.5 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`}>
              {rightItems.map((it, idx) => (
                <li key={idx} className="flex items-start gap-1.5 font-medium" style={{ color: theme.colors.fg }}>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: theme.colors.accent }} />
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
        step: `Tahap 0${i + 1}`,
        title: parts[0]?.trim() || `Milestone 0${i + 1}`,
        desc: parts[1]?.trim() || b,
      };
    });

    return (
      <div className="space-y-3 my-auto">
        <div>
          {slide.kicker && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider block"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className={`font-bold tracking-tight ${isLarge ? "text-xl sm:text-2xl" : "text-sm sm:text-base line-clamp-1"}`}
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className={`line-clamp-1 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`} style={{ color: theme.colors.fgMuted }}>
              {slide.subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {steps.slice(0, 3).map((st, idx) => (
            <div
              key={idx}
              className="p-3 border flex flex-col justify-between"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius,
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${theme.colors.accent}1f`,
                      color: theme.colors.accent,
                    }}
                  >
                    {st.step || `0${idx + 1}`}
                  </span>
                  <ArrowRight className="h-3 w-3 opacity-40" />
                </div>
                <h4
                  className={`font-semibold line-clamp-1 ${isLarge ? "text-xs sm:text-sm" : "text-xs"}`}
                  style={{ color: theme.colors.fg }}
                >
                  {st.title}
                </h4>
              </div>
              <p
                className={`mt-1.5 leading-snug line-clamp-2 ${isLarge ? "text-xs" : "text-[10px]"}`}
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
    const context = slide.quote?.context || slide.accentTag || "Intisari Pembahasan";

    return (
      <div className={`my-auto text-center flex flex-col items-center justify-center ${isLarge ? "space-y-4 max-w-3xl mx-auto" : "space-y-2 max-w-xl mx-auto"}`}>
        <Quote className={`opacity-40 shrink-0 ${isLarge ? "h-8 w-8" : "h-5 w-5"}`} style={{ color: theme.colors.accent }} />
        <blockquote
          className={`italic font-medium leading-relaxed ${isLarge ? "text-xl sm:text-2xl md:text-3xl" : "text-xs sm:text-sm line-clamp-4"}`}
          style={{
            fontFamily: theme.fontDisplay,
            color: theme.colors.fg,
          }}
        >
          “{quoteText}”
        </blockquote>
        <div className="pt-1">
          <div
            className={`font-bold ${isLarge ? "text-sm sm:text-base" : "text-xs"}`}
            style={{ color: theme.colors.accent }}
          >
            — {author}
          </div>
          {context && (
            <div
              className="text-[10px] sm:text-xs mt-0.5"
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
    const points = (slide.bullets || []).slice(1, 4);

    return (
      <div className="space-y-3 my-auto">
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider block"
            style={{ color: theme.colors.accent }}
          >
            {slide.kicker || "KESIMPULAN & TINDAK LANJUT"}
          </span>
          <h2
            className={`font-bold tracking-tight ${isLarge ? "text-xl sm:text-2xl" : "text-sm sm:text-base line-clamp-1"}`}
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
        </div>

        <div
          className="p-3.5 sm:p-5 border"
          style={{
            backgroundColor: `${theme.colors.accent}14`,
            borderColor: `${theme.colors.accent}66`,
            borderRadius: theme.borderRadius,
          }}
        >
          <div className="flex items-start gap-2.5">
            <Target className="h-5 w-5 shrink-0 mt-0.5" style={{ color: theme.colors.accent }} />
            <div>
              <h3
                className={`font-bold leading-snug ${isLarge ? "text-base sm:text-lg" : "text-xs sm:text-sm"}`}
                style={{ color: theme.colors.fg }}
              >
                {mainTakeaway}
              </h3>
              {points.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {points.map((pt, idx) => (
                    <li
                      key={idx}
                      className={`flex items-center gap-1.5 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`}
                      style={{ color: theme.colors.fgMuted }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: theme.colors.accent }} />
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
      <div className="space-y-3 my-auto">
        <div>
          {slide.kicker && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider block"
              style={{ color: theme.colors.accent }}
            >
              {slide.kicker}
            </span>
          )}
          <h2
            className={`font-bold tracking-tight ${isLarge ? "text-xl sm:text-2xl" : "text-sm sm:text-base line-clamp-1"}`}
            style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
          >
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className={`line-clamp-1 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`} style={{ color: theme.colors.fgMuted }}>
              {slide.subtitle}
            </p>
          )}
        </div>

        <div
          className="grid gap-2 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${numItems.length}, minmax(0, 1fr))`,
          }}
        >
          {numItems.map((num, nIdx) => (
            <div
              key={nIdx}
              className="p-2.5 sm:p-4 border flex flex-col justify-between"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius,
              }}
            >
              <div
                className={`font-black font-mono tracking-tight leading-none ${isLarge ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
                style={{ color: theme.colors.accent, fontFamily: theme.fontMono }}
              >
                {num.value}
              </div>
              <div
                className={`font-semibold truncate mt-1.5 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`}
                style={{ color: theme.colors.fg }}
              >
                {num.label}
              </div>
              {num.note && (
                <div
                  className="text-[9px] sm:text-[10px] mt-1 line-clamp-1"
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
    <div className="space-y-2.5 my-auto">
      <div>
        {slide.kicker && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider block"
            style={{ color: theme.colors.accent }}
          >
            {slide.kicker}
          </span>
        )}
        <h2
          className={`font-bold tracking-tight ${isLarge ? "text-xl sm:text-2xl" : "text-sm sm:text-base line-clamp-1"}`}
          style={{ fontFamily: theme.fontDisplay, color: theme.colors.fg }}
        >
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className={`line-clamp-1 ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`} style={{ color: theme.colors.fgMuted }}>
            {slide.subtitle}
          </p>
        )}
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        {(slide.bullets || []).slice(0, 4).map((b, bIdx) => (
          <div
            key={bIdx}
            className="p-2 sm:p-2.5 border flex items-center gap-2.5"
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
              className={`font-medium truncate ${isLarge ? "text-xs sm:text-sm" : "text-[11px]"}`}
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
