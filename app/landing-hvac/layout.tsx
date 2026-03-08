import './style.css'

export const metadata = {
  title: 'HVAC Pro | Heating, Cooling & Air Quality Experts',
  description: 'Get fast, affordable HVAC service from certified technicians. Membership pricing with no surprise fees.',
  icons: {
    icon: '/icon.svg',
  },
}

export default function LandingHvacLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}