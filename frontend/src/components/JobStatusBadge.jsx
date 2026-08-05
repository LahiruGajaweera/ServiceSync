const STATUS_STYLES = {
  pending:          "bg-gray-100 text-gray-600",
  in_progress:      "bg-blue-100 text-blue-700",
  completed:        "bg-purple-100 text-purple-700",
  ready_for_pickup: "bg-amber-100 text-amber-700",
  delivered:        "bg-green-100 text-green-700",
  unclaimed:        "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  pending:          "Pending",
  in_progress:      "In Progress",
  completed:        "Completed",
  ready_for_pickup: "Ready for Pickup",
  delivered:        "Delivered",
  unclaimed:        "Unclaimed",
};

export default function JobStatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-500";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
