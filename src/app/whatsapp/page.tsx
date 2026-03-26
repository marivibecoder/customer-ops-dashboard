"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SummaryCards from "@/components/summary-cards";
import AlertCard from "@/components/alert-card";
import { TabRefreshButton } from "@/components/tab-refresh-button";
import type { PeriskopeReport, PeriskopeAlert } from "@/lib/types";

interface FlatAlert extends PeriskopeAlert {
  ops_name: string;
  ops_email: string | undefined;
}

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

  // Flatten all alerts into a single list
  const allAlerts: FlatAlert[] = data.ops_executives.flatMap((ops) =>
    ops.alerts.map((a) => ({
      ...a,
      ops_name: ops.name,
      ops_email: ops.email,
    }))
  );

  // Extract unique values for filters
  const opsNames = [...new Set(allAlerts.map((a) => a.ops_name))].sort();
  const allAlertTypes = [...new Set(allAlerts.map((a) => a.type))].sort();

  // Apply filters
  const filtered = allAlerts.filter((a) => {
    if (opsFilter && a.ops_name !== opsFilter) return false;
    if (priorityFilter && a.priority !== priorityFilter) return false;
    if (typeFilter && a.type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !a.group_name.toLowerCase().includes(s) &&
        !(a.client_name || "").toLowerCase().includes(s) &&
        !a.detail.toLowerCase().includes(s) &&
        !a.ops_name.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  // Sort: alta first, then media, then baja
  const sorted = filtered.sort((a, b) => {
    const order: Record<string, number> = { alta: 0, media: 1, baja: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

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
          placeholder="Buscar grupo, cliente u ops..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface w-64"
        />
        <span className="text-xs text-muted self-center">
          {filtered.length} de {allAlerts.length} alertas
        </span>
      </div>

      {/* Flat alert list */}
      <div className="space-y-3">
        {sorted.map((alert, i) => (
          <div key={i} className="relative">
            {/* Ops badge */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <span className="text-[10px] bg-surface2 text-muted px-2 py-0.5 rounded-full font-medium">
                {alert.ops_name}
              </span>
            </div>
            <AlertCard
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
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-10 text-muted text-sm">
            No hay alertas que coincidan con los filtros.
          </div>
        )}
      </div>

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
