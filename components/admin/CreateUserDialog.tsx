"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AlertCircle, Plus, X } from "lucide-react";

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  function reset() {
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("user");
    setError(null);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, email, password, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error === "email_exists" ? "邮箱已被注册"
            : data.error === "username_exists" ? "用户名已被占用"
            : data.detail || data.error || `失败 (${res.status})`;
        setError(msg);
        setBusy(false);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> 新建用户
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-[var(--bg-elev-1)] border border-[var(--border)] rounded-lg p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-serif-italic text-[24px] leading-none">新建用户</h2>
              <button
                onClick={() => !busy && setOpen(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text)]"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11.5px] text-[var(--text-dim)] mb-4 leading-[1.7]">
              管理员直接创建用户，无需走 apply 审批流程。创建后用户立刻 active 可登录。
            </div>
            <form onSubmit={submit} className="grid gap-3">
              <div>
                <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
                  用户名
                </label>
                <input
                  required
                  minLength={3}
                  maxLength={32}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="kele"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
                  邮箱
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
                  初始密码（≥8 位）
                </label>
                <input
                  type="text"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                  className="font-mono"
                  autoComplete="off"
                />
                <div className="text-[10px] text-[var(--text-faint)] mt-1">
                  密码会通过 better-auth 哈希存储；用户登录后可自行修改。
                </div>
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
                  角色
                </label>
                <div className="flex gap-2">
                  {(["user", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={[
                        "flex-1 h-9 rounded-md border text-[12px] transition-colors",
                        role === r
                          ? "border-[var(--misaka)] bg-[var(--misaka-dim)] text-[var(--misaka)]"
                          : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-strong)]",
                      ].join(" ")}
                    >
                      {r === "admin" ? "管理员" : "普通用户"}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <div className="flex items-start gap-2 px-2.5 py-2 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex gap-2 mt-1">
                <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={busy} className="flex-1 justify-center">
                  取消
                </Button>
                <Button variant="primary" type="submit" disabled={busy} className="flex-1 justify-center">
                  {busy ? "创建中..." : "创建"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
