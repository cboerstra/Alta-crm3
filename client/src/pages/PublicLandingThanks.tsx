import { CheckCircle } from "lucide-react";
import { useParams } from "wouter";

export default function PublicLandingThanks() {
  const params = useParams<{ slug: string }>();
  const joinUrl = window.sessionStorage.getItem(`lp:${params.slug}:joinUrl`);

  return (
    <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#B8924A]/15">
          <CheckCircle className="h-8 w-8 text-[#B8924A]" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">You're Registered!</h1>
        <p className="mb-4 text-gray-600">
          Thank you for signing up. You'll receive a confirmation email shortly with all the details.
        </p>
        {joinUrl && (
          <div className="mt-4 rounded-lg border border-[#B8924A]/30 bg-[#B8924A]/10 p-4">
            <p className="mb-2 text-sm font-medium text-[#8A6A25]">Your webinar join link:</p>
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-[#8A6A25] underline">
              {joinUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
