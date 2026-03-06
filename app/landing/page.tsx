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
        <div className="container">
          <div className="hero-content">
            <div className="hero-left">
              <div className="rating">★★★★★ 500+ Happy Patients</div>
              <h1>A Brand New Smile, <br />For Less Than You Think.</h1>
              <h2>Premium cosmetic dentistry tailored to your budget. Get the confidence you deserve today.</h2>
              <ul>
                <li>Stain-resistant, natural-looking veneers</li>
                <li>0% Interest financing available</li>
                <li>Completed in as little as 2 visits</li>
                <li>Lifetime satisfaction guarantee</li>
              </ul>
            </div>

            <div className="hero-right">
              <div className="testimonial">
                <h3>Get Your Free Estimate</h3>
                <form method="POST" action="/api/landing/quote">
                  <div className="form-group">
                    <label htmlFor="fullname">Full Name</label>
                    <input id="fullname" type="text" name="fullname" placeholder="Full Name" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input id="email" type="email" name="email" placeholder="Email Address" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input id="phone" type="tel" name="phone" placeholder="Phone Number" required />
                  </div>
                  <button type="submit" className="cta-button">GET MY FREE QUOTE</button>
                </form>
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
