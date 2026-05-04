export default function PaymentSuccess() {
  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">You're Confirmed!</h1>
        <p className="text-gray-500 text-sm mb-6">
          Deposit received. Your grooming appointment is locked in.
        </p>
        <div className="bg-green-50 rounded-2xl p-4 text-sm text-gray-600">
          We'll send you a reminder text 24 hours before your appointment.
        </div>
      </div>
    </div>
  );
}
