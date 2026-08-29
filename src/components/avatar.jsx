const BG_COLORS = ["#4C63AA", "#35479D", "#1F2F94", "#7186C2"];

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function colorFor(name) {
  if (!name) return BG_COLORS[0];
  const sum = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return BG_COLORS[sum % BG_COLORS.length];
}

export default function Avatar({ name, size = 36 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-medium shrink-0"
      style={{ width: size, height: size, backgroundColor: colorFor(name), fontSize: size * 0.4 }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}