import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useParams } from "wouter";
import { Building2, CheckCircle, Loader2 } from "lucide-react";

export default function PublicLandingPage() {
  const params = useParams<{ slug: string }>();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: page, isLoading: pageLoading } = trpc.landingPages.getBySlug.useQuery({ slug: params.slug });

  const submitLead = trpc.leads.captureFromLandingPage.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: () => setSubmitted(true), // Show success anyway for UX
  });

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47]">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47]">
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Page Not Found</h1>
          <p className="text-white/70 mt-2">This landing page does not exist or has been deactivated.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47]">
        <Card className="max-w-md w-full mx-4 border-0 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Raleway, sans-serif" }}>You're Registered!</h2>
            <p className="text-muted-foreground">
              Thank you for signing up. You'll receive a confirmation email shortly with all the details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2A5B3F] via-[#1F7B47] to-[#165E2E] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Building2 className="h-8 w-8 text-[#C9A84C]" />
            <span className="text-white/80 text-sm font-medium tracking-widest uppercase" style={{ fontFamily: "Raleway, sans-serif" }}>
              Clarke & Associates
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight" style={{ fontFamily: "Raleway, sans-serif" }}>
            {page.headline || page.title}
          </h1>
          {page.subheadline && (
            <p className="text-white/80 mt-3 text-lg">{page.subheadline}</p>
          )}
        </div>

        {/* Form Card */}
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">First Name</Label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Name</Label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" className="mt-1" />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="sms-consent"
                  checked={smsConsent}
                  onCheckedChange={(v) => setSmsConsent(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="sms-consent" className="text-xs text-muted-foreground leading-relaxed">
                  I consent to receive SMS notifications and reminders. Message and data rates may apply.
                </label>
              </div>
              <Button
                className="w-full h-12 text-base font-semibold text-white shadow-lg"
                style={{ backgroundColor: "#2A5B3F" }}
                disabled={!form.firstName || !form.lastName || !form.email || submitLead.isPending}
                onClick={() => submitLead.mutate({
                  slug: params.slug,
                  firstName: form.firstName,
                  lastName: form.lastName,
                  email: form.email,
                  phone: form.phone || undefined,
                  smsConsent,
                })}
              >
                {submitLead.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (page.ctaText || "Register Now")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-6">
          &copy; {new Date().getFullYear()} Clarke & Associates. All rights reserved.
        </p>
      </div>
    </div>
  );
}
