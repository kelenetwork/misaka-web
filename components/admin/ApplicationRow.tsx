"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtRelative } from "@/lib/util/format";
import { Button } from "@/components/ui/Button";
import { Check, X, ChevronDown, ChevronUp, Copy } from "lucide-react";

export function ApplicationRow({
  application,
}: {
  application: { id: string; username: string; email: string; reason: string; ip: string; createdAt: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    const res = await fetch(`/api/admin/applications/${application.id}/approve`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.tempPassword) {
      setTempPassword(data.tempPassword);
    } else if (res.ok) {
      router.refresh();
    } else {
      alert(`失败: ${data?.error ?? res.status}`);
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejectReason.trim()) { alert("请填拒绝理由"); return; }
    setBusy(true);
    const res = await fetch(`/api/admin/applications/${application.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => ({})); alert(`失败: ${d?.error ?? res.status}`); setBusy(false); }
  }

  return (
    <>
      <div className="grid grid-cols-[160px_1fr_120px_130px_180px] border-t border-[var(--border)] items-center hover:bg-[var(--bg-elev-2)] transition-colors">
        <div className="px-4 py-3.5 text-[11px] text-[var(--text-dim)] font-mono">{fmtRelative(application.createdAt)}</div>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[13px]">{application.username}</span>
            <span className="text-[11px] text-[var(--text-dim)] font-mono">{application.email}</span>
          </div>
          <button onClick={() => setOpen(!open)} className="text-[10.5px] text-[var(--text-faint)] hover:text-[var(--text)] mt-1 flex items-center gap-1">
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {open ? "收起理由" : "展开理由"}
          </button>
        </div>
        <div className="px-4 py-3.5 text-[11px] font-mono text-[var(--text-dim)]">{application.ip}</div>
        <div className="px-4 py-3.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] tracking-[0.14em] uppercase font-semibold border bg-[var(--bg-elev-3)] text-[var(--warn)] border-[var(--warn)]">待审</span>
        </div>
        <div className="px-4 py-3.5 flex justify-end gap-1.5">
          <Button variant="primary" disabled={busy} onClick={approve} className="!py-1 !px-2">
            <Check className="w-3.5 h-3.5" /> 通过
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => setRejectMode(true)} className="!py-1 !px-2">
            <X className="w-3.5 h-3.5" /> 拒绝
          </Button>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 border-t border-[var(--border)] bg-[var(--bg-elev-2)] px-4 py-3">
          <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1">理由</div>
          <div className="text-[12px] text-[var(--text-dim)] leading-[1.6] whitespace-pre-wrap font-sans">{application.reason}</div>
        </div>
      )}

      {rejectMode && (
        <div className="grid grid-cols-1 border-t border-[var(--border)] bg-[var(--bg-elev-2)] px-4 py-3 gap-2">
          <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">拒绝理由</div>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} className="font-mono" placeholder="告知申请人为什么被拒" />
          <div className="flex gap-2">
            <Button variant="danger" onClick={reject} disabled={busy}><X className="w-3.5 h-3.5" /> 确认拒绝</Button>
            <Button variant="ghost" onClick={() => setRejectMode(false)}>取消</Button>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="border-t border-[var(--border)] bg-[var(--misaka-dim)]/30 px-4 py-3 grid gap-2">
          <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--misaka)]">已创建账号，临时密码：</div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-[13px] bg-[var(--bg)] px-2.5 py-1 rounded border border-[var(--misaka)] flex-1">{tempPassword}</code>
            <button onClick={() => navigator.clipboard.writeText(tempPassword)} className="px-2.5 py-1 rounded border border-[var(--border)] hover:border-[var(--misaka)] text-[11px] flex items-center gap-1">
              <Copy className="w-3 h-3" /> 复制
            </button>
            <Button variant="primary" onClick={() => { setTempPassword(null); router.refresh(); }}>关闭</Button>
          </div>
          <div className="text-[10.5px] text-[var(--text-dim)]">请把这串密码通过私密渠道发给申请人，他首次登录后建议立即改密。</div>
        </div>
      )}
    </>
  );
}
