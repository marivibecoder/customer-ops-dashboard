const styles = {
  alta: "bg-red-50 text-alta border-red-200",
  media: "bg-amber-50 text-media border-amber-200",
  baja: "bg-green-50 text-baja border-green-200",
};

const labels = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export default function PriorityBadge({
  priority,
}: {
  priority: "alta" | "media" | "baja";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[priority]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          priority === "alta"
            ? "bg-alta"
            : priority === "media"
              ? "bg-media"
              : "bg-baja"
        }`}
      />
      {labels[priority]}
    </span>
  );
}
