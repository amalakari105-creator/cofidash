import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

const SHIFT_ORDER = ["Matin (07h-14h)", "Après-midi (14h-22h)", "Nuit (22h-07h)"];

function isoWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function isoToday(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toISOString().slice(0, 10);
}

export default function DashboardProduction() {
  const [rows, setRows] = useState([]); // totaux journaliers réels
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("total");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("production_journaliere")
        .select("ligne, date, quantite_produite_m, referentiel_lignes!inner(en_perimetre)")
        .eq("referentiel_lignes.en_perimetre", true)
        .is("shift", null)
        .order("date", { ascending: true });
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const monthsAvailable = useMemo(() => {
    const months = new Set(rows.map((r) => r.date?.slice(0, 7)));
    return months.size;
  }, [rows]);

  const totalVolumeAllTime = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.quantite_produite_m || 0), 0),
    [rows]
  );

  const byTotal = useMemo(() => {
    const totals = {};
    rows.forEach((r) => {
      totals[r.date] = (totals[r.date] || 0) + Number(r.quantite_produite_m || 0);
    });
    return Object.entries(totals)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, total]) => ({ date, total }));
  }, [rows]);

  //  const byDay = useMemo(() => {
  //   const totals = {};
  //   rows.forEach((r) => {
  //     if (!r.date) return;
  //     const day = isoToday();
  //     console.log(r.date, day, r.quantite_produite_m);
  //     totals[day] = (totals[day] || 0) + Number(r.quantite_produite_m || 0);
  //   });
  //   return Object.entries(totals)
  //     .map(([day, total]) => ({ date: day, total }));
  // }, [rows]);

  const byWeek = useMemo(() => {
    const totals = {};
    rows.forEach((r) => {
      if (!r.date) return;
      const week = isoWeekStart(r.date);
      totals[week] = (totals[week] || 0) + Number(r.quantite_produite_m || 0);
    });
    return Object.entries(totals)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([week, total]) => ({ date: week, total }));
  }, [rows]);

  const byMonth = useMemo(() => {
    const totals = {};
    rows.forEach((r) => {
      if (!r.date) return;
      const month = r.date.slice(0, 7);
      totals[month] = (totals[month] || 0) + Number(r.quantite_produite_m || 0);
    });
    return Object.entries(totals)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([month, total]) => ({ date: month, total }));
  }, [rows]);

  // "Par shift" : pas d'horodatage réel par poste dans l'export production
  // (contrairement à la qualité) — on répartit donc le total en 3 parts égales,
  // clairement présenté comme tel, plutôt que d'inventer une pondération.
  const byShift = useMemo(() => {
    const third = Math.round(totalVolumeAllTime / 3);
    return SHIFT_ORDER.map((label) => ({ date: label, total: third }));
  }, [totalVolumeAllTime]);

  const scopedRows = useMemo(() => {
    if (!rows.length) return rows;
    if (period === "semaine") {
      const lastWeek = isoWeekStart(rows[rows.length - 1].date);
      return rows.filter((r) => isoWeekStart(r.date) === lastWeek);
    }
    if (period === "mois") {
      const lastMonth = rows[rows.length - 1].date?.slice(0, 7);
      return rows.filter((r) => r.date?.slice(0, 7) === lastMonth);
    }
    return rows; // total et shift : tout l'historique
  }, [rows, period]);

  const scopedVolume =
    period === "shift"
      ? totalVolumeAllTime
      : scopedRows.reduce((sum, r) => sum + Number(r.quantite_produite_m || 0), 0);
  const scopedDays = new Set(scopedRows.map((r) => r.date)).size;
  const avgPerDay = scopedDays ? Math.round(scopedVolume / scopedDays) : 0;
  const chartData = { semaine: byWeek, mois: byMonth, shift: byShift, total: byTotal }[period];
  const chartTitle = {
    semaine: "Production par semaine (mètres)",
    mois: "Production par mois (mètres)",
    shift: "Production par shift (mètres) — total ÷ 3",
    total: "Production journalière (mètres)",
  }[period];
  const windowLabel = {
    semaine: "semaine en cours",
    mois: "mois en cours",
    shift: "toute la période",
    total: "toute la période",
  }[period];

  if (loading) return <div className="p-8 text-navy-500">Chargement…</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Dashboard production — capacité</h1>
        <p className="text-sm text-navy-500 mt-1">{monthsAvailable} mois de données disponibles</p>
      </div>

      <FilterBar monthsAvailable={monthsAvailable} todayAvailable={false} shiftAvailable onChange={setPeriod} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label={`Volume — ${windowLabel}`} value={scopedVolume.toLocaleString("fr-FR")} unit="m" />
        <KpiCard label="Moyenne / jour" value={avgPerDay.toLocaleString("fr-FR")} unit="m" />
        <KpiCard label="Jours de production" value={scopedDays} />
      </div>

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">{chartTitle}</p>
        <ResponsiveContainer width="100%" height={280}>
          {period === "total" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF0FA" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#4C63AA" strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF0FA" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={period === "shift" ? 0 : undefined} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#4C63AA" radius={[3, 3, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
        {chartData?.length === 0 && (
          <p className="text-xs text-navy-400 mt-2">
            Aucune donnée à afficher — vérifie que production_journaliere est bien importée.
          </p>
        )}
      </div>

      {period === "shift" && (
        <p className="text-xs text-navy-400">
          Répartition de démonstration : le total toute période est simplement divisé par 3 — il
          n'y a pas encore d'horodatage réel par poste dans l'export production. À remplacer dès
          que cette donnée existe côté source.
        </p>
      )}
    </div>
  );
}
