type ModelIdentity = {
  id: string;
  name?: string;
  displayName?: string;
  provider?: string;
};

export function modelDisplayName(id: string, name?: string): string {
  const label = name || id;
  return id.endsWith(":free") && !label.endsWith(":free")
    ? `${label}:free`
    : label;
}

/** Names are presentation only: free/paid variants may share them. */
export function uniqueModelsById<T extends ModelIdentity>(models: T[]): T[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (!model.id || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

export function resolveModelId(raw: string, models: ModelIdentity[]): string {
  const value = raw.trim();
  const exact = models.find((model) => model.id === value);
  if (exact) return exact.id;
  // Compatibility for old saved display names; exact IDs always take priority.
  const named = models.find(
    (model) =>
      modelDisplayName(
        model.id,
        model.displayName || model.name,
      ).toLowerCase() === value.toLowerCase(),
  );
  return named?.id || value;
}
