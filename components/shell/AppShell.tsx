import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: "user" | "admin" };
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen">
      <Sidebar user={user} />
      <main className="flex flex-col min-w-0">{children}</main>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="px-8 py-8 border-t border-[var(--border)] text-[var(--text-faint)] text-[10.5px] tracking-[0.08em] flex justify-between mt-auto">
      <span>
        misaka-web · v0.1.0 ·{" "}
        <kbd className="px-1.5 py-0.5 border border-[var(--border)] rounded bg-[var(--bg-elev-2)] text-[9.5px] mx-0.5 text-[var(--text-dim)]">⌘</kbd>
        <kbd className="px-1.5 py-0.5 border border-[var(--border)] rounded bg-[var(--bg-elev-2)] text-[9.5px] mx-0.5 text-[var(--text-dim)]">K</kbd>{" "}
        命令面板
      </span>
      <span>UTC+8 · 北京时间</span>
    </footer>
  );
}
