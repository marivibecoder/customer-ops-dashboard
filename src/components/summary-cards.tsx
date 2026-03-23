interface Card {
  label: string;
  value: number | string;
  color?: "alta" | "media" | "baja" | "accent" | "default";
}

const colorMap = {
  alta: "text-alta",
  media: "text-media",
  baja: "text-baja",
  accent: "text-accent",
  default: "text-foreground",
};

export default function SummaryCards({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-surface border border-border rounded-xl p-5 text-center shadow-sm"
        >
          <div
            className={`text-3xl font-bold ${colorMap[card.color || "default"]}`}
          >
            {card.value}
          </div>
          <div className="text-xs text-muted uppercase tracking-wide mt-1">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
