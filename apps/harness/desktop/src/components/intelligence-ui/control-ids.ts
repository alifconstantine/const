/** Scope native label/control IDs without changing OpenUI's persisted field names. */
export function scopeControlIds(root: HTMLElement, prefix: string) {
  const forms = [...root.querySelectorAll('[role="form"]')];
  for (const label of root.querySelectorAll<HTMLLabelElement>("label[for]")) {
    const target = label.htmlFor;
    const original = target.startsWith(`${prefix}-`)
      ? label.dataset.constControlFor
      : target;
    if (!original || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(original)) continue;
    const form = label.closest('[role="form"]');
    const region = form || root;
    const id = `${prefix}-${form ? forms.indexOf(form) : "root"}-${original}`;
    const control = [
      ...region.querySelectorAll<HTMLElement>(
        "input[id],textarea[id],select[id],button[id]",
      ),
    ].find((element) => element.id === original || element.id === id);
    if (!control) continue;
    label.dataset.constControlFor = original;
    if (control.id !== id) control.id = id;
    if (label.htmlFor !== id) label.htmlFor = id;
  }
}
