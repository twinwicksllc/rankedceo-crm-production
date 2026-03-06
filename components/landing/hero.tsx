"use client"

import { useState } from "react"
import Image from "next/image"
import { Star, CheckCircle2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function Hero() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    practiceSize: "",
    timeline: ""
  })

  const benefits = [
    "Unlimited patient records & management",
    "FREE onboarding & training session",
    "FREE data migration from your current system",
    "24/7 Priority support (Worth $299/mo)*"
  ]

  return (
    <section className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/90 overflow-hidden">
      {/* Background Image */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-[50%] pointer-events-none">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/generated-image.png-hGcIEsVe0tbCYtvlkaFCW9ad1gluW1.jpeg"
          alt="Smiling woman with beautiful teeth"
          fill
          className="object-contain object-top opacity-60 lg:opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/50" />
      </div>
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-white text-center lg:text-left">
            {/* Rating Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 mx-auto lg:mx-0">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <span className="text-sm font-medium">
                Rated as <span className="font-bold">{'"Excellent"'}</span> (2,847 Reviews)
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 font-serif text-balance">
              The #1 CRM Built for
              <span className="block text-accent">Dental Practices</span>
            </h1>

            <p className="text-lg text-white/80 mb-8 max-w-xl leading-relaxed mx-auto lg:mx-0">
              With Smile Pro, you&apos;ll transform how you manage patients, automate appointments, and grow your practice — all in one powerful platform.
            </p>

            {/* Benefits List */}
            <ul className="space-y-3 mb-8 inline-block text-left">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                  <span className="text-white/90">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Testimonial */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 max-w-md mx-auto lg:mx-0">
              <p className="text-white/90 italic mb-4">
                &ldquo;They didn&apos;t just give us software, they guided us through every step <span className="font-semibold text-white">until we had the perfect system for our practice.&rdquo;</span>
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
                  DR
                </div>
                <div>
                  <p className="font-semibold text-white">Dr. Rachel Mitchell</p>
                  <p className="text-xs text-white/60">Mitchell Family Dentistry</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-xs text-white/60">Google</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-accent text-accent" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Lead Capture Form */}
          <div className="bg-card rounded-2xl shadow-2xl p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Limited Time Offer
            </div>

            <div className="text-center mb-6 mt-4">
              <h2 className="text-xl font-bold text-foreground mb-2">
                Book Your Free, No Obligation
              </h2>
              <p className="text-2xl font-bold text-primary font-serif">
                Smile Pro Demo
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Reserve your demo <span className="text-secondary font-semibold">(worth $500)</span> & see if Smile Pro is right for you.
              </p>
            </div>

            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">
                  Full Name *
                </Label>
                <Input
                  id="name"
                  placeholder="Dr. John Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@yourpractice.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">
                  How many dentists in your practice? *
                </Label>
                <Select
                  value={formData.practiceSize}
                  onValueChange={(value) => setFormData({ ...formData, practiceSize: value })}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Please Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Solo Practice)</SelectItem>
                    <SelectItem value="2-5">2-5 Dentists</SelectItem>
                    <SelectItem value="6-10">6-10 Dentists</SelectItem>
                    <SelectItem value="10+">10+ Dentists</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">
                  How soon do you want to get started? *
                </Label>
                <Select
                  value={formData.timeline}
                  onValueChange={(value) => setFormData({ ...formData, timeline: value })}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Please Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediately">Immediately</SelectItem>
                    <SelectItem value="1-month">Within 1 Month</SelectItem>
                    <SelectItem value="3-months">Within 3 Months</SelectItem>
                    <SelectItem value="exploring">Just Exploring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold py-6 text-lg"
              >
                Get My FREE Demo
                <Sparkles className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By clicking above, you agree to our Terms & Privacy Policy
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
