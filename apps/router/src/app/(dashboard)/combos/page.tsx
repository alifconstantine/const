"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import {
  Button,
  Input,
  Textarea,
  ScrollArea,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Skeleton,
  toast,
  cn,
} from "@const/ui";
import {
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ArrowRight,
  ArrowLeft,
  Play,
  X,
  ShieldCheck,
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

  // 2. Filter & Search State
  const [activeTab, setActiveTab] = useState<"all" | "builtin" | "custom">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // 3. Wizard Dialog State (4 Strict Stages)
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingComboId, setEditingComboId] = useState<Id<"routerCombos"> | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [comboName, setComboName] = useState("");
  const [comboSlug, setComboSlug] = useState("");
  const [comboDescription, setComboDescription] = useState("");
  const [contextLength, setContextLength] = useState<number>(262144);
  const [systemMessage, setSystemMessage] = useState("");
  const [selectedModels, setSelectedModels] = useState<ComboModelEntry[]>([]);

  // Stage 2 Builder State (Provider & Model Selectors)
  const [builderProviderId, setBuilderProviderId] = useState<string>("const");
  const [builderModelId, setBuilderModelId] = useState<string>("gemini-3.6-flash");
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

  // Open Create Wizard (Starts strictly with 0 models!)
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
    setSelectedModels([]); // Starts with 0 models
    setBuilderProviderId("const");
    setBuilderModelId("gemini-3.6-flash");
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
    setBuilderProviderId("const");
    setBuilderModelId("gemini-3.6-flash");
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

  // Available Providers for Stage 2: Const Gateway + Active User BYOK Providers
  const availableProviders = useMemo(() => {
    const list = [
      {
        providerId: "const",
        name: "Const Gateway",
        status: "active",
        models: [
          { modelId: "gemini-3.6-flash", name: "Gemini 3.6 Flash (Managed)" },
          { modelId: "gemini-3.7-flash", name: "Gemini 3.7 Flash (Managed)" },
          { modelId: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Managed)" },
        ],
      },
    ];

    if (userProviders) {
      userProviders.forEach((p) => {
        if (p.status !== "active") return;
        const imported = (p.importedModels || [])
          .filter((m) => m.enabled)
          .map((m) => ({ modelId: m.modelId, name: m.name || m.modelId }));

        // Safe defaults if importedModels was empty
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

        if (defaultModels.length > 0) {
          list.push({
            providerId: p.providerId,
            name: p.name || p.providerId,
            status: p.status,
            models: defaultModels,
          });
        }
      });
    }

    return list;
  }, [userProviders]);

  const selectedBuilderProvider = useMemo(() => {
    return (
      availableProviders.find((p) => p.providerId === builderProviderId) ??
      availableProviders[0]!
    );
  }, [availableProviders, builderProviderId]);

  // When provider changes, ensure model select points to a valid model
  const handleProviderChange = (newProviderId: string) => {
    setBuilderProviderId(newProviderId);
    const targetProv = availableProviders.find((p) => p.providerId === newProviderId);
    if (targetProv && targetProv.models.length > 0) {
      setBuilderModelId(targetProv.models[0]!.modelId);
    } else {
      setBuilderModelId("");
    }
  };

  // Live Candidate Step
  const builderCandidateStep = useMemo(() => {
    if (!builderModelId || !selectedBuilderProvider) return null;
    const modelObj = selectedBuilderProvider.models.find(
      (m) => m.modelId === builderModelId
    );
    return {
      modelId: builderModelId,
      modelName: modelObj?.name || builderModelId,
      providerId: selectedBuilderProvider.providerId,
      providerName: selectedBuilderProvider.name,
    };
  }, [builderModelId, selectedBuilderProvider]);

  // Duplicate Check
  const builderHasDuplicate = useMemo(() => {
    if (!builderCandidateStep) return false;
    return selectedModels.some(
      (m) =>
        m.modelId === builderCandidateStep.modelId &&
        m.providerId === builderCandidateStep.providerId
    );
  }, [builderCandidateStep, selectedModels]);

  // Add Step Action
  const handleAddBuilderStep = () => {
    if (!builderCandidateStep || builderHasDuplicate) return;
    setSelectedModels((prev) => [
      ...prev,
      {
        modelId: builderCandidateStep.modelId,
        providerId: builderCandidateStep.providerId,
        providerName: builderCandidateStep.providerName,
        priority: prev.length + 1,
      },
    ]);
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

  // Remove any model freely (no artificial disabled restriction!)
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
    <div className="space-y-8">
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
        <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-full self-start">
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
            className="pl-9 h-9 text-xs font-sans bg-secondary/30 rounded-xl border-none"
          />
        </div>
      </div>

      {/* 3. Combos Grid List — BORDERLESS CONSISTENT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {combos === undefined ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[340px] rounded-3xl border-none bg-secondary/35 p-6 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-5 w-40 rounded-md" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-full rounded-md" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-md" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
              <div className="pt-2">
                <Skeleton className="h-9 w-full rounded-full" />
              </div>
            </div>
          ))
        ) : filteredCombos.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-secondary/20 rounded-3xl p-8 space-y-3">
            <p className="text-sm font-medium text-foreground">No virtual combos found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `No combos match "${searchQuery}". Try a different search term.`
                : "Create your first virtual combo to set up resilient multi-model failover chains."}
            </p>
          </div>
        ) : (
          filteredCombos.map((combo) => {
          const modelIdKey = `combo/${combo.slug}`;
          const isCopied = copiedSlug === combo.slug;

          return (
            <div
              key={combo._id}
              className="h-[340px] rounded-3xl border-none bg-secondary/35 hover:bg-secondary/50 p-6 flex flex-col justify-between transition-all"
            >
              <div className="space-y-3">
                {/* Header Tag + Name */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                        {combo.isBuiltin ? "SYSTEM DEFAULT" : "CUSTOM ROUTE"}
                      </span>
                      {combo.isBuiltin && (
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                      )}
                    </div>
                    <h2 className="text-base font-semibold font-sans text-foreground tracking-tight truncate">
                      {combo.name}
                    </h2>
                  </div>

                  {/* Slug Badge with Copy Action */}
                  <button
                    onClick={() => copyToClipboard(modelIdKey, combo.slug, "Model Identifier")}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/70 text-xs font-mono text-foreground hover:bg-foreground hover:text-background transition-colors cursor-pointer shrink-0"
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
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-md bg-background/50 text-foreground">
                    {formatTokens(combo.contextLength)} context
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-background/50 uppercase">
                    {combo.strategy} fallback
                  </span>
                  {combo.systemMessage && (
                    <span className="px-2 py-0.5 rounded-md bg-background/50 text-foreground font-sans">
                      Custom Persona
                    </span>
                  )}
                </div>

                {/* Fallback Chain Ordered List (Fixed Height with Scroll so Cards Align Perfectly) */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-sans font-medium text-muted-foreground uppercase tracking-wider">
                    Fallback Chain ({combo.models.length} Model{combo.models.length === 1 ? "" : "s"})
                  </div>

                  <ScrollArea className="h-[96px] pr-2">
                    <div className="space-y-1.5 py-0.5">
                      {combo.models.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-background/50 text-xs font-sans"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-semibold shrink-0",
                                idx === 0
                                  ? "bg-foreground text-background"
                                  : "bg-muted text-muted-foreground"
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
                  </ScrollArea>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <Link
                  href={`/generation?model=${encodeURIComponent(modelIdKey)}`}
                  className="flex-1"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full rounded-full gap-2 text-xs font-sans h-9 bg-background/70 hover:bg-background text-foreground cursor-pointer shadow-none"
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
                      className="rounded-full h-9 px-3 text-xs font-sans cursor-pointer hover:bg-background/80"
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
            </div>
          );
        })
      )}
      </div>

      {/* 4. Multi-Step Creation Wizard Modal (OmniRoute 4-Stage Reference) */}
      <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl border-none bg-card shadow-2xl">
          {/* Top Modal Header: Clean Title + Built-in Close */}
          <div className="px-6 pt-5 pb-3 bg-secondary/30">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-base font-semibold font-sans text-foreground">
                {editingComboId ? "Edit Combo" : "Create Combo"}
              </DialogTitle>
            </div>

            {/* Stage Indicator Pills */}
            <div className="grid grid-cols-4 gap-2 pt-3">
              {[
                { s: 1, label: "Identity" },
                { s: 2, label: "Models" },
                { s: 3, label: "Settings" },
                { s: 4, label: "Review" },
              ].map((item) => {
                const isCompleted = step > item.s;
                const isCurrent = step === item.s;
                const isPending = step < item.s;

                return (
                  <button
                    key={item.s}
                    type="button"
                    onClick={() => {
                      if (isCompleted) setStep(item.s as any);
                    }}
                    disabled={isPending}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-left transition-all",
                      isCurrent && "bg-background shadow-sm ring-1 ring-primary/40",
                      isCompleted && "bg-secondary/40 hover:bg-secondary cursor-pointer",
                      isPending && "bg-secondary/20 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground truncate">
                      {isCompleted && "DONE"}
                      {isCurrent && "CURRENT"}
                      {isPending && "PENDING"}
                    </div>
                    <div className="text-xs font-semibold font-sans text-foreground truncate mt-0.5">
                      {item.s}. {item.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stepper Body Container (Strictly Bounded Constant Height: 440px) */}
          <div className="h-[430px] p-6 flex flex-col justify-between overflow-hidden font-sans">
            <ScrollArea className="flex-1 -mr-3 pr-3">
              <div className="space-y-4 pr-1 py-1">
                {/* ──── STAGE 1: NAME & DESCRIPTION ──── */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold text-foreground">
                        Combo Identity
                      </h3>
                      <p className="text-xs text-muted-foreground font-light">
                        Choose a name and route identifier for your combo.
                      </p>
                    </div>

                    {/* Combo Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Name <span className="text-foreground/70">*</span>
                      </label>
                      <Input
                        value={comboName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. Production Fallback Route"
                        className="h-10 text-sm bg-secondary/30 rounded-xl border border-border/70 hover:border-foreground/30 focus-visible:border-foreground/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/15 font-sans transition-colors"
                      />
                      <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground pt-0.5">
                        <span>API Identifier:</span>
                        <span className="font-semibold text-foreground">
                          combo/{comboSlug || "name"}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Description <span className="text-[11px] font-normal">(Optional)</span>
                      </label>
                      <Input
                        value={comboDescription}
                        onChange={(e) => setComboDescription(e.target.value)}
                        placeholder="e.g. High availability route with sub-second failover"
                        className="h-10 text-xs bg-secondary/30 rounded-xl border border-border/70 hover:border-foreground/30 focus-visible:border-foreground/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/15 font-sans transition-colors"
                      />
                    </div>
                  </div>
                )}

              {/* ──── STAGE 2: SELECTION OF PROVIDER & MODEL ──── */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-foreground">
                      Add Models
                    </h3>
                    <p className="text-xs text-muted-foreground font-light">
                      Select provider and model to append to your execution chain.
                    </p>
                  </div>

                  {/* Builder Card with @const/ui Select Dropdowns */}
                  <div className="p-4 rounded-2xl bg-secondary/30 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. PROVIDER */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          1. Provider
                        </label>
                        <Select
                          value={builderProviderId}
                          onValueChange={handleProviderChange}
                        >
                          <SelectTrigger className="h-10 rounded-xl bg-background border border-border/70 hover:border-foreground/30 focus:border-foreground/40 focus:ring-1 focus:ring-inset focus:ring-foreground/15 text-xs font-sans text-foreground transition-colors">
                            <SelectValue placeholder="Select Provider" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-popover text-xs">
                            {availableProviders.map((prov) => (
                              <SelectItem
                                key={prov.providerId}
                                value={prov.providerId}
                                className="cursor-pointer"
                              >
                                {prov.name} ({prov.models.length} model{prov.models.length === 1 ? "" : "s"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 2. MODEL */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          2. Model
                        </label>
                        <Select
                          value={builderModelId}
                          onValueChange={setBuilderModelId}
                        >
                          <SelectTrigger className="h-10 rounded-xl bg-background border border-border/70 hover:border-foreground/30 focus:border-foreground/40 focus:ring-1 focus:ring-inset focus:ring-foreground/15 text-xs font-sans text-foreground transition-colors">
                            <SelectValue placeholder="Select Model" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-popover text-xs max-h-56">
                            {(selectedBuilderProvider?.models || []).map((m) => (
                              <SelectItem
                                key={m.modelId}
                                value={m.modelId}
                                className="cursor-pointer"
                              >
                                {m.name} · <span className="font-mono opacity-70">{m.modelId}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Preview Box & Add Step Button */}
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background/60">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">
                          Candidate
                        </div>
                        <div className="text-xs font-medium text-foreground truncate mt-0.5">
                          {builderCandidateStep
                            ? `${builderCandidateStep.providerName} / ${builderCandidateStep.modelId}`
                            : "Choose a model"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {builderHasDuplicate && (
                          <span className="text-[11px] text-amber-500">
                            Already added
                          </span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          disabled={!builderCandidateStep || builderHasDuplicate}
                          onClick={handleAddBuilderStep}
                          className="rounded-xl px-4 text-xs font-sans font-medium cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          <span>Add Step</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Execution Order List (Fixed Height with Scroll) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        Execution Chain ({selectedModels.length} Model{selectedModels.length === 1 ? "" : "s"})
                      </span>
                      <span className="text-[10px] text-muted-foreground font-light">
                        {selectedModels.length > 0 ? "Step 1 is primary; steps 2+ are failovers" : "Add at least 1 model"}
                      </span>
                    </div>

                    <ScrollArea className="h-[150px] pr-2">
                      <div className="space-y-1.5 py-0.5">
                        {selectedModels.length === 0 ? (
                          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-secondary/20 text-muted-foreground text-xs font-light">
                            No models added yet. Select a provider and model above, then click &quot;Add Step&quot;.
                          </div>
                        ) : (
                          selectedModels.map((model, idx) => (
                            <div
                              key={`${model.providerId}_${model.modelId}_${idx}`}
                              draggable
                              onDragStart={() => handleDragStart(idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                "p-2.5 rounded-2xl flex items-center justify-between gap-3 bg-secondary/30 transition-all",
                                draggedIndex === idx && "opacity-40"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                                  <GripVertical className="h-3.5 w-3.5" />
                                </div>

                                <span className="w-4 text-xs font-mono font-bold text-foreground text-center shrink-0">
                                  {idx + 1}
                                </span>

                                <div className="min-w-0">
                                  <div className="text-xs font-medium font-sans text-foreground truncate">
                                    {model.providerName} / {model.modelId}
                                  </div>
                                  <div className="text-[9px] font-mono text-muted-foreground uppercase">
                                    {idx === 0 ? "Primary Target" : "Failover Target"}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => moveUp(idx)}
                                  disabled={idx === 0}
                                  className="p-1 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                                  title="Move up"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveDown(idx)}
                                  disabled={idx === selectedModels.length - 1}
                                  className="p-1 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                                  title="Move down"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeModel(idx)}
                                  className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer ml-1"
                                  title="Remove step"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}

              {/* ──── STAGE 3: SYSTEM PROMPT & CONTEXT WINDOW ──── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-foreground">
                      Configuration
                    </h3>
                    <p className="text-xs text-muted-foreground font-light">
                      Set context window limits and optional default persona.
                    </p>
                  </div>

                  {/* Context Length Limit */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">
                        Context Limit
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
                            "px-3 py-1.5 rounded-xl text-xs font-sans transition-colors cursor-pointer",
                            contextLength === preset.value
                              ? "bg-foreground text-background font-medium shadow-sm"
                              : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* System Message */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">
                        System Prompt <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground font-mono">Injected if empty</span>
                    </div>
                    <Textarea
                      value={systemMessage}
                      onChange={(e) => setSystemMessage(e.target.value)}
                      placeholder="e.g. You are an expert engineer. Always return clean, type-safe solutions."
                      rows={4}
                      className="text-xs bg-secondary/30 rounded-xl border border-border/70 hover:border-foreground/30 focus-visible:border-foreground/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/15 resize-none font-sans transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* ──── STAGE 4: REVIEW (FINAL VALIDATION) ──── */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-foreground">
                      Review & Validation
                    </h3>
                    <p className="text-xs text-muted-foreground font-light">
                      Confirm combo setup before activating.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 rounded-2xl bg-secondary/30 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                          IDENTIFIER
                        </div>
                        <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                          combo/{comboSlug || "name"}
                        </div>
                        <div className="text-xs font-sans text-muted-foreground mt-0.5">
                          {comboName}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                          CONTEXT LIMIT
                        </div>
                        <div className="text-xs font-mono font-semibold text-foreground mt-0.5">
                          {formatTokens(contextLength)}
                        </div>
                      </div>
                    </div>

                    {/* Fallback Chain Preview */}
                    <div className="pt-1 space-y-1.5">
                      <div className="text-xs font-semibold text-foreground">
                        Execution Sequence ({selectedModels.length} Steps)
                      </div>

                      <ScrollArea className="max-h-24 pr-2">
                        <div className="space-y-1 py-0.5">
                          {selectedModels.map((m, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-1.5 px-2.5 rounded-xl bg-background/60 text-xs font-sans"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-semibold",
                                    idx === 0
                                      ? "bg-foreground text-background"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {idx + 1}
                                </span>
                                <span className="font-medium text-foreground">
                                  {m.modelId}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                {m.providerName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Validation Checklist */}
                  <div className="p-3 rounded-2xl bg-secondary/20 space-y-1.5 text-xs">
                    <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Ready to Deploy</span>
                    </div>
                    <div className="space-y-1 font-sans text-muted-foreground text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span>Identifier: combo/{comboSlug || "name"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span>{selectedModels.length} model step(s) in sequence</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </ScrollArea>

            {/* Stepper Footer Navigation */}
            <div className="pt-3 flex items-center justify-between">
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
                    <span>Next: Models</span>
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
                    className="rounded-full text-xs font-sans cursor-pointer gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (selectedModels.length === 0) {
                        toast.error("Please add at least 1 model before proceeding.");
                        return;
                      }
                      setStep(3);
                    }}
                    className="rounded-full text-xs font-sans gap-2 px-5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <span>Next: Settings</span>
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
                    className="rounded-full text-xs font-sans cursor-pointer gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(4)}
                    className="rounded-full text-xs font-sans gap-2 px-5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <span>Next: Review</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}

              {step === 4 && (
                <>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-full text-xs font-sans cursor-pointer gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Delete Confirmation Dialog */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-md rounded-3xl border-none bg-card p-6 space-y-4">
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
              className="rounded-full text-xs cursor-pointer font-sans border-none bg-secondary hover:bg-secondary/80"
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
