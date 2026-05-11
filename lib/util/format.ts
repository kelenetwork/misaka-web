// Country code → flag emoji
export function flagOf(cc: string | null | undefined): string {
  if (!cc || cc.length !== 2) return "🌐";
  const A = 0x1f1e6 - 65;
  return String.fromCodePoint(A + cc.charCodeAt(0), A + cc.charCodeAt(1));
}

export function fmtPrice(usd: number) {
  return `$${usd.toFixed(2)}`;
}

export function fmtMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)}G`;
  return `${mb}M`;
}

export function fmtRelative(date: Date | string | number): string {
  const t = new Date(date).getTime();
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s 前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m 前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h 前`;
  const d = Math.floor(h / 24);
  return `${d}d 前`;
}
