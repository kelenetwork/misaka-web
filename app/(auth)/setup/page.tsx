"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { Button } from "@/components/ui/Button";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type VerifyState =
  | { kind: "loading" }
  | { kind: "ok"; username: string; email: string; expiresAt: string }
  | { kind: "error"; reason: string };

export default function SetupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [verify, setVerify] = useState<VerifyState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setVerify({ kind: "error", reason: "缺少 token 参数" });
      return;
    }
    fetch(`/api/setup/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setVerify({
            kind: "ok",
            username: data.username,
            email: data.email,
            expiresAt: data.expiresAt,
          });
        } else {
          setVerify({
            kind: "error",
            reason: data.error === "invalid_or_expired" ? "链接已失效或已被使用" : "无法验证 token",
          });
        }
      })
      .catch(() => setVerify({ kind: "error", reason: "网络错误，请稍后重试" }));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error === "invalid_or_expired" ? "链接已失效"
            : data.error === "user_already_exists" ? "邮箱已被注册"
            : data.detail || data.error || `失败 (${res.status})`;
        setError(msg);
        setBusy(false);
        return;
      }
      router.push("/inventory");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
      setBusy(false);
    }
  }

  if (verify.kind === "loading") {
    return (
      <AuthShell>
        <div className="flex items-center gap-3 text-[var(--text-dim)] text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> 正在验证 token...
        </div>
      </AuthShell>
    );
  }

  if (verify.kind === "error") {
    return (
      <AuthShell>
        <div className="mb-9">
          <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--danger)] mb-2">/ invalid</div>
          <h2 className="font-serif-italic text-[34px] leading-none mb-3">链接无效</h2>
          <p className="text-[var(--text-dim)] text-[13px] font-sans leading-[1.7]">
            {verify.reason}。请联系管理员重新审批生成新的激活链接。
          </p>
        </div>
        <Link href="/login">
          <Button variant="default" className="w-full justify-center">
            返回登录
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--misaka)] mb-2">/ setup</div>
        <h2 className="font-serif-italic text-[34px] leading-none mb-2">设置密码</h2>
        <p className="text-[var(--text-dim)] text-[13px] font-sans leading-[1.7]">
          管理员已通过你的注册申请，请设置密码完成注册。
        </p>
      </div>

      <div className="px-3 py-2.5 bg-[var(--misaka-dim)]/40 border border-[var(--misaka-dim)] rounded-md text-[12px] mb-6 grid grid-cols-[80px_1fr] gap-y-1.5 items-center">
        <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">用户名</div>
        <div className="font-mono text-[var(--text)]">{verify.username}</div>
        <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">邮箱</div>
        <div className="font-mono text-[var(--text)]">{verify.email}</div>
      </div>

      <form onSubmit={submit} className="grid gap-3.5">
        <div>
          <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
            新密码（至少 8 位）
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="font-mono"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
            确认密码
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="font-mono"
            autoComplete="new-password"
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 px-2.5 py-2 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center py-2 mt-1">
          {busy ? "提交中..." : (<>完成注册并登录 <CheckCircle2 className="w-3.5 h-3.5" /></>)}
        </Button>
      </form>
    </AuthShell>
  );
}
