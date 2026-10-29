import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { toast } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { avatarCropRect, type CropPosition } from "../../lib/avatar-crop";
import { settingsButton, settingsPrimaryButton } from "./settings-controls";

export interface AvatarSource {
  url: string;
  width: number;
  height: number;
}

export function AvatarCropEditor({
  source,
  busy,
  onSave,
  onCancel,
}: {
  source: AvatarSource;
  busy: boolean;
  onSave(image: string): Promise<void>;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    position: CropPosition;
    pointerId: number;
  } | null>(null);
  const [size, setSize] = useState(256);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<CropPosition>({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const locked = busy || exporting;
  const scale = (size / Math.min(source.width, source.height)) * zoom;
  const width = source.width * scale;
  const height = source.height * scale;
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(
      ([entry]) => entry && setSize(entry.contentRect.width),
    );
    observer.observe(frame);
    frame.focus();
    return () => observer.disconnect();
  }, []);

  const save = async () => {
    if (locked) return;
    setExporting(true);
    try {
      const image = new Image();
      image.src = source.url;
      await image.decode();
      const crop = avatarCropRect(source.width, source.height, zoom, position);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 512, 512);
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.side,
        crop.side,
        0,
        0,
        512,
        512,
      );
      await onSave(canvas.toDataURL("image/jpeg", 0.9));
    } catch {
      toast.error(t("settings.avatarSaveFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section
      aria-label={t("settings.cropAvatar")}
      className="space-y-4 rounded-2xl bg-neutral-50 p-4 dark:bg-[#222222]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          if (!locked) onCancel();
        }
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-white">
          {t("settings.cropAvatar")}
        </h2>
        <p
          id="avatar-crop-hint"
          className="text-xs text-neutral-500 dark:text-[#969696]"
        >
          {t("settings.cropAvatarHint")}
        </p>
      </div>
      <div className="mx-auto w-full max-w-64 space-y-4">
        <div
          ref={frameRef}
          tabIndex={0}
          role="group"
          aria-label={t("settings.cropPosition")}
          aria-describedby="avatar-crop-hint"
          className="relative aspect-square w-full touch-none overflow-hidden rounded-xl bg-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-[#161616] cursor-grab active:cursor-grabbing"
          onPointerDown={(event) => {
            if (locked) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              x: event.clientX,
              y: event.clientY,
              position,
              pointerId: event.pointerId,
            };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            setPosition({
              x:
                width > size
                  ? clamp(
                      drag.position.x +
                        ((event.clientX - drag.x) * 2) / (width - size),
                    )
                  : 0,
              y:
                height > size
                  ? clamp(
                      drag.position.y +
                        ((event.clientY - drag.y) * 2) / (height - size),
                    )
                  : 0,
            });
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onLostPointerCapture={() => {
            dragRef.current = null;
          }}
          onKeyDown={(event) => {
            if (
              locked ||
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                event.key,
              )
            )
              return;
            event.preventDefault();
            const step = event.shiftKey ? 0.2 : 0.05;
            setPosition((previous) => ({
              x: clamp(
                previous.x +
                  (event.key === "ArrowRight"
                    ? step
                    : event.key === "ArrowLeft"
                      ? -step
                      : 0),
              ),
              y: clamp(
                previous.y +
                  (event.key === "ArrowDown"
                    ? step
                    : event.key === "ArrowUp"
                      ? -step
                      : 0),
              ),
            }));
          }}
        >
          <img
            src={source.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width,
              height,
              left: (size - width) / 2 + (position.x * (width - size)) / 2,
              top: (size - height) / 2 + (position.y * (height - size)) / 2,
            }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-full ring-[48px] ring-black/50" />
          <div className="pointer-events-none absolute inset-0 rounded-full border border-white/70" />
        </div>
        <div className="flex items-center gap-3 text-neutral-500 dark:text-[#969696]">
          <Minus className="size-3.5" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            disabled={locked}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label={t("settings.cropZoom")}
            className="h-1 w-full cursor-pointer accent-neutral-700 dark:accent-white"
          />
          <Plus className="size-3.5" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className={settingsButton}
          disabled={locked}
          onClick={() => {
            setZoom(1);
            setPosition({ x: 0, y: 0 });
          }}
        >
          <RotateCcw className="size-3.5" />
          {t("common.reset")}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className={settingsButton}
            disabled={locked}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={settingsPrimaryButton}
            disabled={locked}
            onClick={() => void save()}
          >
            {t(locked ? "settings.saving" : "settings.saveAvatar")}
          </button>
        </div>
      </div>
    </section>
  );
}
