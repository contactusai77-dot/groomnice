async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Customer-facing types ─────────────────────────────────────────────────────

export interface BookingResponse {
  booking_id: string;
  message: string;
}

export interface PetData {
  id: string;
  pet_name: string | null;
  breed: string | null;
  age: string | null;
  weight: string | null;
  emergency_contact: string | null;
  notes: string | null;
  rabies_expiry: string | null;
  profile_complete: boolean;
}

export interface PetFormData {
  pet_name?: string | null;
  breed?: string | null;
  age?: string | null;
  weight?: string | null;
  emergency_contact?: string | null;
  notes?: string | null;
}

export interface ProfileData {
  client_name: string;
  pets: PetData[];
}

export interface VaccineResult {
  rabies_expiry: string | null;
  needs_review: boolean;
  message: string;
}

// ── Groomer-facing types ──────────────────────────────────────────────────────

export interface AppointmentData {
  id: string;
  appointment_date: string | null;
  service_type: string;
  status: string;
  client_name: string;
  client_phone: string;
  pet_name: string;
  breed: string | null;
  vaccine_ok: boolean;
  deposit_ok: boolean;
  ready: boolean;
  profile_complete: boolean;
}

export interface ClientData {
  id: string;
  name: string;
  phone: string;
  intake_token: string;
  pets: PetData[];
  vaccine_ok: boolean;
  last_visit: string | null;
}

export interface SettingsData {
  require_deposit: boolean;
  send_24h_reminder: boolean;
  send_gap_fill_text: boolean;
  deposit_amount: number;
}

export interface VaultSubmission {
  id: string;
  client_name: string;
  pet_name: string;
  image_url: string | null;
  ai_expiry: string | null;
  status: string;
  created_at: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  // Customer
  createBooking: (phone: string, name: string) =>
    request<BookingResponse>("/bookings", { method: "POST", body: JSON.stringify({ phone, name }) }),

  getProfile: (token: string) => request<ProfileData>(`/profile/${token}`),

  saveProfile: (token: string, data: PetFormData) =>
    request<{ success: boolean }>(`/profile/${token}`, { method: "PUT", body: JSON.stringify(data) }),

  addPet: (token: string, data: PetFormData) =>
    request<{ success: boolean; pet_id: string }>(`/profile/${token}/pets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePet: (token: string, petId: string, data: PetFormData) =>
    request<{ success: boolean }>(`/profile/${token}/pets/${petId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  uploadVaccine: async (token: string, file: File, petId?: string): Promise<VaccineResult> => {
    const form = new FormData();
    form.append("file", file);
    const url = petId ? `/api/vaccine/${token}?pet_id=${petId}` : `/api/vaccine/${token}`;
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Groomer dashboard
  getTodayAppointments: () => request<AppointmentData[]>("/appointments/today"),

  quickBooking: (data: {
    phone: string;
    client_name: string;
    pet_name: string;
    service_type: string;
    appointment_time: string;
  }) => request<{ booking_id: string }>("/bookings/quick", { method: "POST", body: JSON.stringify(data) }),

  updateBookingStatus: (id: string, status: string) =>
    request<{ success: boolean }>(`/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  textClient: (id: string) =>
    request<{ success: boolean; message: string }>(`/bookings/${id}/text-client`, { method: "POST" }),

  // Clients
  getClients: () => request<ClientData[]>("/clients"),

  // Vaccine vault
  getVaccineVault: () => request<VaultSubmission[]>("/vaccine-vault"),

  confirmVaccine: (id: string, expiry: string) =>
    request<{ success: boolean }>(`/vaccine-vault/${id}/confirm`, {
      method: "PATCH",
      body: JSON.stringify({ expiry }),
    }),

  // Settings
  getSettings: () => request<SettingsData>("/settings"),

  updateSettings: (data: Partial<SettingsData>) =>
    request<{ success: boolean }>("/settings", { method: "PATCH", body: JSON.stringify(data) }),
};
