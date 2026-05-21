export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-5">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">✂️</div>
          <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-400 mt-1">Last updated: May 2026</p>
        </div>

        <div className="prose prose-sm text-gray-600 space-y-6">

          <Section title="1. What Groomnice Is">
            <p>
              Groomnice is a scheduling and business management platform for independent pet groomers.
              We provide software tools — including appointment scheduling, client management, route
              optimization, AI-assisted pricing, and vaccine tracking. We are a <strong>technology
              platform only</strong>. We do not provide grooming services, employ groomers, or have
              any involvement in the actual care of animals.
            </p>
          </Section>

          <Section title="2. AI-Generated Content">
            <p>
              Groomnice uses artificial intelligence (AI) to generate price estimates, extract
              information from vaccine certificates, and provide other recommendations.
            </p>
            <p className="mt-2 font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              ⚠️ AI can make mistakes. All AI-generated outputs — including price estimates, vaccine
              expiry dates, and scheduling suggestions — are for reference only. You are solely
              responsible for verifying AI outputs before acting on them or communicating them to
              clients. Groomnice makes no warranty regarding the accuracy of AI-generated content.
            </p>
          </Section>

          <Section title="3. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Groomnice and its owners shall not be liable for:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Lost profits, lost revenue, or lost business opportunities</li>
              <li>Loss of data or data corruption</li>
              <li>Business interruption caused by software downtime or errors</li>
              <li>Any indirect, incidental, consequential, or punitive damages</li>
              <li>Outcomes arising from AI-generated pricing, scheduling, or routing recommendations</li>
              <li>Actions or omissions by groomers using our platform</li>
              <li>Any harm to animals in the care of groomers using Groomnice</li>
            </ul>
          </Section>

          <Section title="4. Liability Cap">
            <p>
              Our total cumulative liability to you for any claim arising under or related to these
              Terms or your use of Groomnice shall not exceed the <strong>lesser of (a) $100 USD or
              (b) the total subscription fees you paid to Groomnice in the 12 months preceding the
              claim</strong>. This cap applies regardless of the theory of liability.
            </p>
          </Section>

          <Section title="5. Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless Groomnice and its owners from and
              against any third-party claims, damages, losses, or legal fees arising out of:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your use of the platform</li>
              <li>Your grooming business operations</li>
              <li>Your communications with clients</li>
              <li>Any data you provide, upload, or process through Groomnice</li>
            </ul>
          </Section>

          <Section title="6. Data and Privacy">
            <p>
              By using Groomnice, you consent to our collection and processing of business data
              (groomer profiles, client records, appointment data, and uploaded files) for the
              purpose of providing the service. We do not sell your data to third parties. See
              our <a href="/privacy" className="text-violet-600 underline">Privacy Policy</a> for
              full details.
            </p>
          </Section>

          <Section title="7. No Guarantee of Uptime">
            <p>
              Groomnice is provided "as is" and "as available." We do not guarantee uninterrupted
              access to the platform. We will work to maintain reasonable uptime but are not liable
              for outages, bugs, or data loss events.
            </p>
          </Section>

          <Section title="8. Continuous Improvement">
            <p>
              We are continuously improving Groomnice. Features may change, be added, or be removed.
              We will notify users of material changes via email or in-app notice. Continued use
              after changes constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="9. Governing Law">
            <p>
              These Terms are governed by the laws of the State of Delaware, USA, without regard
              to conflict of law principles. Any disputes shall be resolved by binding arbitration
              on an individual basis — class actions are waived.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:contactusai77@gmail.com" className="text-violet-600 underline">
                contactusai77@gmail.com
              </a>
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
