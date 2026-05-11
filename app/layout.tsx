import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "misaka-web", description: "misaka.io VPS monitor" };
function Toaster() { return null; }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}<Toaster /></body></html>; }
