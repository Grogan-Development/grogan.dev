import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

const variantStyles: Record<ButtonVariant, string> = {
  // !text-* beats inherited link color from @layer base `a { color: inherit }`
  primary: "border-ink bg-ink !text-paper hover:bg-transparent hover:!text-ink",
  secondary: "border-control bg-surface text-ink hover:border-ink hover:bg-surface-alt",
  ghost: "border-transparent bg-transparent text-accent underline-offset-4 hover:underline",
  // Paper fill on ink/dark bands — do not override via className (no twMerge)
  inverse:
    "border-paper bg-paper !text-ink hover:border-paper hover:bg-transparent hover:!text-paper",
};

export function Button({
  href,
  children,
  variant = "primary",
  className = "",
  onClick,
}: ButtonProps) {
  const base =
    "inline-flex min-h-[var(--tap-min)] items-center justify-center border px-5 py-2.5 font-sans text-[length:var(--text-small)] font-medium transition-colors";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`${base} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
