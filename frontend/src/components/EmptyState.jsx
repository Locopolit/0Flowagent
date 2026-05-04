import React from "react";

export default function EmptyState({ icon: Icon, title, description, action, testid }) {
  return (
    <div
      className="rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.015] px-8 py-20 text-center flex flex-col items-center gap-4"
      data-testid={testid}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon size={24} weight="fill" className="text-white" />
        </div>
      )}
      {title && <div className="text-[15px] font-bold text-white mt-1">{title}</div>}
      {description && (
        <p className="text-[13px] text-white/35 max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
