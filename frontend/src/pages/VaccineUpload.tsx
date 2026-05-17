import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, VaccineResult } from "../api/client";

type Status = "idle" | "uploading" | "done" | "review";

export default function VaccineUpload() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const petId = searchParams.get("pet_id") ?? undefined;

  const [petName, setPetName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<VaccineResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.getProfile(token).then(profile => {
      const pet = petId
        ? profile.pets.find(p => p.id === petId)
        : profile.pets[0];
      setPetName(pet?.pet_name ?? profile.client_name ?? null);
    }).catch(() => {});
  }, [token, petId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError("");
    setStatus("idle");
  }

  async function handleUpload() {
    if (!file || !token) return;
    setStatus("uploading");
    setError("");
    try {
      const res = await api.uploadVaccine(token, file, petId);
      setResult(res);
      setStatus(res.needs_review ? "review" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("idle");
    }
  }

  function retry() {
    setStatus("idle");
    setFile(null);
    setPreview(null);
    setResult(null);
  }

  if (status === "done") {
    return (
      <Screen>
        <div className="text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">All Set!</h2>
          <p className="text-gray-500 text-sm">
            Vaccine record received.{" "}
            {result?.rabies_expiry && <>Expiry on file: <strong>{formatDate(result.rabies_expiry)}</strong>.</>}
          </p>
          <p className="text-gray-400 text-sm mt-4">Your groomer will review it shortly. See you at your appointment!</p>
        </div>
      </Screen>
    );
  }

  if (status === "review") {
    return (
      <Screen>
        <div className="text-center">
          <div className="text-5xl mb-3">🔍</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Clearer Photo Needed</h2>
          <p className="text-gray-500 text-sm mb-6">
            Hard to read the expiry date. Please retake in good lighting with the date clearly visible.
          </p>
          <button
            onClick={retry}
            className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold active:bg-violet-700 transition"
          >
            Try Again
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Greeting */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🐾</div>
        <h1 className="text-2xl font-bold text-gray-800">
          {petName ? `${petName}'s Vaccine Record` : "Vaccine Record"}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Tap the button below to take a photo of your vet record
        </p>
      </div>

      {/* Camera / file picker */}
      <label className="block cursor-pointer">
        {preview ? (
          <div className="mb-4">
            <img
              src={preview}
              alt="Certificate preview"
              className="w-full rounded-2xl object-contain max-h-56 border border-gray-100"
            />
            <p className="text-xs text-gray-400 text-center mt-2 truncate">{file?.name}</p>
          </div>
        ) : (
          <div className="w-full bg-violet-600 text-white py-5 rounded-2xl font-semibold text-lg text-center active:bg-violet-700 transition mb-4 flex items-center justify-center gap-2">
            <span>📷</span> Take Photo of Vet Record
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

      {file && (
        <button
          onClick={handleUpload}
          disabled={status === "uploading"}
          className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-lg active:bg-violet-700 transition disabled:opacity-50"
        >
          {status === "uploading" ? "Reading record…" : "Submit →"}
        </button>
      )}

      {preview && (
        <button onClick={retry} className="w-full mt-2 py-3 text-sm text-gray-400 active:text-gray-600 transition">
          Retake photo
        </button>
      )}
    </Screen>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">{children}</div>
    </div>
  );
}
