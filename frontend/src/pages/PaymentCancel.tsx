export default function PaymentCancel() {
  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-3">😕</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Payment Canceled</h1>
        <p className="text-gray-500 text-sm mb-6">
          No charge was made. Your spot is not confirmed until the deposit is paid.
        </p>
        <a
          href="/"
          className="block w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold active:bg-violet-700 transition"
        >
          Start Over
        </a>
      </div>
    </div>
  );
}
