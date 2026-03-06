import { 
  Users, 
  Calendar, 
  TrendingUp, 
  MessageSquare, 
  FileText, 
  Shield,
  CheckCircle2
} from "lucide-react"

const features = [
  {
    icon: Users,
    title: "Patient Management",
    description: "Complete patient profiles with treatment history, notes, and automated follow-ups.",
    benefits: ["Unlimited records", "Smart search", "Family linking"]
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Intelligent appointment booking with automated reminders and waitlist management.",
    benefits: ["Online booking", "SMS reminders", "No-show reduction"]
  },
  {
    icon: TrendingUp,
    title: "Practice Analytics",
    description: "Real-time insights into revenue, patient retention, and treatment acceptance rates.",
    benefits: ["Revenue tracking", "KPI dashboards", "Growth reports"]
  },
  {
    icon: MessageSquare,
    title: "Patient Communication",
    description: "Automated SMS, email campaigns, and review requests to keep patients engaged.",
    benefits: ["Two-way texting", "Review automation", "Email campaigns"]
  },
  {
    icon: FileText,
    title: "Treatment Planning",
    description: "Visual treatment plans with integrated payment options and financing.",
    benefits: ["Visual plans", "E-signatures", "Payment plans"]
  },
  {
    icon: Shield,
    title: "HIPAA Compliant",
    description: "Enterprise-grade security with full HIPAA compliance and data encryption.",
    benefits: ["256-bit encryption", "Audit logs", "BAA included"]
  }
]

export function Features() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 font-serif text-balance">
            Everything You Need to{" "}
            <span className="text-primary">Grow Your Practice</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Smile Pro combines all the tools dental practices need into one seamless platform — no more juggling multiple systems.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-lg transition-shadow group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              
              <h3 className="text-xl font-bold text-foreground mb-2">
                {feature.title}
              </h3>
              
              <p className="text-muted-foreground mb-4 leading-relaxed">
                {feature.description}
              </p>
              
              <ul className="space-y-2">
                {feature.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0" />
                    <span className="text-muted-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
