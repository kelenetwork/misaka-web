"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Activity, Settings, CheckSquare,
  Users, Send, ShieldCheck, Globe
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number | string };

type NavSection = { label: string; items: Item[] };

const SECTIONS: NavSection[] = [
  {
    label: "监控",
    items: [
      { href: "/inventory", label: "库存矩阵", icon: LayoutGrid },
      { href: "/activity", label: "实时活动", icon: Activity },
    ],
  },
  {
    label: "自动化",
    items: [
      { href: "/tasks", label: "下单任务", icon: Settings },
      { href: "/orders", label: "订单历史", icon: CheckSquare },
    ],
  },
  {
    label: "账户",
    items: [
      { href: "/accounts", label: "misaka 账号", icon: Users },
      { href: "/telegram", label: "Telegram 绑定", icon: Send },
    ],
  },
];

const ADMIN_SECTION: NavSection = {
  label: "管理",
  items: [
    { href: "/admin/applications", label: "申请审批", icon: ShieldCheck },
    { href: "/admin/users", label: "用户 / 系统", icon: Globe },
  ],
};

type User = { name: string; role: "user" | "admin"; subtitle?: string };

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname() ?? "";
  const sections = user.role === "admin" ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;

  return (
    <aside className="border-r border-[var(--border)] bg-[var(--bg-elev-1)] sticky top-0 h-screen flex flex-col py-6 w-60">
      <div className="px-5 pb-7 border-b border-[var(--border)] flex items-baseline gap-2">
        <Link href="/inventory" className="font-serif-italic text-[32px] leading-none">misaka</Link>
        <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--misaka)]">/ web</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label} className="px-3 pt-4">
            <div className="px-2.5 pb-2 text-[10px] tracking-[0.18em] uppercase text-[var(--text-faint)]">
              {section.label}
            </div>
            {section.items.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={[
                    "relative flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium",
                    "transition-colors",
                    active
                      ? "bg-[var(--bg-elev-2)] text-[var(--text)]"
                      : "text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-elev-2)]",
                  ].join(" ")}
                >
                  {active && (
                    <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--misaka)] rounded-r" />
                  )}
                  <Icon className={["w-4 h-4 shrink-0", active ? "text-[var(--misaka)] opacity-100" : "opacity-70"].join(" ")} />
                  <span>{it.label}</span>
                  {it.count !== undefined && (
                    <span
                      className={[
                        "ml-auto text-[10px] px-1.5 py-0.5 rounded-full",
                        active ? "bg-[var(--misaka-dim)] text-[var(--misaka)]" : "bg-[var(--bg-elev-3)] text-[var(--text-faint)]",
                      ].join(" ")}
                    >
                      {it.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="px-4 pt-4 border-t border-[var(--border)]">
        <Link href="/account" className="flex items-center gap-2.5 text-[12px]">
          <div className="w-7 h-7 rounded-md flex items-center justify-center font-serif-italic text-[16px] text-black bg-gradient-to-br from-[var(--misaka)] to-[var(--misaka-dim)] font-bold">
            {user.name.charAt(0).toLowerCase()}
          </div>
          <div className="leading-tight">
            <div className="font-semibold">{user.name}</div>
            <div className="text-[10px] tracking-[0.1em] uppercase text-[var(--text-faint)]">
              {user.role === "admin" ? "admin · owner" : "user"}
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
