import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  toast,
} from "@const/ui";
import { Eye, EyeOff, RotateCcw, Check, Key, Server, Cpu, HardDrive } from "lucide-react";
import type { UserConfig, ProviderConfig, ModelOption } from "../vite-env";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_BASE_URLS: Record<string, string> = {
  "const-engine": "https://engine.const.web.id/v1",
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  ollama: "http://localhost:11434/v1",
  custom: "",
};

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [activeTab, setActiveTab] = useState<string>("const-engine");
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Editable local state for providers
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [activeModel, setActiveModel] = useState<string>("Const");

  useEffect(() => {
    if (!isOpen) return;

    // Load configuration from main process
    if (window.electron?.getConfig) {
      window.electron.getConfig().then((cfg) => {
        setConfig(cfg);
        setProviders(cfg.providers || {});
        setActiveModel(cfg.activeModel || "Const");
        if (cfg.activeProvider) {
          setActiveTab(cfg.activeProvider);
        }
      });
    }

    // Load available models
    if (window.electron?.getModels) {
      window.electron.getModels().then((mList) => {
        setModels(mList);
      });
    }
  }, [isOpen]);

  const handleProviderChange = (key: string, field: "baseUrl" | "apiKey", value: string) => {
    setProviders((prev) => {
      const existing = prev[key] || {
        name: key,
        baseUrl: DEFAULT_BASE_URLS[key] || "",
        apiKey: "",
      };
      return {
        ...prev,
        [key]: {
          name: existing.name || key,
          baseUrl: field === "baseUrl" ? value : existing.baseUrl,
          apiKey: field === "apiKey" ? value : existing.apiKey,
        },
      };
    });
  };

  const handleResetBaseUrl = (key: string) => {
    const def = DEFAULT_BASE_URLS[key] || "";
    handleProviderChange(key, "baseUrl", def);
  };

  const toggleShowKey = (key: string) => {
    setShowApiKey((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!window.electron?.saveConfig) {
      toast.error("Config save is not supported in this environment");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await window.electron.saveConfig({
        activeProvider: activeTab,
        activeModel,
        providers,
      });
      setConfig(updated);
      toast.success("Settings saved to ~/.const/config.json");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const currentProvider = providers[activeTab] || {
    name: activeTab,
    baseUrl: "",
    apiKey: "",
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-[#1c1c1c] text-[#e0e0e0] border-[#333333] p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-[#2d2d2d]">
          <DialogTitle className="text-lg font-medium text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-[#ff7a00]" />
            Settings & Model Providers
          </DialogTitle>
          <DialogDescription className="text-xs text-[#888888]">
            Configure API keys, model endpoints, and LLM providers. Saved locally to{" "}
            <code className="px-1 py-0.5 rounded bg-[#272727] text-[#bbbbbb] font-mono text-[11px]">
              ~/.const/config.json
            </code>
          </DialogDescription>
        </DialogHeader>

        {/* Provider Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="w-full grid grid-cols-5 bg-[#252525] border border-[#333333]/70 p-1 rounded-xl">
            <TabsTrigger
              value="const-engine"
              className="text-xs data-[state=active]:bg-[#333333] data-[state=active]:text-white rounded-lg transition-all"
            >
              Const
            </TabsTrigger>
            <TabsTrigger
              value="openai"
              className="text-xs data-[state=active]:bg-[#333333] data-[state=active]:text-white rounded-lg transition-all"
            >
              OpenAI
            </TabsTrigger>
            <TabsTrigger
              value="deepseek"
              className="text-xs data-[state=active]:bg-[#333333] data-[state=active]:text-white rounded-lg transition-all"
            >
              DeepSeek
            </TabsTrigger>
            <TabsTrigger
              value="ollama"
              className="text-xs data-[state=active]:bg-[#333333] data-[state=active]:text-white rounded-lg transition-all"
            >
              Ollama
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              className="text-xs data-[state=active]:bg-[#333333] data-[state=active]:text-white rounded-lg transition-all"
            >
              Custom
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* Active Model Selector for this Provider */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#a0a0a0] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#ff7a00]" />
                Active Model
              </Label>
              <select
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                className="w-full bg-[#242424] border border-[#383838] hover:border-[#4a4a4a] text-sm text-white rounded-xl px-3 py-2 outline-none focus:border-[#ff7a00] transition-colors"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#242424] text-white">
                    {m.displayName} {m.supportsThinking ? "(Thinking)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Base URL Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[#a0a0a0] flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-[#ff7a00]" />
                  Base URL
                </Label>
                {DEFAULT_BASE_URLS[activeTab] && (
                  <button
                    type="button"
                    onClick={() => handleResetBaseUrl(activeTab)}
                    className="text-[11px] text-[#888888] hover:text-[#e0e0e0] flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to default
                  </button>
                )}
              </div>
              <Input
                type="text"
                value={currentProvider.baseUrl || ""}
                onChange={(e) => handleProviderChange(activeTab, "baseUrl", e.target.value)}
                placeholder={DEFAULT_BASE_URLS[activeTab] || "https://api.example.com/v1"}
                className="bg-[#242424] border-[#383838] focus:border-[#ff7a00] text-sm text-white rounded-xl font-mono text-xs h-10"
              />
            </div>

            {/* API Key Input */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#a0a0a0] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#ff7a00]" />
                API Key
                {activeTab === "ollama" && (
                  <span className="text-[10px] text-[#666666] font-normal">
                    (Not required for local Ollama)
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey[activeTab] ? "text" : "password"}
                  value={currentProvider.apiKey || ""}
                  onChange={(e) => handleProviderChange(activeTab, "apiKey", e.target.value)}
                  placeholder={
                    activeTab === "ollama"
                      ? "Optional for local endpoint"
                      : "Enter API key (stored in ~/.const/config.json)"
                  }
                  className="bg-[#242424] border-[#383838] focus:border-[#ff7a00] text-sm text-white rounded-xl pr-10 font-mono text-xs h-10"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey(activeTab)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777777] hover:text-white transition-colors"
                >
                  {showApiKey[activeTab] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </Tabs>

        {/* Footer info and Action buttons */}
        <div className="pt-4 mt-2 border-t border-[#2d2d2d] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-[#777777]">
            <HardDrive className="w-3.5 h-3.5 text-[#ff7a00]" />
            <span>Persistent configuration</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-[#383838] text-[#cccccc] hover:bg-[#282828] hover:text-white rounded-xl text-xs h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="bg-[#ff7a00] hover:bg-[#ff8c1a] text-white rounded-xl text-xs h-9 px-4 gap-1.5 font-medium shadow-md transition-all active:scale-[0.98]"
            >
              <Check className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
