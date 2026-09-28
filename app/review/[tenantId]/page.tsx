import { notFound } from "next/navigation";
import {
  getClientReviewSession,
  getClientVariantRegenState,
  CLIENT_REGEN_DEFAULT_QUOTA,
} from "@/lib/waas/actions/admin";
import { ReviewClient } from "./review-client";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const sessionResult = await getClientReviewSession(tenantId);
  if (!sessionResult.success || !sessionResult.data) notFound();

  const session = sessionResult.data;

  // Initiative 12: load regen/comparison state alongside the review session
  // so the page can render the side-by-side generation comparison without an
  // extra client-side round trip on first paint.
  const regenStateResult = await getClientVariantRegenState(
    session.reviewToken,
  );
  const initialRegenState =
    regenStateResult.success && regenStateResult.data
      ? regenStateResult.data
      : {
          generations: [],
          regenCount: 0,
          regenQuota: CLIENT_REGEN_DEFAULT_QUOTA,
          regensRemaining: CLIENT_REGEN_DEFAULT_QUOTA,
        };

  return (
    <ReviewClient
      tenantId={session.tenantId}
      slug={session.slug}
      businessName={session.businessName}
      reviewToken={session.reviewToken}
      initialSelectedTemplate={session.selectedTemplateSlug}
      initialFeedback={session.feedback}
      initialMix={session.mix}
      versions={session.versions}
      variants={session.variants}
      initialRegenState={initialRegenState}
    />
  );
}
