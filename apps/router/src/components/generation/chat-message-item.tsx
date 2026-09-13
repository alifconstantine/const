"use client";

import { useState } from "react";
import { Button, cn, toast } from "@const/ui";
import { Copy, Check, ChevronDown, ChevronRight, Pencil, FileText, Film, Music, File, Globe, ExternalLink } from "lucide-react";
import { MarkdownContent } from "./markdown-content";

export interface ChatAttachment {
  name: string;
  type: string;
  size: number;
  url?: string;
  dataUrl?: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinkingContent?: string;
  isSearching?: boolean;
  searchQuery?: string;
  searchResults?: SearchResultItem[];
  attachments?: ChatAttachment[];
  createdAt: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  isLast?: boolean;
  onEditPrompt?: (content: string) => void;
}

export function ChatMessageItem({
  message,
  isStreaming,
  isLast,
  onEditPrompt,
}: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);

  const isUser = message.role === "user";
  const hasThinking = Boolean(message.thinkingContent && message.thinkingContent.trim().length > 0);
  const hasAttachments = Boolean(message.attachments && message.attachments.length > 0);
  const hasSources = Boolean(message.searchResults && message.searchResults.length > 0);
  const isSearching = Boolean(message.isSearching);

  const handleCopy = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. User Message Layout (Matching Image 1: pill bubble on right, with Copy & Edit icons below)
  if (isUser) {
    return (
      <div className="w-full flex flex-col items-end my-4 space-y-1.5 select-text">
        <div className="max-w-[88%] sm:max-w-[78%] bg-secondary text-foreground px-5 py-3.5 rounded-3xl text-sm sm:text-base font-sans leading-relaxed border border-border/60 shadow-sm whitespace-pre-wrap break-words space-y-3">
          {/* Attachments (Images, Media, Documents) */}
          {hasAttachments && (
            <div className="flex flex-wrap gap-2 pt-1">
              {message.attachments?.map((att, idx) => {
                const isImg =
                  att.type.startsWith("image/") ||
                  att.dataUrl?.startsWith("data:image/") ||
                  /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name);
                const isVideo =
                  att.type.startsWith("video/") ||
                  /\.(mp4|webm|mov)$/i.test(att.name);
                const isAudio =
                  att.type.startsWith("audio/") ||
                  /\.(mp3|wav|ogg|m4a)$/i.test(att.name);

                if (isImg && att.dataUrl) {
                  return (
                    <div key={idx} className="overflow-hidden rounded-2xl border border-border/60 shadow-sm max-w-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="max-h-56 w-auto object-cover rounded-2xl"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-background/70 border border-border/60 text-xs font-sans select-none"
                  >
                    {isVideo ? (
                      <Film className="h-4 w-4 text-foreground shrink-0" />
                    ) : isAudio ? (
                      <Music className="h-4 w-4 text-foreground shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-foreground shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="truncate font-medium text-foreground max-w-[160px]">
                        {att.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatFileSize(att.size)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {message.content && <div>{message.content}</div>}
        </div>

        {/* Action icons below user bubble */}
        <div className="flex items-center gap-1 pr-2 text-muted-foreground">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 rounded-full hover:text-foreground hover:bg-secondary cursor-pointer"
            title="Copy prompt"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>

          {onEditPrompt && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditPrompt(message.content)}
              className="h-7 w-7 rounded-full hover:text-foreground hover:bg-secondary cursor-pointer"
              title="Edit prompt"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 2. Assistant Message Layout (Matching Image 1: pure text flow, borderless, non-card Thought Process)
  return (
    <div className="w-full my-4 space-y-2.5 select-text">
      {/* Real-time Tool Call / Web Searching Indicator */}
      {isSearching && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-blue-500/30 text-xs font-sans text-muted-foreground animate-pulse select-none my-1">
          <Globe className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />
          <span>Searching the web {message.searchQuery ? <>for <strong className="text-foreground font-medium">"{message.searchQuery}"</strong></> : "..."}</span>
        </div>
      )}

      {/* Grounded Sources Accordion / Pill */}
      {hasSources && message.searchResults && (
        <div className="py-1 my-0.5 select-none">
          <button
            type="button"
            onClick={() => setIsSourcesOpen(!isSourcesOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 hover:bg-secondary border border-border/70 text-xs font-sans text-muted-foreground hover:text-foreground transition-all cursor-pointer group"
          >
            <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="font-medium text-foreground/90">
              Searched {message.searchResults.length} {message.searchResults.length === 1 ? "source" : "sources"}
            </span>
            {message.searchQuery && (
              <span className="text-muted-foreground text-[11px] truncate max-w-[200px] hidden sm:inline">
                • "{message.searchQuery}"
              </span>
            )}
            {isSourcesOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground ml-0.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground ml-0.5" />
            )}
          </button>

          {isSourcesOpen && (
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 animate-in fade-in zoom-in-95 duration-150">
              {message.searchResults.map((source, sIdx) => {
                let hostname = "";
                try {
                  hostname = new URL(source.url).hostname.replace(/^www\./, "");
                } catch {
                  hostname = source.url;
                }
                return (
                  <a
                    key={sIdx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col p-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/80 border border-border/60 hover:border-blue-500/40 transition-all text-xs group"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                        alt=""
                        className="h-3.5 w-3.5 rounded shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <span className="truncate max-w-[150px]">{hostname}</span>
                      <ExternalLink className="h-2.5 w-2.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                    </div>
                    <span className="font-medium text-foreground group-hover:text-primary line-clamp-2 leading-snug">
                      {source.title || source.url}
                    </span>
                    {source.snippet && (
                      <span className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-1 leading-normal">
                        {source.snippet}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Thinking Process (Non-card, inline minimal layout) */}
      {isStreaming && isLast && !message.content && hasThinking && (
        <div className="flex items-center gap-2 text-xs sm:text-sm font-sans text-muted-foreground py-1 animate-pulse select-none">
          <span className="inline-block w-2 h-2 rounded-full bg-foreground animate-ping" />
          <span>Thinking...</span>
        </div>
      )}

      {hasThinking && (
        <div className="py-1">
          <button
            onClick={() => setIsThinkingOpen(!isThinkingOpen)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none py-1 group"
          >
            {isThinkingOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            )}
            <span className="font-medium text-foreground/80 group-hover:text-foreground">Thought Process</span>
            {isStreaming && isLast && !message.content && (
              <span className="text-xs text-foreground animate-pulse font-mono">(active)</span>
            )}
          </button>

          {isThinkingOpen && (
            <div className="ml-1 pl-4 border-l-2 border-border/70 text-xs sm:text-sm font-sans py-2 my-1.5 max-h-80 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
              <MarkdownContent
                content={message.thinkingContent || ""}
                isStreaming={isStreaming && isLast && !message.content}
                compact
              />
            </div>
          )}
        </div>
      )}

      {/* Main Response Text Content (Frameless, clean typography with Markdown formatting) */}
      {message.content ? (
        <div className="text-sm sm:text-base font-sans text-foreground leading-relaxed selection:bg-primary selection:text-primary-foreground">
          <MarkdownContent
            content={message.content}
            isStreaming={isStreaming && isLast}
          />
          {isStreaming && isLast && (
            <span className="inline-block w-2 h-4 ml-1 bg-foreground animate-pulse align-middle" />
          )}
        </div>
      ) : (
        isStreaming &&
        isLast &&
        !hasThinking && (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-sans text-muted-foreground py-1">
            <span className="inline-block w-2 h-4 bg-foreground animate-pulse" />
            <span>Generating response...</span>
          </div>
        )
      )}

      {/* Assistant Copy Action */}
      {message.content && !isStreaming && (
        <div className="pt-2 flex items-center gap-1 text-muted-foreground">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 rounded-full hover:text-foreground hover:bg-secondary cursor-pointer"
            title="Copy response"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
}
