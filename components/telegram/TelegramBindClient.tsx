"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Copy, RefreshCw } from "lucide-react";

type BindResponse = {
  bindCode?: string;
  expiresAt?: string;
  expiresIn?: number;
  error?: string;
};

export function TelegramBindClient() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const updateSecondsLeft = () => {
      const nextSecondsLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(nextSecondsLeft);
      if (nextSecondsLeft === 0) {
        setCode(null);
        setExpiresAt(null);
      }
    };
    updateSecondsLeft();
    const interval = window.setInterval(updateSecondsLeft, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  async function gen() {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/bind", { method: "POST" });
      const data = (await res.json()) as BindResponse;
      if (res.ok && data.bindCode && data.expiresAt) {
        setCode(data.bindCode);
        setExpiresAt(data.expiresAt);
        setSecondsLeft(data.expiresIn ?? 300);
      } else {
        alert(`失败: ${data?.error ?? res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (code) {
    return (
      <div className="flex items-center gap-2">
        <code className="font-mono text-[13px] bg-[var(--bg-elev-3)] border border-[var(--border)] px-2.5 py-1.5 rounded flex-1">{code}</code>
        <button onClick={() => navigator.clipboard.writeText(code)} className="px-2 py-1.5 border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)]">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={gen} disabled={busy} className="px-2 py-1.5 border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)]" title="重新生成">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-[var(--text-faint)]">{secondsLeft !== null ? `${Math.ceil(secondsLeft / 60)} 分钟有效 · ${secondsLeft}s` : "5 分钟有效"}</span>
      </div>
    );
  }
  return (
    <Button variant="primary" onClick={gen} disabled={busy}>
      {busy ? "生成中..." : "生成绑定码"}
    </Button>
  );
}
