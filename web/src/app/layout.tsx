import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

// Retell's stack is "Untitled Sans" (licensed) with Inter as the fallback; Inter is free.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Competitor Monitor · Retell AI",
  description: "Competitive intelligence dashboard: what competitors changed and what it means for Retell.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-col lg:pl-64">
          <TopBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
