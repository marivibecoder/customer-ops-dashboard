"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const tabs = [
  { href: "/", label: "Clientes" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/slack", label: "Slack" },
  { href: "/metabase", label: "Metabase" },
];

function NavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const qs = dateParam ? `?date=${dateParam}` : "";

  return (
    <nav className="border-b border-border bg-surface">
      <div className="max-w-7xl mx-auto px-6 flex gap-1">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={`${tab.href}${qs}`}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function Nav() {
  return (
    <Suspense>
      <NavInner />
    </Suspense>
  );
}
