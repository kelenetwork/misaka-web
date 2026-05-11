"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();

  return (
    <button
      className="w-8 h-8 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)] transition-colors"
      title="刷新"
      onClick={() => router.refresh()}
    >
      <RefreshCw className="w-4 h-4" />
    </button>
  );
}
