export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-5">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mt-1">Last updated: May 2026</p>
        </div>

        <div className="prose prose-sm text-gray-600 space-y-6">

          <Section title="1. What We Collect">
            <p>We collect the following data when you use Groomnice:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Groomer account data:</strong> name, email, business name, booking URL handle</li>
              <li><strong>Client data you enter:</strong> client names, phone numbers, addresses, pet information</li>
              <li><strong>Appointment data:</strong> dates, times, service types, notes</li>
              <li><strong>Uploaded files:</strong> vaccine certificate photos (processed by AI, stored securely)</li>
              <li><strong>Usage data:</strong> page visits and feature usage (no third-party tracking pixels)</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Data">
            <ul className="list-disc pl-5 space-y-1">
              <li>To operate and improve the Groomnice platform</li>
              <li>To provide scheduling, client management, and route optimization features</li>
              <li>To process vaccine certificate images using AI (Claude by Anthropic)</li>
              <li>To send appointment-related SMS notifications (via Twilio, when enabled)</li>
              <li>To process payments (via Stripe — we never store card numbers)</li>
            </ul>
          </Section>

          <Section title="3. Data Sharing">
            <p>We do not sell your data. We share data only with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Anthropic</strong> — vaccine image processing (AI OCR)</li>
              <li><strong>Twilio</strong> — SMS delivery (when enabled)</li>
              <li><strong>Stripe</strong> — payment processing (PCI-compliant; we see no card data)</li>
              <li><strong>Mapbox</strong> — address geocoding for route optimization</li>
              <li><strong>Railway</strong> — cloud infrastructure hosting</li>
            </ul>
            <p className="mt-2">All third-party providers are bound by their own privacy policies and applicable law.</p>
          </Section>

          <Section title="4. Client Data Responsibility">
            <p>
              As a groomer using Groomnice, you are the data controller for your clients' personal
              information. You are responsible for obtaining any consent required by applicable law
              (including GDPR if you operate in the EU) before entering client data into Groomnice.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your data for as long as your account is active. You may request deletion
              of your account and associated data by emailing{" "}
              <a href="mailto:contactusai77@gmail.com" className="text-violet-600 underline">
                contactusai77@gmail.com
              </a>. We will delete your data within 30 days of a valid request.
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              Passwords are hashed using bcrypt. JWT tokens expire after 30 days. Uploaded files
              are stored in isolated cloud storage. We use HTTPS for all data in transit.
              No credit card or financial data is stored on our servers.
            </p>
          </Section>

          <Section title="7. AI Processing">
            <p>
              Vaccine certificate images you upload are sent to Anthropic's Claude AI for expiry
              date extraction. These images may be retained by Anthropic per their{" "}
              <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-violet-600 underline">
                Privacy Policy
              </a>. AI-extracted dates are always shown to you for manual verification before saving.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your client data (available in Clients → Export)</li>
            </ul>
            <p className="mt-2">
              Contact <a href="mailto:contactusai77@gmail.com" className="text-violet-600 underline">
                contactusai77@gmail.com
              </a> to exercise any of these rights.
            </p>
          </Section>

          <Section title="9. Changes">
            <p>
              We may update this policy as the product evolves. Material changes will be communicated
              via email or in-app notification. Continued use of Groomnice after changes
              constitutes acceptance.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-bold text-gray-800 mb-2">{title}</h2>
      {children}
    </div>
  );
}
