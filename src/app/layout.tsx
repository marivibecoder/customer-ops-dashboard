import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/nav";
import { Suspense } from "react";
import { DateRefreshBar } from "@/components/date-refresh-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Customer Ops Dashboard — Darwin AI",
  description: "Unified operations monitoring: WhatsApp, Slack, Metabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <header className="bg-gradient-to-r from-indigo-50 via-indigo-100 to-indigo-50 border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <h1 className="text-2xl font-bold text-indigo-900">
              Customer Ops Dashboard
            </h1>
            <p className="text-sm text-muted">Darwin AI — WhatsApp, Slack, Metabase</p>
          </div>
        </header>
        <Suspense fallback={null}>
          <DateRefreshBar />
        </Suspense>
        <Nav />
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
