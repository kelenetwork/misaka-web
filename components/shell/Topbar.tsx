import { ReactNode } from "react";

export function Topbar({ crumb, title, right }: { crumb: string; title: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-[rgba(10,10,10,0.7)] border-b border-[var(--border)] px-8 py-[18px] flex items-center gap-4">
      <div className="flex items-baseline gap-3">
        <span className="text-[11px] tracking-[0.12em] uppercase text-[var(--text-faint)]">{crumb}</span>
        <h1 className="font-serif-italic text-[28px] tracking-[-0.01em]">{title}</h1>
      </div>
      {right && <div className="ml-auto flex items-center gap-3">{right}</div>}
    </header>
  );
}

export function StatusPill({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border)] rounded-full text-[11px] text-[var(--text-dim)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--misaka)] pulse-dot" />
      {text}
    </div>
  );
}
