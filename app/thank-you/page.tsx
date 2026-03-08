import { Suspense } from 'react'
import ThankYouContent from './ThankYouContent'

export default function ThankYouPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f0f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <ThankYouContent />
    </Suspense>
  )
}