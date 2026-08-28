const STATUS_STYLES = {
  pending:          "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
  in_progress:      "bg-blue-100 text-blue-700",
  completed:        "bg-purple-100 text-purple-700",
  failed:           "bg-red-100 text-red-700",
  rejected:         "bg-orange-100 text-orange-700",
  ready_for_pickup: "bg-amber-100 text-amber-700",
  delivered:        "bg-green-100 text-green-700",
  unclaimed:        "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  pending:          "Pending",
  in_progress:      "In Progress",
  completed:        "Completed",
  failed:           "Failed",
  rejected:         "Rejected",
  ready_for_pickup: "Ready for Pickup",
  delivered:        "Delivered",
  unclaimed:        "Unclaimed",
};

export default function JobStatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
