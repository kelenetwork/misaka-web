"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function TelegramUnbindButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function unbind() {
    if (!window.confirm("确认解绑？")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/unbind", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`失败: ${data?.error ?? res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="danger" onClick={unbind} disabled={busy}>
      {busy ? "解绑中..." : "解绑"}
    </Button>
  );
}
