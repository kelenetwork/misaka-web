"use client";
import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/ui/AuthShell";
import { Button } from "@/components/ui/Button";
import { AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export default function ApplyPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "rate_limited">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("submitting");
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, email, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setState("rate_limited");
        setError(`申请太频繁，请 ${data?.retryAfter ?? "稍后"} 秒后重试`);
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? data?.message ?? `提交失败 (${res.status})`);
        setState("idle");
        return;
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <AuthShell>
        <div className="mb-9">
          <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--misaka)] mb-2">/ submitted</div>
          <h2 className="font-serif-italic text-[34px] leading-none mb-3">申请已提交</h2>
          <p className="text-[var(--text-dim)] text-[13px] font-sans leading-[1.7]">
            管理员审核通过后，会通过私聊或邮件发给你一个激活链接，点击链接自行设置密码即可登录。
          </p>
        </div>

        <div className="px-4 py-3 bg-[var(--misaka-dim)]/50 border border-[var(--misaka-dim)] rounded-md text-[12px] flex items-start gap-2 mb-6">
          <CheckCircle2 className="w-4 h-4 mt-px text-[var(--misaka)] shrink-0" />
          <div className="text-[var(--text-dim)]">
            申请单号已生成，等待审批（通常 24 小时内）。
          </div>
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
      <div className="mb-9">
        <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)] mb-2">/ apply</div>
        <h2 className="font-serif-italic text-[34px] leading-none mb-2">申请注册</h2>
        <p className="text-[var(--text-dim)] text-[13px] font-sans leading-[1.7]">
          提交申请后由管理员审核。通过后你会收到登录凭据。
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
            用户名
          </label>
          <input
            type="text"
            required
            minLength={3}
            maxLength={32}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="[a-zA-Z0-9_-]+"
            placeholder="kele"
            className="font-mono"
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
            placeholder="you@example.com"
            className="font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
            理由 / 用途
          </label>
          <textarea
            required
            minLength={5}
            maxLength={500}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="比如：监控 NRT04 / SEA02 的库存，自动抢 $10 以下的机器"
            className="font-mono resize-none"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[12px]">
            <AlertCircle className="w-4 h-4 mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={state === "submitting" || state === "rate_limited"}
          className="w-full justify-center py-2.5 text-[12px]"
        >
          {state === "submitting" ? "提交中..." : "提交申请"}
          {state === "idle" && <ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
        <div className="text-[11px] text-[var(--text-dim)] mb-2">已有账号？</div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-[12px] text-[var(--misaka)] hover:underline tracking-[0.04em]"
        >
          直接登录
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </AuthShell>
  );
}
