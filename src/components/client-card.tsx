"use client";

import { useState } from "react";
import PriorityBadge from "./priority-badge";
import FlagBadge from "./flag-badge";
import AlertCard from "./alert-card";
import type { UnifiedClient } from "@/lib/types";

const riskColors = {
  critical: "border-l-alta",
  warning: "border-l-media",
  ok: "border-l-baja",
};

const riskLabels = {
  critical: "Riesgo Alto",
  warning: "Atención",
  ok: "OK",
};

export default function ClientCard({ client }: { client: UnifiedClient }) {
  const [expanded, setExpanded] = useState(false);

  const initials = client.display_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  return (
    <div
      className={`bg-surface border border-border rounded-xl shadow-sm overflow-hidden border-l-[3px] ${riskColors[client.risk_level]}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 hover:bg-surface2 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 text-accent flex items-center justify-center font-bold text-sm shrink-0">
              {initials}
            </div>
            <div>
              <div className="font-semibold">{client.display_name}</div>
              {client.ops_executive && (
                <div className="text-xs text-muted">
                  Ops: {client.ops_executive}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {client.risk_level !== "ok" && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  client.risk_level === "critical"
                    ? "bg-red-50 text-alta"
                    : "bg-amber-50 text-media"
                }`}
              >
                {riskLabels[client.risk_level]}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-6 mt-3 text-xs">
          {/* WhatsApp summary */}
          <div className="flex items-center gap-1.5">
            <span>📱</span>
            {client.whatsapp ? (
              <span>
                {client.whatsapp.total_alerts} alerta
                {client.whatsapp.total_alerts !== 1 ? "s" : ""}
                {client.whatsapp.highest_priority && (
                  <span className="ml-1">
                    <PriorityBadge
                      priority={client.whatsapp.highest_priority}
                    />
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted">Sin data</span>
            )}
          </div>

          {/* Slack summary */}
          <div className="flex items-center gap-1.5">
            <span>💬</span>
            {client.slack ? (
              <span>
                {client.slack.highlights.length} highlight
                {client.slack.highlights.length !== 1 ? "s" : ""}
                {client.slack.has_risk && (
                  <span className="ml-1 text-alta font-semibold">⚠️</span>
                )}
              </span>
            ) : (
              <span className="text-muted">Sin data</span>
            )}
          </div>

          {/* Metabase summary */}
          <div className="flex items-center gap-1.5">
            <span>📊</span>
            {client.metabase ? (
              <span>
                {client.metabase.flag && (
                  <FlagBadge flag={client.metabase.flag} />
                )}
                {client.metabase.mom_change_percent !== undefined && (
                  <span
                    className={`ml-1 font-semibold ${
                      client.metabase.mom_change_percent < 0
                        ? "text-flag-red"
                        : "text-flag-green"
                    }`}
                  >
                    {client.metabase.mom_change_percent > 0 ? "+" : ""}
                    {client.metabase.mom_change_percent.toFixed(0)}% MoM
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted">Sin data</span>
            )}
          </div>

          <div className="ml-auto text-muted">
            {client.matched_sources}/3 fuentes
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          {/* WhatsApp alerts */}
          {client.whatsapp && client.whatsapp.alerts.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                📱 WhatsApp Alerts
              </h4>
              {client.whatsapp.alerts.map((alert, i) => (
                <AlertCard
                  key={i}
                  priority={alert.priority}
                  type={alert.type}
                  groupName={alert.group_name}
                  clientName={alert.client_name}
                  detail={alert.detail}
                  eventTime={alert.event_time}
                  hoursWithoutResponse={alert.hours_without_response}
                  actionSuggested={alert.action_suggested}
                  shared={alert.shared}
                />
              ))}
            </div>
          )}

          {/* Slack highlights */}
          {client.slack && client.slack.highlights.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                💬 Slack Highlights
              </h4>
              {client.slack.highlights.map((h, i) => (
                <div
                  key={i}
                  className="bg-background border border-border rounded-lg p-3 mb-2"
                >
                  <p className="text-sm">{h.summary}</p>
                  {h.detail && (
                    <p className="text-xs text-muted mt-1">{h.detail}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {h.risk_flag && (
                      <span className="text-[10px] font-semibold text-alta bg-red-50 px-1.5 py-0.5 rounded">
                        {h.risk_flag}
                      </span>
                    )}
                    {h.intervention_needed && (
                      <span className="text-[10px] font-semibold text-accent bg-indigo-50 px-1.5 py-0.5 rounded">
                        Intervención necesaria
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Metabase metrics */}
          {client.metabase && (
            <div>
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                📊 Métricas de uso
              </h4>
              <div className="bg-background border border-border rounded-lg p-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted text-xs">MRR</div>
                    <div className="font-semibold">
                      ${client.metabase.mrr?.toLocaleString() || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-xs">Conv. proyectadas</div>
                    <div className="font-semibold">
                      {client.metabase.conversations_projected?.toLocaleString() ||
                        "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-xs">MoM</div>
                    <div
                      className={`font-semibold ${
                        (client.metabase.mom_change_percent || 0) < 0
                          ? "text-flag-red"
                          : "text-flag-green"
                      }`}
                    >
                      {client.metabase.mom_change_percent !== undefined
                        ? `${client.metabase.mom_change_percent > 0 ? "+" : ""}${client.metabase.mom_change_percent.toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No data state */}
          {!client.whatsapp &&
            !client.slack &&
            !client.metabase && (
              <p className="text-sm text-muted">
                Sin datos disponibles para este cliente.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
