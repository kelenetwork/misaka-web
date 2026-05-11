"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Copy, RefreshCw } from "lucide-react";

export function TelegramBindClient() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function gen() {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/bind", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.bindCode) {
        setCode(data.bindCode);
        setExpiresIn(data.expiresIn ?? 300);
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
        <span className="text-[10px] text-[var(--text-faint)]">{expiresIn ? `${Math.floor(expiresIn / 60)} 分钟有效` : ""}</span>
      </div>
    );
  }
  return (
    <Button variant="primary" onClick={gen} disabled={busy}>
      {busy ? "生成中..." : "生成绑定码"}
    </Button>
  );
}
