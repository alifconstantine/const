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
  const [researchSpeed, setResearchSpeed] = useState("Fast Research");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[94vw] max-w-[500px] p-0 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground [&>button]:hidden max-h-[90vh] overflow-y-auto"
      >
        <DialogTitle className="sr-only">Add Sources</DialogTitle>

        <div className="relative p-5 sm:p-7 flex flex-col items-center text-center">
          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Title */}
          <div className="mt-2 mb-5 max-w-[340px]">
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-foreground leading-snug">
              Create Audio and Video summaries from{" "}
              <span className="text-[#34d399] font-medium">sources</span>
            </h2>
          </div>

          {/* Search Box */}
          <div className="w-full bg-secondary/70 rounded-2xl p-3 border border-border/60 focus-within:border-foreground/30 transition-all text-left mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for new sources on the web"
              className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none px-1 py-1"
            />
            <div className="flex items-center justify-between mt-2.5 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setWebScope(webScope === "Web" ? "Journal" : "Web")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 hover:bg-background border border-border/50 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span>{webScope}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setResearchSpeed(
                      researchSpeed === "Fast Research" ? "Deep Research" : "Fast Research"
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 hover:bg-background border border-border/50 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <span>{researchSpeed}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </div>

              <button
                type="button"
                className="h-7 w-7 rounded-full bg-background/80 hover:bg-background border border-border/50 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Search"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Dropzone Container */}
          <div className="w-full border border-dashed border-border/80 rounded-2xl p-5 bg-secondary/30 flex flex-col items-center justify-center">
            <p className="text-xs sm:text-sm font-medium text-foreground">
              or drop your files here
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 mb-5">
              pdf, images, documents, audio,{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground cursor-pointer"
              >
                and more
              </button>
            </p>

            {/* 5 Quick Source Options */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onSelectSource?.("upload")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-[11px] text-foreground transition-colors cursor-pointer"
              >
                <Upload className="h-3 w-3 text-muted-foreground" />
                <span>Upload file</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSource?.("url")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-[11px] text-foreground transition-colors cursor-pointer"
              >
                <Link2 className="h-3 w-3 text-muted-foreground" />
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block"></span>
                  Website
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSource?.("drive")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-[11px] text-foreground transition-colors cursor-pointer"
              >
                <HardDrive className="h-3 w-3 text-muted-foreground" />
                <span>Drive</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSource?.("books")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-[11px] text-foreground transition-colors cursor-pointer"
              >
                <BookOpen className="h-3 w-3 text-muted-foreground" />
                <span>Play Books</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSource?.("paste")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-[11px] text-foreground transition-colors cursor-pointer"
              >
                <Clipboard className="h-3 w-3 text-muted-foreground" />
                <span>Paste text</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
