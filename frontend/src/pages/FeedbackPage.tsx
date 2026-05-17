import { useState } from "react";
import { api } from "../api/client";

type FeedbackType = "bug" | "feature" | "general";

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("feature");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    try {
      await api.submitFeedback({ email, type, message });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <Screen>
        <div className="text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-500 text-sm">Your feedback helps make Groomnice better for every groomer.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="text-center mb-7">
        <div className="text-3xl mb-2">💬</div>
        <h1 className="text-2xl font-bold text-gray-900">Share Feedback</h1>
        <p className="text-gray-400 text-sm mt-1">What's broken? What would make this better?</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
        <div className="grid grid-cols-3 gap-2">
          {(["bug", "feature", "general"] as FeedbackType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-3 rounded-xl text-xs font-semibold border-2 transition ${type === t ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500"}`}
            >
              {t === "bug" ? "🐛 Bug" : t === "feature" ? "✨ Feature" : "💭 General"}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {type === "bug" ? "What's broken?" : type === "feature" ? "What would you love to see?" : "Your thoughts"}
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
            placeholder={type === "bug"
              ? "Describe what happened and what you expected…"
              : type === "feature"
              ? "Describe the feature and why it would help…"
              : "Anything on your mind…"}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email (optional — for follow-up)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        {status === "error" && <p className="text-red-500 text-sm text-center">Something went wrong. Try again.</p>}

        <button
          type="submit"
          disabled={status === "sending" || !message.trim()}
          className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold active:bg-violet-700 transition disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send Feedback →"}
        </button>
      </form>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">{children}</div>
    </div>
  );
}
