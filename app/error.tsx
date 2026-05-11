"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/ui/AuthShell";
import { Button } from "@/components/ui/Button";
import { RefreshCw, ArrowLeft } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error.tsx]", error);
  }, [error]);

  return (
    <AuthShell>
      <div className="mb-7">
        <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--danger)] mb-2">/ error</div>
        <h2 className="font-serif-italic text-[68px] leading-none mb-4 text-[var(--danger)]">
          500
        </h2>
        <h3 className="font-serif-italic text-[26px] leading-tight mb-3">出了点状况</h3>
        <p className="text-[var(--text-dim)] text-[13px] font-sans leading-[1.7]">
          页面渲染时发生错误，已记录到日志。可以点击下方重试，或返回主页面。
        </p>
        {error?.digest && (
          <div className="mt-3 px-2.5 py-1.5 bg-[var(--bg-elev-2)] border border-[var(--border)] rounded text-[10.5px] font-mono text-[var(--text-faint)]">
            digest: {error.digest}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Button variant="primary" onClick={() => reset()} className="w-full justify-center">
          <RefreshCw className="w-3.5 h-3.5" />
          重试
        </Button>
        <Link href="/inventory">
          <Button variant="default" className="w-full justify-center">
            <ArrowLeft className="w-3.5 h-3.5" />
            返回库存监控
          </Button>
        </Link>
      </div>
    </AuthShell>
  );
}
