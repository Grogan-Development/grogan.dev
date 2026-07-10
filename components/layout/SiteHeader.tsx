"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Container } from "./Container";
import { Button } from "./Button";
import { MOBILE_NAV_LINKS, NAV_LINKS, PRIMARY_CTA, SITE } from "@/lib/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-sm transition-shadow duration-200 ${
        scrolled
          ? "shadow-[var(--elevation-header)]"
          : "shadow-none"
      }`}
    >
      <Container className="flex items-center justify-between gap-4 py-2.5 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          className="inline-flex min-h-[var(--tap-min)] shrink-0 items-center lg:justify-self-start"
          aria-label={SITE.shortName}
          onClick={() => setOpen(false)}
        >
          <span aria-hidden className="font-display text-[length:var(--text-h3)] text-ink lg:hidden">
            {SITE.mark}
          </span>
          <span aria-hidden className="hidden font-display text-[length:var(--text-h3)] text-ink lg:inline">
            {SITE.shortName}
          </span>
        </Link>

        <nav
          className="hidden items-center lg:flex lg:justify-self-center"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`inline-flex min-h-[var(--tap-min)] items-center px-2.5 font-sans text-[length:var(--text-small)] transition-colors hover:text-ink ${
                pathname === link.href ? "text-ink underline decoration-accent underline-offset-4" : "text-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 lg:justify-self-end">
          <span className="hidden lg:contents">
            <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
          </span>

          <button
            type="button"
            className="inline-flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center border border-control bg-surface text-ink lg:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="relative block h-3.5 w-5">
              <span
                className={`absolute left-0 block h-0.5 w-full bg-ink transition-transform ${
                  open ? "top-1.5 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 block h-0.5 w-full bg-ink transition-opacity ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 block h-0.5 w-full bg-ink transition-transform ${
                  open ? "top-1.5 -rotate-45" : "top-3"
                }`}
              />
            </span>
          </button>
        </div>
      </Container>

      {open ? (
        <nav
          id={panelId}
          className="border-t border-line bg-surface lg:hidden"
          aria-label="Mobile"
        >
          <Container className="flex flex-col gap-1 py-4">
            {MOBILE_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="inline-flex min-h-[var(--tap-min)] items-center font-sans text-[length:var(--text-body)] text-ink"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 border-t border-line pt-4">
              <Button href={PRIMARY_CTA.href} className="w-full" onClick={() => setOpen(false)}>
                {PRIMARY_CTA.label}
              </Button>
            </div>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
