import React from "react";

export default function Loading({ label = "Loading", testid }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-20"
      data-testid={testid}
    >
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-blue-400"
            style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="text-[12px] font-medium text-white/30 uppercase tracking-wider">{label}</span>
    </div>
  );
}
