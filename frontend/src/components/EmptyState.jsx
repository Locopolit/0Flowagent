import React from "react";

export default function EmptyState({ icon: Icon, title, description, action, testid }) {
  return (
    <div
      className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-8 py-16 text-center flex flex-col items-center gap-3"
      data-testid={testid}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Icon size={22} weight="fill" className="text-blue-400" />
        </div>
      )}
      {title && <div className="text-base font-semibold text-white">{title}</div>}
      {description && (
        <p className="text-sm text-white/45 max-w-md">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
