import { useState } from "react";
import { api } from "../api/client";

type Status = "idle" | "loading" | "sent";

export default function BookingForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      await api.createBooking(phone, name);
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <Screen>
        <div className="text-center">
          <div className="text-5xl mb-3">🐾</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">You're booked!</h2>
          <p className="text-gray-500 text-sm mb-6">
            We texted <strong>{phone}</strong> a link to complete your pet's profile.
          </p>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800 text-left">
            Note: cancellations under 24 hours incur a $25 fee.
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">✂️</div>
        <h1 className="text-2xl font-bold text-gray-800">Book in 3 Seconds</h1>
        <p className="text-gray-400 text-sm mt-1">Just your name and phone — that's it.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            required
            autoComplete="name"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Mobile Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            required
            autoComplete="tel"
            inputMode="tel"
            className={inputCls}
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-lg active:bg-violet-700 transition disabled:opacity-50 mt-2"
        >
          {status === "loading" ? "Booking…" : "Book Now →"}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-5">
        We'll text you a link to complete your pet's profile. No app needed.
      </p>
    </Screen>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50";

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">{children}</div>
    </div>
  );
}
