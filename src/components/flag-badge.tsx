export default function FlagBadge({ flag }: { flag: "RED" | "GREEN" }) {
  const isRed = flag === "RED";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        isRed
          ? "bg-red-50 text-flag-red border-red-200"
          : "bg-green-50 text-flag-green border-green-200"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isRed ? "bg-flag-red" : "bg-flag-green"}`}
      />
      {isRed ? "Red Flag" : "Green Flag"}
    </span>
  );
}
