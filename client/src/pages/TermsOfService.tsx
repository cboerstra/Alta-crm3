export default function TermsOfService() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10 border-b pb-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1F7B47] mb-1">Clarke &amp; Associates</p>
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-500 mt-2">Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: {year}</p>
        </div>

        <div className="prose prose-gray max-w-none text-gray-700 space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By registering for an event, submitting your contact information, or using any service provided by Clarke &amp; Associates ("Company," "we," "us," or "our"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services or submit your information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. SMS Messaging Terms</h2>
            <p>
              The following terms govern your participation in Clarke &amp; Associates' SMS messaging program.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">Program Description</h3>
            <p>
              Clarke &amp; Associates operates an SMS messaging program to send event reminders, follow-up information, mortgage education content, appointment confirmations, and other relevant communications to individuals who have provided explicit written consent.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">How to Opt In</h3>
            <p>
              You opt in to receive SMS messages by checking the SMS consent checkbox on our event registration forms. By doing so, you expressly consent to receive recurring automated and non-automated text messages from Clarke &amp; Associates at the mobile number you provided.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">Message Frequency</h3>
            <p>
              Message frequency varies based on your activity and registrations. You may receive up to 5–10 messages per month depending on upcoming events, follow-ups, and educational content.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">Message and Data Rates</h3>
            <p>
              Message and data rates may apply. These charges are billed by your mobile carrier and are not charged by Clarke &amp; Associates. Please check with your carrier for details on your messaging plan.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">How to Opt Out (STOP)</h3>
            <p>
              You may opt out of receiving SMS messages at any time by replying <strong>STOP</strong> to any text message you receive from us. After opting out, you will receive a single confirmation message and will not receive further SMS messages unless you re-enroll.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">Help</h3>
            <p>
              For assistance, reply <strong>HELP</strong> to any SMS message or contact us at the information below. Supported keywords: STOP, HELP, CANCEL, QUIT, END, UNSUBSCRIBE.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">Supported Carriers</h3>
            <p>
              Our SMS program is supported by major U.S. carriers including AT&amp;T, Verizon, T-Mobile, Sprint, Boost Mobile, U.S. Cellular, MetroPCS, and others. Carrier support is not guaranteed for all carriers. Mobile carriers are not liable for delayed or undelivered messages.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">No Condition of Purchase</h3>
            <p>
              Consent to receive SMS messages is not a condition of purchasing any product or service from Clarke &amp; Associates. Your consent is entirely voluntary.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-1">No Sharing of Mobile Information</h3>
            <p>
              Your mobile phone number and SMS consent information will not be shared with third parties or affiliates for marketing or promotional purposes. All information collected is governed by our <a href="/privacy" className="text-[#1F7B47] underline">Privacy Policy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. Event Registration</h2>
            <p>
              By registering for a webinar, seminar, or other event hosted by Clarke &amp; Associates, you agree that your registration information may be used to send you event-related communications including confirmations, reminders, and follow-up materials. Registration does not guarantee attendance and Clarke &amp; Associates reserves the right to cancel or reschedule events.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. Intellectual Property</h2>
            <p>
              All content, materials, and presentations provided by Clarke &amp; Associates at events or through our communications are the intellectual property of Clarke &amp; Associates and may not be reproduced, distributed, or used without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Disclaimer</h2>
            <p>
              Information provided by Clarke &amp; Associates through events, SMS messages, and other communications is for educational purposes only and does not constitute legal, financial, or mortgage advice. Always consult a licensed professional for advice specific to your situation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">6. Limitation of Liability</h2>
            <p>
              Clarke &amp; Associates shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services, attendance at events, or reliance on information provided through any communication channel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">7. Governing Law</h2>
            <p>
              These Terms of Service are governed by the laws of the State of Utah, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Salt Lake County, Utah.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">8. Changes to These Terms</h2>
            <p>
              We may update these Terms of Service from time to time. Continued use of our services after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">9. Contact Us</h2>
            <p>If you have questions about these Terms of Service, please contact us:</p>
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
          <a href="/privacy" className="text-[#1F7B47] underline hover:text-[#165E2E]">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
