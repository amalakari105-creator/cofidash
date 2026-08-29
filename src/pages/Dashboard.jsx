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

// Ordre demandé : Matin, Après-midi, puis Nuit.
const SHIFT_LABELS = ["Matin (07h-14h)", "Après-midi (14h-22h)", "Nuit (22h-07h)"];

function shiftForHour(h) {
  if (h >= 7 && h < 14) return SHIFT_LABELS[0];
  if (h >= 14 && h < 22) return SHIFT_LABELS[1];
  return SHIFT_LABELS[2];
}

function isoWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7; // dimanche -> 7
  d.setUTCDate(d.getUTCDate() - day + 1); // recule jusqu'au lundi
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [synthese, setSynthese] = useState([]);
  const [events, setEvents] = useState([]);
  const [production, setProduction] = useState([]);
  const [lignesCount, setLignesCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("total");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: syntheseData } = await supabase
        .from("v_synthese_mensuelle")
        .select("*")
        .order("annee", { ascending: true })
        .order("mois_num", { ascending: true });
      setSynthese(syntheseData ?? []);

      const { data: evenements } = await supabase
        .from("evenements_qualite")
        .select(
          "code_defaut, libelle_defaut, quantite_m, date_production, date_validation, referentiel_lignes!inner(en_perimetre)"
        )
        .eq("referentiel_lignes.en_perimetre", true)
        .limit(5000);
      setEvents(evenements ?? []);

      // Uniquement les vrais totaux journaliers (shift = null) pour ne pas
      // compter en double avec la répartition par shift générée ensuite.
      const { data: productionData } = await supabase
        .from("production_journaliere")
        .select("date, quantite_produite_m, referentiel_lignes!inner(en_perimetre)")
        .eq("referentiel_lignes.en_perimetre", true)
        .is("shift", null);
      setProduction(productionData ?? []);

      const { count } = await supabase
        .from("referentiel_lignes")
        .select("*", { count: "exact", head: true })
        .eq("en_perimetre", true);
      setLignesCount(count ?? 0);

      setLoading(false);
    }
    load();
  }, []);

  const monthsAvailable = synthese.length;
  const lastMonth = synthese[synthese.length - 1];

  // Longueur moyenne d'une bobine (m), estimée depuis les événements qualité —
  // sert à convertir un volume produit (m) en un nombre de bobines estimé.
  const avgBobineLength = useMemo(() => {
    const lengths = events.map((e) => Number(e.quantite_m)).filter((v) => v > 0);
    if (!lengths.length) return null;
    return lengths.reduce((sum, v) => sum + v, 0) / lengths.length;
  }, [events]);

  const maxDate = useMemo(() => {
    const dates = events.map((e) => e.date_production).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [events]);

  const { filteredEvents, windowLabel, windowFrom, windowTo } = useMemo(() => {
    if (!maxDate) return { filteredEvents: [], windowLabel: "", windowFrom: null, windowTo: null };
    const max = new Date(maxDate + "T00:00:00Z");

    if (period === "jour") {
      const f = events.filter((e) => e.date_production === maxDate);
      return { filteredEvents: f, windowLabel: `journée du ${maxDate}`, windowFrom: maxDate, windowTo: maxDate };
    }
    if (period === "semaine") {
      const from = new Date(max);
      from.setUTCDate(from.getUTCDate() - 6);
      const fromStr = from.toISOString().slice(0, 10);
      const f = events.filter((e) => e.date_production >= fromStr && e.date_production <= maxDate);
      return {
        filteredEvents: f,
        windowLabel: `7 derniers jours (${fromStr} → ${maxDate})`,
        windowFrom: fromStr,
        windowTo: maxDate,
      };
    }
    if (period === "mois") {
      const ym = maxDate.slice(0, 7);
      const f = events.filter((e) => e.date_production?.slice(0, 7) === ym);
      return { filteredEvents: f, windowLabel: `mois en cours (${ym})`, windowFrom: `${ym}-01`, windowTo: maxDate };
    }
    return { filteredEvents: events, windowLabel: "toute la période", windowFrom: null, windowTo: null };
  }, [events, period, maxDate]);

  const causes = useMemo(() => {
    const counts = {};
    filteredEvents.forEach((e) => {
      const key = e.libelle_defaut || e.code_defaut;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredEvents]);
  const causePrincipale = causes[0]?.name ?? "—";

  // Volume produit (m) dans la fenêtre courante, à partir de production_journaliere.
  const volumeInWindow = useMemo(() => {
    if (!windowFrom || !windowTo) return null;
    return production
      .filter((p) => p.date >= windowFrom && p.date <= windowTo)
      .reduce((sum, p) => sum + Number(p.quantite_produite_m || 0), 0);
  }, [production, windowFrom, windowTo]);

  // Taux NC : exact quand la synthèse mensuelle connaît Conforme/Total (mois/total) ;
  // sinon estimé à partir du volume produit ÷ longueur moyenne d'une bobine.
  const { tauxNC, tauxIsEstimate } = useMemo(() => {
    if (period === "mois" && maxDate) {
      const ym = maxDate.slice(0, 7);
      const row = synthese.find((s) => `${s.annee}-${String(s.mois_num).padStart(2, "0")}` === ym);
      if (row?.taux_nc_pct != null) return { tauxNC: row.taux_nc_pct, tauxIsEstimate: false };
    }
    if (period === "total" || period === "shift") {
      const known = synthese.filter((s) => s.total != null);
      if (known.length) {
        const totalNC = known.reduce((sum, s) => sum + s.non_conforme, 0);
        const totalAll = known.reduce((sum, s) => sum + s.total, 0);
        if (totalAll) return { tauxNC: (totalNC / totalAll) * 100, tauxIsEstimate: false };
      }
    }
    // Estimation via volume produit ÷ longueur moyenne de bobine
    if (avgBobineLength && volumeInWindow) {
      const estBobines = volumeInWindow / avgBobineLength;
      if (estBobines > 0) {
        return { tauxNC: (filteredEvents.length / estBobines) * 100, tauxIsEstimate: true };
      }
    }
    return { tauxNC: null, tauxIsEstimate: false };
  }, [period, maxDate, synthese, avgBobineLength, volumeInWindow, filteredEvents]);

  const nonConformesCount =
    period === "mois" && lastMonth?.non_conforme != null && maxDate?.slice(0, 7) === `${lastMonth.annee}-${String(lastMonth.mois_num).padStart(2, "0")}`
      ? lastMonth.non_conforme
      : filteredEvents.length;

  const chartData = useMemo(() => {
    if (period === "jour") {
      const counts = {};
      events.forEach((e) => {
        if (!e.date_production) return;
        counts[e.date_production] = (counts[e.date_production] || 0) + 1;
      });
      return Object.entries(counts)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .slice(-30)
        .map(([date, count]) => ({ label: date.slice(5), non_conforme: count }));
    }
    if (period === "semaine") {
      const counts = {};
      events.forEach((e) => {
        if (!e.date_production) return;
        const week = isoWeekStart(e.date_production);
        counts[week] = (counts[week] || 0) + 1;
      });
      return Object.entries(counts)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .slice(-16)
        .map(([week, count]) => ({ label: week.slice(5), non_conforme: count }));
    }
    if (period === "shift") {
      const counts = { [SHIFT_LABELS[0]]: 0, [SHIFT_LABELS[1]]: 0, [SHIFT_LABELS[2]]: 0 };
      events.forEach((e) => {
        if (!e.date_validation) return;
        const h = new Date(e.date_validation).getUTCHours();
        counts[shiftForHour(h)] += 1;
      });
      return SHIFT_LABELS.map((label) => ({ label, non_conforme: counts[label] }));
    }
    return synthese.map((row) => ({ label: row.periode, non_conforme: row.non_conforme }));
  }, [period, events, synthese]);

  const chartTitle = {
    jour: "Non-conformités par jour (30 derniers jours avec données)",
    semaine: "Non-conformités par semaine (16 dernières semaines)",
    mois: "Évolution mensuelle des non-conformités trancannage",
    total: "Évolution mensuelle des non-conformités trancannage",
    shift: "Répartition des non-conformités par shift",
  }[period];

  if (loading) return <div className="p-8 text-navy-500">Chargement des KPIs…</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Dashboard qualité — trancannage</h1>
        <p className="text-sm text-navy-500 mt-1">{monthsAvailable} mois de données disponibles</p>
      </div>

      <FilterBar monthsAvailable={monthsAvailable} shiftAvailable onChange={setPeriod} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label={`Taux NC${tauxIsEstimate ? " (estimé)" : ""} — ${windowLabel}`}
          value={tauxNC != null ? tauxNC.toFixed(2) : "—"}
          unit={tauxNC != null ? "%" : undefined}
          tone={tauxNC != null ? (tauxNC > 0.7 ? "danger" : "success") : "neutral"}
        />
        <KpiCard label={`Non-conformes — ${windowLabel}`} value={nonConformesCount} />
        <KpiCard label="Cause principale" value={causePrincipale} />
        <KpiCard label="Lignes en périmètre" value={lignesCount ?? "—"} />
      </div>

      {tauxIsEstimate && (
        <p className="text-xs text-navy-400">
          Taux NC estimé : volume produit sur la période ÷ longueur moyenne d'une bobine (
          {avgBobineLength ? `${Math.round(avgBobineLength).toLocaleString("fr-FR")} m` : "—"}). Le
          niveau Mois/Total utilise le vrai décompte Conforme quand il est connu.
        </p>
      )}

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">{chartTitle}</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDF0FA" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={period === "shift" ? 0 : 2} />
            <YAxis tick={{ fontSize: 11 }} domain={period === "shift" ? [150, 220] : undefined} />
            <Tooltip />
            <Bar dataKey="non_conforme" fill="#4C63AA" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">Top 5 défaut — {windowLabel}</p>
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
