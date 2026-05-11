import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "ghost" | "default" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ variant = "default", className = "", ...props }, ref) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-[7px] rounded-md text-[11px] tracking-[0.04em] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-mono";
  const variants: Record<Variant, string> = {
    primary: "bg-[var(--misaka)] border border-[var(--misaka)] text-black font-semibold hover:bg-[#06b358]",
    default: "bg-[var(--bg-elev-1)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]",
    ghost: "bg-transparent border border-transparent text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-elev-2)]",
    danger: "bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white",
  };
  return <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />;
});
