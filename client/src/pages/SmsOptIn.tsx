/**
 * Public SMS Opt-In Page — /sms-optin
 *
 * This static page demonstrates the 10DLC-compliant SMS opt-in flow for
 * Alta Mortgage Group. It is publicly accessible without authentication and
 * can be submitted to Telnyx/TCR as the opt-in form URL for campaign review.
 *
 * It mirrors the opt-in language present on all dynamic landing pages at /lp/:slug.
 */
import { useState } from "react";
import { CheckCircle } from "lucide-react";

export default function SmsOptIn() {
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isValid = firstName && lastName && email && phone && smsConsent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're opted in!</h2>
          <p className="text-gray-500 text-sm">
            Thank you. You'll receive a confirmation text from Alta Mortgage Group shortly.
            Reply <strong>STOP</strong> at any time to unsubscribe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1F7B47] mb-1">
            Alta Mortgage Group
          </p>
          <h1 className="text-2xl font-bold text-gray-900">SMS Updates Opt-In</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sign up to receive mortgage tips, event reminders, and appointment updates by text.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Mobile Phone Number *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* SMS Consent — 10DLC compliant */}
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2.5">
              <input
                id="sms-consent"
                type="checkbox"
                required
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 flex-shrink-0 h-4 w-4 rounded border-gray-300 accent-[#1F7B47]"
              />
              <label htmlFor="sms-consent" className="text-xs text-gray-600 leading-relaxed cursor-pointer">
                By checking this box, I consent to receive recurring automated and non-automated SMS
                text messages from <strong>Alta Mortgage Group</strong> at the mobile number provided
                above. Messages may include event reminders, follow-up information, mortgage updates,
                and appointment confirmations. Consent is not a condition of any purchase or service.
              </label>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed pl-6">
              <strong>Message frequency varies.</strong> Message &amp; data rates may apply.
              Reply <strong>STOP</strong> to cancel at any time.
              Reply <strong>HELP</strong> for help.
              Mobile carriers are not liable for delayed or undelivered messages.
              No mobile information will be shared with third parties for marketing purposes.
              View our{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-[#1F7B47]">
                Privacy Policy
              </a>
              {" "}and{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-[#1F7B47]">
                Terms of Service
              </a>.
            </p>
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="w-full h-11 rounded-xl text-white text-sm font-semibold bg-[#1F7B47] hover:bg-[#185f38] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Opt In to SMS Updates
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-400 text-xs mt-8 space-y-1">
        <p>&copy; {new Date().getFullYear()} Alta Mortgage Group. All rights reserved.</p>
        <p>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
            Privacy Policy
          </a>
          {" · "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  );
}
