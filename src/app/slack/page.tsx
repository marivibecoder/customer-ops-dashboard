"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SummaryCards from "@/components/summary-cards";
import type { SlackReport } from "@/lib/types";

function SlackPageInner() {
  const searchParams = useSearchParams();
  const date =
    searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const [data, setData] = useState<SlackReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/data/slack?date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [date]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        Cargando...
      </div>
    );
  if (!data)
    return (
      <div className="text-center py-20 text-muted">
        No hay datos de Slack para {date}.
        <br />
        <span className="text-xs">
          El scheduled task de Slack debe generar un JSON para esta fecha.
        </span>
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Slack Highlights</h2>
        <div className="text-sm text-muted">{date}</div>
      </div>

      <SummaryCards
        cards={[
          {
            label: "Canales",
            value: data.summary.channels_scanned,
            color: "accent",
          },
          {
            label: "Con Actividad",
            value: data.summary.channels_with_activity,
            color: "accent",
          },
          {
            label: "Highlights",
            value: data.summary.total_highlights,
            color: "accent",
          },
          {
            label: "Intervención",
            value: data.summary.intervention_needed,
            color: "alta",
          },
          {
            label: "Churn Risk",
            value: data.summary.churn_risks,
            color: "alta",
          },
        ]}
      />

      <div className="space-y-4">
        {data.channels.map((channel) => (
          <div
            key={channel.name}
            className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">💬</span>
                <div>
                  <div className="font-semibold text-sm">{channel.name}</div>
                  {channel.topic && (
                    <div className="text-xs text-muted">{channel.topic}</div>
                  )}
                </div>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  channel.activity_level === "high"
                    ? "bg-red-50 text-alta"
                    : channel.activity_level === "medium"
                      ? "bg-amber-50 text-media"
                      : "bg-green-50 text-baja"
                }`}
              >
                {channel.activity_level}
              </span>
            </div>

            {channel.highlights.length > 0 && (
              <div className="px-5 pb-4 space-y-2">
                {channel.highlights.map((h, i) => (
                  <div
                    key={i}
                    className={`bg-background border border-border rounded-lg p-3 ${
                      h.intervention_needed ? "border-l-[3px] border-l-accent" : ""
                    }`}
                  >
                    <p className="text-sm font-medium">{h.summary}</p>
                    {h.detail && (
                      <p className="text-xs text-muted mt-1">{h.detail}</p>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {h.people_involved.map((p) => (
                        <span
                          key={p}
                          className="text-[10px] bg-surface2 text-muted px-1.5 py-0.5 rounded"
                        >
                          {p}
                        </span>
                      ))}
                      {h.risk_flag && (
                        <span className="text-[10px] font-semibold text-alta bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                          {h.risk_flag}
                        </span>
                      )}
                      {h.intervention_needed && (
                        <span className="text-[10px] font-semibold text-accent bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          Requiere intervención
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SlackPage() {
  return (
    <Suspense>
      <SlackPageInner />
    </Suspense>
  );
}
