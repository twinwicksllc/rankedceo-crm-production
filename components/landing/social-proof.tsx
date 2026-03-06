import { Star } from "lucide-react"

const stats = [
  { value: "5,000+", label: "Dental Practices" },
  { value: "98%", label: "Client Satisfaction" },
  { value: "2M+", label: "Patients Managed" },
  { value: "4.9", label: "Google Rating", isRating: true }
]

const testimonials = [
  {
    quote: "Smile Pro completely transformed how we manage our practice. We've seen a 40% increase in patient retention since switching.",
    author: "Dr. Sarah Johnson",
    practice: "Bright Smile Dental",
    avatar: "SJ"
  },
  {
    quote: "The automated reminders alone have saved us thousands in no-show revenue. Best investment we've made for our practice.",
    author: "Dr. Michael Chen",
    practice: "Family Dental Care",
    avatar: "MC"
  },
  {
    quote: "Finally, a CRM that understands dentistry. The treatment planning feature is incredible and our patients love it.",
    author: "Dr. Emily Rodriguez",
    practice: "Premier Dental Group",
    avatar: "ER"
  }
]

export function SocialProof() {
  return (
    <section className="py-20 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <p className="text-3xl md:text-4xl font-bold text-primary font-serif">
                  {stat.value}
                </p>
                {stat.isRating && (
                  <Star className="w-6 h-6 fill-accent text-accent" />
                )}
              </div>
              <p className="text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 font-serif">
            Real Results. Real Smiles.
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of dental professionals who trust Smile Pro
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-muted/30 rounded-xl p-6 border border-border"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-accent text-accent" />
                ))}
              </div>
              
              <p className="text-foreground mb-6 leading-relaxed italic">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.practice}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Google Reviews Badge */}
        <div className="flex justify-center mt-12">
          <div className="inline-flex items-center gap-3 bg-muted/50 rounded-full px-6 py-3">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-accent text-accent" />
              ))}
            </div>
            <span className="font-medium text-foreground">
              <span className="text-primary font-bold">Google</span> 5-Star Patient Reviews
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
