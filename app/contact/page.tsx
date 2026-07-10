import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/layout/Card";
import { IntakeForm } from "@/components/forms/IntakeForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Grogan Development Group — tell us about your workflow problem.",
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        label="Contact"
        title="Tell us about your workflow"
        description="A short note on the problem is enough. Include budget range so we can point you to the right next step."
      />
      <Section label="Form" className="pt-10 pb-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] lg:items-start lg:gap-12">
          <div className="max-w-3xl">
            <IntakeForm formType="contact" />
          </div>
          <aside className="lg:sticky lg:top-24">
            <Card className="space-y-4 p-6">
              <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                Direct
              </p>
              <h2 className="font-display text-[length:var(--text-h3)] text-ink">Prefer email?</h2>
              <p className="font-sans text-[length:var(--text-small)] text-muted">
                Send a short note about the workflow problem. We reply from the same inbox.
              </p>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex min-h-[var(--tap-min)] items-center font-sans text-[length:var(--text-small)] text-accent underline-offset-4 hover:underline"
              >
                {SITE.email}
              </a>
            </Card>
          </aside>
        </div>
      </Section>
    </>
  );
}
