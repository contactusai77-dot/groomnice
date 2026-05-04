import { useState } from "react";
import { api } from "../api/client";

type Status = "idle" | "loading" | "sent";

export default function BookingForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stripeUrl, setStripeUrl] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await api.createBooking(phone, name);
      setStripeUrl(res.stripe_url);
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
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Almost there!</h2>
          <p className="text-gray-500 text-sm mb-6">
            We texted <strong>{phone}</strong> two things:
          </p>
          <ul className="text-left space-y-3 mb-8">
            <li className="flex items-start gap-3">
              <span className="text-lg">📋</span>
              <span className="text-gray-700 text-sm">
                A link to fill out your pet's profile
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg">💳</span>
              <span className="text-gray-700 text-sm">
                A $25 deposit link to lock in your spot
              </span>
            </li>
          </ul>
          <a
            href={stripeUrl}
            className="block w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-lg text-center active:bg-violet-700 transition"
          >
            Pay Deposit Now →
          </a>
          <p className="text-xs text-gray-400 mt-3">Spot held for 30 minutes</p>
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
