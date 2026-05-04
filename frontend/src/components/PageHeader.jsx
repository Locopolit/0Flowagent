import React from "react";

export default function PageHeader({ label, title, description, action, testid }) {
  return (
    <div
      className="flex items-end justify-between mb-8 gap-4 flex-wrap pb-6 border-b border-white/[0.04]"
      data-testid={testid}
    >
      <div className="min-w-0">
        {label && <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/20">{label}</p>}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{title}</h1>
        {description && (
          <p className="mt-2 text-[13px] text-white/40 max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="flex gap-2.5 items-center shrink-0">{action}</div>}
    </div>
  );
}
