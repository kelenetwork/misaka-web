import Link from "next/link";
import { AuthShell } from "@/components/ui/AuthShell";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <AuthShell>
      <div className="mb-9">
        <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)] mb-2">/ 404</div>
        <h2 className="font-serif-italic text-[68px] leading-none mb-4 text-[var(--misaka)]">
          404
        </h2>
        <h3 className="font-serif-italic text-[26px] leading-tight mb-3">页面不存在</h3>
        <p className="text-[var(--text-dim)] text-[13px] font-sans leading-[1.7]">
          你访问的页面可能被删除、改名，或者从一开始就不存在。
        </p>
      </div>

      <Link href="/inventory">
        <Button variant="default" className="w-full justify-center">
          <ArrowLeft className="w-3.5 h-3.5" />
          返回库存监控
        </Button>
      </Link>
    </AuthShell>
  );
}
