"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SummaryCards from "@/components/summary-cards";
import ClientCard from "@/components/client-card";
import type {
  PeriskopeReport,
  SlackReport,
  MetabaseReport,
  MappingsFile,
  UnifiedClient,
} from "@/lib/types";

function ClientsPageInner() {
  const searchParams = useSearchParams();
  const date =
    searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const [clients, setClients] = useState<UnifiedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [periskopeRes, slackRes, metabaseRes, mappingsRes] =
          await Promise.all([
            fetch(`/api/data/periskope?date=${date}`).then((r) =>
              r.ok ? r.json() : null
            ),
            fetch(`/api/data/slack?date=${date}`).then((r) =>
              r.ok ? r.json() : null
            ),
            fetch(`/api/data/metabase?date=${date}`).then((r) =>
              r.ok ? r.json() : null
            ),
            fetch(`/api/mappings`).then((r) => (r.ok ? r.json() : {})),
          ]);

        const { buildUnifiedClients } = await import("@/lib/matcher");
        const unified = buildUnifiedClients(
          periskopeRes as PeriskopeReport | null,
          slackRes as SlackReport | null,
          metabaseRes as MetabaseReport | null,
          mappingsRes as MappingsFile
        );
        setClients(unified);
      } catch (e) {
        console.error("Failed to load data:", e);
      }
      setLoading(false);
    }
    load();
  }, [date]);

  const filtered = clients.filter((c) => {
    if (search && !c.display_name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (riskFilter && c.risk_level !== riskFilter) return false;
    return true;
  });

  const totalAlerts = clients.reduce(
    (sum, c) => sum + (c.whatsapp?.total_alerts || 0),
    0
  );
  const criticalCount = clients.filter(
    (c) => c.risk_level === "critical"
  ).length;
  const warningCount = clients.filter(
    (c) => c.risk_level === "warning"
  ).length;
  const redFlags = clients.filter((c) => c.metabase?.flag === "RED").length;
  const greenFlags = clients.filter((c) => c.metabase?.flag === "GREEN").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Vista por Cliente</h2>
        <div className="text-sm text-muted">{date}</div>
      </div>

      <SummaryCards
        cards={[
          { label: "Clientes", value: clients.length, color: "accent" },
          { label: "Alertas WA", value: totalAlerts, color: "accent" },
          { label: "Riesgo Alto", value: criticalCount, color: "alta" },
          { label: "Atención", value: warningCount, color: "media" },
          { label: "Red Flags", value: redFlags, color: "alta" },
          { label: "Green Flags", value: greenFlags, color: "baja" },
        ]}
      />

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 w-64"
        />
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none"
        >
          <option value="">Todos los niveles</option>
          <option value="critical">Riesgo Alto</option>
          <option value="warning">Atención</option>
          <option value="ok">OK</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted">
            {clients.length === 0
              ? "No hay datos disponibles para esta fecha."
              : "No se encontraron clientes con ese filtro."}
          </div>
        ) : (
          filtered.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))
        )}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsPageInner />
    </Suspense>
  );
}
