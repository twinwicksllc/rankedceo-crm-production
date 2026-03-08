import Image from 'next/image'
import './style.css'

export default function HvacLandingPage() {
  return (
    <>
      <header className="top-bar">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="logo">
            <img src="/logos/hvac-logo.png" alt="HVAC Pro Logo" />
          </div>
          <div className="header-right">
            <p>Speak to a Specialist: <strong>(800) 555-0182</strong></p>
            <div className="header-buttons">
              <a href="#quote">Get Free Quote</a>
              <a href="#pricing" className="secondary">View Pricing</a>
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        {/* Placeholder hero image — replace with real HVAC photo */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '47%',
          height: '68%',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563b0 50%, #60a5fa 100%)',
          zIndex: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '16px',
          fontWeight: 600,
        }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
            <path d="M12 6v6l4 2"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Hero Image Placeholder
        </div>

        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-left">
              <div className="rating">⭐ Rated &apos;Excellent&apos; | 1,200+ Verified Reviews</div>
              <h1><span style={{ fontWeight: 400 }}>Comfort You Can Count On</span> — <span style={{ fontWeight: 700 }}>Year Round</span></h1>
              <h2>Affordable HVAC Service, Repairs & Installations Without the Surprise Bills</h2>
              <p className="hero-paragraph">HVAC Pro® connects you with a nationwide network of certified heating and cooling technicians offering member-only pricing on repairs, tune-ups, and full system replacements.</p>
              <ul>
                <li>✅ Service Calls From As Low As $49*</li>
                <li>✅ FREE System Diagnostic Consultation</li>
                <li>✅ Member-Only Discounted Pricing</li>
                <li>✅ Flexible Financing on Installations</li>
                <li>✅ 24/7 Emergency HVAC Access</li>
              </ul>
            </div>

            <div className="hero-right">
              <div className="testimonial" id="quote">
                <h3>Book Your FREE HVAC Consultation</h3>
                <form method="POST" action="/api/landing/quote">
                  <input type="hidden" name="industry" value="hvac" />
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
                  <button type="submit" className="cta-button">BOOK FREE HVAC CONSULTATION</button>
                  <p className="form-disclaimer">There is no cost. No obligation. Just clarity on your HVAC options.</p>
                </form>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-text">&ldquo;Our AC went out in July and HVAC Pro had a technician at our door within 2 hours. Fixed same day, half the price I expected. Incredible service.&rdquo;</p>
                <p className="testimonial-author">Mike T. — via <svg className="google-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="2" y="18" fontSize="12" fontWeight="bold" fill="#4285F4">G</text></svg> Google</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-section">
        <div className="container">
          <h2>Real Repairs. Real Results. Real Savings.</h2>
          <p className="proof-subtitle">With over 8,000+ HVAC jobs completed, our certified technicians deliver fast, reliable service at prices that won&apos;t break the bank.</p>

          <div className="gallery">
            <div className="gallery-item gallery-wide">
              <img
                src="/landing-page/hvac_projects.jpg"
                alt="HVAC Project Results – Before & After"
                className="gallery-image"
              />
            </div>
          </div>

          <p className="gallery-caption">Certified Technicians. <strong>Guaranteed Work. Unbeatable Prices.</strong></p>
        </div>
      </section>

      <section className="two-column-section">
        <div className="container">
          <div className="two-column-grid">
            <div className="column">
              <h3>Have You Ever...</h3>
              <ul className="bullet-list">
                <li>Sweated through a summer because you couldn&apos;t afford AC repair?</li>
                <li>Gotten a quote so high you just gave up?</li>
                <li>Waited days for a technician who never showed?</li>
                <li>Been told your system needs full replacement when it just needed a tune-up?</li>
              </ul>
              <p className="column-text">Traditional HVAC service can cost thousands with no transparency on pricing. Most homeowners delay repairs because of cost — not comfort.</p>
              <p className="column-bold">That&apos;s where we change the equation.</p>
            </div>

            <div className="column">
              <h3>Your Comfort Should Never Feel Out of Reach</h3>
              <p className="sub-label">Your HVAC system impacts:</p>
              <ul className="impact-list">
                <li>Home comfort year-round</li>
                <li>Indoor air quality &amp; health</li>
                <li>Energy bills &amp; efficiency</li>
                <li>Home resale value</li>
                <li>Family safety in extreme weather</li>
              </ul>
              <button className="blue-button">BOOK FREE HVAC CONSULTATION</button>
              <img
                src="/landing-page/hvac_collage.jpg"
                alt="Real HVAC Transformations – Real Comfort, Real Results"
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
            <button className="pill-button">🔧 Technician Sign Up ›</button>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <h3>HVAC Pro</h3>
              <p>by Ranked CEO</p>
              <p className="desc">Connecting homeowners with certified HVAC technicians nationwide. Affordable, transparent pricing — no surprises.</p>
              <div className="footer-contact">
                <a href="tel:1-800-555-0182">📞 (800) 555-0182</a>
                <a href="mailto:hello@hvacpro.com">✉️ hello@hvacpro.com</a>
                <p>📍 Nationwide Network</p>
              </div>
            </div>
            <div className="footer-col">
              <h4>Services</h4>
              <ul>
                <li><a href="#">AC Repair</a></li>
                <li><a href="#">Heating Repair</a></li>
                <li><a href="#">System Installation</a></li>
                <li><a href="#">Tune-Ups</a></li>
                <li><a href="#">Air Quality</a></li>
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
                <li><a href="#">HVAC Guides</a></li>
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
                <p>All technicians verified</p>
              </div>
            </div>
            <div className="footer-badge">
              <div className="footer-badge-icon">⭐</div>
              <div className="footer-badge-text">
                <p>1,200+ Reviews</p>
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
            <p>© {new Date().getFullYear()} HVAC Pro by Ranked CEO. All rights reserved.</p>
            <div className="footer-bottom-badges">
              <span>Licensed Technicians</span>
              <span>Nationwide Network</span>
              <span>Satisfaction Guaranteed</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}