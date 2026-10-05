'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';
import { Button } from './button';

/**
 * Accessible dialog base (PROMPT.md §26).
 *
 * Implements the required behaviour by hand rather than pulling in a dialog
 * library: Escape to close, focus trapped inside, focus restored on close,
 * background scroll locked, and a labelled `role="dialog"`.
 */

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}

function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    // Move focus into the dialog on open.
    const first = focusable()[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef]);
}

/** Shared dialog chrome. `side="right"` renders a drawer. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = 'center',
  size = 'md',
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'center' | 'right' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useBodyScrollLock(open);
  useFocusTrap(open, containerRef);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose],
  );

  // Not yet mounted in the browser (SSR) — the portal is client-only.
  if (typeof document === 'undefined' || !open) return null;

  const positionClasses = {
    center: 'items-center justify-center p-4',
    right: 'items-stretch justify-end',
    bottom: 'items-end justify-center',
  }[side];

  const panelClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  }[size];

  return createPortal(
    <div
      className={cn('fixed inset-0 z-50 flex', positionClasses)}
      onKeyDown={onKeyDown}
      // Clicking the backdrop closes; the panel stops propagation.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* A scrim must stay dark in both themes, so it uses raw black rather
          than the neutral ramp, which the dark theme inverts. */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative flex max-h-dvh w-full flex-col bg-surface shadow-xl',
          'rounded-t-2xl sm:rounded-2xl',
          side === 'right' && 'max-w-sm rounded-t-none sm:rounded-l-2xl sm:rounded-tr-none',
          side === 'bottom' && 'max-h-[90dvh] rounded-t-2xl',
          panelClasses,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-neutral-900">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-sm text-neutral-500">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer ? (
          <div className="safe-bottom flex flex-wrap justify-end gap-3 border-t border-neutral-200 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Right-side drawer used for mobile navigation and record detail. */
export function Drawer(props: Omit<Parameters<typeof Dialog>[0], 'side'>) {
  return <Dialog {...props} side="right" />;
}

/**
 * Confirmation for destructive operations (PROMPT.md §3). Defaults to `danger`
 * because its only current use is destructive.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  variant = 'danger',
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: 'danger' | 'primary';
  /** Optional form content, e.g. the mandatory reason for a void. */
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">{description}</p>
        {children}
      </div>
    </Dialog>
  );
}
