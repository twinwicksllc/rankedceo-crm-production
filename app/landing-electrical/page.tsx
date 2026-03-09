import './style.css'

export default function ElectricalLandingPage() {
  return (
    <>
      <header className="top-bar">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="logo">
            <img src="/logos/electrical-logo.png" alt="Spark Pro Logo" />
          </div>
          <div className="header-right">
            <p>Speak to a Specialist: <strong>(800) 555-0163</strong></p>
            <div className="header-buttons">
              <a href="#quote">Get Free Quote</a>
              <a href="#pricing" className="secondary">View Pricing</a>
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        <img
          src="/landing-page/electrician_hero.jpg"
          alt="Hero background"
          className="hero-image"
        />

        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-left">
              <div className="rating">⭐ Rated &apos;Excellent&apos; | 750+ Verified Reviews</div>
              <h1><span style={{ fontWeight: 400 }}>Power Your Home</span> — <span style={{ fontWeight: 700 }}>Safely & Affordably</span></h1>
              <h2>Licensed Electrical Repairs & Installations Without the Shocking Bills</h2>
              <p className="hero-paragraph">Spark Pro® connects you with a nationwide network of licensed electricians offering member-only pricing on repairs, panel upgrades, EV charger installations, and emergency services.</p>
              <ul>
                <li>✅ Service Calls From As Low As $59*</li>
                <li>✅ FREE Electrical Safety Inspection</li>
                <li>✅ Member-Only Discounted Pricing</li>
                <li>✅ Flexible Financing on Panel Upgrades</li>
                <li>✅ 24/7 Emergency Electrical Access</li>
              </ul>
            </div>

            <div className="hero-right">
              <div className="testimonial" id="quote">
                <h3>Book Your FREE Electrical Consultation</h3>
                <form method="POST" action="/api/landing/quote">
                  <input type="hidden" name="industry" value="electrical" />
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
                  <button type="submit" className="cta-button">BOOK FREE ELECTRICAL CONSULTATION</button>
                  <p className="form-disclaimer">There is no cost. No obligation. Just clarity on your electrical options.</p>
                </form>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-text">&ldquo;Spark Pro sent a licensed electrician the same day. Fixed our panel issue quickly and safely — at a price that didn&apos;t shock us. Highly recommend!&rdquo;</p>
                <p className="testimonial-author">David K. — via <svg className="google-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="2" y="18" fontSize="12" fontWeight="bold" fill="#4285F4">G</text></svg> Google</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-section">
        <div className="container">
          <h2>Real Repairs. Real Safety. Real Savings.</h2>
          <p className="proof-subtitle">With over 5,000+ electrical jobs completed, our licensed electricians deliver fast, code-compliant work at prices that won&apos;t leave you in the dark.</p>

          <div className="gallery">
            <div className="gallery-item gallery-wide">
              <img
                src="/landing-page/electrical_projects.jpg"
                alt="Electrical Project Results – Before & After"
                className="gallery-image"
              />
            </div>
          </div>

          <p className="gallery-caption">Licensed Electricians. <strong>Code-Compliant Work. Guaranteed Safety.</strong></p>
        </div>
      </section>

      <section className="two-column-section">
        <div className="container">
          <div className="two-column-grid">
            <div className="column">
              <h3>Have You Ever...</h3>
              <ul className="bullet-list">
                <li>Ignored flickering lights or tripping breakers because electricians were too expensive?</li>
                <li>Worried your home&apos;s wiring was a safety hazard?</li>
                <li>Needed an EV charger but couldn&apos;t afford the installation?</li>
                <li>Been quoted thousands for a panel upgrade you couldn&apos;t budget for?</li>
              </ul>
              <p className="column-text">Traditional electrical work can cost thousands with no upfront pricing transparency. Most homeowners delay critical repairs because of cost — not safety awareness.</p>
              <p className="column-bold">That&apos;s where we change the equation.</p>
            </div>

            <div className="column">
              <h3>Safe Electrical Work Should Never Feel Out of Reach</h3>
              <p className="sub-label">Your electrical system impacts:</p>
              <ul className="impact-list">
                <li>Home &amp; family safety</li>
                <li>Energy efficiency &amp; bills</li>
                <li>Property value &amp; insurance</li>
                <li>EV &amp; smart home readiness</li>
                <li>Peace of mind</li>
              </ul>
              <button className="blue-button">BOOK FREE ELECTRICAL CONSULTATION</button>
              <img
                src="/landing-page/electrical_collage.jpg"
                alt="Real Electrical Transformations – Safe, Modern, Efficient"
                className="collage-image"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bottom-cta-bar">
        <div className="container">
          <div className="cta-buttons-row">
            <a href="https://crm.rankedceo.com/login" className="pill-button">🔍 Member Lookup ›</a>
            <a href="https://crm.rankedceo.com/pay?product=electrical-pro-monthly" className="pill-button">⚡ Electrician Sign Up ›</a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <h3>Spark Pro</h3>
              <p>by Ranked CEO</p>
              <p className="desc">Connecting homeowners with licensed electricians nationwide. Affordable, transparent pricing — no surprises, no safety shortcuts.</p>
              <div className="footer-contact">
                <a href="tel:1-800-555-0163">📞 (800) 555-0163</a>
                <a href="mailto:hello@sparkpro.com">✉️ hello@sparkpro.com</a>
                <p>📍 Nationwide Network</p>
              </div>
            </div>
            <div className="footer-col">
              <h4>Services</h4>
              <ul>
                <li><a href="#">Panel Upgrades</a></li>
                <li><a href="#">Wiring Repair</a></li>
                <li><a href="#">EV Charger Install</a></li>
                <li><a href="#">Outlet &amp; Switch</a></li>
                <li><a href="#">Emergency Service</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#">About Us</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Partners</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <ul>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Electrical Guides</a></li>
                <li><a href="#">FAQ</a></li>
                <li><a href="#">Help Center</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">Licensing</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-badges">
            <div className="footer-badge">
              <div className="footer-badge-icon">🛡️</div>
              <div className="footer-badge-text">
                <p>Licensed &amp; Insured</p>
                <p>All electricians verified</p>
              </div>
            </div>
            <div className="footer-badge">
              <div className="footer-badge-icon">⭐</div>
              <div className="footer-badge-text">
                <p>750+ Reviews</p>
                <p>4.9 star rating</p>
              </div>
            </div>
            <div className="footer-badge">
              <div className="footer-badge-icon">💰</div>
              <div className="footer-badge-text">
                <p>Flexible Financing</p>
                <p>0% APR available</p>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} Spark Pro by Ranked CEO. All rights reserved.</p>
            <div className="footer-bottom-badges">
              <span>Licensed Electricians</span>
              <span>Nationwide Network</span>
              <span>Code Compliant Work</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}