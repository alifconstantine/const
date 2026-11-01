"use client";

import {
  Button,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
} from "@const/ui";
import { Trash2, X } from "lucide-react";

interface SystemInstructionPanelProps {
  open: boolean;
  onClose: () => void;
  systemInstruction: string;
  onSaveInstruction: (instruction: string) => void;
}

const PRESET_INSTRUCTIONS = [
  {
    id: "default",
    title: "General Helpful Assistant",
    instruction:
      "You are a helpful, direct, and concise AI assistant. Provide accurate and well-structured answers.",
  },
  {
    id: "coding",
    title: "Senior Software Engineer",
    instruction:
      "You are a senior full-stack software engineer. Provide clean, secure, and production-grade code with TypeScript types, modern syntax, and minimal boilerplate explanations.",
  },
  {
    id: "json",
    title: "JSON Output Specialist",
    instruction:
      "You are a structured data extractor. You must ALWAYS respond in valid, parseable JSON format without markdown wrapping, explanations, or prologue.",
  },
  {
    id: "concise",
    title: "Ultra Concise Explainer",
    instruction:
      "Answer questions in 1-3 direct, razor-sharp sentences without pleasantries or introductory fluff.",
  },
];

export function SystemInstructionPanel({
  open,
  onClose,
  systemInstruction,
  onSaveInstruction,
}: SystemInstructionPanelProps) {
  if (!open) return null;

  const handleSelectPreset = (presetId: string) => {
    if (presetId === "new") {
      onSaveInstruction("");
      return;
    }

    const found = PRESET_INSTRUCTIONS.find((p) => p.id === presetId);
    if (found) {
      onSaveInstruction(found.instruction);
    }
  };

  const handleTextChange = (newText: string) => {
    onSaveInstruction(newText);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-[420px] p-0 flex flex-col bg-card border-l border-border/70 z-50 gap-0"
      >
        {/* Header (No icon, clean typography) */}
        <div className="p-4 sm:p-5 flex items-center justify-between">
          <SheetTitle className="font-sans text-base sm:text-lg font-semibold text-foreground">
            System instructions
          </SheetTitle>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        {/* Preset Selector */}
        <div className="p-4 sm:p-5 pb-3 space-y-3">
          <Select onValueChange={handleSelectPreset}>
            <SelectTrigger className="w-full h-10 rounded-xl text-sm font-sans border-border/80 bg-secondary/50 text-foreground">
              <SelectValue placeholder="+ Create or choose instruction preset" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border/80 text-sm">
              <SelectItem
                value="new"
                className="font-medium text-foreground cursor-pointer"
              >
                + Create new instruction
              </SelectItem>
              {PRESET_INSTRUCTIONS.map((p) => (
                <SelectItem
                  key={p.id}
                  value={p.id}
                  className="cursor-pointer text-foreground"
                >
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs leading-5 text-muted-foreground">
            Set the model’s role, tone, and response format. Changes apply to
            the next message.
          </p>
        </div>

        {/* Textarea body */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col min-h-0">
          <label
            htmlFor="system-instruction"
            className="text-xs font-sans font-medium text-foreground mb-2"
          >
            Instructions for the model
          </label>
          <Textarea
            id="system-instruction"
            value={systemInstruction}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Optional tone and style instructions for the model (e.g. 'Answer in Indonesian with clear bullet points')"
            className="flex-1 resize-none rounded-xl border-border/80 bg-background p-4 text-sm font-sans leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-foreground"
          />
        </div>

        {/* Footer */}
        <div className="p-4 px-5 bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            disabled={!systemInstruction}
            onClick={() => onSaveInstruction("")}
            className="h-9 rounded-lg text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            className="h-9 px-5 rounded-lg text-xs font-medium cursor-pointer"
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
