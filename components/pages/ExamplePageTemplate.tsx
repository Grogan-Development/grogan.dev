import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { FlowStepper } from "@/components/layout/FlowStepper";
import { DemoFrame } from "@/components/layout/DemoFrame";
import { Button } from "@/components/layout/Button";
import type { ExamplePage } from "@/lib/types";
import { PRIMARY_CTA } from "@/lib/site";
import type { ReactNode } from "react";

type ExamplePageTemplateProps = {
  example: ExamplePage;
  demo: ReactNode;
};

export function ExamplePageTemplate({ example, demo }: ExamplePageTemplateProps) {
  return (
    <>
      <PageHeader
        label="Example system"
        title={example.title}
        description={example.description}
      />

      <Section label="Flow" title="How it works">
        <FlowStepper steps={example.flow} />
      </Section>

      <Section label="Interactive demo" title="Try the shell" className="bg-surface">
        {/* Device frame lives here so demo-chrome can wrap shell internals without fighting layout */}
        <DemoFrame title={example.title}>{demo}</DemoFrame>
      </Section>

      <Section label="What this proves" title="What this proves">
        <p className="max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
          {example.proves}
        </p>
      </Section>

      <Section>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
          <Link
            href="/examples"
            className="interactive-link font-sans text-[length:var(--text-small)] text-muted underline-offset-4 hover:text-accent hover:underline"
          >
            Back to examples
          </Link>
        </div>
      </Section>
    </>
  );
}
