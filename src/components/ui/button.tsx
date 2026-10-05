'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * PROMPT.md §17 — the submit button must be disabled during a request to
 * prevent accidental duplicate submissions, and §3 requires large touch targets.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
        secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300',
        outline: 'border border-neutral-300 bg-surface text-neutral-900 hover:bg-neutral-50',
        ghost: 'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200',
        danger: 'bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-700',
        link: 'text-brand-700 underline underline-offset-4 hover:text-brand-800',
      },
      size: {
        // min-h-11 == 44px, the WCAG 2.5.5 target-size minimum.
        sm: 'min-h-touch px-3 text-sm',
        md: 'min-h-touch px-4 text-sm',
        lg: 'min-h-touch px-6 text-base',
        xl: 'min-h-14 px-6 text-lg',
        icon: 'size-touch',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  /** Announced to screen readers while `loading` is true. */
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading = false, loadingText, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      // A loading button is also a disabled button for assistive tech.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          <span className="sr-only">{loadingText ?? 'Loading'}</span>
        </>
      ) : null}
      {children}
    </button>
  );
});

export { buttonVariants };
