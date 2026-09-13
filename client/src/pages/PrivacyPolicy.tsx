export default function PrivacyPolicy() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10 border-b pb-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1F7B47] mb-1">Clarke &amp; Associates</p>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mt-2">Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: {year}</p>
        </div>

        <div className="prose prose-gray max-w-none text-gray-700 space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Introduction</h2>
            <p>
              Clarke &amp; Associates ("Company," "we," "us," or "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our websites, attend our events, or interact with us through any channel, including SMS text messaging.
            </p>
            <p className="mt-2">
              By providing your contact information and consenting to communications, you agree to the terms of this Privacy Policy. If you do not agree, please do not submit your information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Information We Collect</h2>
            <p>We may collect the following categories of personal information:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Contact Information:</strong> First name, last name, email address, and phone number.</li>
              <li><strong>Event Registration Data:</strong> Webinar or seminar session selections, attendance records, and engagement history.</li>
              <li><strong>Communication Preferences:</strong> SMS opt-in consent, email opt-in consent, and opt-out requests.</li>
              <li><strong>Device &amp; Usage Data:</strong> IP address, browser type, pages visited, and referring URLs collected automatically when you visit our websites.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>To register you for webinars, seminars, and events and send confirmation details.</li>
              <li>To send SMS text messages, including event reminders, follow-up information, and relevant mortgage or real estate updates, where you have provided explicit consent.</li>
              <li>To send email communications related to your registration or future educational opportunities.</li>
              <li>To respond to your inquiries and provide customer support.</li>
              <li>To improve our services, events, and communications.</li>
              <li>To comply with applicable legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. SMS Text Messaging</h2>
            <p>
              By checking the SMS consent box on our registration forms, you expressly consent to receive recurring automated and non-automated SMS text messages from Clarke &amp; Associates at the mobile phone number you provided. These messages may include:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Event reminders and confirmations</li>
              <li>Follow-up information after events</li>
              <li>Mortgage rate updates and educational content</li>
              <li>Appointment reminders and scheduling information</li>
            </ul>
            <p className="mt-3">
              <strong>Message frequency varies.</strong> Message and data rates may apply depending on your mobile carrier and plan.
            </p>
            <p className="mt-3">
              <strong>To opt out:</strong> Reply <strong>STOP</strong> to any SMS message at any time to unsubscribe. You will receive a one-time confirmation message and will receive no further SMS messages from us.
            </p>
            <p className="mt-3">
              <strong>For help:</strong> Reply <strong>HELP</strong> to any SMS message or contact us at the information below.
            </p>
            <p className="mt-3">
              Consent to receive SMS messages is not a condition of purchasing any product or service. Your consent is entirely voluntary.
            </p>
            <p className="mt-3">
              Mobile carriers are not liable for delayed or undelivered messages. Supported carriers include but are not limited to: AT&amp;T, Verizon, T-Mobile, Sprint, Boost Mobile, U.S. Cellular, and MetroPCS.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Sharing of Information</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share your information with trusted service providers who assist us in operating our business (such as email platforms, SMS providers, and CRM software), subject to confidentiality agreements. We may also disclose information as required by law or to protect our legal rights.
            </p>
            <p className="mt-2 font-semibold">
              No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">6. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to fulfill the purposes described in this policy, comply with legal obligations, and resolve disputes. You may request deletion of your information at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Request deletion of your personal information.</li>
              <li>Opt out of SMS communications at any time by replying STOP.</li>
              <li>Opt out of email communications by clicking the unsubscribe link in any email.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">8. Security</h2>
            <p>
              We implement reasonable administrative, technical, and physical safeguards to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last Updated" date above. Continued use of our services after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or wish to exercise your rights, please contact us:</p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-900">Clarke &amp; Associates</p>
              <p className="mt-1">Email: <a href="mailto:info@altamortgagecrm.net" className="text-[#1F7B47] underline">info@altamortgagecrm.net</a></p>
              <p>Website: <a href="https://altamortgagecrm.net" className="text-[#1F7B47] underline">altamortgagecrm.net</a></p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t text-center text-xs text-gray-400">
          &copy; {year} Clarke &amp; Associates. All rights reserved.
          &nbsp;|&nbsp;
          <a href="/terms" className="text-[#1F7B47] underline hover:text-[#165E2E]">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
