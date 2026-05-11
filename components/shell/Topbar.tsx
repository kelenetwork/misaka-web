import { ReactNode } from "react";

export function Topbar({ crumb, title, right }: { crumb: string; title: string; right?: ReactNode }) {
  return (
    <header className="sticky top-[57px] lg:top-0 z-10 backdrop-blur bg-[rgba(10,10,10,0.7)] border-b border-[var(--border)] px-4 sm:px-8 py-3 sm:py-[18px] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex items-baseline gap-2 sm:gap-3 min-w-0">
        <span className="text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[var(--text-faint)] shrink-0">{crumb}</span>
        <h1 className="font-serif-italic text-[22px] sm:text-[28px] tracking-[-0.01em] truncate">{title}</h1>
      </div>
      {right && <div className="sm:ml-auto flex items-center gap-2 sm:gap-3 flex-wrap">{right}</div>}
    </header>
  );
}

export function StatusPill({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 border border-[var(--border)] rounded-full text-[10px] sm:text-[11px] text-[var(--text-dim)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--misaka)] pulse-dot" />
      {text}
    </div>
  );
}
