import PriorityBadge from "./priority-badge";

interface Props {
  priority: "alta" | "media" | "baja";
  type: string;
  groupName: string;
  clientName?: string;
  detail: string;
  eventTime?: string;
  hoursWithoutResponse?: number;
  actionSuggested?: string;
  shared?: boolean;
}

const borderColors = {
  alta: "border-l-alta",
  media: "border-l-media",
  baja: "border-l-baja",
};

export default function AlertCard({
  priority,
  type,
  groupName,
  clientName,
  detail,
  eventTime,
  hoursWithoutResponse,
  actionSuggested,
  shared,
}: Props) {
  return (
    <div
      className={`bg-background border border-border rounded-lg p-4 mb-3 border-l-[3px] ${borderColors[priority]}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={priority} />
          <span className="text-sm font-medium">{type}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted bg-surface2 px-2 py-0.5 rounded">
            {groupName}
          </span>
          {shared && (
            <span className="text-[10px] text-media bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              Compartido
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-foreground mb-2 leading-relaxed">{detail}</p>

      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {clientName && <span>👤 {clientName}</span>}
        {eventTime && (
          <span>🕐 {eventTime.slice(0, 16).replace("T", " ")}</span>
        )}
        {hoursWithoutResponse && <span>⏱️ {hoursWithoutResponse}h</span>}
      </div>

      {actionSuggested && (
        <div className="mt-3 px-3 py-2 bg-indigo-50 rounded-md text-sm text-accent border border-indigo-100">
          💡 {actionSuggested}
        </div>
      )}
    </div>
  );
}
