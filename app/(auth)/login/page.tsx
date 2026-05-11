"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/ui/AuthShell";
import { Button } from "@/components/ui/Button";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? `登录失败 (${res.status})`);
        setLoading(false);
        return;
      }
      router.push("/inventory");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-9">
        <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)] mb-2">/ login</div>
        <h2 className="font-serif-italic text-[34px] leading-none mb-2">欢迎回来</h2>
        <p className="text-[var(--text-dim)] text-[13px] font-sans">用注册时的邮箱和密码登录控制台。</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
            邮箱
          </label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kele@kele.my"
            className="font-mono"
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">
              密码
            </label>
            <Link href="/forgot" className="text-[10px] text-[var(--text-faint)] hover:text-[var(--misaka)] tracking-[0.08em]">
              忘了？
            </Link>
          </div>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="font-mono"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[12px]">
            <AlertCircle className="w-4 h-4 mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="w-full justify-center py-2.5 text-[12px]">
          {loading ? "登录中..." : "登录"}
          {!loading && <ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
        <div className="text-[11px] text-[var(--text-dim)] mb-2">还没有账号？</div>
        <Link
          href="/apply"
          className="inline-flex items-center gap-2 text-[12px] text-[var(--misaka)] hover:underline tracking-[0.04em]"
        >
          申请注册
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </AuthShell>
  );
}
