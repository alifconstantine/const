import React, { useState } from "react";
import { Search, FileText, Globe, Plus, ExternalLink } from "lucide-react";
import { Button, Input } from "@const/ui";

interface SourcesViewProps {
  onAddSource?: () => void;
}

export function SourcesView({ onAddSource }: SourcesViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="w-full h-full flex flex-col min-h-0 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-normal tracking-tight text-[#262626] dark:text-white">
            Sources
          </h2>
          <p className="text-xs text-[#8a8a8a] dark:text-[#888888] mt-0.5">
            Kumpulan dokumen, tautan riset web, dan referensi belajar Anda.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8a8a8a] dark:text-[#777777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari sumber referensi..."
              className="h-8 w-52 sm:w-64 pl-8 pr-3 text-xs rounded-xl bg-white dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] placeholder-[#8a8a8a] dark:placeholder-[#777777] focus-visible:ring-1 focus-visible:ring-[#888888]"
            />
          </div>

          {onAddSource && (
            <Button
              size="sm"
              onClick={onAddSource}
              className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-[#262626] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-zinc-200 cursor-pointer shadow-none"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tambah Sumber</span>
            </Button>
          )}
        </div>
      </div>

      {/* Sources Content / Empty State (Zero Dummy Data) */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-[#dedee2] dark:border-[#383838] bg-white/40 dark:bg-[#1e1e1e]/40 min-h-[320px]">
        <div className="w-12 h-12 rounded-2xl bg-[#f4f4f6] dark:bg-[#282828] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#737373] dark:text-[#888888] mb-3">
          <FileText className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-medium text-[#262626] dark:text-white mb-1">
          Belum ada sumber tersimpan
        </h3>
        <p className="text-xs text-[#8a8a8a] dark:text-[#888888] max-w-md leading-relaxed mb-4">
          Tautkan artikel web, berkas PDF, dokumen markdown, atau catatan riset ke dalam notebook belajar Anda untuk mulai melakukan penalaran berbasis bukti dengan agen AI.
        </p>
        {onAddSource && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSource}
            className="rounded-xl text-xs border-[#dedee2] dark:border-[#383838] hover:bg-[#eaeaea] dark:hover:bg-[#2c2c2c] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>Tambahkan sumber pertama</span>
          </Button>
        )}
      </div>
    </div>
  );
}
