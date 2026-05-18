import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImportIssue, ImportResult, api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_PRICES: Record<string, number> = {
  "Full Groom": 75, "Bath & Cut": 60, "Bath": 45,
  "Nail Trim": 20, "Puppy Cut": 65, "De-shed": 70,
};
const FIELD_LABELS: Record<string, string> = {
  client_name: "Client Name", client_phone: "Phone",
  pet_name: "Pet Name", breed: "Breed",
  rabies_expiry: "Rabies Expiry", notes: "Notes",
};
const ALL_FIELDS = Object.keys(FIELD_LABELS);

type Step = 1 | 2 | 3 | 4 | 5;

interface ImportState {
  columns: string[];
  total_rows: number;
  all_rows: Record<string, string>[];
  sample_rows: Record<string, string>[];
  mapping: Record<string, string>;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { groomer } = useAuth();

  // Step 1
  const [isMobile, setIsMobile] = useState(false);

  // Step 2 — CSV import
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [importError, setImportError] = useState("");
  const [applying, setApplying] = useState(false);

  // Step 3
  const [workDays, setWorkDays] = useState([0, 1, 2, 3, 4]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotMinutes, setSlotMinutes] = useState(60);

  // Step 4
  const [prices, setPrices] = useState({ ...DEFAULT_PRICES });
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<Step>(1);

  function toggleDay(i: number) {
    setWorkDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort());
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const res = await api.importPreview(file);
      setImportState({
        columns: res.columns,
        total_rows: res.total_rows,
        all_rows: res.sample_rows, // for now preview; will re-upload on apply
        sample_rows: res.sample_rows,
        mapping: res.suggested_mapping,
      });
      // Store all rows via a hidden re-read — keep the File reference for apply
      (window as any).__importFile = file;
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not read file");
    } finally {
      setImporting(false);
    }
  }

  async function handleApply() {
    if (!importState) return;
    const phonesMapped = Object.values(importState.mapping).includes("client_phone");
    if (!phonesMapped) {
      setImportError("Please map a column to 'Phone' — it's required to identify each client.");
      return;
    }
    setApplying(true);
    setImportError("");
    try {
      const file = (window as any).__importFile as File | undefined;
      if (!file) throw new Error("File reference lost — please re-upload");
      const rows = await parseAllRows(file);
      const result = await api.importApply(rows, importState.mapping);
      setImportResult(result);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setApplying(false);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      await api.updateSettings({
        is_mobile: isMobile,
        working_hours: { days: workDays, start: startTime, end: endTime, slot_minutes: slotMinutes },
        service_prices: prices,
        onboarding_complete: true,
      });
      setStep(5);
    } finally {
      setSaving(false);
    }
  }

  const bookingUrl = groomer ? `${window.location.origin}/book/${groomer.slug}` : "";

  function shareBookingLink() {
    if (navigator.share) {
      navigator.share({ text: `Book your grooming appointment: ${bookingUrl}` }).catch(() => {});
    } else {
      navigator.clipboard.writeText(bookingUrl);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">

        {/* Progress dots */}
        {step < 5 && (
          <div className="flex gap-2 mb-6 justify-center">
            {([1, 2, 3, 4] as Step[]).map(s => (
              <div key={s} className={`h-2 rounded-full transition-all ${s === step ? "w-8 bg-violet-600" : s < step ? "w-2 bg-violet-300" : "w-2 bg-gray-200"}`} />
            ))}
          </div>
        )}

        {/* ── Step 1: Business type ── */}
        {step === 1 && (
          <>
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">✂️</div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome to Groomnice!</h1>
              <p className="text-gray-400 text-sm mt-2">Let's set up your dashboard. Takes 60 seconds.</p>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-3">What type of grooming do you do?</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <TypeCard emoji="🏠" title="Salon / Home" sub="Fixed location" active={!isMobile} onClick={() => setIsMobile(false)} />
              <TypeCard emoji="🚐" title="Mobile" sub="Travel to clients" active={isMobile} onClick={() => setIsMobile(true)} />
            </div>
            <button onClick={() => setStep(2)} className={btn("violet")}>Next →</button>
          </>
        )}

        {/* ── Step 2: CSV import ── */}
        {step === 2 && (
          <>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">📋</div>
              <h2 className="text-xl font-bold text-gray-900">Import Your Clients</h2>
              <p className="text-gray-400 text-sm mt-1">Export a CSV from your old software and drop it here</p>
            </div>

            {!importState && !importResult && (
              <>
                <label
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                  className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition mb-4 ${dragging ? "border-violet-400 bg-violet-50" : "border-gray-200 active:border-violet-300"}`}
                >
                  {importing ? (
                    <p className="text-gray-400 text-sm">Reading file…</p>
                  ) : (
                    <>
                      <div className="text-3xl mb-2">📂</div>
                      <p className="text-sm font-medium text-gray-600">Drop CSV here or tap to upload</p>
                      <p className="text-xs text-gray-400 mt-1">Works with MoeGo, DaySmart, Groomsoft, Square exports</p>
                    </>
                  )}
                  <input type="file" accept=".csv" onChange={e => handleFile(e.target.files?.[0])} className="hidden" />
                </label>
                {importError && <p className="text-red-500 text-sm text-center mb-3">{importError}</p>}
                <button onClick={() => setStep(3)} className="w-full py-3 text-sm text-gray-400 active:text-gray-600 transition">
                  Skip — I'll add clients manually →
                </button>
              </>
            )}

            {importState && !importResult && (
              <>
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4 text-sm">
                  <span className="font-semibold text-green-700">{importState.total_rows} clients</span>
                  <span className="text-green-600"> found — map your columns below</span>
                </div>

                {/* Column mapping */}
                <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                  {importState.columns.map(col => (
                    <div key={col} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 truncate w-28 shrink-0" title={col}>{col}</span>
                      <span className="text-gray-300 text-xs">→</span>
                      <select
                        value={importState.mapping[col] ?? ""}
                        onChange={e => setImportState(s => s && ({
                          ...s,
                          mapping: { ...s.mapping, [col]: e.target.value || undefined as any },
                        }))}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      >
                        <option value="">— skip —</option>
                        {ALL_FIELDS.map(f => (
                          <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Sample preview */}
                {importState.sample_rows.length > 0 && (
                  <div className="mb-4 overflow-x-auto rounded-xl border border-gray-100">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {importState.columns.slice(0, 4).map(c => (
                            <th key={c} className="px-2 py-1.5 text-left text-gray-400 font-medium truncate max-w-[80px]">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importState.sample_rows.map((row, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            {importState.columns.slice(0, 4).map(c => (
                              <td key={c} className="px-2 py-1.5 text-gray-600 truncate max-w-[80px]">{row[c]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {importError && <p className="text-red-500 text-sm mb-3">{importError}</p>}

                <button onClick={handleApply} disabled={applying} className={btn("violet")}>
                  {applying ? "Importing…" : `Import ${importState.total_rows} Clients →`}
                </button>
                <button onClick={() => { setImportState(null); setImportError(""); }}
                  className="w-full mt-2 py-2 text-xs text-gray-400 active:text-gray-600">
                  ← Choose a different file
                </button>
              </>
            )}

            {importResult && (
              <>
                <div className="text-center py-3">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-bold text-gray-800 text-lg">{importResult.imported} clients imported</p>
                  <div className="flex justify-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    {importResult.skipped > 0 && <span className="text-red-400">{importResult.skipped} skipped</span>}
                    {importResult.issues.length > 0 && (
                      <span className="text-amber-500">{importResult.issues.length} issues</span>
                    )}
                  </div>
                </div>

                {importResult.issues.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowIssues(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs font-semibold text-amber-700"
                    >
                      <span>⚠️ View {importResult.issues.length} issues</span>
                      <span>{showIssues ? "▲" : "▼"}</span>
                    </button>
                    {showIssues && (
                      <IssuesPanel issues={importResult.issues} />
                    )}
                  </div>
                )}

                <button onClick={() => setStep(3)} className={btn("violet")}>Next →</button>
              </>
            )}

            {!importState && !importResult && (
              <div className="mt-3">
                <button onClick={() => setStep(1)} className="text-xs text-gray-400 active:text-gray-600">← Back</button>
              </div>
            )}
          </>
        )}

        {/* ── Step 3: Working hours ── */}
        {step === 3 && (
          <>
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🗓️</div>
              <h2 className="text-xl font-bold text-gray-900">Working Hours</h2>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Working days</p>
            <div className="flex gap-1.5 mb-5 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${workDays.includes(i) ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {d}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Start</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">End</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inp} />
              </div>
            </div>
            <div className="mb-6">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Slot length</label>
              <select value={slotMinutes} onChange={e => setSlotMinutes(Number(e.target.value))} className={inp}>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>90 minutes</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className={btn("back")}>← Back</button>
              <button onClick={() => setStep(4)} className={btn("violet")}>Next →</button>
            </div>
          </>
        )}

        {/* ── Step 4: Service prices ── */}
        {step === 4 && (
          <>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">💰</div>
              <h2 className="text-xl font-bold text-gray-900">Service Prices</h2>
              <p className="text-gray-400 text-sm mt-1">Edit to match your rates</p>
            </div>
            <div className="space-y-2 mb-6">
              {Object.entries(prices).map(([svc, price]) => (
                <div key={svc} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700 truncate">{svc}</span>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <span className="px-2 text-gray-400 text-sm bg-gray-50 py-2">$</span>
                    <input type="number" value={price}
                      onChange={e => setPrices(p => ({ ...p, [svc]: Number(e.target.value) }))}
                      className="w-16 py-2 px-2 text-sm focus:outline-none" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className={btn("back")}>← Back</button>
              <button onClick={finish} disabled={saving} className={`flex-1 ${btn("violet")} disabled:opacity-50`}>
                {saving ? "Saving…" : "Finish Setup →"}
              </button>
            </div>
          </>
        )}

        {/* ── Step 5: Launch pad ── */}
        {step === 5 && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🚀</div>
              <h2 className="text-2xl font-bold text-gray-900">You're live!</h2>
              <p className="text-gray-400 text-sm mt-1">Share your booking link with clients</p>
            </div>

            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 mb-5">
              <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">Your booking link</p>
              <p className="text-sm text-violet-800 font-mono break-all">{bookingUrl}</p>
              <button onClick={shareBookingLink}
                className="mt-3 w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold active:bg-violet-700 transition">
                Share Link 📤
              </button>
            </div>

            <div className="space-y-2 mb-6">
              <CheckItem label="Business type configured" />
              <CheckItem label={importResult ? `${importResult.imported} clients imported` : "Clients (add in dashboard)"} done={!!importResult} />
              <CheckItem label="Working hours set" />
              <CheckItem label="Service prices set" />
            </div>

            <button onClick={() => navigate("/")} className={btn("violet")}>
              Go to Dashboard →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

async function parseAllRows(file: File): Promise<Record<string, string>[]> {
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(vals =>
    Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]))
  );
}

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuote) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cell += ch; }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      row.push(cell.trim()); cell = "";
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some(c => c !== "")) result.push(row);
      row = []; cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some(c => c !== "")) result.push(row);
  return result;
}

const ISSUE_META: Record<string, { label: string; color: string }> = {
  no_phone:        { label: "Empty phone — skipped",      color: "text-red-600" },
  bad_phone:       { label: "Unreadable phone — skipped", color: "text-red-600" },
  missing_name:    { label: "Missing name — saved as Unknown", color: "text-amber-600" },
  bad_date:        { label: "Unreadable date — expiry cleared", color: "text-amber-600" },
  duplicate_phone: { label: "Duplicate phone",            color: "text-amber-600" },
};

function IssuesPanel({ issues }: { issues: ImportIssue[] }) {
  const grouped = issues.reduce<Record<string, ImportIssue[]>>((acc, issue) => {
    (acc[issue.type] ??= []).push(issue);
    return acc;
  }, {});

  return (
    <div className="mt-2 border border-amber-100 rounded-xl overflow-hidden">
      {Object.entries(grouped).map(([type, items]) => {
        const meta = ISSUE_META[type] ?? { label: type, color: "text-gray-600" };
        return (
          <div key={type} className="border-b border-amber-50 last:border-0">
            <p className={`px-3 py-1.5 text-xs font-semibold bg-amber-50 ${meta.color}`}>
              {meta.label} ({items.length})
            </p>
            <ul className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
              {items.slice(0, 20).map((issue, i) => (
                <li key={i} className="px-3 py-2">
                  <span className="text-xs text-gray-400 mr-2">Row {issue.row}</span>
                  {issue.value && (
                    <span className="text-xs font-mono bg-gray-100 rounded px-1 mr-2">{issue.value}</span>
                  )}
                  <span className="text-xs text-gray-500">{issue.detail}</span>
                </li>
              ))}
              {items.length > 20 && (
                <li className="px-3 py-2 text-xs text-gray-400">…and {items.length - 20} more</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function TypeCard({ emoji, title, sub, active, onClick }: {
  emoji: string; title: string; sub: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`py-5 rounded-2xl border-2 text-center transition ${active ? "border-violet-500 bg-violet-50" : "border-gray-200"}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </button>
  );
}

function CheckItem({ label, done = true }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={done ? "text-green-500" : "text-gray-300"}>✓</span>
      <span className={done ? "text-gray-700" : "text-gray-400"}>{label}</span>
    </div>
  );
}

const btn = (color: "violet" | "back") =>
  color === "violet"
    ? "w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold active:bg-violet-700 transition text-sm"
    : "flex-1 py-4 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-sm";

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";
