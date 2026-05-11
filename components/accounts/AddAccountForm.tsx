"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AlertCircle, Plus } from "lucide-react";

export function AddAccountForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSuccess(null);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? `失败 (${res.status})`);
      setBusy(false);
      return;
    }
    setSuccess(`已添加账号「${label}」`);
    setLabel(""); setEmail(""); setPassword("");
    setBusy(false);
    router.refresh();
    setTimeout(() => setSuccess(null), 3500);
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
          标签
        </label>
        <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="main / vps1" />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
          misaka 邮箱
        </label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="你在 misaka.io 的邮箱" className="font-mono" />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
          misaka 密码
        </label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="font-mono" />
      </div>
      {success && (
        <div className="flex items-start gap-2 px-2.5 py-2 bg-[var(--misaka-dim)]/40 border border-[var(--misaka)] text-[var(--misaka)] rounded-md text-[11px]">
          <span className="text-[14px] leading-none">✅</span>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 px-2.5 py-2 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center py-2 mt-1">
        <Plus className="w-3.5 h-3.5" /> {busy ? "添加中..." : "添加账号"}
      </Button>
    </form>
  );
}
