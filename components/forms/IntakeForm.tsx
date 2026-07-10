"use client";

import { useState } from "react";
import { BUDGET_RANGES, NEED_TYPES } from "@/lib/site";
import { Card } from "@/components/layout/Card";

const YES_NO_NOT_SURE = ["Yes", "No", "Not sure"] as const;

type IntakeFormProps = {
  formType?: "contact" | "workflow-audit";
};

export function IntakeForm({ formType = "contact" }: IntakeFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, formType }),
      });

      if (!res.ok) throw new Error("Submission failed");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again or email hello@grogan.dev.");
    }
  }

  if (status === "success") {
    return (
      <Card data-section="Success" className="p-6">
        <p className="font-display text-[length:var(--text-h3)] text-ink">Request received.</p>
        <p className="mt-2 font-sans text-[length:var(--text-small)] text-muted">
          We will review your submission and follow up shortly.
        </p>
      </Card>
    );
  }

  const fieldClass =
    "w-full min-h-[var(--tap-min)] border border-line bg-surface px-3 py-2.5 font-sans text-[length:var(--text-small)] transition-colors focus:border-accent";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-1 font-mono text-[length:var(--text-label)] tracking-wide text-muted uppercase">
          Business
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" name="businessName" required className={fieldClass} />
          <Field label="Website" name="website" type="url" className={fieldClass} />
          <Field label="Industry" name="industry" required className={fieldClass} />
          <Field label="Timeline" name="timeline" className={fieldClass} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 font-mono text-[length:var(--text-label)] tracking-wide text-muted uppercase">
          The problem
        </legend>
        <Field
          label="Biggest workflow problem"
          name="biggestProblem"
          required
          textarea
          className={fieldClass}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="What are you using now?"
            name="currentTools"
            textarea
            className={fieldClass}
          />
          <Field
            label="Where are things getting lost?"
            name="thingsLost"
            textarea
            className={fieldClass}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 font-mono text-[length:var(--text-label)] tracking-wide text-muted uppercase">
          Qualifying details
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Approximate number of users"
            name="approximateUsers"
            type="number"
            className={fieldClass}
          />
          <SelectField
            id="customerAccess"
            name="customerAccess"
            label="Do customers need access?"
            className={fieldClass}
            options={YES_NO_NOT_SURE}
          />
          <SelectField
            id="fileUploads"
            name="fileUploads"
            label="File or photo uploads needed?"
            className={fieldClass}
            options={YES_NO_NOT_SURE}
          />
          <SelectField
            id="integrationsNeeded"
            name="integrationsNeeded"
            label="Integrations needed?"
            className={fieldClass}
            options={YES_NO_NOT_SURE}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 font-mono text-[length:var(--text-label)] tracking-wide text-muted uppercase">
          Scope & contact
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="needType"
              className="mb-1.5 block font-sans text-[length:var(--text-small)] font-medium"
            >
              Need type
            </label>
            <select id="needType" name="needType" required className={fieldClass}>
              <option value="">Select...</option>
              {NEED_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="budgetRange"
              className="mb-1.5 block font-sans text-[length:var(--text-small)] font-medium"
            >
              Budget range
            </label>
            <select id="budgetRange" name="budgetRange" required className={fieldClass}>
              <option value="">Select...</option>
              {BUDGET_RANGES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <Field label="Contact name" name="contactName" required className={fieldClass} />
          <Field
            label="Contact email"
            name="email"
            type="email"
            required
            className={fieldClass}
          />
        </div>
      </fieldset>

      {error ? (
        <p className="font-sans text-[length:var(--text-small)] text-danger">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex min-h-[var(--tap-min)] items-center justify-center border border-ink bg-ink px-5 py-2.5 font-sans text-[length:var(--text-small)] font-medium text-paper transition-colors hover:bg-transparent hover:text-ink disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  className: string;
};

function Field({ label, name, type = "text", required, textarea, className }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block font-sans text-[length:var(--text-small)] font-medium"
      >
        {label}
      </label>
      {textarea ? (
        <textarea id={name} name={name} required={required} rows={3} className={className} />
      ) : (
        <input id={name} name={name} type={type} required={required} className={className} />
      )}
    </div>
  );
}

type SelectFieldProps = {
  id: string;
  name: string;
  label: string;
  className: string;
  options: readonly string[];
  required?: boolean;
};

function SelectField({ id, name, label, className, options, required }: SelectFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-sans text-[length:var(--text-small)] font-medium"
      >
        {label}
      </label>
      <select id={id} name={name} required={required} className={className}>
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
