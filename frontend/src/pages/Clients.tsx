import { AlertCircle, CheckCircle, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ClientData, PetData, api } from "../api/client";

export default function Clients() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ClientData | null>(null);

  useEffect(() => {
    api.getClients().then(setClients).finally(() => setLoading(false));
  }, []);

  function reload() {
    api.getClients().then(setClients);
  }

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.pets.some((p) => p.pet_name?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 safe-top pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-400 mt-0.5">{clients.length} total</p>
      </div>

      <div className="px-4 pt-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
            {filtered.map((c) => (
              <ClientRow key={c.id} client={c} onEdit={() => setEditing(c)} />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ClientDrawer
          client={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

const TEMP_EMOJI: Record<string, string> = { friendly: "🟢", anxious: "🟡", aggressive: "🔴" };

function ClientRow({ client: c, onEdit }: { client: ClientData; onEdit: () => void }) {
  const firstPet = c.pets[0] ?? null;
  const petLabel = firstPet?.pet_name
    ? c.pets.length > 1
      ? `${firstPet.pet_name} +${c.pets.length - 1} more`
      : firstPet.pet_name
    : null;
  const breedLabel = c.pets.length === 1 && firstPet?.breed ? ` · ${firstPet.breed}` : "";
  const worstExpiry = c.pets.map((p) => p.rabies_expiry).filter(Boolean).sort()[0] ?? null;
  const expiry = worstExpiry
    ? new Date(worstExpiry).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  const worstTemp = c.pets.some(p => p.temperament === "aggressive") ? "aggressive"
    : c.pets.some(p => p.temperament === "anxious") ? "anxious" : "friendly";

  return (
    <button
      onClick={onEdit}
      className="w-full bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3 shadow-sm text-left active:bg-gray-50"
    >
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
        {petLabel && (
          <p className="text-sm text-gray-500 truncate">
            {TEMP_EMOJI[worstTemp]} {petLabel}{breedLabel}
          </p>
        )}
        {c.address && <p className="text-xs text-gray-400 truncate">📍 {c.address}</p>}
        {expiry
          ? <p className="text-xs text-gray-400">Rabies exp: {expiry}</p>
          : <p className="text-xs text-red-400">No vaccine on file</p>}
      </div>
      <a
        href={`tel:${c.phone}`}
        onClick={(e) => e.stopPropagation()}
        className="p-2 text-gray-300 active:text-violet-500 shrink-0"
      >
        <Phone size={18} />
      </a>
    </button>
  );
}

function ClientDrawer({ client, onClose, onSaved }: {
  client: ClientData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [address, setAddress] = useState(client.address ?? "");
  const [pets, setPets] = useState<PetData[]>(client.pets);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await api.updateClient(client.id, { name, phone, address });
      for (const pet of pets) {
        await api.updatePetGroomer(pet.id, {
          pet_name: pet.pet_name ?? "",
          breed: pet.breed ?? "",
          age: pet.age ?? "",
          weight: pet.weight ?? "",
          notes: pet.notes ?? "",
          temperament: pet.temperament ?? "friendly",
          rabies_expiry: pet.rabies_expiry ?? "",
        });
      }
      onSaved();
    } catch {
      setError("Failed to save. Try again.");
      setSaving(false);
    }
  }

  function updatePet(id: string, field: keyof PetData, value: string) {
    setPets(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Edit Client</h2>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={22} /></button>
        </div>

        <div className="space-y-3 mb-5">
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)}
              className={inp} placeholder="Jane Smith" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className={inp} placeholder="+1555..." type="tel" />
          </Field>
          <Field label="Address (for route planning)">
            <input value={address} onChange={e => setAddress(e.target.value)}
              className={inp} placeholder="123 Main St, Austin TX" />
          </Field>
        </div>

        {pets.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pets</p>
            <div className="space-y-4">
              {pets.map(pet => (
                <div key={pet.id} className="bg-gray-50 rounded-2xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Pet name">
                      <input value={pet.pet_name ?? ""} onChange={e => updatePet(pet.id, "pet_name", e.target.value)}
                        className={inp} placeholder="Biscuit" />
                    </Field>
                    <Field label="Breed">
                      <input value={pet.breed ?? ""} onChange={e => updatePet(pet.id, "breed", e.target.value)}
                        className={inp} placeholder="Golden Retriever" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Age">
                      <input value={pet.age ?? ""} onChange={e => updatePet(pet.id, "age", e.target.value)}
                        className={inp} placeholder="3 years" />
                    </Field>
                    <Field label="Weight">
                      <input value={pet.weight ?? ""} onChange={e => updatePet(pet.id, "weight", e.target.value)}
                        className={inp} placeholder="45 lbs" />
                    </Field>
                  </div>
                  <Field label="Temperament">
                    <select value={pet.temperament ?? "friendly"}
                      onChange={e => updatePet(pet.id, "temperament", e.target.value)}
                      className={inp}>
                      <option value="friendly">🟢 Friendly</option>
                      <option value="anxious">🟡 Anxious — needs extra time</option>
                      <option value="aggressive">🔴 Aggressive — muzzle required</option>
                    </select>
                  </Field>
                  <Field label="Rabies expiry">
                    <input
                      type="date"
                      value={pet.rabies_expiry ?? ""}
                      onChange={e => updatePet(pet.id, "rabies_expiry", e.target.value)}
                      className={inp}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </>
  );
}

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
