/**
 * The header's single "Copy for AI" button copies whatever the current tab
 * has registered here (the Natal tab is handled by App itself). Each view
 * registers a builder in an $effect and clears it on teardown, so the button
 * always matches the tab on screen.
 */
export const copyCtx = $state<{ label: string; build: (() => string) | null }>({
  label: '', build: null,
});

/**
 * Register `build` under `label` for the lifetime of the calling $effect.
 * Returns the teardown, which only clears the slot if it still holds this
 * builder (a newly mounted tab may already have replaced it).
 */
export function registerCopy(label: string, build: (() => string) | null): () => void {
  copyCtx.label = label;
  copyCtx.build = build;
  return () => { if (copyCtx.build === build) copyCtx.build = null; };
}
