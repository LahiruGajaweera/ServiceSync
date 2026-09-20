export default function AlertCard({ title, value, type, message }) {
  const styles = {
    critical: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    ok: "bg-green-50 border-green-200 text-green-800",
  };
  const currentStyle = styles[type] || styles.ok;

  return (
    <div className={`p-4 rounded-xl border ${currentStyle} flex flex-col justify-between`}>
      <h4 className="font-bold">{title}</h4>
      <p className="text-sm mt-1">{message}</p>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-2xl font-black">{value}</span>
      </div>
    </div>
  );
}
