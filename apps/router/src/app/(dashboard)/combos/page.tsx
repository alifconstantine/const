"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  toast,
  cn,
} from "@const/ui";
import {
  GitFork,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Terminal,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Layers,
  Settings2,
  AlertCircle,
  Play,
  RotateCcw,
} from "lucide-react";

interface ComboModelEntry {
  modelId: string;
  providerId: string;
  providerName: string;
  priority: number;
}

const CONTEXT_LENGTH_PRESETS = [
  { label: "64K", value: 65536 },
  { label: "128K", value: 131072 },
  { label: "256K (Default)", value: 262144 },
  { label: "512K", value: 524288 },
  { label: "1M", value: 1048576 },
];

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${Math.round(tokens / 1024)}k`;
  return `${(tokens / (1024 * 1024)).toFixed(1)}M`;
}

export default function CombosPage() {
  const { isAuthenticated, signIn } = useRouterAuth();

  // 1. Live Convex Data
  const combos = useQuery(
    api.router.combos.listCombos,
    isAuthenticated ? {} : "skip"
  );
  const userProviders = useQuery(
    api.router.providers.listUserProviders,
    isAuthenticated ? {} : "skip"
  );

  const createComboMutation = useMutation(api.router.combos.createCombo);
  const updateComboMutation = useMutation(api.router.combos.updateCombo);
  const deleteComboMutation = useMutation(api.router.combos.deleteCombo);

  // 2. Local State
  const [activeTab, setActiveTab] = useState<"all" | "builtin" | "custom">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Wizard / Stepper Dialog State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingComboId, setEditingComboId] = useState<Id<"routerCombos"> | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [comboName, setComboName] = useState("");
  const [comboSlug, setComboSlug] = useState("");
  const [comboDescription, setComboDescription] = useState("");
  const [contextLength, setContextLength] = useState<number>(262144);
  const [systemMessage, setSystemMessage] = useState("");
  const [selectedModels, setSelectedModels] = useState<ComboModelEntry[]>([]);

  // Step 2 Selection State
  const [activeProviderId, setActiveProviderId] = useState<string>("const");
  const [modelSearch, setModelSearch] = useState("");
  const [customModelIdInput, setCustomModelIdInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<Id<"routerCombos"> | null>(null);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, slugKey: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(slugKey);
    toast.success("Copied to clipboard", {
      description: `${label} copied: ${text}`,
    });
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Open Create Wizard
  const openCreateWizard = () => {
    if (!isAuthenticated) {
      signIn();
      return;
    }
    setEditingComboId(null);
    setComboName("");
    setComboSlug("");
    setComboDescription("");
    setContextLength(262144);
    setSystemMessage("");
    setSelectedModels([
      {
        modelId: "gemini-3.6-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 1,
      },
    ]);
    setActiveProviderId("const");
    setStep(1);
    setIsWizardOpen(true);
  };

  // Open Edit Wizard for a Custom Combo
  const openEditWizard = (combo: NonNullable<typeof combos>[number]) => {
    if (combo.isBuiltin) return;
    setEditingComboId(combo._id as Id<"routerCombos">);
    setComboName(combo.name);
    setComboSlug(combo.slug);
    setComboDescription(combo.description || "");
    setContextLength(combo.contextLength || 262144);
    setSystemMessage(combo.systemMessage || "");
    setSelectedModels(
      combo.models.map((m, idx) => ({
        modelId: m.modelId,
        providerId: m.providerId,
        providerName: m.providerName,
        priority: idx + 1,
      }))
    );
    setActiveProviderId("const");
    setStep(1);
    setIsWizardOpen(true);
  };

  // Handle Name Change with Auto-Slugify
  const handleNameChange = (name: string) => {
    setComboName(name);
    if (!editingComboId) {
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/^combo\//, "")
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setComboSlug(slug);
    }
  };

  // Available Providers in Step 2: Const Gateway + Active User BYOK Providers
  const availableProviders = useMemo(() => {
    const list = [
      {
        providerId: "const",
        name: "Const Gateway",
        status: "active",
        models: [
          { modelId: "gemini-3.6-flash", name: "Gemini 3.6 Flash (Managed)" },
        ],
      },
    ];

    if (userProviders) {
      userProviders.forEach((p) => {
        const imported = (p.importedModels || [])
          .filter((m) => m.enabled)
          .map((m) => ({ modelId: m.modelId, name: m.name }));

        // Fallbacks for well-known providers if models weren't fetched yet
        const defaultModels =
          imported.length > 0
            ? imported
            : p.providerId === "openrouter"
              ? [
                  { modelId: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash" },
                  { modelId: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
                  { modelId: "deepseek/deepseek-chat", name: "DeepSeek V3" },
                  { modelId: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
                ]
              : p.providerId === "deepseek"
                ? [
                    { modelId: "deepseek-chat", name: "DeepSeek Chat" },
                    { modelId: "deepseek-reasoner", name: "DeepSeek Reasoner" },
                  ]
                : p.providerId === "google"
                  ? [
                      { modelId: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
                      { modelId: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
                    ]
                  : p.providerId === "groq"
                    ? [
                        { modelId: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
                      ]
                    : [];

        list.push({
          providerId: p.providerId,
          name: p.name,
          status: p.status,
          models: defaultModels,
        });
      });
    }

    return list;
  }, [userProviders]);

  const defaultConstProvider = {
    providerId: "const",
    name: "Const Gateway",
    status: "active",
    models: [{ modelId: "gemini-3.6-flash", name: "Gemini 3.6 Flash (Managed)" }],
  };

  const activeProvider =
    availableProviders.find((p) => p.providerId === activeProviderId) ??
    availableProviders[0] ??
    defaultConstProvider;

  // Toggle model in/out of selectedModels
  const toggleModel = (modelId: string, providerId: string, providerName: string) => {
    const existsIndex = selectedModels.findIndex(
      (m) => m.modelId === modelId && m.providerId === providerId
    );

    if (existsIndex >= 0) {
      // Remove
      setSelectedModels(selectedModels.filter((_, idx) => idx !== existsIndex));
    } else {
      // Add
      setSelectedModels([
        ...selectedModels,
        {
          modelId,
          providerId,
          providerName,
          priority: selectedModels.length + 1,
        },
      ]);
    }
  };

  const addCustomModel = () => {
    const trimmed = customModelIdInput.trim();
    if (!trimmed) return;
    if (selectedModels.some((m) => m.modelId === trimmed && m.providerId === activeProvider.providerId)) {
      toast.error("Model already added.");
      return;
    }

    setSelectedModels([
      ...selectedModels,
      {
        modelId: trimmed,
        providerId: activeProvider.providerId,
        providerName: activeProvider.name,
        priority: selectedModels.length + 1,
      },
    ]);
    setCustomModelIdInput("");
  };

  // Drag and Drop Reordering Handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newModels = [...selectedModels];
    const item = newModels[draggedIndex];
    if (!item) return;
    newModels.splice(draggedIndex, 1);
    newModels.splice(index, 0, item);
    setDraggedIndex(index);
    setSelectedModels(newModels.map((m, idx) => ({ ...m, priority: idx + 1 })));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newModels = [...selectedModels];
    const temp = newModels[index - 1];
    newModels[index - 1] = newModels[index]!;
    newModels[index] = temp!;
    setSelectedModels(newModels.map((m, idx) => ({ ...m, priority: idx + 1 })));
  };

  const moveDown = (index: number) => {
    if (index >= selectedModels.length - 1) return;
    const newModels = [...selectedModels];
    const temp = newModels[index + 1];
    newModels[index + 1] = newModels[index]!;
    newModels[index] = temp!;
    setSelectedModels(newModels.map((m, idx) => ({ ...m, priority: idx + 1 })));
  };

  const removeModel = (index: number) => {
    const newModels = selectedModels.filter((_, idx) => idx !== index);
    setSelectedModels(newModels.map((m, idx) => ({ ...m, priority: idx + 1 })));
  };

  // Submit Combo Form
  const handleSaveCombo = async () => {
    if (!comboName.trim()) {
      toast.error("Combo name is required.");
      setStep(1);
      return;
    }
    if (selectedModels.length === 0) {
      toast.error("Please add at least one model to the combo.");
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingComboId) {
        await updateComboMutation({
          id: editingComboId,
          name: comboName.trim(),
          description: comboDescription.trim() || undefined,
          systemMessage: systemMessage.trim() || undefined,
          contextLength,
          models: selectedModels.map((m, idx) => ({
            modelId: m.modelId,
            providerId: m.providerId,
            providerName: m.providerName,
            priority: idx + 1,
          })),
        });
        toast.success("Combo updated successfully", {
          description: `Virtual combo '${comboSlug}' has been updated.`,
        });
      } else {
        await createComboMutation({
          name: comboName.trim(),
          slug: comboSlug.trim() || undefined,
          description: comboDescription.trim() || undefined,
          systemMessage: systemMessage.trim() || undefined,
          contextLength,
          models: selectedModels.map((m, idx) => ({
            modelId: m.modelId,
            providerId: m.providerId,
            providerName: m.providerName,
            priority: idx + 1,
          })),
        });
        toast.success("Virtual Combo created!", {
          description: `You can now use model 'combo/${comboSlug}' in requests.`,
        });
      }

      setIsWizardOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save combo.";
      toast.error("Error saving combo", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Combo Action
  const handleDeleteCombo = async (id: Id<"routerCombos">) => {
    try {
      await deleteComboMutation({ id });
      toast.success("Combo deleted");
      setDeletingId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete combo.";
      toast.error("Error", { description: msg });
    }
  };

  // Filter combos by active tab and search query
  const filteredCombos = useMemo(() => {
    if (!combos) return [];
    let list = combos;

    if (activeTab === "builtin") {
      list = list.filter((c) => c.isBuiltin);
    } else if (activeTab === "custom") {
      list = list.filter((c) => !c.isBuiltin);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          c.models.some((m) => m.modelId.toLowerCase().includes(q))
      );
    }

    return list;
  }, [combos, activeTab, searchQuery]);

  return (
    <div className="space-y-8 select-none">
      {/* 1. Header with Editorial Title & Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-foreground tracking-tight">
            Virtual Combos.
          </h1>
          <p className="text-sm text-muted-foreground font-light">
            Resilient multi-model chains with automatic failover, priority routing, and load balancing.
          </p>
        </div>

        <Button
          onClick={openCreateWizard}
          className="rounded-full gap-2 px-5 font-sans text-xs font-medium cursor-pointer shadow-sm self-start sm:self-auto bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>Create Combo</span>
        </Button>
      </div>

      {/* 2. Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-full border border-border/70 self-start">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3.5 py-1 text-xs font-sans rounded-full transition-colors cursor-pointer",
              activeTab === "all"
                ? "bg-foreground text-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({combos?.length || 3})
          </button>
          <button
            onClick={() => setActiveTab("builtin")}
            className={cn(
              "px-3.5 py-1 text-xs font-sans rounded-full transition-colors cursor-pointer",
              activeTab === "builtin"
                ? "bg-foreground text-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            System Defaults (3)
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={cn(
              "px-3.5 py-1 text-xs font-sans rounded-full transition-colors cursor-pointer",
              activeTab === "custom"
                ? "bg-foreground text-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Custom ({(combos?.length || 3) - 3})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search combos or models..."
            className="pl-9 h-9 text-xs font-sans bg-secondary/30 rounded-xl border-border/70"
          />
        </div>
      </div>

      {/* 3. Combos Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCombos.map((combo) => {
          const modelIdKey = `combo/${combo.slug}`;
          const isCopied = copiedSlug === combo.slug;

          return (
            <Card
              key={combo._id}
              className="rounded-3xl border-border/70 bg-card p-6 flex flex-col justify-between transition-colors space-y-5 hover:border-foreground/30"
            >
              <div className="space-y-3.5">
                {/* Header Tag + Name */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                        {combo.isBuiltin ? "SYSTEM DEFAULT" : "CUSTOM ROUTE"}
                      </span>
                      {combo.isBuiltin && (
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                      )}
                    </div>
                    <h2 className="text-lg font-semibold font-sans text-foreground tracking-tight truncate">
                      {combo.name}
                    </h2>
                  </div>

                  {/* Slug Badge with Copy Action */}
                  <button
                    onClick={() => copyToClipboard(modelIdKey, combo.slug, "Model Identifier")}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary border border-border/60 text-xs font-mono text-foreground hover:bg-foreground hover:text-background transition-colors cursor-pointer shrink-0"
                    title="Click to copy model identifier"
                  >
                    <span>{modelIdKey}</span>
                    {isCopied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground font-light leading-relaxed line-clamp-2">
                  {combo.description || "Dynamic fallback route across configured models."}
                </p>

                {/* Meta Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-md bg-secondary/60 border border-border/40">
                    {formatTokens(combo.contextLength)} context
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-secondary/60 border border-border/40 uppercase">
                    {combo.strategy} fallback
                  </span>
                  {combo.systemMessage && (
                    <span className="px-2 py-0.5 rounded-md bg-secondary/60 border border-border/40 text-foreground font-sans">
                      Custom Persona
                    </span>
                  )}
                </div>

                {/* Fallback Chain Ordered List */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="text-[11px] font-sans font-medium text-muted-foreground uppercase tracking-wider">
                    Fallback Chain ({combo.models.length} Models)
                  </div>

                  <div className="space-y-1.5">
                    {combo.models.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-secondary/40 border border-border/30 text-xs font-sans"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold shrink-0",
                              idx === 0
                                ? "bg-foreground text-background"
                                : "bg-muted text-muted-foreground border border-border"
                            )}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {m.modelId}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase shrink-0 pl-2">
                          {m.providerName || m.providerId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                <Link
                  href={`/generation?model=${encodeURIComponent(modelIdKey)}`}
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-full gap-2 text-xs font-sans h-9 border-border bg-background hover:bg-secondary text-foreground cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Test in Playground</span>
                  </Button>
                </Link>

                {!combo.isBuiltin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditWizard(combo)}
                      className="rounded-full h-9 px-3 text-xs font-sans cursor-pointer hover:bg-secondary"
                    >
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(combo._id as Id<"routerCombos">)}
                      className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:text-destructive cursor-pointer hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 4. Multi-Step Step-by-Step Creation Wizard Modal */}
      <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl border-border bg-card">
          {/* Stepper Top Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-secondary/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-xs font-mono font-bold">
                {step}
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-base font-semibold font-sans text-foreground">
                  {step === 1 && (editingComboId ? "Edit Combo: Settings" : "Step 1: Identity & Configuration")}
                  {step === 2 && "Step 2: Select Models across Providers"}
                  {step === 3 && "Step 3: Priority & Fallback Order"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-light">
                  {step === 1 && "Specify the combo name, context limit, and optional system persona."}
                  {step === 2 && "Pick models across Const Gateway and your connected BYOK providers."}
                  {step === 3 && "Drag items to determine priority from Primary (Top) to Fallback (Bottom)."}
                </DialogDescription>
              </div>
            </div>

            {/* Step Pills Indicator */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full transition-colors",
                  step === 1 ? "bg-foreground text-background font-semibold" : "text-muted-foreground/60"
                )}
              >
                1
              </span>
              <span className="text-muted-foreground/40">&rarr;</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full transition-colors",
                  step === 2 ? "bg-foreground text-background font-semibold" : "text-muted-foreground/60"
                )}
              >
                2
              </span>
              <span className="text-muted-foreground/40">&rarr;</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full transition-colors",
                  step === 3 ? "bg-foreground text-background font-semibold" : "text-muted-foreground/60"
                )}
              >
                3
              </span>
            </div>
          </div>

          {/* Stepper Body Container (Strictly controlled height so it never stretches down) */}
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6 font-sans">
            {/* ──── STEP 1: IDENTITY & BASIC SETTINGS ──── */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Field 1: Combo Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Combo Name <span className="text-foreground/70">*</span>
                  </label>
                  <Input
                    value={comboName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. My Coding Assistant"
                    className="h-10 text-sm bg-secondary/30 rounded-xl border-border/70 font-sans"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground pt-0.5">
                    <span>API Model Name:</span>
                    <span className="font-semibold text-foreground">
                      combo/{comboSlug || "name"}
                    </span>
                  </div>
                </div>

                {/* Field 2: Description (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Description <span className="text-[11px] font-normal">(Optional)</span>
                  </label>
                  <Input
                    value={comboDescription}
                    onChange={(e) => setComboDescription(e.target.value)}
                    placeholder="e.g. Fast failover for coding prompts and refactoring"
                    className="h-10 text-xs bg-secondary/30 rounded-xl border-border/70 font-sans"
                  />
                </div>

                {/* Field 3: Context Length Limit (Default 256K) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      Context Length Limit
                    </label>
                    <span className="text-xs font-mono font-medium text-foreground">
                      {formatTokens(contextLength)} tokens
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CONTEXT_LENGTH_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setContextLength(preset.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-sans transition-colors cursor-pointer border",
                          contextLength === preset.value
                            ? "bg-foreground text-background font-medium border-foreground shadow-sm"
                            : "bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-light">
                    Requests exceeding this window can be automatically truncated or routed to larger models. Default is 256K.
                  </p>
                </div>

                {/* Field 4: System Message (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      System Message / Persona <span className="text-[11px] font-normal">(Optional)</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">Injected if empty</span>
                  </div>
                  <Textarea
                    value={systemMessage}
                    onChange={(e) => setSystemMessage(e.target.value)}
                    placeholder="e.g. You are an expert software engineer. Always return clean, type-safe TypeScript code without fluff."
                    rows={3}
                    className="text-xs bg-secondary/30 rounded-xl border-border/70 resize-none font-sans"
                  />
                </div>
              </div>
            )}

            {/* ──── STEP 2: SELECT MODELS ACROSS PROVIDERS ──── */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Provider Selector Tabs */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">
                    1. Select Provider:
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-secondary/50 border border-border/60">
                    {availableProviders.map((prov) => (
                      <button
                        key={prov.providerId}
                        type="button"
                        onClick={() => {
                          setActiveProviderId(prov.providerId);
                          setModelSearch("");
                        }}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-xs font-sans transition-colors cursor-pointer",
                          activeProviderId === prov.providerId
                            ? "bg-foreground text-background font-semibold shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {prov.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Catalog for Active Provider */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      2. Add models from {activeProvider.name}:
                    </label>
                    <span className="text-xs font-mono text-muted-foreground">
                      {activeProvider.models.length} available
                    </span>
                  </div>

                  {/* Search within provider */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder={`Search models in ${activeProvider.name}...`}
                      className="pl-9 h-8 text-xs bg-secondary/30 rounded-xl border-border/60"
                    />
                  </div>

                  {/* Models list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {activeProvider.models
                      .filter((m) =>
                        m.modelId.toLowerCase().includes(modelSearch.toLowerCase()) ||
                        m.name.toLowerCase().includes(modelSearch.toLowerCase())
                      )
                      .map((m) => {
                        const isChecked = selectedModels.some(
                          (sm) => sm.modelId === m.modelId && sm.providerId === activeProvider.providerId
                        );

                        return (
                          <div
                            key={m.modelId}
                            onClick={() => toggleModel(m.modelId, activeProvider.providerId, activeProvider.name)}
                            className={cn(
                              "p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2",
                              isChecked
                                ? "bg-foreground text-background border-foreground font-medium shadow-sm"
                                : "bg-secondary/20 hover:bg-secondary border-border/50 text-foreground"
                            )}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="text-xs truncate">{m.name}</div>
                              <div className={cn("text-[10px] font-mono truncate", isChecked ? "text-background/80" : "text-muted-foreground")}>
                                {m.modelId}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center shrink-0 border",
                                isChecked
                                  ? "bg-background text-foreground border-background"
                                  : "border-border/80"
                              )}
                            >
                              {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Option to Add Custom Model Name Manually */}
                  <div className="pt-2 border-t border-border/50 flex items-center gap-2">
                    <Input
                      value={customModelIdInput}
                      onChange={(e) => setCustomModelIdInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomModel()}
                      placeholder={`Custom model identifier for ${activeProvider.name}...`}
                      className="h-8 text-xs bg-secondary/30 rounded-xl border-border/60"
                    />
                    <Button
                      size="sm"
                      type="button"
                      onClick={addCustomModel}
                      className="rounded-xl h-8 px-3 text-xs font-sans cursor-pointer shrink-0"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      <span>Add</span>
                    </Button>
                  </div>
                </div>

                {/* Selected Models Pool Summary */}
                <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Selected Pool ({selectedModels.length} models)
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Click to remove
                    </span>
                  </div>

                  {selectedModels.length === 0 ? (
                    <div className="text-xs text-muted-foreground font-light py-2 text-center">
                      No models selected yet. Pick at least one model above.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedModels.map((sm, idx) => (
                        <span
                          key={`${sm.providerId}_${sm.modelId}`}
                          onClick={() => removeModel(idx)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-sans font-medium cursor-pointer hover:bg-foreground/80 transition-colors"
                        >
                          <span className="text-[10px] font-mono uppercase opacity-75">
                            {sm.providerName}:
                          </span>
                          <span>{sm.modelId}</span>
                          <span className="opacity-60">&times;</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ──── STEP 3: PRIORITY & FALLBACK DRAG-AND-DROP ──── */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    Arrange Priority Order (Top is Primary, Bottom is Fallback):
                  </label>
                  <p className="text-[11px] text-muted-foreground font-light">
                    Drag items or use the up/down arrows to position your primary target and fallback failovers.
                  </p>
                </div>

                {/* Reorderable List */}
                <div className="space-y-2">
                  {selectedModels.map((model, idx) => (
                    <div
                      key={`${model.providerId}_${model.modelId}`}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 bg-card",
                        draggedIndex === idx
                          ? "opacity-40 border-dashed border-foreground"
                          : "border-border/70 hover:border-foreground/40",
                        idx === 0 && "ring-1 ring-foreground/20"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                          <GripVertical className="h-4 w-4" />
                        </div>

                        {/* Priority Rank */}
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md text-xs font-mono font-semibold shrink-0",
                            idx === 0
                              ? "bg-foreground text-background"
                              : "bg-secondary text-foreground border border-border"
                          )}
                        >
                          {idx === 0 ? "1 PRIMARY" : `${idx + 1} FALLBACK`}
                        </span>

                        {/* Model Info */}
                        <div className="min-w-0">
                          <div className="text-xs font-medium font-sans text-foreground truncate">
                            {model.modelId}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground uppercase">
                            Provider: {model.providerName}
                          </div>
                        </div>
                      </div>

                      {/* Ordering Controls & Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0}
                          className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                          title="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(idx)}
                          disabled={idx === selectedModels.length - 1}
                          className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                          title="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeModel(idx)}
                          disabled={selectedModels.length <= 1}
                          className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-20 cursor-pointer"
                          title="Remove from combo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Visual Fallback Diagram Preview */}
                <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 space-y-2">
                  <div className="text-xs font-semibold font-sans text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-foreground" />
                    <span>Dynamic Execution Flow</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono pt-1">
                    {selectedModels.map((m, idx) => (
                      <span key={idx} className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-lg bg-card border border-border text-foreground font-medium">
                          {idx + 1}. {m.modelId} ({m.providerName})
                        </span>
                        {idx < selectedModels.length - 1 && (
                          <span className="text-muted-foreground">&rarr;</span>
                        )}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-muted-foreground font-light pt-1">
                    If Target #1 encounters HTTP 429 (Rate Limit) or HTTP 5xx (Outage), Const Router automatically retries with Target #2 within milliseconds.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Footer Navigation */}
          <DialogFooter className="p-4 px-6 border-t border-border/60 bg-secondary/10 flex flex-row items-center justify-between sm:justify-between">
            {step === 1 && (
              <>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="rounded-full text-xs font-sans cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!comboName.trim()) {
                      toast.error("Please enter a combo name.");
                      return;
                    }
                    setStep(2);
                  }}
                  className="rounded-full text-xs font-sans gap-2 px-5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <span>Next: Select Models</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-full text-xs font-sans cursor-pointer"
                >
                  &larr; Back
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (selectedModels.length === 0) {
                      toast.error("Please add at least one model to the combo.");
                      return;
                    }
                    setStep(3);
                  }}
                  className="rounded-full text-xs font-sans gap-2 px-5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <span>Next: Priority Order ({selectedModels.length})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-full text-xs font-sans cursor-pointer"
                >
                  &larr; Back
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSaveCombo}
                  className="rounded-full text-xs font-sans gap-2 px-6 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>{editingComboId ? "Update Combo" : "Create Combo"}</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Delete Confirmation Dialog */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border bg-card p-6 space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground font-sans">
              Delete Virtual Combo?
            </h3>
            <p className="text-xs text-muted-foreground font-light">
              Are you sure you want to delete this combo? Any client calls referencing this combo model ID will return a 404 error.
            </p>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingId(null)}
              className="rounded-full text-xs cursor-pointer font-sans"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingId && handleDeleteCombo(deletingId)}
              className="rounded-full text-xs cursor-pointer font-sans"
            >
              Delete Combo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
