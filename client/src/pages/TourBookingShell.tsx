import type { ReactNode } from "react";
import "./tourBooking.css";

const SITE = "https://freehomesearchutah.com";

/** Tour booking pages are reached from FreeHomeSearchUtah.com, so they wear that site's header and footer. */
export default function TourBookingShell({ children }: { children: ReactNode }) {
  return (
    <div className="fhsu-booking">
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Heebo:wght@400;500;600&display=swap"
      />
      <div className="fb-topbar">
        <div className="fb-wrap">
          <a href="tel:+18016289400">Scott · 801-628-9400</a>
          <a href="tel:+18016038418">Cameron · 801-603-8418</a>
        </div>
      </div>
      <header className="fb-header">
        <div className="fb-wrap">
          <a href={SITE} aria-label="FreeHomeSearchUtah.com home">
            <img src={`${SITE}/assets/img/fhsu-logo.svg`} alt="FreeHomeSearchUtah.com" width={178} height={58} />
          </a>
        </div>
      </header>
      <main className="fb-main">
        <div className="fb-column">{children}</div>
      </main>
      <footer className="fb-footer">
        <div className="fb-wrap">
          <img src={`${SITE}/assets/img/equity-logo-white.png`} alt="Equity Real Estate" width={113} height={46} />
          <div>
            <p><strong>Scott &amp; Cameron Boerstra</strong>, Equity Real Estate, Ogden, Utah</p>
            <p>Scott: Lic# 5452345-SA00 · Cameron: Lic# 9561623-SA00</p>
            <p>Equal Housing Opportunity · <a href={`${SITE}/privacy.html`}>Privacy Policy</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
