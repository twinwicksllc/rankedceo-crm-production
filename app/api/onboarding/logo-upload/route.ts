import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getRawClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('WaaS Supabase env vars not set')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isMissingBucketError(errorMessage: string, bucketName: string): boolean {
  const escaped = bucketName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`bucket.*${escaped}.*(not found|does not exist)|not found`, 'i')
  return re.test(errorMessage)
}

async function ensureLogosBucket(supabase: ReturnType<typeof getRawClient>): Promise<{ error: { message: string } | null }> {
  const { data, error } = await supabase.storage.getBucket('logos')
  if (!error && data) {
    return { error: null }
  }

  if (error && !isMissingBucketError(error.message, 'logos')) {
    return { error: { message: error.message } }
  }

  const { error: createError } = await supabase.storage.createBucket('logos', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
  })

  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    return { error: { message: createError.message } }
  }

  return { error: null }
}

export async function POST(request: Request) {
  try {
    const supabase = getRawClient()
    const formData = await request.formData()

    const tenantIdRaw = formData.get('tenantId')
    const fileRaw = formData.get('file')

    const tenantId = typeof tenantIdRaw === 'string' ? tenantIdRaw.trim() : ''
    const file = fileRaw instanceof File ? fileRaw : null

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Missing tenantId' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'Missing file' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Please upload a JPG, PNG, SVG, or WebP image.' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File size must be under 5MB.' }, { status: 400 })
    }

    const { error: bucketError } = await ensureLogosBucket(supabase)
    if (bucketError) {
      return NextResponse.json({ success: false, error: bucketError.message }, { status: 500 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const uploadPath = `${tenantId}/logo.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(uploadPath, bytes, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600',
      })

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('logos').getPublicUrl(uploadPath)

    return NextResponse.json({ success: true, publicUrl, uploadPath })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
