import { ReactNode } from "react";

export function SectionHead({
  title, count, actions,
}: { title: string; count?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 pb-1">
      <h2 className="font-serif-italic text-[22px]">{title}</h2>
      {count && <span className="text-[var(--text-faint)] text-[11px] tracking-[0.12em] uppercase">{count}</span>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
