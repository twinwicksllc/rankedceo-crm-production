import Image from 'next/image'
import './style.css'

export default function LandingPage() {
  return (
    <>
      <header className="top-bar">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logos/smile_makeover.svg" alt="Smile MakeOver Makeover Logo" style={{ height: '40px', width: 'auto' }} />
            <img src="/logos/smile-logo.png" alt="Smile MakeOver Logo" />
          </div>
          <div className="header-right">
            <p>Speak to a Specialist: <strong>(800) 555-0199</strong></p>
            <div className="header-buttons">
              <a href="#quiz">Start Smile Quiz</a>
              <a href="#pricing" className="secondary">View Pricing</a>
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        <Image
          src="/smile_hero_image.png"
          alt="Smile MakeOver hero background"
          fill
          priority
          sizes="100vw"
          className="hero-image"
          quality={85}
        />
        <div className="container hero-container">
          <div className="hero-content">
            <div className="hero-left">
              <div className="rating">⭐ Rated 'Excellent' | 500+ Verified Reviews</div>
              <h1><span style={{ fontWeight: 400 }}>The Smile You Deserve</span> — <span style={{ fontWeight: 700 }}>Now Within Reach</span></h1>
              <h2>Affordable Veneers & Cosmetic Dentistry Without Traditional Insurance</h2>
              <p className="hero-paragraph">Smile MakeOver® gives you access to a nationwide network of verified cosmetic and emergency dentists offering exclusive member-only pricing on veneers, smile makeovers.</p>
              <ul>
                <li>✅ Veneers From As Low As $45/Month*</li>
                <li>✅ FREE Virtual Smile Consultation</li>
                <li>✅ Member-Only Discounted Pricing</li>
                <li>✅ Flexible Financing Available</li>
                <li>✅ Emergency Dental Access</li>
              </ul>
            </div>

            <div className="hero-right">
              <div className="testimonial">
                <h3>Book Your FREE Virtual Smile Consultation</h3>
                <form method="POST" action="/api/landing/quote">
                  <input type="hidden" name="industry" value="smile" />
                  <div className="form-group">
                    <label htmlFor="firstname">First Name</label>
                    <input id="firstname" type="text" name="firstname" placeholder="First Name" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastname">Last Name</label>
                    <input id="lastname" type="text" name="lastname" placeholder="Last Name" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input id="email" type="email" name="email" placeholder="Email Address" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input id="phone" type="tel" name="phone" placeholder="Phone Number" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="zipcode">Zip Code</label>
                    <input id="zipcode" type="text" name="zipcode" placeholder="Zip Code" required />
                  </div>
                  <button type="submit" className="cta-button">BOOK FREE VIRTUAL SMILE CONSULTATION</button>
                  <p className="form-disclaimer">There is no cost. No obligation. Just clarity on your smile options.</p>
                </form>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-text">"The best decision I've ever made for my smile. I thought veneers were financially out of reach – Smile MakeOver made it possible."</p>
                <p className="testimonial-author">Sarah Johnson — via <svg className="google-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <text x="2" y="18" fontSize="12" fontWeight="bold" fill="#4285F4">G</text>
                </svg> Google</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-section">
        <div className="container">
          <h2>Proof You'll See (and Feel) Every Time You Smile</h2>
          <p className="proof-subtitle">With over 1,500+ smile makeover cases completed, our before-and-after results demonstrate the life-changing impact of affordable cosmetic dentistry.</p>
          
          <div className="gallery">
            <div className="gallery-item gallery-wide">
              <Image src="/landing-page/happy_customers.png" alt="Happy customers smiling" width={1200} height={480} />
            </div>
          </div>
          
          <p className="gallery-caption">Real Transformations. <strong>Real Confidence. Real Results.</strong></p>
        </div>
      </section>

      <section className="two-column-section">
        <div className="container">
          <div className="two-column-grid">
            <div className="column">
              <h3>Have You Ever...</h3>
              <ul className="bullet-list">
                <li>Felt embarrassed to smile in photos?</li>
                <li>Covered your mouth when laughing?</li>
                <li>Avoided social or professional opportunities because of your teeth?</li>
                <li>Been told veneers or cosmetic dental work were "too expensive"?</li>
              </ul>
              <p className="column-text">Traditional cosmetic dentistry can cost thousands upfront. Most people delay treatment because of price – not desire.</p>
              <p className="column-bold">That's where we change the equation.</p>
            </div>

            <div className="column">
              <h3>A Confident Smile Should Never Feel Unattainable</h3>
              <p className="sub-label">Your smile impacts:</p>
              <ul className="impact-list">
                <li>Career opportunities</li>
                <li>First Impressions</li>
                <li>Relationships</li>
                <li>Self-confidence</li>
                <li>Social presence</li>
              </ul>
              <button className="cta-button purple-button">BOOK FREE VIRTUAL SMILE CONSULTATION</button>
              <Image src="/landing-page/smile_dental_team.jpg" alt="Smile MakeOver dental team" width={600} height={483} className="lifestyle-image" />
            </div>
          </div>
        </div>
      </section>

      <section className="bottom-cta-bar">
        <div className="container">
          <div className="cta-buttons-row">
            <a href="https://crm.rankedceo.com/login" className="pill-button">🔍 Member Lookup ›</a>
            <a href="https://crm.rankedceo.com/pay?product=smile-pro-monthly" className="pill-button">🦷 Dentist Sign Up ›</a>
          </div>
        </div>
      </section>
    </>
  )
}
