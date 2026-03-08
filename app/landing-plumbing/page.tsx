import './style.css'

export default function PlumbingLandingPage() {
  return (
    <>
      <header className="top-bar">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="logo">
            <img src="/logos/plumbing-logo.png" alt="Plumb Pro Logo" />
          </div>
          <div className="header-right">
            <p>Speak to a Specialist: <strong>(800) 555-0174</strong></p>
            <div className="header-buttons">
              <a href="#quote">Get Free Quote</a>
              <a href="#pricing" className="secondary">View Pricing</a>
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        <img
          src="/landing-page/plumber_hero.jpg"
          alt="Hero background"
          className="hero-image"
        />

        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-left">
              <div className="rating">⭐ Rated &apos;Excellent&apos; | 900+ Verified Reviews</div>
              <h1><span style={{ fontWeight: 400 }}>Plumbing Problems</span> — <span style={{ fontWeight: 700 }}>Solved Fast</span></h1>
              <h2>Affordable Plumbing Repairs & Installations Without the Surprise Bills</h2>
              <p className="hero-paragraph">Plumb Pro® connects you with a nationwide network of licensed plumbers offering member-only pricing on repairs, drain cleaning, pipe replacements, and emergency services.</p>
              <ul>
                <li>✅ Service Calls From As Low As $39*</li>
                <li>✅ FREE Plumbing Inspection</li>
                <li>✅ Member-Only Discounted Pricing</li>
                <li>✅ Flexible Financing Available</li>
                <li>✅ 24/7 Emergency Plumbing Access</li>
              </ul>
            </div>

            <div className="hero-right">
              <div className="testimonial" id="quote">
                <h3>Book Your FREE Plumbing Consultation</h3>
                <form method="POST" action="/api/landing/quote">
                  <input type="hidden" name="industry" value="plumbing" />
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
                  <button type="submit" className="cta-button">BOOK FREE PLUMBING CONSULTATION</button>
                  <p className="form-disclaimer">There is no cost. No obligation. Just clarity on your plumbing options.</p>
                </form>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-text">&ldquo;Burst pipe at midnight and Plumb Pro had someone here within the hour. Saved my basement and my wallet. These guys are the real deal.&rdquo;</p>
                <p className="testimonial-author">Jennifer R. — via <svg className="google-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="2" y="18" fontSize="12" fontWeight="bold" fill="#4285F4">G</text></svg> Google</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-section">
        <div className="container">
          <h2>Real Fixes. Real Results. Real Savings.</h2>
          <p className="proof-subtitle">With over 6,000+ plumbing jobs completed, our licensed plumbers deliver fast, reliable service at prices that won&apos;t drain your bank account.</p>

          <div className="gallery">
            <div className="gallery-item gallery-wide">
              <img
                src="/landing-page/plumbing_projects.jpg"
                alt="Plumbing Project Results – Before & After"
                className="gallery-image"
              />
            </div>
          </div>

          <p className="gallery-caption">Licensed Plumbers. <strong>Guaranteed Work. Transparent Pricing.</strong></p>
        </div>
      </section>

      <section className="two-column-section">
        <div className="container">
          <div className="two-column-grid">
            <div className="column">
              <h3>Have You Ever...</h3>
              <ul className="bullet-list">
                <li>Dealt with a leaky pipe for months because repair quotes were too high?</li>
                <li>Had a plumber no-show and leave you stranded?</li>
                <li>Been charged a fortune just for someone to show up?</li>
                <li>Ignored a slow drain until it became a full blockage?</li>
              </ul>
              <p className="column-text">Traditional plumbing service can cost hundreds just for a diagnostic visit. Most homeowners delay repairs because of cost — not necessity.</p>
              <p className="column-bold">That&apos;s where we change the equation.</p>
            </div>

            <div className="column">
              <h3>Reliable Plumbing Should Never Feel Out of Reach</h3>
              <p className="sub-label">Your plumbing impacts:</p>
              <ul className="impact-list">
                <li>Home safety &amp; water quality</li>
                <li>Monthly utility bills</li>
                <li>Property value</li>
                <li>Family health &amp; hygiene</li>
                <li>Peace of mind</li>
              </ul>
              <button className="blue-button">BOOK FREE PLUMBING CONSULTATION</button>
              <img
                src="/landing-page/plumbing_collage.jpg"
                alt="Real Plumbing Transformations – Clean, Reliable, Professional"
                className="collage-image"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bottom-cta-bar">
        <div className="container">
          <div className="cta-buttons-row">
            <button className="pill-button">🔍 Member Lookup ›</button>
            <button className="pill-button">🔧 Plumber Sign Up ›</button>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <h3>Plumb Pro</h3>
              <p>by Ranked CEO</p>
              <p className="desc">Connecting homeowners with licensed plumbers nationwide. Affordable, transparent pricing — no surprises, no leaks in your budget.</p>
              <div className="footer-contact">
                <a href="tel:1-800-555-0174">📞 (800) 555-0174</a>
                <a href="mailto:hello@plumbpro.com">✉️ hello@plumbpro.com</a>
                <p>📍 Nationwide Network</p>
              </div>
            </div>
            <div className="footer-col">
              <h4>Services</h4>
              <ul>
                <li><a href="#">Drain Cleaning</a></li>
                <li><a href="#">Pipe Repair</a></li>
                <li><a href="#">Water Heaters</a></li>
                <li><a href="#">Leak Detection</a></li>
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
                <li><a href="#">Plumbing Guides</a></li>
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
                <p>All plumbers verified</p>
              </div>
            </div>
            <div className="footer-badge">
              <div className="footer-badge-icon">⭐</div>
              <div className="footer-badge-text">
                <p>900+ Reviews</p>
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
            <p>© {new Date().getFullYear()} Plumb Pro by Ranked CEO. All rights reserved.</p>
            <div className="footer-bottom-badges">
              <span>Licensed Plumbers</span>
              <span>Nationwide Network</span>
              <span>Satisfaction Guaranteed</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}