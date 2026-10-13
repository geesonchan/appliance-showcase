/**
 * Put text on the clipboard.
 *
 * Safari refuses the clipboard outside a gesture it recognises, and a page
 * served over http has none at all. Fall back to a selection copied for the
 * user rather than failing silently. Used by the quote page and, since round
 * 94, the share button.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
