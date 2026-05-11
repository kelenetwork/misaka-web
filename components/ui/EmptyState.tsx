import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  desc,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-8 py-16 text-center">
      <div className="inline-grid place-items-center w-12 h-12 rounded-md bg-[var(--bg-elev-2)] border border-[var(--border)] text-[var(--text-faint)] mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-serif-italic text-[20px] mb-1.5">{title}</div>
      {desc && <div className="text-[12px] text-[var(--text-dim)] max-w-md mx-auto leading-[1.7]">{desc}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
