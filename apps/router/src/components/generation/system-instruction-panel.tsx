"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from "@const/ui";
import { X, Trash2 } from "lucide-react";

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
    instruction: "You are a helpful, direct, and concise AI assistant. Provide accurate and well-structured answers.",
  },
  {
    id: "coding",
    title: "Senior Software Engineer",
    instruction: "You are a senior full-stack software engineer. Provide clean, secure, and production-grade code with TypeScript types, modern syntax, and minimal boilerplate explanations.",
  },
  {
    id: "json",
    title: "JSON Output Specialist",
    instruction: "You are a structured data extractor. You must ALWAYS respond in valid, parseable JSON format without markdown wrapping, explanations, or prologue.",
  },
  {
    id: "concise",
    title: "Ultra Concise Explainer",
    instruction: "Answer questions in 1-3 direct, razor-sharp sentences without pleasantries or introductory fluff.",
  },
];

export function SystemInstructionPanel({
  open,
  onClose,
  systemInstruction,
  onSaveInstruction,
}: SystemInstructionPanelProps) {
  const [title, setTitle] = useState("Custom Instruction");
  const [text, setText] = useState(systemInstruction);

  if (!open) return null;

  const handleSelectPreset = (presetId: string) => {
    if (presetId === "new") {
      setTitle("New Instruction");
      setText("");
      onSaveInstruction("");
      return;
    }

    const found = PRESET_INSTRUCTIONS.find((p) => p.id === presetId);
    if (found) {
      setTitle(found.title);
      setText(found.instruction);
      onSaveInstruction(found.instruction);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    onSaveInstruction(newText);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-card border-l border-border/70 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header (No icon, clean typography) */}
        <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between">
          <h2 className="font-sans text-base sm:text-lg font-semibold text-foreground">
            System instructions
          </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Preset Selector */}
      <div className="p-4 sm:p-5 pb-3 border-b border-border/50 space-y-3">
        <Select onValueChange={handleSelectPreset}>
          <SelectTrigger className="w-full h-10 rounded-xl text-sm font-sans border-border/80 bg-secondary/50 text-foreground">
            <SelectValue placeholder="+ Create or choose instruction preset" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border/80 text-sm">
            <SelectItem value="new" className="font-medium text-foreground cursor-pointer">
              + Create new instruction
            </SelectItem>
            {PRESET_INSTRUCTIONS.map((p) => (
              <SelectItem key={p.id} value={p.id} className="cursor-pointer text-foreground">
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Title Input */}
        <div className="relative">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-10 rounded-xl text-sm font-sans border-border/80 bg-background text-foreground pr-8"
          />
          {text && (
            <button
              onClick={() => {
                setText("");
                onSaveInstruction("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="Clear instruction"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Textarea body */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col min-h-0">
        <label className="text-xs font-sans font-medium text-foreground mb-2">
          Instructions for the model
        </label>
        <Textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Optional tone and style instructions for the model (e.g. 'Answer in Indonesian with clear bullet points')"
          className="flex-1 resize-none rounded-2xl border-border/80 bg-background p-4 text-sm font-sans leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-foreground"
        />
      </div>

      {/* Footer */}
      <div className="p-4 px-5 border-t border-border/70 bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-sans text-xs text-muted-foreground">
          Instructions are saved with this chat.
        </span>
        <Button
          size="sm"
          onClick={onClose}
          className="h-9 px-5 rounded-full text-xs font-medium cursor-pointer"
        >
          Done
        </Button>
      </div>
    </div>
  </>
);
}
