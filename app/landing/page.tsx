import Image from 'next/image'
import './style.css'

export default function LandingPage() {
  return (
    <>
      <header className="top-bar">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="logo">
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
                <p className="form-disclaimer">There is no cost. No obligation. Just clarity on your smile options.</p>
                <form method="POST" action="/api/landing/quote">
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

      <section className="features">
        <div className="container">
          <h2>Why Choose Smile MakeOver?</h2>
          <div className="features-grid">
            <div className="feature-item">
              <h4>Expert Surgeons</h4>
              <p>Our team consists of top-tier cosmetic specialists with decades of experience.</p>
            </div>
            <div className="feature-item">
              <h4>Modern Technology</h4>
              <p>We use 3D imaging to preview your smile before we even begin.</p>
            </div>
            <div className="feature-item">
              <h4>Affordable Plans</h4>
              <p>Luxury smiles shouldn't be for the 1%. We offer plans for every budget.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
