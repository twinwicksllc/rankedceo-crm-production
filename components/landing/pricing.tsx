import { CheckCircle2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

const plans = [
  {
    name: "Starter",
    price: "199",
    period: "/month",
    description: "Perfect for solo practitioners",
    features: [
      "Up to 1,000 patient records",
      "Smart scheduling",
      "Basic analytics",
      "Email support",
      "HIPAA compliant"
    ],
    popular: false
  },
  {
    name: "Professional",
    price: "399",
    period: "/month",
    description: "For growing practices",
    features: [
      "Unlimited patient records",
      "Advanced scheduling & waitlist",
      "Full analytics suite",
      "SMS & email campaigns",
      "Priority support",
      "Treatment planning",
      "Online booking portal"
    ],
    popular: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For multi-location practices",
    features: [
      "Everything in Professional",
      "Multi-location support",
      "Custom integrations",
      "Dedicated account manager",
      "On-site training",
      "Custom reporting",
      "API access"
    ],
    popular: false
  }
]

export function Pricing() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 font-serif">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No hidden fees. No long-term contracts. Cancel anytime.
          </p>
          <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary rounded-full px-4 py-2 mt-4">
            <Sparkles className="w-4 h-4" />
            <span className="font-semibold">0% Financing Available</span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`relative bg-card rounded-2xl p-8 border ${
                plan.popular 
                  ? "border-secondary shadow-xl scale-105" 
                  : "border-border shadow-sm"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {plan.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline justify-center gap-1">
                  {plan.price !== "Custom" && (
                    <span className="text-2xl text-muted-foreground">$</span>
                  )}
                  <span className="text-5xl font-bold text-primary font-serif">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className={`w-full font-semibold ${
                  plan.popular 
                    ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground" 
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
              >
                {plan.price === "Custom" ? "Contact Sales" : "Start Free Trial"}
              </Button>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center gap-8 mt-16 text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-secondary" />
            <span>14-day free trial</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-secondary" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-secondary" />
            <span>Free data migration</span>
          </div>
        </div>
      </div>
    </section>
  )
}
