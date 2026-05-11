import { ReactNode } from "react";
import { MobileShell } from "./MobileShell";

type ShellUser = { username: string; role: "user" | "admin" } | { name: string; role: "user" | "admin" };

function displayName(u: ShellUser): string {
  if ("username" in u) return u.username;
  return u.name;
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  return (
    <MobileShell user={{ name: displayName(user), role: user.role }}>
      {children}
    </MobileShell>
  );
}

export function Footer() {
  return (
    <footer className="px-4 sm:px-8 py-6 sm:py-8 border-t border-[var(--border)] text-[var(--text-faint)] text-[10px] sm:text-[10.5px] tracking-[0.08em] flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between mt-auto">
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
