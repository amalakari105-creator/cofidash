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

export default function DashboardProduction() {
  const [rows, setRows] = useState([]); // totaux journaliers réels (shift = null)
  const [shiftRows, setShiftRows] = useState([]); // répartition par shift (démo)
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("total");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("production_journaliere")
        .select("ligne, date, quantite_produite_m, shift, est_donnee_demo, referentiel_lignes!inner(en_perimetre)")
        .eq("referentiel_lignes.en_perimetre", true)
        .order("date", { ascending: true });

      setRows((data ?? []).filter((r) => !r.shift));
      setShiftRows((data ?? []).filter((r) => r.shift));
      setLoading(false);
    }
    load();
  }, []);

  const monthsAvailable = useMemo(() => {
    const months = new Set(rows.map((r) => r.date?.slice(0, 7)));
    return months.size;
  }, [rows]);

  const byDay = useMemo(() => {
    const totals = {};
    rows.forEach((r) => {
      totals[r.date] = (totals[r.date] || 0) + Number(r.quantite_produite_m || 0);
    });
    return Object.entries(totals)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, total]) => ({ date, total }));
  }, [rows]);

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

  const byShift = useMemo(() => {
    const totals = { [SHIFT_ORDER[0]]: 0, [SHIFT_ORDER[1]]: 0, [SHIFT_ORDER[2]]: 0 };
    shiftRows.forEach((r) => {
      if (totals[r.shift] == null) return;
      totals[r.shift] += Number(r.quantite_produite_m || 0);
    });
    return SHIFT_ORDER.map((label) => ({ date: label, total: totals[label] }));
  }, [shiftRows]);

  const hasShiftData = shiftRows.length > 0;
  const shiftIsDemo = shiftRows.some((r) => r.est_donnee_demo);

  // "Semaine" limite les KPIs à la semaine la plus récente ; "Total" garde tout l'historique ;
  // "Shift" n'a pas de fenêtre temporelle propre, il regroupe autrement.
  const scopedRows = useMemo(() => {
    if (period !== "semaine" || !rows.length) return rows;
    const lastWeek = isoWeekStart(rows[rows.length - 1].date);
    return rows.filter((r) => isoWeekStart(r.date) === lastWeek);
  }, [rows, period]);

  const scopedVolume =
    period === "shift"
      ? shiftRows.reduce((sum, r) => sum + Number(r.quantite_produite_m || 0), 0)
      : scopedRows.reduce((sum, r) => sum + Number(r.quantite_produite_m || 0), 0);
  const scopedDays = new Set(scopedRows.map((r) => r.date)).size;
  const avgPerDay = scopedDays ? Math.round(scopedVolume / scopedDays) : 0;

  const chartData = period === "semaine" ? byWeek : period === "shift" ? byShift : byDay;
  const chartTitle = {
    semaine: "Production par semaine (mètres)",
    shift: "Production par shift (mètres)",
    total: "Production journalière (mètres)",
  }[period];
  const windowLabel = { semaine: "semaine en cours", shift: "toute la période", total: "toute la période" }[period];

  if (loading) return <div className="p-8 text-navy-500">Chargement…</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Dashboard production — capacité</h1>
        <p className="text-sm text-navy-500 mt-1">{monthsAvailable} mois de données disponibles</p>
      </div>

      <FilterBar monthsAvailable={monthsAvailable} shiftAvailable={hasShiftData} onChange={setPeriod} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label={`Volume — ${windowLabel}`} value={scopedVolume.toLocaleString("fr-FR")} unit="m" />
        <KpiCard label="Moyenne / jour" value={avgPerDay.toLocaleString("fr-FR")} unit="m" />
        <KpiCard label="Jours de production" value={scopedDays} />
      </div>

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">{chartTitle}</p>
        <ResponsiveContainer width="100%" height={280}>
          {period === "semaine" || period === "shift" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF0FA" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#4C63AA" radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF0FA" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#4C63AA" strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {period === "shift" && shiftIsDemo && (
        <p className="text-xs text-navy-400">
          Données de démonstration : l'export production actuel ne contient pas d'horodatage réel par
          poste, cette répartition est une estimation (35% / 35% / 30%) des totaux journaliers. À
          remplacer dès qu'un vrai horodatage par shift est disponible côté source.
        </p>
      )}
      
    </div>
  );
}
