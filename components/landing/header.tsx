"use client"

import { Phone, Mail } from "lucide-react"
import { IndustryLogo } from "@/components/ui/industry-logo"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <IndustryLogo industry="smile" height={80} priority />
            <div>
              <h1 className="text-xl font-bold text-primary font-serif">
                Smile<span className="text-secondary">Pro</span>
              </h1>
              <p className="text-xs text-muted-foreground">by Ranked CEO</p>
            </div>
          </div>

          {/* Contact Info - Desktop */}
          <div className="hidden md:flex items-center gap-8">
            <a href="mailto:hello@smilepro.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="w-4 h-4 text-secondary" />
              hello@smilepro.com
            </a>
            <a href="tel:1-800-SMILE-PRO" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Talk to our experts</p>
                <p className="text-lg font-bold text-primary">1-800-SMILE-PRO</p>
              </div>
            </a>
          </div>

          {/* CTA Button */}
          <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
            Get Started Free
          </Button>
        </div>
      </div>
    </header>
  )
}
