"use client"

import { Phone, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 4C20 4 17 7 16 10C15 7 12 4 8 4C4 4 1 8 1 14C1 24 12 32 24 44C36 32 47 24 47 14C47 8 44 4 40 4C36 4 33 7 32 10C31 7 28 4 24 4Z" fill="oklch(0.45 0.12 230)" />
                <path d="M24 10C22 10 20 12 20 15C20 18 22 20 24 20C26 20 28 18 28 15C28 12 26 10 24 10Z" fill="white" />
                <path d="M16 16C15 16 14 17 14 18.5C14 20 15 21 16 21C17 21 18 20 18 18.5C18 17 17 16 16 16Z" fill="white" />
                <path d="M32 16C31 16 30 17 30 18.5C30 20 31 21 32 21C33 21 34 20 34 18.5C34 17 33 16 32 16Z" fill="white" />
              </svg>
            </div>
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
