import { Phone, Mail, MapPin } from "lucide-react"

const footerLinks = {
  Product: ["Features", "Pricing", "Integrations", "Security", "Updates"],
  Company: ["About Us", "Careers", "Press", "Partners", "Contact"],
  Resources: ["Blog", "Guides", "Case Studies", "Webinars", "Help Center"],
  Legal: ["Privacy Policy", "Terms of Service", "HIPAA Compliance", "BAA"]
}

export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Logo & Contact */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 4C20 4 17 7 16 10C15 7 12 4 8 4C4 4 1 8 1 14C1 24 12 32 24 44C36 32 47 24 47 14C47 8 44 4 40 4C36 4 33 7 32 10C31 7 28 4 24 4Z" fill="oklch(0.55 0.15 195)" />
                  <path d="M24 10C22 10 20 12 20 15C20 18 22 20 24 20C26 20 28 18 28 15C28 12 26 10 24 10Z" fill="oklch(0.2 0.02 240)" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-background font-serif">
                  Smile<span className="text-secondary">Pro</span>
                </h3>
                <p className="text-xs text-background/60">by Ranked CEO</p>
              </div>
            </div>
            
            <p className="text-background/70 text-sm mb-6 max-w-xs">
              The #1 CRM built specifically for dental practices. Manage, grow, and transform your practice.
            </p>
            
            <div className="space-y-3">
              <a href="tel:1-800-SMILE-PRO" className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors">
                <Phone className="w-4 h-4" />
                1-800-SMILE-PRO
              </a>
              <a href="mailto:hello@smilepro.com" className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors">
                <Mail className="w-4 h-4" />
                hello@smilepro.com
              </a>
              <p className="flex items-center gap-2 text-sm text-background/70">
                <MapPin className="w-4 h-4" />
                San Francisco, CA
              </p>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-background mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a 
                      href="#" 
                      className="text-sm text-background/60 hover:text-background transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-background/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-background/60">
            © {new Date().getFullYear()} Smile Pro by Ranked CEO. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-background/40">HIPAA Compliant</span>
            <span className="text-xs text-background/40">SOC 2 Type II</span>
            <span className="text-xs text-background/40">256-bit SSL</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
