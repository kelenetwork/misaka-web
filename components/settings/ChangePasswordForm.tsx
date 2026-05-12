"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (next.length < 8) {
      setError("新密码至少 8 位");
      return;
    }
    if (next !== confirm) {
      setError("两次新密码不一致");
      return;
    }
    if (current === next) {
      setError("新密码不能和当前密码相同");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.message ||
          (data?.code === "INVALID_PASSWORD" ? "当前密码不正确" :
            res.status === 401 ? "未登录或会话过期" :
            `失败 (${res.status})`);
        setError(msg);
        setBusy(false);
        return;
      }
      setOk(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setBusy(false);
      setTimeout(() => setOk(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div>
        <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
          当前密码
        </label>
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="font-mono"
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
          新密码（≥ 8 位）
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="font-mono"
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
          确认新密码
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="font-mono"
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </div>
      {error && (
        <div className="flex items-start gap-2 px-2.5 py-2 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {ok && (
        <div className="flex items-start gap-2 px-2.5 py-2 bg-[var(--misaka-dim)]/40 border border-[var(--misaka)] text-[var(--misaka)] rounded-md text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>密码已更新，其他设备的会话已被撤销。</span>
        </div>
      )}
      <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center mt-1">
        <KeyRound className="w-3.5 h-3.5" />
        {busy ? "更新中..." : "更新密码"}
      </Button>
    </form>
  );
}
