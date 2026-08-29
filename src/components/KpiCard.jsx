export default function KpiCard({ label, value, unit, tone = "neutral" }) {
  const toneClass =
    tone === "danger"
      ? "text-alert-red"
      : tone === "success"
      ? "text-alert-green"
      : "text-navy-900";

  return (
    <div className="bg-white rounded-card border border-navy-100 px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-navy-500">{label}</p>
      <p className={`mono-num text-2xl mt-1 ${toneClass}`}>
        {value}
        {unit && <span className="text-sm ml-1 font-sans font-normal text-navy-500">{unit}</span>}
      </p>
    </div>
  );
}
