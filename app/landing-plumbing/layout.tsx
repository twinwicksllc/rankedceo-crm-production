import './style.css'

export const metadata = {
  title: 'Plumb Pro | Fast, Affordable Plumbing Services',
  description: 'Get fast, affordable plumbing service from licensed plumbers. Membership pricing with no surprise fees.',
  icons: {
    icon: '/icon.svg',
  },
}

export default function LandingPlumbingLayout({
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