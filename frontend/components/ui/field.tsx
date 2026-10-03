import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL_STYLES =
  "w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  className,
  invalid,
  ...props
}: ComponentPropsWithRef<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(CONTROL_STYLES, invalid && "ring-rose-400 focus:ring-rose-500", className)}
      {...props}
    />
  );
}

export function TextArea({
  className,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cn(CONTROL_STYLES, "resize-none", className)} {...props} />;
}

export function Select({
  className,
  invalid,
  ...props
}: ComponentPropsWithRef<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={cn(CONTROL_STYLES, invalid && "ring-rose-400 focus:ring-rose-500", className)}
      {...props}
    />
  );
}
