import { AlertCircle, CheckCircle, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { ClientData, api } from "../api/client";

export default function Clients() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getClients().then(setClients).finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.pet_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-400 mt-0.5">{clients.length} total</p>
      </div>

      <div className="px-4 pt-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or pet…"
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 mb-4"
        />

        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-2">🐾</div>
            <p className="text-gray-400">No clients yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => <ClientRow key={c.id} client={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientRow({ client: c }: { client: ClientData }) {
  const expiry = c.rabies_expiry
    ? new Date(c.rabies_expiry).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm shrink-0">
        {c.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-gray-800 truncate">{c.name}</p>
          {c.vaccine_ok
            ? <CheckCircle size={13} className="text-green-500 shrink-0" />
            : <AlertCircle size={13} className="text-red-400 shrink-0" />}
        </div>
        {c.pet_name && (
          <p className="text-sm text-gray-500 truncate">
            🐾 {c.pet_name}{c.breed ? ` · ${c.breed}` : ""}
          </p>
        )}
        {expiry
          ? <p className="text-xs text-gray-400">Rabies exp: {expiry}</p>
          : <p className="text-xs text-red-400">No vaccine on file</p>}
      </div>

      <a href={`tel:${c.phone}`} className="p-2 text-gray-300 active:text-violet-500 shrink-0">
        <Phone size={18} />
      </a>
    </div>
  );
}
