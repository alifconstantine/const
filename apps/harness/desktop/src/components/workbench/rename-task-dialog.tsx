import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

interface RenameTaskDialogProps {
  open: boolean;
  currentTitle: string;
  onClose: () => void;
  onConfirm: (newTitle: string) => void;
}

export function RenameTaskDialog({
  open,
  currentTitle,
  onClose,
  onConfirm,
}: RenameTaskDialogProps) {
  const [title, setTitle] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, currentTitle]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onConfirm(title.trim());
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#1f1f1f] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e2e4] dark:border-[#2e2e2e] bg-[#fafafa] dark:bg-[#222222]">
          <h2 className="text-[15px] font-semibold text-[#161616] dark:text-[#ececec]">
            Rename Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#888888] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#777777] dark:text-[#969696]">
              Task Title
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#e2e2e4] dark:border-[#383838] text-[14px] text-[#161616] dark:text-[#d4d4d4] placeholder-[#888888] dark:placeholder-[#5d5d5d] focus:outline-none focus:border-[#555555] transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[#e2e2e4] dark:border-[#383838] text-xs font-medium text-[#666666] dark:text-[#a0a0a0] hover:text-[#161616] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || title.trim() === currentTitle}
              className="px-4 py-1.5 rounded-xl bg-[#161616] dark:bg-[#d4d4d4] text-white dark:text-[#161616] text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
