import { Component, Fragment, useSyncExternalStore, type ReactNode } from "react";
import { EVENTS, countEvent } from "../analytics";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { clearFault, type Part } from "./fault";

/**
 * A fence round one part of the page. Round 99c, Leo: "一块出错只显示那一块的
 * 错误提示，页面其余照常".
 *
 * Without one, React takes the whole page down when anything in it throws while
 * it draws — round 99b's Layout tab and round 99c's cut-short link each emptied
 * it. Inside a fence a part that throws is replaced by Leo's sentence and a
 * Retry button; a package switch retries it by itself; and the visit counter
 * records which part failed, once a page (D24), and nothing else about it.
 *
 * The 3D scene's own failures reach its fence because @react-three/fiber
 * catches them inside the canvas and throws them again from the canvas
 * (round 99c's plan, section 1, with the library's lines).
 */

const counted = new Set<Part>();

/**
 * Which parts stand failed now, for what belongs with them: the scene's pins
 * and dimensions are drawn over the canvas, outside its fence, and stayed
 * floating over the empty place and across the message until round 99d (Leo).
 */
const failedNow = new Set<Part>();
const watchers = new Set<() => void>();
function markFailed(part: Part, failed: boolean) {
  if (failed === failedNow.has(part)) return;
  if (failed) failedNow.add(part);
  else failedNow.delete(part);
  for (const watch of watchers) watch();
}
const watch = (onChange: () => void) => {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
};

/** Whether a part stands failed, its message showing. */
export function usePartFailed(part: Part): boolean {
  return useSyncExternalStore(watch, () => failedNow.has(part));
}

interface FenceProps {
  part: Part;
  /** Whatever changes when the part should be tried again: the package, at least. */
  retryOn: string;
  /** Where the message stands, sized as the part was. */
  className?: string;
  /** The quote page's way out: its own Close, which its failure took with it. */
  onClose?: () => void;
  children: ReactNode;
}

class Fence extends Component<FenceProps, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  /**
   * What `retryOn` was when the part failed. A change after that retries it;
   * not the change that came in the same update as the failure — opening the
   * quote page is both, and retrying on it hid the message at once.
   */
  private failedOn: string | null = null;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    markFailed(this.props.part, true);
    // For whoever opens the console; the page itself says only Leo's sentence.
    console.error(`part failed: ${this.props.part}`, error);
    if (!counted.has(this.props.part)) {
      counted.add(this.props.part);
      countEvent(EVENTS.partFailed(this.props.part));
    }
  }

  componentDidUpdate() {
    if (this.state.failed && this.failedOn !== null && this.props.retryOn !== this.failedOn) this.retry();
  }

  retry = () => {
    this.failedOn = null;
    markFailed(this.props.part, false);
    clearFault(this.props.part);
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.failed) {
      // Noted as the message is first drawn, whether the part failed on its
      // first mount or later.
      if (this.failedOn === null) this.failedOn = this.props.retryOn;
      return (
        <PartFailed part={this.props.part} className={this.props.className} onRetry={this.retry} onClose={this.props.onClose} />
      );
    }
    // A new key on a retry: the part is drawn again from nothing.
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

/** Leo's sentence where the part was, and the button that tries it again. */
function PartFailed({
  part,
  className,
  onRetry,
  onClose,
}: {
  part: Part;
  className?: string;
  onRetry: () => void;
  onClose?: () => void;
}) {
  const t = useT();
  return (
    <div
      role="status"
      data-part-failed={part}
      className={[
        "flex flex-col items-center justify-center gap-3 p-6 text-center text-[13px] leading-snug text-ink",
        className ?? "",
      ].join(" ")}
    >
      <p className="max-w-[320px]">{t("part.failed")}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-accent px-4 py-1.5 text-[12px] font-medium text-[#F7F5EF] transition-colors hover:opacity-90"
        >
          {t("part.retry")}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-4 py-1.5 text-[12px] text-ink transition-colors hover:bg-surface"
          >
            {t("quote.close")}
          </button>
        )}
      </div>
    </div>
  );
}

/** A fence that tries its part again whenever the package changes, and on `also`. */
export function PartFence({
  part,
  also = "",
  className,
  onClose,
  children,
}: {
  part: Part;
  also?: string;
  className?: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const packageId = useAppStore((s) => s.packageId);
  return (
    <Fence part={part} retryOn={`${packageId}|${also}`} className={className} onClose={onClose}>
      {children}
    </Fence>
  );
}
