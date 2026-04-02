import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "請求管理ツール",
  description: "売上・支払い・クレジットの請求管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex">
        <Providers>
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
