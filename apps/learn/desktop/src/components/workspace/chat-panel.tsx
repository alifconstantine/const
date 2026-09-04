import React, { useState } from "react";
import {
  SlidersHorizontal,
  MoreVertical,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface ChatPanelProps {
  sourcesCount?: number;
  onSelectPromptChip?: (prompt: string) => void;
  onSendMessage?: (message: string) => void;
}

export function ChatPanel({
  sourcesCount = 0,
  onSelectPromptChip,
  onSendMessage,
}: ChatPanelProps) {
  const [inputMessage, setInputMessage] = useState("");

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim()) return;
    onSendMessage?.(inputMessage.trim());
    setInputMessage("");
  };

  const handleChipClick = (prompt: string) => {
    onSelectPromptChip?.(prompt);
  };

  return (
    <main className="flex-1 h-full flex flex-col bg-[#111113] text-foreground min-w-0 relative">
      {/* Panel Header */}
      <div className="h-12 px-6 flex items-center justify-between shrink-0 select-none">
        <span className="text-sm font-medium text-foreground">Chat</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="h-8 w-8 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Pengaturan Chat"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="h-8 w-8 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Menu Opsi"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Conversation Stream / Welcome Content */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 flex flex-col justify-center max-w-3xl mx-auto w-full">
        {/* Waving hand emoji */}
        <div className="text-3xl sm:text-4xl mb-3 select-none">👋</div>

        {/* Welcome Title */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
          Mari mulai membuat notebook...
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl">
          Dengan notebook ini, Anda dapat mulai memahami, membuat, atau mengembangkan hal baru. Anda dapat meminta bantuan saya untuk memulai atau langsung menambahkan sumber Anda sendiri.
        </p>

        {/* Prompt question */}
        <p className="text-xs text-muted-foreground/80 font-medium mb-3">
          Apa yang ingin Anda lakukan dengan notebook ini?
        </p>

        {/* 3 Prompt Chips */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleChipClick("Pelajari topik baru")}
            className="px-4 py-2 rounded-full bg-[#1a1a1e] hover:bg-[#242429] border border-white/5 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
          >
            Pelajari topik baru
          </button>

          <button
            type="button"
            onClick={() => handleChipClick("Buat konten baru")}
            className="px-4 py-2 rounded-full bg-[#1a1a1e] hover:bg-[#242429] border border-white/5 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
          >
            Buat konten baru
          </button>

          <button
            type="button"
            onClick={() => handleChipClick("Lanjutkan project")}
            className="px-4 py-2 rounded-full bg-[#1a1a1e] hover:bg-[#242429] border border-white/5 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
          >
            Lanjutkan project
          </button>
        </div>
      </div>

      {/* Sticky Bottom Chat Bar */}
      <div className="p-4 sm:p-6 shrink-0 max-w-3xl mx-auto w-full">
        <form
          onSubmit={handleSend}
          className="w-full bg-[#1c1c20] rounded-2xl p-2 sm:p-2.5 border border-white/5 focus-within:border-white/20 transition-all flex items-center justify-between gap-3 shadow-lg"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ajukan pertanyaan atau buat konten"
            className="flex-1 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none px-2"
          />

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground font-mono">
              {sourcesCount} sumber
            </span>

            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10 text-foreground flex items-center justify-center transition-all cursor-pointer"
              aria-label="Kirim"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Subtle Disclaimer */}
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2.5 select-none">
          Gemini Notebook mungkin tidak akurat, jadi periksa kembali responsnya.
        </p>
      </div>
    </main>
  );
}
