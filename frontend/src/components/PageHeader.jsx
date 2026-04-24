import React from "react";

export default function PageHeader({ label, title, description, action, testid }) {
  return (
    <div
      className="flex items-end justify-between mb-8 gap-4 flex-wrap"
      data-testid={testid}
    >
      <div className="min-w-0">
        {label && <p className="mono-label">// {label}</p>}
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">{description}</p>
        )}
      </div>
      {action && <div className="flex gap-2 items-center shrink-0">{action}</div>}
    </div>
  );
}
