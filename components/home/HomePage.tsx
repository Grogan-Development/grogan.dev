import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/layout/Button";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/layout/Card";
import { Reveal } from "@/components/ui/Reveal";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/lib/site";
import { industryImageSrc, SITE_IMAGES } from "@/lib/images";
import {
  painPoints,
  systemsBuilt,
  offerTiers,
  whyGdgCopy,
  industryHomeBlurbs,
} from "@/content/home";
import { industries } from "@/content/industries";
import { examples } from "@/content/examples";

const industryCaptions: Record<string, string> = {
  "contractors-home-services": "Job site",
  "manufacturing-fabrication": "Shop floor",
  "sign-print-wrap-cnc-shops": "Wrap bay",
  "wineries-events-hospitality": "Vineyard",
  "professional-offices": "Office desk",
  "local-service-businesses": "Service van",
};

function HeroCollage() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <Image
        src={SITE_IMAGES.hero}
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 55vw"
        className="object-cover object-center"
      />
      {/* Soft wash so CSS UI collage stays readable as product proof */}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,oklch(0.97_0.01_85_/_0.72),oklch(0.94_0.01_85_/_0.55)_45%,oklch(0.92_0.015_85_/_0.68))]" />
      <div
        className="absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 23px, oklch(0.86 0.01 85 / 0.45) 23px, oklch(0.86 0.01 85 / 0.45) 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, oklch(0.86 0.01 85 / 0.35) 23px, oklch(0.86 0.01 85 / 0.35) 24px)",
        }}
      />

      {/* Quote form — large left plane */}
      <div className="absolute left-[2%] top-[4%] z-10 w-[72%] border border-line bg-surface p-3 shadow-[0_12px_40px_oklch(0.22_0.02_250_/_0.08)] sm:left-[3%] sm:top-[3%] sm:w-[64%] sm:p-4">
        <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
          <span className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
            Quote request
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-2/3 bg-surface-alt" />
          <div className="h-7 border border-line bg-paper" />
          <div className="h-2 w-1/2 bg-surface-alt" />
          <div className="h-7 border border-line bg-paper" />
          <div className="h-2 w-2/5 bg-surface-alt" />
          <div className="h-7 border border-line bg-paper" />
          <div className="mt-3 flex gap-2">
            <div className="h-16 flex-1 border border-dashed border-line bg-surface-alt/60" />
            <div className="h-16 flex-1 border border-dashed border-line bg-surface-alt/60" />
          </div>
          <div className="mt-2 h-8 w-full bg-ink" />
        </div>
      </div>

      {/* Job board — overlaps top-right into center */}
      <div className="absolute right-[2%] top-[2%] z-20 w-[58%] border border-line bg-surface p-3 shadow-[0_16px_48px_oklch(0.22_0.02_250_/_0.1)] sm:right-[2.5%] sm:top-[3%] sm:w-[52%] sm:p-4">
        <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
          <span className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
            Job board
          </span>
          <span className="font-mono text-[length:var(--text-label)] text-accent">Live</span>
        </div>
        <div className="space-y-2">
          {["Quoted", "Scheduled", "In progress", "Complete"].map((status, i) => (
            <div key={status} className="flex items-center gap-2 border border-line bg-paper px-2 py-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 ${
                  i === 0
                    ? "bg-accent-2"
                    : i === 1
                      ? "bg-accent"
                      : i === 2
                        ? "bg-ink"
                        : "bg-line"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="h-1.5 w-3/4 bg-surface-alt" />
                <div className="mt-1 font-mono text-[9px] text-muted">{status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status strip — bridges quote form and checklist */}
      <div className="absolute bottom-[18%] left-[3%] z-20 w-[46%] border border-line bg-surface p-3 shadow-[0_12px_36px_oklch(0.22_0.02_250_/_0.08)] sm:bottom-[16%] sm:left-[4%] sm:w-[40%] sm:p-3.5">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted">
          Today
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Quotes", value: "12" },
            { label: "Jobs", value: "7" },
            { label: "Due", value: "3" },
          ].map((stat) => (
            <div key={stat.label} className="border border-line bg-paper px-1.5 py-2 text-center">
              <div className="font-mono text-sm tabular-nums text-ink">{stat.value}</div>
              <div className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-muted">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phone checklist — lower-right, overlaps job board */}
      <div className="absolute bottom-[3%] right-[3%] z-30 w-[48%] border border-line bg-surface p-2.5 shadow-[0_20px_50px_oklch(0.22_0.02_250_/_0.12)] sm:bottom-[4%] sm:right-[4%] sm:w-[42%] sm:p-3">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-line" />
        <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted">
          Field checklist
        </div>
        <div className="space-y-1.5">
          {["Site photos", "Materials", "Sign-off"].map((item, i) => (
            <div key={item} className="flex items-center gap-1.5 border border-line bg-paper px-1.5 py-1">
              <span
                className={`flex h-3 w-3 shrink-0 items-center justify-center border ${
                  i < 2 ? "border-accent bg-accent text-paper" : "border-line"
                }`}
              >
                {i < 2 ? (
                  <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2.5 6.5 5 9l4.5-5.5" />
                  </svg>
                ) : null}
              </span>
              <span className="truncate font-sans text-[length:var(--text-label)] text-ink">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoThumb({ title }: { title: string }) {
  return (
    <ImagePlaceholder
      aspect="demo"
      label={title}
      className="interactive-card border-line transition-[border-color] group-hover:border-ink"
    >
      <div className="absolute inset-0 bg-paper">
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 border-b border-line bg-surface px-2.5 py-1.5">
          <span className="size-1.5 rounded-full bg-line" />
          <span className="size-1.5 rounded-full bg-line" />
          <span className="size-1.5 rounded-full bg-accent/50" />
          <span className="ml-1 truncate font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
            {title}
          </span>
        </div>
        <div className="absolute inset-0 grid grid-cols-3 gap-1.5 p-2.5 pt-9">
          <div className="col-span-2 space-y-1.5">
            <div className="h-2 w-1/2 bg-surface-alt" />
            <div className="h-8 border border-line bg-surface" />
            <div className="h-8 border border-line bg-surface" />
          </div>
          <div className="min-h-[4rem] border border-accent/30 bg-accent/5" />
        </div>
      </div>
    </ImagePlaceholder>
  );
}

export function HomePage() {
  return (
    <>
      {/* Hero — copy + dominant collage as one tight composition */}
      <section data-section="Hero" className="border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-3 px-4 py-8 sm:gap-4 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,20.5rem)_minmax(0,1fr)] lg:gap-3 lg:py-10 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:gap-4">
          <Reveal>
            <h1 className="font-display text-[length:var(--text-display)] leading-[1.12] tracking-[-0.025em]">
              Custom software for businesses that have outgrown spreadsheets.
            </h1>
            <p className="mt-4 max-w-[22rem] font-sans text-[length:var(--text-body)] leading-relaxed text-muted">
              Web apps, portals, and automation for Tri-Cities operators.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 lg:mt-7">
              <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
              <Button href={SECONDARY_CTA.href} variant="ghost">
                {SECONDARY_CTA.label}
              </Button>
            </div>
          </Reveal>
          <Reveal delayMs={80} className="min-w-0">
            <ImagePlaceholder aspect="hero" label="Product collage" className="border-line">
              <HeroCollage />
            </ImagePlaceholder>
          </Reveal>
        </div>
      </section>

      {/* Pain — numbered list, not equal cards */}
      <Section
        label="Pain"
        title="If this is how your business runs, you are probably leaking time and money."
      >
        <ol className="divide-y divide-line border-y border-line">
          {painPoints.map((point, index) => (
            <Reveal key={point} as="li" delayMs={index * 40} className="flex gap-4 py-4 sm:gap-6 sm:py-5">
              <span className="w-8 shrink-0 font-mono text-[length:var(--text-small)] tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="font-sans text-[length:var(--text-body)] text-ink">{point}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* Systems — equal cards, no empty grid cells */}
      <Section label="Systems" title="Systems I build" className="bg-surface">
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
          {systemsBuilt.map((system, index) => (
            <Reveal
              key={system}
              delayMs={Math.min(index, 5) * 40}
              className="flex h-full min-h-[8.75rem] flex-col border border-line bg-paper p-5 sm:min-h-[9.5rem]"
            >
              <span className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 flex-1 font-display text-[length:var(--text-h3)] leading-snug text-ink">
                {system}
              </p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Industries — image-led tiles */}
      <Section label="Industries" title="Built around the way your business actually works">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry, index) => {
            const caption = industryCaptions[industry.slug] ?? "Operations";
            const blurb =
              industryHomeBlurbs[industry.slug] ?? industry.description;
            return (
              <Reveal key={industry.slug} delayMs={Math.min(index, 5) * 50}>
                <Link
                  href={`/industries/${industry.slug}`}
                  className="group block focus-visible:outline-offset-4"
                >
                  <ImagePlaceholder
                    aspect="industry"
                    label={industry.title}
                    caption={caption}
                    className="interactive-card transition-[border-color] group-hover:border-ink"
                  >
                    <Image
                      src={industryImageSrc(industry.slug)}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover object-center"
                    />
                  </ImagePlaceholder>
                  <h3 className="interactive-link mt-3 font-display text-[length:var(--text-h3)] text-ink group-hover:text-accent">
                    {industry.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 font-sans text-[length:var(--text-small)] leading-snug text-muted">
                    {blurb}
                  </p>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* Demos — showroom with UI thumbs */}
      <Section label="Examples" title="Example systems" className="bg-surface">
        <p className="mb-8 max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
          Interactive demos of the kinds of systems Tri-Cities operators actually need — not slide
          decks.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {examples.map((example, index) => (
            <Reveal key={example.slug} delayMs={Math.min(index, 4) * 50}>
              <Link
                href={`/examples/${example.slug}`}
                className="group block focus-visible:outline-offset-4"
              >
                <DemoThumb title={example.title} />
                <h3 className="interactive-link mt-3 font-display text-[length:var(--text-h3)] text-ink group-hover:text-accent">
                  {example.title}
                </h3>
                <p className="mt-1 line-clamp-2 font-sans text-[length:var(--text-small)] leading-snug text-muted">
                  {example.proves}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
        <div className="mt-8">
          <Button href="/examples" variant="ghost">
            Browse the full showroom
          </Button>
        </div>
      </Section>

      {/* Offers — pricing cards */}
      <Section label="Offers" title="Ways to work together">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {offerTiers.map((tier, index) => {
            const featured = index === 0;
            return (
              <Reveal key={tier.name} delayMs={index * 60} className="h-full">
                <Card
                  className={`flex h-full min-h-[14.5rem] flex-col ${featured ? "border-accent" : ""}`}
                >
                  <div className="flex min-h-[1.25rem] items-start justify-between gap-3">
                    <h3 className="font-display text-[length:var(--text-h3)] text-ink">
                      {tier.name}
                    </h3>
                    {featured ? (
                      <span className="shrink-0 font-mono text-[length:var(--text-label)] uppercase tracking-wider text-accent">
                        Start here
                      </span>
                    ) : null}
                  </div>
                  <p className="price-display mt-4">{tier.price}</p>
                  <p className="mt-3 flex-1 font-sans text-[length:var(--text-small)] leading-snug text-muted">
                    {tier.bestFor}
                  </p>
                  <div className="mt-6">
                    <Button
                      href={index === 0 ? "/workflow-audit" : "/pricing"}
                      variant={featured ? "primary" : "secondary"}
                    >
                      {index === 0 ? "Request an audit" : "See details"}
                    </Button>
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </div>
        <div className="mt-8">
          <Button href="/pricing" variant="ghost">
            See full pricing →
          </Button>
        </div>
      </Section>

      {/* Why — split copy + photo slot */}
      <Section label="Why GDG" title="Built by someone who understands messy real-world workflows.">
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
          <Reveal>
            <p className="font-sans text-[length:var(--text-body)] text-muted">{whyGdgCopy}</p>
            <p className="mt-4 font-sans text-[length:var(--text-body)] text-muted">
              Focused on Tri-Cities owner-operators — contractors, shops, manufacturers, and
              hospitality — who need production-ops depth, not another generic agency pitch.
            </p>
            <div className="mt-6">
              <Button href="/about" variant="ghost">
                About Grogan Development Group
              </Button>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <ImagePlaceholder
              aspect="about"
              label="Founder / ops photo"
              caption="Photo — founder / ops"
              className="sm:aspect-auto"
            >
              <Image
                src={SITE_IMAGES.about}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover object-center"
              />
            </ImagePlaceholder>
          </Reveal>
        </div>
      </Section>

      {/* Final audit CTA band */}
      <section data-section="CTA" className="border-b border-line bg-ink text-paper">
        <Container className="py-14 sm:py-16 lg:py-20">
          <Reveal className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
            <div className="max-w-xl">
              <p className="mb-3 font-mono text-[length:var(--text-label)] uppercase tracking-wider text-paper/50">
                Next step
              </p>
              <h2 className="font-display text-[length:var(--text-h2)] text-paper">
                Want to see where software could save your business time?
              </h2>
              <p className="mt-3 max-w-md font-sans text-[length:var(--text-small)] leading-relaxed text-paper/70">
                A focused workflow audit maps the bottlenecks and shows what is worth building.
              </p>
            </div>
            <Button href={PRIMARY_CTA.href} variant="inverse" className="shrink-0">
              Request a Workflow Audit
            </Button>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
