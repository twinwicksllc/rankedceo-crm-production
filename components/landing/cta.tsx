import { Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-primary via-primary/95 to-primary/90 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 right-20 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-20 w-80 h-80 bg-secondary rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-white text-sm font-medium">Limited Time: 30% Off First 3 Months</span>
        </div>

        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-serif text-balance">
          Ready to Transform Your Dental Practice?
        </h2>
        
        <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto leading-relaxed">
          Join 5,000+ dental professionals who are growing their practices with Smile Pro. Get started in minutes with our free 14-day trial.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-8 py-6 text-lg"
          >
            See If You Qualify
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button 
            size="lg"
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white font-semibold px-8 py-6 text-lg"
          >
            Schedule a Demo
          </Button>
        </div>

        <p className="text-white/60 text-sm mt-6">
          No credit card required • Free 14-day trial • Cancel anytime
        </p>
      </div>
    </section>
  )
}
