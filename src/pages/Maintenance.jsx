import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "../lib/supabaseClient";
import FilterBar from "../components/FilterBar";
import KpiCard from "../components/KpiCard";

const SHIFT_LABELS = ["Matin (07h-14h)", "Après-midi (14h-22h)", "Nuit (22h-07h)"];

function shiftForHour(h) {
  if (h >= 7 && h < 14) return SHIFT_LABELS[0];
  if (h >= 14 && h < 22) return SHIFT_LABELS[1];
  return SHIFT_LABELS[2];
}

function isoWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export default function Maintenance() {
  const [events, setEvents] = useState([]);
  const [lignesCount, setLignesCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("total");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data } = await supabase
        .from("pannes")
        .select(
          "ligne, code_panne, libelle_panne, duree_arret_min, date_panne, date_validation, referentiel_lignes!inner(en_perimetre)"
        )
        .eq("referentiel_lignes.en_perimetre", true)
        .limit(5000);
      setEvents(data ?? []);

      const { count } = await supabase
        .from("referentiel_lignes")
        .select("*", { count: "exact", head: true })
        .eq("en_perimetre", true);
      setLignesCount(count ?? 0);

      setLoading(false);
    }
    load();
  }, []);

  const monthsAvailable = useMemo(() => {
    const months = new Set(events.map((e) => e.date_panne?.slice(0, 7)).filter(Boolean));
    return months.size;
  }, [events]);

  const maxDate = useMemo(() => {
    const dates = events.map((e) => e.date_panne).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [events]);

  const { filteredEvents, windowLabel, windowFrom, windowTo } = useMemo(() => {
    if (!maxDate) return { filteredEvents: [], windowLabel: "", windowFrom: null, windowTo: null };
    const max = new Date(maxDate + "T00:00:00Z");

    if (period === "jour") {
      const f = events.filter((e) => e.date_panne === maxDate);
      return { filteredEvents: f, windowLabel: `journée du ${maxDate}`, windowFrom: maxDate, windowTo: maxDate };
    }
    if (period === "semaine") {
      const from = new Date(max);
      from.setUTCDate(from.getUTCDate() - 6);
      const fromStr = from.toISOString().slice(0, 10);
      const f = events.filter((e) => e.date_panne >= fromStr && e.date_panne <= maxDate);
      return {
        filteredEvents: f,
        windowLabel: `7 derniers jours (${fromStr} → ${maxDate})`,
        windowFrom: fromStr,
        windowTo: maxDate,
      };
    }
    if (period === "mois") {
      const ym = maxDate.slice(0, 7);
      const f = events.filter((e) => e.date_panne?.slice(0, 7) === ym);
      return { filteredEvents: f, windowLabel: `mois en cours (${ym})`, windowFrom: `${ym}-01`, windowTo: maxDate };
    }
    return { filteredEvents: events, windowLabel: "toute la période", windowFrom: null, windowTo: null };
  }, [events, period, maxDate]);

  const causes = useMemo(() => {
    const counts = {};
    filteredEvents.forEach((e) => {
      const key = e.libelle_panne || e.code_panne;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredEvents]);
  const pannePrincipale = causes[0]?.name ?? "—";

  const dureeArretTotale = useMemo(
    () => filteredEvents.reduce((sum, e) => sum + Number(e.duree_arret_min || 0), 0),
    [filteredEvents]
  );

  // Taux de disponibilité = 1 - (temps d'arrêt ÷ temps total disponible sur la fenêtre,
  // toutes lignes en périmètre confondues). Nécessite une fenêtre bornée (pas "shift",
  // qui ne définit pas de durée propre) et des durées d'arrêt réellement renseignées.
  const tauxDisponibilite = useMemo(() => {
    if (!windowFrom || !windowTo || !lignesCount) return null;
    const hasDurees = filteredEvents.some((e) => e.duree_arret_min != null);
    if (!hasDurees) return null;
    const minutesDisponibles = daysBetween(windowFrom, windowTo) * 24 * 60 * lignesCount;
    return Math.max(0, (1 - dureeArretTotale / minutesDisponibles) * 100);
  }, [windowFrom, windowTo, lignesCount, dureeArretTotale, filteredEvents]);

  const chartData = useMemo(() => {
    if (period === "jour") {
      const counts = {};
      events.forEach((e) => {
        if (!e.date_panne) return;
        counts[e.date_panne] = (counts[e.date_panne] || 0) + 1;
      });
      return Object.entries(counts)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .slice(-30)
        .map(([date, count]) => ({ label: date.slice(5), pannes: count }));
    }
    if (period === "semaine") {
      const counts = {};
      events.forEach((e) => {
        if (!e.date_panne) return;
        const week = isoWeekStart(e.date_panne);
        counts[week] = (counts[week] || 0) + 1;
      });
      return Object.entries(counts)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .slice(-16)
        .map(([week, count]) => ({ label: week.slice(5), pannes: count }));
    }
    if (period === "shift") {
      const counts = { [SHIFT_LABELS[0]]: 0, [SHIFT_LABELS[1]]: 0, [SHIFT_LABELS[2]]: 0 };
      events.forEach((e) => {
        if (!e.date_validation) return;
        const h = new Date(e.date_validation).getUTCHours();
        counts[shiftForHour(h)] += 1;
      });
      return SHIFT_LABELS.map((label) => ({ label, pannes: counts[label] }));
    }
    // mois / total : évolution mensuelle
    const counts = {};
    events.forEach((e) => {
      if (!e.date_panne) return;
      const month = e.date_panne.slice(0, 7);
      counts[month] = (counts[month] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([month, count]) => ({ label: month, pannes: count }));
  }, [period, events]);

  const chartTitle = {
    jour: "Pannes par jour (30 derniers jours avec données)",
    semaine: "Pannes par semaine (16 dernières semaines)",
    mois: "Évolution mensuelle des pannes",
    total: "Évolution mensuelle des pannes",
    shift: "Répartition des pannes par shift",
  }[period];

  if (loading) return <div className="p-8 text-navy-500">Chargement…</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Dashboard maintenance — pannes</h1>
        <p className="text-sm text-navy-500 mt-1">{monthsAvailable} mois de données disponibles</p>
      </div>

      <FilterBar monthsAvailable={monthsAvailable} shiftAvailable onChange={setPeriod} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label={`Taux de disponibilité — ${windowLabel}`}
          value={tauxDisponibilite != null ? tauxDisponibilite.toFixed(2) : "—"}
          unit={tauxDisponibilite != null ? "%" : undefined}
          tone={tauxDisponibilite != null ? (tauxDisponibilite < 98 ? "danger" : "success") : "neutral"}
        />
        <KpiCard label={`Pannes — ${windowLabel}`} value={filteredEvents.length} />
        <KpiCard label="Panne principale" value={pannePrincipale} />
        <KpiCard label="Lignes en périmètre" value={lignesCount ?? "—"} />
      </div>

      {tauxDisponibilite == null && period !== "shift" && (
        <p className="text-xs text-navy-400">
          Taux de disponibilité non calculable : aucune durée d'arrêt (`duree_arret_min`) n'est
          encore renseignée dans les pannes importées.
        </p>
      )}
      {period === "shift" && (
        <p className="text-xs text-navy-400">
          Taux de disponibilité non affiché par shift : cette vue regroupe les pannes par poste,
          pas sur une fenêtre de temps bornée.
        </p>
      )}

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">{chartTitle}</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDF0FA" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={period === "shift" ? 0 : 2} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="pannes" fill="#4C63AA" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {chartData.length === 0 && (
          <p className="text-xs text-navy-400 mt-2">
            Aucune panne importée pour l'instant — utilise Import Excel une fois qu'un export
            maintenance daté sera disponible.
          </p>
        )}
      </div>

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">Top 5 pannes — {windowLabel}</p>
        <ul className="space-y-2">
          {causes.length === 0 && <li className="text-sm text-navy-400">Aucune donnée sur cette période.</li>}
          {causes.map((c) => (
            <li key={c.name} className="flex justify-between text-sm border-b border-navy-100 pb-2">
              <span className="text-navy-700">{c.name}</span>
              <span className="mono-num">{c.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
