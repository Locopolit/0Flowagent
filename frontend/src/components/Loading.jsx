import React from "react";

export default function Loading({ label = "loading", testid }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-16 font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground"
      data-testid={testid}
    >
      <span
        className="w-2 h-2 rounded-full bg-primary animate-pulse"
        aria-hidden="true"
      />
      [ {label} ]
    </div>
  );
}
