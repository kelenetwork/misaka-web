import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={[
        "bg-[var(--bg-elev-1)] border border-[var(--border)] rounded-[10px] overflow-hidden",
        glow ? "relative" : "",
        className,
      ].join(" ")}
    >
      {glow && (
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--misaka-glow), transparent 60%)", opacity: 0.4 }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export function StatCard({
  label, value, unit, delta, deltaTone = "up",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
}) {
  const tone = {
    up: "text-[var(--misaka)]",
    down: "text-[var(--danger)]",
    neutral: "text-[var(--text-dim)]",
  }[deltaTone];

  return (
    <Card glow className="px-5 py-[18px]">
      <div className="text-[10px] tracking-[0.18em] text-[var(--text-faint)] uppercase mb-2.5">{label}</div>
      <div className="font-serif-italic text-[36px] leading-none text-[var(--text)]">
        {value}
        {unit && <span className="font-mono text-[14px] text-[var(--text-dim)] ml-1">{unit}</span>}
      </div>
      {delta && <div className={`mt-2 text-[11px] flex items-center gap-1 ${tone}`}>{delta}</div>}
    </Card>
  );
}
