"use client";

import { useState } from "react";

interface Props {
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  avatar?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  subtitle,
  badges,
  avatar,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface2 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {avatar && (
            <div className="w-9 h-9 rounded-full bg-indigo-50 text-accent flex items-center justify-center font-bold text-sm shrink-0">
              {avatar}
            </div>
          )}
          <div>
            <div className="font-semibold text-sm">{title}</div>
            {subtitle && (
              <div className="text-xs text-muted mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badges}
          <svg
            className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}
