import { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_520px]">
      {/* Left brand panel - editorial side */}
      <div className="hidden lg:flex flex-col justify-between p-10 border-r border-[var(--border)] bg-[var(--bg-elev-1)] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(1200px circle at 20% 10%, rgba(7,193,96,0.08), transparent 50%), radial-gradient(800px circle at 80% 90%, rgba(7,193,96,0.04), transparent 50%)",
          }}
        />
        <Link href="/" className="relative flex items-baseline gap-2">
          <span className="font-serif-italic text-[40px] leading-none">misaka</span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--misaka)]">/ web</span>
        </Link>

        <div className="relative">
          <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)] mb-3">
            VPS · 库存监控 · 自动下单
          </div>
          <h1 className="font-serif-italic text-[44px] leading-[1.1] tracking-[-0.01em] max-w-[480px] mb-3">
            一个为<span className="text-[var(--misaka)]">极客</span>设计的<br />
            misaka.io 自动化控制台。
          </h1>
          <p className="text-[var(--text-dim)] max-w-[440px] text-[13px] leading-[1.7] font-sans">
            实时监控 41 个区域的机型库存，对你订阅的机型自动出价下单。
            多账号、价格上限、目标数量，全自动 — 你只需要登录付款。
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3 text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">
          <div>
            <div className="font-serif-italic text-[28px] not-italic text-[var(--text)] mb-1">41</div>
            可用区域
          </div>
          <div>
            <div className="font-serif-italic text-[28px] not-italic text-[var(--text)] mb-1">30s</div>
            轮询节奏
          </div>
          <div>
            <div className="font-serif-italic text-[28px] not-italic text-[var(--text)] mb-1">∞</div>
            并行任务
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">{children}</div>
        <div className="mt-12 text-[10px] tracking-[0.12em] uppercase text-[var(--text-faint)] flex gap-4">
          <Link href="/login" className="hover:text-[var(--text)] transition-colors">登录</Link>
          <span>·</span>
          <Link href="/apply" className="hover:text-[var(--text)] transition-colors">申请注册</Link>
          {side}
        </div>
      </div>
    </div>
  );
}
