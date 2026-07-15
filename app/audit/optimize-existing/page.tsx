import { Suspense } from "react";
import { OptimizeExistingSiteClient } from "./page-client";

function LoadingFallback() {
  return (
    <main style={{ minHeight: "100vh", padding: "32px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>Loading...</div>
    </main>
  );
}

export default function OptimizeExistingSitePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OptimizeExistingSiteClient />
    </Suspense>
  );
}
