export function StatusBadge({
  tone, children,
}: {
  tone: "ok" | "warn" | "err" | "info" | "muted" | "primary";
  children: React.ReactNode;
}) {
  const styles = {
    ok: "bg-[var(--misaka-dim)] text-[var(--misaka)] border-[var(--misaka)]",
    primary: "bg-[var(--misaka)] text-black border-[var(--misaka)] font-semibold",
    warn: "bg-[#3a2a05] text-[var(--warn)] border-[var(--warn)]",
    err: "bg-[var(--danger-dim)] text-[var(--danger)] border-[var(--danger)]",
    info: "bg-[rgba(106,189,243,0.15)] text-[var(--info)] border-[var(--info)]",
    muted: "bg-[var(--bg-elev-3)] text-[var(--text-dim)] border-[var(--border)]",
  }[tone];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] tracking-[0.14em] uppercase font-semibold border ${styles}`}>
      {children}
    </span>
  );
}
