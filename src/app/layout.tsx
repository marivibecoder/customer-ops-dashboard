import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/nav";
import { Suspense } from "react";
import { DateRefreshBar } from "@/components/date-refresh-bar";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LogoutButton } from "@/components/logout-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Customer Ops Dashboard — Darwin AI",
  description: "Unified operations monitoring: WhatsApp, Slack, Metabase",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-next-pathname") ?? headersList.get("x-invoke-path") ?? "";
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login") || pathname.startsWith("/auth/");

  // Get user info for the header (only on authenticated pages)
  let userEmail: string | null = null;
  if (!isLoginPage) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      userEmail = user?.email ?? null;
    } catch {
      // Not authenticated or error — middleware will handle redirect
    }
  }

  if (isLoginPage) {
    return (
      <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
        <body className="min-h-full font-sans">
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <header className="bg-gradient-to-r from-indigo-50 via-indigo-100 to-indigo-50 border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-indigo-900">
                Customer Ops Dashboard
              </h1>
              <p className="text-sm text-muted">Darwin AI — WhatsApp, Slack, Metabase</p>
            </div>
            {userEmail && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-indigo-700">{userEmail}</span>
                <LogoutButton />
              </div>
            )}
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
