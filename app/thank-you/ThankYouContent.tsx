'use client'

import { useSearchParams } from 'next/navigation'

const INDUSTRY_CONFIG: Record<string, {
  name: string
  color: string
  accent: string
  icon: string
  phone: string
  nextSteps: string[]
}> = {
  hvac: {
    name: 'HVAC Pro',
    color: '#1a56a0',
    accent: '#2563b0',
    icon: '❄️',
    phone: '(800) 555-0182',
    nextSteps: [
      'A certified HVAC specialist will call you within 1 business hour',
      'We\'ll confirm your preferred appointment time',
      'A licensed technician will arrive at your home',
      'You\'ll receive a transparent, upfront quote — no surprises',
    ],
  },
  plumbing: {
    name: 'Plumb Pro',
    color: '#0e7490',
    accent: '#0891b2',
    icon: '🔧',
    phone: '(800) 555-0183',
    nextSteps: [
      'A licensed plumbing specialist will call you within 1 business hour',
      'We\'ll confirm your preferred appointment time',
      'A licensed plumber will arrive at your home',
      'You\'ll receive a transparent, upfront quote — no surprises',
    ],
  },
  electrical: {
    name: 'Spark Pro',
    color: '#b45309',
    accent: '#d97706',
    icon: '⚡',
    phone: '(800) 555-0184',
    nextSteps: [
      'A licensed electrical specialist will call you within 1 business hour',
      'We\'ll confirm your preferred appointment time',
      'A licensed electrician will arrive at your home',
      'You\'ll receive a transparent, upfront quote — no surprises',
    ],
  },
  smile: {
    name: 'Smile MakeOver',
    color: '#7c3aed',
    accent: '#8b5cf6',
    icon: '😁',
    phone: '(800) 555-0185',
    nextSteps: [
      'A smile consultant will contact you within 1 business hour',
      'We\'ll schedule your FREE virtual smile consultation',
      'A licensed cosmetic dentist will review your smile goals',
      'You\'ll receive a personalized treatment plan — no obligation',
    ],
  },
}

const DEFAULT_CONFIG = INDUSTRY_CONFIG.hvac

export default function ThankYouContent() {
  const searchParams = useSearchParams()
  const industry = searchParams.get('industry') || ''
  const status = searchParams.get('status') || 'success'

  const config = INDUSTRY_CONFIG[industry.toLowerCase()] || DEFAULT_CONFIG
  const isError = status === 'error'

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; }

        .ty-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        .ty-card {
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.10);
          max-width: 620px;
          width: 100%;
          padding: 56px 48px;
          text-align: center;
        }

        .ty-icon-wrap {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          margin: 0 auto 28px;
        }

        .ty-icon-wrap.success {
          background: #dcfce7;
        }

        .ty-icon-wrap.error {
          background: #fee2e2;
        }

        .ty-checkmark {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: #dcfce7;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px;
        }

        .ty-checkmark svg {
          width: 48px;
          height: 48px;
        }

        .ty-badge {
          display: inline-block;
          padding: 6px 18px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 20px;
          color: #fff;
        }

        .ty-title {
          font-size: 32px;
          font-weight: 800;
          color: #1a1a1a;
          margin-bottom: 14px;
          line-height: 1.2;
        }

        .ty-subtitle {
          font-size: 17px;
          color: #4a5568;
          margin-bottom: 36px;
          line-height: 1.6;
        }

        .ty-steps {
          background: #f8fafc;
          border-radius: 14px;
          padding: 28px 32px;
          text-align: left;
          margin-bottom: 36px;
        }

        .ty-steps h3 {
          font-size: 15px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 18px;
        }

        .ty-step {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        .ty-step:last-child {
          margin-bottom: 0;
        }

        .ty-step-num {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .ty-step-text {
          font-size: 15px;
          color: #374151;
          line-height: 1.5;
        }

        .ty-phone-box {
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .ty-phone-box p {
          font-size: 14px;
          color: #fff;
          opacity: 0.9;
          margin-bottom: 2px;
        }

        .ty-phone-box a {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          text-decoration: none;
          letter-spacing: 0.5px;
        }

        .ty-back-btn {
          display: inline-block;
          padding: 14px 36px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
          transition: opacity 0.2s;
        }

        .ty-back-btn:hover {
          opacity: 0.88;
        }

        .ty-footer {
          margin-top: 32px;
          font-size: 13px;
          color: #94a3b8;
        }

        @media (max-width: 600px) {
          .ty-card { padding: 36px 24px; }
          .ty-title { font-size: 26px; }
          .ty-steps { padding: 20px; }
        }
      `}</style>

      <div className="ty-page">
        <div className="ty-card">

          {isError ? (
            <>
              <div className="ty-icon-wrap error">⚠️</div>
              <div className="ty-badge" style={{ background: '#ef4444' }}>Submission Issue</div>
              <h1 className="ty-title">Something Went Wrong</h1>
              <p className="ty-subtitle">
                We had trouble processing your request. Please try again or call us directly — we&apos;re happy to help.
              </p>
              <div className="ty-phone-box" style={{ background: config.color }}>
                <div>
                  <p>Call us directly</p>
                  <a href={`tel:${config.phone.replace(/\D/g, '')}`}>{config.phone}</a>
                </div>
              </div>
              <a href="javascript:history.back()" className="ty-back-btn" style={{ background: config.color }}>
                ← Try Again
              </a>
            </>
          ) : (
            <>
              <div className="ty-checkmark">
                <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div className="ty-badge" style={{ background: config.color }}>
                {config.icon} {config.name}
              </div>

              <h1 className="ty-title">You&apos;re All Set!</h1>
              <p className="ty-subtitle">
                Thank you for reaching out. Your consultation request has been received and a specialist will be in touch shortly.
              </p>

              <div className="ty-steps">
                <h3>What Happens Next</h3>
                {config.nextSteps.map((step, i) => (
                  <div className="ty-step" key={i}>
                    <div className="ty-step-num" style={{ background: config.color }}>{i + 1}</div>
                    <span className="ty-step-text">{step}</span>
                  </div>
                ))}
              </div>

              <div className="ty-phone-box" style={{ background: config.color }}>
                <div>
                  <p>Need immediate help? Call us now</p>
                  <a href={`tel:${config.phone.replace(/\D/g, '')}`}>{config.phone}</a>
                </div>
              </div>

              <a href="/" className="ty-back-btn" style={{ background: config.accent }}>
                ← Back to {config.name}
              </a>
            </>
          )}

          <p className="ty-footer">
            © {new Date().getFullYear()} {config.name}® · All rights reserved
          </p>
        </div>
      </div>
    </>
  )
}