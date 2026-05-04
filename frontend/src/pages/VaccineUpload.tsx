import { useState } from "react";
import { useParams } from "react-router-dom";
import { api, VaccineResult } from "../api/client";

type Status = "idle" | "uploading" | "done" | "review";

export default function VaccineUpload() {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<VaccineResult | null>(null);
  const [error, setError] = useState("");

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
      const res = await api.uploadVaccine(token, file);
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
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Certificate Saved!</h2>
          <p className="text-gray-500 text-sm">
            Rabies expiry on file:{" "}
            <strong>
              {result?.rabies_expiry ? formatDate(result.rabies_expiry) : "recorded"}
            </strong>
          </p>
          <p className="text-gray-400 text-sm mt-4">You're all set. See you at your appointment! 🐾</p>
        </div>
      </Screen>
    );
  }

  if (status === "review") {
    return (
      <Screen>
        <div className="text-center">
          <div className="text-5xl mb-3">🔍</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">We Need a Clearer Photo</h2>
          <p className="text-gray-500 text-sm mb-6">
            The image was hard to read. Please retake it in good lighting with the expiration
            date clearly visible.
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
      <div className="text-center mb-6">
        <div className="text-3xl mb-1">💉</div>
        <h1 className="text-xl font-bold text-gray-800">Upload Rabies Certificate</h1>
        <p className="text-gray-400 text-sm">We'll read the expiry date automatically</p>
      </div>

      <div className="space-y-4">
        <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center cursor-pointer active:border-violet-400 transition">
          {preview ? (
            <img
              src={preview}
              alt="Certificate preview"
              className="max-h-44 mx-auto rounded-xl object-contain"
            />
          ) : (
            <div>
              <div className="text-4xl mb-2">📸</div>
              <p className="text-gray-500 text-sm font-medium">
                Tap to take a photo or choose from library
              </p>
              <p className="text-gray-400 text-xs mt-1">JPG, PNG, HEIC supported</p>
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

        {file && <p className="text-xs text-gray-400 text-center truncate">{file.name}</p>}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          onClick={handleUpload}
          disabled={!file || status === "uploading"}
          className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-lg active:bg-violet-700 transition disabled:opacity-50"
        >
          {status === "uploading" ? "Reading certificate…" : "Upload & Auto-Fill →"}
        </button>
      </div>
    </Screen>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">{children}</div>
    </div>
  );
}
