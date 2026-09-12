import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@const/ui";
import {
  X,
  Search,
  Globe,
  Upload,
  HardDrive,
  BookOpen,
  Clipboard,
  ChevronDown,
  Link2,
} from "lucide-react";

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSource?: (sourceType: string) => void;
}

export function AddSourceDialog({
  open,
  onOpenChange,
  onSelectSource,
}: AddSourceDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState("Web");
  const [researchSpeed, setResearchSpeed] = useState("Riset Cepat");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[92vw] max-w-[620px] p-0 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground [&>button]:hidden"
      >
        {/* Hidden accessible title for screen readers */}
        <DialogTitle className="sr-only">Tambah Sumber</DialogTitle>

        <div className="relative p-6 sm:p-8 flex flex-col items-center text-center">
          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-5 right-5 h-8 w-8 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Title with styled green accent */}
          <div className="mt-2 mb-6 max-w-[480px]">
            <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-foreground leading-snug">
              Buat Ringkasan Audio dan Video dari{" "}
              <span className="text-[#34d399] font-medium">situs</span>
            </h2>
          </div>

          {/* Search Box with filter pills */}
          <div className="w-full bg-secondary/70 rounded-2xl p-3 border border-border/60 focus-within:border-foreground/30 transition-all text-left mb-5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Telusuri sumber baru di web"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none px-2 py-1.5"
            />
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWebScope(webScope === "Web" ? "Jurnal" : "Web")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 hover:bg-background border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span>{webScope}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setResearchSpeed(
                      researchSpeed === "Riset Cepat" ? "Riset Mendalam" : "Riset Cepat"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 hover:bg-background border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <span>{researchSpeed}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </div>

              <button
                type="button"
                className="h-8 w-8 rounded-full bg-background/80 hover:bg-background border border-border/50 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Cari"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Dropzone Container */}
          <div className="w-full border border-dashed border-border/80 rounded-2xl p-6 sm:p-7 bg-secondary/30 flex flex-col items-center justify-center">
            <p className="text-sm font-medium text-foreground">
              atau lepaskan file Anda
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-6">
              pdf, gambar, dokumen, audio,{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground cursor-pointer"
              >
                dan banyak lagi
              </button>
            </p>

            {/* 5 Quick Source Options */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onSelectSource?.("upload")}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Upload file</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSource?.("url")}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer"
              >
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 inline-block"></span>
                  Situs
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSource?.("drive")}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer"
              >
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Drive</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSource?.("books")}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Play Buku</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSource?.("paste")}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer"
              >
                <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Teks yang disalin</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
