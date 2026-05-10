import { useCallback, useEffect, useState } from "react";
import { AppointmentData, RevenueData, api } from "../api/client";

export default function ReportsPage() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [history, setHistory] = useState<AppointmentData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [rev, hist] = await Promise.all([api.getRevenue(), api.getHistory(search)]);
    setRevenue(rev);
    setHistory(hist);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-400 mt-0.5">Revenue & appointment history</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Revenue summary */}
        {revenue && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <RevenueCard label="Today" period={revenue.today} />
              <RevenueCard label="This Week" period={revenue.week} />
              <RevenueCard label="This Month" period={revenue.month} />
            </div>

            {Object.keys(revenue.by_service).length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  This Month by Service
                </p>
                <div className="space-y-2">
                  {Object.entries(revenue.by_service)
                    .sort((a, b) => b[1].revenue - a[1].revenue)
                    .map(([svc, data]) => (
                      <div key={svc} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{svc}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{data.count}x</span>
                          <span className="text-sm font-semibold text-gray-800">${data.revenue}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* History */}
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 pt-2">
          Appointment History
        </p>

        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by client or pet…"
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />

        {loading ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : history.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-gray-400">No past appointments yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(a => <HistoryRow key={a.id} appt={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function RevenueCard({ label, period }: { label: string; period: { revenue: number; count: number } }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">${period.revenue}</p>
      <p className="text-xs text-gray-400">{period.count} appts</p>
    </div>
  );
}

function HistoryRow({ appt: a }: { appt: AppointmentData }) {
  const date = a.appointment_date
    ? new Date(a.appointment_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
  const time = a.appointment_date
    ? new Date(a.appointment_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";

  const statusColor: Record<string, string> = {
    completed: "text-green-600",
    canceled: "text-gray-400",
    in_progress: "text-blue-500",
  };

  return (
    <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm flex items-center gap-3">
      <div className="text-center min-w-[40px]">
        <p className="text-xs font-semibold text-gray-700">{date}</p>
        <p className="text-[11px] text-gray-400">{time}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{a.pet_name}</p>
        <p className="text-xs text-gray-400 truncate">{a.client_name} · {a.service_type}</p>
      </div>
      <div className="text-right shrink-0">
        {a.price != null && (
          <p className="text-sm font-semibold text-gray-800">${a.price}</p>
        )}
        <p className={`text-xs capitalize ${statusColor[a.status] ?? "text-gray-400"}`}>
          {a.status.replace("_", " ")}
        </p>
      </div>
    </div>
  );
}
