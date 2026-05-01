import React from "react";

export default function Loading({ label = "Loading", testid }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-16 text-sm text-white/40"
      data-testid={testid}
    >
      <span
        className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"
        aria-hidden="true"
      />
      {label}...
    </div>
  );
}
