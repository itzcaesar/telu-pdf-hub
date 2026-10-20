import { ChevronsUpDown, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { openPdf } from "./pdf.js";
import { Group } from "./ui.jsx";

// Reads the PDF's form fields with pdf.js and renders one input per field.
// Output: {field name: value}; checkboxes are true/false, radio groups the chosen export value.
export default function FormFill({ file, onChange }) {
  const [fields, setFields] = useState(null);
  const [values, setValues] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFields(null);
    setFailed(false);
    openPdf(file)
      .then((doc) => doc.getFieldObjects())
      .then((objs) => {
        if (cancelled) return;
        const list = Object.entries(objs || {})
          .map(([name, widgets]) => ({ name, ...describe(widgets) }))
          .filter((f) => f.type);
        setFields(list);
        setValues(Object.fromEntries(list.map((f) => [f.name, f.value])));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    onChange(fields?.length ? JSON.stringify(values) : "", fields?.length || 0);
  }, [values, fields]);

  const set = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  if (failed) return <Group header="Isian formulir" footer="PDF tidak dapat dibaca. Pastikan tidak rusak atau terkunci."><div className="skeleton" /></Group>;
  if (!fields) return <Group header="Isian formulir"><div className="row"><LoaderCircle className="spin" size={20} aria-hidden="true" />Membaca formulir…</div></Group>;
  if (!fields.length) return <Group header="Isian formulir" footer="PDF ini tidak memiliki kolom formulir yang dapat diisi."><div className="row">Tidak ada kolom.</div></Group>;

  return (
    <Group header={`Isian formulir (${fields.length})`} id="form-h" footer="Kolom yang dibiarkan tetap seperti semula.">
      {fields.map((f, i) => {
        const id = `ff-${i}`;
        const label = <label htmlFor={id}>{f.label}</label>;
        if (f.type === "checkbox") {
          return (
            <div className="field row-wrap" key={f.name}>
              {label}
              <input id={id} type="checkbox" className="switch" checked={!!values[f.name]}
                     onChange={(e) => set(f.name, e.target.checked)} />
            </div>
          );
        }
        if (f.type === "choice") {
          return (
            <div className="field row-wrap" key={f.name}>
              {label}
              <span className="menu">
                <span>{f.options.find((o) => o.value === values[f.name])?.label || "Pilih"}</span>
                <ChevronsUpDown size={16} aria-hidden="true" />
                <select id={id} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </span>
            </div>
          );
        }
        return (
          <div className="field row-wrap" key={f.name}>
            {label}
            <input id={id} type="text" value={values[f.name]} placeholder="Isi di sini" maxLength={f.maxLen || undefined}
                   onChange={(e) => set(f.name, e.target.value)} />
          </div>
        );
      })}
    </Group>
  );
}

// pdf.js returns one entry per widget; radio groups have several widgets sharing a name.
function describe(widgets) {
  const w = widgets[0];
  const label = w.name.split(".").pop().replace(/[_-]+/g, " ");
  if (w.readOnly) return {};
  switch (w.type) {
    case "text":
      return { type: "text", label, value: w.value ?? "", maxLen: w.charLimit };
    case "checkbox":
      return { type: "checkbox", label, value: !!w.value && w.value !== "Off" };
    case "radiobutton": {
      const options = widgets.map((x) => x.buttonValue).filter(Boolean).map((v) => ({ value: v, label: v }));
      return { type: "choice", label, options, value: widgets.find((x) => x.value && x.value !== "Off")?.value ?? "" };
    }
    case "combobox":
    case "listbox": {
      const options = (w.items || []).map((it) => ({ value: it.exportValue, label: it.displayValue }));
      return { type: "choice", label, options, value: Array.isArray(w.value) ? w.value[0] ?? "" : w.value ?? "" };
    }
    default:
      return {};
  }
}
