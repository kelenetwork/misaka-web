"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { HealthBanner } from "./HealthBanner";

/**
 * Mobile-aware shell that:
 * - On lg+: renders the persistent sidebar + main content as a 2-col grid
 * - On mobile: hides the sidebar by default and exposes a hamburger button to slide it in as a drawer
 */
export function MobileShell({
  user,
  children,
}: {
  user: { name: string; role: "user" | "admin" };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 切换路由自动关闭抽屉
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 抽屉展开时锁定 body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC 关
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* 桌面端：永远可见 */}
      <div className="hidden lg:block">
        <Sidebar user={user} />
      </div>

      {/* 移动端：滑入抽屉 */}
      <div
        className={[
          "lg:hidden fixed inset-0 z-40 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setOpen(false)}
        />
        <div
          className={[
            "absolute left-0 top-0 h-full w-[260px] max-w-[80vw] bg-[var(--bg)] shadow-xl",
            "transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <Sidebar user={user} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-3 w-8 h-8 grid place-items-center text-[var(--text-dim)] hover:text-[var(--text)]"
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <main className="flex flex-col min-w-0">
        {/* 移动端汉堡按钮：粘性条置顶，主页面其他 Topbar 仍在它下方 */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 backdrop-blur bg-[rgba(10,10,10,0.85)] border-b border-[var(--border)]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-9 h-9 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)] transition-colors"
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-baseline gap-2">
            <span className="font-serif-italic text-[20px] leading-none">misaka</span>
            <span className="text-[9px] tracking-[0.18em] uppercase text-[var(--misaka)]">/ web</span>
          </div>
        </div>
        <HealthBanner />
        {children}
      </main>
    </div>
  );
}
