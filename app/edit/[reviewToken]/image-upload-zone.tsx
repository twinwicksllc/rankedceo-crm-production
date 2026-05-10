'use client'

// =============================================================================
// app/edit/[reviewToken]/image-upload-zone.tsx
// Drag-and-drop / click-to-upload image component for the inline edit modal.
//
// Props:
//   reviewToken  — raw review token (sent to /api/edit/upload)
//   assetSlot    — storage path slug derived from the field path
//   variantIndex — which variant is being edited
//   currentUrl   — existing image URL (shown as thumbnail)
//   onUploaded   — called with the new CDN URL on success
// =============================================================================

import { useCallback, useRef, useState } from 'react'

interface ImageUploadZoneProps {
  reviewToken:  string
  assetSlot:    string
  variantIndex: number
  currentUrl:   string
  onUploaded:   (publicUrl: string) => void
}

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
const MAX_BYTES     = 8 * 1024 * 1024

export function ImageUploadZone({
  reviewToken,
  assetSlot,
  variantIndex,
  currentUrl,
  onUploaded,
}: ImageUploadZoneProps) {
  const [isDragging, setDragging] = useState(false)
  const [progress,   setProgress] = useState<number | null>(null)
  const [error,      setError]    = useState<string | null>(null)
  const [previewUrl, setPreview]  = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------------------
  // Upload via XHR for real progress events
  // -------------------------------------------------------------------------

  const uploadFile = useCallback(
    (file: File) => {
      setError(null)

      // Client-side validation
      if (!ALLOWED_MIMES.includes(file.type)) {
        setError('Please upload a JPG, PNG, WebP, SVG, or GIF image.')
        return
      }
      if (file.size > MAX_BYTES) {
        setError('File size must be under 8 MB.')
        return
      }
      if (file.size === 0) {
        setError('File is empty.')
        return
      }

      // Show local preview immediately
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)

      // Build form data
      const fd = new FormData()
      fd.append('file',         file)
      fd.append('reviewToken',  reviewToken)
      fd.append('assetSlot',    assetSlot)
      fd.append('variantIndex', String(variantIndex))

      // XHR upload with progress
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/edit/upload')

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        setProgress(null)
        try {
          const resp = JSON.parse(xhr.responseText) as {
            success:   boolean
            publicUrl?: string
            error?:    string
          }
          if (!resp.success || !resp.publicUrl) {
            setError(resp.error ?? 'Upload failed. Please try again.')
            setPreview(null)
            return
          }
          onUploaded(resp.publicUrl)
        } catch {
          setError('Unexpected server response.')
          setPreview(null)
        }
      })

      xhr.addEventListener('error', () => {
        setProgress(null)
        setError('Network error. Please check your connection and try again.')
        setPreview(null)
      })

      xhr.addEventListener('abort', () => {
        setProgress(null)
        setError(null)
        setPreview(null)
      })

      setProgress(0)
      xhr.send(fd)
    },
    [reviewToken, assetSlot, variantIndex, onUploaded],
  )

  // -------------------------------------------------------------------------
  // Drag events
  // -------------------------------------------------------------------------

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const onDragLeave = () => setDragging(false)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset input so the same file can be re-selected after an error
    e.target.value = ''
  }

  const displayUrl = previewUrl ?? (currentUrl || null)
  const isUploading = progress !== null

  // -------------------------------------------------------------------------

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Click or drag an image to upload"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !isUploading && inputRef.current?.click()}
        className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : isUploading
              ? 'border-slate-300 bg-slate-50 cursor-not-allowed'
              : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
        }`}
      >
        {/* Current image thumbnail */}
        {displayUrl && !isUploading && (
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt="Current"
              className="h-full w-full object-cover opacity-20"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center gap-1.5 px-4 py-4 text-center">
          {isUploading ? (
            <>
              <UploadSpinner />
              <span className="text-sm font-medium text-blue-600">
                Uploading{progress != null && progress > 0 ? ` ${progress}%` : '…'}
              </span>
            </>
          ) : (
            <>
              <UploadIcon />
              <span className="text-sm font-medium text-slate-700">
                {displayUrl ? 'Replace image' : 'Upload image'}
              </span>
              <span className="text-xs text-slate-500">
                Drag &amp; drop, or click to browse
              </span>
              <span className="text-xs text-slate-400">
                JPG, PNG, WebP, SVG, GIF · max 8 MB
              </span>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isUploading && progress != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-blue-500 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs font-medium text-red-600">
          ⚠ {error}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
        className="sr-only"
        onChange={onInputChange}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small inline icons
// ---------------------------------------------------------------------------

function UploadIcon() {
  return (
    <svg
      className="h-8 w-8 text-slate-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function UploadSpinner() {
  return (
    <svg
      className="h-7 w-7 animate-spin text-blue-500"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path
        d="M12 2a10 10 0 0110 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
