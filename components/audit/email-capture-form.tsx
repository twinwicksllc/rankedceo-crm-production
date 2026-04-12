'use client'

// =============================================================================
// Email Capture Form
// Gates the PDF download — captures lead before allowing download
// Calls /api/audit/leads, then triggers PDF generation/download
// =============================================================================

import { useState } from 'react'

interface EmailCaptureFormProps {
  auditId:      string
  targetDomain: string
  onCaptured?:  (email: string) => void  // callback after successful capture
}

interface FormState {
  name:    string
  email:   string
  phone:   string
  company: string
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

export function EmailCaptureForm({
  auditId,
  targetDomain,
  onCaptured,
}: EmailCaptureFormProps) {
  const [form,   setForm]   = useState<FormState>({ name: '', email: '', phone: '', company: '' })
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error,  setError]  = useState<string | null>(null)
  const [open,   setOpen]   = useState(false)

  function update(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email) return

    setStatus('submitting')
    setError(null)

    try {
      const res = await fetch('/api/audit/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          audit_id: auditId,
          name:     form.name,
          email:    form.email,
          phone:    form.phone || undefined,
          company:  form.company || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Request failed (${res.status})`)
      }

      setStatus('success')
      onCaptured?.(form.email)

      // Trigger PDF download after short delay
      setTimeout(() => {
        window.open(`/api/audit/${auditId}/pdf`, '_blank')
      }, 800)

    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div style={{
        background:   'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(0,0,0,0.3))',
        border:       '1px solid rgba(34,197,94,0.35)',
        borderRadius: 14,
        padding:      '24px',
        textAlign:    'center',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>✅</div>
        <div style={{
          fontSize:   '1rem',
          fontWeight: 700,
          color:      '#22C55E',
          marginBottom: 6,
        }}>
          Download Starting…
        </div>
        <div style={{
          fontSize: '0.82rem',
          color:    'rgba(255,255,255,0.55)',
          marginBottom: 16,
        }}>
          Your PDF report is being prepared. Check your downloads folder.
        </div>
        <a
          href={`/api/audit/${auditId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:        'inline-block',
            padding:        '10px 24px',
            background:     'rgba(34,197,94,0.2)',
            border:         '1px solid rgba(34,197,94,0.4)',
            color:          '#22C55E',
            textDecoration: 'none',
            borderRadius:   8,
            fontSize:       '0.85rem',
            fontWeight:     600,
          }}
        >
          📄 Download PDF Report
        </a>
      </div>
    )
  }

  // ── Collapsed trigger (initial state) ────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width:        '100%',
          padding:      '14px 20px',
          background:   'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(0,0,0,0.3))',
          border:       '1px solid rgba(37,99,235,0.4)',
          borderRadius: 12,
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          gap:          12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.3rem' }}>📄</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize:   '0.9rem',
              fontWeight: 700,
              color:      '#ffffff',
              marginBottom: 2,
            }}>
              Download Full PDF Report
            </div>
            <div style={{
              fontSize: '0.75rem',
              color:    'rgba(255,255,255,0.45)',
            }}>
              Board-ready audit for {targetDomain} — shareable with your team
            </div>
          </div>
        </div>
        <div style={{
          padding:      '6px 14px',
          background:   'rgba(37,99,235,0.4)',
          borderRadius: 7,
          fontSize:     '0.78rem',
          fontWeight:   600,
          color:        '#93C5FD',
          whiteSpace:   'nowrap',
          flexShrink:   0,
        }}>
          Get PDF →
        </div>
      </button>
    )
  }

  // ── Expanded form ──────────────────────────────────────────────────────────
  return (
    <div style={{
      background:   'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(0,0,0,0.4))',
      border:       '1px solid rgba(37,99,235,0.35)',
      borderRadius: 14,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:    '16px 20px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>📄</span>
          <div>
            <div style={{
              fontSize:   '0.9rem',
              fontWeight: 700,
              color:      '#ffffff',
            }}>
              Download Your PDF Report
            </div>
            <div style={{
              fontSize: '0.72rem',
              color:    'rgba(255,255,255,0.4)',
            }}>
              Free — no credit card required
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'none',
            border:     'none',
            color:      'rgba(255,255,255,0.35)',
            cursor:     'pointer',
            fontSize:   '1rem',
            padding:    4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: '18px 20px' }}>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap:                 12,
          marginBottom:        12,
        }}>
          <FormField
            label="Full Name"
            type="text"
            placeholder="John Smith"
            value={form.name}
            onChange={update('name')}
            required
          />
          <FormField
            label="Email Address *"
            type="email"
            placeholder="john@acmeplumbing.com"
            value={form.email}
            onChange={update('email')}
            required
          />
          <FormField
            label="Phone (optional)"
            type="tel"
            placeholder="(555) 123-4567"
            value={form.phone}
            onChange={update('phone')}
          />
          <FormField
            label="Company (optional)"
            type="text"
            placeholder="Acme Plumbing Co."
            value={form.company}
            onChange={update('company')}
          />
        </div>

        {/* Error */}
        {status === 'error' && error && (
          <div style={{
            padding:      '8px 12px',
            background:   'rgba(239,68,68,0.1)',
            border:       '1px solid rgba(239,68,68,0.3)',
            borderRadius: 7,
            fontSize:     '0.78rem',
            color:        '#FCA5A5',
            marginBottom: 12,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'submitting' || !form.email}
          style={{
            width:        '100%',
            padding:      '13px 20px',
            background:   status === 'submitting'
              ? 'rgba(37,99,235,0.4)'
              : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            border:       'none',
            borderRadius: 10,
            color:        '#ffffff',
            fontSize:     '0.92rem',
            fontWeight:   700,
            cursor:       status === 'submitting' ? 'not-allowed' : 'pointer',
            boxShadow:    status === 'submitting' ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
            transition:   'opacity 0.2s',
            opacity:      !form.email ? 0.6 : 1,
          }}
        >
          {status === 'submitting' ? '⏳ Preparing report…' : '📥 Download My PDF Report →'}
        </button>

        <p style={{
          margin:    '10px 0 0',
          fontSize:  '0.7rem',
          color:     'rgba(255,255,255,0.3)',
          textAlign: 'center',
        }}>
          🔒 Your information is private. We never spam — ever.
        </p>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form field sub-component
// ---------------------------------------------------------------------------

function FormField({
  label, type, placeholder, value, onChange, required = false,
}: {
  label:       string
  type:        string
  placeholder: string
  value:       string
  onChange:    React.ChangeEventHandler<HTMLInputElement>
  required?:   boolean
}) {
  return (
    <div>
      <label style={{
        display:      'block',
        fontSize:     '0.72rem',
        fontWeight:   600,
        color:        'rgba(255,255,255,0.5)',
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        style={{
          width:        '100%',
          padding:      '9px 12px',
          background:   'rgba(255,255,255,0.06)',
          border:       '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          color:        '#ffffff',
          fontSize:     '0.85rem',
          outline:      'none',
          boxSizing:    'border-box',
          transition:   'border-color 0.2s',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(96,165,250,0.6)' }}
        onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.12)' }}
      />
    </div>
  )
}