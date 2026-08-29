import { useState } from "react";

/**
 * Barre de filtre de période. Les options affichées dépendent de la
 * profondeur de données disponible pour le module concerné :
 *  - < 2 mois de données  -> Semaine / Total / Par shift (pas de "Mois", pas de "Jour")
 *  - >= 2 mois de données -> Jour / Semaine / Mois / Total / Par shift
 *
 * Le filtre "Par shift" reste affiché mais désactivé si shiftAvailable=false
 * (ex: production, dont l'export actuel n'a pas d'horodatage par shift).
 */
export default function FilterBar({ monthsAvailable, shiftAvailable = true, onChange }) {
  const options = [];
  if (monthsAvailable >= 2) options.push("jour");
  options.push("semaine");
  if (monthsAvailable >= 2) options.push("mois");
  options.push("total");
  options.push("shift");

  const LABELS = { jour: "Jour", semaine: "Semaine", mois: "Mois", total: "Total", shift: "Par shift" };

  const [active, setActive] = useState(options.includes("total") ? "total" : options[0]);

  function select(opt) {
    if (opt === "shift" && !shiftAvailable) return;
    setActive(opt);
    onChange?.(opt);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const disabled = opt === "shift" && !shiftAvailable;
        const isActive = active === opt;
        return (
          <button
            key={opt}
            disabled={disabled}
            onClick={() => select(opt)}
            title={disabled ? "Pas encore d'horodatage par shift dans cette source" : undefined}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              disabled
                ? "border-navy-100 text-navy-300 cursor-not-allowed"
                : isActive
                ? "bg-navy-500 border-navy-500 text-white font-medium"
                : "border-navy-100 text-navy-700 hover:border-navy-400"
            }`}
          >
            {LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}
