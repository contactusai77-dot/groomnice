import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PetData, PetFormData, api } from "../api/client";

type Phase = "loading" | "list" | "editing" | "adding" | "done" | "error";

const EMPTY_FORM: PetFormData = {
  pet_name: "", breed: "", age: "", weight: "", emergency_contact: "", notes: "",
};

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50";

export default function PetProfile() {
  const { token } = useParams<{ token: string }>();
  const [clientName, setClientName] = useState("");
  const [pets, setPets] = useState<PetData[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [editingPet, setEditingPet] = useState<PetData | null>(null);
  const [form, setForm] = useState<PetFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSavedName, setLastSavedName] = useState("");

  useEffect(() => {
    if (!token) return;
    api
      .getProfile(token)
      .then((data) => {
        setClientName(data.client_name);
        setPets(data.pets);
        if (data.pets.length === 0) {
          setPhase("adding");
          setForm(EMPTY_FORM);
        } else {
          setPhase("list");
        }
      })
      .catch(() => setPhase("error"));
  }, [token]);

  function startEdit(pet: PetData) {
    setEditingPet(pet);
    setForm({
      pet_name: pet.pet_name ?? "",
      breed: pet.breed ?? "",
      age: pet.age ?? "",
      weight: pet.weight ?? "",
      emergency_contact: pet.emergency_contact ?? "",
      notes: pet.notes ?? "",
    });
    setError("");
    setPhase("editing");
  }

  function startAdd() {
    setEditingPet(null);
    setForm(EMPTY_FORM);
    setError("");
    setPhase("adding");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      if (phase === "editing" && editingPet) {
        await api.updatePet(token, editingPet.id, form);
        setPets((prev) =>
          prev.map((p) => (p.id === editingPet.id ? { ...p, ...form, profile_complete: true } : p))
        );
      } else {
        if (pets.length === 0) {
          await api.saveProfile(token, form);
        } else {
          await api.addPet(token, form);
        }
        setLastSavedName(form.pet_name || "Your pet");
        setPhase("done");
        return;
      }
      setPhase("list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (phase === "loading") {
    return <Screen><p className="text-center text-gray-400 py-10">Loading…</p></Screen>;
  }

  if (phase === "error") {
    return (
      <Screen>
        <p className="text-center text-red-500">This link is invalid or has expired.</p>
      </Screen>
    );
  }

  if (phase === "done") {
    return (
      <Screen>
        <div className="text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Profile saved!</h2>
          <p className="text-gray-500 text-sm mb-6">
            {lastSavedName} is all set.
          </p>
          <div className="bg-violet-50 rounded-2xl p-4 text-sm text-gray-600 mb-5">
            Next step: upload {lastSavedName}'s Rabies certificate so we have it on file.
          </div>
          <a
            href={`/vaccine/${token}`}
            className="block w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-center active:bg-violet-700 transition mb-3"
          >
            Upload Rabies Cert →
          </a>
          <button
            onClick={startAdd}
            className="w-full border border-violet-300 text-violet-600 py-3 rounded-2xl font-medium text-sm active:bg-violet-50"
          >
            + Add another pet
          </button>
        </div>
      </Screen>
    );
  }

  if (phase === "list") {
    return (
      <Screen>
        <div className="text-center mb-5">
          <div className="text-3xl mb-1">🐾</div>
          <h1 className="text-xl font-bold text-gray-800">Hi {clientName}!</h1>
          <p className="text-gray-400 text-sm">Your pets on file</p>
        </div>
        <div className="space-y-3 mb-5">
          {pets.map((pet) => (
            <div
              key={pet.id}
              className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100"
            >
              <div>
                <p className="font-semibold text-gray-800">{pet.pet_name || "Unnamed pet"}</p>
                {pet.breed && <p className="text-sm text-gray-400">{pet.breed}</p>}
              </div>
              <button
                onClick={() => startEdit(pet)}
                className="text-violet-600 text-sm font-medium px-3 py-1.5 rounded-xl active:bg-violet-50"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={startAdd}
          className="w-full border border-violet-300 text-violet-600 py-3 rounded-2xl font-medium active:bg-violet-50"
        >
          + Add another pet
        </button>
      </Screen>
    );
  }

  // "editing" or "adding"
  const isAdding = phase === "adding";
  return (
    <Screen>
      <div className="text-center mb-6">
        <div className="text-3xl mb-1">🐾</div>
        <h1 className="text-xl font-bold text-gray-800">
          {isAdding ? (pets.length === 0 ? `Hi ${clientName}!` : "Add a pet") : "Edit pet"}
        </h1>
        <p className="text-gray-400 text-sm">
          {isAdding && pets.length === 0 ? "Tell us about your pet (2 min)" : ""}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Pet's Name" required>
          <input
            type="text"
            value={form.pet_name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, pet_name: e.target.value }))}
            placeholder="Biscuit"
            required
            className={inputCls}
          />
        </Field>

        <Field label="Breed">
          <input
            type="text"
            value={form.breed ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))}
            placeholder="Golden Retriever"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <input
              type="text"
              value={form.age ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              placeholder="3 yrs"
              className={inputCls}
            />
          </Field>
          <Field label="Weight">
            <input
              type="text"
              value={form.weight ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              placeholder="45 lbs"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Emergency Contact">
          <input
            type="tel"
            value={form.emergency_contact ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))}
            placeholder="(555) 000-0001"
            inputMode="tel"
            className={inputCls}
          />
        </Field>

        <Field label="Notes for Groomer">
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Nervous around nail trims, prefers soft brush…"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </Field>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-lg active:bg-violet-700 transition disabled:opacity-50"
        >
          {saving ? "Saving…" : isAdding ? "Save Pet →" : "Update Pet →"}
        </button>

        {phase === "editing" && (
          <button
            type="button"
            onClick={() => setPhase("list")}
            className="w-full text-gray-400 py-2 text-sm"
          >
            Cancel
          </button>
        )}
      </form>
    </Screen>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-center min-h-screen p-5 pt-10">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">{children}</div>
    </div>
  );
}
