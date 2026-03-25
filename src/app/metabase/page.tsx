"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SummaryCards from "@/components/summary-cards";
import FlagBadge from "@/components/flag-badge";
import { TabRefreshButton } from "@/components/tab-refresh-button";
import type { MetabaseReport } from "@/lib/types";

function MetabasePageInner() {
  const searchParams = useSearchParams();
  const date =
    searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const [data, setData] = useState<MetabaseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [flagFilter, setFlagFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/data/metabase?date=${date}`)
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
        No hay datos de Metabase para {date}.
        <br />
        <span className="text-xs">
          El reporte de Metabase se genera cada 2 semanas.
        </span>
      </div>
    );

  const owners = [...new Set(data.accounts.map((a) => a.owner))].sort();
  const months = data.accounts[0]
    ? Object.keys(data.accounts[0].months)
    : [];

  const filtered = data.accounts.filter((a) => {
    if (flagFilter && a.flag !== flagFilter) return false;
    if (ownerFilter && a.owner !== ownerFilter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Métricas de Uso</h2>
          <p className="text-xs text-muted">
            {data.data_range}
            {data.projection_note && ` | Proyección: ${data.projection_note}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{date}</span>
          <TabRefreshButton source="metabase" />
        </div>
      </div>

      <SummaryCards
        cards={[
          {
            label: "Cuentas",
            value: data.summary.total_accounts,
            color: "accent",
          },
          {
            label: "Flagged",
            value: data.summary.flagged_accounts,
            color: "accent",
          },
          { label: "Red Flags", value: data.summary.red_flags, color: "alta" },
          {
            label: "Green Flags",
            value: data.summary.green_flags,
            color: "baja",
          },
        ]}
      />

      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={flagFilter}
          onChange={(e) => setFlagFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface"
        >
          <option value="">Todos los flags</option>
          <option value="RED">🔴 Red Flags</option>
          <option value="GREEN">🟢 Green Flags</option>
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface"
        >
          <option value="">Todos los owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o.split("@")[0]}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Buscar cuenta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface w-64"
        />
        <span className="text-xs text-muted self-center">
          {filtered.length} de {data.accounts.length} cuentas
        </span>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface2 text-xs text-muted uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Flag</th>
              <th className="text-left px-4 py-3 font-semibold">Cuenta</th>
              <th className="text-left px-4 py-3 font-semibold">Owner</th>
              <th className="text-left px-4 py-3 font-semibold">Phase</th>
              <th className="text-right px-4 py-3 font-semibold">MRR</th>
              {months.map((m) => (
                <th key={m} className="text-right px-4 py-3 font-semibold">
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </th>
              ))}
              <th className="text-right px-4 py-3 font-semibold">
                Proyectado
              </th>
              <th className="text-right px-4 py-3 font-semibold">MoM %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((account) => (
              <tr
                key={account.name}
                className="border-t border-border hover:bg-surface2/50"
              >
                <td className="px-4 py-3">
                  <FlagBadge flag={account.flag} />
                </td>
                <td className="px-4 py-3 font-medium">{account.name}</td>
                <td className="px-4 py-3 text-muted">
                  {account.owner.split("@")[0]}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      account.phase.toLowerCase().includes("churn")
                        ? "bg-amber-50 text-media"
                        : "bg-surface2 text-muted"
                    }`}
                  >
                    {account.phase}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted">
                  ${account.mrr.toLocaleString()}
                </td>
                {months.map((m) => (
                  <td key={m} className="px-4 py-3 text-right">
                    {(account.months[m] || 0).toLocaleString()}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-medium">
                  {account.current_month_projected.toLocaleString()}
                </td>
                <td
                  className={`px-4 py-3 text-right font-bold ${
                    account.mom_change_percent < 0
                      ? "text-flag-red"
                      : "text-flag-green"
                  }`}
                >
                  {account.mom_change_percent > 0 ? "+" : ""}
                  {account.mom_change_percent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MetabasePage() {
  return (
    <Suspense>
      <MetabasePageInner />
    </Suspense>
  );
}
