import Link from "next/link";
import { cities } from "@/content/cities";
import { Container } from "./Container";
import { NAV_LINKS, SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface py-14">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-[length:var(--text-h3)] text-ink">{SITE.name}</p>
            <p className="mt-3 max-w-md font-sans text-[length:var(--text-small)] text-muted">
              {SITE.serviceLine}
            </p>
            <address className="mt-5 not-italic font-sans text-[length:var(--text-small)] text-muted">
              <p>
                {SITE.address.locality}, {SITE.address.region}
              </p>
              <p className="mt-1">
                <a href={`mailto:${SITE.email}`} className="text-ink hover:text-accent">
                  {SITE.email}
                </a>
              </p>
              {SITE.phone ? (
                <p className="mt-1">
                  <a href={`tel:${SITE.phone.replace(/\D/g, "")}`} className="text-ink hover:text-accent">
                    {SITE.phone}
                  </a>
                </p>
              ) : null}
              <p className="mt-1">{SITE.domain}</p>
              <p className="mt-2">Serving the {SITE.region}.</p>
            </address>
          </div>

          <div>
            <p className="font-mono text-[length:var(--text-label)] font-medium uppercase tracking-wider text-ink">
              Service area
            </p>
            <ul className="mt-3 space-y-1">
              {cities.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/tri-cities/${city.slug}`}
                    className="inline-flex min-h-[var(--tap-min)] items-center font-sans text-[length:var(--text-small)] text-muted hover:text-ink"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/tri-cities"
                  className="inline-flex min-h-[var(--tap-min)] items-center font-sans text-[length:var(--text-small)] text-muted hover:text-ink"
                >
                  All Tri-Cities
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-[length:var(--text-label)] font-medium uppercase tracking-wider text-ink">
              Explore
            </p>
            <nav className="mt-3 flex flex-col" aria-label="Footer">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-[var(--tap-min)] items-center font-sans text-[length:var(--text-small)] text-muted hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </Container>
    </footer>
  );
}
