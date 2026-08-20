"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CreateAccountPage() {
  const params = useParams();
  const router = useRouter();
  const auditId = params?.auditId as string | undefined;

  const [stage, setStage] = useState<"check" | "existing" | "creating">("check");
  const [error, setError] = useState<string | null>(null);
  const checkCompletedRef = useRef(false);

  useEffect(() => {
    if (!auditId || checkCompletedRef.current) return;
    checkCompletedRef.current = true;

    // Auto-create tenant (fire the API call)
    createTenant();
  }, [auditId]);

  const createTenant = async () => {
    if (!auditId) {
      setError("Invalid audit ID");
      return;
    }

    try {
      setStage("creating");
      const response = await fetch(`/api/audit/${auditId}/create-tenant`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to create tenant");
      }

      const data = await response.json() as { tenantId: string; reviewToken: string; existing?: boolean };

      // Redirect to account check screen
      setStage("existing");
      sessionStorage.setItem("pending_tenant", JSON.stringify({
        tenantId: data.tenantId,
        reviewToken: data.reviewToken,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStage("check");
    }
  };

  const handleExistingAccount = () => {
    // Redirect to login with redirect back to onboarding
    router.push("/audit/login?redirectTo=/onboarding/1&fromAudit=true");
  };

  const handleNewAccount = () => {
    // Redirect to signup with tenant info
    const pending = sessionStorage.getItem("pending_tenant");
    if (pending) {
      const { tenantId, reviewToken } = JSON.parse(pending) as { tenantId: string; reviewToken: string };
      sessionStorage.removeItem("pending_tenant");
      // Redirect to auth confirm or signup
      router.push(`/audit/auth/confirm?tenantId=${tenantId}&reviewToken=${reviewToken}&next=/onboarding/1`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {stage === "check" && (
          <div className="text-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mb-4" />
            <p className="text-slate-600">Preparing your account...</p>
          </div>
        )}

        {stage === "creating" && (
          <div className="text-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mb-4" />
            <p className="text-slate-600">Setting up your website builder...</p>
          </div>
        )}

        {stage === "existing" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Welcome!
              </h1>
              <p className="text-slate-600">
                Do you already have an account with RankedCEO?
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleExistingAccount}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                Yes, sign me in
              </Button>
              <Button
                onClick={handleNewAccount}
                className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-lg transition"
              >
                No, create a new account
              </Button>
            </div>

            <p className="text-xs text-slate-500 text-center">
              You can also sign up with Google on the next screen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
