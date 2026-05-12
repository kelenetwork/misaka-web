"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";

export function UpdateProfileForm({ initialUsername }: { initialUsername: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (username.trim().length < 3) {
      setError("用户名至少 3 个字符");
      return;
    }
    if (username === initialUsername) {
      setError("没有改动");
      return;
    }
    setBusy(true);
    try {
      // 调 admin users PATCH 实际改 username（better-auth update-user 只改 name 字段）
      const res = await fetch(`/api/me/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.error === "username_exists" ? "用户名已被占用" :
          data?.error || `失败 (${res.status})`;
        setError(msg);
        setBusy(false);
        return;
      }
      setOk(true);
      setBusy(false);
      router.refresh();
      setTimeout(() => setOk(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
      setBusy(false);
    }
  }

  return (
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
          placeholder="3-32 个字符"
        />
        <div className="text-[10px] text-[var(--text-faint)] mt-1">
          邮箱不可修改。如需更换请联系管理员。
        </div>
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
          <span>已保存。</span>
        </div>
      )}
      <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center mt-1">
        <Save className="w-3.5 h-3.5" />
        {busy ? "保存中..." : "保存"}
      </Button>
    </form>
  );
}
