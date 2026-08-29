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
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

// Ce dashboard est spécifiquement dédié au trancannage — evenements_qualite
// contient TOUS les types de défauts (import brut de MUL_COFTN), donc on
// filtre ici sur ce seul défaut pour ne pas mélanger avec les autres causes.
function isTrancannage(e) {
  return e.code_defaut === "C07" || e.libelle_defaut === "Mauvais trancannage";
}

export default function Dashboard() {
  const [synthese, setSynthese] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
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
          "ligne, n_serie_bobine, code_defaut, libelle_defaut, quantite_m, date_production, date_validation, referentiel_lignes!inner(en_perimetre)"
        )
        .eq("referentiel_lignes.en_perimetre", true)
        .limit(5000);
      setAllEvents(evenements ?? []);

      // Uniquement les vrais totaux journaliers (shift = null) — les lignes avec
      // shift renseigné sont la répartition de démonstration, pas à additionner ici.
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

  // Tout ce dashboard ne regarde que le trancannage.


  const monthsAvailable = synthese.length;
  const lastMonth = synthese[synthese.length - 1];

  const maxDate = useMemo(() => {
    const dates = allEvents.map((e) => e.date_production).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [allEvents]);

  const { filteredEvents, windowLabel, windowFrom, windowTo } = useMemo(() => {
    if (!maxDate) return { filteredEvents: [], windowLabel: "", windowFrom: null, windowTo: null };
    const max = new Date(maxDate + "T00:00:00Z");

    if (period === "jour") {
      const f = allEvents.filter((e) => e.date_production === maxDate);
      return { filteredEvents: f, windowLabel: `journée du ${maxDate}`, windowFrom: maxDate, windowTo: maxDate };
    }
    if (period === "semaine") {
      const from = new Date(max);
      from.setUTCDate(from.getUTCDate() - 6);
      const fromStr = from.toISOString().slice(0, 10);
      const f = allEvents.filter((e) => e.date_production >= fromStr && e.date_production <= maxDate);
      return {
        filteredEvents: f,
        windowLabel: `7 derniers jours (${fromStr} → ${maxDate})`,
        windowFrom: fromStr,
        windowTo: maxDate,
      };
    }
    if (period === "mois") {
      const ym = maxDate.slice(0, 7);
      const f = allEvents.filter((e) => e.date_production?.slice(0, 7) === ym);
      return { filteredEvents: f, windowLabel: `mois en cours (${ym})`, windowFrom: `${ym}-01`, windowTo: maxDate };
    }
    return { filteredEvents: allEvents, windowLabel: "toute la période", windowFrom: null, windowTo: null };
  }, [allEvents, period, maxDate]);

  // Une bobine peut apparaître sur plusieurs lignes d'import (rare pour un même
  // défaut, mais on compte les bobines distinctes pour rester exact).
  function distinctBobines(list) {
    return new Set(list.map((e) => e.n_serie_bobine)).size;
  }

  console.log(allEvents)

  const topLignes = useMemo(() => {
    const byLigne = {};
    filteredEvents.forEach((e) => {
      if (!byLigne[e.libelle_defaut]) byLigne[e.libelle_defaut] = [];
      byLigne[e.libelle_defaut].push(e);
    });
    return Object.entries(byLigne)
      .map(([libelle_defaut, list]) => ({ name: libelle_defaut, count: distinctBobines(list) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredEvents]);
  const lignePrincipale = topLignes[0]?.name ?? "—";

  // Volume produit (m) dans la fenêtre courante, à partir de production_journaliere.
  const volumeInWindow = useMemo(() => {
    if (!windowFrom || !windowTo) return null;
    return production
      .filter((p) => p.date >= windowFrom && p.date <= windowTo)
      .reduce((sum, p) => sum + Number(p.quantite_produite_m || 0), 0);
  }, [production, windowFrom, windowTo]);

  

  // Volume de câble en trancannage dans la fenêtre (m), pour un vrai ratio volume/volume.
  const ncVolumeInWindow = useMemo(
    () => filteredEvents.reduce((sum, e) => sum + Number(e.quantite_m || 0), 0),
    [filteredEvents]
  );

  // Taux NC : la synthèse mensuelle (Conforme réel, issue de la QA) fait foi quand
  // elle couvre la période (Mois/Total). Sinon (Jour/Semaine), ratio réel
  // volume défectueux ÷ volume produit — les deux mesurés en mètres, aucune
  // estimation. "Shift" reste "—" : la répartition horaire de production_journaliere
  // est une donnée de démonstration, pas un vrai décompte, donc pas fiable comme
  // dénominateur.
  const { tauxNC, tauxSource } = useMemo(() => {
    if (period === "mois" && maxDate) {
      const ym = maxDate.slice(0, 7);
      const row = synthese.find((s) => `${s.annee}-${String(s.mois_num).padStart(2, "0")}` === ym);
      if (row?.taux_nc_pct != null) return { tauxNC: row.taux_nc_pct, tauxSource: "synthese" };
    }
    if (period === "total") {
      const known = synthese.filter((s) => s.total != null);
      if (known.length) {
        const totalNC = known.reduce((sum, s) => sum + s.non_conforme, 0);
        const totalAll = known.reduce((sum, s) => sum + s.total, 0);
        if (totalAll) return { tauxNC: (totalNC / totalAll) * 100, tauxSource: "synthese" };
      }
    }
    if (period !== "shift" && volumeInWindow) {
      return { tauxNC: (ncVolumeInWindow / volumeInWindow) * 100, tauxSource: "volume" };
    }
    return { tauxNC: null, tauxSource: null };
  }, [period, maxDate, synthese, volumeInWindow, ncVolumeInWindow]);

  const nonConformesCount =
    period === "mois" && lastMonth?.non_conforme != null && maxDate?.slice(0, 7) === `${lastMonth.annee}-${String(lastMonth.mois_num).padStart(2, "0")}`
      ? lastMonth.non_conforme
      : distinctBobines(filteredEvents);

  const chartData = useMemo(() => {
    if (period === "jour") {
      const byDate = {};
      allEvents.forEach((e) => {
        if (!e.date_production) return;
        (byDate[e.date_production] ||= []).push(e);
      });
      return Object.entries(byDate)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .slice(-30)
        .map(([date, list]) => ({ label: date.slice(5), non_conforme: distinctBobines(list) }));
    }
    if (period === "semaine") {
      const byWeek = {};
      allEvents.forEach((e) => {
        if (!e.date_production) return;
        const week = isoWeekStart(e.date_production);
        (byWeek[week] ||= []).push(e);
      });
      return Object.entries(byWeek)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .slice(-16)
        .map(([week, list]) => ({ label: week.slice(5), non_conforme: distinctBobines(list) }));
    }
    if (period === "shift") {
      const byShift = { [SHIFT_LABELS[0]]: [], [SHIFT_LABELS[1]]: [], [SHIFT_LABELS[2]]: [] };
      allEvents.forEach((e) => {
        if (!e.date_validation) return;
        const h = new Date(e.date_validation).getUTCHours();
        byShift[shiftForHour(h)].push(e);
      });
      return SHIFT_LABELS.map((label) => ({ label, non_conforme: distinctBobines(byShift[label]) }));
    }
    return synthese.map((row) => ({ label: row.periode, non_conforme: row.non_conforme }));
  }, [period, allEvents, synthese]);

  const chartTitle = {
    jour: "Trancannage par jour (30 derniers jours avec données)",
    semaine: "Trancannage par semaine (16 dernières semaines)",
    mois: "Évolution mensuelle des non-conformités trancannage",
    total: "Évolution mensuelle des non-conformités trancannage",
    shift: "Répartition du trancannage par shift",
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
          label={`Taux NC — ${windowLabel}`}
          value={tauxNC != null ? tauxNC.toFixed(2) : "—"}
          unit={tauxNC != null ? "%" : undefined}
          tone={tauxNC != null ? (tauxNC > 0.7 ? "danger" : "success") : "neutral"}
        />
        <KpiCard label={`Non-conformes — ${windowLabel}`} value={nonConformesCount} />
        <KpiCard label="Ligne principale" value={lignePrincipale} />
        <KpiCard label="Lignes en périmètre" value={lignesCount ?? "—"} />
      </div>

      {tauxSource === "volume" && (
        <p className="text-xs text-navy-400">
          Taux NC en volume : mètres de câble en trancannage ÷ mètres produits sur la même période
          (source : production_journaliere). Mois/Total utilisent le décompte Conforme officiel
          quand il est disponible.
        </p>
      )}
      {period === "shift" && (
        <p className="text-xs text-navy-400">
          Taux NC non affiché par shift : la répartition horaire de la production est une donnée
          de démonstration, pas un vrai décompte — l'utiliser comme dénominateur donnerait un taux
          trompeur.
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
        {chartData.length === 0 && (
          <p className="text-xs text-navy-400 mt-2">
            Aucune donnée à afficher — vérifie que la table correspondante est bien importée.
          </p>
        )}
      </div>

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">Top lignes — {windowLabel}</p>
        <ul className="space-y-2">
          {topLignes.length === 0 && <li className="text-sm text-navy-400">Aucune donnée sur cette période.</li>}
          {topLignes.map((l) => (
            <li key={l.name} className="flex justify-between text-sm border-b border-navy-100 pb-2">
              <span className="text-navy-700 mono-num">{l.name}</span>
              <span className="mono-num">{l.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
