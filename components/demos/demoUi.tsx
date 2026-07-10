import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const field =
  "w-full min-h-[var(--tap-min)] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const btnBase =
  "inline-flex min-h-[var(--tap-min)] items-center justify-center border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function DemoLabel({ className = "", children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}

export function DemoInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${field} ${className}`} {...rest} />;
}

export function DemoSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`${field} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function DemoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`${field} ${className}`} {...rest} />;
}

type DemoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function DemoButton({
  variant = "primary",
  className = "",
  children,
  ...rest
}: DemoButtonProps) {
  const styles =
    variant === "primary"
      ? "border-ink bg-ink text-paper hover:bg-transparent hover:text-ink"
      : variant === "secondary"
        ? "border-line bg-surface text-ink hover:border-ink"
        : "border-transparent bg-transparent text-accent underline-offset-4 hover:underline";

  return (
    <button type="button" className={`${btnBase} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function DemoMeta({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}

export function DemoStat({
  value,
  label,
  emphasize,
}: {
  value: string | number;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <div className="border border-line bg-surface-alt/50 px-3 py-2.5 text-center">
      <p
        className={`font-mono text-[length:var(--text-h3)] tabular-nums ${emphasize ? "text-accent" : "text-ink"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[length:var(--text-label)] uppercase tracking-[0.1em] text-muted">
        {label}
      </p>
    </div>
  );
}
