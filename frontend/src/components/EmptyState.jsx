import React from "react";

export default function EmptyState({ icon: Icon, title, description, action, testid }) {
  return (
    <div
      className="border border-dashed border-border bg-card/30 px-8 py-16 text-center flex flex-col items-center gap-3"
      data-testid={testid}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-sm border border-border bg-neutral-900 flex items-center justify-center text-muted-foreground">
          <Icon size={22} weight="duotone" />
        </div>
      )}
      {title && <div className="text-base font-medium text-foreground">{title}</div>}
      {description && (
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
