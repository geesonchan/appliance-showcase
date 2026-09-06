import { DEBUG } from "../debug";
import { useT } from "../i18n/useT";

/**
 * A small marker for things only worth seeing while diagnosing: an unverified
 * price, a scheme selection that fell back. Renders nothing outside ?debug=1.
 */
export function DebugBadge({ labelKey, title }: { labelKey: string; title?: string }) {
  const t = useT();
  if (!DEBUG) return null;
  return (
    <span
      title={title}
      className="rounded-sm border border-line px-1 py-px font-mono text-[9px] uppercase tracking-wide text-ink-muted"
    >
      {t(labelKey)}
    </span>
  );
}
