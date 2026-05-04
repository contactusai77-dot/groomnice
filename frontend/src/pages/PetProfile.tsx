import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ProfileData } from "../api/client";

type Status = "loading" | "ready" | "saving" | "done" | "error";

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50";

export default function PetProfile() {
  const { token } = useParams<{ token: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({
    pet_name: "",
    breed: "",
    age: "",
    weight: "",
    emergency_contact: "",
    notes: "",
  });
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api
      .getProfile(token)
      .then((data) => {
        setProfile(data);
        setForm({
          pet_name: data.pet_name ?? "",
          breed: data.breed ?? "",
          age: data.age ?? "",
          weight: data.weight ?? "",
          emergency_contact: data.emergency_contact ?? "",
          notes: data.notes ?? "",
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setStatus("saving");
    try {
      await api.saveProfile(token, form);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setStatus("ready");
    }
  }

  if (status === "loading") {
    return <Screen><p className="text-center text-gray-400 py-10">Loading…</p></Screen>;
  }

  if (status === "error") {
    return (
      <Screen>
        <p className="text-center text-red-500">This link is invalid or has expired.</p>
      </Screen>
    );
  }

  if (status === "done") {
    return (
      <Screen>
        <div className="text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Profile saved!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Thanks, {profile?.client_name}! {form.pet_name || "Your pet"} is all set.
          </p>
          <div className="bg-violet-50 rounded-2xl p-4 text-sm text-gray-600 mb-5">
            Next step: upload {form.pet_name || "your pet"}'s Rabies certificate so we have it
            on file.
          </div>
          <a
            href={`/vaccine/${token}`}
            className="block w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-center active:bg-violet-700 transition"
          >
            Upload Rabies Cert →
          </a>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="text-center mb-6">
        <div className="text-3xl mb-1">🐾</div>
        <h1 className="text-xl font-bold text-gray-800">Hi {profile?.client_name}!</h1>
        <p className="text-gray-400 text-sm">Tell us about your pet (2 min)</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Pet's Name" required>
          <input
            type="text"
            value={form.pet_name}
            onChange={(e) => setForm((f) => ({ ...f, pet_name: e.target.value }))}
            placeholder="Biscuit"
            required
            className={inputCls}
          />
        </Field>

        <Field label="Breed">
          <input
            type="text"
            value={form.breed}
            onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))}
            placeholder="Golden Retriever"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <input
              type="text"
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              placeholder="3 yrs"
              className={inputCls}
            />
          </Field>
          <Field label="Weight">
            <input
              type="text"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              placeholder="45 lbs"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Emergency Contact">
          <input
            type="tel"
            value={form.emergency_contact}
            onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))}
            placeholder="(555) 000-0001"
            inputMode="tel"
            className={inputCls}
          />
        </Field>

        <Field label="Notes for Groomer">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Nervous around nail trims, prefers soft brush…"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </Field>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-lg active:bg-violet-700 transition disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save Profile →"}
        </button>
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
