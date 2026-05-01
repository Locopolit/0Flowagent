import React from "react";

export default function PageHeader({ label, title, description, action, testid }) {
  return (
    <div
      className="flex items-end justify-between mb-8 gap-4 flex-wrap"
      data-testid={testid}
    >
      <div className="min-w-0">
        {label && <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">{label}</p>}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-white/50 max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="flex gap-2 items-center shrink-0">{action}</div>}
    </div>
  );
}
