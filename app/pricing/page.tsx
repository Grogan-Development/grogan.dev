import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/layout/Card";
import { Button } from "@/components/layout/Button";
import { FlowStepper } from "@/components/layout/FlowStepper";
import {
  pricingIntro,
  positioning,
  startingPoints,
  offerLadder,
  serviceRanges,
  exampleBudgets,
  foundingOfferRows,
  foundingRules,
  foundingOfferCopy,
  whatAffectsPrice,
  notIncluded,
  quotingSteps,
  fitCheck,
  valueFraming,
  ownership,
} from "@/content/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Public ranges for custom business systems — audits from $750, focused builds $4,500–$9,500, plus a limited founding-client offer.",
};

const fitCheckHref = "/contact?intent=fit-check";

const ladderSteps = [
  {
    name: fitCheck.label,
    display: fitCheck.price,
    bestFor: fitCheck.description,
  },
  ...offerLadder.map((row) => ({
    name: row.name,
    display: row.range.display,
    bestFor: row.bestFor,
  })),
];

const foundingRuleList = [
  foundingRules.maxClients,
  foundingRules.expires,
  foundingRules.discountScope,
  `Payment: ${foundingRules.paymentTerms}`,
  foundingRules.caseStudyRequirements,
  foundingRules.feedbackSla,
  foundingRules.verticalPreference,
] as const;

export default function PricingPage() {
  return (
    <>
      <PageHeader
        label="Pricing"
        title={pricingIntro.headline}
        description={pricingIntro.subhead}
      />

      {/* 1. Hero ranges + positioning */}
      <Section label="Overview" className="bg-surface">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex h-full flex-col">
            <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
              Focused systems
            </p>
            <p className="price-display mt-3">{positioning.focusedSystemsSummary}</p>
            <p className="mt-2 font-sans text-[length:var(--text-small)] text-muted">
              Most first builds land here
            </p>
          </Card>
          <Card className="flex h-full flex-col">
            <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
              Audits start at
            </p>
            <p className="price-display mt-3">{positioning.auditsStartAt}</p>
            <p className="mt-2 font-sans text-[length:var(--text-small)] text-muted">
              Paid discovery before a build
            </p>
          </Card>
          <Card className="flex h-full flex-col">
            <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
              Prototypes
            </p>
            <p className="price-display mt-3">{positioning.prototypesSummary}</p>
            <p className="mt-2 font-sans text-[length:var(--text-small)] text-muted">
              See a concept before full scope
            </p>
          </Card>
        </div>
        <p className="mt-8 max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
          {positioning.systemsNotWebsites}
        </p>
        <p className="mt-4 max-w-3xl font-sans text-[length:var(--text-small)] text-muted">
          {positioning.leanCustomSoftware}
        </p>
      </Section>

      {/* 2. Choose starting point */}
      <Section label="Starting points" title="Choose a starting point">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Starting point</th>
                <th>Price</th>
                <th>Best for</th>
              </tr>
            </thead>
            <tbody>
              {startingPoints.map((row) => (
                <tr key={row.name}>
                  <td className="font-medium text-ink">{row.name}</td>
                  <td className="price-cell">{row.range.display}</td>
                  <td className="text-muted">{row.bestFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 3. Offer ladder */}
      <Section label="Ladder" title="Offer ladder" className="bg-surface">
        <p className="mb-8 max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
          Start with a free Fit Check, then move through audit, prototype, build, and optional
          monthly support — only as far as you need.
        </p>
        <FlowStepper steps={ladderSteps.map((step) => step.name)} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ladderSteps.map((step, index) => (
            <Card key={step.name} className="flex h-full flex-col">
              <span className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-[length:var(--text-h3)] text-ink">
                {step.name}
              </h3>
              <p className="mt-2 font-mono text-[length:var(--text-body)] tabular-nums text-ink">
                {step.display}
              </p>
              <p className="mt-3 flex-1 font-sans text-[length:var(--text-small)] text-muted">
                {step.bestFor}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* 4. Service / example budgets */}
      <Section label="Services" title="Service ranges">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Typical range</th>
                <th>Best for</th>
              </tr>
            </thead>
            <tbody>
              {serviceRanges.map((row) => (
                <tr key={row.name}>
                  <td className="font-medium text-ink">{row.name}</td>
                  <td className="price-cell">{row.range.display}</td>
                  <td className="text-muted">{row.bestFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section label="Examples" title="Example budgets" className="bg-surface">
        <p className="mb-6 max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
          Local-operator language for common first systems. Final quotes follow discovery.
        </p>
        <ul className="divide-y divide-line border-y border-line">
          {exampleBudgets.map((item) => (
            <li
              key={item.example}
              className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <span className="font-sans text-[length:var(--text-body)] text-ink">
                {item.example}
              </span>
              <span className="price-inline shrink-0">{item.typicalBudget}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5. Founding client offer */}
      <Section label="Founding" title={foundingOfferCopy.headline}>
        <Card className="border-accent/40 bg-surface p-6 sm:p-8">
          <p className="max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
            {foundingOfferCopy.body}
          </p>
          <p className="mt-3 font-sans text-[length:var(--text-small)] text-muted">
            {foundingRules.scarcityNote}
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Offer</th>
                  <th>Public rate</th>
                  <th>Founding (50%)</th>
                </tr>
              </thead>
              <tbody>
                {foundingOfferRows.map((row) => (
                  <tr key={row.name}>
                    <td className="font-medium text-ink">{row.name}</td>
                    <td className="price-cell text-muted">{row.publicDisplay}</td>
                    <td className="price-cell">{row.foundingDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 font-display text-[length:var(--text-h3)] text-ink">
            Founding rules
          </h3>
          <ul className="mt-4 space-y-2.5">
            {foundingRuleList.map((rule) => (
              <li
                key={rule}
                className="flex gap-3 font-sans text-[length:var(--text-small)] text-muted"
              >
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-accent font-mono text-[length:var(--text-label)] text-accent"
                  aria-hidden
                >
                  ·
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Button href={fitCheckHref}>Ask about founding slots</Button>
          </div>
        </Card>
      </Section>

      {/* 6. Integrations */}
      <Section label="Integrations" title="Bridge tools you already use" className="bg-surface">
        <p className="max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
          {positioning.integrationsBridge}
        </p>
        <p className="mt-4 max-w-3xl font-sans text-[length:var(--text-small)] text-muted">
          {positioning.categoryWedge}
        </p>
      </Section>

      {/* 7. What affects price + Not included */}
      <Section label="Scope" title="What affects price">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <ul className="space-y-2.5">
              {whatAffectsPrice.map((item) => (
                <li key={item} className="flex gap-3 font-sans text-[length:var(--text-small)]">
                  <span className="mt-1.5 size-1.5 shrink-0 bg-accent" aria-hidden />
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-display text-[length:var(--text-h3)] text-ink">
              Not included
            </h3>
            <ul className="space-y-2.5">
              {notIncluded.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 font-sans text-[length:var(--text-small)] text-muted"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 bg-line" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 8. How quoting works */}
      <Section label="Quoting" title="How quoting works" className="bg-surface">
        <ol className="divide-y divide-line border-y border-line">
          {quotingSteps.map((item, index) => (
            <li key={item.step} className="flex gap-4 py-5 sm:gap-6">
              <span className="w-8 shrink-0 font-mono text-[length:var(--text-small)] tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-display text-[length:var(--text-h3)] text-ink">
                  {item.step.replace(/^\d+\.\s*/, "")}
                </h3>
                <p className="mt-2 font-sans text-[length:var(--text-small)] text-muted">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* 9. Why ranges / ownership / value */}
      <Section label="Framing" title={valueFraming.headline}>
        <p className="max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
          {valueFraming.body}
        </p>
        <div className="mt-10 border-t border-line pt-8">
          <h3 className="font-display text-[length:var(--text-h2)] text-ink">
            {ownership.headline}
          </h3>
          <p className="mt-4 max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
            {ownership.body}
          </p>
        </div>
      </Section>

      {/* 10. CTAs */}
      <Section label="Next" title="Next step">
        <p className="mb-6 max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
          {fitCheck.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button href={fitCheckHref}>{fitCheck.ctaLabel}</Button>
          <Button href="/workflow-audit" variant="secondary">
            Workflow Audit
          </Button>
          <Button href="/examples" variant="ghost">
            Examples
          </Button>
        </div>
      </Section>
    </>
  );
}
