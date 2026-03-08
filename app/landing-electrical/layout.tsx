import './style.css'

export const metadata = {
  title: 'Spark Pro | Licensed Electricians On Demand',
  description: 'Get fast, affordable electrical service from licensed electricians. Membership pricing with no surprise fees.',
  icons: {
    icon: '/icon.svg',
  },
}

export default function LandingElectricalLayout({
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