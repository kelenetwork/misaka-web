"use client";

import { useEffect } from "react";

/**
 * Next.js 兜底全局错误页：当 layout / root error.tsx 自身炸时由此接管。
 * 不能依赖任何 layout 的样式，所以内联 style。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error.tsx]", error);
  }, [error]);

  return (
    <html lang="zh">
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#e5e5e5", minHeight: "100vh" }}>
        <div style={{ maxWidth: 480, margin: "12vh auto", padding: "0 24px", lineHeight: 1.6 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171", marginBottom: 8 }}>
            / fatal
          </div>
          <h1 style={{ fontSize: 64, margin: 0, color: "#f87171", fontFamily: "serif", fontStyle: "italic" }}>500</h1>
          <h2 style={{ fontSize: 22, margin: "16px 0 12px", fontFamily: "serif", fontStyle: "italic" }}>致命错误</h2>
          <p style={{ fontSize: 13, color: "#a0a0a0", margin: "0 0 20px" }}>
            页面无法加载，根布局崩溃。请尝试刷新页面，如持续出现请联系管理员。
          </p>
          {error?.digest && (
            <div style={{ padding: "8px 10px", background: "#181818", border: "1px solid #2a2a2a", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "#666", marginBottom: 16 }}>
              digest: {error.digest}
            </div>
          )}
          <button
            onClick={() => reset()}
            style={{ padding: "10px 18px", background: "#07c160", color: "#000", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
