import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

// "20231027" -> "2023-10-27"
function parseDateStamp(v) {
  const s = String(v);
  if (s.length < 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// "20231027142025043" -> ISO timestamp
function parseValidationTimestamp(v) {
  const s = String(v);
  if (s.length < 14) return null;
  const [y, mo, d, h, mi, se] = [
    s.slice(0, 4),
    s.slice(4, 6),
    s.slice(6, 8),
    s.slice(8, 10),
    s.slice(10, 12),
    s.slice(12, 14),
  ];
  return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
}

function excelDateToISO(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // valeur numérique de série Excel
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return v;
}

const IMPORT_TYPES = {
  evenements_qualite: {
    label: "Événements qualité (export MUL_COFTN)",
    table: "evenements_qualite",
    map: (row) => ({
      ligne: row.ID_Line,
      n_serie_bobine: row.serial_number,
      hu_erp: row.Hu_ERP,
      quantite_m: Number(row.Quantity) || null,
      type_cable: row.Item,
      date_production: parseDateStamp(row.date),
      date_validation: parseValidationTimestamp(row.Validation_date),
      code_defaut: row.Code_defaut,
      libelle_defaut: row.Desc_defaut,
    }),
  },
  production_journaliere: {
    label: "Production journalière (export Capacite_Production_TFE)",
    table: "production_journaliere",
    map: (row) => ({
      ligne: row.TFE,
      date: excelDateToISO(row.Date),
      quantite_produite_m: Number(row.Quantite_produite_m ?? row["Quantité produite (m)"]) || null,
    }),
  },
};

export default function ImportExcel() {
  const { profile } = useAuth();
  const [importType, setImportType] = useState("evenements_qualite");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [importing, setImporting] = useState(false);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { raw: true });
      setRows(json);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    setImporting(true);
    setStatus(null);
    const config = IMPORT_TYPES[importType];
    const mapped = rows.map(config.map).map((r) => ({ ...r, imported_by: profile?.id }));

    // insertion par lots de 500 pour rester raisonnable côté API
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < mapped.length; i += BATCH) {
      const batch = mapped.slice(i, i + BATCH);
      const { error } = await supabase.from(config.table).insert(batch);
      if (error) {
        setStatus({ type: "error", message: error.message });
        setImporting(false);
        return;
      }
      inserted += batch.length;
    }
    setStatus({ type: "success", message: `${inserted} lignes importées dans ${config.table}.` });
    setImporting(false);
    setRows([]);
  }

  const preview = rows.slice(0, 8);
  const columns = preview.length ? Object.keys(preview[0]) : [];

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Import Excel</h1>
        <p className="text-sm text-navy-500 mt-1">
          Utilise le gabarit fourni — les colonnes doivent correspondre exactement.
        </p>
      </div>

      <div className="bg-white rounded-card border border-navy-100 p-5 space-y-4">
        <div>
          <label className="block text-sm text-navy-700 mb-1">Type d'import</label>
          <select
            value={importType}
            onChange={(e) => {
              setImportType(e.target.value);
              setRows([]);
              setStatus(null);
            }}
            className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm"
          >
            {Object.entries(IMPORT_TYPES).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-navy-700 mb-1">Fichier .xlsx</label>
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="text-sm" />
        </div>

        {preview.length > 0 && (
          <div className="overflow-x-auto">
            <p className="text-xs text-navy-500 mb-2">
              Aperçu ({rows.length} lignes détectées, {preview.length} affichées)
            </p>
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="text-left border-b border-navy-100 py-1 pr-3 text-navy-500">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c} className="py-1 pr-3 text-navy-700 whitespace-nowrap">
                        {String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {status && (
          <p className={`text-sm ${status.type === "error" ? "text-alert-red" : "text-alert-green"}`}>
            {status.message}
          </p>
        )}

        <button
          onClick={handleImport}
          disabled={!rows.length || importing}
          className="bg-navy-500 hover:bg-navy-600 text-white font-medium rounded-md px-4 py-2 text-sm disabled:opacity-50"
        >
          {importing ? "Import en cours…" : `Importer ${rows.length || ""} ligne(s)`}
        </button>
      </div>
    </div>
  );
}
