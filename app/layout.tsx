import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "misaka-web · VPS 监控 / 自动下单",
  description: "misaka.io VPS 库存监控 + Telegram 推送 + 自动下单",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
