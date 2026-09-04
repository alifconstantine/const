import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb } from "../../lib/db";
import {
  ArrowLeft,
  Share2,
  MoreVertical,
  Plus,
  FolderOpen,
  MessageSquare,
  LayoutGrid,
  Search,
  Globe,
  FileText,
  ChevronDown,
  ArrowRight,
  AudioLines,
  Presentation,
  Video,
  GitFork,
  HelpCircle,
  Award,
  BarChart3,
  Table2,
  ChevronRight,
  PenTool,
  Check,
} from "lucide-react";
import { AddSourceDialog } from "./add-source-dialog";

type WorkspaceTab = "sources" | "chat" | "tools";

interface StudioTool {
  id: string;
  name: string;
  icon: React.ElementType;
  iconColor: string;
}

const STUDIO_TOOLS: StudioTool[] = [
  { id: "audio_summary", name: "Ringkasan Audio", icon: AudioLines, iconColor: "text-indigo-400" },
  { id: "slides", name: "Slide Presentasi", icon: Presentation, iconColor: "text-amber-400" },
  { id: "video_summary", name: "Ringkasan Video", icon: Video, iconColor: "text-emerald-400" },
  { id: "mind_map", name: "Peta Pikiran", icon: GitFork, iconColor: "text-purple-400" },
  { id: "report", name: "Laporan", icon: FileText, iconColor: "text-blue-400" },
  { id: "flashcards", name: "Kartu tanya...", icon: HelpCircle, iconColor: "text-orange-400" },
  { id: "quiz", name: "Kuis", icon: Award, iconColor: "text-green-400" },
  { id: "infographic", name: "Infografis", icon: BarChart3, iconColor: "text-pink-400" },
  { id: "data_table", name: "Tabel Data", icon: Table2, iconColor: "text-cyan-400" },
];

interface MobileLearnWorkspaceProps {
  learnId: string;
  initialSourceModalOpen?: boolean;
  onBack: () => void;
  onCreateNew?: () => void;
  user?: any;
}

export function MobileLearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
}: MobileLearnWorkspaceProps) {
  // Live notebook data
  const learn = useLiveQuery(async () => {
    return await db.learns.get(learnId);
  }, [learnId]);

  // Tab & modal states
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);

  // Search & chat states
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState("Web");
  const [researchSpeed, setResearchSpeed] = useState("Riset Cepat");
  const [inputMessage, setInputMessage] = useState("");

  // Editable title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("Notebook tanpa judul");

  useEffect(() => {
    if (learn?.title) {
      setTitleValue(learn.title);
    }
  }, [learn?.title]);

  const handleSaveTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = titleValue.trim() || "Notebook tanpa judul";
    setTitleValue(trimmed);
    await localDb.updateLearn(learnId, { title: trimmed });
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim()) return;
    setInputMessage("");
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#111113] text-foreground overflow-hidden select-none">
      {/* Top Mobile Header */}
      <header className="h-14 px-4 bg-[#141416] flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {isEditingTitle ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="text-sm font-medium text-foreground bg-secondary/60 rounded-md px-2 py-1 outline-none border border-primary/50 max-w-[170px]"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-medium text-foreground hover:bg-white/5 px-2 py-1 rounded-md transition-colors cursor-pointer text-left truncate max-w-[180px]"
              title="Klik untuk mengubah judul"
            >
              {titleValue}
            </button>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddSourceOpen(true)}
            className="h-8 w-8 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tambah Sumber"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="h-8 w-8 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Bagikan"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="h-8 w-8 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Menu Opsi"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area Based on Active Tab */}
      <div className="flex-1 overflow-y-auto pb-16">
        {/* TAB 1: SUMBER */}
        {activeTab === "sources" && (
          <div className="p-4 space-y-4 max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-foreground">Sumber</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground font-mono">
                {learn?.sourcesCount || 0} sumber
              </span>
            </div>

            {/* "+ Tambahkan sumber" Button */}
            <button
              type="button"
              onClick={() => setIsAddSourceOpen(true)}
              className="w-full py-2.5 px-3 rounded-full border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-medium text-foreground flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambahkan sumber</span>
            </button>

            {/* Search Box */}
            <div className="w-full bg-[#1c1c20] rounded-xl p-3 border border-white/5 focus-within:border-white/20 transition-all text-left">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Telusuri sumber baru di web"
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none px-1 py-1"
              />
              <div className="flex items-center justify-between mt-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWebScope(webScope === "Web" ? "Jurnal" : "Web")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Globe className="h-2.5 w-2.5" />
                    <span>{webScope}</span>
                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setResearchSpeed(
                        researchSpeed === "Riset Cepat" ? "Riset Mendalam" : "Riset Cepat"
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Search className="h-2.5 w-2.5" />
                    <span>{researchSpeed}</span>
                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                  </button>
                </div>

                <button
                  type="button"
                  className="h-6 w-6 rounded-full bg-white/5 hover:bg-white/15 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Cari"
                >
                  <Search className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[220px]">
              <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground/60 mb-3">
                <FileText className="h-6 w-6 stroke-[1.5]" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                Sumber yang telah disimpan akan muncul di sini
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mb-3">
                Tambahkan file, situs, atau lainnya. Kemudian, ajukan pertanyaan atau buat sesuatu berdasarkan sumber ini.
              </p>
              <p className="text-xs text-muted-foreground">
                Lepaskan file di sini atau{" "}
                <button
                  type="button"
                  onClick={() => setIsAddSourceOpen(true)}
                  className="text-foreground underline underline-offset-2 hover:text-primary transition-colors cursor-pointer"
                >
                  tambahkan sumber
                </button>
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: CHAT */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-full justify-between p-4 max-w-lg mx-auto min-h-[calc(100vh-8rem)]">
            {/* Greeting & Prompt Chips */}
            <div className="my-auto py-6">
              <div className="text-3xl mb-3 select-none">👋</div>
              <h1 className="text-xl font-bold tracking-tight text-white mb-2">
                Mari mulai membuat notebook...
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                Dengan notebook ini, Anda dapat mulai memahami, membuat, atau mengembangkan hal baru. Anda dapat meminta bantuan saya untuk memulai atau langsung menambahkan sumber Anda sendiri.
              </p>
              <p className="text-xs text-muted-foreground/80 font-medium mb-3">
                Apa yang ingin Anda lakukan dengan notebook ini?
              </p>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setInputMessage("Pelajari topik baru")}
                  className="w-full text-left px-4 py-2.5 rounded-2xl bg-[#1a1a1e] hover:bg-[#242429] border border-white/5 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  Pelajari topik baru
                </button>
                <button
                  type="button"
                  onClick={() => setInputMessage("Buat konten baru")}
                  className="w-full text-left px-4 py-2.5 rounded-2xl bg-[#1a1a1e] hover:bg-[#242429] border border-white/5 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  Buat konten baru
                </button>
                <button
                  type="button"
                  onClick={() => setInputMessage("Lanjutkan project")}
                  className="w-full text-left px-4 py-2.5 rounded-2xl bg-[#1a1a1e] hover:bg-[#242429] border border-white/5 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  Lanjutkan project
                </button>
              </div>
            </div>

            {/* Mobile Chat Input */}
            <div className="pt-2">
              <form
                onSubmit={handleSend}
                className="w-full bg-[#1c1c20] rounded-2xl p-2 border border-white/5 focus-within:border-white/20 transition-all flex items-center justify-between gap-2 shadow-lg"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ajukan pertanyaan atau buat konten"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none px-2"
                />

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground font-mono">
                    {learn?.sourcesCount || 0} sumber
                  </span>
                  <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-foreground flex items-center justify-center transition-all cursor-pointer"
                    aria-label="Kirim"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>

              <p className="text-[9px] text-muted-foreground/50 text-center mt-2 select-none">
                Gemini Notebook mungkin tidak akurat, jadi periksa kembali responsnya.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: TOOLS (STUDIO) */}
        {activeTab === "tools" && (
          <div className="p-4 space-y-4 max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-foreground">Studio Tools</span>
            </div>

            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-2">
              {STUDIO_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className="p-2.5 rounded-xl bg-[#1c1c20] hover:bg-[#25252a] border border-white/5 transition-all flex flex-col justify-between h-20 text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon className={`h-4 w-4 ${tool.iconColor}`} />
                      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-40" />
                    </div>
                    <span className="text-[10px] font-normal text-foreground leading-tight line-clamp-2">
                      {tool.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[160px]">
              <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground/60 mb-2.5">
                <PenTool className="h-5 w-5 stroke-[1.5]" />
              </div>
              <h3 className="text-xs font-medium text-foreground mb-1">
                Output studio akan disimpan di sini.
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[240px]">
                Setelah menambahkan sumber, klik untuk menambahkan Ringkasan Audio, Panduan Belajar, Peta Pikiran, dan banyak lagi.
              </p>
            </div>

            {/* "+ Tambahkan catatan" Button */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white hover:bg-white/90 text-black text-xs font-medium transition-all shadow-md active:scale-98 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Tambahkan catatan</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM NAVIGATION BAR: Sumber, Chat, Tools */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#141416]/95 backdrop-blur-md flex items-center justify-around px-2 z-20">
        {/* Tab 1: Sumber */}
        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === "sources"
              ? "text-[#0066ff] font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderOpen className="h-5 w-5" />
          <span className="text-[10px] mt-1 tracking-tight">Sumber</span>
        </button>

        {/* Tab 2: Chat */}
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === "chat"
              ? "text-[#0066ff] font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-[10px] mt-1 tracking-tight">Chat</span>
        </button>

        {/* Tab 3: Tools */}
        <button
          type="button"
          onClick={() => setActiveTab("tools")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === "tools"
              ? "text-[#0066ff] font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-5 w-5" />
          <span className="text-[10px] mt-1 tracking-tight">Tools</span>
        </button>
      </nav>

      {/* Add Source Pop-up Modal */}
      <AddSourceDialog
        open={isAddSourceOpen}
        onOpenChange={setIsAddSourceOpen}
        onSelectSource={(sourceType) => {
          console.log("Selected source:", sourceType);
          setIsAddSourceOpen(false);
        }}
      />
    </div>
  );
}
