/**
 * Copy text to the clipboard, with a fallback for contexts where the async
 * Clipboard API is unavailable or blocked (older iOS/Android webviews, some
 * PWA contexts). Returns true on success. Shared by every "Copy for AI".
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand('copy');
      return ok;
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }
}
