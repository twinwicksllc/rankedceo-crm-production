import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  resolveClientEditSession,
  hashReviewToken,
} from "@/lib/waas/client-edit/edit-session";

// =============================================================================
// POST /api/edit/upload
// Token-gated multipart image upload endpoint for the client self-service editor.
//
// Form fields:
//   file         — the image File object
//   reviewToken  — raw review token (validated server-side; never stored raw)
//   assetSlot    — safe slug identifying the field, e.g. "section-0-image"
//   variantIndex — string-encoded integer (the variant being edited)
//
// Response:
//   { success: true,  publicUrl, storagePath, assetId }
//   { success: false, error: string }
// =============================================================================

const BUCKET_NAME = "client-uploads";
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

// ---------------------------------------------------------------------------
// Admin client (service-role — handles bucket creation + upload)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL;
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("WaaS Supabase admin env vars not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Ensure the bucket exists (idempotent)
// ---------------------------------------------------------------------------

async function ensureClientUploadsBucket(
  supabase: ReturnType<typeof getAdminClient>,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
  if (!error && data) return { error: null };

  const { error: createErr } = await supabase.storage.createBucket(
    BUCKET_NAME,
    {
      public: true,
      fileSizeLimit: MAX_FILE_BYTES,
      allowedMimeTypes: [...ALLOWED_MIMES],
    },
  );

  if (createErr && !/already exists|duplicate/i.test(createErr.message)) {
    return { error: createErr.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// Safe slug validator for assetSlot
// ---------------------------------------------------------------------------

function isValidSlug(s: string): boolean {
  return /^[a-z0-9_-]+$/i.test(s) && s.length <= 80;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const reviewToken =
      (formData.get("reviewToken") as string | null)?.trim() ?? "";
    const assetSlot =
      (formData.get("assetSlot") as string | null)?.trim() ?? "";
    const variantIdxRaw =
      (formData.get("variantIndex") as string | null)?.trim() ?? "";
    const fileRaw = formData.get("file");

    // ---- Input validation ----
    if (!reviewToken) {
      return NextResponse.json(
        { success: false, error: "Missing reviewToken" },
        { status: 400 },
      );
    }
    if (!assetSlot || !isValidSlug(assetSlot)) {
      return NextResponse.json(
        { success: false, error: "Invalid assetSlot" },
        { status: 400 },
      );
    }
    const variantIndex = parseInt(variantIdxRaw, 10);
    if (
      !Number.isInteger(variantIndex) ||
      variantIndex < 1 ||
      variantIndex > 3
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid variantIndex (must be 1–3)" },
        { status: 400 },
      );
    }
    if (!(fileRaw instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Missing file" },
        { status: 400 },
      );
    }

    // ---- File validation ----
    if (!ALLOWED_MIMES.has(fileRaw.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please upload a JPG, PNG, WebP, SVG, or GIF image.",
        },
        { status: 400 },
      );
    }
    if (fileRaw.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File size must be under 8 MB." },
        { status: 400 },
      );
    }
    if (fileRaw.size === 0) {
      return NextResponse.json(
        { success: false, error: "File is empty." },
        { status: 400 },
      );
    }

    // ---- Auth: resolve + permission check ----
    const sessionResult = await resolveClientEditSession(reviewToken);
    if (!sessionResult.ok) {
      return NextResponse.json(
        { success: false, error: sessionResult.message },
        { status: 403 },
      );
    }
    if (sessionResult.session.permissions.isLocked) {
      return NextResponse.json(
        {
          success: false,
          error: "Editing is locked — your design has been approved.",
        },
        { status: 403 },
      );
    }
    if (!sessionResult.session.permissions.canSwapImages) {
      return NextResponse.json(
        {
          success: false,
          error: "Image editing is not available for this session.",
        },
        { status: 403 },
      );
    }

    const { tenantId } = sessionResult.session;
    const tokenHash = hashReviewToken(reviewToken);

    // ---- Build storage path ----
    // Include timestamp so re-uploads generate new URLs (avoids CDN stale cache)
    const ext =
      fileRaw.name
        .split(".")
        .pop()
        ?.toLowerCase()
        ?.replace(/[^a-z0-9]/g, "") || "bin";
    const timestamp = Date.now();
    const storagePath = `${tenantId}/${variantIndex}/${assetSlot}-${timestamp}.${ext}`;

    // ---- Upload ----
    const supabase = getAdminClient();

    const bucketResult = await ensureClientUploadsBucket(supabase);
    if (bucketResult.error) {
      return NextResponse.json(
        { success: false, error: `Storage unavailable: ${bucketResult.error}` },
        { status: 500 },
      );
    }

    const bytes = Buffer.from(await fileRaw.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, bytes, {
        upsert: false, // new path per upload (timestamp in name)
        contentType: fileRaw.type,
        cacheControl: "31536000", // 1 year — URL is unique per upload
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    // ---- Register in client_uploaded_assets ----
    const { data: assetRow, error: assetErr } = await supabase
      .from("client_uploaded_assets")
      .insert({
        tenant_id: tenantId,
        storage_path: storagePath,
        cdn_url: publicUrl,
        variant_index: variantIndex,
        asset_slot: assetSlot,
        mime_type: fileRaw.type,
        file_size_bytes: fileRaw.size,
        review_token_hash: tokenHash,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const assetId = assetErr
      ? null
      : ((assetRow as { id: string } | null)?.id ?? null);

    // Non-fatal if asset registration fails — the upload succeeded
    if (assetErr) {
      console.error("[upload] asset registration failed:", assetErr.message);
    }

    return NextResponse.json({
      success: true,
      publicUrl,
      storagePath,
      assetId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
