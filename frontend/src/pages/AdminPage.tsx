import { useEffect, useState } from "react";

const API = "/api/admin";

// ── Test result types ─────────────────────────────────────────────────────────

interface TestSuite {
  name: string;
  passed: number;
  failed: number;
  failures: string[];
  exit_code: number;
  duration_seconds: number;
  output_tail?: string;
}

interface TestResults {
  run_at: string;
  duration_seconds: number;
  total_passed: number;
  total_failed: number;
  e2e_included: boolean;
  suites: TestSuite[];
}

interface Overview {
  total_groomers: number;
  total_clients: number;
  total_bookings: number;
  total_revenue: number;
  newest_groomer: { name: string; email: string; created_at: string } | null;
}

interface GroomerRow {
  id: string;
  name: string;
  email: string;
  slug: string;
  google_linked: boolean;
  created_at: string;
  client_count: number;
  booking_count: number;
  total_revenue: number;
  last_booking_at: string | null;
}

interface ClientRow {
  id: string;
  name: string;
  phone: string;
  pet_count: number;
  booking_count: number;
  last_visit: string | null;
}

interface GroomerDetail {
  id: string;
  name: string;
  email: string;
  slug: string;
  google_linked: boolean;
  created_at: string;
  total_revenue: number;
  clients: ClientRow[];
  recent_bookings: { id: string; appointment_date: string | null; service_type: string; status: string; price: number | null; client_name: string; pet_name: string }[];
}

function useAdminKey() {
  const [key, setKey] = useState(() => localStorage.getItem("admin_key") ?? "");
  function save(k: string) {
    localStorage.setItem("admin_key", k);
    setKey(k);
  }
  return { key, save };
}

async function adminFetch<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { "X-Admin-Key": key } });
  if (res.status === 403) throw new Error("Wrong admin key");
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

function fmt$(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Key gate ──────────────────────────────────────────────────────────────────

function KeyGate({ onKey }: { onKey: (k: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <div className="text-3xl mb-4 text-center">🔐</div>
        <h1 className="text-white text-xl font-bold text-center mb-6">Groomnice Admin</h1>
        <form onSubmit={e => { e.preventDefault(); if (input.trim()) onKey(input.trim()); else setError("Enter the admin key"); }}>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Admin key"
            autoFocus
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 text-base border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button className="w-full bg-violet-600 text-white py-3 rounded-xl font-semibold hover:bg-violet-700 transition">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const { key, save } = useAdminKey();
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "tests">("overview");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [groomers, setGroomers] = useState<GroomerRow[]>([]);
  const [selected, setSelected] = useState<GroomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Tests tab state
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState("");
  const [expandedSuite, setExpandedSuite] = useState<string | null>(null);

  async function tryKey(k: string) {
    try {
      const ov = await adminFetch<Overview>("/overview", k);
      save(k);
      setOverview(ov);
      setAuthed(true);
      setError("");
      loadGroomers(k);
    } catch {
      setError("Wrong admin key");
    }
  }

  async function loadGroomers(k: string) {
    const rows = await adminFetch<GroomerRow[]>("/groomers", k);
    setGroomers(rows);
  }

  useEffect(() => {
    if (key) tryKey(key);
  }, []);

  async function selectGroomer(id: string) {
    setLoadingDetail(true);
    try {
      const detail = await adminFetch<GroomerDetail>(`/groomers/${id}`, key);
      setSelected(detail);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadTestResults() {
    setTestError("");
    try {
      const r = await adminFetch<TestResults>("/test-results", key);
      setTestResults(r);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("404")) setTestError("No results yet — click Run Tests to generate them.");
      else setTestError(msg);
    }
  }

  async function runTests() {
    setTestLoading(true);
    setTestError("");
    try {
      const r = await adminFetch<TestResults>("/run-tests", key);
      setTestResults(r);
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : "Test run failed");
    } finally {
      setTestLoading(false);
    }
  }

  useEffect(() => {
    if (authed && tab === "tests" && !testResults) loadTestResults();
  }, [authed, tab]);

  if (!authed) return <KeyGate onKey={tryKey} />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Groomnice Admin</h1>
          </div>
          <button onClick={() => { localStorage.removeItem("admin_key"); setAuthed(false); }}
            className="text-xs text-gray-500 hover:text-gray-300 transition">Sign out</button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-8 bg-gray-900 rounded-xl p-1 w-fit">
          {(["overview", "tests"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition capitalize ${
                tab === t ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
              }`}>
              {t === "tests" ? "Test Suite" : "Overview"}
            </button>
          ))}
        </div>

        {/* ── Tests tab ── */}
        {tab === "tests" && (
          <TestsTab
            results={testResults}
            loading={testLoading}
            error={testError}
            expanded={expandedSuite}
            onExpand={setExpandedSuite}
            onRun={runTests}
            onRefresh={loadTestResults}
          />
        )}

        {/* Overview cards */}
        {tab === "overview" && (<>
        {overview && (
          <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
            <Card label="Groomers" value={overview.total_groomers} />
            <Card label="Clients" value={overview.total_clients} />
            <Card label="Bookings" value={overview.total_bookings} />
            <Card label="Revenue" value={fmt$(overview.total_revenue)} accent />
          </div>
        )}

        <div className="flex gap-6 items-start">

          {/* Groomer list */}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Groomers</h2>
            <div className="space-y-2">
              {groomers.length === 0 && (
                <p className="text-gray-500 text-sm">No groomers yet.</p>
              )}
              {groomers.map(g => (
                <button key={g.id} onClick={() => selectGroomer(g.id)}
                  className={`w-full text-left bg-gray-800 hover:bg-gray-750 rounded-xl p-4 transition border ${selected?.id === g.id ? "border-violet-500" : "border-transparent"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{g.name}</p>
                      <p className="text-gray-400 text-xs truncate">{g.email}</p>
                      <p className="text-gray-500 text-xs mt-0.5">/book/{g.slug} {g.google_linked && "· G"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-violet-400 font-semibold text-sm">{fmt$(g.total_revenue)}</p>
                      <p className="text-gray-400 text-xs">{g.client_count} clients</p>
                      <p className="text-gray-500 text-xs">{g.booking_count} bookings</p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs mt-2">
                    Joined {fmtDate(g.created_at)}
                    {g.last_booking_at && ` · Last booking ${fmtDate(g.last_booking_at)}`}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Groomer detail panel */}
          {(selected || loadingDetail) && (
            <div className="w-80 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Detail</h2>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕ Close</button>
              </div>

              {loadingDetail ? (
                <div className="bg-gray-800 rounded-xl p-6 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : selected ? (
                <div className="bg-gray-800 rounded-xl p-4 space-y-4">
                  <div>
                    <p className="font-semibold text-white">{selected.name}</p>
                    <p className="text-gray-400 text-xs">{selected.email}</p>
                    <p className="text-violet-400 text-sm font-semibold mt-1">{fmt$(selected.total_revenue)} lifetime</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Clients ({selected.clients.length})</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selected.clients.map(c => (
                        <div key={c.id} className="bg-gray-700 rounded-lg px-3 py-2">
                          <p className="text-sm font-medium text-white">{c.name}</p>
                          <p className="text-gray-400 text-xs">{c.phone} · {c.pet_count} pet{c.pet_count !== 1 ? "s" : ""} · {c.booking_count} bookings</p>
                          {c.last_visit && <p className="text-gray-500 text-xs">Last: {fmtDate(c.last_visit)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Bookings</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selected.recent_bookings.map(b => (
                        <div key={b.id} className="bg-gray-700 rounded-lg px-3 py-2">
                          <p className="text-sm text-white">{b.client_name} · {b.service_type}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-md ${statusColor(b.status)}`}>{b.status}</span>
                            <span className="text-xs text-gray-400">{b.price != null ? fmt$(b.price) : "—"}</span>
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">{fmtDate(b.appointment_date)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}

// ── Tests tab component ───────────────────────────────────────────────────────

function TestsTab({
  results, loading, error, expanded, onExpand, onRun, onRefresh,
}: {
  results: TestResults | null;
  loading: boolean;
  error: string;
  expanded: string | null;
  onExpand: (n: string | null) => void;
  onRun: () => void;
  onRefresh: () => void;
}) {
  const totalTests = results ? results.total_passed + results.total_failed : 0;
  const pct = totalTests > 0 ? Math.round((results!.total_passed / totalTests) * 100) : 0;

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onRun}
          disabled={loading}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
          ) : "▶"}
          {loading ? "Running…" : "Run Tests"}
        </button>
        <button onClick={onRefresh} className="text-sm text-gray-400 hover:text-gray-200 transition">
          Refresh
        </button>
        {results && (
          <span className="text-xs text-gray-500 ml-auto">
            Last run: {new Date(results.run_at).toLocaleString()}
            {" · "}{results.duration_seconds}s
            {results.e2e_included ? "" : " (no e2e)"}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {loading && !results && (
        <div className="text-gray-400 text-sm">Running tests — this may take up to a minute…</div>
      )}

      {results && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className={`rounded-xl p-4 ${results.total_failed === 0 ? "bg-green-900/40 border border-green-700" : "bg-red-900/30 border border-red-800"}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pass rate</p>
              <p className={`text-3xl font-bold ${results.total_failed === 0 ? "text-green-400" : "text-red-400"}`}>{pct}%</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Passed</p>
              <p className="text-3xl font-bold text-green-400">{results.total_passed}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Failed</p>
              <p className={`text-3xl font-bold ${results.total_failed > 0 ? "text-red-400" : "text-gray-500"}`}>
                {results.total_failed}
              </p>
            </div>
          </div>

          {/* Per-suite rows */}
          <div className="space-y-2">
            {results.suites.map(suite => (
              <div key={suite.name} className="bg-gray-800 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-750 transition"
                  onClick={() => onExpand(expanded === suite.name ? null : suite.name)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      suite.failed === 0 ? "bg-green-400" : "bg-red-400"
                    }`} />
                    <span className="text-sm font-medium text-white truncate">{suite.name}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    <span className="text-green-400">{suite.passed} passed</span>
                    {suite.failed > 0 && (
                      <span className="text-red-400">{suite.failed} failed</span>
                    )}
                    <span className="text-gray-500">{suite.duration_seconds}s</span>
                    <span className="text-gray-500">{expanded === suite.name ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded === suite.name && (
                  <div className="border-t border-gray-700 px-4 py-3 space-y-3">
                    {suite.failures.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 uppercase mb-2">Failures</p>
                        <div className="space-y-1">
                          {suite.failures.map((f, i) => (
                            <p key={i} className="text-xs text-red-300 font-mono bg-red-900/20 rounded px-2 py-1 break-all">
                              {f}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {suite.output_tail && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Output</p>
                        <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {suite.output_tail}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? "text-violet-400" : "text-white"}`}>{value}</p>
    </div>
  );
}

function statusColor(s: string) {
  if (s === "completed") return "bg-green-900 text-green-300";
  if (s === "confirmed") return "bg-blue-900 text-blue-300";
  if (s === "in_progress") return "bg-yellow-900 text-yellow-300";
  if (s === "cancelled") return "bg-red-900 text-red-300";
  return "bg-gray-700 text-gray-400";
}
