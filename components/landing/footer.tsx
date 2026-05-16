import { Phone, Mail, MapPin, Users, Stethoscope, Shield, FileText } from "lucide-react"

const footerLinks: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: "Features", href: "#" },
    { label: "Pricing", href: "#" },
    { label: "Membership", href: "#" },
    { label: "Financing", href: "#" },
  ],
  Company: [
    { label: "About Us", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Press", href: "#" },
    { label: "Partners", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Resources: [
    { label: "Blog", href: "#" },
    { label: "Guides", href: "#" },
    { label: "Before & After Gallery", href: "#" },
    { label: "FAQ", href: "#" },
    { label: "Help Center", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "HIPAA Compliance", href: "#" },
    { label: "BAA", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer className="bg-[#243b6b] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Quick Access Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
          <a
            href="#"
            className="flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-6 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-[#5a67d8] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg">Member Lookup</h3>
              <p className="text-sm text-white/70">Access your membership</p>
            </div>
          </a>
          <a
            href="#"
            className="flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-6 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-[#5a67d8] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg">Dentist Sign Up</h3>
              <p className="text-sm text-white/70">Join our network</p>
            </div>
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Logo & Contact */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#5a67d8] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                  <path d="M12 2C8 2 5 5 4 8C3 5 0 2 0 2C0 2 0 8 0 14C0 22 8 26 12 30C16 26 24 22 24 14C24 8 24 2 24 2C24 2 21 5 20 8C19 5 16 2 12 2Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold font-serif">
                  Smile<span className="text-[#5a67d8]">MakeOver</span>
                </h3>
                <p className="text-xs text-white/60">Affordable Veneers & Cosmetic Dentistry</p>
              </div>
            </div>

            <p className="text-white/70 text-sm mb-6 max-w-xs">
              Transform your smile with affordable, membership-based cosmetic dentistry without traditional insurance.
            </p>

            <div className="space-y-3">
              <a href="tel:1-800-555-SMILE" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                <Phone className="w-4 h-4" />
                (800) 555-SMILE
              </a>
              <a href="mailto:hello@smilemakeover.com" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
                hello@smilemakeover.com
              </a>
              <p className="flex items-center gap-2 text-sm text-white/70">
                <MapPin className="w-4 h-4" />
                Nationwide Network
              </p>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-white mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="flex items-center gap-3 bg-white/5 rounded-lg p-4">
            <Shield className="w-8 h-8 text-[#5a67d8] flex-shrink-0" />
            <div>
              <p className="font-semibold text-white">HIPAA Compliant</p>
              <p className="text-xs text-white/60">Your data is secure</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 rounded-lg p-4">
            <FileText className="w-8 h-8 text-[#5a67d8] flex-shrink-0" />
            <div>
              <p className="font-semibold text-white">Verified Dentists</p>
              <p className="text-xs text-white/60">Licensed professionals</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 rounded-lg p-4">
            <Users className="w-8 h-8 text-[#5a67d8] flex-shrink-0" />
            <div>
              <p className="font-semibold text-white">500+ Reviews</p>
              <p className="text-xs text-white/60">4.9 star rating</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/60">
            © {new Date().getFullYear()} RankedCEO LLC. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-xs text-white/50 hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms" className="text-xs text-white/50 hover:text-white transition-colors">Terms of Service</a>
            <span className="text-xs text-white/40">Nationwide Network</span>
          </div>
        </div>
      </div>
    </footer>
  )
}