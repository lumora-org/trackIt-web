'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

const fieldBase =
  'w-full rounded-xl border bg-white px-3 text-neutral-900 transition-colors placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-neutral-100 disabled:text-neutral-500';

/**
 * Field wrapper providing label, description, error and the aria wiring so
 * every form in the app is accessible by construction (PROMPT.md §26).
 */
export function Field({
  label,
  htmlFor,
  description,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  description?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-800">
        {label}
        {required ? (
          <span className="text-danger-500 ml-0.5" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {/*
        Both descriptions and errors reference the control, so screen readers
        announce the problem when focus lands on the field.
      */}
      {description ? (
        <p id={`${htmlFor}-description`} className="text-xs text-neutral-500">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-danger-700 text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Merge an error into the accessible description list for a control. */
function describedBy(id: string, hasError: boolean): string | undefined {
  return hasError ? `${id}-error` : `${id}-description`;
}

/* ------------------------------------------------------------- text input */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  description?: ReactNode;
  error?: string | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, description, error, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field
      label={label}
      htmlFor={inputId}
      description={description}
      error={error}
      required={required}
    >
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, Boolean(error))}
        className={cn(
          fieldBase,
          'min-h-touch',
          error
            ? 'border-danger-500 focus:ring-danger-500'
            : 'focus:border-brand-500 border-neutral-300',
          className,
        )}
        {...props}
      />
    </Field>
  );
});

/* ------------------------------------------------------------------ select */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  description?: ReactNode;
  error?: string | undefined;
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, description, error, options, placeholder, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <Field
      label={label}
      htmlFor={selectId}
      description={description}
      error={error}
      required={required}
    >
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(selectId, Boolean(error))}
        className={cn(
          fieldBase,
          'min-h-touch appearance-none bg-[length:1.1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10',
          error
            ? 'border-danger-500 focus:ring-danger-500'
            : 'focus:border-brand-500 border-neutral-300',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  );
});

/* ---------------------------------------------------------------- textarea */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  description?: ReactNode;
  error?: string | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, description, error, className, id, required, rows = 3, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <Field
      label={label}
      htmlFor={textareaId}
      description={description}
      error={error}
      required={required}
    >
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(textareaId, Boolean(error))}
        className={cn(
          fieldBase,
          'py-2.5',
          error
            ? 'border-danger-500 focus:ring-danger-500'
            : 'focus:border-brand-500 border-neutral-300',
          className,
        )}
        {...props}
      />
    </Field>
  );
});

export { fieldBase };
