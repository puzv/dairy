import type { ComponentProps } from "react";

// Adapted from the shadcn/ui new-york Input for the journal theme.
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={`field-control min-w-0 disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
