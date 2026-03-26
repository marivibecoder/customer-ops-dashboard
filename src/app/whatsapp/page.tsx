"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SummaryCards from "@/components/summary-cards";
import CollapsibleSection from "@/components/collapsible-section";
import AlertCard from "@/components/alert-card";
import PriorityBadge from "@/components/priority-badge";
import { TabRefreshButton } from "@/components/tab-refresh-button";
import type { PeriskopeReport } from "@/lib/types";

function WhatsAppPageInner() {
  const searchParams = useSearchParams();
  const date =
    searchParams.get("date") || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

  const [data, setData] = useState<PeriskopeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [opsFilter, setOpsFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/data/periskope?date=${date}`)
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
        No hay datos de WhatsApp para {date}
      </div>
    );

  // Extract unique values for filters
  const opsNames = data.ops_executives.map((o) => o.name).sort();
  const allAlertTypes = [
    ...new Set(
      data.ops_executives.flatMap((o) => o.alerts.map((a) => a.type))
    ),
  ].sort();

  // Filter ops executives and their alerts
  const hasActiveFilters = !!(priorityFilter || typeFilter || search);

  const filteredOps: typeof data.ops_executives = [];
  for (const ops of data.ops_executives) {
    // Filter by ops name
    if (opsFilter && ops.name !== opsFilter) continue;

    // Filter alerts
    const matchingAlerts = ops.alerts.filter((a) => {
      if (priorityFilter && a.priority !== priorityFilter) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !a.group_name.toLowerCase().includes(s) &&
          !(a.client_name || "").toLowerCase().includes(s) &&
          !a.detail.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });

    // If filters are active, only show ops with matching alerts
    if (hasActiveFilters && matchingAlerts.length === 0) continue;

    filteredOps.push({ ...ops, alerts: matchingAlerts });
  }

  const totalFiltered = filteredOps.reduce(
    (sum, ops) => sum + ops.alerts.length,
    0
  );
  const totalAlerts = data.ops_executives.reduce(
    (sum, ops) => sum + ops.alerts.length,
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">WhatsApp Alerts</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{date}</span>
          <TabRefreshButton source="periskope" />
        </div>
      </div>

      <SummaryCards
        cards={[
          {
            label: "Ops Monitoreados",
            value: data.summary.ops_monitored,
            color: "accent",
          },
          {
            label: "Grupos Activos",
            value: data.summary.active_groups,
            color: "accent",
          },
          {
            label: "Total Alertas",
            value: data.summary.total_alerts,
            color: "accent",
          },
          { label: "Alta", value: data.summary.alerts_alta, color: "alta" },
          { label: "Media", value: data.summary.alerts_media, color: "media" },
          { label: "Baja", value: data.summary.alerts_baja, color: "baja" },
        ]}
      />

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={opsFilter}
          onChange={(e) => setOpsFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface"
        >
          <option value="">Todos los ops</option>
          {opsNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface"
        >
          <option value="">Todas las prioridades</option>
          <option value="alta">🔴 Alta</option>
          <option value="media">🟠 Media</option>
          <option value="baja">🟢 Baja</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface"
        >
          <option value="">Todos los tipos</option>
          {allAlertTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Buscar grupo o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface w-64"
        />
        <span className="text-xs text-muted self-center">
          {totalFiltered} de {totalAlerts} alertas
        </span>
      </div>

      {filteredOps.map((ops) => {
        const alta = ops.alerts.filter((a) => a.priority === "alta").length;
        const media = ops.alerts.filter((a) => a.priority === "media").length;
        const baja = ops.alerts.filter((a) => a.priority === "baja").length;
        const initials = ops.name
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || "")
          .join("");

        return (
          <CollapsibleSection
            key={ops.name}
            title={ops.name}
            subtitle={`${ops.alerts.length} alerta${ops.alerts.length !== 1 ? "s" : ""}`}
            avatar={initials}
            defaultOpen={alta > 0}
            badges={
              <div className="flex gap-1.5">
                {alta > 0 && <PriorityBadge priority="alta" />}
                {media > 0 && <PriorityBadge priority="media" />}
                {baja > 0 && <PriorityBadge priority="baja" />}
              </div>
            }
          >
            {ops.alerts.length === 0 ? (
              <p className="text-sm text-muted py-2">✅ Sin alertas</p>
            ) : (
              ops.alerts
                .sort((a, b) => {
                  const order = { alta: 0, media: 1, baja: 2 };
                  return order[a.priority] - order[b.priority];
                })
                .map((alert, i) => (
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
                ))
            )}
          </CollapsibleSection>
        );
      })}

      {data.observations && data.observations.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 mt-6">
          <h3 className="text-sm font-semibold mb-3">💡 Observaciones</h3>
          {data.observations.map((obs, i) => (
            <p key={i} className="text-sm text-foreground mb-2">
              {obs}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppPage() {
  return (
    <Suspense>
      <WhatsAppPageInner />
    </Suspense>
  );
}
